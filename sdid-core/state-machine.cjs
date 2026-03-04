'use strict';
/**
 * State Machine v1.0 — SDID 統一狀態推斷引擎
 *
 * 單一真相源：合併 MCP inferBlueprintState + state-guide inferStateFromLogs + detectFullState
 * 消除三套重疊邏輯，確保「現在在哪」的判斷一致。
 *
 * 消費者：
 *   - sdid-tools/mcp-server/index.mjs  (inferBlueprintState → 改呼叫此模組)
 *   - sdid-tools/state-guide.cjs       (detectFullState → 改呼叫此模組)
 */

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// 基礎 helpers
// ─────────────────────────────────────────────────────────────

function tryJson(fp) {
  if (!fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

/**
 * 找到 iter-N/poc/ 下的 requirement_draft_*.md
 * @returns {string|null} 絕對路徑
 */
function findDraft(projectRoot, iterNum) {
  const pocDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'poc');
  if (fs.existsSync(pocDir)) {
    const drafts = fs.readdirSync(pocDir).filter(f => f.startsWith('requirement_draft_'));
    if (drafts.length) return path.join(pocDir, drafts[0]);
  }
  // fallback: 根目錄
  const rootDraft = path.join(projectRoot, 'requirement_draft.md');
  if (fs.existsSync(rootDraft)) return rootDraft;
  return null;
}

/**
 * 找到 iter-N/plan/ 下所有 implementation_plan_Story-X.Y.md
 * @returns {string[]} 排序後的 Story ID 列表
 */
function findPlannedStories(projectRoot, iterNum) {
  const planDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'plan');
  if (!fs.existsSync(planDir)) return [];
  return fs.readdirSync(planDir)
    .filter(f => f.startsWith('implementation_plan_'))
    .map(f => { const m = f.match(/Story-(\d+\.\d+)/); return m ? `Story-${m[1]}` : null; })
    .filter(Boolean).sort();
}

/**
 * 找到 iter-N/build/ 下所有 Fillback_Story-X.Y.md（已完成的 Story）
 * @returns {string[]} 排序後的 Story ID 列表
 */
function findCompletedStories(projectRoot, iterNum) {
  const buildDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'build');
  if (!fs.existsSync(buildDir)) return [];
  return fs.readdirSync(buildDir)
    .filter(f => f.startsWith('Fillback_'))
    .map(f => { const m = f.match(/Story-(\d+\.\d+)/); return m ? `Story-${m[1]}` : null; })
    .filter(Boolean).sort();
}

/**
 * 偵測最新的 active iteration
 * @returns {string} 如 'iter-3'
 */
function detectActiveIter(projectRoot) {
  const dir = path.join(projectRoot, '.gems', 'iterations');
  if (!fs.existsSync(dir)) return 'iter-1';
  const dirs = fs.readdirSync(dir)
    .filter(d => /^iter-\d+$/.test(d))
    .sort((a, b) => parseInt(b.replace('iter-', '')) - parseInt(a.replace('iter-', '')));
  if (!dirs.length) return 'iter-1';
  // 優先找 status=active 的
  for (const d of dirs) {
    const st = tryJson(path.join(dir, d, '.state.json'));
    if (st && st.status === 'active') return d;
  }
  return dirs[0];
}

// ─────────────────────────────────────────────────────────────
// Route detection
// ─────────────────────────────────────────────────────────────

/**
 * 偵測專案走哪條路線
 * @returns {'Blueprint'|'Task-Pipe'|'POC-FIX'|'Unknown'}
 */
function detectRoute(projectRoot) {
  const iterDirs = path.join(projectRoot, '.gems', 'iterations');
  if (fs.existsSync(iterDirs)) {
    for (const it of fs.readdirSync(iterDirs)) {
      if (fs.existsSync(path.join(iterDirs, it, 'poc', 'poc-consolidation-log.md'))) return 'POC-FIX';
    }
  }
  if (fs.existsSync(path.join(projectRoot, '.gems', 'poc-consolidation-log.md'))) return 'POC-FIX';
  if (fs.existsSync(iterDirs)) {
    for (const it of fs.readdirSync(iterDirs)) {
      const pocDir = path.join(iterDirs, it, 'poc');
      if (fs.existsSync(pocDir) && fs.readdirSync(pocDir).some(f => f.startsWith('requirement_draft_')))
        return 'Blueprint';
    }
  }
  if (fs.existsSync(path.join(projectRoot, 'requirement-draft.md'))) return 'Blueprint';
  if (fs.existsSync(path.join(projectRoot, 'requirement-spec.md'))) return 'Task-Pipe';
  const specsDir = path.join(projectRoot, '.gems', 'specs');
  if (fs.existsSync(specsDir) && fs.readdirSync(specsDir).some(f => f.endsWith('.json') && f !== '_index.json'))
    return 'POC-FIX';
  return 'Unknown';
}

// ─────────────────────────────────────────────────────────────
// Core: log-based state inference
// ─────────────────────────────────────────────────────────────

