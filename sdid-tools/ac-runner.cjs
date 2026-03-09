#!/usr/bin/env node
/**
 * AC Runner v1.0
 * 讀取 contract_iter-N.ts 的 @GEMS-AC 標記，直接 require 函式執行比對
 *
 * 設計原則:
 *   - contract.ts 在 Gate 階段鎖定（有 contract-pass.log），AI 無法在 BUILD 時修改
 *   - 只驗收「純計算」類 AC（無 side effect、無 DOM、無 API call）
 *   - UI/Hook/整合類 AC 繼續靠 POC.HTML 人工確認
 *
 * 用法:
 *   node sdid-tools/ac-runner.cjs --contract=<path> --target=<project> [--iter=N]
 *
 * 輸出:
 *   @PASS    — 所有 AC 通過
 *   @BLOCKER — 有 AC 失敗（函式回傳值與預期不符）
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// 參數解析
// ─────────────────────────────────────────────────────────────
function parseArgs() {
  const args = { contract: null, target: null, iter: null, story: null, help: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--contract=')) args.contract = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--target='))  args.target  = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iter='))    args.iter    = parseInt(arg.split('=')[1]) || 1;
    else if (arg.startsWith('--story='))   args.story   = arg.split('=').slice(1).join('=');
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ─────────────────────────────────────────────────────────────
// 解析 contract 的 @GEMS-AC 區塊
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AcSpec
 * @property {string} id        - AC-X.Y
 * @property {string} fn        - 函式名稱
 * @property {string} module    - 相對於 src/ 的模組路徑
 * @property {any[]}  input     - 函式參數陣列
 * @property {any}    expect    - 預期回傳值
 * @property {string[]} [fields]      - 只比對特定欄位（可選）
 * @property {string}   [skip]        - @GEMS-AC-SKIP 原因（MOCK/MANUAL AC，ac-runner 跳過不 BLOCKER）
 * @property {string}   [expectThrow] - @GEMS-AC-EXPECT-THROW 預期拋出的 Error 類型（失敗路徑驗收）
 */

function parseAcSpecs(contractContent) {
  const specs = [];
  const lines = contractContent.split('\n');

  let current = null;
  for (const line of lines) {
    const trimmed = line.trim();

    const acMatch = trimmed.match(/^\/\/\s*@GEMS-AC:\s*(AC-[\d.]+)/);
    if (acMatch) {
      if (current) specs.push(current);
      current = { id: acMatch[1], fn: null, module: null, input: null, expect: null, fields: null };
      continue;
    }

    if (!current) continue;

    const fnMatch = trimmed.match(/^\/\/\s*@GEMS-AC-FN:\s*(\S+)/);
    if (fnMatch) { current.fn = fnMatch[1]; continue; }

    const modMatch = trimmed.match(/^\/\/\s*@GEMS-AC-MODULE:\s*(\S+)/);
    if (modMatch) { current.module = modMatch[1]; continue; }

    const inputMatch = trimmed.match(/^\/\/\s*@GEMS-AC-INPUT:\s*(.+)/);
    if (inputMatch) {
      try { current.input = JSON.parse(inputMatch[1]); } catch (e) {
        current.inputParseError = `JSON parse failed: ${e.message}`;
      }
      continue;
    }

    const expectMatch = trimmed.match(/^\/\/\s*@GEMS-AC-EXPECT:\s*(.+)/);
    if (expectMatch) {
      try { current.expect = JSON.parse(expectMatch[1]); } catch (e) {
        current.expectParseError = `JSON parse failed: ${e.message}`;
      }
      continue;
    }

    const fieldMatch = trimmed.match(/^\/\/\s*@GEMS-AC-FIELD:\s*(.+)/);
    if (fieldMatch) {
      current.fields = fieldMatch[1].split(',').map(f => f.trim()).filter(Boolean);
      continue;
    }

    // @GEMS-AC-SKIP: <原因>  → MOCK/MANUAL AC，ac-runner 跳過，不計入 BLOCKER
    const skipMatch = trimmed.match(/^\/\/\s*@GEMS-AC-SKIP:\s*(.+)/);
    if (skipMatch) { current.skip = skipMatch[1].trim(); continue; }

    // @GEMS-AC-EXPECT-THROW: ErrorClassName  → 失敗路徑驗收：期望函式拋出指定 Error
    const expectThrowMatch = trimmed.match(/^\/\/\s*@GEMS-AC-EXPECT-THROW:\s*(\S+)/);
    if (expectThrowMatch) { current.expectThrow = expectThrowMatch[1]; continue; }

    // 遇到非 @GEMS-AC 的非空行就結束當前 spec
    if (trimmed && !trimmed.startsWith('//')) {
      if (current) { specs.push(current); current = null; }
    }
  }
  if (current) specs.push(current);

  return specs;
}

