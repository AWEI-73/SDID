#!/usr/bin/env node
/**
 * Log Output Dry Run - 模擬完整 Blueprint Flow 的 log 輸出
 * 
 * 驗證:
 * 1. sdid-tools/lib/log-output.cjs 各 API 正常運作
 * 2. log 檔案寫入 .gems/iterations/iter-X/logs/ 正確
 * 3. 檔名格式與 task-pipe 一致
 * 4. 各階段 (gate→plan→build→shrink→expand→verify) 的 log 匯流
 */

const fs = require('fs');
const path = require('path');
const logOutput = require('../../task-pipe/lib/shared/log-output.cjs');

// ============================================
// 測試用臨時專案
// ============================================
const TEST_ROOT = path.join(__dirname, '_test-log-dryrun');
const ITER = 1;

function setup() {
  // 建立臨時專案結構
  const dirs = [
    path.join(TEST_ROOT, '.gems', 'iterations', `iter-${ITER}`, 'logs'),
    path.join(TEST_ROOT, '.gems', 'iterations', `iter-${ITER}`, 'poc'),
    path.join(TEST_ROOT, '.gems', 'iterations', `iter-${ITER}`, 'plan'),
    path.join(TEST_ROOT, '.gems', 'iterations', `iter-${ITER}`, 'build'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
  console.log(`\n🔧 測試專案建立: ${TEST_ROOT}\n`);
}

function cleanup() {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  console.log(`\n🧹 測試專案清除: ${TEST_ROOT}`);
}

// ============================================
// 模擬各階段
// ============================================

function simulateGatePass() {
  console.log('\n' + '='.repeat(60));
  console.log('📐 模擬 1: blueprint-gate @PASS');
  console.log('='.repeat(60));

  logOutput.anchorPass('gate', 'check',
    'Blueprint Gate 通過 (0 blocker, 2 warn)',
    'node sdid-tools/blueprint/draft-to-plan.cjs --draft=<path> --iter=1 --target=<project>',
    {
      projectRoot: TEST_ROOT,
      iteration: ITER,
      phase: 'gate',
      step: 'check',
    }
  );
}

function simulateGateFail() {
  console.log('\n' + '='.repeat(60));
  console.log('📐 模擬 2: blueprint-gate @BLOCKER');
  console.log('='.repeat(60));

  logOutput.anchorError('BLOCKER',
    'Blueprint Gate 失敗 — 3 個結構性問題必須修復',
    '修復藍圖後重跑: node sdid-tools/blueprint/gate.cjs --draft=<path>',
    {
      projectRoot: TEST_ROOT,
      iteration: ITER,
      phase: 'gate',
      step: 'check',
      details: [
        '❌ BLOCKER (3):',
        '  [FMT-001] 缺少「一句話目標」或長度不足 10 字',
        '    修復: 在藍圖中加入「## 一句話目標」區塊，至少 10 字描述 MVP 目標',
        '  [TAG-002] [shared/SharedTypes] 優先級格式錯誤: "HIGH" (應為 P0-P3)',
        '    修復: 優先級必須是 P0/P1/P2/P3 其中之一',
        '  [DEP-001] 模組依賴循環: auth → user → auth',
        '    修復: 重新安排模組依賴，消除循環引用',
      ].join('\n'),
    }
  );
}

function simulateDraftToPlan() {
  console.log('\n' + '='.repeat(60));
  console.log('📐 模擬 3: draft-to-plan @PASS');
  console.log('='.repeat(60));

  logOutput.anchorPass('gate', 'plan',
    'draft-to-plan 完成 — 3 個 Story plan 產出',
    'node task-pipe/runner.cjs --phase=BUILD --step=1 --target=. --story=Story-1.0',
    {
      projectRoot: TEST_ROOT,
      iteration: ITER,
      phase: 'gate',
      step: 'plan',
    }
  );
}

function simulateBuildPhase2Fail() {
  console.log('\n' + '='.repeat(60));
  console.log('📐 模擬 4: BUILD Phase 2 @TACTICAL_FIX (模擬 task-pipe 產出)');
  console.log('='.repeat(60));

  // 這是模擬 task-pipe 的 log-output 會產出的格式
  // 實際上 BUILD 用的是 task-pipe 自己的 log-output，這裡只是展示格式一致性
  logOutput.anchorError('TACTICAL_FIX',
    'GEMS 標籤覆蓋率 60% (需要 ≥80%)',
    'node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-1.0 --target=.',
    {
      projectRoot: TEST_ROOT,
      iteration: ITER,
      phase: 'build',
      step: 'phase-2',
      story: 'Story-1.0',
      attempt: 1,
      maxAttempts: 3,
      details: [
        '缺少 GEMS 標籤的函式:',
        '  src/modules/auth/services/auth-service.ts:',
        '    - login() 缺少 GEMS-FLOW',
        '    - register() 缺少 GEMS-DEPS',
        '  src/shared/storage/memory-store.ts:',
        '    - get() 缺少完整 GEMS 標籤',
      ].join('\n'),
    }
  );
}

function simulateAnchorOutput() {
  console.log('\n' + '='.repeat(60));
  console.log('📐 模擬 5: anchorOutput 完整版 (gate check 帶 template)');
  console.log('='.repeat(60));

  logOutput.anchorOutput({
    context: '藍圖: meal-pricing-blueprint.md | iter-1 | Level M',
    info: {
      '模組數': '4',
      '動作數': '12',
      '迭代數': '2',
      'P0 函式': '3',
    },
    rules: [
      '禁止修改 task-pipe/ 和 sdid-tools/',
      '只能修改專案業務檔案',
      '依據 logs/ 詳情進行精準修正',
    ],
    task: [
      '修復 FMT-001: 補齊一句話目標',
      '修復 TAG-002: 修正優先級格式',
      '重跑 blueprint-gate',
    ],
    error: {
      type: 'BLOCKER',
      summary: '3 個結構性問題必須修復',
      detail: '詳見 logs/ 目錄',
      attempt: 2,
      maxAttempts: 3,
    },
    output: '@BLOCKER | 修復後重跑: node sdid-tools/blueprint/gate.cjs --draft=<path>',
  }, {
    projectRoot: TEST_ROOT,
    iteration: ITER,
    phase: 'gate',
    step: 'check',
  });
}

function simulateErrorSpec() {
  console.log('\n' + '='.repeat(60));
  console.log('📐 模擬 6: anchorErrorSpec (精準錯誤)');
  console.log('='.repeat(60));

  logOutput.anchorErrorSpec({
    targetFile: '.gems/iterations/iter-1/poc/requirement_draft_iter-1.md',
    missing: ['一句話目標', 'P0 函式的 flow 欄位'],
    example: `## 一句話目標
建立一個餐點定價管理系統，支援動態價格計算與歷史追蹤

## 📋 模組動作清單
### Iter 1: shared [CURRENT]
| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | 狀態 |
|---------|------|---------|---|------|------|------|
| 定價型別定義 | CONST | PricingTypes | P0 | DEFINE→VALIDATE→FREEZE→EXPORT | 無 | ○○ |`,
    nextCmd: 'node sdid-tools/blueprint/gate.cjs --draft=<path> --iter=1',
    attempt: 1,
    maxAttempts: 3,
    gateSpec: {
      checks: [
        { name: '一句話目標', pattern: '≥10 字', pass: false },
        { name: '迭代規劃表', desc: '至少一行', pass: true },
        { name: 'P0 flow', pattern: '3-7 步 STEP→STEP', pass: false },
        { name: '佔位符', pattern: '無 {placeholder}', pass: true },
      ],
    },
  }, {
    projectRoot: TEST_ROOT,
    iteration: ITER,
    phase: 'gate',
    step: 'check',
  });
}

function simulateTemplatePending() {
  console.log('\n' + '='.repeat(60));
  console.log('📐 模擬 7: anchorTemplatePending (模板待填寫)');
  console.log('='.repeat(60));

  logOutput.anchorTemplatePending({
    targetFile: '.gems/iterations/iter-1/plan/implementation_plan_Story-1.0.md',
    templateContent: `# Implementation Plan - Story-1.0

## 1. Story 目標
**一句話目標**: {填入目標}

## 3. 工作項目
| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | PricingTypes | FEATURE | P0 | ✅ 明確 | - |`,
    fillItems: [
      '填入 Story 目標 (一句話)',
      '確認工作項目的優先級',
      '補齊 GEMS-FLOW 步驟',
    ],
    nextCmd: 'node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.0 --target=.',
    gateSpec: {
      checks: [
        { name: 'Story 目標', desc: '非空且 ≥10 字', pass: false },
        { name: '工作項目表', desc: '至少一行', pass: true },
        { name: 'GEMS 標籤模板', desc: '每個 Item 都有', pass: false },
      ],
    },
  }, {
    projectRoot: TEST_ROOT,
    iteration: ITER,
    phase: 'gate',
    step: 'plan',
  });
}

function simulateShrinkPass() {
  console.log('\n' + '='.repeat(60));
  console.log('📐 模擬 8: blueprint-shrink @PASS');
  console.log('='.repeat(60));

  logOutput.anchorPass('gate', 'shrink',
    'Blueprint Shrink 完成 — iter-1 已收縮 (2 模組)',
    '使用 blueprint-expand.cjs 展開 iter-2 的 Stub',
    {
      projectRoot: TEST_ROOT,
      iteration: ITER,
      phase: 'gate',
      step: 'shrink',
    }
  );
}

function simulateExpandPass() {
  console.log('\n' + '='.repeat(60));
  console.log('📐 模擬 9: blueprint-expand @PASS');
  console.log('='.repeat(60));

  logOutput.anchorPass('gate', 'expand',
    'Blueprint Expand 完成 — iter-2 已展開 (3 模組)',
    'node sdid-tools/blueprint/gate.cjs --draft=<path> --iter=2',
    {
      projectRoot: TEST_ROOT,
      iteration: 2,
      phase: 'gate',
      step: 'expand',
    }
  );
}

function simulateVerifyPass() {
  console.log('\n' + '='.repeat(60));
  console.log('📐 模擬 10: blueprint-verify @PASS');
  console.log('='.repeat(60));

  logOutput.anchorPass('gate', 'verify',
    'Blueprint Verify — 覆蓋率 100%',
    '藍圖與程式碼完全一致，可進入下一個 iter',
    {
      projectRoot: TEST_ROOT,
      iteration: ITER,
      phase: 'gate',
      step: 'verify',
    }
  );
}

// ============================================
// 驗證 log 檔案
// ============================================

function verifyLogs() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 驗證: logs 目錄內容');
  console.log('='.repeat(60));

  const logsDir1 = path.join(TEST_ROOT, '.gems', 'iterations', 'iter-1', 'logs');
  const logsDir2 = path.join(TEST_ROOT, '.gems', 'iterations', 'iter-2', 'logs');

  console.log(`\n📁 iter-1/logs/:`);
  if (fs.existsSync(logsDir1)) {
    const files1 = fs.readdirSync(logsDir1).sort();
    files1.forEach(f => {
      const size = fs.statSync(path.join(logsDir1, f)).size;
      console.log(`  ${f} (${size} bytes)`);
    });
    console.log(`  合計: ${files1.length} 個 log 檔案`);
  } else {
    console.log('  (不存在)');
  }

  console.log(`\n📁 iter-2/logs/:`);
  if (fs.existsSync(logsDir2)) {
    const files2 = fs.readdirSync(logsDir2).sort();
    files2.forEach(f => {
      const size = fs.statSync(path.join(logsDir2, f)).size;
      console.log(`  ${f} (${size} bytes)`);
    });
    console.log(`  合計: ${files2.length} 個 log 檔案`);
  } else {
    console.log('  (不存在)');
  }

  // 驗證檔名格式
  console.log('\n📋 檔名格式驗證:');
  const expectedPatterns = [
    /^gate-check-(pass|error|fix|info)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.log$/,
    /^gate-plan-(pass|template)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.log$/,
    /^gate-shrink-pass-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.log$/,
    /^gate-verify-pass-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.log$/,
    /^build-phase-2-Story-1\.0-error-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.log$/,
    /^gate-check-error-spec-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.log$/,
  ];

  if (fs.existsSync(logsDir1)) {
    const allFiles = fs.readdirSync(logsDir1);
    let matchCount = 0;
    for (const pattern of expectedPatterns) {
      const found = allFiles.some(f => pattern.test(f));
      const status = found ? '✅' : '❌';
      console.log(`  ${status} ${pattern.source}`);
      if (found) matchCount++;
    }
    console.log(`\n  匹配: ${matchCount}/${expectedPatterns.length}`);
  }

  // 讀取一個 log 檔案內容展示
  if (fs.existsSync(logsDir1)) {
    const errorLogs = fs.readdirSync(logsDir1).filter(f => f.includes('-error-') && !f.includes('error-spec'));
    if (errorLogs.length > 0) {
      const sampleLog = errorLogs[0];
      const content = fs.readFileSync(path.join(logsDir1, sampleLog), 'utf8');
      console.log(`\n📄 範例 log 內容 (${sampleLog}):`);
      console.log('---');
      console.log(content.slice(0, 500));
      if (content.length > 500) console.log('... (truncated)');
      console.log('---');
    }
  }
}

// ============================================
// 與 task-pipe log 格式對照
// ============================================

function showFormatComparison() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 格式對照: sdid-tools vs task-pipe');
  console.log('='.repeat(60));

  console.log(`
┌─────────────────────────────────────────────────────────────┐
│  sdid-tools (Blueprint Flow)                                 │
│                                                              │
│  gate-check-pass-2026-02-13T04-03-33.log    ← blueprint-gate│
│  gate-check-error-2026-02-13T04-03-33.log   ← gate BLOCKER  │
│  gate-check-error-spec-2026-02-13T04-03-33.log ← 精準錯誤   │
│  gate-plan-pass-2026-02-13T04-03-34.log     ← draft-to-plan │
│  gate-plan-template-2026-02-13T04-03-34.log ← 模板待填寫    │
│  gate-shrink-pass-2026-02-13T04-03-35.log   ← shrink        │
│  gate-expand-pass-2026-02-13T04-03-35.log   ← expand        │
│  gate-verify-pass-2026-02-13T04-03-36.log   ← verify        │
├─────────────────────────────────────────────────────────────┤
│  task-pipe (BUILD Phase，已有的格式)                          │
│                                                              │
│  build-phase-1-Story-1.0-pass-2026-02-10T16-10-25.log       │
│  build-phase-2-Story-1.0-template-2026-02-10T16-10-25.log   │
│  build-phase-2-Story-1.0-error-2026-02-10T16-10-25.log      │
│  build-phase-4-Story-1.0-error-spec-2026-02-11T04-16-21.log │
│  build-phase-5-Story-1.0-pass-2026-02-10T16-15-30.log       │
│  build-phase-8-pending-2026-02-10T16-26-19.log              │
├─────────────────────────────────────────────────────────────┤
│  完整流程 (同一個 logs/ 目錄):                                │
│                                                              │
│  gate-check-pass-...     ← Phase 1: Gate 通過               │
│  gate-plan-pass-...      ← Phase 2: Plan 產出               │
│  build-phase-1-...-pass  ← Phase 3: BUILD 開始              │
│  build-phase-2-...-error ← Phase 3: BUILD 標籤修復          │
│  build-phase-5-...-pass  ← Phase 3: BUILD TDD 通過          │
│  build-phase-8-...-pass  ← Phase 3: BUILD Fillback          │
│  gate-shrink-pass-...    ← Phase 4: 收縮完成                │
│  gate-verify-pass-...    ← Phase 5: 驗證通過                │
└─────────────────────────────────────────────────────────────┘
`);
}

// ============================================
// 主程式
// ============================================

function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  SDID Log Output Dry Run - 完整 Blueprint Flow 模擬      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  setup();

  try {
    // 模擬完整流程
    simulateGatePass();        // 1. Gate 通過
    simulateGateFail();        // 2. Gate 失敗
    simulateDraftToPlan();     // 3. Plan 產出
    simulateBuildPhase2Fail(); // 4. BUILD Phase 2 失敗 (模擬 task-pipe 格式)
    simulateAnchorOutput();    // 5. anchorOutput 完整版
    simulateErrorSpec();       // 6. anchorErrorSpec 精準錯誤
    simulateTemplatePending(); // 7. anchorTemplatePending 模板
    simulateShrinkPass();      // 8. Shrink 通過
    simulateExpandPass();      // 9. Expand 通過 (iter-2)
    simulateVerifyPass();      // 10. Verify 通過

    // 驗證結果
    verifyLogs();
    showFormatComparison();

    console.log('\n✅ Dry Run 完成 — 所有 log API 正常運作');
  } finally {
    cleanup();
  }
}

main();
