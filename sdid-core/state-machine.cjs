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

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const SKILL_PATHS = {
  designReviewSkill: path.join('.agent', 'skills', 'design-review', 'SKILL.md'),
  designReviewOverview: path.join('.agent', 'skills', 'design-review', 'references', 'review-overview.md'),
  gateBlueprint: path.join('.agent', 'skills', 'design-review', 'references', 'gate-blueprint.md'),
  gateDraft: path.join('.agent', 'skills', 'design-review', 'references', 'gate-draft.md'),
  gateContract: path.join('.agent', 'skills', 'design-review', 'references', 'gate-contract.md'),
  planWriter: path.join('.agent', 'skills', 'sdid', 'references', 'plan-writer.md'),
  planReviewerPrompt: path.join('.agent', 'skills', 'superpowers', 'writing-plans', 'plan-document-reviewer-prompt.md'),
};

// ─────────────────────────────────────────────────────────────
// 基礎 helpers
// ─────────────────────────────────────────────────────────────

function tryJson(fp) {
  if (!fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

function safeStatMtimeMs(fp) {
  try {
    return fs.statSync(fp).mtimeMs;
  } catch {
    return null;
  }
}

function safeReadText(fp) {
  try {
    return fs.readFileSync(fp, 'utf8');
  } catch {
    return '';
  }
}

function resolveWorkspacePath(relPath) {
  return path.resolve(WORKSPACE_ROOT, relPath);
}

function getSkillCheckpointFile(projectRoot, iterNum) {
  return path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, '.skill-checkpoints.json');
}

function readSkillCheckpointReads(projectRoot, iterNum) {
  const raw = tryJson(getSkillCheckpointFile(projectRoot, iterNum));
  if (!raw || !Array.isArray(raw.reads)) return [];
  return raw.reads.filter(Boolean);
}

function hasValidSkillCheckpoint(reads, skillPath, artifactPath, artifactMtimeMs, reportPath) {
  const resolvedSkill = resolveWorkspacePath(skillPath);
  const resolvedArtifact = path.resolve(artifactPath);
  const resolvedReport = path.resolve(reportPath);
  return reads.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if (!entry.skillPath || !entry.artifactPath) return false;
    const entrySkill = path.isAbsolute(entry.skillPath) ? path.resolve(entry.skillPath) : resolveWorkspacePath(entry.skillPath);
    const sameSkill = entrySkill === resolvedSkill;
    const sameArtifact = path.resolve(entry.artifactPath) === resolvedArtifact;
    const sameArtifactVersion = Number(entry.artifactMtimeMs) === Number(artifactMtimeMs);
    const sameReport = !entry.reportPath || path.resolve(entry.reportPath) === resolvedReport;
    return sameSkill && sameArtifact && sameArtifactVersion && sameReport;
  });
}

function buildReviewRequirement(projectRoot, iterNum, kind, phase, artifactPath, reportPath, skillPaths, extra = {}) {
  const checkpointPath = getSkillCheckpointFile(projectRoot, iterNum);
  const artifactMtimeMs = safeStatMtimeMs(artifactPath);
  const reportExists = fs.existsSync(reportPath);
  const reportMtimeMs = safeStatMtimeMs(reportPath);
  const reportContent = reportExists ? safeReadText(reportPath) : '';
  const reportHasPass = /@PASS\b/.test(reportContent);
  const reportIsFresh = Boolean(reportExists && artifactMtimeMs && reportMtimeMs && reportMtimeMs >= artifactMtimeMs);
  const reads = readSkillCheckpointReads(projectRoot, iterNum);
  const missingSkillPaths = skillPaths.filter((skillPath) =>
    !hasValidSkillCheckpoint(reads, skillPath, artifactPath, artifactMtimeMs, reportPath)
  );
  const missing = [];
  if (missingSkillPaths.length > 0) missing.push('skill-read');
  if (!reportExists) missing.push('report');
  if (reportExists && !reportHasPass) missing.push('report-pass');
  if (reportExists && !reportIsFresh) missing.push('stale-report');
  return {
    kind,
    phase,
    projectRoot,
    iterNum,
    artifactPath,
    artifactMtimeMs,
    reportPath,
    checkpointPath,
    skillPaths,
    resolvedSkillPaths: skillPaths.map((skillPath) => resolveWorkspacePath(skillPath)),
    missingSkillPaths,
    missing,
    satisfied: missing.length === 0,
    reportExists,
    reportHasPass,
    reportIsFresh,
    ...extra,
  };
}

