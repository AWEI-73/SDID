#!/usr/bin/env node
/**
 * dep-scan.cjs v1.0
 *
 * import/export 依賴圖分析工具
 *
 * 職責：
 *   1. 掃描 src/ / lib/ 所有 .ts/.tsx/.cjs/.js 檔案的 import / require 語句
 *   2. 掃描 export 宣告（function / const / class / default）
 *   3. 建立依賴圖（adjacency list）
 *   4. 偵測 circular dependency（DFS）
 *   5. 偵測 unused export（export 存在但無任何人 import）
 *   6. 輸出 .gems/docs/deps.json
 *
 * 用法：
 *   node task-pipe/tools/dep-scan.cjs --target=./myproject
 *   node task-pipe/tools/dep-scan.cjs --target=./myproject --verbose
 *   node task-pipe/tools/dep-scan.cjs --target=./myproject --json   ← 純 JSON stdout
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ── CLI 參數 ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = {};
for (const arg of args) {
  if (arg.startsWith('--')) {
    const [key, val] = arg.slice(2).split('=');
    flags[key] = val !== undefined ? val : true;
  }
}

const targetRaw  = flags.target || '.';
const verbose    = !!flags.verbose;
const jsonMode   = !!flags.json;

const target     = path.isAbsolute(targetRaw) ? targetRaw : path.resolve(process.cwd(), targetRaw);
const outDir     = path.join(target, '.gems', 'docs');

// ── 主程式 ────────────────────────────────────────────────────────────────────
function main() {
  const { files, srcDir, source } = collectFiles(target);
  if (files.length === 0) {
    fatal(`找不到任何 .ts / .tsx 檔案（嘗試 src/ 目錄與 git ls-files 均無結果）`);
  }

  // 建立 graph
  const graph = {};
  for (const f of files) {
    const rel = path.relative(target, f).replace(/\\/g, '/');
    graph[rel] = {
      imports: parseImports(f, target),
      exports: parseExports(f),
    };
  }

  // 偵測 circular dep
  const circular = detectCircular(graph);

  // 偵測 unused export
  const unusedExports = detectUnusedExports(graph);

  const result = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    target: path.relative(process.cwd(), target) || '.',
    graph,
    circular,
    unusedExports,
    summary: {
      totalFiles:        files.length,
      totalEdges:        Object.values(graph).reduce((s, v) => s + v.imports.length, 0),
      circularCount:     circular.length,
      unusedExportCount: unusedExports.length,
    },
  };

  // 輸出 JSON
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, 'deps.json');
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8');

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  // 人可讀輸出
  console.log('\n📦 dep-scan — import/export 依賴分析');
  console.log(`   來源     : ${source}`);
  console.log(`   掃描路徑 : ${srcDir || target}`);
  console.log(`   檔案數量 : ${files.length}`);
  console.log(`   依賴邊數 : ${result.summary.totalEdges}`);

  if (circular.length > 0) {
    console.log(`\n❌ CIRCULAR DEPENDENCY (${circular.length})`);
    for (const chain of circular) {
      console.log(`   ${chain.join(' → ')}`);
    }
  } else {
    console.log('\n✅ 無 circular dependency');
  }

  if (unusedExports.length > 0 && verbose) {
    console.log(`\n⚠️  未使用 export (${unusedExports.length})`);
    for (const { file, names } of unusedExports) {
      console.log(`   ${file}: ${names.join(', ')}`);
    }
  }

  console.log(`\n   輸出 → ${path.relative(process.cwd(), outFile)}`);

  if (circular.length > 0) {
    console.log('\n@BLOCKER circular dependency 必須解除後才能繼續 BUILD');
    process.exitCode = 1;
  } else {
    console.log('\n@PASS deps.json 已產出');
  }

  return result;
}

// ── 工具函式 ──────────────────────────────────────────────────────────────────

/**
 * 收集 .ts/.tsx 檔案：
 *   1. 優先掃 src/ / app/ / lib/ 目錄
 *   2. 若不存在，fallback 到 git ls-files
 *   3. git 也沒有，回傳空陣列
 */