// ─────────────────────────────────────────────────────────────
// 載入函式（支援 TypeScript 專案）
// ─────────────────────────────────────────────────────────────

/**
 * 嘗試從 target/src/{module} 載入函式
 * 支援 .ts（透過 ts-node/esbuild-register）和 .js
 */
function loadFunction(target, modulePath, fnName) {
  const srcDir = path.join(target, 'src');
  const candidates = [
    path.join(srcDir, modulePath + '.ts'),
    path.join(srcDir, modulePath + '.tsx'),
    path.join(srcDir, modulePath + '.js'),
    path.join(srcDir, modulePath, 'index.ts'),
    path.join(srcDir, modulePath, 'index.js'),
  ];

  // 找到存在的檔案
  const filePath = candidates.find(p => fs.existsSync(p));
  if (!filePath) {
    return { error: `找不到模組: src/${modulePath} (嘗試了 .ts/.tsx/.js/index.ts)` };
  }

  // 嘗試用 esbuild-register 或 ts-node 載入 TypeScript
  const ext = path.extname(filePath);
  if (ext === '.ts' || ext === '.tsx') {
    return loadTypeScriptModule(target, filePath, fnName);
  }

  // 純 JS 直接 require
  try {
    const mod = require(filePath);
    const fn = mod[fnName] || mod.default?.[fnName];
    if (typeof fn !== 'function') {
      return { error: `模組 ${filePath} 沒有 export function ${fnName}` };
    }
    return { fn, filePath };
  } catch (e) {
    return { error: `require 失敗: ${e.message}`, filePath };
  }
}

function loadTypeScriptModule(target, filePath, fnName) {
  // 策略 1: @babel/register
  try {
    const babelRegPath = path.join(target, 'node_modules', '@babel', 'register');
    const hasBabelConfig = fs.existsSync(path.join(target, 'babel.config.cjs')) ||
                           fs.existsSync(path.join(target, 'babel.config.js'));
    if (fs.existsSync(babelRegPath) && hasBabelConfig) {
      Object.keys(require.cache).forEach(k => {
        if (k.startsWith(path.join(target, 'src'))) delete require.cache[k];
      });
      require(babelRegPath)({ rootMode: 'upward', cwd: target, extensions: ['.ts', '.tsx', '.js', '.jsx'] });
      const mod = require(filePath);
      const fn = mod[fnName] || mod.default?.[fnName];
      if (typeof fn !== 'function') return { error: `模組 ${filePath} 沒有 export function ${fnName}` };
      return { fn, filePath, loader: '@babel/register' };
    }
  } catch (e) { /* 繼續 */ }

  // 策略 2: @babel/core transform（有 babel-jest 的專案都有 @babel/core）
  try {
    const babelCorePath = path.join(target, 'node_modules', '@babel', 'core');
    if (fs.existsSync(babelCorePath)) {
      return babelTransformAndLoad(target, filePath, fnName, babelCorePath);
    }
  } catch (e) { /* 繼續 */ }

  // 策略 3: esbuild-register
  try {
    const esbuildRegPath = path.join(target, 'node_modules', 'esbuild-register', 'dist', 'node.cjs');
    if (fs.existsSync(esbuildRegPath)) {
      const { register } = require(esbuildRegPath);
      const unregister = register({ target: 'node16' });
      try {
        const mod = require(filePath);
        const fn = mod[fnName] || mod.default?.[fnName];
        if (typeof fn !== 'function') return { error: `模組 ${filePath} 沒有 export function ${fnName}` };
        return { fn, filePath, loader: 'esbuild-register' };
      } finally { unregister(); }
    }
  } catch (e) { /* 繼續 */ }

  // 策略 4: ts-node/register（target 的 node_modules）
  try {
    const tsNodePath = path.join(target, 'node_modules', 'ts-node');
    if (fs.existsSync(tsNodePath)) {
      require(path.join(tsNodePath, 'register'));
      const mod = require(filePath);
      const fn = mod[fnName] || mod.default?.[fnName];
      if (typeof fn !== 'function') return { error: `模組 ${filePath} 沒有 export function ${fnName}` };
      return { fn, filePath, loader: 'ts-node' };
    }
  } catch (e) { /* 繼續 */ }

  // 策略 4b: ts-node/register（往上找 node_modules，供 test 專案 fallback）
  try {
    // 從 ac-runner 所在目錄往上找，直到找到 ts-node
    let searchDir = path.resolve(__dirname, '..');
    for (let i = 0; i < 4; i++) {
      const tsNodeFallback = path.join(searchDir, 'node_modules', 'ts-node');
      if (fs.existsSync(tsNodeFallback)) {
        require(path.join(tsNodeFallback, 'register'));
        const mod = require(filePath);
        const fn = mod[fnName] || mod.default?.[fnName];
        if (typeof fn !== 'function') return { error: `模組 ${filePath} 沒有 export function ${fnName}` };
        return { fn, filePath, loader: 'ts-node-fallback' };
      }
      searchDir = path.resolve(searchDir, '..');
    }
  } catch (e) { /* 繼續 */ }

  // 策略 5: esbuild CLI
  try {
    return compileAndLoad(target, filePath, fnName);
  } catch (e) {
    return { error: `TypeScript 載入失敗（嘗試了 @babel/register、@babel/core、esbuild-register、ts-node、tsc）: ${e.message}`, filePath };
  }
}

