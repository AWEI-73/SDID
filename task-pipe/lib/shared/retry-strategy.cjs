#!/usr/bin/env node
/**
 * Retry Strategy v1.0 - 策略漂移 (Strategy Drift)
 * 
 * 核心理念：重試不是單純重複，而是「維度的提升」
 * 
 * Level 1 (1-3 次): TACTICAL_FIX - 局部修補
 * Level 2 (4-6 次): STRATEGY_SHIFT - 換個方式實作
 * Level 3 (7+ 次): PLAN_ROLLBACK - 質疑架構，回退 PLAN
 * 
 * 與 error-handler.cjs 的區別：
 * - error-handler: 處理單一步驟內的重試 (3 次上限)
 * - retry-strategy: 處理跨步驟的策略升級 (全局視角)
 */

const fs = require('fs');
const path = require('path');

// ============================================
// 常數定義
// ============================================

const STRATEGY_LEVELS = {
  TACTICAL: {
    level: 1,
    name: 'TACTICAL_FIX',
    range: [1, 3],
    description: '局部修補 - 在原檔案修復',
    action: 'FIX_IN_PLACE'
  },
  SHIFT: {
    level: 2,
    name: 'STRATEGY_SHIFT',
    range: [4, 6],
    description: '策略切換 - 嘗試不同實作方式',
    action: 'RE_IMPLEMENT'
  },
  ROLLBACK: {
    level: 3,
    name: 'PLAN_ROLLBACK',
    range: [7, Infinity],
    description: '架構質疑 - 回退到 PLAN 階段',
    action: 'ROLLBACK_PLAN'
  }
};

// 優先級對應的重試上限
const PRIORITY_LIMITS = {
  P0: { maxRetries: 10, escalateAt: 4 },
  P1: { maxRetries: 8, escalateAt: 3 },
  P2: { maxRetries: 5, escalateAt: 2 },
  P3: { maxRetries: 3, escalateAt: 2 }
};

// ============================================
// 狀態追蹤
// ============================================

/**
 * 取得策略狀態檔案路徑
 * v4.0: 統一使用 .state.json（P1 state 整合）
 */
function getStrategyStatePath(projectRoot, iteration) {
  return path.join(projectRoot, '.gems/iterations', iteration, '.state.json');
}

/**
 * 讀取策略狀態
 * v4.0: 從統一的 .state.json 的 strategy 欄位讀取
 */
function readStrategyState(projectRoot, iteration) {
  const statePath = getStrategyStatePath(projectRoot, iteration);
  
  if (!fs.existsSync(statePath)) {
    return createInitialStrategyState();
  }

  try {
    const fullState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    // v4.0: 從 strategy 欄位讀取，向後相容舊格式
    if (fullState.strategy) {
      return fullState.strategy;
    }
    // 向後相容：如果檔案本身就是 strategy state（舊 .strategy-state.json 格式）
    if (fullState.nodes && fullState.stats) {
      return fullState;
    }
    return createInitialStrategyState();
  } catch (e) {
    return createInitialStrategyState();
  }
}

/**
 * 寫入策略狀態
 * v4.0: 寫入統一的 .state.json 的 strategy 欄位
 */
