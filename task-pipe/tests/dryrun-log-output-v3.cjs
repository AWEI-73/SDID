/**
 * Dry-run 測試: log-output.cjs v3.0 改動驗證
 * 
 * 測試所有改動過的函式，確認:
 * 1. 終端輸出使用 NEXT: (不是「下一步」「修復後」)
 * 2. 錯誤輸出使用 @READ: (不是「詳情」)
 * 3. 施工紅線使用 @GUARD (不是 @FORBIDDEN / @REPEAT-RULE / MILITARY-SPECS)
 * 4. anchorErrorSpec 終端不印 EXAMPLE / GATE_SPEC
 * 5. anchorTemplatePending 終端不印完整模板
 * 
 * 用法: node task-pipe/tests/dryrun-log-output-v3.cjs
 */

const path = require('path');
const fs = require('fs');

const label = 'task-pipe';

// 載入目標模組 (P2: 統一為 task-pipe 版，sdid-tools 版已移除)
const logOutput = require('../lib/shared/log-output.cjs');

// 建立臨時測試目錄
const testRoot = path.join(__dirname, '..', '_test-dryrun-tmp');
const logsDir = path.join(testRoot, '.gems', 'iterations', 'iter-1', 'logs');
fs.mkdirSync(logsDir, { recursive: true });

const commonOpts = {
  projectRoot: testRoot,
  iteration: 1,
  phase: 'build',
  step: 'phase-2',
  story: 'Story-1.0'
};

// 攔截 console.log 收集輸出
let captured = [];
const origLog = console.log;
function startCapture() { captured = []; console.log = (...args) => captured.push(args.join(' ')); }
function stopCapture() { console.log = origLog; return captured.join('\n'); }

let passed = 0;
let failed = 0;

function assert(testName, output, mustContain, mustNotContain = []) {
  const errors = [];
  for (const pattern of mustContain) {
    if (!output.includes(pattern)) {
      errors.push(`  ❌ 缺少: "${pattern}"`);
    }
  }
  for (const pattern of mustNotContain) {
    if (output.includes(pattern)) {
      errors.push(`  ❌ 不應出現: "${pattern}"`);
    }
  }
  if (errors.length === 0) {
    origLog(`✅ ${testName}`);
    passed++;
  } else {
    origLog(`❌ ${testName}`);
    errors.forEach(e => origLog(e));
    origLog(`  --- 實際輸出 ---`);
    origLog(output.split('\n').map(l => `  | ${l}`).join('\n'));
    origLog(`  --- end ---`);
    failed++;
  }
}

origLog(`\n${'='.repeat(60)}`);
origLog(`Dry-run: ${label}/lib/log-output.cjs v3.0`);
origLog(`${'='.repeat(60)}\n`);

// ============================================
// Test 1: anchorPass
// ============================================
startCapture();
logOutput.anchorPass('BUILD', 'Phase 2', '標籤驗收通過 (覆蓋率: 95%)', 
  'node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-1.0',
  commonOpts);
const t1 = stopCapture();
assert('anchorPass', t1,
  ['@PASS', 'NEXT:'],
  ['下一步', '修復後']
);

// ============================================
// Test 2: anchorError
// ============================================
startCapture();
logOutput.anchorError('TACTICAL_FIX', '標籤缺失: GEMS-FLOW',
  'node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-1.0',
  { ...commonOpts, attempt: 1, maxAttempts: 3, details: '詳細錯誤內容...' });
const t2 = stopCapture();
assert('anchorError', t2,
  ['@TACTICAL_FIX', 'NEXT:', '@READ:', '@GUARD'],
  ['修復後:', '詳情:', '@REPEAT-RULE', 'MILITARY-SPECS', '@FORBIDDEN']
);

// ============================================
// Test 3: anchorErrorSpec
// ============================================
startCapture();
logOutput.anchorErrorSpec({
  targetFile: 'src/modules/recipe/services/recipe-service.ts',
  missing: ['GEMS-FLOW', 'GEMS-DEPS'],
  example: '/** GEMS: createRecipe | P0 | ... */',
  nextCmd: 'node task-pipe/runner.cjs --phase=BUILD --step=2',
  attempt: 1,
  maxAttempts: 3,
  gateSpec: {
    checks: [
      { name: 'GEMS-FLOW', pass: false, pattern: 'Step1→Step2' },
      { name: 'GEMS-DEPS', pass: false, pattern: '[Type.Name]' },
      { name: 'GEMS 基本標籤', pass: true }
    ]
  }
}, commonOpts);
const t3 = stopCapture();
assert('anchorErrorSpec - 終端精簡', t3,
  ['@ERROR_SPEC', 'TARGET:', 'MISSING:', '@READ:', 'NEXT:', '@GUARD'],
  ['═══', '📁', '📋', '可直接複製', '---', '@FORBIDDEN', '@GATE_SPEC (本步驟']
);

