#!/usr/bin/env node
/**
 * spec-gate.cjs — GEMS 字典品質 Gate
 *
 * 觸發時機: Skill A 生成字典後、CYNEFIN-CHECK 之前
 *
 * 檢查項目:
 *   SPEC-001: 字典 schema 驗證（dict-schema.cjs 全欄位）
 *   SPEC-002: _index.json 格式驗證
 *   SPEC-003: index 一致性（index 條目 ↔ spec 條目雙向核對）
 *   SPEC-004: $meta.manages 路徑存在性
 *   SPEC-005: lineRange 格式與邏輯（L{n}-{m} 且 n ≤ m）
 *
 * 用法:
 *   node sdid-tools/spec/gate.cjs --project=<projectRoot>
 *   node sdid-tools/spec/gate.cjs --project=<projectRoot> --spec=<specFileName>
 *   node sdid-tools/spec/gate.cjs --project=<projectRoot> --fix-index
 *
 * 選項:
 *   --project=<dir>      專案根目錄（必填）
 *   --spec=<file>        只檢查指定的 spec 檔名（如 pdf-text-extractor.json）
 *   --fix-index          自動修補 _index.json（補齊缺漏的 P0/P1 gemsId）
 *   --dry-run            搭配 --fix-index 時，只顯示修補內容不實際寫入
 *
 * 退出碼:
 *   0 — 全部通過
 *   1 — 有 FAIL 項目
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ──────────────────────────────────────────
// 參數解析
// ──────────────────────────────────────────

function parseArgs() {
  const args = { project: null, spec: null, fixIndex: false, dryRun: false, help: false };
  for (const arg of process.argv.slice(2)) {
    if      (arg.startsWith('--project=')) args.project  = path.resolve(arg.slice(10));
    else if (arg.startsWith('--spec='))    args.spec     = arg.slice(7);
    else if (arg === '--fix-index')        args.fixIndex = true;
    else if (arg === '--dry-run')          args.dryRun   = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ──────────────────────────────────────────
// 載入 schema validator
// ──────────────────────────────────────────

function loadSchema(sdidToolsDir) {
  const schemaPath = path.join(sdidToolsDir, 'lib', 'dict-schema.cjs');
  if (!fs.existsSync(schemaPath)) {
    die(`找不到 dict-schema.cjs: ${schemaPath}`);
  }
  return require(schemaPath);
}

// ──────────────────────────────────────────
// 字典讀取
// ──────────────────────────────────────────

function findGemsDir(projectRoot) {
  const gemsDir = path.join(projectRoot, '.gems');
  const specsDir = path.join(gemsDir, 'specs');
  if (!fs.existsSync(specsDir)) {
    die(`找不到 .gems/specs/ 目錄: ${specsDir}\n請確認 --project 指向正確的專案根目錄`);
  }
  return { gemsDir, specsDir };
}

function loadIndex(specsDir) {
  const indexPath = path.join(specsDir, '_index.json');
  if (!fs.existsSync(indexPath)) {
    return { $meta: { description: 'GEMS 字典全域索引' }, _path: indexPath };
  }
  try {
    const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    data._path = indexPath;
    return data;
  } catch (e) {
    die(`無法解析 _index.json: ${e.message}`);
  }
}

/**
 * 讀取所有（或指定）spec 檔案
 * @returns {Array<{ fileName, filePath, data }>}
 */
function loadSpecs(specsDir, onlyFile) {
  const files = fs.readdirSync(specsDir)
    .filter(f => f.endsWith('.json') && f !== '_index.json')
    .filter(f => !onlyFile || f === onlyFile);

  if (files.length === 0) {
    if (onlyFile) die(`找不到指定的 spec 檔案: ${onlyFile}`);
    return [];
  }

  return files.map(fileName => {
    const filePath = path.join(specsDir, fileName);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return { fileName, filePath, data };
    } catch (e) {
      die(`無法解析 ${fileName}: ${e.message}`);
    }
  });
}

