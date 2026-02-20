#!/usr/bin/env node
/**
 * Error Recovery System - 壓力測試
 * 
 * 測試場景：
 * 1. 策略漂移 - 模擬連續失敗，驗證 Level 1→2→3 升級
 * 2. 染色分析 - 模擬依賴圖，驗證影響範圍計算
 * 3. 增量驗證 - 模擬檔案修改，驗證驗證範圍
 * 4. 回溯路由 - 模擬各種失敗類型，驗證回溯目標
 * 5. 整合測試 - 模擬完整錯誤處理流程
 */

const fs = require('fs');
const path = require('path');

// 載入模組
const retryStrategy = require('../retry-strategy.cjs');
const taintAnalyzer = require('../taint-analyzer.cjs');
const incrementalValidator = require('../incremental-validator.cjs');
const backtrackRouter = require('../backtrack-router.cjs');
const errorHandler = require('../error-handler.cjs');

// 測試用臨時目錄
const TEST_DIR = path.join(__dirname, '.test-temp');
const TEST_ITERATION = 'iter-test';

// ============================================
// 測試工具
// ============================================

function setup() {
  // 建立測試目錄結構
  const dirs = [
    path.join(TEST_DIR, '.gems/iterations', TEST_ITERATION, 'logs'),
    path.join(TEST_DIR, '.gems/docs'),
    path.join(TEST_DIR, 'src/modules/auth'),
    path.join(TEST_DIR, 'src/modules/user')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // 建立測試用 functions.json
  const functionsJson = {
    version: '1.0',
    functions: [
      {
        name: 'authenticate',
        file: 'src/modules/auth/auth.ts',
        priority: 'P0',
        startLine: 10,
        endLine: 50,
        deps: '[User.getById (取得用戶)]',
        storyId: 'Story-1.0'
      },
      {
        name: 'getById',
        file: 'src/modules/user/user.ts',
        priority: 'P1',
        startLine: 5,
        endLine: 20,
        deps: null,
        storyId: 'Story-1.0'
      },
      {
        name: 'validateToken',
        file: 'src/modules/auth/auth.ts',
        priority: 'P0',
        startLine: 55,
        endLine: 80,
        deps: '[Auth.authenticate (驗證)]',
        storyId: 'Story-1.0'
      },
      {
        name: 'refreshToken',
        file: 'src/modules/auth/auth.ts',
        priority: 'P1',
        startLine: 85,
        endLine: 110,
        deps: '[Auth.validateToken (驗證 Token)]',
        storyId: 'Story-1.1'
      }
    ]
  };

  fs.writeFileSync(
    path.join(TEST_DIR, '.gems/docs/functions.json'),
    JSON.stringify(functionsJson, null, 2)
  );

  // 建立測試用原始碼檔案
  const authCode = `/**
 * GEMS: authenticate | P0 | ✓✓ | (credentials)→User | Story-1.0 | 用戶認證
 * GEMS-FLOW: ValidateInput→CheckUser→GenerateToken
 * GEMS-DEPS: [User.getById (取得用戶)]
 */
export function authenticate(credentials) {
  // [STEP] ValidateInput
  if (!credentials) throw new Error('Invalid');
  // [STEP] CheckUser
  const user = getById(credentials.userId);
  // [STEP] GenerateToken
  return { token: 'xxx', user };
}

/**
 * GEMS: validateToken | P0 | ✓✓ | (token)→boolean | Story-1.0 | 驗證 Token
 */
export function validateToken(token) {
  return token === 'xxx';
}
`;

  fs.writeFileSync(path.join(TEST_DIR, 'src/modules/auth/auth.ts'), authCode);

  console.log('✓ 測試環境已建立');
  return TEST_DIR;
}

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  console.log('✓ 測試環境已清理');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ 斷言失敗: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

// ============================================
// 測試 1: 策略漂移
// ============================================

function testStrategyDrift() {
  console.log('\n📋 測試 1: 策略漂移 (Strategy Drift)');
  console.log('=' .repeat(50));

  const projectRoot = TEST_DIR;
  const iteration = TEST_ITERATION;

  // 模擬連續失敗
  for (let i = 1; i <= 8; i++) {
    const advice = retryStrategy.recordRetryAndGetStrategy(
      projectRoot, iteration, 'BUILD', '5',
      { message: `Test failed attempt ${i}`, type: 'TEST_FAIL' },
      { priority: 'P1', storyId: 'Story-1.0' }
    );

    console.log(`  Attempt ${i}: Level ${advice.level} (${advice.levelName})`);

    if (i <= 3) {
      assert(advice.level === 1, `Attempt ${i} 應該是 Level 1 (TACTICAL_FIX)`);
    } else if (i <= 6) {
      assert(advice.level === 2, `Attempt ${i} 應該是 Level 2 (STRATEGY_SHIFT)`);
    } else {
      assert(advice.level === 3, `Attempt ${i} 應該是 Level 3 (PLAN_ROLLBACK)`);
    }
  }

  // 驗證狀態
  const status = retryStrategy.getNodeStatus(projectRoot, iteration, 'BUILD', '5', 'Story-1.0');
  assert(status.retryCount === 8, '重試次數應該是 8');
  assert(status.level === 3, '最終層級應該是 3');

  // 重置
  retryStrategy.resetNodeStrategy(projectRoot, iteration, 'BUILD', '5', 'Story-1.0');
  const resetStatus = retryStrategy.getNodeStatus(projectRoot, iteration, 'BUILD', '5', 'Story-1.0');
  assert(!resetStatus.exists, '重置後節點應該不存在');

  console.log('✓ 策略漂移測試通過');
}

// ============================================
// 測試 2: 染色分析
// ============================================

function testTaintAnalysis() {
  console.log('\n📋 測試 2: 染色分析 (Taint Analysis)');
  console.log('='.repeat(50));

  const functionsJson = path.join(TEST_DIR, '.gems/docs/functions.json');

  // 建立依賴圖
  const graph = taintAnalyzer.buildDependencyGraph(functionsJson);
  
  assert(graph.stats.totalFunctions === 4, '應該有 4 個函式');
  console.log(`  函式數: ${graph.stats.totalFunctions}`);
  console.log(`  依賴邊: ${graph.stats.totalEdges}`);

  // 模擬修改 user.ts
  const impact = taintAnalyzer.analyzeImpact(graph, ['src/modules/user/user.ts'], { maxDepth: 3 });

  console.log(`  直接修改: ${impact.stats.directChanges} 個函式`);
  console.log(`  間接影響: ${impact.stats.indirectAffected} 個函式`);
  console.log(`  影響檔案: ${impact.affectedFiles.join(', ')}`);

  assert(impact.stats.directChanges >= 1, '應該有至少 1 個直接修改的函式');
  
  // 產生驗證隊列
  const queue = taintAnalyzer.generateValidationQueue(impact);
  console.log(`  驗證隊列: ${queue.length} 項`);

  console.log('✓ 染色分析測試通過');
}

// ============================================
// 測試 3: 回溯路由
// ============================================

function testBacktrackRouter() {
  console.log('\n📋 測試 3: 回溯路由 (Backtrack Router)');
  console.log('='.repeat(50));

  // 測試各種失敗類型
  const testCases = [
    {
      failures: [{ message: 'Missing GEMS tags for function', file: 'src/auth.ts' }],
      expectedPhase: 'BUILD',
      expectedStep: '2'
    },
    {
      failures: [{ message: 'Test file not found', file: 'src/user.ts' }],
      expectedPhase: 'BUILD',
      expectedStep: '3'
    },
    {
      failures: [{ message: 'Test failed: assertion error', type: 'TEST_FAIL' }],
      expectedPhase: 'BUILD',
      expectedStep: '5'
    },
    {
      failures: [{ message: 'Invalid import path', file: 'src/index.ts' }],
      expectedPhase: 'BUILD',
      expectedStep: '6'
    },
    {
      failures: [{ message: 'Spec mismatch: function signature changed' }],
      expectedPhase: 'PLAN',
      expectedStep: '2'
    }
  ];

  testCases.forEach((tc, i) => {
    const result = backtrackRouter.analyzeAndRoute(tc.failures);
    
    if (result.needsBacktrack && result.target) {
      console.log(`  Case ${i + 1}: ${tc.failures[0].message.substring(0, 30)}...`);
      console.log(`    → 回溯到 ${result.target.phase}-${result.target.step}`);
      
      assert(
        result.target.phase === tc.expectedPhase && result.target.step === tc.expectedStep,
        `應該回溯到 ${tc.expectedPhase}-${tc.expectedStep}`
      );
    }
  });

  // 測試記憶注入
  const failures = [{ message: 'Missing GEMS-FLOW for P0 function', file: 'src/auth.ts', line: 42 }];
  const result = backtrackRouter.analyzeAndRoute(failures);
  const memory = backtrackRouter.generateMemoryInjection(result, {
    phase: 'BUILD',
    step: '8',
    storyId: 'Story-1.0'
  });

  assert(memory !== null, '應該產生記憶注入');
  assert(memory.source.phase === 'BUILD', '來源階段應該是 BUILD');
  assert(memory.target.phase === result.target.phase, '目標階段應該匹配');

  console.log('✓ 回溯路由測試通過');
}

// ============================================
// 測試 4: 整合測試 - handleAdvancedError
// ============================================

function testIntegration() {
  console.log('\n📋 測試 4: 整合測試 (handleAdvancedError)');
  console.log('='.repeat(50));

  const projectRoot = TEST_DIR;
  const iteration = TEST_ITERATION;

  // 模擬連續錯誤，觀察策略升級
  for (let i = 1; i <= 5; i++) {
    const result = errorHandler.handleAdvancedError({
      phase: 'BUILD',
      step: '5',
      story: 'Story-2.0',
      target: projectRoot,
      iteration,
      priority: 'P1',
      error: { message: `Integration test failed ${i}`, type: 'TEST_FAIL' },
      changedFiles: ['src/modules/auth/auth.ts']
    });

    console.log(`  Attempt ${i}:`);
    console.log(`    Strategy: ${result.strategyName} (Level ${result.strategyLevel})`);
    console.log(`    Verdict: ${result.verdict}`);
    
    if (result.impactAnalysis) {
      console.log(`    Impact: ${result.impactAnalysis.directChanges} direct, ${result.impactAnalysis.indirectAffected} indirect`);
    }

    if (i <= 3) {
      assert(result.strategyLevel === 1, `Attempt ${i} 應該是 Level 1`);
    } else if (i <= 6) {
      assert(result.strategyLevel === 2, `Attempt ${i} 應該是 Level 2`);
    }
  }

  console.log('✓ 整合測試通過');
}

// ============================================
// 測試 5: 效能測試
// ============================================

function testPerformance() {
  console.log('\n📋 測試 5: 效能測試');
  console.log('='.repeat(50));

  const iterations = 100;
  const projectRoot = TEST_DIR;
  const iteration = TEST_ITERATION;

  // 策略漂移效能
  const start1 = Date.now();
  for (let i = 0; i < iterations; i++) {
    retryStrategy.recordRetryAndGetStrategy(
      projectRoot, iteration, 'BUILD', 'perf',
      { message: `Perf test ${i}` },
      { priority: 'P2', storyId: `Story-perf-${i % 10}` }
    );
  }
  const time1 = Date.now() - start1;
  console.log(`  策略漂移 ${iterations} 次: ${time1}ms (${(time1/iterations).toFixed(2)}ms/次)`);

  // 染色分析效能
  const functionsJson = path.join(TEST_DIR, '.gems/docs/functions.json');
  const start2 = Date.now();
  for (let i = 0; i < iterations; i++) {
    const graph = taintAnalyzer.buildDependencyGraph(functionsJson);
    taintAnalyzer.analyzeImpact(graph, ['src/modules/auth/auth.ts']);
  }
  const time2 = Date.now() - start2;
  console.log(`  染色分析 ${iterations} 次: ${time2}ms (${(time2/iterations).toFixed(2)}ms/次)`);

  // 回溯路由效能
  const failures = [{ message: 'Test failed', type: 'TEST_FAIL' }];
  const start3 = Date.now();
  for (let i = 0; i < iterations; i++) {
    backtrackRouter.analyzeAndRoute(failures);
  }
  const time3 = Date.now() - start3;
  console.log(`  回溯路由 ${iterations} 次: ${time3}ms (${(time3/iterations).toFixed(2)}ms/次)`);

  assert(time1 < 5000, '策略漂移應該在 5 秒內完成');
  assert(time2 < 5000, '染色分析應該在 5 秒內完成');
  assert(time3 < 1000, '回溯路由應該在 1 秒內完成');

  console.log('✓ 效能測試通過');
}

// ============================================
// 主程式
// ============================================

function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Error Recovery System - 壓力測試');
  console.log('='.repeat(60));

  try {
    setup();

    testStrategyDrift();
    testTaintAnalysis();
    testBacktrackRouter();
    testIntegration();
    testPerformance();

    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有測試通過！');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    cleanup();
  }
}

// 執行
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