/**
 * 從 logs/ 目錄推斷 Blueprint Flow 當前狀態（統一版）
 *
 * 合併來源：
 *   - MCP inferBlueprintState（原 index.mjs L103-185）
 *   - state-guide inferStateFromLogs（原 state-guide.cjs L97-125）
 *
 * @param {string} projectRoot
 * @param {number} iterNum
 * @param {string[]} plannedStories
 * @param {string[]} completedStories
 * @returns {{ phase, step, story, hasError? }|null}
 */
function inferStateFromLogs(projectRoot, iterNum, plannedStories, completedStories) {
  const logsDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
  if (!fs.existsSync(logsDir)) return null;

  const logs = fs.readdirSync(logsDir).sort();
  const has = (prefix) => logs.some(f => f.startsWith(prefix));

  // POC-FIX / MICRO-FIX 完成判斷
  if (has('gate-microfix-pass-')) {
    // 如果之後沒有更高優先的 log（如 build-phase），視為完成
    const hasSubsequentBuild = logs.some(f => f.startsWith('build-phase-'));
    if (!hasSubsequentBuild) {
      return { phase: 'COMPLETE', step: null, story: null };
    }
  }

  if (has('gate-verify-pass-')) {
    const nextDraft = findDraft(projectRoot, iterNum + 1);
    return nextDraft
      ? { phase: 'NEXT_ITER', step: null, story: null }
      : { phase: 'COMPLETE', step: null, story: null };
  }

  if (has('gate-shrink-pass-')) {
    const allDone = plannedStories.length > 0 && plannedStories.every(s => completedStories.includes(s));
    if (allDone) return { phase: 'VERIFY', step: null, story: null };
    const next = plannedStories.find(s => !completedStories.includes(s));
    return next
      ? { phase: 'BUILD', step: '1', story: next }
      : { phase: 'VERIFY', step: null, story: null };
  }

  // Find highest BUILD phase pass
  let maxPhase = 0, latestStory = null;
  for (const f of logs) {
    const m = f.match(/^build-phase-(\d+)-Story-([\d.]+)-pass-/);
    if (m) {
      const p = parseInt(m[1]);
      if (p > maxPhase) { maxPhase = p; latestStory = `Story-${m[2]}`; }
    }
  }
  if (maxPhase > 0) {
    if (maxPhase >= 8) {
      const next = plannedStories.find(s => !completedStories.includes(s));
      return next
        ? { phase: 'BUILD', step: '1', story: next }
        : { phase: 'SHRINK', step: null, story: null };
    }
    return { phase: 'BUILD', step: String(maxPhase + 1), story: latestStory };
  }

  if (has('gate-plan-pass-')) {
    return { phase: 'BUILD', step: '1', story: plannedStories[0] || null };
  }
  if (has('gate-check-pass-')) {
    // Cynefin Gate: GATE @PASS 後必須有 cynefin-check-pass 才能進 PLAN
    if (!has('cynefin-check-pass-')) {
      return { phase: 'CYNEFIN_CHECK', step: null, story: null };
    }
    return { phase: 'PLAN', step: null, story: null };
  }

  // error logs → retry same phase
  if (has('gate-check-error-')) return { phase: 'GATE', step: null, story: null, hasError: true };
  if (has('gate-plan-error-')) return { phase: 'PLAN', step: null, story: null, hasError: true };

  return null;
}

// ─────────────────────────────────────────────────────────────
// Core: full state detection
// ─────────────────────────────────────────────────────────────

/**
 * 完整狀態偵測（統一版）
 *
 * 優先順序：
 *   1. state-manager-v3 ledger（.state.json）
 *   2. last_step_result.json
 *   3. log-based inference（inferStateFromLogs）
 *   4. draft 存在 → GATE
 *
 * @param {string} projectRoot
 * @param {string} iter - 如 'iter-1'
 * @param {string|null} storyOpt - 可選，強制指定 story
 * @returns {FullState}
 */