// ──────────────────────────────────────────
// 檢查函式
// ──────────────────────────────────────────

/**
 * SPEC-001: 每個 spec 檔案的 schema 驗證
 */
function checkSpec001(specs, schema) {
  const results = [];
  for (const { fileName, filePath, data } of specs) {
    const { pass, results: entryResults } = schema.validateDictFile(data, filePath);
    const errors   = entryResults.flatMap(r => r.errors);
    const warnings = entryResults.flatMap(r => r.warnings);
    results.push({ fileName, pass, errors, warnings });
  }
  return results;
}

/**
 * SPEC-002: _index.json 格式驗證
 */
function checkSpec002(index, schema) {
  // schema.validateIndex 不接受 _path，傳淨化後的物件
  const clean = Object.fromEntries(
    Object.entries(index).filter(([k]) => k !== '_path')
  );
  return schema.validateIndex(clean);
}

/**
 * SPEC-003: index ↔ spec 雙向一致性
 *   3a. index 中每個 gemsId → 對應 spec 檔案中確實存在
 *   3b. spec 中每個 P0/P1 gemsId → 必須出現在 index 中
 */
function checkSpec003(index, specs) {
  const errors   = [];
  const warnings = [];

  // 建立 gemsId → specFile 對照（來自 spec 檔案本身）
  const specMap = new Map(); // gemsId → specFileName
  for (const { fileName, data } of specs) {
    for (const [k, v] of Object.entries(data)) {
      if (k === '$meta') continue;
      specMap.set(k, { fileName, entry: v });
    }
  }

  // 3a: index 條目應能在 spec 中找到
  for (const [gemsId, specPath] of Object.entries(index)) {
    if (gemsId === '$meta' || gemsId === '_path') continue;
    const expectedFile = path.basename(specPath); // e.g. pdf-text-extractor.json
    const found = specMap.get(gemsId);
    if (!found) {
      errors.push(`[SPEC-003a] index 中 "${gemsId}" 在 spec 檔案中找不到對應條目`);
    } else if (found.fileName !== expectedFile) {
      warnings.push(`[SPEC-003a] index 中 "${gemsId}" 指向 ${specPath}，但實際在 ${found.fileName}`);
    }
  }

  // 3b: spec 中 P0/P1 必須在 index 中
  const indexKeys = new Set(
    Object.keys(index).filter(k => k !== '$meta' && k !== '_path')
  );
  for (const [gemsId, { entry }] of specMap.entries()) {
    if (entry.priority === 'P0' || entry.priority === 'P1') {
      if (!indexKeys.has(gemsId)) {
        errors.push(`[SPEC-003b] "${gemsId}" (${entry.priority}) 未登錄到 _index.json`);
      }
    }
  }

  return { pass: errors.length === 0, errors, warnings, specMap };
}

/**
 * SPEC-004: $meta.manages 路徑存在性
 */
function checkSpec004(specs, projectRoot) {
  const errors   = [];
  const warnings = [];

  for (const { fileName, data } of specs) {
    const manages = data.$meta && data.$meta.manages;
    if (!manages) {
      warnings.push(`[SPEC-004] ${fileName} 的 $meta.manages 未填寫`);
      continue;
    }
    const fullPath = path.join(projectRoot, manages);
    if (!fs.existsSync(fullPath)) {
      errors.push(`[SPEC-004] ${fileName} 的 $meta.manages 指向不存在的檔案: ${manages}`);
    }
  }

  return { pass: errors.length === 0, errors, warnings };
}

/**
 * SPEC-005: lineRange 格式與邏輯（L{n}-{m} 且 n ≤ m）
 */
