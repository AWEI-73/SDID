#!/usr/bin/env node
/**
 * GEMS Scanner v2  (Wave 3)
 * AST + 雙格式支援 + gemsId 連結 + phase-2 routing
 *
 * 相較 gems-scanner.cjs v5.2：
 *   - 使用目標專案的 typescript（不需自裝依賴）
 *   - 支援新格式：@GEMS [P0] Domain.Action | FLOW: ... | L50-61
 *   - 支援舊格式：GEMS: funcName | P0 | ✓✓ | ...（與 v5.2 相同）
 *   - 讀 .gems/specs/_index.json → gemsId / specFile / dictBacked
 *   - phase2Mode：dict-spec | comment-only
 *   - 全覆蓋：未標籤函式也列出（untagged），確保 100% 覆蓋率
 *
 * 用法：
 *   node sdid-tools/gems-scanner-v2.cjs --project=ExamForge [--src=src] [--output=.gems]
 *
 * 輸出：
 *   <output>/functions-v2.json      完整結果
 *   <output>/function-index-v2.json gemsId/specFile 索引（state-guide 用）
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// GEMS 格式 Patterns
// ─────────────────────────────────────────────────────────────

// 舊格式（多行 JSDoc）：GEMS: funcName | P0 | ✓✓ | sig | Story-X.Y | 描述
const OLD_BASIC = /\*\s*GEMS:\s*(\S+)\s*\|\s*(P[0-3])\s*\|\s*([✓○⚠]+)\s*\|\s*([^|]+)\s*\|\s*(Story-[\d.]+)\s*\|\s*(.+)/;
const OLD_FLOW = /\*\s*GEMS-FLOW:\s*(.+)/;
const OLD_DEPS = /\*\s*GEMS-DEPS:\s*(.+)/;
const OLD_RISK = /\*\s*GEMS-DEPS-RISK:\s*(.+)/;
const OLD_TEST = /\*\s*GEMS-TEST:\s*(.+)/;
const OLD_TESTFILE = /\*\s*GEMS-TEST-FILE:\s*(.+)/;

// 新格式（單行 inline）：@GEMS [P0] Domain.Action | FLOW: A→B | L50-61
const NEW_INLINE = /@GEMS\s+\[([^\]]+)\]\s+([\w]+\.[\w]+)(?:\s*\|\s*FLOW:\s*([^|]+?))?(?:\s*\|\s*(L(\d+)-(\d+)))?\s*$/;

// ─────────────────────────────────────────────────────────────
// dict index
// ─────────────────────────────────────────────────────────────

function loadDictIndex(projectRoot) {
  const p = path.join(projectRoot, '.gems', 'specs', '_index.json');
  if (!fs.existsSync(p)) return new Map();
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const map = new Map();
    for (const [k, v] of Object.entries(raw)) {
      if (k !== '$meta' && typeof v === 'string') map.set(k, v);
    }
    return map;
  } catch { return new Map(); }
}

// ─────────────────────────────────────────────────────────────
// 注釋解析（兼容舊 + 新格式）
// ─────────────────────────────────────────────────────────────

function parseComment(commentText) {
  const result = {
    format: null,         // 'new' | 'old' | null
    gemsId: null,         // Domain.Action（新格式直接取；舊格式從 functionName 取，不一定有 Domain）
    functionName: null,   // 舊格式的 funcName
    priority: null,
    flow: null,
    deps: null,
    depsRisk: null,
    test: null,
    testFile: null,
    description: null,
    lineRange: null
  };

  if (!commentText) return result;

  // 嘗試新格式（inline @GEMS）
  const lines = commentText.split('\n');
  for (const line of lines) {
    const m = line.match(NEW_INLINE);
    if (m) {
      result.format = 'new';
      result.priority = m[1].trim().toUpperCase();
      result.gemsId = m[2].trim();
      result.functionName = m[2].trim();
      result.flow = m[3] ? m[3].trim() : null;
      result.lineRange = m[4] ? m[4].trim() : null;
      return result;
    }
  }

  // 嘗試舊格式（JSDoc GEMS:）
  const basicM = commentText.match(OLD_BASIC);
  if (basicM) {
    result.format = 'old';
    result.functionName = basicM[1].trim();
    result.priority = basicM[2].trim();
    result.description = basicM[6].trim();
  }
  const flowM = commentText.match(OLD_FLOW); if (flowM) result.flow = flowM[1].trim();
  const depsM = commentText.match(OLD_DEPS); if (depsM) result.deps = depsM[1].trim();
  const riskM = commentText.match(OLD_RISK); if (riskM) result.depsRisk = riskM[1].trim();
  const testM = commentText.match(OLD_TEST); if (testM) result.test = testM[1].trim();
  const tfM = commentText.match(OLD_TESTFILE); if (tfM) result.testFile = tfM[1].trim();

  if (result.priority) result.format = result.format || 'old';
  return result;
}

// ─────────────────────────────────────────────────────────────
// AST 解析（使用目標專案的 typescript）
// ─────────────────────────────────────────────────────────────

function loadTypescript(projectRoot) {
  // 策略 1: target 專案的 typescript
  try {
    const tsPath = require.resolve('typescript', { paths: [projectRoot] });
    return require(tsPath);
  } catch { /* 繼續 */ }

  // 策略 2: sdid-tools 自己的 typescript（往上找）
  let searchDir = __dirname;
  for (let i = 0; i < 4; i++) {
    try {
      const tsPath = require.resolve('typescript', { paths: [searchDir] });
      return require(tsPath);
    } catch { /* 繼續 */ }
    searchDir = path.resolve(searchDir, '..');
  }

  // 找不到 → 回傳 null，讓呼叫端 fallback 到 regex scanner（不 exit）
  return null;
}