function buildRouteRequirements(projectRoot, iterNum, state) {
  const reqs = [];
  const { phase, story, draftPath, blueprintPath, contractPath, plannedStories, completedStories } = state;
  const reviewsDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'reviews');

  if (blueprintPath && !draftPath && (!phase || phase === 'NO_DRAFT')) {
    reqs.push(buildReviewRequirement(
      projectRoot,
      iterNum,
      'blueprint-design-review',
      'BLUEPRINT-REVIEW',
      blueprintPath,
      path.join(reviewsDir, `blueprint-design-review_iter-${iterNum}.md`),
      [SKILL_PATHS.designReviewSkill, SKILL_PATHS.designReviewOverview, SKILL_PATHS.gateBlueprint],
      { blockerCode: 'REQUIRED_BLUEPRINT_REVIEW', artifactLabel: `blueprint_iter-${iterNum}` }
    ));
  }

  if (draftPath && !contractPath && phase !== 'NO_DRAFT' && phase !== 'COMPLETE') {
    reqs.push(buildReviewRequirement(
      projectRoot,
      iterNum,
      'draft-design-review',
      'DESIGN-REVIEW',
      draftPath,
      path.join(reviewsDir, `draft-design-review_iter-${iterNum}.md`),
      [SKILL_PATHS.designReviewSkill, SKILL_PATHS.designReviewOverview, SKILL_PATHS.gateDraft],
      { blockerCode: 'REQUIRED_DRAFT_REVIEW', artifactLabel: `draft_iter-${iterNum}` }
    ));
  }

  if (contractPath && plannedStories.length === 0 && phase !== 'COMPLETE') {
    reqs.push(buildReviewRequirement(
      projectRoot,
      iterNum,
      'contract-design-review',
      'CONTRACT-DESIGN-REVIEW',
      contractPath,
      path.join(reviewsDir, `contract-design-review_iter-${iterNum}.md`),
      [SKILL_PATHS.designReviewSkill, SKILL_PATHS.designReviewOverview, SKILL_PATHS.gateContract],
      { blockerCode: 'REQUIRED_CONTRACT_REVIEW', artifactLabel: `contract_iter-${iterNum}.ts` }
    ));
  }

  const activePlanStory = story || plannedStories.find(s => !completedStories.includes(s)) || plannedStories[0] || null;
  if (['PLAN_GATE', 'IMPLEMENTATION_READY', 'BUILD', 'SCAN', 'VERIFY'].includes(phase) && activePlanStory) {
    const planPath = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'plan', `implementation_plan_${activePlanStory}.md`);
    if (fs.existsSync(planPath)) {
      reqs.push(buildReviewRequirement(
        projectRoot,
        iterNum,
        'plan-review',
        'PLAN-REVIEW',
        planPath,
        path.join(reviewsDir, `plan-review_${activePlanStory}.md`),
        [SKILL_PATHS.planWriter, SKILL_PATHS.planReviewerPrompt],
        { blockerCode: 'REQUIRED_PLAN_REVIEW', artifactLabel: `implementation_plan_${activePlanStory}.md`, story: activePlanStory }
      ));
    }
  }

  return reqs;
}

function buildRouteBlocker(requirement) {
  if (!requirement || requirement.satisfied) return null;
  const missingLabels = [];
  if (requirement.missing.includes('skill-read')) missingLabels.push('skill checkpoint');
  if (requirement.missing.includes('report')) missingLabels.push('review report');
  if (requirement.missing.includes('report-pass')) missingLabels.push('report @PASS');
  if (requirement.missing.includes('stale-report')) missingLabels.push('fresh report for current artifact');
  return {
    code: requirement.blockerCode || 'REQUIRED_SKILL_REVIEW',
    kind: requirement.kind,
    phase: requirement.phase,
    artifactPath: requirement.artifactPath,
    reportPath: requirement.reportPath,
    checkpointPath: requirement.checkpointPath,
    requiredSkillPaths: requirement.skillPaths,
    resolvedSkillPaths: requirement.resolvedSkillPaths,
    missingSkillPaths: requirement.missingSkillPaths,
    missing: requirement.missing,
    message: `Blocked until ${requirement.kind} is completed: ${missingLabels.join(', ')}`,
    suggestedCommand: `node sdid-tools/review-proof.cjs --project="${requirement.projectRoot}" --iter=${requirement.iterNum}${requirement.story ? ` --story=${requirement.story}` : ''} --kind=${requirement.kind}`,
  };
}

