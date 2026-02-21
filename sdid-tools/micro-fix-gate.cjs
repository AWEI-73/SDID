#!/usr/bin/env node
/**
 * Micro-Fix Gate v1.0
 * 輕量驗證器 — 只驗改動的檔案，不需要 story/plan
 *
 * 用途: MICRO-FIX 模式 (改小地方，不走完整 BUILD 流程)
 * 驗證: 1. GEMS 標籤存在 (寬鬆版)  2. import/export 整合不斷鏈
 * 不驗: 測試、路由、UI bind、plan 一致性
 *
 * 用法:
 *   node sdid-tools/micro-fix-gate.cjs --changed=src/foo.ts,src/bar.ts --target=<project>
 *   node sdid-tools/micro-fix-gate.cjs --target=<project>   (自動掃 src/)
 *
 * 輸出:
 *   @PASS   — 標籤 OK + 整合 OK
 *   @BLOCKER — 有問題，附修復指引
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ============================================
// 參數解析
// ============================================
function parseArgs() {
  const args = { changed: [], target: null, help: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--changed=')) {
      args.changed = arg.split('=').slice(1).join('=').split(',').map(f => f.trim()).filter(Boolean);
    } else if (arg.startsWith('--target=')) {
      args.target = path.resolve(arg.split('=').slice(1).join('='));
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  return args;
}

// ============================================
// 1. GEMS 標籤檢查 (寬鬆版)
// ============================================

/**
 * 從檔案內容提取 GEMS 標籤
 * 只要有 GEMS: 或 @GEMS 就算有標籤，不強制格式
 */
function hasGemsTag(content) {
  return /GEMS[:\s]/i.test(content);
}

/**
 * 掃描單一檔案的 GEMS 標籤覆蓋率
 * 找出所有 export function/const/class，檢查前面有沒有 GEMS 標籤
 * 排除: 小型 helper export（無參數或只有 getter，且整個檔案已有 GEMS 標籤）
 */
function checkFileTags(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // 如果整個檔案有 GEMS 標籤，小型 helper export 不強制要求
  const fileHasGems = hasGemsTag(content);

  // 找所有 export 宣告
  const exportPattern = /^export\s+(?:async\s+)?(?:function|const|class|interface|enum|type)\s+(\w+)/;
  const exports = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(exportPattern);
    if (m) {
      exports.push({ name: m[1], line: i + 1 });
    }
  }

  if (exports.length === 0) return { file: filePath, ok: true, missing: [], total: 0 };

  // 對每個 export，往上找 GEMS 標籤（最多找 20 行）
  const missing = [];
  for (const exp of exports) {
    const searchStart = Math.max(0, exp.line - 20);
    const before = lines.slice(searchStart, exp.line - 1).join('\n');
    if (!hasGemsTag(before)) {
      // 如果整個檔案已有 GEMS 標籤，且這個 export 看起來是小型 helper
      // (函式名以 get/set/is/has 開頭，或是 type/interface/enum)，寬鬆放行
      const isHelper = fileHasGems && /^(?:get|set|is|has|to|from)[A-Z]/.test(exp.name);
      const isTypeDecl = lines[exp.line - 1]?.match(/^export\s+(?:type|interface|enum)\s+/);
      if (!isHelper && !isTypeDecl) {
        missing.push(exp.name);
      }
    }
  }

  return {
    file: filePath,
    ok: missing.length === 0,
    missing,
    total: exports.length
  };
}

// ============================================
// 2. Import/Export 整合檢查
// ============================================

/**
 * 找出檔案中所有 import 的路徑，驗證目標檔案存在
 */
function checkImports(filePath, projectRoot) {
  const content = fs.readFileSync(filePath, 'utf8');
  const dir = path.dirname(filePath);
  const issues = [];

  // 只檢查相對路徑 import（不檢查 node_modules）
  const importPattern = /(?:import|require)\s*(?:\{[^}]*\}|[\w*]+)?\s*(?:from\s*)?['"](\.[^'"]+)['"]/g;
  let m;

  while ((m = importPattern.exec(content)) !== null) {
    const importPath = m[1];
    const resolved = resolveImport(dir, importPath);
    if (resolved && !fs.existsSync(resolved)) {
      issues.push({
        import: importPath,
        expected: path.relative(projectRoot, resolved)
      });
    }
  }

  return issues;
}

/**
 * 解析 import 路徑到實際檔案
 * TypeScript 專案常用 .js 副檔名指向 .ts 檔案
 */
function resolveImport(dir, importPath) {
  // 移除 .js 副檔名（TypeScript ESM 慣例）
  const cleanPath = importPath.replace(/\.js$/, '');
  const base = path.resolve(dir, cleanPath);
  // 嘗試各種副檔名
  const candidates = [
    base,
    base + '.ts', base + '.tsx', base + '.js', base + '.jsx',
    path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
    path.join(base, 'index.js'), path.join(base, 'index.jsx'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // 回傳第一個候選（用於報告）
  return base + '.ts';
}

/**
 * 找出 src 目錄下所有 .ts/.tsx/.js/.jsx 檔案
 */
function findSourceFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', 'dist', '__tests__', '.gems'].includes(entry.name)) {
      findSourceFiles(full, files);
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
      files.push(full);
    }
  }
  return files;
}

