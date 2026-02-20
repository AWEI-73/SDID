#!/usr/bin/env node
/**
 * Error Handler v2.0
 * 
 * 實作 MASTER_PLAN 的三層錯誤恢復策略：
 * - Attempt 1: 純模板修復
 * - Attempt 2: 注入相關上下文
 * - Attempt 3: 完整上下文 + 人類決策
 * - 超過 3 次 → @BLOCKER
 * 
 * v2.0 新增 (策略漂移整合):
 * - 整合 retry-strategy.cjs: 跨步驟策略升級
 * - 整合 taint-analyzer.cjs: 依賴圖影響分析
 * - 整合 incremental-validator.cjs: 增量驗證
 * - 整合 backtrack-router.cjs: 精確回溯
 * 
 * 錯誤分類 (E1-E8):
 * - E1: 文案格式不符 (自動修復)
 * - E2: Spec 文案格式錯誤 (自動修復)
 * - E3: 模組數 vs Story 數不符 (自動修復)
 * - E4: 迭代數/Story 數錯誤 (自動修復)
 * - E5: BUILD 文案格式錯誤 (自動修復)
 * - E6: SCAN 標籤錯誤/缺失 (自動修復)
 * - E7: Gate Test 錯誤 (需人工)
 * - E8: Spec→Story→Func 對應 (柔性連結)
 */
// v3.0: 使用新的 state manager，向後相容舊版
// v3.2: 支援專案隔離 + 說明模式
// v2.0: 整合策略漂移模組
let stateManager;
try {
  stateManager = require('./state-manager-v3.cjs');
} catch (e) {
  // Fallback: 如果 v3 不存在，嘗試舊版
  try {
    stateManager = require('./state-manager.cjs');
  } catch (e2) {
    // 最終 fallback: 使用 stub
    stateManager = {
      incrementTacticalFix: () => 1,
      getTacticalFixCount: () => 0,
      resetTacticalFix: () => {},
      isFirstRun: () => false
    };
  }
}
const { incrementTacticalFix, getTacticalFixCount, resetTacticalFix, isFirstRun } = stateManager;

// v2.0: 載入策略漂移模組 (可選)
let retryStrategy = null;
let taintAnalyzer = null;
let incrementalValidator = null;
let backtrackRouter = null;

try {
  retryStrategy = require('./retry-strategy.cjs');
} catch (e) { /* 可選模組 */ }

try {
  taintAnalyzer = require('./taint-analyzer.cjs');
} catch (e) { /* 可選模組 */ }

try {
  incrementalValidator = require('./incremental-validator.cjs');
} catch (e) { /* 可選模組 */ }

try {
  backtrackRouter = require('./backtrack-router.cjs');
} catch (e) { /* 可選模組 */ }

const MAX_ATTEMPTS = 3;

// 錯誤類型定義
const ERROR_TYPES = {
  E1: { code: 'E1', name: '文案格式不符', autoFix: true, strategy: 'template' },
  E2: { code: 'E2', name: 'Spec 文案格式錯誤', autoFix: true, strategy: 'template' },
  E3: { code: 'E3', name: '模組數 vs Story 數不符', autoFix: true, strategy: 'spec' },
  E4: { code: 'E4', name: '迭代數/Story 數錯誤', autoFix: true, strategy: 'force' },
  E5: { code: 'E5', name: 'BUILD 文案格式錯誤', autoFix: true, strategy: 'regex' },
  E6: { code: 'E6', name: 'SCAN 標籤錯誤/缺失', autoFix: true, strategy: 'tag' },
  E7: { code: 'E7', name: 'Gate Test 錯誤', autoFix: false, strategy: 'manual' },
  E8: { code: 'E8', name: 'Spec→Story→Func 對應', autoFix: false, strategy: 'flexible' },
};

/**
 * 建立錯誤處理器
 * @param {string} phase - 階段 (POC, PLAN, BUILD, SCAN)
 * @param {string} step - 步驟 (step-1, phase-5, etc.)
 * @param {string} story - Story ID (optional)
 * @param {string} target - 專案路徑 (optional, v3.2 新增)
 */
