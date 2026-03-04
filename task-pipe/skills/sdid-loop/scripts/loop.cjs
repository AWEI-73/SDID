#!/usr/bin/env node
/**
 * SDID Loop v4 - 單次執行模式
 * 
 * 設計理念：腳本 print → AI 讀取 → AI 執行 → 重複直到 @PASS
 * 
 * 這個腳本只執行一次 runner，輸出結果後結束。
 * AI 負責讀取輸出，決定下一步，再次執行腳本。
 * 
 * 用法:
 *   node loop.cjs --project=./my-app                    # 偵測狀態並執行下一步
 *   node loop.cjs --new --project=calc-app --type=todo  # 新專案
 *   node loop.cjs --project=./my-app --force-start=POC-1  # 強制從 POC Step 1 開始
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ============================================
// 配置
// ============================================
const TASK_PIPE_ROOT = path.resolve(__dirname, '../../..');
const COMPLETE_SIGNAL = '<promise>GEMS-COMPLETE</promise>';
const CONFIG_PATH = path.join(TASK_PIPE_ROOT, 'config.json');

// Level-aware phase 跳轉
const { getNextPhase: getLevelNextPhase, getPhasesForLevel } = require(path.join(TASK_PIPE_ROOT, 'lib', 'level-gate.cjs'));

/**
 * 根據 level 計算下一個有效 BUILD phase
 * 如果 currentPhase 不在 level 的 phases 裡，往前找最近的已 pass phase 再算下一個
 */
function getNextBuildPhase(level, latestPassedPhase) {
    const phases = getPhasesForLevel(level, CONFIG_PATH);
    // 找到 latestPassedPhase 在 phases 中的位置（或之後最近的）
    for (let i = 0; i < phases.length; i++) {
        if (parseInt(phases[i], 10) > latestPassedPhase) {
            return parseInt(phases[i], 10);
        }
    }
    return null; // 已經是最後一個 phase
}

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
        project: null,
        story: null,
        new: false,
        type: null,
        level: 'M',
        forceStart: null,  // POC-1, PLAN-1, BUILD-1
        mode: 'full',      // P5: full | quick
        dryRun: false,
        help: false,
    };

    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith('--project=')) {
            args.project = path.resolve(arg.split('=')[1]);
        } else if (arg.startsWith('--story=')) {
            args.story = arg.split('=')[1];
        } else if (arg.startsWith('--type=')) {
            args.type = arg.split('=')[1];
        } else if (arg.startsWith('--level=')) {
            args.level = arg.split('=')[1].toUpperCase();
        } else if (arg.startsWith('--force-start=')) {
            args.forceStart = arg.split('=')[1].toUpperCase();
        } else if (arg.startsWith('--mode=')) {
            args.mode = arg.split('=')[1].toLowerCase();
        } else if (arg === '--new') {
            args.new = true;
        } else if (arg === '--dry-run') {
            args.dryRun = true;
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }

    return args;
}

// ============================================
// 新專案初始化
// ============================================
function initNewProject(type, projectName) {
    log('\n📦 初始化新專案...', 'blue');
    
    // 生成專案名稱
    const name = projectName || `${type || 'app'}-${Date.now()}`;
    const projectPath = path.resolve(process.cwd(), name);
    
    // 建立目錄結構
    const gemsPath = path.join(projectPath, '.gems', 'iterations', 'iter-1', 'poc');
    fs.mkdirSync(gemsPath, { recursive: true });
    
    // 建立 requirement_draft
    const draftContent = generateDraft(type, name);
    const draftPath = path.join(gemsPath, 'requirement_draft_iter-1.md');
    fs.writeFileSync(draftPath, draftContent, 'utf-8');
    
    log(`  ✅ 專案建立: ${projectPath}`, 'green');
    log(`  ✅ Draft 建立: ${draftPath}`, 'green');
    
    return projectPath;
}