function checkSpec005(specs) {
  const errors   = [];
  const warnings = [];

  for (const { fileName, data } of specs) {
    for (const [k, entry] of Object.entries(data)) {
      if (k === '$meta') continue;
      const lr = entry.lineRange;
      if (!lr) continue; // 已由 SPEC-001 報告缺失

      const match = lr.match(/^L(\d+)-(\d+)$/);
      if (!match) {
        warnings.push(`[SPEC-005] [${k}] lineRange 格式不符 L{n}-{m}: "${lr}"`);
        continue;
      }
      const [, start, end] = match.map((v, i) => i === 0 ? v : parseInt(v, 10));
      if (start > end) {
        errors.push(`[SPEC-005] [${k}] lineRange 起始行 > 結尾行: ${lr}`);
      }
    }
  }

  return { pass: errors.length === 0, errors, warnings };
}

// ──────────────────────────────────────────
// --fix-index: 補齊遺漏的 P0/P1 條目
// ──────────────────────────────────────────

function fixIndex(index, spec003Result, dryRun) {
  const { specMap } = spec003Result;
  const indexKeys = new Set(
    Object.keys(index).filter(k => k !== '$meta' && k !== '_path')
  );

  const toAdd = {};
  for (const [gemsId, { fileName, entry }] of specMap.entries()) {
    if ((entry.priority === 'P0' || entry.priority === 'P1') && !indexKeys.has(gemsId)) {
      toAdd[gemsId] = `specs/${fileName}`;
    }
  }

  if (Object.keys(toAdd).length === 0) {
    console.log('  ✅ _index.json 已完整，無需修補');
    return;
  }

  console.log(`  ℹ️  將補齊 ${Object.keys(toAdd).length} 個條目:`);
  for (const [gemsId, specPath] of Object.entries(toAdd)) {
    console.log(`     + ${gemsId} → ${specPath}`);
  }

  if (dryRun) {
    console.log('  ⏭️  --dry-run 模式，跳過實際寫入');
    return;
  }

  // 合併寫入
  const clean = Object.fromEntries(
    Object.entries(index).filter(([k]) => k !== '_path')
  );
  const updated = { ...clean, ...toAdd };
  fs.writeFileSync(index._path, JSON.stringify(updated, null, 2), 'utf8');
  console.log(`  ✅ _index.json 已更新`);
}

// ──────────────────────────────────────────
// 輸出工具
// ──────────────────────────────────────────

const CLR = {
  reset:  '\x1b[0m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
};

function c(color, text) {
  return `${CLR[color]}${text}${CLR.reset}`;
}

function printSectionHeader(id, label) {
  console.log(`\n${c('bold', id)} ${label}`);
}

function printItems(errors, warnings) {
  for (const e of errors)   console.log(`  ${c('red', '✗')} ${e}`);
  for (const w of warnings) console.log(`  ${c('yellow', '!')} ${w}`);
}

function printResult(pass, label, errors, warnings) {
  const icon  = pass ? c('green', 'PASS') : c('red', 'FAIL');
  const extra = errors.length + warnings.length > 0
    ? ` (${errors.length} errors, ${warnings.length} warnings)`
    : '';
  console.log(`  ${icon}  ${label}${extra}`);
}

function die(msg) {
  console.error(`${c('red', '[spec-gate ERROR]')} ${msg}`);
  process.exit(2); // 配置錯誤用 2
}

// ──────────────────────────────────────────
// 主程式
// ──────────────────────────────────────────

function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
spec-gate.cjs — GEMS 字典品質 Gate

  用法: node sdid-tools/spec/gate.cjs --project=<projectRoot> [options]

  選項:
    --project=<dir>    專案根目錄（必填）
    --spec=<file>      只檢查指定的 spec 檔名（如 pdf-text-extractor.json）
    --fix-index        自動補齊 _index.json 遺漏的 P0/P1 條目
    --dry-run          搭配 --fix-index，只顯示不寫入
    --help             顯示此說明

  退出碼: 0=全部通過  1=有 FAIL  2=配置錯誤
