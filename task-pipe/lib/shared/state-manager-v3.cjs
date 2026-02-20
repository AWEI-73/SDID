#!/usr/bin/env node
/**
 * State Manager v3.0 - 狀態驅動的流程控制
 * 
 * 核心改變：
 * 1. 不再掃描 log 檔案來判斷狀態
 * 2. state.json 是唯一真相來源
 * 3. 支援入口點（entryPoint）和中途插入
 * 4. 支援迭代跳轉和爛尾標記
 * 
 * 狀態檔案位置: .gems/iterations/{iter-X}/.state.json
 */
const fs = require('fs');
const path = require('path');

// 嘗試載入 phase-registry
let registryLoader = null;
try {
  registryLoader = require('./phase-registry-loader.cjs');
} catch (e) {
  // Fallback
}

// ============================================
// 常數
// ============================================
const HUMAN_ALERT_THRESHOLD = 3;  // 第 3 次後標記需要人工

const STATE_VERSION = '3.0';

const ITERATION_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned'
};

// ============================================
// 路徑工具
// ============================================
function getIterationPath(target, iteration) {
  return path.join(target, `.gems/iterations/${iteration}`);
}

function getStateFilePath(target, iteration) {
  return path.join(getIterationPath(target, iteration), '.state.json');
}