function generateDraft(type, name) {
    const templates = {
        todo: {
            goal: '建立一個簡潔的待辦事項管理應用，支援新增、完成、刪除任務',
            requirement: '使用者希望有一個簡單的 Todo 應用來管理日常任務',
            modules: ['基礎建設 (types, config)', '任務管理模組 (Task CRUD)', 'UI 介面模組']
        },
        calculator: {
            goal: '建立一個具備計算歷史記錄 CRUD 功能的現代化計算機 Web 應用程式',
            requirement: '使用者希望建立一個功能齊全的計算機，除了基本運算外，還需要有 CRUD 功能來管理計算歷史記錄',
            modules: ['基礎建設 (types, config)', '計算核心模組 (Calculator Core)', '歷史記錄管理模組 (History CRUD)']
        },
        note: {
            goal: '建立一個支援 Markdown 的筆記應用，具備 CRUD 和搜尋功能',
            requirement: '使用者希望有一個筆記應用來記錄和管理想法',
            modules: ['基礎建設 (types, config)', '筆記管理模組 (Note CRUD)', '搜尋模組', 'UI 介面模組']
        },
        counter: {
            goal: '建立一個簡單的計數器應用，支援增減和重置',
            requirement: '使用者希望有一個計數器來追蹤數量',
            modules: ['基礎建設 (types, config)', '計數器模組 (Counter Logic)', 'UI 介面模組']
        }
    };
    
    const t = templates[type] || {
        goal: `建立一個 ${name} 應用`,
        requirement: `使用者希望有一個 ${name} 應用來完成相關功能`,
        modules: ['基礎建設 (types, config)', `${name} 核心模組`, 'UI 介面模組']
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

**草稿狀態**: [x] DONE
**POC Level**: M

`;
}

// ============================================
// 從 requirement_spec 偵測第一個 Story ID
// ============================================
function detectFirstStory(pocPath) {
    if (!fs.existsSync(pocPath)) return null;
    const specFiles = fs.readdirSync(pocPath).filter(f => f.startsWith('requirement_spec_'));
    if (specFiles.length === 0) return null;
    
    const content = fs.readFileSync(path.join(pocPath, specFiles[0]), 'utf8');
    // 匹配 Story X.Y 格式
    const match = content.match(/Story[- ](\d+\.\d+)/i);
    return match ? `Story-${match[1]}` : 'Story-1.0';
}

// ============================================
// 從 requirement_spec 提取所有 Story ID
// ============================================
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

// ============================================
// 檢查所有 Story 是否都有 implementation_plan
// ============================================
function checkAllStoriesPlanned(pocPath, implementationPlans) {
    const allStories = extractAllStories(pocPath);
    const plannedStories = implementationPlans.map(f => {
        const m = f.match(/Story-(\d+\.\d+)/i);
        return m ? `Story-${m[1]}` : null;
    }).filter(Boolean);
    
    return allStories.every(s => plannedStories.includes(s));
}

// ============================================
// 找出缺少 plan 的第一個 Story
// ============================================
function findMissingStoryPlan(pocPath, implementationPlans) {
    const allStories = extractAllStories(pocPath);
    const plannedStories = implementationPlans.map(f => {
        const m = f.match(/Story-(\d+\.\d+)/i);
        return m ? `Story-${m[1]}` : null;
    }).filter(Boolean);
    
    const missing = allStories.find(s => !plannedStories.includes(s));
    return missing || allStories[0];
}

// ============================================
// 從 logs 目錄讀取最新已 PASS 的 step
// ============================================
/**
 * 從 logs 目錄讀取最新已 PASS 的 step
 * 支援兩種檔名格式（向後相容）：
 *   舊: poc-step-2-pass-2026-02-10T15-44-44.log
 *   新: build-phase-2-Story-1.0-pass-2026-02-10T16-10-25.log
 * 
 * @param {string} logsDir - logs 目錄路徑
 * @param {string} phasePrefix - 階段前綴 (e.g. 'poc-step', 'plan-step', 'build-phase')
 * @param {string} [storyFilter] - 可選的 Story ID 過濾 (e.g. 'Story-1.0')
 */
function getLatestPassedStep(logsDir, phasePrefix, storyFilter = null) {
    if (!fs.existsSync(logsDir)) return null;
    
    let logFiles = fs.readdirSync(logsDir)
        .filter(f => f.startsWith(`${phasePrefix}-`) && f.includes('-pass-'))
        .sort();
    
    // 如果指定了 Story 過濾，只看該 Story 的 logs
    if (storyFilter) {
        logFiles = logFiles.filter(f => f.includes(storyFilter));
    }
    
    if (logFiles.length === 0) return null;
    
    // 從最新的 pass log 提取 step 號碼
    // 舊格式: poc-step-2-pass-2026-02-10T15-44-44.log
    // 新格式: build-phase-2-Story-1.0-pass-2026-02-10T16-10-25.log
    let maxStep = 0;
    for (const f of logFiles) {
        // 匹配 phasePrefix-{N}-pass- 或 phasePrefix-{N}-Story-X.Y-pass-
        const match = f.match(new RegExp(`${phasePrefix}-(\\d+)-(?:Story-[\\d.]+-)?(pass)-`));
        if (match) {
            const step = parseInt(match[1], 10);
            if (step > maxStep) maxStep = step;
        }
    }
    
    return maxStep || null;
}

// ============================================
// 偵測專案狀態
// ============================================

/**
 * P0 State Ledger: 從 .state.json 讀取狀態（O(1) 快速路徑）
 * 如果 state.json 存在且有效，直接返回；否則返回 null 讓 fallback 接手
 */
function detectFromStateLedger(projectPath) {
    let stateManager;
    try {
        stateManager = require(path.join(TASK_PIPE_ROOT, 'lib', 'shared', 'state-manager-v3.cjs'));
    } catch (e) {
        return null; // state-manager 不可用，fallback
    }

    const iteration = stateManager.detectActiveIteration(projectPath);
    if (!iteration) return null;

    const state = stateManager.readState(projectPath, iteration);
    if (!state || !state.flow || !state.flow.currentNode) return null;

    // 只信任 ACTIVE 狀態的 state.json
    if (state.status && state.status !== 'active') {
        // COMPLETED/ABANDONED → 讓 detectActiveIteration 處理（它會 +1）
        // 但如果是 COMPLETED，直接返回 COMPLETE
        if (state.status === 'completed') {
            return { phase: 'COMPLETE', step: null, iteration, reason: `State Ledger: ${iteration} 已完成`, source: 'state_ledger' };
        }
        return null; // ABANDONED → fallback 決定下一步
    }

    const { phase, step } = stateManager.parseNode(state.flow.currentNode);

    if (!phase) {
        // currentNode = 'COMPLETE'
        return { phase: 'COMPLETE', step: null, iteration, reason: 'State Ledger: COMPLETE', source: 'state_ledger' };
    }

    const result = { phase, step, iteration, reason: `State Ledger: ${state.flow.currentNode}`, source: 'state_ledger' };

    // BUILD 階段需要 story 資訊
    if (phase === 'BUILD' && state.stories) {
        const inProgressStory = Object.keys(state.stories).find(
            s => state.stories[s].status === 'in-progress'
        );
        const pendingStory = Object.keys(state.stories).find(
            s => state.stories[s].status === 'pending'
        );
        result.story = inProgressStory || pendingStory || null;
    }

    return result;
}

function detectProjectState(projectPath, detectedLevel = 'M') {
    // === P0 State Ledger: 快速路徑 ===
    const ledgerResult = detectFromStateLedger(projectPath);
    if (ledgerResult) {
        // Cynefin Gate: BUILD 進入前必須有 cynefin-check-pass log
        // Blueprint 路線走 State Ledger 會跳過 filesystem fallback 的 cynefin 判斷
        if (ledgerResult.phase === 'BUILD' && ledgerResult.step === '1') {
            const logsPath = path.join(projectPath, '.gems', 'iterations', ledgerResult.iteration, 'logs');
            const hasCynefinPass = fs.existsSync(logsPath) &&
                fs.readdirSync(logsPath).some(f => f.startsWith('cynefin-check-pass-'));
            if (!hasCynefinPass) {
                return { phase: 'CYNEFIN_CHECK', iteration: ledgerResult.iteration, reason: 'BUILD 前需要 Cynefin 語意域分析', source: 'state_ledger' };
            }
        }
        return ledgerResult;
    }

    // === Fallback: 檔案系統掃描（舊邏輯） ===
    const gemsPath = path.join(projectPath, '.gems', 'iterations');
    
    if (!fs.existsSync(gemsPath)) {
        return { phase: 'POC', step: '1', iteration: 'iter-1', reason: '無 .gems 目錄', source: 'filesystem' };
    }
    
    // 找最新的 iteration
    const iterations = fs.readdirSync(gemsPath)
        .filter(d => d.startsWith('iter-'))
        .sort((a, b) => {
            const numA = parseInt(a.replace('iter-', ''), 10);
            const numB = parseInt(b.replace('iter-', ''), 10);
            return numB - numA;
        });
    
    if (iterations.length === 0) {
        return { phase: 'POC', step: '1', iteration: 'iter-1', reason: '無迭代目錄', source: 'filesystem' };
    }
    
    const latestIter = iterations[0];
    const iterPath = path.join(gemsPath, latestIter);
    
    // 檢查各階段產物
    const pocPath = path.join(iterPath, 'poc');
    const planPath = path.join(iterPath, 'plan');
    const buildPath = path.join(iterPath, 'build');
    const logsPath = path.join(iterPath, 'logs');
    
    // 檢查 BUILD 完成
    if (fs.existsSync(buildPath)) {
        const buildFiles = fs.readdirSync(buildPath);
        const hasFillback = buildFiles.some(f => f.startsWith('Fillback_'));
        const hasSuggestions = buildFiles.some(f => f.startsWith('iteration_suggestions_'));
        
        if (hasFillback && hasSuggestions) {
            // 檢查是否所有 Story 都完成（有 plan 的 Story 都要有 Fillback）
            if (fs.existsSync(planPath)) {
                const planFiles = fs.readdirSync(planPath);
                const planStories = planFiles
                    .filter(f => f.startsWith('implementation_plan_'))
                    .map(f => { const m = f.match(/Story-(\d+\.\d+)/); return m ? `Story-${m[1]}` : null; })
                    .filter(Boolean);
                const completedStories = buildFiles
                    .filter(f => f.startsWith('Fillback_'))
                    .map(f => { const m = f.match(/Story-(\d+\.\d+)/); return m ? `Story-${m[1]}` : null; })
                    .filter(Boolean);
                
                const allDone = planStories.every(s => completedStories.includes(s));
                
                if (!allDone) {
                    // 還有 Story 未完成，找下一個
                    const nextStory = planStories.find(s => !completedStories.includes(s));
                    const latestBuildPhase = getLatestPassedStep(logsPath, 'build-phase', nextStory);
                    const nextPhase = latestBuildPhase ? (getNextBuildPhase(detectedLevel, latestBuildPhase) || 8) : 1;
                    return { phase: 'BUILD', step: String(nextPhase), iteration: latestIter, story: nextStory, reason: `Story ${nextStory} 尚未完成 BUILD` };
                }
            }
            
            // 全部完成 → 檢查是否已跑過 SCAN
            const scanLogExists = fs.existsSync(logsPath) && fs.readdirSync(logsPath).some(f => f.startsWith('scan-') && f.includes('-pass-'));
            
            if (!scanLogExists) {
                return { phase: 'SCAN', step: 'scan', iteration: latestIter, reason: 'BUILD 全部完成，需要 SCAN' };
            }
            
            return { phase: 'COMPLETE', step: null, iteration: latestIter, reason: `BUILD + SCAN 完成 (${latestIter})` };
        }
    }
    
    // 檢查 PLAN 完成
    if (fs.existsSync(planPath)) {
        const planFiles = fs.readdirSync(planPath);
        const implementationPlans = planFiles.filter(f => f.startsWith('implementation_plan_'));
        
        if (implementationPlans.length > 0) {
            // 從 requirement_spec 讀取所有 Story，確認每個都有 plan
            const allStoriesPlanned = checkAllStoriesPlanned(pocPath, implementationPlans);
            
            if (allStoriesPlanned) {
                // 所有 Story 都有 plan，進入 BUILD
                const planStoryFile = implementationPlans[0];
                const storyMatch = planStoryFile.match(/Story-(\d+\.\d+)/i);
                const story = storyMatch ? `Story-${storyMatch[1]}` : detectFirstStory(pocPath);
                
                // 檢查 BUILD logs 找最新完成的 phase
                const latestBuildPhase = getLatestPassedStep(logsPath, 'build-phase', story);
                if (latestBuildPhase) {
                    const nextPhase = getNextBuildPhase(detectedLevel, latestBuildPhase) || 8;
                    return { phase: 'BUILD', step: String(nextPhase), iteration: latestIter, story, reason: `PLAN 完成 (${implementationPlans.length} plans), 最新完成 BUILD Phase ${latestBuildPhase}` };
                }
                return { phase: 'BUILD', step: '1', iteration: latestIter, story, reason: `PLAN 完成 (${implementationPlans.length} plans)` };
            } else {
                // 還有 Story 缺 plan，繼續 PLAN Step 2
                const missingStory = findMissingStoryPlan(pocPath, implementationPlans);
                const latestPlanStep = getLatestPassedStep(logsPath, 'plan-step', missingStory);
                return { phase: 'PLAN', step: '2', iteration: latestIter, story: missingStory, reason: `尚有 Story 缺 plan (已有 ${implementationPlans.length} 個)` };
            }
        }
    }
    
    // 檢查 POC 完成 → 進入 PLAN
    if (fs.existsSync(pocPath)) {
        const pocFiles = fs.readdirSync(pocPath);
        const hasSpec = pocFiles.some(f => f.startsWith('requirement_spec_'));
        const hasDraft = pocFiles.some(f => f.startsWith('requirement_draft_'));
        
        if (hasSpec) {
            // 有 spec，先確認 cynefin-check 是否通過
            const hasCynefinPass = fs.existsSync(logsPath) &&
                fs.readdirSync(logsPath).some(f => f.startsWith('cynefin-check-pass-'));

            if (!hasCynefinPass) {
                return { phase: 'CYNEFIN_CHECK', iteration: latestIter, reason: 'POC 完成，需要 Cynefin 語意域分析後才能進 PLAN' };
            }

            // cynefin-check 通過，檢查 PLAN logs 找最新完成的 step
            // PLAN Step 2+ 需要 story 參數，從 spec 中偵測第一個 Story
            const story = detectFirstStory(pocPath);
            const latestPlanStep = getLatestPassedStep(logsPath, 'plan-step', story);
            if (latestPlanStep) {
                const nextStep = Math.min(latestPlanStep + 1, 5);
                return { phase: 'PLAN', step: String(nextStep), iteration: latestIter, story, reason: `有 requirement_spec, 最新完成 PLAN Step ${latestPlanStep}` };
            }
            return { phase: 'PLAN', step: '1', iteration: latestIter, reason: '有 requirement_spec' };
        }
        
        if (hasDraft) {
            // 讀取 draft 內容判斷是否已 PASS
            const draftFile = pocFiles.find(f => f.startsWith('requirement_draft_'));
            const draftContent = fs.readFileSync(path.join(pocPath, draftFile), 'utf8');
            const draftPassed = /\*\*草稿狀態\*\*:\s*(\[OK\]|✅)?\s*PASS/i.test(draftContent) ||
                                /\*\*狀態\*\*:\s*✅\s*PASS/i.test(draftContent);
            
            if (draftPassed) {
                // Draft 已 PASS，檢查 logs 找最新完成的 POC step
                const latestPocStep = getLatestPassedStep(logsPath, 'poc-step');
                const nextStep = latestPocStep ? Math.min(latestPocStep + 1, 5) : 2;
                return { phase: 'POC', step: String(nextStep), iteration: latestIter, reason: `Draft PASS, 最新完成 POC Step ${latestPocStep || 1}` };
            }
            // Draft 未 PASS，繼續 POC Step 1
            return { phase: 'POC', step: '1', iteration: latestIter, reason: '有 requirement_draft (未 PASS)' };
        }
    }
    
    return { phase: 'POC', step: '1', iteration: latestIter, reason: '預設從 POC 開始' };
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
    
    // 如果下一個 iteration 已存在（已手動建立），不覆蓋
    const nextPocPath = path.join(nextIterPath, 'poc');
    const nextDraftPath = path.join(nextPocPath, `requirement_draft_${nextIterName}.md`);
    if (fs.existsSync(nextDraftPath)) {
        log(`  ℹ️  ${nextDraftPath} 已存在，跳過產生`, 'yellow');
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
            
            if (json.suggestions && Array.isArray(json.suggestions)) {
                allSuggestions.push(...json.suggestions);
            }
            if (json.technicalDebt && Array.isArray(json.technicalDebt)) {
                allTechDebt.push(...json.technicalDebt);
            }
            if (json.nextIteration) {
                if (json.nextIteration.suggestedGoal && json.nextIteration.suggestedGoal !== '// TODO: AI 填寫下次迭代目標') {
                    nextGoal = json.nextIteration.suggestedGoal;
                }
                if (json.nextIteration.suggestedItems) {
                    allNextItems.push(...json.nextIteration.suggestedItems);
                }
            }
        } catch (e) {
            // 忽略 JSON 解析錯誤
        }
    }
    
    // 如果沒有任何有意義的建議，不產生
    const hasContent = allSuggestions.length > 0 || allTechDebt.length > 0 || allNextItems.length > 0;
    if (!hasContent) return null;
    
    // 讀取前一個 iteration 的 requirement_spec 取得專案資訊
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
    
    // 產生 requirement_draft
    const draft = generateIterationDraft({
        projectName,
        iterName: nextIterName,
        prevIter: completedIter,
        prevLevel,
        nextGoal,
        suggestions: allSuggestions,
        techDebt: allTechDebt,
        nextItems: allNextItems
    });
    
    // 寫入檔案
    fs.mkdirSync(nextPocPath, { recursive: true });
    fs.writeFileSync(nextDraftPath, draft, 'utf-8');
    
    return {
        iteration: nextIterName,
        draftPath: path.relative(projectPath, nextDraftPath),
        suggestionsCount: suggestionsFiles.length
    };
}

/**
 * 產生迭代需求草稿
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
    
    // 合併 suggestions 和 techDebt 為功能模組
    const modules = [];
    
    // 從 nextItems 產生模組
    for (const item of uniqueItems) {
        const name = typeof item === 'string' ? item : item.name;
        const priority = typeof item === 'string' ? 'P1' : (item.priority || 'P1');
        modules.push(`- [x] ${name} (${priority})`);
    }
    
    // 從 techDebt 產生模組（如果不在 nextItems 中）
    for (const td of techDebt) {
        if (td.priority === 'HIGH' || td.priority === 'MEDIUM') {
            const name = td.description || td.id;
            if (!seen.has(name)) {
                seen.add(name);
                modules.push(`- [x] [技術債] ${name} (${td.priority})`);
            }
        }
    }
    
    // 從 suggestions 產生模組（如果不在 nextItems 中）
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

// ============================================
// P5: @RESUME — 中斷續接偵測
// ============================================
function detectResume(projectPath) {
    const gemsPath = path.join(projectPath, '.gems', 'iterations');
    if (!fs.existsSync(gemsPath)) return null;

    const iterations = fs.readdirSync(gemsPath)
        .filter(d => d.startsWith('iter-'))
        .sort((a, b) => {
            const numA = parseInt(a.replace(/iter-(quick-)?/, ''), 10);
            const numB = parseInt(b.replace(/iter-(quick-)?/, ''), 10);
            return numB - numA;
        });

    for (const iter of iterations) {
        const logsPath = path.join(gemsPath, iter, 'logs');
        if (!fs.existsSync(logsPath)) continue;

        const logFiles = fs.readdirSync(logsPath).sort();
        // 找最新的 error log（代表中斷點）
        const errorLogs = logFiles.filter(f => f.includes('-error-') || f.includes('-fix-'));
        if (errorLogs.length === 0) continue;

        const latestError = errorLogs[errorLogs.length - 1];
        // 解析 phase/step/story
        const match = latestError.match(/(poc-step|plan-step|build-phase)-(\d+)(?:-(Story-[\d.]+))?/);
        if (match) {
            const phaseMap = { 'poc-step': 'POC', 'plan-step': 'PLAN', 'build-phase': 'BUILD' };
            const phase = phaseMap[match[1]];
            const step = match[2];
            const story = match[3] || null;
            // 提取時間戳
            const tsMatch = latestError.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
            const timestamp = tsMatch ? tsMatch[1].replace(/-/g, (m, i) => i > 9 ? ':' : '-') : null;

            // 確認這個 phase 沒有後續的 pass log
            const passAfter = logFiles.some(f =>
                f.startsWith(`${match[1]}-${step}`) && f.includes('-pass-') &&
                f > latestError
            );
            if (!passAfter) {
                return { iteration: iter, phase, step, story, timestamp };
            }
        }
    }
    return null;
}

// ============================================
// P5: Quick Mode — iter-quick-NNN 命名
// ============================================
function getQuickIterationName(projectPath) {
    const gemsPath = path.join(projectPath, '.gems', 'iterations');
    if (!fs.existsSync(gemsPath)) {
        return 'iter-quick-001';
    }
    const existing = fs.readdirSync(gemsPath)
        .filter(d => d.startsWith('iter-quick-'))
        .map(d => parseInt(d.replace('iter-quick-', ''), 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => b - a);
    const next = (existing[0] || 0) + 1;
    return `iter-quick-${String(next).padStart(3, '0')}`;
}

// ============================================
// 執行 Runner
// ============================================
function runRunner(projectPath, phase, step, iteration, level, story, dryRun, quick = false) {
    const runnerPath = path.join(TASK_PIPE_ROOT, 'runner.cjs');
    
    const args = [
        runnerPath,
        `--phase=${phase}`,
    ];
    
    // SCAN 不需要 step 參數，runner.cjs 會自動找 scan.cjs
    if (step && phase !== 'SCAN') {
        args.push(`--step=${step}`);
    }
    
    args.push(
        `--target=${projectPath}`,
        `--iteration=${iteration}`,
        `--level=${level}`,
    );
    
    if (story) {
        args.push(`--story=${story}`);
    }
    
    if (quick) {
        args.push('--quick');
    }

    if (dryRun) {
        log('\n🧪 [DRY-RUN] 將執行:', 'yellow');
        log(`   node ${args.join(' ')}`, 'cyan');
        return { success: true, output: '[DRY-RUN]' };
    }
    
    log(`\n🚀 執行: ${phase} Step ${step}`, 'blue');
    log(`   node runner.cjs --phase=${phase} --step=${step} --target=${projectPath}`, 'cyan');
    
    const result = spawnSync('node', args, {
        stdio: 'inherit',
        cwd: TASK_PIPE_ROOT,
        encoding: 'utf-8'
    });
    
    return {
        success: result.status === 0,
        exitCode: result.status
    };
}

// ============================================
// 主程式
// ============================================
function main() {
    const args = parseArgs();
    
    // 顯示幫助
    if (args.help) {
        showHelp();
        return;
    }
    
    log('╔════════════════════════════════════════════════════════════╗', 'magenta');
    log('║        🔄 SDID Loop v4 - 單次執行模式                      ║', 'magenta');
    log('╚════════════════════════════════════════════════════════════╝', 'magenta');
    
    const isQuick = args.mode === 'quick';
    if (isQuick) {
        log('  ⚡ Quick Mode — 小步快跑 (Phase [1,2,5,7])', 'yellow');
    }
    
    // 處理新專案
    let projectPath = args.project;
    if (args.new) {
        const projectName = args.project ? path.basename(args.project) : null;
        projectPath = initNewProject(args.type, projectName);
    }
    
    if (!projectPath) {
        log('\n❌ 請指定專案路徑: --project=<path> 或使用 --new 建立新專案', 'red');
        process.exit(1);
    }
    
    // 確保專案存在
    if (!fs.existsSync(projectPath)) {
        log(`\n❌ 專案不存在: ${projectPath}`, 'red');
        process.exit(1);
    }
    
    log(`\n📁 專案: ${projectPath}`, 'cyan');
    
    // P5: @RESUME — 中斷續接偵測
    if (!args.forceStart && !args.new) {
        const resume = detectResume(projectPath);
        if (resume) {
            log(`\n@RESUME: ${resume.phase} Phase ${resume.step}${resume.story ? `, ${resume.story}` : ''} (中斷於 ${resume.timestamp || '未知'})`, 'yellow');
        }
    }

    // P5: Quick Mode — 使用 iter-quick-NNN
    let quickIteration = null;
    if (isQuick && !args.forceStart) {
        quickIteration = getQuickIterationName(projectPath);
        log(`  📦 Quick iteration: ${quickIteration}`, 'cyan');
    }

    // 偵測或強制指定狀態
    let state;
    if (args.forceStart) {
        const match = args.forceStart.match(/^(POC|PLAN|BUILD|SCAN)-?(\d+)?$/i);
        if (match) {
            state = {
                phase: match[1].toUpperCase(),
                step: match[2] || '1',
                iteration: 'iter-1',
                reason: `強制指定: ${args.forceStart}`
            };
        } else {
            log(`\n❌ 無效的 --force-start 格式: ${args.forceStart}`, 'red');
            log('   有效格式: POC-1, PLAN-1, BUILD-1, SCAN', 'yellow');
            process.exit(1);
        }
    } else {
        state = detectProjectState(projectPath, args.level);
    }
    
    log(`📍 狀態: ${state.phase} Step ${state.step} (${state.iteration})`, 'cyan');
    log(`   原因: ${state.reason}`, 'cyan');
    
    // P5: Quick Mode — 覆寫 iteration 為 iter-quick-NNN
    if (isQuick && quickIteration) {
        state.iteration = quickIteration;
        // Quick Mode 門控: PLAN-5 → BUILD 1,2,5,7
        if (state.phase === 'POC') {
            // Quick Mode 跳過 POC，直接 PLAN-5
            state.phase = 'PLAN';
            state.step = '5';
            state.reason = 'Quick Mode: 跳過 POC，從 PLAN-5 開始';
            log(`  ⚡ Quick Mode 覆寫: PLAN Step 5`, 'yellow');
        }
    }
    
    // 檢查是否完成
    if (state.phase === 'COMPLETE') {
        log(`\n✅ ${state.iteration} 所有階段已完成！`, 'green');
        
        // 自我迭代：從 suggestions 產生下一個 iteration 的 requirement_draft
        const nextIter = generateNextIteration(projectPath, state.iteration);
        
        if (nextIter) {
            log(`\n🔄 自動產生 ${nextIter.iteration} 需求草稿`, 'blue');
            log(`   來源: ${nextIter.suggestionsCount} 個 suggestions`, 'cyan');
            log(`   草稿: ${nextIter.draftPath}`, 'cyan');
            log(`\n@NEXT_ACTION`, 'yellow');
            log(`請檢閱 ${nextIter.draftPath}，確認需求後再次執行此腳本。`, 'yellow');
            log(`或直接執行: node loop.cjs --project=${projectPath}`, 'yellow');
        } else {
            log('\n' + COMPLETE_SIGNAL, 'green');
            log('無更多迭代建議，專案開發完成！', 'green');
        }
        return;
    }
    
    // CYNEFIN_CHECK: AI 語意域分析（不走 runner，直接輸出 @TASK 指引）
    if (state.phase === 'CYNEFIN_CHECK') {
        const iterPath = path.join(projectPath, '.gems', 'iterations', state.iteration);
        const pocPath = path.join(iterPath, 'poc');
        let inputFile = null;
        if (fs.existsSync(pocPath)) {
            const specFile = fs.readdirSync(pocPath).find(f => f.startsWith('requirement_spec_'));
            const draftFile = fs.readdirSync(pocPath).find(f => f.startsWith('requirement_draft_'));
            inputFile = specFile || draftFile;
        }
        const inputPath = inputFile ? path.join(pocPath, inputFile) : `${iterPath}/poc/requirement_spec_${state.iteration}.md`;

        log(`\n🔍 CYNEFIN-CHECK: 語意域分析`, 'cyan');
        log(`\n@TASK`, 'yellow');
        log(`ACTION: 讀 .agent/skills/sdid/references/cynefin-check.md 對以下文件做語意域分析`, 'yellow');
        log(`FILE: ${inputPath}`, 'yellow');
        log(`EXPECTED: 產出 report JSON → 執行 node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> --target=${projectPath} --iter=${state.iteration.replace('iter-', '')}`, 'yellow');
        log(`\n@REMINDER: 分析完成後必須執行 cynefin-log-writer.cjs 存 log，@PASS 才能進 PLAN`, 'yellow');
        return;
    }

    // 執行 runner
    const result = runRunner(
        projectPath,
        state.phase,
        state.step,
        state.iteration,
        args.level,
        args.story || state.story || null,
        args.dryRun,
        isQuick
    );
    
    // 輸出結果
    if (result.success) {
        log('\n✅ 執行完成', 'green');
        log('\n@NEXT_ACTION', 'yellow');
        log('請讀取上方輸出，根據 @TASK 指示執行任務，完成後再次執行此腳本。', 'yellow');
    } else {
        log('\n❌ 執行失敗', 'red');
        log('\n@NEXT_ACTION', 'yellow');
        log('請讀取 .gems/iterations/iter-X/logs/ 下最新的 error log，', 'yellow');
        log('根據 @TACTICAL_FIX 指示修正後，再次執行此腳本。', 'yellow');
    }
}

// ============================================
// 幫助訊息
// ============================================
function showHelp() {
    log(`
${c.bold}SDID Loop v4 - 單次執行模式${c.reset}

${c.bold}用法:${c.reset}
  node loop.cjs --project=<path>                    偵測狀態並執行下一步
  node loop.cjs --new --project=<name> --type=todo  建立新專案
  node loop.cjs --project=<path> --force-start=POC-1  強制從指定步驟開始

${c.bold}選項:${c.reset}
  --project=<path>        專案路徑 (必填)
  --new                   建立新專案
  --type=<type>           新專案類型 (todo, calculator, note, counter, 或任意自訂類型)
  --level=<S|M|L>         執行等級 (預設: M)
  --force-start=<PHASE-N> 強制從指定步驟開始 (POC-1, PLAN-1, BUILD-1)
  --mode=<full|quick>     執行模式 (預設: full, quick=小步快跑)
  --story=<Story-X.Y>     指定 Story ID (BUILD 階段)
  --dry-run               預覽模式
  --help                  顯示此訊息

${c.bold}範例:${c.reset}
  ${c.cyan}# 新專案${c.reset}
  node loop.cjs --new --project=my-todo --type=todo

  ${c.cyan}# 繼續現有專案${c.reset}
  node loop.cjs --project=./my-todo

  ${c.cyan}# 強制從 POC Step 1 開始${c.reset}
  node loop.cjs --project=./my-todo --force-start=POC-1
`);
}

// 執行
main();