// ============================================
// Test 4: anchorTemplatePending
// ============================================
startCapture();
logOutput.anchorTemplatePending({
  targetFile: '.gems/iterations/iter-1/plan/implementation_plan_Story-1.0.md',
  templateContent: '## 1. Story 目標\n**一句話目標**: ...\n\n## 3. 工作項目\n| Item | 名稱 |',
  fillItems: ['Story 目標', '工作項目表格', '規格注入'],
  nextCmd: 'node task-pipe/runner.cjs --phase=PLAN --step=2 --story=Story-1.0',
  gateSpec: {
    checks: [
      { name: 'Story 目標', pattern: '/Story 目標/i' },
      { name: '工作項目', pattern: '/工作項目|Item/i' }
    ]
  }
}, commonOpts);
const t4 = stopCapture();
assert('anchorTemplatePending - 終端精簡', t4,
  ['@TEMPLATE_PENDING', 'TARGET:', 'FILL_ITEMS:', '@READ:', 'NEXT:', '@GUARD'],
  ['═══', '📁', '📋', '模板內容:', '---', '@FORBIDDEN', '@GATE_SPEC (本步驟']
);

// ============================================
// Test 5: outputPass
// ============================================
startCapture();
logOutput.outputPass('node task-pipe/runner.cjs --phase=BUILD --step=3', '測試通過');
const t5 = stopCapture();
assert('outputPass', t5,
  ['@PASS', 'NEXT:'],
  ['下一步']
);

// ============================================
// Test 6: outputError
// ============================================
startCapture();
logOutput.outputError({
  type: 'BLOCKER',
  summary: '結構性問題',
  nextCommand: 'node task-pipe/runner.cjs --phase=BUILD --step=2',
  details: '完整錯誤...',
  ...commonOpts
});
const t6 = stopCapture();
assert('outputError', t6,
  ['@BLOCKER', 'NEXT:', '@READ:'],
  ['修復後:', '詳情:']
);

// ============================================
// Test 7: emitTaskBlock (僅 task-pipe)
// ============================================
if (logOutput.emitTaskBlock) {
  startCapture();
  logOutput.emitTaskBlock({
    tasks: [
      { action: '修復 GEMS 標籤', file: 'src/services/recipe.ts', expected: '加入 GEMS-FLOW' },
      { action: '修復 GEMS-DEPS', file: 'src/services/tag.ts', expected: '加入 GEMS-DEPS' }
    ],
    nextCommand: 'node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-1.0',
    verdict: 'BLOCKER',
    context: 'BUILD Phase 2 | Story-1.0'
  }, commonOpts);
  const t7 = stopCapture();
  assert('emitTaskBlock', t7,
    ['@BLOCKER', '@TASK-1', '@TASK-2', '@NEXT_COMMAND', '@REMINDER', 'NEXT:', '@GUARD'],
    ['@FORBIDDEN', '禁止回讀架構文件']
  );
}

// ============================================
// Test 8: anchorOutput (error 場景)
// ============================================
startCapture();
logOutput.anchorOutput({
  context: 'BUILD Phase 2 | Story-1.0',
  error: { type: 'TACTICAL_FIX', summary: '標籤不完整', attempt: 1, maxAttempts: 3 },
  output: 'NEXT: node task-pipe/runner.cjs --phase=BUILD --step=2'
}, commonOpts);
const t8 = stopCapture();
assert('anchorOutput (error)', t8,
  ['@CONTEXT', '@GUARD'],
  ['MILITARY-SPECS', 'ENV-CLEAN', '禁止 sudo', '禁止 pip', '@REPEAT-RULE', '@FORBIDDEN']
);

// ============================================
// 驗證 log 檔案內容
// ============================================
origLog('\n--- Log 檔案驗證 ---');
const logFiles = fs.readdirSync(logsDir);
origLog(`產生了 ${logFiles.length} 個 log 檔案`);

// 找 error-spec log 驗證結構化內容
const specLog = logFiles.find(f => f.includes('error-spec'));
if (specLog) {
  const content = fs.readFileSync(path.join(logsDir, specLog), 'utf8');
  assert('Log 檔案結構 (error-spec)', content,
    ['=== SIGNAL ===', '=== TARGET ===', '=== GATE_SPEC ===', '=== EXAMPLE', '=== NEXT ===', '=== GUARD ==='],
    []
  );
} else {
  origLog('⚠️ 未找到 error-spec log 檔案');
}

// 找 template log 驗證結構化內容
const templateLog = logFiles.find(f => f.includes('template'));
if (templateLog) {
  const content = fs.readFileSync(path.join(logsDir, templateLog), 'utf8');
  assert('Log 檔案結構 (template)', content,
    ['=== SIGNAL ===', '=== TARGET ===', '=== TEMPLATE', '=== NEXT ===', '=== GUARD ==='],
    []
  );
} else {
  origLog('⚠️ 未找到 template log 檔案');
}

// ============================================
// 清理
// ============================================
fs.rmSync(testRoot, { recursive: true, force: true });

// ============================================
// 結果
// ============================================
origLog(`\n${'='.repeat(60)}`);
origLog(`結果: ${passed} passed, ${failed} failed (${label})`);
origLog(`${'='.repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
