#!/usr/bin/env node
/**
 * BUILD Phase 3: 測試腳本
 * 輸入: 源碼檔案 | 產物: 測試檔案 + checkpoint
 * 
 * 軍規 2: 測試依風險規格
 * - P0: Unit + Integration + E2E
 * - P1: Unit + Integration  
 * - P2: Unit
 * - P3: 手動測試
 * 
 * 軍規 3: TDD 100% - 禁止在測試中重寫函式邏輯
 */
const fs = require('fs');
const path = require('path');
const { writeCheckpoint } = require('../../lib/checkpoint.cjs');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { anchorOutput, anchorPass, anchorError, anchorErrorSpec, anchorTemplatePending } = require('../../lib/shared/log-output.cjs');

const { detectProjectType, getSrcDir } = require('../../lib/shared/project-type.cjs');
const { scanGemsTags } = require('../../lib/scan/gems-validator.cjs');
const { getNextCmd, getRetryCmd, getPassCmd } = require('../../lib/shared/next-command-helper.cjs');

function run(options) {

  console.log(getSimpleHeader('BUILD', 'Phase 3'));

  const { target, iteration = 'iter-1', story, level = 'M' } = options;
  // 計算相對路徑（用於輸出指令，避免絕對路徑問題）
  const relativeTarget = path.relative(process.cwd(), target) || '.';


  // 門控規格 - 告訴 AI 這個 phase 會檢查什麼
  const gateSpec = {
    checks: [
      { name: '測試檔案存在', pattern: '*.test.ts', desc: '每個模組有對應測試檔' },
      { name: 'P0 測試覆蓋', pattern: 'Unit + Integration + E2E', desc: 'P0 函式必須三種測試' },
      { name: 'P1 測試覆蓋', pattern: 'Unit + Integration', desc: 'P1 函式必須兩種測試' },
      { name: 'P2 測試覆蓋', pattern: 'Unit', desc: 'P2 函式至少 Unit 測試' },
      { name: '測試 import', pattern: 'import { fn } from', desc: '測試必須 import 被測函式' }
    ]
  };

  if (!story) {
    anchorErrorSpec({
      targetFile: 'CLI 參數',
      missing: ['--story 參數'],
      example: `node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-1.0 --target=${relativeTarget}`,
      nextCmd: 'node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-X.Y',
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      phase: 'build',
      step: 'phase-3',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  // 偵測專案類型並取得源碼目錄
  const projectInfo = detectProjectType(target);
  const srcPath = getSrcDir(target, projectInfo.type);

  if (!fs.existsSync(srcPath)) {
    anchorErrorSpec({
      targetFile: srcPath,
      missing: ['源碼目錄'],
      example: `# 請先完成 Phase 1 建立源碼骨架
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story} --target=${relativeTarget}`,
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story}`,
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-3',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  // 掃描 GEMS 標籤取得函式風險等級
  const scanResult = scanGemsTags(srcPath);
  const testFiles = findTestFiles(srcPath);

  // 統計各風險等級
  const p0Fns = scanResult.functions.filter(f => f.priority === 'P0');
  const p1Fns = scanResult.functions.filter(f => f.priority === 'P1');
  const p2Fns = scanResult.functions.filter(f => f.priority === 'P2');

  // 檢查是否已有測試檔案
  if (testFiles.length > 0) {
    const checks = validatePhase2(scanResult.functions, testFiles, srcPath);
    const failed = checks.filter(c => !c.pass && c.blocking);
    const warnings = checks.filter(c => !c.pass && !c.blocking);

    if (failed.length === 0) {
      writeCheckpoint(target, iteration, story, '3', {
        verdict: 'PASS',
        testFiles: testFiles.length,
        p0: p0Fns.length,
        p1: p1Fns.length,
        p2: p2Fns.length
      });

      const summary = `測試檔案: ${testFiles.length} | P0: ${p0Fns.length} | P1: ${p1Fns.length} | P2: ${p2Fns.length}`;
      const warningNote = warnings.length > 0 ? `\n[WARN] ${warnings.map(w => w.name).join(', ')}` : '';

      anchorPass('BUILD', 'Phase 3',
        summary + warningNote,
        getNextCmd('BUILD', '3', { story, level }),
        {
          projectRoot: target,
          iteration: parseInt(iteration.replace('iter-', '')),
          phase: 'build',
          step: 'phase-3',
          story
        });
      return { verdict: 'PASS' };
    }

    anchorOutput({
      context: `Phase 3 | ${story} | 測試不完整`,
      error: {
        type: 'TACTICAL_FIX',
        summary: `缺少: ${failed.map(c => c.name).join(', ')}`
      },
      task: ['補充測試檔案 (P0:U+I+E2E, P1:U+I, P2:U)'],
      output: `NEXT: ${getRetryCmd('BUILD', '3', { story })}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-3',
      story
    });
    return { verdict: 'PENDING' };
  }

  // 首次執行：顯示完整指引（含 template）
  const template = `測試檔案位置規則：放在源碼旁邊的 __tests__/ 資料夾
────────────────────────────────────────────────
src/lib/storage.ts     → src/lib/__tests__/storage.test.ts
src/index.ts           → src/__tests__/index.test.ts
src/modules/user.ts    → src/modules/__tests__/user.test.ts

測試檔案命名：
  Unit:        {filename}.test.ts
  Integration: {filename}.integration.test.ts
  E2E:         {filename}.e2e.test.ts
────────────────────────────────────────────────

// src/lib/__tests__/storage.test.ts
import { saveData, loadData } from '../storage';

describe('saveData', () => {
  it('should save data to localStorage', () => {
    saveData('key', { value: 1 });
    expect(localStorage.getItem('key')).toBe('{"value":1}');
  });
});

describe('loadData', () => {
  it('should load data from localStorage', () => {
    localStorage.setItem('key', '{"value":1}');
    expect(loadData('key')).toEqual({ value: 1 });
  });
});`;

  anchorOutput({
    context: `Phase 3 | ${story} | 測試腳本`,
    info: {
      'P0 函式': p0Fns.length,
      'P1 函式': p1Fns.length,
      'P2 函式': p2Fns.length
    },
    rules: [
      'P0: Unit+Integration+E2E | P1: Unit+Integration | P2: Unit',
      '測試必須 import 真實函式，禁止重寫邏輯'
    ],
    task: [
      '在源碼旁邊建立 __tests__/ 資料夾',
      '撰寫測試檔案 (P0:U+I+E2E, P1:U+I, P2:U)',
      'getDiagnostics() = 0 errors'
    ],
    template: {
      title: 'TEMPLATE',
      content: template
    },
    output: getNextCmd('BUILD', '3', { story, level })
  }, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'build',
    step: 'phase-3',
    story
  });

  return { verdict: 'PENDING' };
}

function findTestFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      findTestFiles(fullPath, files);
    } else if (entry.isFile() && /\.test\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function validatePhase2(functions, testFiles, srcPath) {
  const checks = [];

  // P0 必須有測試
  const p0Fns = functions.filter(f => f.priority === 'P0');
  const p0WithTest = p0Fns.filter(f => f.testFile);
  checks.push({
    name: 'P0 測試覆蓋',
    pass: p0Fns.length === 0 || p0WithTest.length === p0Fns.length,
    blocking: true
  });

  // P1 必須有測試
  const p1Fns = functions.filter(f => f.priority === 'P1');
  const p1WithTest = p1Fns.filter(f => f.testFile);
  checks.push({
    name: 'P1 測試覆蓋',
    pass: p1Fns.length === 0 || p1WithTest.length === p1Fns.length,
    blocking: true
  });

  // P2 建議有測試 (warning)
  const p2Fns = functions.filter(f => f.priority === 'P2');
  const p2WithTest = p2Fns.filter(f => f.testFile);
  checks.push({
    name: 'P2 測試覆蓋',
    pass: p2Fns.length === 0 || p2WithTest.length >= p2Fns.length * 0.5,
    blocking: false
  });

  // 測試檔案存在
  checks.push({
    name: '測試檔案存在',
    pass: testFiles.length > 0,
    blocking: true
  });

  return checks;
}

// 自我執行判斷
if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let iteration = 'iter-1';
  let story = null;
  let level = 'M';

  // 簡單參數解析
  args.forEach(arg => {
    if (arg.startsWith('--target=')) target = arg.split('=')[1];
    if (arg.startsWith('--project-path=')) target = arg.split('=')[1];
    if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
    if (arg.startsWith('--story=')) story = arg.split('=')[1];
    if (arg.startsWith('--level=')) level = arg.split('=')[1];
  });

  // 確保 target 是絕對路徑
  if (!path.isAbsolute(target)) {
    target = path.resolve(process.cwd(), target);
  }

  run({ target, iteration, story, level });
}

module.exports = { run };
