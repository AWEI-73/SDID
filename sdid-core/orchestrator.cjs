'use strict';
/**
 * SDID Orchestrator — 共用業務邏輯層
 *
 * 這個模組從 CLI loop.cjs 提取出來的業務邏輯，
 * 讓 CLI loop 和 MCP loop 都可以使用相同的邏輯，不重複撰寫。
 *
 * 使用方:
 *   CLI loop: const orc = require('../../../../sdid-core/orchestrator.cjs');
 *   MCP loop: const orc = require('../../../sdid-core/orchestrator.cjs');
 */

const fs   = require('fs');
const path = require('path');
const stateMachine = require('./state-machine.cjs');

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

// v6: BUILD 固定跑 Phase 1-4，不再依賴 level gate
const BUILD_PHASES = [1, 2, 3, 4];

// ─────────────────────────────────────────────────────────────
// Build Phase Utils
// ─────────────────────────────────────────────────────────────

/**
 * 計算下一個 BUILD phase（固定 1-4）
 * level 參數保留供 runner.cjs backward compat，不影響邏輯
 */
function getNextBuildPhase(latestPassedPhase) {
  for (const p of BUILD_PHASES) {
    if (p > latestPassedPhase) return p;
  }
  return null; // 已完成所有 phase
}

/**
 * 從 logs 目錄讀取最新已 PASS 的 step
 * 支援兩種檔名格式（向後相容）：
 *   舊: poc-step-2-pass-2026-02-10T15-44-44.log
 *   新: build-phase-2-Story-1.0-pass-2026-02-10T16-10-25.log
 *
 * @param {string} logsDir    - logs 目錄路徑
 * @param {string} phasePrefix - 階段前綴 (e.g. 'poc-step', 'plan-step', 'build-phase')
 * @param {string} [storyFilter] - 可選的 Story ID 過濾 (e.g. 'Story-1.0')
 * @returns {number|null}
 */
function getLatestPassedStep(logsDir, phasePrefix, storyFilter = null) {
  if (!fs.existsSync(logsDir)) return null;

  let logFiles = fs.readdirSync(logsDir)
    .filter(f => f.startsWith(`${phasePrefix}-`) && f.includes('-pass-'))
    .sort();

  if (storyFilter) {
    logFiles = logFiles.filter(f => f.includes(storyFilter));
  }

  if (logFiles.length === 0) return null;

  let maxStep = 0;
  for (const f of logFiles) {
    const match = f.match(new RegExp(`${phasePrefix}-(\\d+)-(?:Story-[\\d.]+-)?(pass)-`));
    if (match) {
      const step = parseInt(match[1], 10);
      if (step > maxStep) maxStep = step;
    }
  }

  return maxStep || null;
}

// ─────────────────────────────────────────────────────────────
// Story Utils
// ─────────────────────────────────────────────────────────────

/**
 * 從 requirement_spec 偵測第一個 Story ID
 * @param {string} pocPath
 * @returns {string|null}
 */
function detectFirstStory(pocPath) {
  if (!fs.existsSync(pocPath)) return null;
  const specFiles = fs.readdirSync(pocPath).filter(f => f.startsWith('requirement_spec_'));
  if (specFiles.length === 0) return null;

  const content = fs.readFileSync(path.join(pocPath, specFiles[0]), 'utf8');
  const match = content.match(/Story[- ](\d+\.\d+)/i);
  return match ? `Story-${match[1]}` : 'Story-1.0';
}

/**
 * 從 requirement_spec 提取所有 Story ID
 * @param {string} pocPath
 * @returns {string[]}
 */
function extractAllStories(pocPath) {
  if (!fs.existsSync(pocPath)) return [];
  const specFiles = fs.readdirSync(pocPath).filter(f => f.startsWith('requirement_spec_'));
  if (specFiles.length === 0) return [];

  const content = fs.readFileSync(path.join(pocPath, specFiles[0]), 'utf8');
  const stories = [];
  const regex = /### Story (\d+\.\d+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    stories.push(`Story-${match[1]}`);
  }
  return stories.length > 0 ? stories : ['Story-1.0'];
}

/**
 * 檢查所有 Story 是否都有 implementation_plan
 * @param {string} pocPath
 * @param {string[]} implementationPlans - plan 檔名陣列
 * @returns {boolean}
 */