// ============================================
// 狀態結構
// ============================================
function createInitialState(iteration, options = {}) {
  const { entryPoint = 'POC-1', mode = 'full' } = options;

  return {
    version: STATE_VERSION,
    iteration,
    status: ITERATION_STATUS.ACTIVE,

    // 流程控制
    flow: {
      entryPoint,           // 從哪開始（支援中途插入）
      currentNode: entryPoint,
      exitPoint: null,      // 預期結束點（null = 完整流程）
      mode                  // full | partial | scan-only
    },

    // Story 追蹤
    stories: {},

    // 重試追蹤
    retries: {},

    // 人工介入提醒
    humanAlerts: [],

    // 時間戳
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}

// ============================================
// 讀寫狀態
// ============================================
function readState(target, iteration) {
  const stateFile = getStateFilePath(target, iteration);

  if (!fs.existsSync(stateFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(stateFile, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`[state-manager] Failed to read state: ${e.message}`);
    return null;
  }
}

function writeState(target, iteration, state) {
  const iterPath = getIterationPath(target, iteration);
  const stateFile = getStateFilePath(target, iteration);

  // 確保目錄存在
  if (!fs.existsSync(iterPath)) {
    fs.mkdirSync(iterPath, { recursive: true });
  }

  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');

  return state;
}

// ============================================
// 取得當前狀態（主要入口）
// ============================================
function getCurrentState(target, iteration = 'iter-1', options = {}) {
  let state = readState(target, iteration);

  if (state) {
    return { ...state, source: 'state_file' };
  }

  // 新專案或新迭代：初始化狀態
  state = createInitialState(iteration, options);
  writeState(target, iteration, state);

  return { ...state, source: 'initialized' };
}

// ============================================
// 流程控制
// ============================================

/**
 * 取得流程順序
 */
function getFlowSequence() {
  if (registryLoader) {
    try {
      return registryLoader.getFlowSequence();
    } catch (e) {
      // Fallback
    }
  }

  // Fallback 硬編碼
  return [
    { phase: 'POC', step: '1' },
    { phase: 'POC', step: '2' },
    { phase: 'POC', step: '3' },
    { phase: 'POC', step: '4' },
    { phase: 'POC', step: '5' },
    { phase: 'PLAN', step: '1' },
    { phase: 'PLAN', step: '2' },
    { phase: 'PLAN', step: '3' },
    { phase: 'PLAN', step: '4' },
    { phase: 'PLAN', step: '5' },
    { phase: 'BUILD', step: '1' },
    { phase: 'BUILD', step: '2' },
    { phase: 'BUILD', step: '3' },
    { phase: 'BUILD', step: '4' },
    { phase: 'BUILD', step: '5' },
    { phase: 'BUILD', step: '6' },
    { phase: 'BUILD', step: '7' },
    { phase: 'BUILD', step: '8' },
    { phase: 'SCAN', step: 'scan' }
  ];
}

/**
 * 解析節點字串 "PHASE-STEP" → { phase, step }
 */
function parseNode(nodeStr) {
  if (!nodeStr || nodeStr === 'COMPLETE') {
    return { phase: null, step: null };
  }

  const parts = nodeStr.split('-');
  return {
    phase: parts[0],
    step: parts.slice(1).join('-') || null
  };
}

/**
 * 格式化節點 { phase, step } → "PHASE-STEP"
 */
function formatNode(phase, step) {
  if (!phase) return 'COMPLETE';
  if (!step) return phase;
  return `${phase}-${step}`;
}

/**
 * 取得下一個節點
 */
function getNextNode(currentNode, entryPoint = null) {
  const sequence = getFlowSequence();
  const { phase, step } = parseNode(currentNode);

  const currentIndex = sequence.findIndex(
    s => s.phase === phase && s.step === step
  );

  if (currentIndex === -1 || currentIndex >= sequence.length - 1) {
    return 'COMPLETE';
  }

  const next = sequence[currentIndex + 1];
  return formatNode(next.phase, next.step);
}

/**
 * 更新當前節點（PASS 後呼叫）
 */
function advanceState(target, iteration, currentPhase, currentStep, storyId = null) {
  const state = readState(target, iteration);
  if (!state) return null;

  const currentNode = formatNode(currentPhase, currentStep);
  const nextNode = getNextNode(currentNode);

  // v3.4: 防禦舊版 state 格式（沒有 flow 欄位）
  if (!state.flow) {
    state.flow = {
      entryPoint: currentNode,
      currentNode: currentNode,
      exitPoint: null,
      mode: 'full'
    };
  }

  // 更新流程狀態
  state.flow.currentNode = nextNode;

  // 更新 Story 狀態
  if (storyId) {
    if (!state.stories) {
      state.stories = {};
    }
    if (!state.stories[storyId]) {
      state.stories[storyId] = {
        id: storyId,
        status: 'in-progress',
        currentPhase: null,
        currentStep: null,
        createdAt: new Date().toISOString()
      };
    }
    const { phase, step } = parseNode(nextNode);
    state.stories[storyId].currentPhase = phase;
    state.stories[storyId].currentStep = step;

    // BUILD-8 完成 = Story 完成
    if (currentPhase === 'BUILD' && currentStep === '8') {
      state.stories[storyId].status = 'completed';
      state.stories[storyId].completedAt = new Date().toISOString();
    }
  }

  // 清除該節點的重試計數
  clearRetry(state, currentPhase, currentStep);

  writeState(target, iteration, state);

  const { phase, step } = parseNode(nextNode);
  return { phase, step };
}

// ============================================
// 重試追蹤
// ============================================

/**
 * 記錄重試
 */
function recordRetry(target, iteration, phase, step, error) {
  const state = readState(target, iteration);
  if (!state) return { count: 0, needsHuman: false };

  const key = `${phase}-${step}`;

  if (!state.retries) state.retries = {};
  if (!state.retries[key]) {
    state.retries[key] = {
      count: 0,
      needsHuman: false,
      firstFailedAt: new Date().toISOString(),
      errors: []
    };
  }

  const retry = state.retries[key];
  retry.count++;
  retry.lastAttemptAt = new Date().toISOString();
  retry.errors.push({
    time: new Date().toISOString(),
    message: typeof error === 'string' ? error : (error?.message || String(error))
  });

  // 保留最近 10 個錯誤
  if (retry.errors.length > 10) {
    retry.errors = retry.errors.slice(-10);
  }

  // 第 3 次後標記需要人工
  if (retry.count >= HUMAN_ALERT_THRESHOLD && !retry.needsHuman) {
    retry.needsHuman = true;
    addHumanAlert(state, phase, step, retry);
  }

  writeState(target, iteration, state);

  return {
    count: retry.count,
    needsHuman: retry.needsHuman
  };
}

/**
 * 清除重試計數（PASS 後呼叫）
 */
function clearRetry(state, phase, step) {
  const key = `${phase}-${step}`;

  if (state.retries?.[key]) {
    delete state.retries[key];
  }

  // 移除相關的人工提醒
  if (state.humanAlerts) {
    state.humanAlerts = state.humanAlerts.filter(
      a => a.node !== key || a.acknowledged
    );
  }
}

/**
 * 取得重試計數
 */
function getRetryCount(target, iteration, phase, step) {
  const state = readState(target, iteration);
  const key = `${phase}-${step}`;
  return state?.retries?.[key]?.count || 0;
}

// ============================================
// 人工介入提醒
// ============================================

function addHumanAlert(state, phase, step, retry) {
  if (!state.humanAlerts) state.humanAlerts = [];

  const node = `${phase}-${step}`;

  // 避免重複
  const existing = state.humanAlerts.find(
    a => a.node === node && !a.acknowledged
  );
  if (existing) return;

  // 找當前進行中的 Story
  const currentStory = Object.keys(state.stories || {}).find(
    s => state.stories[s].status === 'in-progress'
  );

  state.humanAlerts.push({
    node,
    story: currentStory || null,
    alertedAt: new Date().toISOString(),
    reason: `重試 ${retry.count} 次仍失敗`,
    acknowledged: false
  });
}

function acknowledgeAlert(target, iteration, node) {
  const state = readState(target, iteration);
  if (!state?.humanAlerts) return false;

  const alert = state.humanAlerts.find(a => a.node === node && !a.acknowledged);
  if (alert) {
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date().toISOString();
    writeState(target, iteration, state);
    return true;
  }

  return false;
}

// ============================================
// Story 管理
// ============================================

function addStory(target, iteration, storyId, title = '') {
  const state = readState(target, iteration);
  if (!state) return null;

  if (!state.stories) state.stories = {};

  if (!state.stories[storyId]) {
    state.stories[storyId] = {
      id: storyId,
      title,
      status: 'pending',
      currentPhase: null,
      currentStep: null,
      createdAt: new Date().toISOString()
    };
  }

  writeState(target, iteration, state);
  return state.stories[storyId];
}

function updateStoryStatus(target, iteration, storyId, status, phase = null, step = null) {
  const state = readState(target, iteration);
  if (!state?.stories?.[storyId]) return null;

  state.stories[storyId].status = status;
  if (phase) state.stories[storyId].currentPhase = phase;
  if (step) state.stories[storyId].currentStep = step;
  state.stories[storyId].lastUpdated = new Date().toISOString();

  writeState(target, iteration, state);
  return state.stories[storyId];
}

// ============================================
// 迭代管理
// ============================================

/**
 * 標記迭代為 ABANDONED（爛尾）
 */
function abandonIteration(target, iteration, reason = 'User abandoned') {
  const state = readState(target, iteration);
  if (!state) return null;

  state.status = ITERATION_STATUS.ABANDONED;
  state.abandonedAt = new Date().toISOString();
  state.abandonReason = reason;

  writeState(target, iteration, state);
  return state;
}

/**
 * 標記迭代為 COMPLETED
 */
function completeIteration(target, iteration) {
  const state = readState(target, iteration);
  if (!state) return null;

  state.status = ITERATION_STATUS.COMPLETED;
  state.completedAt = new Date().toISOString();

  writeState(target, iteration, state);
  return state;
}

/**
 * 強制跳到下一個迭代
 */
function forceNextIteration(target, currentIteration, options = {}) {
  const { reason = 'Force next iteration', entryPoint = 'POC-1' } = options;

  // 1. 標記當前迭代為 ABANDONED
  abandonIteration(target, currentIteration, reason);

  // 2. 計算下一個迭代編號
  const iterNum = parseInt(currentIteration.replace('iter-', ''));
  const nextIteration = `iter-${iterNum + 1}`;

  // 3. 建立新迭代
  const newState = createInitialState(nextIteration, { entryPoint });

  // 確保目錄結構
  const nextIterPath = getIterationPath(target, nextIteration);
  fs.mkdirSync(path.join(nextIterPath, 'poc'), { recursive: true });
  fs.mkdirSync(path.join(nextIterPath, 'plan'), { recursive: true });
  fs.mkdirSync(path.join(nextIterPath, 'build'), { recursive: true });
  fs.mkdirSync(path.join(nextIterPath, 'logs'), { recursive: true });

  writeState(target, nextIteration, newState);

  return {
    previousIteration: currentIteration,
    newIteration: nextIteration,
    state: newState
  };
}

/**
 * 強制從指定節點開始（重置當前迭代）
 */
function forceStartFrom(target, iteration, startNode, options = {}) {
  let state = readState(target, iteration);

  if (!state) {
    // 新迭代
    state = createInitialState(iteration, { entryPoint: startNode });
  } else {
    // 重置現有迭代
    state.flow.entryPoint = startNode;
    state.flow.currentNode = startNode;
    state.retries = {};
    state.humanAlerts = [];
  }

  writeState(target, iteration, state);
  return state;
}

/**
 * 偵測最新的活躍迭代
 * 
 * v3.3 修正：不再無條件 +1 產生新迭代
 * - 有 ACTIVE 的 → 返回該迭代
 * - 沒有 state.json（未管理） → 返回最新的迭代（繼續使用）
 * - 最新的是 COMPLETED/ABANDONED → 才返回 +1（需要新迭代）
 */
function detectActiveIteration(target) {
  const iterationsDir = path.join(target, '.gems/iterations');

  if (!fs.existsSync(iterationsDir)) {
    return 'iter-1';
  }

  const iterDirs = fs.readdirSync(iterationsDir)
    .filter(d => d.match(/^iter-\d+$/))
    .sort((a, b) => {
      const numA = parseInt(a.replace('iter-', ''));
      const numB = parseInt(b.replace('iter-', ''));
      return numB - numA;  // 最新的排前面
    });

  if (iterDirs.length === 0) {
    return 'iter-1';
  }

  // 找第一個 ACTIVE 的迭代
  for (const iterDir of iterDirs) {
    const state = readState(target, iterDir);
    if (state && state.status === ITERATION_STATUS.ACTIVE) {
      return iterDir;
    }
  }

  // 沒有 ACTIVE 的，檢查最新迭代的狀態
  const latestIter = iterDirs[0];
  const latestState = readState(target, latestIter);

  // 如果最新迭代沒有 state.json（未管理），就返回它本身（繼續使用）
  // 只有明確標記為 COMPLETED 或 ABANDONED 時才建新迭代
  if (!latestState) {
    return latestIter;
  }

  if (latestState.status === ITERATION_STATUS.COMPLETED ||
    latestState.status === ITERATION_STATUS.ABANDONED) {
    const latestNum = parseInt(latestIter.replace('iter-', ''));
    return `iter-${latestNum + 1}`;
  }

  // 其他狀態（unknown）也返回最新的
  return latestIter;
}

// ============================================
// 向後相容 API
// ============================================

// ============================================
// 向後相容 API + 內部工具
// ============================================

/**
 * v4.0: 內部工具 — 偵測最新 iteration（不建新的）
 */
function _detectLatestIteration(projectRoot) {
  const iterDir = path.join(projectRoot, '.gems/iterations');
  if (!fs.existsSync(iterDir)) return 'iter-1';

  const iters = fs.readdirSync(iterDir)
    .filter(d => d.match(/^iter-\d+$/))
    .sort((a, b) => parseInt(b.replace('iter-', '')) - parseInt(a.replace('iter-', '')));

  return iters[0] || 'iter-1';
}

/**
 * v4.0: 內部工具 — 確保 state 存在（含 tacticalFixes 欄位）
 */
function _ensureState(projectRoot, iteration) {
  let state = readState(projectRoot, iteration);
  if (!state) {
    state = createInitialState(iteration);
    writeState(projectRoot, iteration, state);
  }
  if (!state.tacticalFixes) state.tacticalFixes = {};
  return state;
}

// 舊版 tacticalFix API（映射到新的 retry API）
// v3.1: 改為專案隔離，使用 target 參數
// v3.2: 第一次執行是說明模式，不計入錯誤
// v4.0: 統一寫入 .gems/iterations/iter-X/.state.json（P1 state 整合）
function incrementTacticalFix(phase, step, issue, target = null) {
  const projectRoot = target || process.cwd();

  // v4.0: 統一寫入 iteration state
  const iteration = _detectLatestIteration(projectRoot);
  const state = _ensureState(projectRoot, iteration);

  if (!state.tacticalFixes) state.tacticalFixes = {};

  const key = `${phase}-${step}`;
  if (!state.tacticalFixes[key]) {
    state.tacticalFixes[key] = { count: 0, issues: [], firstRun: true };
  }

  // v3.2: 第一次執行是說明模式，不計入錯誤
  if (state.tacticalFixes[key].firstRun) {
    state.tacticalFixes[key].firstRun = false;
    state.tacticalFixes[key].firstRunAt = new Date().toISOString();
    writeState(projectRoot, iteration, state);
    return 0; // 返回 0 表示這是說明模式
  }

  state.tacticalFixes[key].count++;
  state.tacticalFixes[key].issues.push({
    timestamp: new Date().toISOString(),
    issue
  });

  // 保留最近 10 個錯誤
  if (state.tacticalFixes[key].issues.length > 10) {
    state.tacticalFixes[key].issues = state.tacticalFixes[key].issues.slice(-10);
  }

  writeState(projectRoot, iteration, state);
  return state.tacticalFixes[key].count;
}

function getTacticalFixCount(phase, step, target = null) {
  const projectRoot = target || process.cwd();
  const iteration = _detectLatestIteration(projectRoot);
  const state = readState(projectRoot, iteration);
  if (!state) return 0;

  const key = `${phase}-${step}`;
  return state?.tacticalFixes?.[key]?.count || 0;
}

function resetTacticalFix(phase, step, target = null) {
  const projectRoot = target || process.cwd();
  const iteration = _detectLatestIteration(projectRoot);
  const state = readState(projectRoot, iteration);
  if (!state) return;

  const key = `${phase}-${step}`;
  // v3.2: 重置時也重置 firstRun 標記，讓下次執行重新進入說明模式
  if (state.tacticalFixes?.[key]) {
    state.tacticalFixes[key] = { count: 0, issues: [], firstRun: true };
    writeState(projectRoot, iteration, state);
  }
}

/**
 * v3.2: 檢查是否為第一次執行（說明模式）
 */
function isFirstRun(phase, step, target = null) {
  const projectRoot = target || process.cwd();
  const iteration = _detectLatestIteration(projectRoot);
  const state = readState(projectRoot, iteration);
  if (!state) return true;

  const key = `${phase}-${step}`;
  return state?.tacticalFixes?.[key]?.firstRun !== false;
}

// ============================================
// 匯出
// ============================================
module.exports = {
  // 核心 API
  getCurrentState,
  readState,
  writeState,
  advanceState,

  // 流程控制
  getFlowSequence,
  parseNode,
  formatNode,
  getNextNode,

  // 重試追蹤
  recordRetry,
  clearRetry,
  getRetryCount,
  HUMAN_ALERT_THRESHOLD,

  // 人工介入
  addHumanAlert,
  acknowledgeAlert,

  // Story 管理
  addStory,
  updateStoryStatus,

  // 迭代管理
  abandonIteration,
  completeIteration,
  forceNextIteration,
  forceStartFrom,
  detectActiveIteration,

  // 常數
  STATE_VERSION,
  ITERATION_STATUS,

  // 向後相容 (v3.2: 支援專案隔離 + 說明模式)
  incrementTacticalFix,
  getTacticalFixCount,
  resetTacticalFix,
  isFirstRun,

  // 工具
  getIterationPath,
  getStateFilePath,
  createInitialState
};