function writeStrategyState(projectRoot, iteration, strategyState) {
  const statePath = getStrategyStatePath(projectRoot, iteration);
  const dir = path.dirname(statePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  strategyState.lastUpdated = new Date().toISOString();

  // v4.0: 讀取完整 state，更新 strategy 欄位
  let fullState = {};
  if (fs.existsSync(statePath)) {
    try {
      fullState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (e) { /* 損壞就覆蓋 */ }
  }

  fullState.strategy = strategyState;
  fullState.lastUpdated = new Date().toISOString();

  fs.writeFileSync(statePath, JSON.stringify(fullState, null, 2), 'utf8');
  return strategyState;
}

/**
 * 建立初始策略狀態
 */
function createInitialStrategyState() {
  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    // 追蹤每個節點的重試
    nodes: {},
    // 全局統計
    stats: {
      totalRetries: 0,
      escalations: 0,
      rollbacks: 0
    },
    // 歷史記錄
    history: []
  };
}

// ============================================
// 策略判斷
// ============================================

/**
 * 取得當前策略層級
 * @param {number} retryCount - 重試次數
 * @returns {Object} 策略層級資訊
 */
function getStrategyLevel(retryCount) {
  for (const [key, level] of Object.entries(STRATEGY_LEVELS)) {
    if (retryCount >= level.range[0] && retryCount <= level.range[1]) {
      return { ...level, key };
    }
  }
  return STRATEGY_LEVELS.ROLLBACK;
}

/**
 * 記錄重試並取得策略建議
 * @param {string} projectRoot - 專案根目錄
 * @param {string} iteration - 迭代編號
 * @param {string} phase - 階段
 * @param {string} step - 步驟
 * @param {Object} error - 錯誤資訊
 * @param {Object} options - 選項
 */
function recordRetryAndGetStrategy(projectRoot, iteration, phase, step, error, options = {}) {
  const { priority = 'P2', storyId = null } = options;
  // v1.1: 統一小寫，避免 anchorError('build') vs handlePhaseSuccess('BUILD') 大小寫不匹配
  const normPhase = phase.toLowerCase();
  const nodeKey = storyId ? `${normPhase}-${step}-${storyId}` : `${normPhase}-${step}`;

  const state = readStrategyState(projectRoot, iteration);

  // 初始化節點狀態
  if (!state.nodes[nodeKey]) {
    state.nodes[nodeKey] = {
      phase,
      step,
      storyId,
      priority,
      retryCount: 0,
      currentLevel: 1,
      errors: [],
      strategies: [],
      firstFailedAt: new Date().toISOString()
    };
  }

  const node = state.nodes[nodeKey];
  node.retryCount++;
  node.lastAttemptAt = new Date().toISOString();
  
  // 記錄錯誤
  node.errors.push({
    timestamp: new Date().toISOString(),
    message: typeof error === 'string' ? error : (error?.message || String(error)),
    type: error?.type || 'UNKNOWN'
  });

  // 保留最近 20 個錯誤
  if (node.errors.length > 20) {
    node.errors = node.errors.slice(-20);
  }

  // 取得策略層級
  const strategyLevel = getStrategyLevel(node.retryCount);
  const previousLevel = node.currentLevel;

  // 檢查是否升級
  if (strategyLevel.level > previousLevel) {
    node.currentLevel = strategyLevel.level;
    state.stats.escalations++;

    // 記錄升級歷史
    state.history.push({
      timestamp: new Date().toISOString(),
      type: 'ESCALATION',
      node: nodeKey,
      from: previousLevel,
      to: strategyLevel.level,
      retryCount: node.retryCount
    });

    if (strategyLevel.level === 3) {
      state.stats.rollbacks++;
    }
  }

  // 記錄策略
  node.strategies.push({
    timestamp: new Date().toISOString(),
    level: strategyLevel.level,
    name: strategyLevel.name,
    action: strategyLevel.action
  });

  state.stats.totalRetries++;
  writeStrategyState(projectRoot, iteration, state);

  // 產生策略建議
  return generateStrategyAdvice(node, strategyLevel, priority);
}

/**
 * 產生策略建議
 */
function generateStrategyAdvice(node, strategyLevel, priority) {
  const limits = PRIORITY_LIMITS[priority] || PRIORITY_LIMITS.P2;
  const isOverLimit = node.retryCount >= limits.maxRetries;

  const advice = {
    nodeKey: `${node.phase}-${node.step}${node.storyId ? `-${node.storyId}` : ''}`,
    retryCount: node.retryCount,
    level: strategyLevel.level,
    levelName: strategyLevel.name,
    action: strategyLevel.action,
    description: strategyLevel.description,
    isOverLimit,
    maxRetries: limits.maxRetries,
    
    // 具體指引
    guidance: null,
    context: null
  };

  // 根據層級產生具體指引
  switch (strategyLevel.level) {
    case 1:
      advice.guidance = generateTacticalGuidance(node);
      break;
    case 2:
      advice.guidance = generateShiftGuidance(node);
      break;
    case 3:
      advice.guidance = generateRollbackGuidance(node);
      break;
  }

  return advice;
}

/**
 * Level 1: 局部修補指引
 */
function generateTacticalGuidance(node) {
  const recentErrors = node.errors.slice(-3);
  
  return {
    title: '局部修補',
    instructions: [
      '1. 分析最近的錯誤訊息',
      '2. 在原檔案進行小範圍修正',
      '3. 重新執行驗證'
    ],
    recentErrors: recentErrors.map(e => e.message),
    hint: '專注於錯誤訊息指出的具體位置'
  };
}

/**
 * Level 2: 策略切換指引
 */
function generateShiftGuidance(node) {
  return {
    title: '策略切換',
    instructions: [
      '1. 停止在原方案上修補',
      '2. 考慮重新實現該函式',
      '3. 檢查是否需要引入新的 Helper',
      '4. 考慮是否需要拆分函式'
    ],
    alternatives: [
      '嘗試不同的演算法',
      '引入中間層抽象',
      '使用現有的工具函式',
      '簡化實作邏輯'
    ],
    hint: '目前的方案可能有根本性問題，換個角度思考'
  };
}

/**
 * Level 3: 回退 PLAN 指引
 */
function generateRollbackGuidance(node) {
  return {
    title: '架構質疑 - 回退 PLAN',
    instructions: [
      '1. 停止 BUILD 階段',
      '2. 回到 PLAN 階段重新審視',
      '3. 檢查 Story 規劃是否有誤',
      '4. 考慮是否需要拆分或重新設計'
    ],
    questions: [
      '這個 Story 的範圍是否太大？',
      '依賴關係是否設計正確？',
      '是否缺少必要的前置 Story？',
      '技術選型是否合適？'
    ],
    action: 'ROLLBACK_TO_PLAN',
    hint: '多次失敗表示可能是規劃層面的問題，不是實作層面'
  };
}

// ============================================
// 重置與清理
// ============================================

/**
 * 重置節點狀態 (成功後呼叫)
 */
function resetNodeStrategy(projectRoot, iteration, phase, step, storyId = null) {
  // v1.1: 統一小寫，避免大小寫不匹配
  const normPhase = phase.toLowerCase();
  const nodeKey = storyId ? `${normPhase}-${step}-${storyId}` : `${normPhase}-${step}`;
  const state = readStrategyState(projectRoot, iteration);

  if (state.nodes[nodeKey]) {
    // 記錄成功
    state.history.push({
      timestamp: new Date().toISOString(),
      type: 'SUCCESS',
      node: nodeKey,
      retriesBeforeSuccess: state.nodes[nodeKey].retryCount
    });

    // 清除節點狀態
    delete state.nodes[nodeKey];
    writeStrategyState(projectRoot, iteration, state);
  }
}

/**
 * 取得節點當前狀態
 */
function getNodeStatus(projectRoot, iteration, phase, step, storyId = null) {
  // v1.1: 統一小寫
  const normPhase = phase.toLowerCase();
  const nodeKey = storyId ? `${normPhase}-${step}-${storyId}` : `${normPhase}-${step}`;
  const state = readStrategyState(projectRoot, iteration);

  if (!state.nodes[nodeKey]) {
    return {
      exists: false,
      retryCount: 0,
      level: 0,
      levelName: 'NONE'
    };
  }

  const node = state.nodes[nodeKey];
  const strategyLevel = getStrategyLevel(node.retryCount);

  return {
    exists: true,
    retryCount: node.retryCount,
    level: strategyLevel.level,
    levelName: strategyLevel.name,
    lastAttemptAt: node.lastAttemptAt,
    recentErrors: node.errors.slice(-3)
  };
}

// ============================================
// AI 輸出格式
// ============================================

/**
 * 產生 AI 可讀的策略報告
 */
function generateStrategyReport(advice) {
  const levelEmoji = {
    1: '🔧',
    2: '🔄',
    3: '⚠️'
  };

  let report = `@STRATEGY_DRIFT
### ${levelEmoji[advice.level]} ${advice.levelName} (Level ${advice.level}/3)

**節點**: ${advice.nodeKey}
**重試次數**: ${advice.retryCount}/${advice.maxRetries}
**狀態**: ${advice.isOverLimit ? '❌ 已超過上限' : '⏳ 進行中'}

**策略**: ${advice.description}
**行動**: ${advice.action}

`;

  if (advice.guidance) {
    report += `**指引**: ${advice.guidance.title}\n`;
    advice.guidance.instructions.forEach((inst, i) => {
      report += `${inst}\n`;
    });

    if (advice.guidance.recentErrors) {
      report += `\n**最近錯誤**:\n`;
      advice.guidance.recentErrors.forEach(err => {
        report += `- ${err}\n`;
      });
    }

    if (advice.guidance.alternatives) {
      report += `\n**替代方案**:\n`;
      advice.guidance.alternatives.forEach(alt => {
        report += `- ${alt}\n`;
      });
    }

    if (advice.guidance.questions) {
      report += `\n**需要回答的問題**:\n`;
      advice.guidance.questions.forEach(q => {
        report += `- ${q}\n`;
      });
    }

    if (advice.guidance.hint) {
      report += `\n💡 **提示**: ${advice.guidance.hint}\n`;
    }
  }

  if (advice.isOverLimit) {
    report += `
@BLOCKER
重試次數已達 ${advice.priority || 'P2'} 優先級上限 (${advice.maxRetries})
需要人類介入決策
`;
  }

  return report;
}

// ============================================
// CLI
// ============================================

if (require.main === module) {
  const args = process.argv.slice(2);

  let projectRoot = process.cwd();
  let iteration = 'iter-1';
  let phase = null;
  let step = null;
  let error = 'Test error';
  let priority = 'P2';
  let action = 'record';  // record | status | reset

  for (const arg of args) {
    if (arg.startsWith('--project=')) projectRoot = arg.split('=')[1];
    else if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
    else if (arg.startsWith('--phase=')) phase = arg.split('=')[1];
    else if (arg.startsWith('--step=')) step = arg.split('=')[1];
    else if (arg.startsWith('--error=')) error = arg.split('=')[1];
    else if (arg.startsWith('--priority=')) priority = arg.split('=')[1];
    else if (arg.startsWith('--action=')) action = arg.split('=')[1];
  }

  if (!phase || !step) {
    console.log(`
🔄 Retry Strategy v1.0 - 策略漂移

用法:
  node retry-strategy.cjs --phase=<PHASE> --step=<STEP> [options]

參數:
  --phase=<PHASE>       階段 (POC, PLAN, BUILD, SCAN)
  --step=<STEP>         步驟編號
  --project=<path>      專案根目錄 (預設: cwd)
  --iteration=<iter>    迭代編號 (預設: iter-1)
  --error=<message>     錯誤訊息
  --priority=<P0-P3>    優先級 (預設: P2)
  --action=<action>     動作: record | status | reset

範例:
  node retry-strategy.cjs --phase=BUILD --step=5 --error="Test failed"
  node retry-strategy.cjs --phase=BUILD --step=5 --action=status
  node retry-strategy.cjs --phase=BUILD --step=5 --action=reset
`);
    process.exit(0);
  }

  console.log(`\n🔄 Retry Strategy v1.0`);
  console.log(`   Action: ${action}`);
  console.log(`   Node: ${phase}-${step}`);

  switch (action) {
    case 'record':
      const advice = recordRetryAndGetStrategy(projectRoot, iteration, phase, step, error, { priority });
      console.log(generateStrategyReport(advice));
      break;

    case 'status':
      const status = getNodeStatus(projectRoot, iteration, phase, step);
      console.log(`\n📊 節點狀態:`);
      console.log(`   存在: ${status.exists}`);
      console.log(`   重試次數: ${status.retryCount}`);
      console.log(`   層級: ${status.levelName} (${status.level})`);
      if (status.lastAttemptAt) {
        console.log(`   最後嘗試: ${status.lastAttemptAt}`);
      }
      break;

    case 'reset':
      resetNodeStrategy(projectRoot, iteration, phase, step);
      console.log(`\n✅ 已重置節點 ${phase}-${step}`);
      break;
  }
}

module.exports = {
  STRATEGY_LEVELS,
  PRIORITY_LIMITS,
  getStrategyLevel,
  recordRetryAndGetStrategy,
  resetNodeStrategy,
  getNodeStatus,
  generateStrategyReport,
  readStrategyState,
  writeStrategyState
};