function checkAllStoriesPlanned(pocPath, implementationPlans) {
  const allStories = extractAllStories(pocPath);
  const plannedStories = implementationPlans.map(f => {
    const m = f.match(/Story-(\d+\.\d+)/i);
    return m ? `Story-${m[1]}` : null;
  }).filter(Boolean);
  return allStories.every(s => plannedStories.includes(s));
}

/**
 * 找出缺少 plan 的第一個 Story
 * @param {string} pocPath
 * @param {string[]} implementationPlans - plan 檔名陣列
 * @returns {string}
 */
function findMissingStoryPlan(pocPath, implementationPlans) {
  const allStories = extractAllStories(pocPath);
  const plannedStories = implementationPlans.map(f => {
    const m = f.match(/Story-(\d+\.\d+)/i);
    return m ? `Story-${m[1]}` : null;
  }).filter(Boolean);
  const missing = allStories.find(s => !plannedStories.includes(s));
  return missing || allStories[0];
}

// ─────────────────────────────────────────────────────────────
// State Detection
// ─────────────────────────────────────────────────────────────

/**
 * 從 .gems/iterations/ 自動偵測最新的 iteration
 * @param {string} projectPath
 * @returns {string} - e.g. 'iter-1'
 */
function detectLatestIter(projectPath) {
  const gemsPath = path.join(projectPath, '.gems', 'iterations');
  if (!fs.existsSync(gemsPath)) return 'iter-1';
  const iters = fs.readdirSync(gemsPath)
    .filter(d => /^iter-\d+$/.test(d))
    .map(d => parseInt(d.replace('iter-', ''), 10))
    .sort((a, b) => b - a);
  return iters.length > 0 ? `iter-${iters[0]}` : 'iter-1';
}

/**
 * 統一狀態偵測 — 包裝 state-machine.detectFullState
 *
 * 相比 MCP inferBlueprintState / CLI detectProjectState，
 * 這個函式是權威版本：自動偵測 iter，回傳欄位包含 `iteration` 別名。
 *
 * @param {string} projectPath
 * @param {{ iter?: string, story?: string }} opts
 * @returns {FullState & { iteration: string }}
 */
/** GEMS: detectProjectState | P0 | detectLatestIter(IO)→ensureIterStructure(IO)→detectFullState(IO)→RETURN:ProjectState | Story-1.0 */
function detectProjectState(projectPath, opts = {}) {
  const iter = opts.iter || detectLatestIter(projectPath);
  const iterNum = parseInt(iter.replace('iter-', ''), 10);
  stateMachine.ensureIterStructure(projectPath, iterNum);
  const state = stateMachine.detectFullState(projectPath, iter, opts.story || null);
  // 加 iteration 別名，讓 CLI loop 可以直接用 state.iteration
  return { ...state, iteration: state.iter || iter };
}

// ─────────────────────────────────────────────────────────────
// New Project Init
// ─────────────────────────────────────────────────────────────

/**
 * 產生新專案的 requirement_draft 內容
 * @param {string} type - 專案類型
 * @param {string} name - 專案名稱
 * @returns {string}
 */
function generateDraft(type, name) {
  const templates = {
    todo: {
      goal: '建立一個簡潔的待辦事項管理應用，支援新增、完成、刪除任務',
      requirement: '使用者希望有一個簡單的 Todo 應用來管理日常任務',
      modules: ['基礎建設 (types, config)', '任務管理模組 (Task CRUD)', 'UI 介面模組'],
    },
    calculator: {
      goal: '建立一個具備計算歷史記錄 CRUD 功能的現代化計算機 Web 應用程式',
      requirement: '使用者希望建立一個功能齊全的計算機，除了基本運算外，還需要有 CRUD 功能來管理計算歷史記錄',
      modules: ['基礎建設 (types, config)', '計算核心模組 (Calculator Core)', '歷史記錄管理模組 (History CRUD)'],
    },
    note: {
      goal: '建立一個支援 Markdown 的筆記應用，具備 CRUD 和搜尋功能',
      requirement: '使用者希望有一個筆記應用來記錄和管理想法',
      modules: ['基礎建設 (types, config)', '筆記管理模組 (Note CRUD)', '搜尋模組', 'UI 介面模組'],
    },
    counter: {
      goal: '建立一個簡單的計數器應用，支援增減和重置',
      requirement: '使用者希望有一個計數器來追蹤數量',
      modules: ['基礎建設 (types, config)', '計數器模組 (Counter Logic)', 'UI 介面模組'],
    },
  };

  const t = templates[type] || {
    goal: `建立一個 ${name} 應用`,
    requirement: `使用者希望有一個 ${name} 應用來完成相關功能`,
    modules: ['基礎建設 (types, config)', `${name} 核心模組`, 'UI 介面模組'],
  };

  return `# 📋 ${name} - 需求草稿

**迭代**: iter-1
**日期**: ${new Date().toISOString().split('T')[0]}
**狀態**: ✅ 已確認
**類型**: ${type || 'todo'}

---

## 一句話目標
${t.goal}

## 用戶原始需求

> ${t.requirement}

---

## 功能模組清單

${t.modules.map(m => `- [x] ${m}`).join('\n')}

---

**草稿狀態**: ✅ PASS
**POC Level**: M

`;
}