function createErrorHandler(phase, step, story = null, target = null) {
  const key = story ? `${phase}-${step}-${story}` : `${phase}-${step}`;
  const stepKey = `${step}${story ? `-${story}` : ''}`;

  return {
    /**
     * v3.2: 檢查是否為第一次執行（說明模式）
     * 第一次執行不計入錯誤，只顯示任務說明
     */
    isFirstRun() {
      if (typeof isFirstRun === 'function') {
        return isFirstRun(phase, stepKey, target);
      }
      return false;
    },

    /**
     * 記錄錯誤並取得當前 attempt 次數
     * v3.2: 第一次執行返回 0（說明模式）
     */
    recordError(errorType, issue) {
      const count = incrementTacticalFix(phase, stepKey, {
        errorType,
        issue,
        timestamp: new Date().toISOString()
      }, target);
      return count;
    },

    /**
     * 取得當前 attempt 次數
     */
    getAttemptCount() {
      return getTacticalFixCount(phase, stepKey, target);
    },

    /**
     * 重置 attempt 計數（成功後）
     * v3.2: 重置後下次執行會重新進入說明模式
     */
    resetAttempts() {
      resetTacticalFix(phase, stepKey, target);
    },

    /**
     * 檢查是否應該 BLOCKER
     * v3.2: 說明模式不會 BLOCKER
     */
    shouldBlock() {
      return this.getAttemptCount() >= MAX_ATTEMPTS;
    },

    /**
     * 取得當前恢復策略層級
     * v3.2: 0 = 說明模式, 1-3 = 修復模式
     * @returns {0|1|2|3} 策略層級
     */
    getRecoveryLevel() {
      const count = this.getAttemptCount();
      if (count === 0) return 0; // 說明模式
      if (count === 1) return 1;
      if (count === 2) return 2;
      return 3;
    },

    /**
     * 產生錯誤輸出（含策略指引）
     * v3.2: Level 0 = 說明模式（不是錯誤，是任務說明）
     */
    generateErrorOutput(errorType, issues, context = {}) {
      const attempt = this.getAttemptCount();
      const errorDef = ERROR_TYPES[errorType] || { code: errorType, name: '未知錯誤', autoFix: false };
      const level = this.getRecoveryLevel();

      // v3.2: Level 0 = 說明模式
      if (level === 0) {
        return this.generateInstructionOutput(errorType, issues, context);
      }

      // 檢查是否超過上限
      if (attempt >= MAX_ATTEMPTS) {
        return this.generateBlockerOutput(errorType, issues, context);
      }

      let output = `@TACTICAL_FIX
### TACTICAL_FIX-${attempt}: ${errorDef.name}
**Attempt**: ${attempt}/${MAX_ATTEMPTS}
**Error Code**: ${errorDef.code}
**Auto-Fix**: ${errorDef.autoFix ? 'OK 可自動修復' : '[WARN] 需人工介入'}

**Issues**:
${issues.map(i => `- ${i}`).join('\n')}

`;

      // 根據層級提供不同策略
      switch (level) {
        case 1:
          output += this.getLevel1Strategy(errorDef, context);
          break;
        case 2:
          output += this.getLevel2Strategy(errorDef, context);
          break;
        case 3:
          output += this.getLevel3Strategy(errorDef, context);
          break;
      }

      output += `
**Result**: .. 待驗證
**Next**: 修正後重新執行本步驟驗證`;

      return output;
    },

    /**
     * v3.2: 說明模式輸出（第一次執行）
     * 不是錯誤，是任務說明
     */
    generateInstructionOutput(errorType, issues, context = {}) {
      const errorDef = ERROR_TYPES[errorType] || { code: errorType, name: '任務說明', autoFix: true };

      return `@INSTRUCTION
### 📋 任務說明: ${errorDef.name}

**待完成項目**:
${issues.map(i => `- [ ] ${i}`).join('\n')}

**說明**: 這是第一次執行此步驟，請根據上述項目完成任務。
完成後重新執行驗證。

**Next**: 完成任務後重新執行本步驟
`;
    },

    /**
     * Level 1: 純模板修復
     */
    getLevel1Strategy(errorDef, context) {
      return `
**Recovery Level**: 1/3 (純模板修復)
**Strategy**: 使用標準模板重寫

@RECOVERY_ACTION
1. 參考下方模板格式
2. 直接套用修正
3. 重新執行驗證

`;
    },

    /**
     * Level 2: 注入相關上下文
     */
    getLevel2Strategy(errorDef, context) {
      let contextInfo = '';
      if (context.relatedFiles) {
        contextInfo = `
**Related Files** (請參考):
${context.relatedFiles.map(f => `- ${f}`).join('\n')}
`;
      }

      return `
**Recovery Level**: 2/3 (注入上下文)
**Strategy**: 參考相關檔案修正
${contextInfo}
@RECOVERY_ACTION
1. 讀取相關檔案了解上下文
2. 根據上下文調整修正方式
3. 重新執行驗證

`;
    },

    /**
     * Level 3: 完整上下文 + 人類決策準備
     */
    getLevel3Strategy(errorDef, context) {
      return `
**Recovery Level**: 3/3 (最後嘗試)
**Strategy**: 完整分析 + 準備人類決策

[WARN] **警告**: 這是最後一次自動修復嘗試
如果仍然失敗，將觸發 @BLOCKER 需要人類介入

@RECOVERY_ACTION
1. 完整分析錯誤根本原因
2. 嘗試不同的修正方式
3. 如果不確定，準備詳細報告給人類

**Root Cause Analysis**:
- 錯誤類型: ${errorDef.name}
- 已嘗試: ${this.getAttemptCount()} 次
- 可能原因: [請分析]

`;
    },

    /**
     * 產生 BLOCKER 輸出
     */
    generateBlockerOutput(errorType, issues, context) {
      const errorDef = ERROR_TYPES[errorType] || { code: errorType, name: '未知錯誤' };

      return `@BLOCKER
[TACTICAL_FIX_LIMIT] 重試次數已達上限 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS})

### STRATEGIC_BLOCKER: ${errorDef.name}

**Error Code**: ${errorDef.code}
**Attempts**: ${MAX_ATTEMPTS}/${MAX_ATTEMPTS} (已達上限)

**問題摘要**:
${issues.map(i => `- ${i}`).join('\n')}

**已嘗試的修復**:
- Level 1: 純模板修復 X
- Level 2: 注入上下文修復 X
- Level 3: 完整分析修復 X

**需要人類決策**:
1. 檢查錯誤是否為系統性問題
2. 考慮是否需要修改需求規格
3. 決定是否跳過此檢查（需記錄原因）

**建議行動**:
- 檢查 ${context.relatedFiles?.[0] || '相關檔案'}
- 確認需求是否有歧義
- 考慮是否需要回到 POC/PLAN 階段

@OUTPUT
狀態: BLOCKER
需要: 人類介入
`;
    }
  };
}

