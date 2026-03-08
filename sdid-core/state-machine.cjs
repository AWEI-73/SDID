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
  // fallback: 根目錄任意 requirement_draft*.md → 自動搬到正確路徑
  const rootFiles = fs.existsSync(projectRoot)
    ? fs.readdirSync(projectRoot).filter(f => f.startsWith('requirement_draft') && f.endsWith('.md'))
    : [];
  if (rootFiles.length) {
    const canonical = path.join(pocDir, `requirement_draft_iter-${iterNum}.md`);
    if (!fs.existsSync(pocDir)) fs.mkdirSync(pocDir, { recursive: true });
    fs.copyFileSync(path.join(projectRoot, rootFiles[0]), canonical);
    console.warn(`[findDraft] 自動搬移 ${rootFiles[0]} → .gems/iterations/iter-${iterNum}/poc/requirement_draft_iter-${iterNum}.md`);
    return canonical;
  }
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
 * 偵測指定迭代走哪條路線（per-iter 判斷，不跨迭代污染）
 *
 * 規則：只看 active iter 的 poc/ 目錄
 *   - poc-consolidation-log.md → POC-FIX
 *   - requirement_spec_*       → Task-Pipe
 *   - requirement_draft_*      → Blueprint
 *
 * @param {string} projectRoot
 * @param {string} [iter] - 如 'iter-2'，省略則自動偵測 active iter
 * @returns {'Blueprint'|'Task-Pipe'|'POC-FIX'|'Unknown'}
 */