/**
 * 初始化新專案目錄結構，建立 requirement_draft
 * @param {string} type - 專案類型 (todo, calculator, note, counter, 或任意)
 * @param {string|null} projectName - 專案名稱（省略則自動產生）
 * @param {string} [cwd] - 工作目錄（預設 process.cwd()）
 * @returns {string} - 建立的專案路徑
 */
function initNewProject(type, projectName, cwd = process.cwd()) {
  const name = projectName || `${type || 'app'}-${Date.now()}`;
  const projectPath = path.resolve(cwd, name);

  const gemsPath = path.join(projectPath, '.gems', 'iterations', 'iter-1', 'poc');
  fs.mkdirSync(gemsPath, { recursive: true });

  const draftContent = generateDraft(type, name);
  const draftPath = path.join(gemsPath, 'requirement_draft_iter-1.md');
  fs.writeFileSync(draftPath, draftContent, 'utf-8');

  return projectPath;
}

// ─────────────────────────────────────────────────────────────
// Next Iteration Scaffold (Task-Pipe flow)
// ─────────────────────────────────────────────────────────────

/**
 * 產生迭代需求草稿（從 iteration suggestions 自動產生）
 * @param {{ projectName, iterName, prevIter, prevLevel, nextGoal, suggestions, techDebt, nextItems }} opts
 * @returns {string}
 */
function generateIterationDraft(opts) {
  const { projectName, iterName, prevIter, prevLevel, nextGoal, suggestions, techDebt, nextItems } = opts;

  // 去重 nextItems（by name）
  const uniqueItems = [];
  const seen = new Set();
  for (const item of nextItems) {
    const name = typeof item === 'string' ? item : item.name;
    if (!seen.has(name)) {
      seen.add(name);
      uniqueItems.push(item);
    }
  }

  const modules = [];

  for (const item of uniqueItems) {
    const name = typeof item === 'string' ? item : item.name;
    const priority = typeof item === 'string' ? 'P1' : (item.priority || 'P1');
    modules.push(`- [x] ${name} (${priority})`);
  }

  for (const td of techDebt) {
    if (td.priority === 'HIGH' || td.priority === 'MEDIUM') {
      const name = td.description || td.id;
      if (!seen.has(name)) {
        seen.add(name);
        modules.push(`- [x] [技術債] ${name} (${td.priority})`);
      }
    }
  }

  for (const sug of suggestions) {
    if (sug.priority <= 2 && sug.description) {
      if (!seen.has(sug.description)) {
        seen.add(sug.description);
        modules.push(`- [x] [建議] ${sug.description} (${sug.type || 'FEATURE'})`);
      }
    }
  }

  const goal = nextGoal || `${projectName} ${iterName} 迭代開發`;

  return `# 📋 ${projectName} - 需求草稿 (${iterName})

**迭代**: ${iterName}
**前一迭代**: ${prevIter}
**日期**: ${new Date().toISOString().split('T')[0]}
**狀態**: ✅ 已確認
**來源**: 自動從 ${prevIter} suggestions 產生

---

## 一句話目標
${goal}

## 用戶原始需求

> 基於 ${prevIter} 的開發成果，進行功能擴展與技術債清理。

---

## 功能模組清單

${modules.join('\n')}

---

## 前一迭代摘要

- **${prevIter} Level**: ${prevLevel}
- **Suggestions 數量**: ${suggestions.length}
- **技術債數量**: ${techDebt.length}
- **建議 Items**: ${uniqueItems.length}

---

**草稿狀態**: [x] DONE
**POC Level**: L

`;
}