/**
 * 快速檢查並產生輸出
 * 用於 phase 腳本中的簡化調用
 */
function handlePhaseError(phase, step, story, errorType, issues, context = {}) {
  const handler = createErrorHandler(phase, step, story);
  handler.recordError(errorType, issues.join('; '));

  if (handler.shouldBlock()) {
    return {
      verdict: 'BLOCKER',
      output: handler.generateBlockerOutput(errorType, issues, context)
    };
  }

  return {
    verdict: 'PENDING',
    attempt: handler.getAttemptCount(),
    output: handler.generateErrorOutput(errorType, issues, context)
  };
}

/**
 * 成功時重置計數
 */
function handlePhaseSuccess(phase, step, story, target = null) {
  const handler = createErrorHandler(phase, step, story, target);
  handler.resetAttempts();
  
  // v2.0: 同時重置策略漂移狀態
  if (retryStrategy && target) {
    try {
      const iteration = detectIteration(target);
      retryStrategy.resetNodeStrategy(target, iteration, phase, step, story);
    } catch (e) { /* 忽略 */ }
  }
}

// ============================================
// v2.0: 進階錯誤處理 API (策略漂移整合)
// ============================================

/**
 * 偵測當前迭代
 */
function detectIteration(target) {
  const fs = require('fs');
  const path = require('path');
  const iterDir = path.join(target, '.gems/iterations');
  
  if (!fs.existsSync(iterDir)) return 'iter-1';
  
  const iters = fs.readdirSync(iterDir)
    .filter(d => d.match(/^iter-\d+$/))
    .sort((a, b) => parseInt(b.replace('iter-', '')) - parseInt(a.replace('iter-', '')));
  
  return iters[0] || 'iter-1';
}

/**
 * v2.0: 進階錯誤處理 - 整合策略漂移
 * 
 * @param {Object} options - 選項
 * @param {string} options.phase - 階段
 * @param {string} options.step - 步驟
 * @param {string} options.story - Story ID
 * @param {string} options.target - 專案路徑
 * @param {string} options.iteration - 迭代編號
 * @param {string} options.priority - 優先級 (P0-P3)
 * @param {Object} options.error - 錯誤資訊
 * @param {string[]} options.changedFiles - 被修改的檔案 (用於染色分析)
 * @returns {Object} 處理結果
 */
