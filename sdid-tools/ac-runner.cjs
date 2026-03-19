#!/usr/bin/env node
/**
 * AC Runner v3.0 — vitest orchestrator
 *
 * @deprecated v7.0 — 此工具已 deprecated，不再由 BUILD Phase 2 呼叫。
 *   新機制：contract_iter-N.ts 使用 @GEMS-TDD 標籤指向測試檔路徑。
 *   Phase 2 直接跑 vitest --run（有 @GEMS-TDD）或 tsc --noEmit（無 @GEMS-TDD）。
 *   保留此檔案供舊版 iter 向後相容，新專案請勿使用 @GEMS-AC-* 標籤。
 *   參考: task-pipe/templates/examples/ac-golden.ts（已更新為 TDD 範例）
 *
 * 讀取 contract_iter-N.ts 的 @GEMS-AC 標記
 * 讀 cynefin-report.json → needsTest:true 的 AC 生成 vitest test → vitest run
 * needsTest:false 的 CALC AC 走舊的直接執行模式（向後相容）
 *
 * 設計原則:
 *   - contract.ts 在 Gate 階段鎖定（有 contract-pass.log），AI 無法在 BUILD 時修改
 *   - CYNEFIN 決定哪些 action needsTest: true
 *   - needsTest:true → 生成 vitest test 檔（支援 SETUP 前置步驟）
 *   - needsTest:false → 直接 require 執行比對（v2.0 相容模式）
 *   - UI/Hook/整合類 AC 繼續靠 POC.HTML 人工確認
 *
 * v3.0 變更:
 *   - 讀 cynefin-report.json 的 actions[] → 判斷 needsTest
 *   - needsTest:true AC → 生成 vitest test，支援 @GEMS-AC-SETUP 前置步驟
 *   - THEN（@GEMS-AC-EXPECT）明確為 JS 表達式
 *   - 向後相容: cynefin-report.json 不存在 → fallback 到 v2.0 直接執行模式
 *
 * v2.0 變更:
 *   - Story-scope: 自動從 @GEMS-STORY-ITEM 推導 AC→Story 映射
 *     --story=Story-X.Y 時只跑該 Story 的 AC，不依賴 @GEMS-AC-STORY 標記
 *   - 格式異常升級為 ERROR: INPUT/EXPECT parse 失敗 → BLOCKER，不再靜默跳過
 *
 * 用法:
 *   node sdid-tools/ac-runner.cjs --contract=<path> --target=<project> [--iter=N] [--story=Story-X.Y] [--dry-run]
 *
 * 輸出:
 *   @PASS    — 所有 AC 通過
 *   @BLOCKER — 有 AC 失敗（函式回傳值與預期不符）或格式異常
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// 參數解析
// ─────────────────────────────────────────────────────────────
function parseArgs() {
  const args = { contract: null, target: null, iter: null, story: null, help: false, dryRun: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--contract=')) args.contract = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--target='))  args.target  = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iter='))    args.iter    = parseInt(arg.split('=')[1]) || 1;
    else if (arg.startsWith('--story='))   args.story   = arg.split('=').slice(1).join('=');
    else if (arg === '--dry-run')          args.dryRun  = true;
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
 * @property {Array<{fn:string,module:string,args:any[]}>} [setup] - SETUP 前置步驟
 * @property {string[]} [fields]      - 只比對特定欄位（可選）
 * @property {string}   [skip]        - @GEMS-AC-SKIP 原因（MOCK/MANUAL AC，ac-runner 跳過不 BLOCKER）
 * @property {string}   [expectThrow] - @GEMS-AC-EXPECT-THROW 預期拋出的 Error 類型（失敗路徑驗收）
 */