function detectFullState(projectRoot, iter, storyOpt) {
  const iterNum = parseInt(iter.replace('iter-', ''), 10);
  const route = detectRoute(projectRoot);
  const draftPath = findDraft(projectRoot, iterNum);
  const plannedStories = findPlannedStories(projectRoot, iterNum);
  const completedStories = findCompletedStories(projectRoot, iterNum);
  const lastStep = tryJson(path.join(projectRoot, '.gems', 'last_step_result.json'));

  let phase = null, step = null, story = storyOpt || null;

  // 1. Try state-manager-v3 ledger
  let sm = null;
  try {
    sm = require(path.resolve(__dirname, '../task-pipe/lib/shared/state-manager-v3.cjs'));
  } catch {}

  if (sm) {
    const state = sm.readState(projectRoot, iter);
    if (state) {
      if (state.status === 'completed' || state.status === 'abandoned') {
        return { phase: 'COMPLETE', step: null, story: null, route, iter, draftPath, plannedStories, completedStories, projectRoot, reason: `${iter} ${state.status}` };
      }
      if (state.flow?.currentNode && state.flow.currentNode !== 'COMPLETE') {
        const p = sm.parseNode(state.flow.currentNode);
        phase = p.phase; step = p.step;
      }
      if (!story && state.stories) {
        story = Object.keys(state.stories).find(s => state.stories[s].status === 'in-progress')
             || Object.keys(state.stories).find(s => state.stories[s].status === 'pending') || null;
      }
      if (phase === 'SHRINK') {
        const ns = plannedStories.find(s => !completedStories.includes(s));
        if (ns) { phase = 'BUILD'; step = '1'; story = ns; }
      }
      if (phase === 'NEXT_ITER') {
        const nd = findDraft(projectRoot, iterNum + 1);
        return nd
          ? { phase: 'NEXT_ITER', step: null, story: null, route, iter, draftPath, plannedStories, completedStories, projectRoot, nextIter: `iter-${iterNum + 1}`, reason: 'next iter' }
          : { phase: 'COMPLETE', step: null, story: null, route, iter, draftPath, plannedStories, completedStories, projectRoot, reason: 'all done' };
      }
    }
  }

  // 2. last_step_result.json fallback
  if (!phase && lastStep) {
    phase = lastStep.phase || null;
    step = lastStep.step || null;
  }

  if (phase === 'BUILD' && !story) {
    story = plannedStories.find(s => !completedStories.includes(s)) || null;
  }

  // 3. Log-based inference
  if (!phase || phase === 'GATE') {
    const inferred = inferStateFromLogs(projectRoot, iterNum, plannedStories, completedStories);
    if (inferred) {
      phase = inferred.phase;
      step = inferred.step;
      if (inferred.story) story = inferred.story;
    }
  }

  // 4. Draft exists → GATE
  if (!phase && draftPath) phase = 'GATE';

  return {
    phase, step, story, route, iter, draftPath,
    plannedStories, completedStories, projectRoot,
    reason: phase ? `${sm ? 'ledger' : 'fallback'}: ${phase}${step ? '-' + step : ''}` : 'no state',
  };
}

// ─────────────────────────────────────────────────────────────
// Ensure iter directory structure
// ─────────────────────────────────────────────────────────────

function ensureIterStructure(projectRoot, iterNum) {
  const iterPath = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`);
  for (const d of ['poc', 'plan', 'build', 'logs']) {
    const dp = path.join(iterPath, d);
    if (!fs.existsSync(dp)) fs.mkdirSync(dp, { recursive: true });
  }
}

// ─────────────────────────────────────────────────────────────
// Next command builder
// ─────────────────────────────────────────────────────────────

function buildNextCommand(st) {
  const { phase, step, story, iter, draftPath, projectRoot } = st;
  const iterNum = parseInt((iter || 'iter-1').replace('iter-', ''), 10);
  const da = draftPath ? `--draft=${draftPath}` : '--draft=<draft>';
  const ta = projectRoot ? `--target=${projectRoot}` : '--target=<project>';
  if (!phase) return '(unknown)';
  switch (phase) {
    case 'GATE':       return `node sdid-tools/blueprint-gate.cjs ${da} ${ta} --iter=${iterNum}`;
    case 'CYNEFIN_CHECK': return `node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> ${ta} --iter=${iterNum}`;
    case 'PLAN':       return `node sdid-tools/draft-to-plan.cjs ${da} --iter=${iterNum} ${ta}`;
    case 'BUILD':      return story
      ? `node task-pipe/runner.cjs --phase=BUILD --step=${step || 1} --story=${story} ${ta} --iteration=${iter}`
      : `node task-pipe/runner.cjs --phase=BUILD --step=${step || 1} ${ta} --iteration=${iter}`;
    case 'SHRINK':     return `node sdid-tools/blueprint-shrink.cjs ${da} --iter=${iterNum} ${ta}`;
    case 'SCAN':       return `node task-pipe/runner.cjs --phase=SCAN ${ta} --iteration=${iter}`;
    case 'VERIFY':     return `node sdid-tools/blueprint-verify.cjs ${da} ${ta} --iter=${iterNum}`;
    case 'NEXT_ITER': {
      const ni = st.nextIter || `iter-${iterNum + 1}`;
      return `node sdid-tools/blueprint-expand.cjs ${da} --iter=${parseInt(ni.replace('iter-', ''), 10)} ${ta}`;
    }
    case 'COMPLETE':   return 'done';
    case 'POC':        return `node task-pipe/runner.cjs --phase=POC --step=${step || 1} ${ta} --iteration=${iter}`;
    default:           return `node task-pipe/runner.cjs --phase=${phase} --step=${step || 1} ${ta} --iteration=${iter}`;
  }
}

module.exports = {
  // helpers
  tryJson,
  findDraft,
  findPlannedStories,
  findCompletedStories,
  detectActiveIter,
  detectRoute,
  ensureIterStructure,
  // core
  inferStateFromLogs,
  detectFullState,
  buildNextCommand,
};