/**
 * 讀取已完成 iteration 的 suggestions，自動產生下一個 iteration 的 requirement_draft
 * @param {string} projectPath - 專案根目錄
 * @param {string} completedIter - 已完成的 iteration (e.g. 'iter-1')
 * @returns {{ iteration, draftPath, suggestionsCount, skipped? }|null}
 */
function generateNextIteration(projectPath, completedIter) {
  const iterNum = parseInt(completedIter.replace('iter-', ''), 10);
  const nextIterName = `iter-${iterNum + 1}`;
  const nextIterPath = path.join(projectPath, '.gems', 'iterations', nextIterName);

  const nextPocPath = path.join(nextIterPath, 'poc');
  const nextDraftPath = path.join(nextPocPath, `requirement_draft_${nextIterName}.md`);
  if (fs.existsSync(nextDraftPath)) {
    return {
      iteration: nextIterName,
      draftPath: path.relative(projectPath, nextDraftPath),
      suggestionsCount: 0,
      skipped: true,
    };
  }

  const buildPath = path.join(projectPath, '.gems', 'iterations', completedIter, 'build');
  if (!fs.existsSync(buildPath)) return null;

  const suggestionsFiles = fs.readdirSync(buildPath)
    .filter(f => f.startsWith('iteration_suggestions_') && f.endsWith('.json'));

  if (suggestionsFiles.length === 0) return null;

  const allSuggestions = [];
  const allTechDebt    = [];
  const allNextItems   = [];
  let nextGoal = '';

  for (const file of suggestionsFiles) {
    try {
      const json = JSON.parse(fs.readFileSync(path.join(buildPath, file), 'utf8'));
      if (json.suggestions && Array.isArray(json.suggestions))          allSuggestions.push(...json.suggestions);
      if (json.technicalDebt && Array.isArray(json.technicalDebt))      allTechDebt.push(...json.technicalDebt);
      if (json.nextIteration) {
        if (json.nextIteration.suggestedGoal && json.nextIteration.suggestedGoal !== '// TODO: AI 填寫下次迭代目標') {
          nextGoal = json.nextIteration.suggestedGoal;
        }
        if (json.nextIteration.suggestedItems) allNextItems.push(...json.nextIteration.suggestedItems);
      }
    } catch (_) { /* ignore parse errors */ }
  }

  const hasContent = allSuggestions.length > 0 || allTechDebt.length > 0 || allNextItems.length > 0;
  if (!hasContent) return null;

  // 從前一個 iteration 的 requirement_spec 取得專案資訊
  const prevPocPath = path.join(projectPath, '.gems', 'iterations', completedIter, 'poc');
  let projectName = path.basename(projectPath);
  let prevLevel = 'S';
  if (fs.existsSync(prevPocPath)) {
    const specFiles = fs.readdirSync(prevPocPath).filter(f => f.startsWith('requirement_spec_'));
    if (specFiles.length > 0) {
      const specContent = fs.readFileSync(path.join(prevPocPath, specFiles[0]), 'utf8');
      const nameMatch = specContent.match(/^#\s+.*?(\S+)\s*-/m);
      if (nameMatch) projectName = nameMatch[1];
      const levelMatch = specContent.match(/\*\*Level\*\*:\s*(\w+)/);
      if (levelMatch) prevLevel = levelMatch[1];
    }
  }

  const draft = generateIterationDraft({
    projectName,
    iterName: nextIterName,
    prevIter: completedIter,
    prevLevel,
    nextGoal,
    suggestions: allSuggestions,
    techDebt: allTechDebt,
    nextItems: allNextItems,
  });

  fs.mkdirSync(nextPocPath, { recursive: true });
  fs.writeFileSync(nextDraftPath, draft, 'utf-8');

  return {
    iteration: nextIterName,
    draftPath: path.relative(projectPath, nextDraftPath),
    suggestionsCount: suggestionsFiles.length,
  };
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

module.exports = {
  // constants
  BUILD_PHASES,
  // build phase utils
  getNextBuildPhase,
  getLatestPassedStep,
  // story utils
  detectFirstStory,
  extractAllStories,
  checkAllStoriesPlanned,
  findMissingStoryPlan,
  // state detection
  detectLatestIter,
  detectProjectState,
  // new project
  generateDraft,
  initNewProject,
  // next iteration
  generateIterationDraft,
  generateNextIteration,
};
