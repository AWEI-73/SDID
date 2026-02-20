#!/usr/bin/env node
/**
 * Checkpoint 管理模組 v2.0
 * 用於 BUILD Phase 1-8 的中間狀態追蹤
 * 
 * v2.0: 從 phase-registry.json 讀取 phase 列表 (單一真相來源)
 */
const fs = require('fs');
const path = require('path');

// 嘗試載入 phase-registry-loader
let getAllBuildPhases = null;
try {
  const registryLoader = require('./phase-registry-loader.cjs');
  getAllBuildPhases = registryLoader.getAllBuildPhases;
} catch (e) {
  // Fallback
}

// 取得所有 BUILD phases (含 fallback)
function getBuildPhaseList(includePhase8 = true) {
  if (getAllBuildPhases) {
    try {
      const phases = getAllBuildPhases();
      return includePhase7 ? phases : phases.filter(p => p !== '7');
    } catch (e) {
      // fallback
    }
  }
  // Fallback
  const fallback = ['1', '2', '3', '4', '5', '6', '7', '8'];
  return includePhase8 ? fallback : fallback.filter(p => p !== '8');
}

/**
 * 寫入 checkpoint
 * @param {string} target - 專案路徑
 * @param {string} iteration - 迭代 ID
 * @param {string} story - Story ID
 * @param {string} phase - Phase ID (1, 2, 3, 4, 5, 6, 6.5)
 * @param {object} data - checkpoint 資料
 */
function writeCheckpoint(target, iteration, story, phase, data) {
  const buildPath = path.join(target, `.gems/iterations/${iteration}/build`);

  // 確保目錄存在
  if (!fs.existsSync(buildPath)) {
    fs.mkdirSync(buildPath, { recursive: true });
  }

  const checkpointFile = path.join(buildPath, `checkpoint_${story}_phase-${phase}.json`);

  const checkpoint = {
    story,
    phase,
    timestamp: new Date().toISOString(),
    verdict: data.verdict || 'PASS',
    ...data
  };

  fs.writeFileSync(checkpointFile, JSON.stringify(checkpoint, null, 2));
  return checkpointFile;
}

/**
 * 讀取 checkpoint
 */