function isFunctionNode(ts, node) {
  if (ts.isFunctionDeclaration(node)
    || ts.isMethodDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isInterfaceDeclaration(node)
    || ts.isTypeAliasDeclaration(node)
    || ts.isClassDeclaration(node)) {
    return true;
  }
  if (ts.isVariableStatement(node)) {
    // 排除解構賦值（e.g. const [x, setX] = useState(...)）
    // 這類 pattern 不是函式定義，不需要 GEMS 標籤
    const decls = node.declarationList?.declarations;
    if (!decls || decls.length === 0) return false;
    const firstDecl = decls[0];
    // 如果 binding 是 ArrayBindingPattern（解構），跳過
    if (ts.isArrayBindingPattern(firstDecl.name)) return false;
    // 如果 binding 是 ObjectBindingPattern（物件解構），跳過
    if (ts.isObjectBindingPattern(firstDecl.name)) return false;
    return true;
  }
  return false;
}

function getFunctionName(ts, node, sourceFile) {
  if (ts.isFunctionDeclaration(node)
    || ts.isMethodDeclaration(node)
    || ts.isInterfaceDeclaration(node)
    || ts.isTypeAliasDeclaration(node)
    || ts.isClassDeclaration(node)) {
    return node.name ? node.name.getText(sourceFile) : null;
  }
  if (ts.isVariableStatement(node)) {
    const decls = node.declarationList.declarations;
    if (decls.length > 0) return decls[0].name.getText(sourceFile);
  }
  // Arrow function 直接宣告（不在 variable 裡）→ 跳過，讓 variable parent 認領
  return null;
}

/**
 * 抓節點前的注釋，同時支援舊格式（JSDoc GEMS:）與新格式（@GEMS [P0]）
 * 多行 // 注釋：只要任意一行含 GEMS 關鍵字就回傳整段
 */
function getLeadingComment(ts, node, sourceFile) {
  const fullText = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
  if (!ranges || ranges.length === 0) return '';

  // 把所有相鄰注釋合併（取最靠近函式的連續注釋塊）
  const combined = ranges.map(r => fullText.substring(r.pos, r.end)).join('\n');

  if (combined.includes('GEMS:') || combined.includes('@GEMS')) return combined;
  return '';
}

/**
 * Wave 3.1: Extract all GEMS comment blocks from file content (position-independent).
 * Returns Map<functionName, commentText> for floating GEMS tags not adjacent to their node.
 */