`);
    process.exit(0);
  }

  if (!args.project) {
    die('缺少 --project=<projectRoot> 參數\n請執行 --help 查看用法');
  }

  const sdidToolsDir = path.join(__dirname);
  const schema       = loadSchema(sdidToolsDir);
  const { specsDir } = findGemsDir(args.project);

  const index = loadIndex(specsDir);
  const specs  = loadSpecs(specsDir, args.spec);

  if (specs.length === 0) {
    console.log(c('yellow', '⚠️  未找到任何 spec 檔案，gate 通過（無可檢查項目）'));
    process.exit(0);
  }

  console.log(c('bold', '\n╔═══════════════════════════════════════╗'));
  console.log(c('bold',   '║         GEMS spec-gate 報告           ║'));
  console.log(c('bold',   '╚═══════════════════════════════════════╝'));
  console.log(`  專案: ${args.project}`);
  console.log(`  Spec 檔案數: ${specs.length}`);
  if (args.spec) console.log(`  過濾: 只檢查 ${args.spec}`);

  const allErrors   = [];
  const allWarnings = [];

  // ── SPEC-001 ──
  printSectionHeader('SPEC-001', '字典 schema 驗證');
  const spec001Results = checkSpec001(specs, schema);
  let spec001Pass = true;
  for (const r of spec001Results) {
    printResult(r.pass, r.fileName, r.errors, r.warnings);
    printItems(r.errors, r.warnings);
    if (!r.pass) spec001Pass = false;
    allErrors.push(...r.errors);
    allWarnings.push(...r.warnings);
  }

  // ── SPEC-002 ──
  printSectionHeader('SPEC-002', '_index.json 格式驗證');
  const spec002 = checkSpec002(index, schema);
  printResult(spec002.pass, '_index.json', spec002.errors, []);
  printItems(spec002.errors, []);
  if (!spec002.pass) allErrors.push(...spec002.errors);

  // ── SPEC-003 ──
  printSectionHeader('SPEC-003', 'index ↔ spec 一致性');
  const spec003 = checkSpec003(index, specs);
  printResult(spec003.pass, 'gemsId 雙向核對', spec003.errors, spec003.warnings);
  printItems(spec003.errors, spec003.warnings);
  allErrors.push(...spec003.errors);
  allWarnings.push(...spec003.warnings);

  // ── SPEC-004 ──
  printSectionHeader('SPEC-004', '$meta.manages 路徑存在性');
  const spec004 = checkSpec004(specs, args.project);
  printResult(spec004.pass, 'manages 路徑', spec004.errors, spec004.warnings);
  printItems(spec004.errors, spec004.warnings);
  allErrors.push(...spec004.errors);
  allWarnings.push(...spec004.warnings);

  // ── SPEC-005 ──
  printSectionHeader('SPEC-005', 'lineRange 格式與邏輯');
  const spec005 = checkSpec005(specs);
  printResult(spec005.pass, 'lineRange 格式', spec005.errors, spec005.warnings);
  printItems(spec005.errors, spec005.warnings);
  allErrors.push(...spec005.errors);
  allWarnings.push(...spec005.warnings);

  // ── --fix-index ──
  if (args.fixIndex) {
    printSectionHeader('FIX', '_index.json 修補');
    fixIndex(index, spec003, args.dryRun);
  }

  // ── 總結 ──
  const totalPass = allErrors.length === 0;
  console.log('\n' + '─'.repeat(45));
  if (totalPass) {
    console.log(c('green', c('bold', `✅ spec-gate PASS`))
      + `  (${allWarnings.length} warnings)`);
  } else {
    console.log(c('red', c('bold', `❌ spec-gate FAIL`))
      + `  ${allErrors.length} errors, ${allWarnings.length} warnings`);
  }
  console.log('─'.repeat(45) + '\n');

  process.exit(totalPass ? 0 : 1);
}

main();
