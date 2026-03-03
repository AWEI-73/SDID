#!/usr/bin/env node
/**
 * Blueprint Loop v2.0 - 單次執行模式
 * 
 * 設計理念：腳本 print → AI 讀取 → AI 執行 → 重複直到 @PASS
 * 
 * Blueprint Flow 的自動化循環：
 *   GATE → PLAN → BUILD (Phase 1-8 per Story) → SHRINK → VERIFY
 * 
 * 與 Ralph Loop v4 對齊：
 *   - 彩色輸出
 *   - 詳細狀態顯示 (所有 Story 進度)
 *   - 自我迭代 (從 suggestions 產生下一個 iter draft)
 *   - COMPLETE_SIGNAL
 * 
 * 用法:
 *   node loop.cjs --project=./my-app                     # 偵測狀態並執行下一步
 *   node loop.cjs --project=./my-app --force-start=GATE  # 強制從 Gate 開始
 *   node loop.cjs --project=./my-app --force-start=BUILD-1 --story=Story-1.0
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ============================================
// 配置
// ============================================
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../..');
const SDID_TOOLS = path.join(WORKSPACE_ROOT, 'sdid-tools');
const TASK_PIPE = path.join(WORKSPACE_ROOT, 'task-pipe');
const COMPLETE_SIGNAL = '<promise>BLUEPRINT-COMPLETE</promise>';

// P3: project-memory 整合
let projectMemory = null;
try {
  projectMemory = require(path.join(TASK_PIPE, 'lib', 'shared', 'project-memory.cjs'));
} catch (e) { /* 忽略 — project-memory 不存在不影響主流程 */ }

// ============================================
// 顏色輸出
// ============================================
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(msg, color = 'reset') {
  console.log(`${c[color]}${msg}${c.reset}`);
}

// ============================================
// 參數解析
// ============================================
function parseArgs() {
  const args = {
    project: null, draft: null, iter: null,
    story: null, forceStart: null, level: 'M',
    dryRun: false, help: false,
  };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--project=')) args.project = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--draft=')) args.draft = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iter=')) args.iter = parseInt(arg.split('=')[1]);
    else if (arg.startsWith('--story=')) args.story = arg.split('=')[1];
    else if (arg.startsWith('--level=')) args.level = arg.split('=')[1].toUpperCase();
    else if (arg.startsWith('--force-start=')) args.forceStart = arg.split('=')[1].toUpperCase();
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}


// ============================================
// 專案偵測
// ============================================

/** 找到最新的 iteration */
function findLatestIter(projectPath) {
  const gemsPath = path.join(projectPath, '.gems', 'iterations');
  if (!fs.existsSync(gemsPath)) return 1;
  const iters = fs.readdirSync(gemsPath)
    .filter(d => d.startsWith('iter-'))
    .map(d => parseInt(d.replace('iter-', ''), 10))
    .sort((a, b) => b - a);
  return iters[0] || 1;
}

/** 找到 draft 路徑 */
function findDraft(projectPath, iterNum) {
  const pocPath = path.join(projectPath, '.gems', 'iterations', `iter-${iterNum}`, 'poc');
  if (!fs.existsSync(pocPath)) return null;
  const drafts = fs.readdirSync(pocPath).filter(f => f.startsWith('requirement_draft_'));
  if (drafts.length === 0) return null;
  return path.join(pocPath, drafts[0]);
}

/** 找到 plan 目錄中的 Story 列表 */
function findPlannedStories(projectPath, iterNum) {
  const planPath = path.join(projectPath, '.gems', 'iterations', `iter-${iterNum}`, 'plan');
  if (!fs.existsSync(planPath)) return [];
  return fs.readdirSync(planPath)
    .filter(f => f.startsWith('implementation_plan_'))
    .map(f => { const m = f.match(/Story-(\d+\.\d+)/); return m ? `Story-${m[1]}` : null; })
    .filter(Boolean)
    .sort();
}