function extractAllGemsComments(content) {
  const result = new Map();
  // Match JSDoc blocks containing GEMS:
  const jsdocPattern = /\/\*\*[\s\S]*?\*\//g;
  let m;
  while ((m = jsdocPattern.exec(content)) !== null) {
    const block = m[0];
    // Old format: GEMS: funcName | P0 | ...
    const oldMatch = block.match(/\*\s*GEMS:\s*(\S+)\s*\|/);
    if (oldMatch) {
      result.set(oldMatch[1], block);
      continue;
    }
    // New format: @GEMS [P0] Domain.Action
    const newMatch = block.match(/@GEMS\s*\[P[0-3]\]\s*(\S+)/);
    if (newMatch) {
      const gid = newMatch[1];
      const shortName = gid.split('.').pop();
      if (shortName) result.set(shortName, block);
    }
  }
  // Also match consecutive // comments containing GEMS
  const lines = content.split('\n');
  let commentBlock = [];
  let inBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') && (inBlock || trimmed.includes('GEMS:') || trimmed.includes('@GEMS'))) {
      commentBlock.push(line);
      inBlock = true;
    } else {
      if (commentBlock.length > 0) {
        const block = commentBlock.join('\n');
        if (block.includes('GEMS:') || block.includes('@GEMS')) {
          const oldMatch = block.match(/GEMS:\s*(\S+)\s*\|/);
          if (oldMatch) result.set(oldMatch[1], block);
          const newMatch = block.match(/@GEMS\s*\[P[0-3]\]\s*(\S+)/);
          if (newMatch) {
            const shortName = newMatch[1].split('.').pop();
            if (shortName) result.set(shortName, block);
          }
        }
        commentBlock = [];
        inBlock = false;
      }
    }
  }
  return result;
}

/**
 * AST 解析單個 .ts/.tsx 檔案
 * @returns {{ functions, untagged }}
 */
function parseFile(ts, filePath, projectRoot) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relFile = path.relative(projectRoot, filePath);
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  const functions = [];
  const untagged = [];
  const seen = new Set();

  // Wave 3.1: Pre-scan all GEMS comments in file (position-independent)
  const floatingGems = extractAllGemsComments(content);

  function visit(node) {
    if (isFunctionNode(ts, node)) {
      const name = getFunctionName(ts, node, sourceFile);
      if (!name || seen.has(`${relFile}::${name}`)) {
        ts.forEachChild(node, visit);
        return;
      }
      seen.add(`${relFile}::${name}`);

      const lineNum = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const endLineNum = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
      let commentText = getLeadingComment(ts, node, sourceFile);
      let parsed = parseComment(commentText);

      // Wave 3.1: If no GEMS tag from leading comment, try file-wide match by name
      if (!parsed.format && floatingGems.has(name)) {
        commentText = floatingGems.get(name);
        parsed = parseComment(commentText);
        floatingGems.delete(name); // consume so it's not matched again
      }
      // If leading comment already matched, still consume from floating to avoid double-count
      if (parsed.format && floatingGems.has(name)) {
        floatingGems.delete(name);
      }

      if (parsed.format) {
        // 有 GEMS 標籤
        const resolvedName = parsed.functionName || name;
        seen.add(`${relFile}::${resolvedName}`); // also mark parsed name as seen
        functions.push({
          name: resolvedName,
          file: relFile,
          startLine: lineNum,
          endLine: endLineNum,
          commentText,
          priority: parsed.priority,
          flow: parsed.flow,
          deps: parsed.deps,
          depsRisk: parsed.depsRisk,
          test: parsed.test,
          testFile: parsed.testFile,
          description: parsed.description,
          lineRange: parsed.lineRange,
          gemsFormat: parsed.format,
          _rawGemsId: parsed.gemsId   // 新格式直接有；舊格式 null
        });
      } else {
        // 無標籤 → untagged
        untagged.push({ name, file: relFile, line: lineNum });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Wave 3.2: Emit unclaimed file-level GEMS tags.
  // Handles module-concept tags (e.g., CoreTypes, NODE_PARAM_CONFIG)
  // where no single TS declaration shares the tag name.
  for (const [name, commentText] of floatingGems) {
    if (seen.has(`${relFile}::${name}`)) continue;
    const parsed = parseComment(commentText);
    if (parsed.format && parsed.priority) {
      functions.push({
        name,
        file: relFile,
        startLine: 1,
        endLine: 1,
        commentText,
        priority: parsed.priority,
        flow: parsed.flow,
        deps: parsed.deps,
        depsRisk: parsed.depsRisk,
        test: parsed.test,
        testFile: parsed.testFile,
        description: parsed.description,
        lineRange: null,
        gemsFormat: parsed.format,
        _rawGemsId: parsed.gemsId,
      });
    }
  }

  return { functions, untagged };
}

// ─────────────────────────────────────────────────────────────
// 主掃描
// ─────────────────────────────────────────────────────────────

function scanDirectory(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'build', 'coverage', '.git', '__tests__'].includes(entry.name))
        result.push(...scanDirectory(path.join(dir, entry.name)));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')
      && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
      result.push(path.join(dir, entry.name));
    }
  }
  return result;
}