// ============================================
// 主程式
// ============================================
function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
Micro-Fix Gate v1.0 — 輕量驗證器

用法:
  node sdid-tools/micro-fix-gate.cjs --changed=src/foo.ts,src/bar.ts [--target=<project>]
  node sdid-tools/micro-fix-gate.cjs --target=<project>   (自動掃 src/)

選項:
  --changed=<files>  逗號分隔的改動檔案清單 (相對或絕對路徑)
  --target=<path>    專案根目錄 (預設: 當前目錄)
  --help             顯示此訊息

驗證項目:
  ✓ GEMS 標籤存在 (export 函式前有 GEMS 標籤)
  ✓ import 路徑不斷鏈 (相對路徑 import 目標存在)

不驗項目:
  ✗ 測試 (MICRO-FIX 不需要)
  ✗ 路由整合 (MICRO-FIX 不需要)
  ✗ Plan 一致性 (MICRO-FIX 不需要)
`);
    process.exit(0);
  }

  const projectRoot = args.target || process.cwd();

  // 決定要掃描的檔案
  let filesToCheck = [];

  if (args.changed.length > 0) {
    // 使用者指定了改動的檔案
    // 嘗試: 1) 絕對路徑  2) 相對於 cwd  3) 相對於 projectRoot
    filesToCheck = args.changed.map(f => {
      if (path.isAbsolute(f)) return f;
      const fromCwd = path.resolve(process.cwd(), f);
      if (fs.existsSync(fromCwd)) return fromCwd;
      return path.resolve(projectRoot, f);
    });
    // 過濾掉不存在或非源碼的檔案
    filesToCheck = filesToCheck.filter(f => fs.existsSync(f) && /\.(ts|tsx|js|jsx)$/.test(f) && !f.includes('.test.'));
  } else {
    // 自動掃 src/
    const srcDir = path.join(projectRoot, 'src');
    filesToCheck = findSourceFiles(srcDir);
  }

  if (filesToCheck.length === 0) {
    console.log('@PASS | micro-fix-gate | 無源碼檔案需要驗證');
    process.exit(0);
  }

  console.log(`\n[Micro-Fix Gate] 掃描 ${filesToCheck.length} 個檔案...\n`);

  // ── 1. GEMS 標籤檢查 ──
  const tagIssues = [];
  for (const f of filesToCheck) {
    const result = checkFileTags(f);
    if (!result.ok) {
      tagIssues.push({
        file: path.relative(projectRoot, f),
        missing: result.missing,
        total: result.total
      });
    }
  }

  // ── 2. Import 整合檢查 ──
  const importIssues = [];
  for (const f of filesToCheck) {
    const broken = checkImports(f, projectRoot);
    if (broken.length > 0) {
      importIssues.push({
        file: path.relative(projectRoot, f),
        broken
      });
    }
  }

  // ── 結果輸出 ──
  const hasIssues = tagIssues.length > 0 || importIssues.length > 0;

  if (!hasIssues) {
    console.log(`@PASS | micro-fix-gate | ${filesToCheck.length} 個檔案全部通過`);
    console.log(`  ✓ GEMS 標籤: OK`);
    console.log(`  ✓ Import 整合: OK`);
    process.exit(0);
  }

  // 有問題 → 輸出 BLOCKER
  console.log('═══════════════════════════════════════════════════════════');
  console.log('@BLOCKER | micro-fix-gate | 發現問題，請修復後重跑');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  if (tagIssues.length > 0) {
    console.log(`❌ GEMS 標籤缺失 (${tagIssues.length} 個檔案):`);
    for (const issue of tagIssues) {
      console.log(`   ${issue.file}`);
      for (const fn of issue.missing) {
        console.log(`     └─ ${fn}() 缺少 GEMS 標籤`);
      }
    }
    console.log('');
    console.log('  修復範例:');
    console.log('  /**');
    console.log('   * GEMS: functionName | P2 | ○ | (args)→Result | 描述');
    console.log('   * GEMS-FLOW: Step1→Step2→Step3');
    console.log('   */');
    console.log('');
  }

  if (importIssues.length > 0) {
    console.log(`❌ Import 斷鏈 (${importIssues.length} 個檔案):`);
    for (const issue of importIssues) {
      console.log(`   ${issue.file}`);
      for (const b of issue.broken) {
        console.log(`     └─ import '${b.import}' → 找不到 ${b.expected}`);
      }
    }
    console.log('');
  }

  console.log('重跑指令:');
  const changedArg = args.changed.length > 0 ? ` --changed=${args.changed.join(',')}` : '';
  const targetArg = args.target ? ` --target=${path.relative(process.cwd(), args.target) || '.'}` : '';
  console.log(`  node sdid-tools/micro-fix-gate.cjs${changedArg}${targetArg}`);
  console.log('═══════════════════════════════════════════════════════════');

  process.exit(1);
}

main();