function readCheckpoint(target, iteration, story, phase) {
  const checkpointFile = path.join(
    target,
    `.gems/iterations/${iteration}/build`,
    `checkpoint_${story}_phase-${phase}.json`
  );

  if (!fs.existsSync(checkpointFile)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 取得最新完成的 phase
 */
function getLastCompletedPhase(target, iteration, story) {
  const buildPath = path.join(target, `.gems/iterations/${iteration}/build`);

  if (!fs.existsSync(buildPath)) {
    return null;
  }

  const phases = getBuildPhaseList(false);
  let lastPhase = null;

  for (const phase of phases) {
    const checkpoint = readCheckpoint(target, iteration, story, phase);
    if (checkpoint && checkpoint.verdict === 'PASS') {
      lastPhase = phase;
    }
  }

  return lastPhase;
}

/**
 * 檢查是否可以執行指定 phase（前置 phase 必須完成）
 */
function canExecutePhase(target, iteration, story, phase) {
  const phaseOrder = getBuildPhaseList(true);
  const currentIndex = phaseOrder.indexOf(phase);

  if (currentIndex === 0) return { canExecute: true };

  const prevPhase = phaseOrder[currentIndex - 1];
  const prevCheckpoint = readCheckpoint(target, iteration, story, prevPhase);

  if (!prevCheckpoint || prevCheckpoint.verdict !== 'PASS') {
    return {
      canExecute: false,
      reason: `Phase ${prevPhase} 未完成`,
      suggestion: `請先執行: node task-pipe/runner.cjs --phase=BUILD --step=${prevPhase} --story=${story}`
    };
  }

  return { canExecute: true };
}

/**
 * 清除所有 checkpoint（Phase 8 完成後）
 */
function clearCheckpoints(target, iteration, story) {
  const buildPath = path.join(target, `.gems/iterations/${iteration}/build`);

  if (!fs.existsSync(buildPath)) return;

  const files = fs.readdirSync(buildPath);
  for (const file of files) {
    if (file.startsWith(`checkpoint_${story}_`)) {
      fs.unlinkSync(path.join(buildPath, file));
    }
  }
}

/**
 * 產生 checkpoint 摘要
 */
function getCheckpointSummary(target, iteration, story) {
  const phases = getBuildPhaseList(false);
  const summary = [];

  for (const phase of phases) {
    const checkpoint = readCheckpoint(target, iteration, story, phase);
    if (checkpoint) {
      summary.push({
        phase,
        verdict: checkpoint.verdict,
        timestamp: checkpoint.timestamp
      });
    }
  }

  return summary;
}

/**
 * 取得 Story 的 BUILD 狀態（供視覺化使用）
 * @returns {object} { status, phases, completedAt }
 * 
 * status:
 * - 'completed': 有最終產物 (Fillback + suggestions)
 * - 'in-progress': 有 checkpoint 但未完成
 * - 'not-started': 沒有任何進度
 */
function getStoryStatus(target, iteration, story) {
  const buildPath = path.join(target, `.gems/iterations/${iteration}/build`);
  const fillbackFile = path.join(buildPath, `Fillback_${story}.md`);
  const suggestionsFile = path.join(buildPath, `iteration_suggestions_${story}.json`);

  // 1. 先檢查最終產物
  const hasFillback = fs.existsSync(fillbackFile);
  const hasSuggestions = fs.existsSync(suggestionsFile);

  if (hasFillback && hasSuggestions) {
    // 已完成：全亮
    const allPhases = getBuildPhaseList(true);
    return {
      status: 'completed',
      phases: allPhases.map(p => ({ phase: p, status: 'pass' })),
      completedAt: fs.statSync(fillbackFile).mtime.toISOString()
    };
  }

  // 2. 檢查 checkpoint 進度
  const checkpoints = getCheckpointSummary(target, iteration, story);

  if (checkpoints.length === 0) {
    return {
      status: 'not-started',
      phases: [],
      completedAt: null
    };
  }

  // 3. 進行中：顯示各 phase 狀態
  const allPhases = getBuildPhaseList(true);
  const completedPhases = checkpoints.filter(c => c.verdict === 'PASS').map(c => c.phase);
  const lastCompleted = completedPhases[completedPhases.length - 1];
  const lastIndex = allPhases.indexOf(lastCompleted);
  const currentPhase = lastIndex < allPhases.length - 1 ? allPhases[lastIndex + 1] : null;

  const phases = allPhases.map(p => {
    if (completedPhases.includes(p)) {
      return { phase: p, status: 'pass' };
    } else if (p === currentPhase) {
      return { phase: p, status: 'current' };
    } else {
      return { phase: p, status: 'pending' };
    }
  });

  return {
    status: 'in-progress',
    phases,
    currentPhase,
    completedAt: null
  };
}

/**
 * 取得整個 iteration 的所有 Story 狀態
 */
function getIterationStatus(target, iteration) {
  const planPath = path.join(target, `.gems/iterations/${iteration}/plan`);
  const buildPath = path.join(target, `.gems/iterations/${iteration}/build`);

  const stories = [];

  // 從 plan 目錄找所有 Story
  if (fs.existsSync(planPath)) {
    const files = fs.readdirSync(planPath);
    for (const file of files) {
      const match = file.match(/implementation_plan_(Story-[\d.]+)\.md/);
      if (match) {
        const story = match[1];
        stories.push({
          story,
          ...getStoryStatus(target, iteration, story)
        });
      }
    }
  }

  // 統計
  const completed = stories.filter(s => s.status === 'completed').length;
  const inProgress = stories.filter(s => s.status === 'in-progress').length;
  const notStarted = stories.filter(s => s.status === 'not-started').length;

  return {
    iteration,
    stories,
    summary: {
      total: stories.length,
      completed,
      inProgress,
      notStarted
    }
  };
}

module.exports = {
  writeCheckpoint,
  readCheckpoint,
  getLastCompletedPhase,
  canExecutePhase,
  clearCheckpoints,
  getCheckpointSummary,
  getStoryStatus,
  getIterationStatus
};