/**
 * 判斷 gemsId：
 *   1. 新格式 → 直接有 gemsId
 *   2. 舊格式 → shortName 比對 dictIndex（PDF.ParseBufferWithImages → parseBufferWithImages）
 */
function resolveGemsId(func, dictIndex, usedGemsIds) {
  // 新格式
  if (func._rawGemsId) {
    return func._rawGemsId;
  }
  // 舊格式：shortName 比對
  for (const [gid] of dictIndex) {
    if (usedGemsIds.has(gid)) continue;
    const short = gid.split('.').pop();
    if (short && short.toLowerCase() === func.name.toLowerCase()) return gid;
  }
  return null;
}

function scanV2(srcDir, projectRoot) {
  const ts = loadTypescript(projectRoot);
  if (!ts) {
    // TypeScript 不可用 → 回傳空結果，讓 unified scanner fallback 到 regex
    return { version: '2.0', functions: [], untagged: [], stats: { tagged: 0 }, _tsUnavailable: true };
  }
  const dictIndex = loadDictIndex(projectRoot);
  const files = scanDirectory(srcDir);

  const allFunctions = [];
  const allUntagged = [];

  for (const file of files) {
    const { functions, untagged } = parseFile(ts, file, projectRoot);
    allFunctions.push(...functions);
    allUntagged.push(...untagged);
  }

  // gemsId 解析（新格式優先認領，避免 shortName 搶注）
  const usedGemsIds = new Set(
    allFunctions.filter(f => f._rawGemsId).map(f => f._rawGemsId)
  );

  const enriched = allFunctions.map(func => {
    const gemsId = resolveGemsId(func, dictIndex, usedGemsIds);
    if (gemsId && !func._rawGemsId) usedGemsIds.add(gemsId); // 標記老格式已認領
    const specFile = gemsId ? (dictIndex.get(gemsId) || null) : null;
    const dictBacked = !!(gemsId && specFile);
    const phase2Mode = dictBacked ? 'dict-spec' : 'comment-only';

    const { _rawGemsId, ...rest } = func;
    return { ...rest, gemsId, specFile, dictBacked, phase2Mode };
  });

  // 統計
  const byPriority = { P0: 0, P1: 0, P2: 0, P3: 0 };
  const dictBacked = enriched.filter(f => f.dictBacked).length;
  const commentOnly = enriched.length - dictBacked;

  for (const f of enriched) {
    if (byPriority[f.priority] !== undefined) byPriority[f.priority]++;
  }

  return {
    version: '2.0',
    generatedAt: new Date().toISOString(),
    projectRoot,
    srcDir,
    functions: enriched,
    untagged: allUntagged,
    stats: {
      totalScanned: enriched.length + allUntagged.length,
      tagged: enriched.length,
      untaggedCount: allUntagged.length,
      coverageRate: enriched.length + allUntagged.length > 0
        ? ((enriched.length / (enriched.length + allUntagged.length)) * 100).toFixed(1) + '%'
        : '0%',
      ...byPriority,
      dictBacked,
      commentOnly,
      dictIndexSize: dictIndex.size
    }
  };
}

// ─────────────────────────────────────────────────────────────
// function-index-v2（state-guide 用）
// ─────────────────────────────────────────────────────────────