function parseAcSpecs(contractContent) {
  const specs = [];
  const lines = contractContent.split('\n');

  // ── Pass 1: 從 @GEMS-STORY / @GEMS-STORY-ITEM 建立 AC→Story 映射 ──────────
  // 格式: // @GEMS-STORY: Story-X.Y | moduleName | desc | type
  //       // @GEMS-STORY-ITEM: fnName | TYPE | P0 | FLOW | DEPS | AC-X.Y
  const acStoryMap = {}; // { 'AC-1.0': 'Story-1.0', ... }
  let _currentStory = null;
  for (const line of lines) {
    const t = line.trim();
    // 只匹配帶 pipe 的 STORY 區段標頭（區分 @GEMS-STORY: Story-0.0 | ... 和 metadata）
    const storyHeaderMatch = t.match(/^\/\/\s*@GEMS-STORY:\s*(Story-[\w.]+)\s*\|/);
    if (storyHeaderMatch) { _currentStory = storyHeaderMatch[1]; continue; }
    if (_currentStory) {
      // 取最後一欄，提取 AC-X.Y（忽略 [SKIP]/[MANUAL]/[CALC] 等標記）
      const itemMatch = t.match(/^\/\/\s*@GEMS-STORY-ITEM:.*\|\s*(AC-[\d.]+)/);
      if (itemMatch) acStoryMap[itemMatch[1]] = _currentStory;
    }
  }

  // ── Pass 2: 解析 @GEMS-AC 區塊（原有邏輯）────────────────────────────────
  let current = null;
  for (const line of lines) {
    const trimmed = line.trim();

    const acMatch = trimmed.match(/^\/\/\s*@GEMS-AC:\s*(AC-[\d.]+)/);
    if (acMatch) {
      if (current) specs.push(current);
      current = { id: acMatch[1], fn: null, module: null, setup: null, input: null, expect: null, fields: null, type: 'CALC' };
      continue;
    }

    if (!current) continue;

    const typeMatch = trimmed.match(/^\/\/\s*@GEMS-AC-TYPE:\s*(\S+)/);
    if (typeMatch) { current.type = typeMatch[1].toUpperCase(); continue; }

    const fnMatch = trimmed.match(/^\/\/\s*@GEMS-AC-FN:\s*(\S+)/);
    if (fnMatch) { current.fn = fnMatch[1]; continue; }

    const modMatch = trimmed.match(/^\/\/\s*@GEMS-AC-MODULE:\s*(\S+)/);
    if (modMatch) { current.module = modMatch[1]; continue; }

    const setupMatch = trimmed.match(/^\/\/\s*@GEMS-AC-SETUP:\s*(.+)/);
    if (setupMatch) {
      try { current.setup = JSON.parse(setupMatch[1]); } catch (e) {
        current.setupParseError = `JSON parse failed: ${e.message}`;
      }
      continue;
    }

    const inputMatch = trimmed.match(/^\/\/\s*@GEMS-AC-INPUT:\s*(.+)/);
    if (inputMatch) {
      try { current.input = JSON.parse(inputMatch[1]); } catch (e) {
        current.inputParseError = `JSON parse failed: ${e.message}`;
      }
      continue;
    }

    const expectMatch = trimmed.match(/^\/\/\s*@GEMS-AC-EXPECT:\s*(.+)/);
    if (expectMatch) {
      const raw = expectMatch[1].trim();
      // 支援函式形式: (result) => ... 或 result => ...
      if (raw.startsWith('(') || /^\w+\s*=>/.test(raw)) {
        current.expectFn = raw;
      } else {
        try { current.expect = JSON.parse(raw); } catch (e) {
          current.expectParseError = `JSON parse failed: ${e.message}`;
        }
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

    // @GEMS-AC-STORY: Story-X.Y  → 所屬 Story，供 --story 過濾
    const storyMatch = trimmed.match(/^\/\/\s*@GEMS-AC-STORY:\s*(\S+)/);
    if (storyMatch) { current.story = storyMatch[1]; continue; }

    // 遇到非 @GEMS-AC 的非空行就結束當前 spec
    if (trimmed && !trimmed.startsWith('//')) {
      if (current) { specs.push(current); current = null; }
    }
  }
  if (current) specs.push(current);

  // ── Pass 3: 補上從 STORY-ITEM 推導的 story（未有明確 @GEMS-AC-STORY 時）──
  for (const spec of specs) {
    if (!spec.story && acStoryMap[spec.id]) {
      spec.story = acStoryMap[spec.id];
      spec.storyDerived = true; // 標記為推導來源，供 debug 用
    }
  }

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
        `"${esbuildBin}" "${filePath}" --bundle=true --platform=node --format=cjs --outfile="${outFile}"`,
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

    // 策略 C: fallback — 搜尋 workspace root 下其他專案的 tsc/esbuild
    const workspaceRoot = path.resolve(target, '..');
    const fallbackBins = [];
    try {
      for (const entry of fs.readdirSync(workspaceRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const candidateTsc = path.join(workspaceRoot, entry.name, 'node_modules', '.bin', 'tsc');
        const candidateEsbuild = path.join(workspaceRoot, entry.name, 'node_modules', '.bin', 'esbuild');
        if (fs.existsSync(candidateEsbuild)) fallbackBins.push({ type: 'esbuild', bin: candidateEsbuild });
        else if (fs.existsSync(candidateTsc)) fallbackBins.push({ type: 'tsc', bin: candidateTsc });
      }
    } catch {}

    for (const { type, bin } of fallbackBins) {
      try {
        if (type === 'esbuild') {
          const outFile = path.join(tmpDir, 'module.cjs');
          execSync(
            `"${bin}" "${filePath}" --bundle=true --platform=node --format=cjs --outfile="${outFile}"`,
            { cwd: target, stdio: 'pipe' }
          );
          const mod = require(outFile);
          const fn = mod[fnName] || mod.default?.[fnName];
          if (typeof fn === 'function') return { fn, filePath, loader: 'esbuild-fallback' };
        } else {
          const tscOutDir = path.join(tmpDir, 'tsc-out-fallback');
          fs.mkdirSync(tscOutDir, { recursive: true });
          execSync(
            `"${bin}" "${filePath}" --outDir "${tscOutDir}" --module commonjs --target ES2020 --skipLibCheck --esModuleInterop --declaration false --noEmit false`,
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
            if (typeof fn === 'function') return { fn, filePath, loader: 'tsc-fallback' };
          }
        }
      } catch {}
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

  // UNIT 類型 → 已移除，改標 @GEMS-AC-SKIP 由開發者自行驗收
  if (spec.type === 'UNIT') return { ...result, status: 'SKIP', error: '[SKIP] UNIT 類型已移除，請改用 @GEMS-AC-SKIP 標記' };

  // 驗證 spec 完整性（格式殘缺 → ERROR，不是 SKIP，Phase 2 應 BLOCKER）
  if (!spec.fn)     return { ...result, status: 'ERROR', error: '格式異常: 缺少 @GEMS-AC-FN' };
  if (!spec.module) return { ...result, status: 'ERROR', error: '格式異常: 缺少 @GEMS-AC-MODULE' };
  if (spec.input === null) {
    return { ...result, status: 'ERROR', error: spec.inputParseError
      ? `格式異常: @GEMS-AC-INPUT ${spec.inputParseError}`
      : '格式異常: 缺少 @GEMS-AC-INPUT' };
  }
  // @GEMS-AC-EXPECT-THROW 不需要 @GEMS-AC-EXPECT
  if (!spec.expectThrow && spec.expect === null && !spec.expectFn) {
    return { ...result, status: 'ERROR', error: spec.expectParseError
      ? `格式異常: @GEMS-AC-EXPECT ${spec.expectParseError}`
      : '格式異常: 缺少 @GEMS-AC-EXPECT' };
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

  // 函式形式 expect: (result) => boolean
  if (spec.expectFn) {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('result', `return (${spec.expectFn})(result)`);
      const passed = fn(actual);
      result.status = passed ? 'PASS' : 'FAIL';
      if (!passed) {
        result.diff = { expected: spec.expectFn, actual };
      }
    } catch (e) {
      result.status = 'ERROR';
      result.error = `expectFn 執行失敗: ${e.message}`;
    }
    return result;
  }

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
// CYNEFIN report 讀取（v3.0）
// ─────────────────────────────────────────────────────────────

/**
 * 找最新的 cynefin-report.json
 * 搜尋 .gems/iterations/iter-N/logs/cynefin-report-*.json
 */
function findLatestCynefinReport(target, iterNum) {
  const logsDir = path.join(target, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
  if (!fs.existsSync(logsDir)) return null;
  const files = fs.readdirSync(logsDir)
    .filter(f => f.startsWith('cynefin-report-') && f.endsWith('.json'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(logsDir, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) return null;
  try {
    const content = fs.readFileSync(path.join(logsDir, files[0].name), 'utf8');
    return JSON.parse(content);
  } catch { return null; }
}

/**
 * 從 cynefin report 的 actions[] 建立 action→needsTest map
 * key: action.name（函式名稱）
 */
function buildNeedsTestMap(cynefinReport) {
  const map = {};
  if (!cynefinReport || !Array.isArray(cynefinReport.actions)) return map;
  for (const action of cynefinReport.actions) {
    if (action.name) map[action.name] = !!action.needsTest;
  }
  return map;
}

// ─────────────────────────────────────────────────────────────
// Vitest test 生成（v3.0）
// ─────────────────────────────────────────────────────────────

/**
 * 生成 vitest test 檔案內容
 * @param {AcSpec[]} vitestSpecs - 需要 vitest 驗收的 AC specs
 * @param {string}   target      - 專案根目錄
 * @param {number}   iterNum     - 迭代編號
 */
function generateVitestContent(vitestSpecs, target, iterNum) {
  // 收集所有需要 import 的模組
  const imports = new Map(); // modulePath → Set<fnName>

  for (const spec of vitestSpecs) {
    if (spec.module) {
      if (!imports.has(spec.module)) imports.set(spec.module, new Set());
      imports.get(spec.module).add(spec.fn);
    }
    if (spec.setup) {
      for (const step of spec.setup) {
        if (step.module) {
          if (!imports.has(step.module)) imports.set(step.module, new Set());
          imports.get(step.module).add(step.fn);
        }
      }
    }
  }

  const lines = [];
  lines.push(`// AUTO-GENERATED by ac-runner v3.0 — DO NOT EDIT MANUALLY`);
  lines.push(`// iter-${iterNum} vitest AC verification`);
  lines.push(`import { describe, it, expect, beforeEach } from 'vitest'`);
  lines.push('');

  // imports
  for (const [modulePath, fns] of imports) {
    const importPath = `../../src/${modulePath}`;
    lines.push(`import { ${[...fns].join(', ')} } from '${importPath}'`);
  }
  lines.push('');

  lines.push(`describe('AC Verification - iter-${iterNum}', () => {`);
  lines.push('');

  for (const spec of vitestSpecs) {
    lines.push(`  it('${spec.id}: ${spec.fn}', async () => {`);

    // SETUP steps
    if (spec.setup && spec.setup.length > 0) {
      lines.push(`    // SETUP`);
      for (const step of spec.setup) {
        const argsJson = step.args ? step.args.map(a => JSON.stringify(a)).join(', ') : '';
        lines.push(`    ${step.fn}(${argsJson})`);
      }
    }

    // WHEN
    lines.push(`    // WHEN`);
    const inputArgs = spec.input ? spec.input.map(a => JSON.stringify(a)).join(', ') : '';
    lines.push(`    const result = ${spec.fn}(${inputArgs})`);

    // THEN
    lines.push(`    // THEN`);
    if (spec.expectThrow) {
      lines.push(`    // Note: expectThrow '${spec.expectThrow}' — manual vitest assertion needed`);
    } else if (spec.expectFn) {
      lines.push(`    expect((${spec.expectFn})(result)).toBe(true)`);
    } else if (spec.expect !== null && spec.expect !== undefined) {
      lines.push(`    expect(result).toEqual(${JSON.stringify(spec.expect)})`);
    }
    lines.push(`  })`);
    lines.push('');
  }

  lines.push(`})`);
  lines.push('');
  return lines.join('\n');
}

/**
 * 確認專案是否有 vitest dependency
 */
function hasVitest(target) {
  const pkgPath = path.join(target, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    return !!deps['vitest'];
  } catch { return false; }
}

/**
 * 執行 vitest run 並解析結果
 * 回傳 { passed, failed, errors }
 */
function runVitest(target, testFile, dryRun) {
  const { execSync } = require('child_process');
  if (dryRun) {
    console.log(`   [dry-run] 跳過 vitest 實際執行`);
    return { passed: 0, failed: 0, errors: [], dryRun: true };
  }
  try {
    const output = execSync(
      `npx vitest run "${testFile}" --reporter=verbose`,
      { cwd: target, stdio: 'pipe', encoding: 'utf8', timeout: 60000 }
    );
    // 解析 passed/failed
    const passedMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);
    return {
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      errors: [],
      output,
    };
  } catch (e) {
    const output = e.stdout || e.stderr || e.message;
    const passedMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);
    return {
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      errors: [output.slice(0, 2000)],
      output,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 主程式
// ─────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
AC Runner v3.0 — vitest orchestrator + 純計算函式驗收

用法:
  node sdid-tools/ac-runner.cjs --contract=<path> --target=<project> [--iter=N] [--story=Story-X.Y] [--dry-run]

選項:
  --contract=<path>    contract_iter-N.ts 路徑（必填）
  --target=<path>      專案根目錄（必填）
  --iter=<N>           迭代編號（用於存 log，預設: 1）
  --story=<Story-X.Y>  只跑該 Story 的 AC（從 @GEMS-STORY-ITEM 自動推導映射）
  --dry-run            不實際執行函式/vitest，只解析 AC 並印出計畫
  --help               顯示此訊息

AC 分類與 contract 格式:

  [CALC] 純計算（needsTest:false → 直接執行）:
    // @GEMS-AC: AC-1.0
    // @GEMS-AC-FN: computeNodeDates
    // @GEMS-AC-MODULE: modules/Dashboard/lib/compute-node-dates
    // @GEMS-AC-INPUT: ["2026-04-13", [{"taskCode":"N-75","offsetDays":75}]]
    // @GEMS-AC-EXPECT: [{"taskCode":"N-75","dueDate":"2026-01-28"}]

  [CALC+SETUP] 有狀態流程（needsTest:true → vitest orchestrator）:
    // @GEMS-AC: AC-1.1
    // @GEMS-AC-FN: getTransactions
    // @GEMS-AC-MODULE: modules/Ledger/services/ledger-service
    // @GEMS-AC-SETUP: [{"fn":"addTransaction","module":"modules/Ledger/services/ledger-service","args":[{...}]}]
    // @GEMS-AC-INPUT: ["2026-03"]
    // @GEMS-AC-EXPECT: (r) => r.length === 3

  [CALC] 失敗路徑（驗收 throw）:
    // @GEMS-AC: AC-1.2
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

vitest orchestrator 模式（v3.0）:
  - 讀 .gems/iterations/iter-N/logs/cynefin-report-*.json（最新）
  - 對 needsTest:true 的 AC 生成 vitest test 到 .gems/iterations/iter-N/ac-tests/
  - 對 needsTest:false 的 AC 走舊的直接執行模式
  - 向後相容: cynefin-report.json 不存在 → 全部走直接執行模式

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
  let specs = parseAcSpecs(content);

  if (specs.length === 0) {
    console.log('\n@SKIP | ac-runner | contract 沒有 @GEMS-AC 標記，跳過 AC 驗收\n');
    process.exit(0);
  }

  // --story 過濾 v2: 從 @GEMS-STORY-ITEM 推導的 story 映射已在 parseAcSpecs 完成
  // 規則: story 已知 → 只跑匹配的；story 未知（無映射、舊格式）→ 照常執行（向下相容）
  if (args.story) {
    const filtered = specs.filter(s => !s.story || s.story === args.story);
    const calcCount = filtered.filter(s => !s.skip).length;
    if (filtered.length === 0 || calcCount === 0) {
      console.log(`\n@SKIP | ac-runner | ${args.story} 無 CALC AC，跳過\n`);
      process.exit(0);
    }
    const derivedCount = filtered.filter(s => s.storyDerived).length;
    const label = derivedCount > 0 ? ` (${derivedCount} 個從 STORY-ITEM 推導)` : '';
    console.log(`\n📌 Story 過濾: ${args.story} — ${filtered.length}/${specs.length} AC${label}`);
    specs = filtered;
  }

  console.log(`\n🧪 AC Runner v3.0`);
  console.log(`   Contract: ${path.relative(args.target, args.contract)}`);
  console.log(`   AC 數量: ${specs.length} 個`);

  // ── v3.0: 讀 cynefin-report.json，建立 needsTest map ──────────
  const cynefinReport = findLatestCynefinReport(args.target, iterNum);
  const needsTestMap = buildNeedsTestMap(cynefinReport);
  const hasNeedsTestData = Object.keys(needsTestMap).length > 0;

  if (hasNeedsTestData) {
    const needsTestCount = Object.values(needsTestMap).filter(Boolean).length;
    console.log(`   CYNEFIN: ${needsTestCount} 個 action needsTest:true → vitest 模式`);
  } else {
    console.log(`   CYNEFIN: 無 cynefin-report.json，fallback 到 v2.0 直接執行模式`);
  }
  console.log('');

  // 分流：哪些 AC 走 vitest，哪些走直接執行
  const calcSpecs = specs.filter(s => !s.skip);
  const skipSpecs = specs.filter(s => s.skip);

  // 如果有 SETUP 或 needsTest:true → vitest
  // 否則 → 直接執行（向後相容）
  const vitestSpecs = calcSpecs.filter(s => {
    if (s.setup && s.setup.length > 0) return true; // 有 SETUP 一定用 vitest
    if (hasNeedsTestData && needsTestMap[s.fn] === true) return true;
    return false;
  });
  const directSpecs = calcSpecs.filter(s => !vitestSpecs.includes(s));

  // dry-run 模式：印出計畫，不實際執行
  if (args.dryRun) {
    console.log(`   [dry-run] 執行計畫:`);
    console.log(`     vitest 模式: ${vitestSpecs.length} 個 AC`);
    vitestSpecs.forEach(s => console.log(`       - ${s.id} ${s.fn}${s.setup ? ' (SETUP)' : ''}`));
    console.log(`     直接執行模式: ${directSpecs.length} 個 AC`);
    directSpecs.forEach(s => console.log(`       - ${s.id} ${s.fn}`));
    console.log(`     SKIP: ${skipSpecs.length} 個 AC`);
    skipSpecs.forEach(s => console.log(`       - ${s.id} [${s.skip}]`));
    console.log(`\n@SKIP | ac-runner | dry-run 完成，未實際執行\n`);
    process.exit(0);
  }

  // ── vitest 模式（needsTest:true AC）──────────────────────────
  let vitestResults = [];
  if (vitestSpecs.length > 0) {
    // 確認專案有 vitest
    if (!hasVitest(args.target)) {
      console.log(`   ⚠ 專案沒有 vitest dependency，無法跑 needsTest:true AC`);
      console.log('');
      console.log(`@TASK`);
      console.log(`  ACTION: INSTALL_VITEST`);
      console.log(`  FILE: package.json`);
      console.log(`  FIX: 安裝 vitest — npm install -D vitest`);
      console.log(`       安裝後重跑 ac-runner`);
      // 將這些 AC 標記為 ERROR
      vitestResults = vitestSpecs.map(s => ({
        id: s.id, fn: s.fn, status: 'ERROR',
        error: 'vitest 未安裝，無法執行有狀態 AC',
      }));
    } else {
      // 生成 vitest test 檔
      const acTestsDir = path.join(args.target, '.gems', 'iterations', `iter-${iterNum}`, 'ac-tests');
      if (!fs.existsSync(acTestsDir)) fs.mkdirSync(acTestsDir, { recursive: true });
      const testFileName = `ac-iter-${iterNum}.test.ts`;
      const testFilePath = path.join(acTestsDir, testFileName);
      const testContent = generateVitestContent(vitestSpecs, args.target, iterNum);
      fs.writeFileSync(testFilePath, testContent, 'utf8');
      console.log(`   vitest test 生成: ${path.relative(args.target, testFilePath)}`);

      // 執行 vitest
      const vitestResult = runVitest(args.target, testFilePath, args.dryRun);
      console.log(`   vitest 結果: ${vitestResult.passed} PASS | ${vitestResult.failed} FAIL`);

      // 將 vitest 結果對應到每個 spec
      vitestResults = vitestSpecs.map((s, idx) => {
        // 沒有細粒度結果時，用整體結果判斷
        if (vitestResult.dryRun) return { id: s.id, fn: s.fn, status: 'SKIP', error: '[SKIP] dry-run' };
        if (vitestResult.errors.length > 0 && vitestResult.failed > 0) {
          // 有失敗：標記為 FAIL（無法細分是哪個 test 失敗，保守處理）
          return { id: s.id, fn: s.fn, status: 'FAIL',
            diff: { expected: 'vitest PASS', actual: vitestResult.errors[0]?.slice(0, 500) || 'vitest FAIL' } };
        }
        return { id: s.id, fn: s.fn, status: 'PASS' };
      });
    }
  }

  // ── 直接執行模式（needsTest:false AC）───────────────────────
  const directResults = directSpecs.map(spec => runAc(spec, args.target));

  // ── SKIP AC ─────────────────────────────────────────────────
  const skipResults = skipSpecs.map(spec => ({ id: spec.id, fn: spec.fn, status: 'SKIP', error: `[SKIP] ${spec.skip}` }));

  // 合併結果（保持原始順序）
  const results = specs.map(spec => {
    const r = vitestResults.find(r => r.id === spec.id)
           || directResults.find(r => r.id === spec.id)
           || skipResults.find(r => r.id === spec.id);
    return r || { id: spec.id, fn: spec.fn, status: 'UNKNOWN', error: '未執行' };
  });

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