/**
 * 用 @babel/core transform 後寫暫存 .cjs 再 require
 */
function babelTransformAndLoad(target, filePath, fnName, babelCorePath) {
  const babel = require(babelCorePath);
  const os = require('os');

  const configFile = [
    path.join(target, 'babel.config.cjs'),
    path.join(target, 'babel.config.js'),
    path.join(target, '.babelrc'),
  ].find(p => fs.existsSync(p));

  const src = fs.readFileSync(filePath, 'utf8');
  const result = babel.transformSync(src, {
    filename: filePath,
    configFile: configFile || false,
    presets: configFile ? undefined : [
      [path.join(target, 'node_modules', '@babel', 'preset-env'), { targets: { node: 'current' } }],
      [path.join(target, 'node_modules', '@babel', 'preset-typescript')],
    ],
    sourceMaps: false,
  });

  if (!result || !result.code) return { error: '@babel/core transform 回傳空結果' };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-runner-babel-'));
  const tmpFile = path.join(tmpDir, 'module.cjs');
  try {
    fs.writeFileSync(tmpFile, result.code, 'utf8');
    const mod = require(tmpFile);
    const fn = mod[fnName] || mod.default?.[fnName];
    if (typeof fn !== 'function') return { error: `模組 ${filePath} 沒有 export function ${fnName}（babel transform 後）` };
    return { fn, filePath, loader: '@babel/core' };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }
}