function generateFunctionIndexV2(functions) {
  const byFile = {};
  const byPriority = { P0: [], P1: [], P2: [], P3: [] };
  const byGemsId = {};
  const byPhase2 = { 'dict-spec': [], 'comment-only': [] };

  for (const f of functions) {
    // byFile
    if (!byFile[f.file]) byFile[f.file] = [];
    byFile[f.file].push({ name: f.name, line: f.startLine, priority: f.priority, gemsId: f.gemsId || null });

    // byPriority
    if (byPriority[f.priority]) byPriority[f.priority].push(f.gemsId || f.name);

    // byGemsId
    if (f.gemsId) {
      byGemsId[f.gemsId] = {
        name: f.name,
        file: f.file,
        line: f.startLine,
        priority: f.priority,
        specFile: f.specFile,
        dictBacked: f.dictBacked,
        flow: f.flow || null
      };
    }

    // byPhase2
    if (byPhase2[f.phase2Mode]) byPhase2[f.phase2Mode].push(f.gemsId || f.name);
  }

  return { byFile, byPriority, byGemsId, byPhase2 };
}

// ─────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  let projectRoot = process.cwd();
  let srcSubDir = 'src';
  let outputSubDir = '.gems';

  for (const a of args) {
    if (a.startsWith('--project=')) projectRoot = path.resolve(a.split('=')[1]);
    if (a.startsWith('--src=')) srcSubDir = a.split('=')[1];
    if (a.startsWith('--output=')) outputSubDir = a.split('=')[1];
  }

  const srcDir = path.join(projectRoot, srcSubDir);
  const outputDir = path.join(projectRoot, outputSubDir);

  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║     GEMS Scanner v2  (AST + Wave 3)   ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`  專案: ${projectRoot}`);
  console.log(`  掃描: ${srcDir}`);

  if (!fs.existsSync(srcDir)) {
    console.error(`\n✗ 找不到 src 目錄: ${srcDir}`);
    process.exit(2);
  }

  const result = scanV2(srcDir, projectRoot);

  console.log('\n─── 掃描結果 ──────────────────────────');
  console.log(`  已標籤:    ${result.stats.tagged}  （覆蓋率 ${result.stats.coverageRate}）`);
  console.log(`  未標籤:    ${result.stats.untaggedCount}  ← 需補標籤`);
  console.log(`  P0: ${result.stats.P0} | P1: ${result.stats.P1} | P2: ${result.stats.P2} | P3: ${result.stats.P3}`);
  console.log(`  dict-backed:  ${result.stats.dictBacked}  （gemsId + specFile 均存在）`);
  console.log(`  comment-only: ${result.stats.commentOnly}`);
  console.log(`  dict index:   ${result.stats.dictIndexSize} 筆`);

  console.log('\n─── Phase-2 判斷 ──────────────────────');
  const dictSpec = result.functions.filter(f => f.phase2Mode === 'dict-spec');
  const cmtOnly = result.functions.filter(f => f.phase2Mode === 'comment-only');

  if (dictSpec.length) {
    console.log(`\n  [dict-spec] 讀字典 spec 建置 (${dictSpec.length}):`);
    for (const f of dictSpec) console.log(`    ${f.gemsId} (${f.priority}) → ${f.specFile}`);
  }
  if (cmtOnly.length) {
    console.log(`\n  [comment-only] 依 GEMS 注釋建置 (${cmtOnly.length}):`);
    for (const f of cmtOnly) console.log(`    ${f.name} (${f.priority || '?'})`);
  }

  if (result.untagged.length) {
    console.log(`\n─── 未標籤函式 (需補) ─────────────────`);
    for (const u of result.untagged.slice(0, 20)) {
      console.log(`  ${u.file}:${u.line}  ${u.name}`);
    }
    if (result.untagged.length > 20) console.log(`  ...（共 ${result.untagged.length} 個）`);
  }

  // 輸出
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const fPath = path.join(outputDir, 'functions-v2.json');
  fs.writeFileSync(fPath, JSON.stringify(result, null, 2));

  const iPath = path.join(outputDir, 'function-index-v2.json');
  const idx = generateFunctionIndexV2(result.functions);
  fs.writeFileSync(iPath, JSON.stringify(idx, null, 2));

  console.log('\n─────────────────────────────────────────');
  console.log(`✅ ${fPath}`);
  console.log(`✅ ${iPath}`);
  console.log('─────────────────────────────────────────\n');
}

module.exports = { scanV2, generateFunctionIndexV2, parseComment, loadDictIndex };