/** 找到已完成 BUILD 的 Story 列表 (有 Fillback) */
function findCompletedStories(projectPath, iterNum) {
  const buildPath = path.join(projectPath, '.gems', 'iterations', `iter-${iterNum}`, 'build');
  if (!fs.existsSync(buildPath)) return [];
  return fs.readdirSync(buildPath)
    .filter(f => f.startsWith('Fillback_'))
    .map(f => { const m = f.match(/Story-(\d+\.\d+)/); return m ? `Story-${m[1]}` : null; })
    .filter(Boolean)
    .sort();
}

/** 從 logs 讀取最新 pass 的 step */
function getLatestPassedStep(logsDir, prefix, storyFilter = null) {
  if (!fs.existsSync(logsDir)) return null;
  let files = fs.readdirSync(logsDir)
    .filter(f => f.startsWith(`${prefix}-`) && f.includes('-pass-'))
    .sort();
  if (storyFilter) files = files.filter(f => f.includes(storyFilter));
  let max = 0;
  for (const f of files) {
    const m = f.match(new RegExp(`${prefix}-(\\d+)-`));
    if (m) { const n = parseInt(m[1]); if (n > max) max = n; }
  }
  return max || null;
}

/** 檢查某個 gate log 是否存在 */
function hasGateLog(logsDir, step, type = 'pass') {
  if (!fs.existsSync(logsDir)) return false;
  return fs.readdirSync(logsDir).some(f => f.startsWith(`gate-${step}-`) && f.includes(`-${type}-`));
}


// ============================================
// 狀態偵測
// ============================================

function detectState(projectPath, iterNum) {
  let stateManager;
  try {
    stateManager = require(path.join(WORKSPACE_ROOT, 'task-pipe', 'lib', 'shared', 'state-manager-v3.cjs'));
  } catch (e) {
    return { phase: 'ERROR', reason: '找不到 state-manager-v3.cjs' };
  }

  const iteration = `iter-${iterNum}`;
  let state = stateManager.readState(projectPath, iteration);
  const draftPath = findDraft(projectPath, iterNum);
  const plannedStories = findPlannedStories(projectPath, iterNum);
  const completedStories = findCompletedStories(projectPath, iterNum);

  if (!state || !state.flow || !state.flow.currentNode) {
    if (!draftPath) {
      return { phase: 'NO_DRAFT', reason: `iter-${iterNum} 沒有 requirement_draft，請先用 blueprint-architect 產出藍圖` };
    }
    // Initialize state as Blueprint flow starting at GATE
    state = stateManager.getCurrentState(projectPath, iteration, { entryPoint: 'GATE-check', mode: 'blueprint' });
  }

  // Already completed or abandoned
  if (state.status === 'completed' || state.status === 'abandoned') {
    return { phase: 'COMPLETE', reason: `State Ledger: ${iteration} ${state.status}`, source: 'state_ledger' };
  }

  let { phase, step } = stateManager.parseNode(state.flow.currentNode);

  if (!phase) {
    return { phase: 'COMPLETE', reason: '流程已結束 (COMPLETE)', source: 'state_ledger' };
  }

  let currentStory = null;
  if (phase === 'BUILD' && step) {
    if (state.stories) {
      currentStory = Object.keys(state.stories).find(s => state.stories[s].status === 'in-progress') ||
        Object.keys(state.stories).find(s => state.stories[s].status === 'pending');
    }
    if (!currentStory) {
      currentStory = plannedStories.find(s => !completedStories.includes(s));
    }
  }

  // Handle NEXT_ITER transition
  if (phase === 'NEXT_ITER') {
    const nextIterNum = iterNum + 1;
    const nextDraft = findDraft(projectPath, nextIterNum);
    if (nextDraft) {
      return { phase: 'NEXT_ITER', nextIter: nextIterNum, plannedStories, completedStories, reason: `iter-${iterNum} 完成，自動進入下一迭代` };
    } else {
      return { phase: 'COMPLETE', reason: `iter-${iterNum} Blueprint Flow 全部完成` };
    }
  }

  return {
    phase,
    step: step ? (isNaN(step) ? step : parseInt(step)) : null,
    story: currentStory,
    draftPath,
    plannedStories,
    completedStories,
    nextIter: iterNum + 1,
    reason: `State Ledger: Phase ${phase}${step ? '-' + step : ''}`,
    source: 'state_ledger'
  };
}