function detectRoute(projectRoot, iter) {
  const activeIter = iter || detectActiveIter(projectRoot);
  const iterNum = parseInt(activeIter.replace('iter-', ''), 10);

  // POC-FIX：consolidation log 存在
  const pocDir0 = path.join(projectRoot, '.gems', 'iterations', activeIter, 'poc');
  if (fs.existsSync(path.join(pocDir0, 'poc-consolidation-log.md'))) return 'POC-FIX';
  if (fs.existsSync(path.join(projectRoot, '.gems', 'poc-consolidation-log.md'))) return 'POC-FIX';

  // 往前掃所有 iter（含當前），找到第一個有 poc 文件的 iter 來判斷路線
  for (let i = iterNum; i >= 1; i--) {
    const pocDir = path.join(projectRoot, '.gems', 'iterations', `iter-${i}`, 'poc');
    if (!fs.existsSync(pocDir)) continue;
    const files = fs.readdirSync(pocDir);
    // Task-Pipe：有 spec（POC Step 5 產物）
    if (files.some(f => f.startsWith('requirement_spec_'))) return 'Task-Pipe';
    // Blueprint：有 draft 但沒有 spec
    if (files.some(f => f.startsWith('requirement_draft_'))) return 'Blueprint';
  }

  // 舊路徑相容
  if (fs.existsSync(path.join(projectRoot, 'requirement-spec.md'))) return 'Task-Pipe';
  if (fs.existsSync(path.join(projectRoot, 'requirement-draft.md'))) return 'Blueprint';

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

  // POC log 識別 — Task-Pipe 路線
  // poc-step-N-pass → 下一個 step，poc-step-5-pass → PLAN（機械轉換）
  // poc-spec-to-plan-pass → BUILD（spec-to-plan 完成，直接進 BUILD）
  const pocPassLogs = logs.filter(f => /^poc-step-\d+-pass-/.test(f));

  // spec-to-plan 完成 → 直接進 BUILD
  if (has('poc-spec-to-plan-pass-')) {
    return { phase: 'BUILD', step: '1', story: plannedStories[0] || null };
  }

  if (pocPassLogs.length > 0) {
    const maxPocStep = Math.max(...pocPassLogs.map(f => {
      const m = f.match(/^poc-step-(\d+)-pass-/);
      return m ? parseInt(m[1]) : 0;
    }));
    if (maxPocStep >= 5) {
      return { phase: 'PLAN', step: null, story: null };
    }
    return { phase: 'POC', step: String(maxPocStep + 1), story: null };
  }
  // poc-step-N-fix/error → 重試同一個 step
  const pocErrorLogs = logs.filter(f => /^poc-step-\d+-(fix|error)-/.test(f));
  if (pocErrorLogs.length > 0 && pocPassLogs.length === 0) {
    const maxPocStep = Math.max(...pocErrorLogs.map(f => {
      const m = f.match(/^poc-step-(\d+)-/);
      return m ? parseInt(m[1]) : 1;
    }));
    return { phase: 'POC', step: String(maxPocStep), story: null };
  }

  // PLAN log 識別 — Task-Pipe 路線
  const planPassLogs = logs.filter(f => /^plan-step-\d+-pass-/.test(f));
  if (planPassLogs.length > 0) {
    const maxPlanStep = Math.max(...planPassLogs.map(f => {
      const m = f.match(/^plan-step-(\d+)-pass-/);
      return m ? parseInt(m[1]) : 0;
    }));
    if (maxPlanStep >= 5) {
      return { phase: 'BUILD', step: '1', story: plannedStories[0] || null };
    }
    return { phase: 'PLAN', step: String(maxPlanStep + 1), story: null };
  }
  const planErrorLogs = logs.filter(f => /^plan-step-\d+-(fix|error)-/.test(f));
  if (planErrorLogs.length > 0 && planPassLogs.length === 0) {
    const maxPlanStep = Math.max(...planErrorLogs.map(f => {
      const m = f.match(/^plan-step-(\d+)-/);
      return m ? parseInt(m[1]) : 1;
    }));
    return { phase: 'PLAN', step: String(maxPlanStep), story: null };
  }

  if (has('gate-verify-pass-')) {
    // Blueprint Flow: verify pass → 檢查 iterationPlan 是否還有 [STUB] 的 iter
    // 如果有，回傳 COMPLETE（loop 的 COMPLETE 處理會讀 iterationPlan 並輸出 expand 指令）
    // 如果沒有，也回傳 COMPLETE（loop 會輸出真正完成訊號）
    return { phase: 'COMPLETE', step: null, story: null };
  }

  // Blueprint Flow: gate-expand-pass 存在 → expand 完成，下一步是重新 GATE
  // （gate-expand-pass 由 blueprint-expand.cjs 存在新 iter 的 logs/）
  if (has('gate-expand-pass-')) {
    if (!has('gate-check-pass-')) {
      return { phase: 'GATE', step: null, story: null };
    }
    // expand 後已有 gate-check-pass，繼續正常流程（cynefin → contract → plan → build）
    // 讓下面的 gate-check-pass 邏輯接手
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
        : { phase: 'VERIFY', step: null, story: null }; // SHRINK 已移為可選工具，BUILD 完直接進 VERIFY/SCAN
    }
    return { phase: 'BUILD', step: String(maxPhase + 1), story: latestStory };
  }

  if (has('gate-plan-pass-')) {
    return { phase: 'BUILD', step: '1', story: plannedStories[0] || null };
  }
  if (has('gate-check-pass-')) {
    // Cynefin Gate: GATE @PASS 後必須有 cynefin-check-pass 才能進 CONTRACT
    if (!has('cynefin-check-pass-')) {
      return { phase: 'CYNEFIN_CHECK', step: null, story: null };
    }
    // Contract Gate: cynefin-check-pass 後必須有 contract-pass 才能進 PLAN
    if (!has('contract-pass-')) {
      return { phase: 'CONTRACT', step: null, story: null };
    }
    // contract.ts 比最新 contract-pass log 新 → contract 已變動，需重新 gate
    const contractFile = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'poc', `contract_iter-${iterNum}.ts`);
    if (fs.existsSync(contractFile)) {
      const contractMtime = fs.statSync(contractFile).mtimeMs;
      const passLogs = logs.filter(f => f.startsWith('contract-pass-')).sort();
      const latestPassLog = passLogs[passLogs.length - 1];
      if (latestPassLog) {
        const logMtime = fs.statSync(path.join(logsDir, latestPassLog)).mtimeMs;
        if (contractMtime > logMtime) {
          return { phase: 'CONTRACT', step: null, story: null, contractDirty: true };
        }
      }
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
  const route = detectRoute(projectRoot, iter);
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
      // SHRINK 已移為可選工具，不再是強制節點，若 .state.json 殘留 SHRINK 狀態則直接跳 VERIFY
      if (phase === 'SHRINK') {
        const ns = plannedStories.find(s => !completedStories.includes(s));
        if (ns) { phase = 'BUILD'; step = '1'; story = ns; }
        else { phase = 'VERIFY'; step = null; }
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
  const { phase, step, story, iter, draftPath, projectRoot, route } = st;
  const iterNum = parseInt((iter || 'iter-1').replace('iter-', ''), 10);
  const da = draftPath ? `--draft=${draftPath}` : null;
  const ta = projectRoot ? `--target=${projectRoot}` : '--target=<project>';
  if (!phase) return '(unknown)';
  switch (phase) {
    case 'GATE':       return `node sdid-tools/blueprint-gate.cjs ${da || '--draft=<draft>'} ${ta} --iter=${iterNum}`;
    case 'CYNEFIN_CHECK': return `node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> ${ta} --iter=${iterNum}`;
    case 'CONTRACT': {
      const contractPath = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'poc', `contract_iter-${iterNum}.ts`);
      return `node sdid-tools/blueprint-contract-writer.cjs --contract=${contractPath} ${ta} --iter=${iterNum}`;
    }
    case 'PLAN': {
      if (route === 'Task-Pipe') {
        return `node task-pipe/tools/spec-to-plan.cjs --target=${ta.replace('--target=', '')} --iteration=${iter || `iter-${iterNum}`}`;
      }
      const draftArg = da ? `${da} ` : '';
      return `node sdid-tools/draft-to-plan.cjs ${draftArg}--iter=${iterNum} ${ta}`;
    }
    case 'BUILD':      return story
      ? `node task-pipe/runner.cjs --phase=BUILD --step=${step || 1} --story=${story} ${ta} --iteration=${iter}`
      : `node task-pipe/runner.cjs --phase=BUILD --step=${step || 1} ${ta} --iteration=${iter}`;
    case 'SHRINK':     return `node sdid-tools/blueprint-shrink.cjs ${da || '--draft=<draft>'} --iter=${iterNum} ${ta}`;
    case 'SCAN':       return `node task-pipe/runner.cjs --phase=SCAN ${ta} --iteration=${iter}`;
    case 'VERIFY':     return `node sdid-tools/blueprint-verify.cjs ${da || '--draft=<draft>'} ${ta} --iter=${iterNum}`;
    case 'NEXT_ITER': {
      const ni = st.nextIter || `iter-${iterNum + 1}`;
      return `node sdid-tools/blueprint-expand.cjs ${da || '--draft=<draft>'} --iter=${parseInt(ni.replace('iter-', ''), 10)} ${ta}`;
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