function applyRouteEnforcement(projectRoot, state) {
  const iter = state.iter || state.iteration || 'iter-1';
  const iterNum = parseInt(iter.replace('iter-', ''), 10);
  const normalized = {
    ...state,
    iter,
    projectRoot,
    plannedStories: state.plannedStories || [],
    completedStories: state.completedStories || [],
  };
  const requiredSkillReads = buildRouteRequirements(projectRoot, iterNum, normalized);
  const routeBlocker = buildRouteBlocker(requiredSkillReads.find((req) => !req.satisfied) || null);
  return {
    ...normalized,
    requiredSkillReads,
    routeBlocker,
  };
}

/**
 * 找到 design/ 下的 draft_iter-N.md（v6 新結構）
 * v6: 所有設計文件集中在 {project}/.gems/design/
 * @returns {string|null} 絕對路徑
 */
function findDraftV6(projectRoot, iterNum) {
  const designDir = path.join(projectRoot, '.gems', 'design');
  if (!fs.existsSync(designDir)) return null;
  const candidate = path.join(designDir, `draft_iter-${iterNum}.md`);
  if (fs.existsSync(candidate)) return candidate;
  return null;
}

/**
 * 找到 design/ 下的 blueprint.md（v6，可選）
 * @returns {string|null} 絕對路徑
 */
function findBlueprint(projectRoot) {
  const bp = path.join(projectRoot, '.gems', 'design', 'blueprint.md');
  return fs.existsSync(bp) ? bp : null;
}

/**
 * 找到 iter-N/ 下的 contract_iter-N.ts（v6：contract 屬於 iter）
 * @returns {string|null} 絕對路徑
 */
function findContractV6(projectRoot, iterNum) {
  const candidate = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, `contract_iter-${iterNum}.ts`);
  return fs.existsSync(candidate) ? candidate : null;
}

/**
 * 找到 design/ 下的 poc_iter-N.html（v6，可選）
 * @returns {string|null} 絕對路徑
 */
function findPocHtml(projectRoot, iterNum) {
  const candidate = path.join(projectRoot, '.gems', 'design', `poc_iter-${iterNum}.html`);
  return fs.existsSync(candidate) ? candidate : null;
}

/**
 * 找到 iter-N/poc-fix/ 下的 consolidation-log.md（poc-fix 工作區）
 * @returns {string|null} 絕對路徑
 */
function findPocFixLog(projectRoot, iterNum) {
  const candidate = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'poc-fix', 'consolidation-log.md');
  return fs.existsSync(candidate) ? candidate : null;
}

/**
 * 找到 iter-N/poc-fix/ 目錄（poc-fix 工作區存在）
 * @returns {boolean}
 */
function hasPocFixDir(projectRoot, iterNum) {
  return fs.existsSync(path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'poc-fix'));
}

/**
 * 找到 draft（v6 優先，fallback 到 v5 legacy）
 * @returns {string|null} 絕對路徑
 */