// ============================================
// 自我迭代：從 suggestions 產生下一個 iteration
// ============================================

/**
 * 讀取已完成 iteration 的 suggestions，自動產生下一個 iteration 的 requirement_draft
 * @param {string} projectPath - 專案根目錄
 * @param {string} completedIter - 已完成的 iteration (e.g. 'iter-1')
 * @returns {object|null} { iteration, draftPath, suggestionsCount } 或 null（無建議）
 */
function generateNextIteration(projectPath, completedIter) {
  const iterNum = parseInt(completedIter.replace('iter-', ''), 10);
  const nextIterName = `iter-${iterNum + 1}`;
  const nextIterPath = path.join(projectPath, '.gems', 'iterations', nextIterName);

  // 如果下一個 iteration 已存在，不覆蓋
  const nextPocPath = path.join(nextIterPath, 'poc');
  const nextDraftPath = path.join(nextPocPath, `requirement_draft_${nextIterName}.md`);
  if (fs.existsSync(nextDraftPath)) {
    log(`  ℹ️  ${path.relative(projectPath, nextDraftPath)} 已存在，跳過產生`, 'yellow');
    return { iteration: nextIterName, draftPath: path.relative(projectPath, nextDraftPath), suggestionsCount: 0, skipped: true };
  }

  // 讀取已完成 iteration 的所有 suggestions
  const buildPath = path.join(projectPath, '.gems', 'iterations', completedIter, 'build');
  if (!fs.existsSync(buildPath)) return null;

  const suggestionsFiles = fs.readdirSync(buildPath)
    .filter(f => f.startsWith('iteration_suggestions_') && f.endsWith('.json'));

  if (suggestionsFiles.length === 0) return null;

  // 合併所有 suggestions
  const allSuggestions = [];
  const allTechDebt = [];
  const allNextItems = [];
  let nextGoal = '';

  for (const file of suggestionsFiles) {
    try {
      const json = JSON.parse(fs.readFileSync(path.join(buildPath, file), 'utf8'));
      if (json.suggestions && Array.isArray(json.suggestions)) allSuggestions.push(...json.suggestions);
      if (json.technicalDebt && Array.isArray(json.technicalDebt)) allTechDebt.push(...json.technicalDebt);
      if (json.nextIteration) {
        if (json.nextIteration.suggestedGoal && json.nextIteration.suggestedGoal !== '// TODO: AI 填寫下次迭代目標') {
          nextGoal = json.nextIteration.suggestedGoal;
        }
        if (json.nextIteration.suggestedItems) allNextItems.push(...json.nextIteration.suggestedItems);
      }
    } catch (e) { /* 忽略 JSON 解析錯誤 */ }
  }

  const hasContent = allSuggestions.length > 0 || allTechDebt.length > 0 || allNextItems.length > 0;
  if (!hasContent) return null;

  // 讀取前一個 iteration 的 requirement_spec 取得專案資訊
  const prevPocPath = path.join(projectPath, '.gems', 'iterations', completedIter, 'poc');
  let projectName = path.basename(projectPath);
  let prevLevel = 'M';
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

  // 也嘗試從 draft 讀取專案名稱
  const draftFiles = fs.existsSync(prevPocPath) ? fs.readdirSync(prevPocPath).filter(f => f.startsWith('requirement_draft_')) : [];
  if (draftFiles.length > 0) {
    const draftContent = fs.readFileSync(path.join(prevPocPath, draftFiles[0]), 'utf8');
    const draftNameMatch = draftContent.match(/^#\s+📋?\s*(\S+)/m);
    if (draftNameMatch) projectName = draftNameMatch[1];
  }

  // 產生 requirement_draft
  const draft = generateIterationDraft({
    projectName, iterName: nextIterName, prevIter: completedIter,
    prevLevel, nextGoal, suggestions: allSuggestions,
    techDebt: allTechDebt, nextItems: allNextItems,
  });

  fs.mkdirSync(nextPocPath, { recursive: true });
  fs.writeFileSync(nextDraftPath, draft, 'utf-8');

  return {
    iteration: nextIterName,
    draftPath: path.relative(projectPath, nextDraftPath),
    suggestionsCount: suggestionsFiles.length,
  };
}

function generateIterationDraft(opts) {
  const { projectName, iterName, prevIter, prevLevel, nextGoal, suggestions, techDebt, nextItems } = opts;

  const uniqueItems = [];
  const seen = new Set();
  for (const item of nextItems) {
    const name = typeof item === 'string' ? item : item.name;
    if (!seen.has(name)) { seen.add(name); uniqueItems.push(item); }
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
      if (!seen.has(name)) { seen.add(name); modules.push(`- [x] [技術債] ${name} (${td.priority})`); }
    }
  }
  for (const sug of suggestions) {
    if (sug.priority <= 2 && sug.description) {
      if (!seen.has(sug.description)) { seen.add(sug.description); modules.push(`- [x] [建議] ${sug.description} (${sug.type || 'FEATURE'})`); }
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


// ============================================
// 狀態顯示 (對齊 ralph-loop)
// ============================================

function displayProgress(state, iterNum) {
  const planned = state.plannedStories || [];
  const completed = state.completedStories || [];

  if (planned.length > 0) {
    log(`\n📊 Story 進度: ${completed.length}/${planned.length}`, 'cyan');
    for (const story of planned) {
      const done = completed.includes(story);
      const icon = done ? '✅' : (state.story === story ? '🔨' : '⏳');
      const status = done ? 'DONE' : (state.story === story ? `BUILD Phase ${state.step || '?'}` : 'PENDING');
      log(`   ${icon} ${story}: ${status}`, done ? 'green' : (state.story === story ? 'yellow' : 'cyan'));
    }
  }
}

// ============================================
// 執行指令
// ============================================

function runCommand(cmd, args, cwd, dryRun) {
  if (dryRun) {
    log(`\n🧪 [DRY-RUN] node ${path.basename(cmd)} ${args.join(' ')}`, 'yellow');
    return { success: true };
  }
  log(`\n🚀 執行: node ${path.basename(cmd)} ${args.join(' ')}`, 'blue');
  log(`   ${cmd}`, 'cyan');
  const result = spawnSync('node', [cmd, ...args], { stdio: 'inherit', cwd, encoding: 'utf-8' });
  return { success: result.status === 0, exitCode: result.status };
}

function executePhase(state, projectPath, iterNum, args) {
  const draftPath = args.draft || state.draftPath;

  switch (state.phase) {
    case 'NO_DRAFT':
      log(`\n❌ ${state.reason}`, 'red');
      log(`\n@NEXT_ACTION`, 'yellow');
      log(`請先用 blueprint-architect skill 產出活藍圖，存到:`, 'yellow');
      log(`  ${projectPath}/.gems/iterations/iter-${iterNum}/poc/requirement_draft_iter-${iterNum}.md`, 'cyan');
      return { success: false };

    case 'GATE':
      return runCommand(
        path.join(SDID_TOOLS, 'blueprint-gate.cjs'),
        [`--draft=${draftPath}`, `--target=${projectPath}`, `--iter=${iterNum}`],
        WORKSPACE_ROOT, args.dryRun
      );

    case 'CYNEFIN_CHECK':
      log(`\n🔍 CYNEFIN-CHECK: 語意域分析`, 'cyan');
      log(`\n@TASK`, 'yellow');
      log(`ACTION: 讀 [cynefin-check.md](.agent/skills/sdid/references/cynefin-check.md) 對以下文件做語意域分析`, 'yellow');
      log(`FILE: ${draftPath}`, 'yellow');
      log(`EXPECTED: 產出 report JSON → 執行 node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> --target=${projectPath} --iter=${iterNum}`, 'yellow');
      log(`\n@REMINDER: 分析完成後必須執行 cynefin-log-writer.cjs 存 log，@PASS 才能進 PLAN`, 'yellow');
      return { success: true, waitForAI: true };

    case 'PLAN':
      return runCommand(
        path.join(SDID_TOOLS, 'draft-to-plan.cjs'),
        [`--draft=${draftPath}`, `--iter=${iterNum}`, `--target=${projectPath}`],
        WORKSPACE_ROOT, args.dryRun
      );

    case 'BUILD': {
      const story = args.story || state.story;
      const step = state.step || 1;
      return runCommand(
        path.join(TASK_PIPE, 'runner.cjs'),
        [`--phase=BUILD`, `--step=${step}`, `--story=${story}`, `--target=${projectPath}`, `--iteration=iter-${iterNum}`, `--level=${args.level}`],
        TASK_PIPE, args.dryRun
      );
    }

    case 'SHRINK':
      return runCommand(
        path.join(SDID_TOOLS, 'blueprint-shrink.cjs'),
        [`--draft=${draftPath}`, `--iter=${iterNum}`, `--target=${projectPath}`],
        WORKSPACE_ROOT, args.dryRun
      );

    case 'SCAN':
      return runCommand(
        path.join(TASK_PIPE, 'runner.cjs'),
        [`--phase=SCAN`, `--target=${projectPath}`, `--iteration=iter-${iterNum}`],
        TASK_PIPE, args.dryRun
      );

    case 'VERIFY':
      return runCommand(
        path.join(SDID_TOOLS, 'blueprint-verify.cjs'),
        [`--draft=${draftPath}`, `--target=${projectPath}`, `--iter=${iterNum}`],
        WORKSPACE_ROOT, args.dryRun
      );

    case 'NEXT_ITER':
      log(`\n🔄 iter-${iterNum} 完成，切換到 iter-${state.nextIter}`, 'blue');
      log(`\n@NEXT_ACTION`, 'yellow');
      log(`重新執行: node loop.cjs --project=${projectPath} --iter=${state.nextIter}`, 'yellow');
      return { success: true };

    case 'COMPLETE':
      // 由 main() 處理
      return { success: true };

    default:
      log(`\n❌ 未知狀態: ${state.phase}`, 'red');
      return { success: false };
  }
}


// ============================================
// 主程式
// ============================================

function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  log('╔════════════════════════════════════════════════════════════╗', 'magenta');
  log('║        📐 Blueprint Loop v2.0 - 單次執行模式               ║', 'magenta');
  log('╚════════════════════════════════════════════════════════════╝', 'magenta');

  if (!args.project) {
    log('\n❌ 請指定專案路徑: --project=<path>', 'red');
    process.exit(1);
  }

  if (!fs.existsSync(args.project)) {
    log(`\n❌ 專案不存在: ${args.project}`, 'red');
    process.exit(1);
  }

  const iterNum = args.iter || findLatestIter(args.project);
  log(`\n📁 專案: ${args.project}`, 'cyan');
  log(`📍 迭代: iter-${iterNum}`, 'cyan');

  // P3: 印出 project-memory resume context
  if (projectMemory) {
    try {
      const resumeText = projectMemory.getResumeContext(args.project);
      if (resumeText) {
        log('\n@MEMORY', 'magenta');
        log(resumeText, 'cyan');
      }
    } catch (e) { /* 忽略 */ }
  }

  // 偵測或強制指定狀態
  let state;
  if (args.forceStart) {
    const buildMatch = args.forceStart.match(/^BUILD-?(\d+)?$/i);
    if (buildMatch) {
      state = {
        phase: 'BUILD', step: parseInt(buildMatch[1] || '1'),
        story: args.story, draftPath: args.draft || findDraft(args.project, iterNum),
        plannedStories: findPlannedStories(args.project, iterNum),
        completedStories: findCompletedStories(args.project, iterNum),
        reason: `強制: BUILD Phase ${buildMatch[1] || 1}`,
      };
    } else {
      const phaseMap = { GATE: 'GATE', PLAN: 'PLAN', SHRINK: 'SHRINK', VERIFY: 'VERIFY', EXPAND: 'EXPAND' };
      const phase = phaseMap[args.forceStart];
      if (phase) {
        state = {
          phase, draftPath: args.draft || findDraft(args.project, iterNum),
          plannedStories: findPlannedStories(args.project, iterNum),
          completedStories: findCompletedStories(args.project, iterNum),
          reason: `強制: ${phase}`,
        };
      } else {
        log(`\n❌ 無效的 --force-start: ${args.forceStart}`, 'red');
        log('   有效值: GATE, PLAN, BUILD-N, SHRINK, VERIFY', 'yellow');
        process.exit(1);
      }
    }
  } else {
    state = detectState(args.project, iterNum);
  }

  log(`📍 狀態: ${state.phase}${state.step ? ' Phase ' + state.step : ''}${state.story ? ' ' + state.story : ''} (iter-${iterNum})`, 'cyan');
  log(`   原因: ${state.reason}`, 'cyan');

  // 進入 SHRINK 前檢查是否還有未完成的 Story
  if (state.phase === 'SHRINK') {
    const nextStory = state.plannedStories.find(s => !state.completedStories.includes(s));
    if (nextStory) {
      log(`\n⏳ 尚有未完成 Story (${nextStory})，跳回 BUILD Phase 1`, 'yellow');
      try {
        const stateManager = require(path.join(WORKSPACE_ROOT, 'task-pipe', 'lib', 'shared', 'state-manager-v3.cjs'));
        stateManager.forceStartFrom(args.project, `iter-${iterNum}`, 'BUILD-1');
        state.phase = 'BUILD';
        state.step = 1;
        state.story = nextStory;
      } catch (e) {
        log(`[Warn] 無法重置狀態: ${e.message}`, 'red');
      }
    }
  }

  // 顯示 Story 進度
  displayProgress(state, iterNum);

  // 檢查是否完成
  if (state.phase === 'COMPLETE') {
    log(`\n✅ iter-${iterNum} Blueprint Flow 全部完成！`, 'green');

    // P3: 記錄完成到 project-memory
    if (projectMemory) {
      try {
        projectMemory.recordEntry(args.project, {
          phase: 'COMPLETE', step: null,
          story: null, iteration: `iter-${iterNum}`,
          verdict: 'PASS', signal: '@PASS',
          summary: `iter-${iterNum} Blueprint Flow 全部完成`
        });
      } catch (e) { /* 忽略 */ }
    }

    // 自我迭代：從 suggestions 產生下一個 iteration
    const nextIter = generateNextIteration(args.project, `iter-${iterNum}`);

    if (nextIter) {
      log(`\n🔄 自動產生 ${nextIter.iteration} 需求草稿`, 'blue');
      log(`   來源: ${nextIter.suggestionsCount} 個 suggestions`, 'cyan');
      log(`   草稿: ${nextIter.draftPath}`, 'cyan');
      log(`\n@NEXT_ACTION`, 'yellow');
      log(`請檢閱 ${nextIter.draftPath}，確認需求後:`, 'yellow');
      log(`  1. 執行 Expand: node sdid-tools/blueprint-expand.cjs --draft=<draft> --iter=${parseInt(nextIter.iteration.replace('iter-', ''))} --target=${args.project}`, 'yellow');
      log(`  2. 或重新執行: node loop.cjs --project=${args.project}`, 'yellow');
    } else {
      log('\n' + COMPLETE_SIGNAL, 'green');
      log('無更多迭代建議，Blueprint Flow 開發完成！', 'green');
    }
    return;
  }

  // 執行
  const result = executePhase(state, args.project, iterNum, args);

  // 輸出結果
  if (result.success) {
    if (result.waitForAI) {
      log('\n@NEXT_ACTION', 'yellow');
      log('請完成上述任務，並確認執行規定工具（如 cynefin-log-writer.cjs）', 'yellow');
      return;
    }

    // v2.0自動推進狀態 (僅限由 loop 呼叫的同步階段，BUILD/SCAN 由 runner 自己管理)
    if (['GATE', 'PLAN', 'SHRINK', 'VERIFY'].includes(state.phase)) {
      try {
        const stateManager = require(path.join(WORKSPACE_ROOT, 'task-pipe', 'lib', 'shared', 'state-manager-v3.cjs'));
        let step = 'run';
        if (state.phase === 'GATE') step = 'check';
        if (state.phase === 'PLAN') step = 'draft-to-plan';
        stateManager.advanceState(args.project, `iter-${iterNum}`, state.phase, step);
      } catch (e) { /* ignore */ }
    }

    log('\n✅ 執行完成', 'green');

    // P3: 記錄成功到 project-memory
    if (projectMemory) {
      try {
        projectMemory.recordEntry(args.project, {
          phase: state.phase, step: state.step ? String(state.step) : null,
          story: state.story, iteration: `iter-${iterNum}`,
          verdict: 'PASS', signal: '@PASS',
          summary: `Blueprint ${state.phase}${state.step ? ' Phase ' + state.step : ''}${state.story ? ' ' + state.story : ''} passed`
        });
      } catch (e) { /* 忽略 */ }
    }

    log('\n@NEXT_ACTION', 'yellow');
    log('請讀取上方輸出，根據 @TASK 或 @PASS 指示執行任務，完成後再次執行此腳本。', 'yellow');
  } else {
    log('\n❌ 執行失敗', 'red');

    // P3: 記錄失敗到 project-memory
    if (projectMemory) {
      try {
        projectMemory.recordEntry(args.project, {
          phase: state.phase, step: state.step ? String(state.step) : null,
          story: state.story, iteration: `iter-${iterNum}`,
          verdict: 'ERROR', signal: '@ERROR',
          summary: `Blueprint ${state.phase}${state.step ? ' Phase ' + state.step : ''} failed`
        });
      } catch (e) { /* 忽略 */ }
    }

    log('\n@NEXT_ACTION', 'yellow');
    log(`請讀取 .gems/iterations/iter-${iterNum}/logs/ 下最新的 error log，`, 'yellow');
    log('根據 @BLOCKER 或 @TACTICAL_FIX 指示修正後，再次執行此腳本。', 'yellow');
  }
}

// ============================================
// 幫助訊息
// ============================================
function showHelp() {
  log(`
${c.bold}Blueprint Loop v2.0 - 單次執行模式${c.reset}

${c.bold}用法:${c.reset}
  node loop.cjs --project=<path>                      偵測狀態並執行下一步
  node loop.cjs --project=<path> --force-start=GATE   強制從 Gate 開始
  node loop.cjs --project=<path> --force-start=BUILD-1 --story=Story-1.0

${c.bold}選項:${c.reset}
  --project=<path>        專案路徑 (必填)
  --draft=<path>          Draft 路徑 (可選，自動偵測)
  --iter=N                迭代編號 (可選，自動偵測)
  --story=Story-X.Y       Story ID (BUILD 階段)
  --level=<S|M|L>         執行等級 (預設: M)
  --force-start=<PHASE>   強制從指定階段開始
  --dry-run               預覽模式
  --help                  顯示此訊息

${c.bold}流程:${c.reset}
  GATE → PLAN → BUILD (Phase 1-8) → SHRINK → [EXPAND → GATE → ...] → VERIFY

${c.bold}範例:${c.reset}
  ${c.cyan}# 繼續現有專案${c.reset}
  node loop.cjs --project=./my-app

  ${c.cyan}# 強制從 Gate 開始${c.reset}
  node loop.cjs --project=./my-app --force-start=GATE

  ${c.cyan}# 指定 Story 的 BUILD${c.reset}
  node loop.cjs --project=./my-app --force-start=BUILD-3 --story=Story-1.0
`);
}

// 執行
main();