function handleAdvancedError(options) {
  const {
    phase,
    step,
    story = null,
    target = process.cwd(),
    iteration = 'iter-1',
    priority = 'P2',
    error,
    changedFiles = []
  } = options;

  const result = {
    verdict: 'PENDING',
    strategyLevel: 1,
    strategyName: 'TACTICAL_FIX',
    backtrack: null,
    impactAnalysis: null,
    validation: null,
    output: ''
  };

  // 1. 使用策略漂移追蹤
  if (retryStrategy) {
    const advice = retryStrategy.recordRetryAndGetStrategy(
      target, iteration, phase, step, error, { priority, storyId: story }
    );
    
    result.strategyLevel = advice.level;
    result.strategyName = advice.levelName;
    result.isOverLimit = advice.isOverLimit;
    
    // Level 3 = 需要回溯到 PLAN
    if (advice.level >= 3) {
      result.verdict = 'PLAN_ROLLBACK';
      result.output = retryStrategy.generateStrategyReport(advice);
    } else if (advice.isOverLimit) {
      result.verdict = 'BLOCKER';
      result.output = retryStrategy.generateStrategyReport(advice);
    } else {
      result.output = retryStrategy.generateStrategyReport(advice);
    }
  }

  // 2. 染色分析 (如果有修改的檔案)
  if (taintAnalyzer && changedFiles.length > 0) {
    const functionsJson = require('path').join(target, '.gems/docs/functions.json');
    const fs = require('fs');
    
    if (fs.existsSync(functionsJson)) {
      const graph = taintAnalyzer.buildDependencyGraph(functionsJson);
      const impact = taintAnalyzer.analyzeImpact(graph, changedFiles, { maxDepth: 2 });
      
      result.impactAnalysis = {
        directChanges: impact.stats.directChanges,
        indirectAffected: impact.stats.indirectAffected,
        affectedFiles: impact.affectedFiles
      };
      
      result.output += '\n' + taintAnalyzer.generateImpactReport(impact);
    }
  }

  // 3. 回溯路由 (如果需要)
  if (backtrackRouter && result.verdict !== 'PENDING') {
    const failures = [{
      message: typeof error === 'string' ? error : (error?.message || String(error)),
      type: error?.type,
      file: error?.file,
      line: error?.line
    }];
    
    const backtrackResult = backtrackRouter.analyzeAndRoute(failures);
    
    if (backtrackResult.needsBacktrack) {
      result.backtrack = {
        phase: backtrackResult.target.phase,
        step: backtrackResult.target.step,
        reason: backtrackResult.target.reason
      };
      
      // 產生記憶注入
      const memory = backtrackRouter.generateMemoryInjection(backtrackResult, {
        phase, step, storyId: story
      });
      
      if (memory) {
        backtrackRouter.saveBacktrackMemory(target, iteration, memory);
      }
      
      result.output += '\n' + backtrackRouter.generateBacktrackReport(backtrackResult, memory);
    }
  }

  return result;
}

/**
 * v2.0: 增量驗證 - 只驗證修改的檔案
 * 
 * @param {string[]} changedFiles - 被修改的檔案
 * @param {Object} options - 選項
 * @returns {Object} 驗證結果
 */
function runIncrementalValidation(changedFiles, options = {}) {
  if (!incrementalValidator) {
    return { status: 'SKIP', message: 'incremental-validator 未載入' };
  }

  const {
    target = process.cwd(),
    currentPhase = 8,
    functionsJson = null
  } = options;

  const result = incrementalValidator.validateChanges(changedFiles, {
    projectRoot: target,
    currentPhase,
    functionsJson: functionsJson || require('path').join(target, '.gems/docs/functions.json')
  });

  return {
    status: result.status,
    summary: result.summary,
    actionRequired: result.actionRequired,
    report: incrementalValidator.generateValidationReport(result)
  };
}

/**
 * v2.0: 取得回溯建議
 * 
 * @param {Object[]} failures - 失敗列表
 * @returns {Object} 回溯建議
 */
function getBacktrackAdvice(failures) {
  if (!backtrackRouter) {
    return { needsBacktrack: false, message: 'backtrack-router 未載入' };
  }

  return backtrackRouter.analyzeAndRoute(failures);
}

/**
 * v2.0: 取得當前策略狀態
 */
function getStrategyStatus(target, iteration, phase, step, story = null) {
  if (!retryStrategy) {
    return { exists: false, message: 'retry-strategy 未載入' };
  }

  return retryStrategy.getNodeStatus(target, iteration, phase, step, story);
}

module.exports = {
  createErrorHandler,
  handlePhaseError,
  handlePhaseSuccess,
  ERROR_TYPES,
  MAX_ATTEMPTS,
  
  // v2.0: 進階 API
  handleAdvancedError,
  runIncrementalValidation,
  getBacktrackAdvice,
  getStrategyStatus,
  
  // v2.0: 暴露子模組 (供直接調用)
  modules: {
    retryStrategy,
    taintAnalyzer,
    incrementalValidator,
    backtrackRouter
  }
};