function findDraft(projectRoot, iterNum) {
  // v6: design/draft_iter-N.md
  const v6 = findDraftV6(projectRoot, iterNum);
  if (v6) return v6;
  // v5 legacy fallback: iter-N/poc/draft_iter-N.md 或 requirement_draft_iter-N.md
  const pocDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'poc');
  if (fs.existsSync(pocDir)) {
    const drafts = fs.readdirSync(pocDir).filter(f => f.startsWith('draft_iter-') || f.startsWith('requirement_draft_'));
    if (drafts.length) return path.join(pocDir, drafts[0]);
  }
  // fallback: 根目錄任意 requirement_draft*.md → 自動搬到正確路徑
  const rootFiles = fs.existsSync(projectRoot)
    ? fs.readdirSync(projectRoot).filter(f => f.startsWith('requirement_draft') && f.endsWith('.md'))
    : [];
  if (rootFiles.length) {
    const designDir = path.join(projectRoot, '.gems', 'design');
    const canonical = path.join(designDir, `draft_iter-${iterNum}.md`);
    if (!fs.existsSync(designDir)) fs.mkdirSync(designDir, { recursive: true });
    fs.copyFileSync(path.join(projectRoot, rootFiles[0]), canonical);
    console.warn(`[findDraft] 自動搬移 ${rootFiles[0]} → .gems/design/draft_iter-${iterNum}.md`);
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
 * 找到 iter-N/build/ 下已完成的 Story
 *
 * Canonical marker: phase4-done_Story-X.Y（Build Phase 4 全部 gate 通過後寫入）
 * Legacy fallback:  Fillback_Story-X.Y.md（舊版 Phase 4 產物，已升級為 VERIFY 後的 artifact）
 *
 * @returns {string[]} 排序後的 Story ID 列表
 */
function findCompletedStories(projectRoot, iterNum) {
  const buildDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'build');
  if (!fs.existsSync(buildDir)) return [];
  const files = fs.readdirSync(buildDir);
  // Canonical: phase4-done_Story-X.Y
  const phase4Done = files
    .filter(f => f.startsWith('phase4-done_'))
    .map(f => { const m = f.match(/Story-(\d+\.\d+)/); return m ? `Story-${m[1]}` : null; })
    .filter(Boolean);
  if (phase4Done.length > 0) return phase4Done.sort();
  // Legacy fallback: Fillback_Story-X.Y.md (pre-v9 projects)
  return files
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
 * 偵測指定迭代走哪條路線（per-iter 判斷）
 *
 * v6 規則（優先）：
 *   .gems/design/ 存在 → v6 流程
 *     blueprint.md 存在 → Blueprint（有全局索引）
 *     draft_iter-N.md 存在 → Draft-only（無 blueprint）
 *
 * v5 legacy fallback：
 *   poc-consolidation-log.md → POC-FIX
 *   requirement_spec_*       → LegacySpec（deprecated，不再作為有效主流程 route）
 *   requirement_draft_*      → Blueprint
 *
 * @param {string} projectRoot
 * @param {string} [iter] - 如 'iter-2'，省略則自動偵測 active iter
 * @returns {'Blueprint'|'LegacySpec'|'POC-FIX'|'Unknown'}
 */
function detectRoute(projectRoot, iter) {
  const activeIter = iter || detectActiveIter(projectRoot);
  const iterNum = parseInt(activeIter.replace('iter-', ''), 10);

  // v6: design/ 存在 → 新流程
  const designDir = path.join(projectRoot, '.gems', 'design');
  if (fs.existsSync(designDir)) {
    // blueprint.md 存在 → Blueprint（有全局索引，可批次設計多 iter）
    if (fs.existsSync(path.join(designDir, 'blueprint.md'))) return 'Blueprint';
    // draft_iter-N.md 存在 → Draft-only（無 blueprint，直接從 draft 開始）
    if (fs.existsSync(path.join(designDir, `draft_iter-${iterNum}.md`))) return 'Blueprint';
    return 'Unknown';
  }

  // v5 legacy fallback
  const pocDir0 = path.join(projectRoot, '.gems', 'iterations', activeIter, 'poc');
  if (fs.existsSync(path.join(pocDir0, 'poc-consolidation-log.md'))) return 'POC-FIX';
  if (fs.existsSync(path.join(projectRoot, '.gems', 'poc-consolidation-log.md'))) return 'POC-FIX';

  for (let i = iterNum; i >= 1; i--) {
    const pocDir = path.join(projectRoot, '.gems', 'iterations', `iter-${i}`, 'poc');
    if (!fs.existsSync(pocDir)) continue;
    const files = fs.readdirSync(pocDir);
    if (files.some(f => f.startsWith('requirement_spec_'))) return 'LegacySpec'; // deprecated — not an active route
    if (files.some(f => f.startsWith('requirement_draft_') || f.startsWith('draft_iter-'))) return 'Blueprint';
  }

  if (fs.existsSync(path.join(projectRoot, 'requirement-spec.md'))) return 'LegacySpec'; // deprecated — not an active route
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
/** GEMS: inferStateFromLogs | P0 | readLogsDir(IO)→matchPrefixes(Pure)→resolvePhase(Pure)→RETURN:StateResult | Story-1.0 */
function inferStateFromLogs(projectRoot, iterNum, plannedStories, completedStories) {
  const logsDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
  if (!fs.existsSync(logsDir)) return null;

  const legacyLogRegex = /^(pocfix-|poc-step-|gate-microfix-pass-|poc-spec-to-plan-pass-)/;
  const rawLogs = fs.readdirSync(logsDir).sort();
  const logs = rawLogs.filter((file) => !legacyLogRegex.test(file)).sort();
  const has = (prefix) => logs.some(f => f.startsWith(prefix));
  const hasLegacy = (prefix) => rawLogs.some(f => f.startsWith(prefix));

  // POC-FIX 進行中 / 完成判斷（v6: pocfix- 前綴）
  if (hasLegacy('pocfix-active-')) {
    return { phase: 'POC-FIX', step: null, story: null };
  }
  if (hasLegacy('pocfix-pass-')) {
    // poc-fix 完成，回主流程（繼續 BUILD 或 CONTRACT）
    const hasSubsequentBuild = rawLogs.some(f => f.startsWith('build-phase-'));
    if (!hasSubsequentBuild) {
      // poc-fix 完成但還沒進 BUILD → 回到 CONTRACT 或 BUILD 起點
      const hasContract = has('contract-gate-pass-') || has('contract-pass-');
      const hasImplReady = has('gate-implementation-ready-pass-');
      const hasPlan = has('gate-plan-pass-');
      if (hasImplReady) return { phase: 'BUILD', step: '1', story: plannedStories[0] || null };
      if (hasPlan) return { phase: 'IMPLEMENTATION_READY', step: null, story: plannedStories[0] || null };
      if (plannedStories.length > 0) return { phase: 'PLAN_GATE', step: null, story: plannedStories[0] || null };
      if (hasContract) return { phase: 'PLAN', step: null, story: null };
      return { phase: 'CONTRACT', step: null, story: null };
    }
  }

  // POC-FIX / MICRO-FIX 完成判斷（v5 legacy）
  if (hasLegacy('gate-microfix-pass-')) {
    // 如果之後沒有更高優先的 log（如 build-phase），視為完成
    const hasSubsequentBuild = rawLogs.some(f => f.startsWith('build-phase-'));
    if (!hasSubsequentBuild) {
      return { phase: 'COMPLETE', step: null, story: null };
    }
  }

  // POC log 識別 — v5 legacy 路線（只在沒有 gate-check-pass 時才走此路線）
  // 有 gate-check-pass 代表已進入 Blueprint 流程，poc-step log 是舊殘留，忽略
  const pocPassLogs = has('gate-check-pass-') ? [] : rawLogs.filter(f => /^poc-step-\d+-pass-/.test(f));

  // spec-to-plan generated plan skeletons -> PLAN_GATE, never directly BUILD
  if (has('plan-generate-pass-') || hasLegacy('poc-spec-to-plan-pass-')) {
    return plannedStories.length > 0
      ? { phase: 'PLAN_GATE', step: null, story: plannedStories[0] || null }
      : { phase: 'PLAN', step: null, story: null };
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
  // poc-step-N-fix/error → 重試同一個 step（同樣只在無 gate-check-pass 時）
  const pocErrorLogs = has('gate-check-pass-') ? [] : rawLogs.filter(f => /^poc-step-\d+-(fix|error)-/.test(f));
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
    return { phase: 'COMPLETE', step: null, story: null };
  }

  // SCAN pass (log prefix: scan-scan-pass-) → VERIFY
  if (has('scan-scan-pass-')) {
    return { phase: 'VERIFY', step: null, story: null };
  }

  if (has('gate-implementation-ready-pass-')) {
    return { phase: 'BUILD', step: '1', story: plannedStories[0] || null };
  }

  // gate-expand-pass 向後相容（舊專案可能有此 log）
  if (has('gate-expand-pass-')) {
    if (!has('gate-check-pass-')) {
      return { phase: 'GATE', step: null, story: null };
    }
  }

  if (has('gate-shrink-pass-')) {
    const allDone = plannedStories.length > 0 && plannedStories.every(s => completedStories.includes(s));
    // SHRINK 已移為可選工具；SHRINK pass → SCAN → VERIFY
    if (allDone) return { phase: 'SCAN', step: null, story: null };
    const next = plannedStories.find(s => !completedStories.includes(s));
    return next
      ? { phase: 'BUILD', step: '1', story: next }
      : { phase: 'SCAN', step: null, story: null };
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
    if (maxPhase >= 4) {
      const next = plannedStories.find(s => !completedStories.includes(s));
      return next
        ? { phase: 'BUILD', step: '1', story: next }
        // All stories done → SCAN (build functions.json / project cache)
        // VERIFY follows after scan-scan-pass- log is detected (see above)
        : { phase: 'SCAN', step: null, story: null };
    }
    return { phase: 'BUILD', step: String(maxPhase + 1), story: latestStory };
  }

  if (has('gate-plan-pass-')) {
    return { phase: 'IMPLEMENTATION_READY', step: null, story: plannedStories[0] || null };
  }
  if (plannedStories.length > 0) {
    return { phase: 'PLAN_GATE', step: null, story: plannedStories[0] || null };
  }
  if (has('gate-check-pass-')) {
    // draft-gate @PASS → 直接進 CONTRACT（CYNEFIN 只是 Blueprint 內部分析工具，不是 gate）
    if (!has('contract-pass-') && !has('contract-gate-pass-')) {
      return { phase: 'CONTRACT', step: null, story: null };
    }
    // contract.ts 比最新 contract-pass log 新 → contract 已變動，需重新 gate
    // v6: contract 在 iter-N/ 下
    const contractFile = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, `contract_iter-${iterNum}.ts`);
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
    // contract-pass 後直接進 PLAN（SPEC 層已消除，contract 是單一規格來源）
    return plannedStories.length > 0
      ? { phase: 'PLAN_GATE', step: null, story: plannedStories[0] || null }
      : { phase: 'PLAN', step: null, story: null };
  }

  // error logs → retry same phase
  if (has('gate-check-error-')) return { phase: 'GATE', step: null, story: null, hasError: true };
  if (has('gate-plan-error-')) return { phase: 'PLAN_GATE', step: null, story: plannedStories[0] || null, hasError: true };
  if (has('gate-implementation-ready-error-')) return { phase: 'IMPLEMENTATION_READY', step: null, story: plannedStories[0] || null, hasError: true };

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
/** GEMS: detectFullState | P0 | detectRoute(Clear)→resolvePaths(Complicated)→inferStateFromLogs(Complicated)→RETURN:FullState | Story-1.0 */
function detectFullState(projectRoot, iter, storyOpt) {
  const iterNum = parseInt(iter.replace('iter-', ''), 10);
  const route = detectRoute(projectRoot, iter);
  const draftPath = findDraft(projectRoot, iterNum);
  const blueprintPath = findBlueprint(projectRoot);
  const contractPath = findContractV6(projectRoot, iterNum);
  const pocHtmlPath = findPocHtml(projectRoot, iterNum);
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
      // flow.currentNode === 'COMPLETE' も COMPLETE として扱う
      if (state.flow?.currentNode === 'COMPLETE') {
        return { phase: 'COMPLETE', step: null, story: null, route, iter, draftPath, plannedStories, completedStories, projectRoot, reason: `${iter} flow.currentNode=COMPLETE` };
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
      // NEXT_ITER 已 deprecated（expand 不再使用），直接視為 COMPLETE
      if (phase === 'NEXT_ITER') {
        phase = 'COMPLETE'; step = null;
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

  const routeState = {
    phase, step, story, route, iter, draftPath,
    blueprintPath, contractPath, pocHtmlPath,
    plannedStories, completedStories, projectRoot,
  };
  return applyRouteEnforcement(projectRoot, {
    ...routeState,
    reason: phase ? `${sm ? 'ledger' : 'fallback'}: ${phase}${step ? '-' + step : ''}` : 'no state',
  });
}

// ─────────────────────────────────────────────────────────────
// Ensure iter directory structure
// ─────────────────────────────────────────────────────────────

function ensureIterStructure(projectRoot, iterNum) {
  const iterPath = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`);
  // v6: poc/ 不再建立（設計文件集中在 .gems/design/）
  // poc-fix/ 按需建立，不預建
  for (const d of ['plan', 'build', 'logs']) {
    const dp = path.join(iterPath, d);
    if (!fs.existsSync(dp)) fs.mkdirSync(dp, { recursive: true });
  }
  // 確保 design/ 目錄存在（v6 設計文件集中地）
  const designDir = path.join(projectRoot, '.gems', 'design');
  if (!fs.existsSync(designDir)) fs.mkdirSync(designDir, { recursive: true });
}

// ─────────────────────────────────────────────────────────────
// Next command builder
// ─────────────────────────────────────────────────────────────

function buildNextCommand(st) {
  const { phase, step, story, iter, draftPath, contractPath, projectRoot, route } = st;
  const iterNum = parseInt((iter || 'iter-1').replace('iter-', ''), 10);
  const da = draftPath ? `--draft=${draftPath}` : null;
  const ta = projectRoot ? `--target=${projectRoot}` : '--target=<project>';
  if (!phase) return '(unknown)';
  switch (phase) {
    case 'GATE':
    case 'DRAFT_GATE': {
      // v6: draft 在 design/，blueprint 可選
      const bp = findBlueprint(projectRoot);
      const draft = draftPath || `<project>/.gems/design/draft_iter-${iterNum}.md`;
      return bp
        ? `node sdid-tools/blueprint/v5/draft-gate.cjs --draft=${draft} --blueprint=${bp} --target=${projectRoot}`
        : `node sdid-tools/blueprint/v5/draft-gate.cjs --draft=${draft} --target=${projectRoot}`;
    }
    case 'BLUEPRINT_GATE':
      return `node sdid-tools/blueprint/v5/blueprint-gate.cjs --blueprint=${findBlueprint(projectRoot) || '<blueprint>'} --target=${projectRoot}`;
    case 'CONTRACT': {
      const cp = contractPath || `<project>/.gems/iterations/iter-${iterNum}/contract_iter-${iterNum}.ts`;
      const bp = findBlueprint(projectRoot);
      return bp
        ? `node sdid-tools/blueprint/v5/contract-gate.cjs --contract=${cp} --target=${projectRoot} --iter=${iterNum} --blueprint=${bp}`
        : `node sdid-tools/blueprint/v5/contract-gate.cjs --contract=${cp} --target=${projectRoot} --iter=${iterNum}`;
    }
    // CYNEFIN_CHECK removed — not a flow phase; Cynefin is Blueprint-internal analysis only
    case 'PLAN': {
      return `node task-pipe/tools/spec-to-plan.cjs --target=${ta.replace('--target=', '')} --iteration=${iter || `iter-${iterNum}`}`;
    }
    case 'PLAN_GATE': {
      return `node task-pipe/tools/plan-gate.cjs --target=${ta.replace('--target=', '')} --iteration=${iter || `iter-${iterNum}`}`;
    }
    case 'IMPLEMENTATION_READY': {
      return `node task-pipe/tools/implementation-ready-gate.cjs --target=${ta.replace('--target=', '')} --iteration=${iter || `iter-${iterNum}`}`;
    }
    case 'BUILD':      return story
      ? `node task-pipe/runner.cjs --phase=BUILD --step=${step || 1} --story=${story} ${ta} --iteration=${iter}`
      : `node task-pipe/runner.cjs --phase=BUILD --step=${step || 1} ${ta} --iteration=${iter}`;
    case 'SCAN':       return `node task-pipe/runner.cjs --phase=SCAN ${ta} --iteration=${iter}`;
    case 'VERIFY':     return `node sdid-tools/blueprint/verify.cjs ${da || '--draft=<draft>'} ${ta} --iter=${iterNum}`;
    case 'COMPLETE':   return 'done';
    default:           return `node task-pipe/runner.cjs --phase=${phase} --step=${step || 1} ${ta} --iteration=${iter}`;
  }
}

module.exports = {
  // helpers
  tryJson,
  findDraft,
  findDraftV6,
  findBlueprint,
  findContractV6,
  findPocHtml,
  findPocFixLog,
  hasPocFixDir,
  findPlannedStories,
  findCompletedStories,
  detectActiveIter,
  detectRoute,
  ensureIterStructure,
  getSkillCheckpointFile,
  applyRouteEnforcement,
  // core
  inferStateFromLogs,
  detectFullState,
  buildNextCommand,
};