function compileAndLoad(target, filePath, fnName) {
  const { execSync } = require('child_process');
  const os = require('os');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-runner-'));
  const cleanup = () => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} };

  try {
    // 策略 A: esbuild（target 的 node_modules）
    const esbuildBin = path.join(target, 'node_modules', '.bin', 'esbuild');
    if (fs.existsSync(esbuildBin)) {
      const outFile = path.join(tmpDir, 'module.cjs');
      execSync(
        `"${esbuildBin}" "${filePath}" --bundle=false --platform=node --format=cjs --outfile="${outFile}"`,
        { cwd: target, stdio: 'pipe' }
      );
      const mod = require(outFile);
      const fn = mod[fnName] || mod.default?.[fnName];
      if (typeof fn !== 'function') return { error: `編譯後模組沒有 export function ${fnName}` };
      return { fn, filePath, loader: 'esbuild-compile' };
    }

    // 策略 B: tsc（ts-jest 專案必然有 typescript，所以 tsc 一定存在）
    const tscBin = path.join(target, 'node_modules', '.bin', 'tsc');
    if (fs.existsSync(tscBin)) {
      const tscOutDir = path.join(tmpDir, 'tsc-out');
      fs.mkdirSync(tscOutDir, { recursive: true });
      execSync(
        `"${tscBin}" "${filePath}" --outDir "${tscOutDir}" --module commonjs --target ES2020 --skipLibCheck --esModuleInterop --declaration false --noEmit false`,
        { cwd: target, stdio: 'pipe' }
      );
      const baseName = path.basename(filePath, path.extname(filePath)) + '.js';
      const findJs = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) { const r = findJs(path.join(dir, entry.name)); if (r) return r; }
          else if (entry.name === baseName) return path.join(dir, entry.name);
        }
        return null;
      };
      const jsFile = findJs(tscOutDir);
      if (jsFile) {
        const mod = require(jsFile);
        const fn = mod[fnName] || mod.default?.[fnName];
        if (typeof fn !== 'function') return { error: `tsc 編譯後模組沒有 export function ${fnName}` };
        return { fn, filePath, loader: 'tsc-compile' };
      }
    }

    return { error: `TypeScript 編譯失敗：target 沒有 esbuild 或 tsc 可用`, filePath };
  } catch (e) {
    return { error: `編譯失敗: ${e.message}`, filePath };
  } finally {
    cleanup();
  }
}

// ─────────────────────────────────────────────────────────────
// 深度比對
// ─────────────────────────────────────────────────────────────

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => deepEqual(a[k], b[k]));
}

/**
 * 只比對 expect 裡有的欄位（允許回傳值有額外欄位）
 */
function partialMatch(actual, expect) {
  if (Array.isArray(expect)) {
    if (!Array.isArray(actual) || actual.length !== expect.length) return false;
    return expect.every((item, i) => partialMatch(actual[i], item));
  }
  if (typeof expect === 'object' && expect !== null) {
    if (typeof actual !== 'object' || actual === null) return false;
    return Object.keys(expect).every(k => partialMatch(actual[k], expect[k]));
  }
  return deepEqual(actual, expect);
}

// ─────────────────────────────────────────────────────────────
// 執行單一 AC
// ─────────────────────────────────────────────────────────────