function collectFiles(root) {
  // 1. 嘗試標準目錄
  const candidates = ['src', 'app', 'lib', 'pages'];
  for (const c of candidates) {
    const dir = path.join(root, c);
    if (fs.existsSync(dir)) {
      const files = walkDir(dir);
      if (files.length > 0) {
        return { files, srcDir: dir, source: `dir:${c}/` };
      }
    }
  }

  // 2. fallback: git ls-files
  try {
    const { execSync } = require('child_process');
    const out = execSync('git ls-files --cached --others --exclude-standard', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const files = out.split('\n')
      .map(l => l.trim())
      .filter(l =>
        /\.(ts|tsx|cjs|js)$/.test(l) &&
        !/\.d\.ts$/.test(l) &&
        !l.includes('node_modules') &&
        !l.split('/').some(seg => seg.startsWith('.'))   // 排除 .agent/ .kiro/ 等隱藏目錄
      )
      .map(l => path.resolve(root, l));
    if (files.length > 0) {
      return { files, srcDir: null, source: 'git ls-files' };
    }
  } catch { /* git 不可用 */ }

  return { files: [], srcDir: null, source: 'none' };
}

function walkDir(dir) {
  const result = [];
  function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(ts|tsx|cjs|js)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) result.push(full);
    }
  }
  walk(dir);
  return result;
}

function parseImports(filePath, root) {
  // 先移除 block comment，避免 JSDoc 範例被誤抓
  const src = safeRead(filePath).replace(/\/\*[\s\S]*?\*\//g, '');
  const results = [];
  // 靜態 import: import ... from './path'
  const staticRe = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
  // require: require('./path')
  const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const re of [staticRe, requireRe]) {
    let m;
    while ((m = re.exec(src)) !== null) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue; // 跳過 node_modules
      const resolved = resolveLocal(filePath, spec, root);
      if (resolved) results.push(resolved);
    }
  }
  return [...new Set(results)];
}

function parseExports(filePath) {
  const src = safeRead(filePath);
  const names = [];
  // export function/class/const/let/var name
  const declRe = /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  let m;
  while ((m = declRe.exec(src)) !== null) names.push(m[1]);
  // export default (anonymous)
  if (/export\s+default\b/.test(src) && !names.includes('default')) names.push('default');
  // export { A, B, C }
  const namedRe = /export\s+\{([^}]+)\}/g;
  while ((m = namedRe.exec(src)) !== null) {
    m[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop().trim())
      .filter(Boolean).forEach(n => names.push(n));
  }
  return [...new Set(names)];
}

function resolveLocal(fromFile, spec, root) {
  const dir = path.dirname(fromFile);
  const base = path.resolve(dir, spec);
  // 嘗試各種副檔名
  const candidates = [
    base,
    base + '.ts', base + '.tsx', base + '.cjs', base + '.js',
    path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
    path.join(base, 'index.cjs'), path.join(base, 'index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return path.relative(root, c).replace(/\\/g, '/');
  }
  return null;
}

function detectCircular(graph) {
  const visited   = new Set();
  const inStack   = new Set();
  const cycles    = [];

  function dfs(node, stack) {
    if (inStack.has(node)) {
      const cycleStart = stack.indexOf(node);
      cycles.push([...stack.slice(cycleStart), node]);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    stack.push(node);
    for (const dep of (graph[node]?.imports || [])) {
      if (graph[dep]) dfs(dep, stack);
    }
    stack.pop();
    inStack.delete(node);
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) dfs(node, []);
  }
  return cycles;
}

function detectUnusedExports(graph) {
  // 建立 importedNames: { file → Set<name> } 集合（目前只追蹤有無被 import，不解析具名 import）
  const importedFiles = new Set();
  for (const { imports } of Object.values(graph)) {
    for (const dep of imports) importedFiles.add(dep);
  }

  const unused = [];
  for (const [file, { exports }] of Object.entries(graph)) {
    // 非 index.ts 且未被任何人 import → 所有 export 均視為未使用
    if (!importedFiles.has(file) && exports.length > 0) {
      // 過濾掉 entry point（App.tsx / main.ts / index.ts）
      const base = path.basename(file);
      if (['App.tsx', 'App.ts', 'main.ts', 'main.tsx', 'index.ts', 'index.tsx'].includes(base)) continue;
      unused.push({ file, names: exports });
    }
  }
  return unused;
}

function safeRead(f) {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
}

function fatal(msg) {
  console.error(`[dep-scan] ❌ ${msg}`);
  process.exit(1);
}

// ── 執行 ──────────────────────────────────────────────────────────────────────
module.exports = { run: main, detectCircular, parseImports, parseExports };

if (require.main === module) {
  main();
}