function runAc(spec, target) {
  const result = { id: spec.id, fn: spec.fn, status: 'UNKNOWN', actual: null, error: null };

  // @GEMS-AC-SKIP: MOCK/MANUAL AC → 直接 SKIP，不進入驗收流程（不計入 BLOCKER）
  if (spec.skip) return { ...result, status: 'SKIP', error: `[SKIP] ${spec.skip}` };

  // 驗證 spec 完整性
  if (!spec.fn)     return { ...result, status: 'SKIP', error: '缺少 @GEMS-AC-FN' };
  if (!spec.module) return { ...result, status: 'SKIP', error: '缺少 @GEMS-AC-MODULE' };
  if (spec.input === null) return { ...result, status: 'SKIP', error: spec.inputParseError || '缺少 @GEMS-AC-INPUT' };
  // @GEMS-AC-EXPECT-THROW 不需要 @GEMS-AC-EXPECT
  if (!spec.expectThrow && spec.expect === null) {
    return { ...result, status: 'SKIP', error: spec.expectParseError || '缺少 @GEMS-AC-EXPECT' };
  }

  // 載入函式
  const loaded = loadFunction(target, spec.module, spec.fn);
  if (loaded.error) {
    return { ...result, status: 'ERROR', error: loaded.error };
  }

  // @GEMS-AC-EXPECT-THROW: 失敗路徑驗收 — 期望函式拋出指定 Error
  if (spec.expectThrow) {
    try {
      const retVal = loaded.fn(...(spec.input || []));
      // 處理 Promise（async 函式）
      if (retVal && typeof retVal.then === 'function') {
        return { ...result, status: 'SKIP', error: 'async 函式需要 await，ac-runner 目前只支援同步函式' };
      }
      // 函式正常返回 → 預期它應該拋出 → FAIL
      return { ...result, status: 'FAIL', diff: { expected: `throw ${spec.expectThrow}`, actual: '正常返回（未拋出例外）' } };
    } catch (e) {
      const errorName = e.constructor?.name || e.name || 'Error';
      const matched = errorName === spec.expectThrow || (e.message && e.message.includes(spec.expectThrow));
      if (matched) return { ...result, status: 'PASS' };
      return {
        ...result, status: 'FAIL',
        diff: { expected: `throw ${spec.expectThrow}`, actual: `throw ${errorName}: ${e.message}` }
      };
    }
  }

  // 執行函式（正常路徑）
  let actual;
  try {
    actual = loaded.fn(...spec.input);
    // 處理 Promise（async 函式）
    if (actual && typeof actual.then === 'function') {
      return { ...result, status: 'SKIP', error: 'async 函式需要 await，ac-runner 目前只支援同步函式' };
    }
  } catch (e) {
    return { ...result, status: 'ERROR', error: `執行時拋出例外: ${e.message}`, actual: null };
  }

  result.actual = actual;

  // 比對結果
  // 若有 @GEMS-AC-FIELD，只取指定欄位做比對（適合回傳值含 timestamp 等不穩定欄位）
  let compareActual = actual;
  let compareExpect = spec.expect;
  if (spec.fields && spec.fields.length > 0 &&
      typeof actual === 'object' && actual !== null && !Array.isArray(actual)) {
    compareActual = {};
    compareExpect = {};
    for (const f of spec.fields) {
      compareActual[f] = actual[f];
      compareExpect[f] = spec.expect?.[f];
    }
  }

  const matched = partialMatch(compareActual, compareExpect);
  result.status = matched ? 'PASS' : 'FAIL';

  if (!matched) {
    result.diff = {
      expected: compareExpect,
      actual: compareActual,
      fields: spec.fields || null,
    };
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// 主程式
// ─────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
AC Runner v1.1 — 純計算函式驗收

用法:
  node sdid-tools/ac-runner.cjs --contract=<path> --target=<project> [--iter=N]

選項:
  --contract=<path>  contract_iter-N.ts 路徑（必填）
  --target=<path>    專案根目錄（必填）
  --iter=<N>         迭代編號（用於存 log，預設: 1）
  --help             顯示此訊息

AC 分類與 contract 格式:

  [CALC] 純計算（ac-runner 機械驗收）:
    // @GEMS-AC: AC-1.0
    // @GEMS-AC-FN: computeNodeDates
    // @GEMS-AC-MODULE: modules/Dashboard/lib/compute-node-dates
    // @GEMS-AC-INPUT: ["2026-04-13", [{"taskCode":"N-75","offsetDays":75}]]
    // @GEMS-AC-EXPECT: [{"taskCode":"N-75","dueDate":"2026-01-28"}]

  [CALC] 失敗路徑（驗收 throw）:
    // @GEMS-AC: AC-1.1
    // @GEMS-AC-FN: transitionOrderStatus
    // @GEMS-AC-MODULE: modules/Order/lib/transition-status
    // @GEMS-AC-INPUT: [{"status":"DELIVERED","event":"PAYMENT_RECEIVED"}]
    // @GEMS-AC-EXPECT-THROW: InvalidTransitionError

  [MOCK] 有外部依賴（ac-runner SKIP，靠 jest mock 驗）:
    // @GEMS-AC: AC-2.0
    // @GEMS-AC-SKIP: Google Sheets API 依賴 | 純解析邏輯可 mock 驗

  [MANUAL] UI 或 side effect（人工 POC 驗收）:
    // @GEMS-AC: AC-3.0
    // @GEMS-AC-SKIP: UI 互動，人工 POC 驗收

輸出:
  @PASS    — 所有 AC 通過（SKIP 不計入失敗），存 ac-pass-*.log
  @BLOCKER — 有 AC 失敗，存 ac-error-*.log，輸出 @TASK 修復指引
`);
    process.exit(0);
  }

  if (!args.contract || !args.target) {
    console.error('錯誤: 需要 --contract 和 --target 參數');
    process.exit(1);
  }

  if (!fs.existsSync(args.contract)) {
    console.log(`\n@BLOCKER | ac-runner | 找不到 contract: ${args.contract}\n`);
    process.exit(1);
  }

  const iterNum = args.iter || 1;
  const content = fs.readFileSync(args.contract, 'utf8');
  const specs = parseAcSpecs(content);

  if (specs.length === 0) {
    console.log('\n@SKIP | ac-runner | contract 沒有 @GEMS-AC 標記，跳過 AC 驗收\n');
    process.exit(0);
  }

  console.log(`\n🧪 AC Runner v1.1`);
  console.log(`   Contract: ${path.relative(args.target, args.contract)}`);
  console.log(`   AC 數量: ${specs.length} 個\n`);

  // 執行所有 AC
  const results = specs.map(spec => runAc(spec, args.target));

  const passed  = results.filter(r => r.status === 'PASS');
  const failed  = results.filter(r => r.status === 'FAIL');
  const errored = results.filter(r => r.status === 'ERROR');
  const skipped = results.filter(r => r.status === 'SKIP');

  // 印出結果
  // intentional SKIP = 有 @GEMS-AC-SKIP 標記（MOCK/MANUAL）；accidental SKIP = 格式殘缺
  for (const r of results) {
    const isIntentionalSkip = r.status === 'SKIP' && r.error?.startsWith('[SKIP]');
    const icon = r.status === 'PASS'  ? '✅'
               : r.status === 'FAIL'  ? '❌'
               : r.status === 'ERROR' ? '💥'
               : isIntentionalSkip    ? '⏭'
               :                        '⚠ ';
    console.log(`   ${icon} ${r.id} — ${r.fn || '?'} → ${r.status}`);
    if (r.status === 'FAIL') {
      if (r.diff?.expected !== undefined) {
        console.log(`      期望: ${JSON.stringify(r.diff.expected)}`);
        console.log(`      實際: ${JSON.stringify(r.diff.actual)}`);
      }
    }
    if (r.status === 'ERROR') {
      console.log(`      錯誤: ${r.error}`);
    }
    if (r.status === 'SKIP') {
      if (isIntentionalSkip) {
        console.log(`      ⏭  ${r.error.replace('[SKIP] ', '')} → 請用 jest mock 或人工 POC 驗收`);
      } else {
        console.log(`      ⚠  格式異常: ${r.error}`);
        console.log(`         → 請補齊 contract 的 @GEMS-AC 標籤（FN/MODULE/INPUT/EXPECT）`);
      }
    }
  }

  console.log('');
  console.log(`   結果: ${passed.length} PASS | ${failed.length} FAIL | ${errored.length} ERROR | ${skipped.length} SKIP`);

  // 存 log
  const logsDir = path.join(args.target, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const isPass = failed.length === 0 && errored.length === 0;
  const logType = isPass ? 'pass' : 'error';
  const logFile = path.join(logsDir, `ac-${logType}-${ts}.log`);

  const intentionalSkipCount = skipped.filter(r => r.error?.startsWith('[SKIP]')).length;
  const accidentalSkipCount  = skipped.length - intentionalSkipCount;

  const logLines = [
    '=== AC RUNNER LOG ===',
    `時間: ${new Date().toISOString()}`,
    `Contract: ${args.contract}`,
    `結果: ${isPass ? 'PASS' : 'FAIL'}`,
    `統計: ${passed.length} PASS | ${failed.length} FAIL | ${errored.length} ERROR | ${intentionalSkipCount} SKIP(MOCK/MANUAL) | ${accidentalSkipCount} SKIP(格式異常)`,
    '',
  ];

  for (const r of results) {
    const isIntentionalSkip = r.status === 'SKIP' && r.error?.startsWith('[SKIP]');
    const statusTag = r.status === 'SKIP'
      ? (isIntentionalSkip ? '[SKIP:MOCK/MANUAL]' : '[SKIP:格式異常]')
      : `[${r.status}]`;
    logLines.push(`${statusTag} ${r.id} — ${r.fn}`);
    if (r.diff) {
      logLines.push(`  期望: ${JSON.stringify(r.diff.expected, null, 2)}`);
      logLines.push(`  實際: ${JSON.stringify(r.diff.actual, null, 2)}`);
    }
    if (r.error) logLines.push(`  備註: ${r.error}`);
  }
  logLines.push('=====================');

  fs.writeFileSync(logFile, logLines.join('\n'), 'utf8');

  const relLog = path.relative(process.cwd(), logFile);

  if (isPass) {
    const intentionalSkips = skipped.filter(r => r.error?.startsWith('[SKIP]'));
    const accidentalSkips  = skipped.filter(r => !r.error?.startsWith('[SKIP]'));
    console.log(`\n@PASS | ac-runner | ${passed.length}/${specs.length} AC 通過`);
    if (intentionalSkips.length > 0)
      console.log(`  ⏭ ${intentionalSkips.length} 個 SKIP（MOCK/MANUAL，已標記 @GEMS-AC-SKIP）`);
    if (accidentalSkips.length > 0) {
      console.log(`  ⚠ ${accidentalSkips.length} 個 AC 格式異常（未被驗收，請補齊）:`);
      accidentalSkips.forEach(r => console.log(`    - ${r.id || '?'}: ${r.error}`));
      console.log(`    → 補齊 @GEMS-AC-FN / @GEMS-AC-MODULE / @GEMS-AC-INPUT，重跑 Phase 5`);
    }
    console.log(`  Log: ${relLog}\n`);
    process.exit(0);
  }

  // 失敗：輸出 @TASK 修復指引
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`@BLOCKER | ac-runner | ${failed.length + errored.length} 個 AC 未通過`);
  console.log('═══════════════════════════════════════════════════════════\n');

  let taskNum = 0;
  for (const r of [...failed, ...errored]) {
    taskNum++;
    const spec = specs.find(s => s.id === r.id);
    console.log(`@TASK-${taskNum}`);
    console.log(`  AC: ${r.id}`);
    console.log(`  ACTION: FIX_FUNCTION`);
    console.log(`  FILE: src/${spec?.module}  (.ts/.tsx/.js)`);
    console.log(`  FUNCTION: ${r.fn}`);
    if (r.status === 'FAIL') {
      console.log(`  INPUT: ${JSON.stringify(spec?.input)}`);
      console.log(`  EXPECTED: ${JSON.stringify(r.diff?.expected)}`);
      console.log(`  ACTUAL: ${JSON.stringify(r.diff?.actual)}`);
      console.log(`  ─────────────────────────────────────────`);
      console.log(`  [方案 A] 實作錯誤 → 修正函式邏輯，使回傳值符合 @GEMS-AC-EXPECT`);
      console.log(`           FILE: src/${spec?.module}.ts`);
      console.log(`           FUNCTION: ${r.fn}`);
      console.log(`  [方案 B] 規格錯誤 → 修正 contract @GEMS-AC-EXPECT，並留下變更記錄`);
      console.log(`           在 contract 該 AC 上方加: // [SPEC-FIX] YYYY-MM-DD <原因>`);
      console.log(`           例: // [SPEC-FIX] 2026-03-09: 初始設計忽略 UTC offset，修正期望值`);
    } else {
      console.log(`  ERROR: ${r.error}`);
      console.log(`  FIX: 確認函式存在且正確 export`);
      console.log(`       若 ERROR 原因是外部依賴（API/DB），改用 @GEMS-AC-SKIP 標記此 AC`);
    }
    console.log('');
  }

  console.log(`@RULES`);
  console.log(`  🔒 contract @GEMS-AC-EXPECT / @GEMS-AC-INPUT 是 Gate 鎖定的規格`);
  console.log(`  ✅ 若確認是實作錯誤 → 修正函式，不動 contract`);
  console.log(`  ✅ 若確認是規格錯誤 → 可修改 contract，但必須在該 AC 上方加：`);
  console.log(`     // [SPEC-FIX] YYYY-MM-DD: <原因>`);
  console.log(`  🚫 不可靜默修改 contract（無 [SPEC-FIX] 標記視為違規）`);
  const failedModules = [...new Set(
    [...failed, ...errored].map(r => specs.find(s => s.id === r.id)?.module).filter(Boolean)
  )];
  failedModules.forEach(m => console.log(`  ✅ 只能修改 src/${m}.ts 的函式實作`));
  console.log('');
  console.log(`  Log: ${relLog}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = { parseAcSpecs, runAc, partialMatch };
