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

// 共用業務邏輯來自 orchestrator
const orc = require(path.join(TASK_PIPE_ROOT, '..', 'sdid-core', 'orchestrator.cjs'));
const {
  BUILD_PHASES,
  getNextBuildPhase,
  getLatestPassedStep,
  detectFirstStory,
  extractAllStories,
  checkAllStoriesPlanned,
  findMissingStoryPlan,
  detectProjectState: orcDetectProjectState,
  generateDraft,
  initNewProject: orcInitNewProject,
  generateIterationDraft,
  generateNextIteration,
} = orc;

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
// 新專案初始化 (thin wrapper — logic in orchestrator)
// ============================================
function initNewProject(type, projectName) {
    log('\n📦 初始化新專案...', 'blue');
    const projectPath = orcInitNewProject(type, projectName);
    log(`  ✅ 專案建立: ${projectPath}`, 'green');
    log(`  ✅ Draft 建立: ${path.join(projectPath, '.gems', 'iterations', 'iter-1', 'poc', 'requirement_draft_iter-1.md')}`, 'green');
    return projectPath;
}

// detectFirstStory, extractAllStories, checkAllStoriesPlanned,
// findMissingStoryPlan, getLatestPassedStep — 來自 orchestrator（頂部 destructure）

// detectProjectState: thin CLI wrapper → orchestrator
function detectProjectState(projectPath, _detectedLevel) {
    return orcDetectProjectState(projectPath);
}

// generateNextIteration, generateIterationDraft — 來自 orchestrator（頂部 destructure）

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
        // 多 Story 檢查：COMPLETE 前先確認所有 Story 的 BUILD 都完成
        const planPath = path.join(projectPath, '.gems', 'iterations', state.iteration, 'plan');
        const buildPath = path.join(projectPath, '.gems', 'iterations', state.iteration, 'build');
        if (fs.existsSync(planPath)) {
            const planFiles = fs.readdirSync(planPath).filter(f => f.startsWith('implementation_plan_'));
            const completedStories = fs.existsSync(buildPath)
                ? fs.readdirSync(buildPath).filter(f => f.startsWith('Fillback_')).map(f => { const m = f.match(/Story-(\d+\.\d+)/); return m ? `Story-${m[1]}` : null; }).filter(Boolean)
                : [];
            const allPlanStories = planFiles.map(f => { const m = f.match(/Story-(\d+\.\d+)/i); return m ? `Story-${m[1]}` : null; }).filter(Boolean).sort();
            const nextIncompleteStory = allPlanStories.find(s => !completedStories.includes(s));
            if (nextIncompleteStory) {
                log(`\n📋 還有未完成的 Story: ${nextIncompleteStory}，繼續 BUILD`, 'yellow');
                // 把 state 改回 BUILD-1 for next story
                try {
                    const stateManager = require(path.join(TASK_PIPE_ROOT, 'lib', 'shared', 'state-manager-v3.cjs'));
                    const current = stateManager.readState(projectPath, state.iteration) || {};
                    current.flow = current.flow || {};
                    current.flow.currentNode = 'BUILD-1';
                    current.lastUpdated = new Date().toISOString();
                    stateManager.writeState(projectPath, state.iteration, current);
                } catch (e) {
                    const stateFile = path.join(projectPath, '.gems', 'iterations', state.iteration, '.state.json');
                    if (fs.existsSync(stateFile)) {
                        const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
                        s.flow = s.flow || {};
                        s.flow.currentNode = 'BUILD-1';
                        s.lastUpdated = new Date().toISOString();
                        fs.writeFileSync(stateFile, JSON.stringify(s, null, 2), 'utf8');
                    }
                }
                const result = runRunner(projectPath, 'BUILD', '1', state.iteration, args.level, nextIncompleteStory, args.dryRun, isQuick);
                if (result.success) {
                    log('\n✅ 執行完成', 'green');
                } else {
                    log('\n❌ 執行失敗', 'red');
                }
                log('\n@NEXT_ACTION', 'yellow');
                log('請讀取上方輸出，根據 @TASK 指示執行任務，完成後再次執行此腳本。', 'yellow');
                return;
            }
        }

        log(`\n✅ ${state.iteration} 所有階段已完成！`, 'green');

        // Blueprint 路線：所有 iter 完成後進入下一個 iter 或最終完成
        const iterNum = parseInt(state.iteration.replace('iter-', ''), 10);
        const draftPath = state.draftPath || null;

        {
            // Blueprint Flow: COMPLETE 後應走 blueprint-expand（進入下一個 iter）

            // 從 iterationPlan 找下一個 [STUB] 的 iter 編號
            let nextIterNum = iterNum + 1; // fallback
            if (draftPath) {
                try {
                    const draftParser = require(path.join(TASK_PIPE_ROOT, '..', 'sdid-tools', 'lib', 'draft-parser-standalone.cjs'));
                    const draft = draftParser.load(draftPath);
                    if (draft.iterationPlan && draft.iterationPlan.length > 0) {
                        // 找第一個尚未完成的 iter（STUB 或 CURRENT，不是 DONE）
                        const nextEntry = draft.iterationPlan.find(e =>
                            e.iter > iterNum &&
                            e.status !== '[DONE]' && e.status !== 'DONE'
                        );
                        if (nextEntry) {
                            nextIterNum = nextEntry.iter;
                            log(`  📋 從 iterationPlan 偵測到下一個 iter: iter-${nextIterNum} (${nextEntry.status || 'STUB'})`, 'cyan');
                        } else {
                            // 沒有更多未完成的 iter → 真正完成
                            log('\n' + COMPLETE_SIGNAL, 'green');
                            log('🎉 Blueprint Flow 全部 iter 已完成！', 'green');
                            return;
                        }
                    }
                } catch (e) {
                    log(`  ⚠ 無法解析 iterationPlan，使用 iter-${nextIterNum} 作為下一個 iter`, 'yellow');
                }
            }

            // 檢查下一個 iter 的 logs 是否已有 gate-expand-pass（expand 已跑過）
            const nextLogsDir = path.join(projectPath, '.gems', 'iterations', `iter-${nextIterNum}`, 'logs');
            const expandAlreadyDone = fs.existsSync(nextLogsDir) &&
                fs.readdirSync(nextLogsDir).some(f => f.startsWith('gate-expand-pass-'));

            if (expandAlreadyDone) {
                log(`\n🔄 iter-${nextIterNum} expand 已完成，直接進入 GATE`, 'blue');
                log(`\n@NEXT_ACTION`, 'yellow');
                if (draftPath) {
                    log(`node sdid-tools/blueprint/gate.cjs --draft="${draftPath}" --target="${projectPath}" --iter=${nextIterNum}`, 'yellow');
                } else {
                    log(`node sdid-tools/blueprint/gate.cjs --draft=<draft_path> --target="${projectPath}" --iter=${nextIterNum}`, 'yellow');
                }
            } else {
                log(`\n📐 Blueprint Flow: 執行 blueprint-expand 進入 iter-${nextIterNum}`, 'blue');
                log(`\n@NEXT_ACTION`, 'yellow');
                if (draftPath) {
                    log(`node sdid-tools/blueprint/expand.cjs --draft="${draftPath}" --iter=${nextIterNum} --target="${projectPath}"`, 'yellow');
                } else {
                    log(`node sdid-tools/blueprint/expand.cjs --draft=<draft_path> --iter=${nextIterNum} --target="${projectPath}"`, 'yellow');
                    log(`  ⚠ 找不到 draft 路徑，請手動指定`, 'yellow');
                }
            }
        }
        return;
    }
    
    // SPEC_TO_PLAN: v5 legacy Task-Pipe 路線（已退休，不再作為主流程入口）
    // 保留此 block 僅供 legacy 專案偵測；新專案走 Blueprint → Draft → Contract 主流程
    if (state.phase === 'SPEC_TO_PLAN') {
        log(`\n⚠️  [Legacy] SPEC_TO_PLAN 是 v5 Task-Pipe 路線，目前已退休。`, 'yellow');
        log(`  請將 draft_iter-N.md 放到 .gems/design/ 並重新執行，進入新版 Blueprint 主流程。`, 'yellow');
        log(`\n@NEXT_ACTION`, 'yellow');
        log(`node sdid-tools/blueprint/v5/draft-gate.cjs --draft=<draft> --target=${projectPath}`, 'yellow');
        return;
    }
    // Blueprint GATE: 輸出 blueprint-gate.cjs 指令（不走 runner）
    if (state.phase === 'GATE') {
        const iterNum = parseInt(state.iteration.replace('iter-', ''), 10);
        let stateMachine = null;
        try { stateMachine = require(path.join(TASK_PIPE_ROOT, '..', 'sdid-core', 'state-machine.cjs')); } catch {}

        // Blueprint 活藍圖在最早有 draft 的 iter（通常是 iter-1 或 iter-2）
        // 往前找，直到找到 draft
        let draftPath = null;
        for (let i = iterNum; i >= 1; i--) {
            const found = stateMachine ? stateMachine.findDraft(projectPath, i) : null;
            if (found) { draftPath = found; break; }
        }

        log(`\n📐 Blueprint GATE: iter-${iterNum} 需要 Gate 驗證`, 'cyan');
        log(`\n@NEXT_ACTION`, 'yellow');
        if (draftPath) {
            log(`node sdid-tools/blueprint/gate.cjs --draft="${draftPath}" --target="${projectPath}" --iter=${iterNum}`, 'yellow');
        } else {
            log(`node sdid-tools/blueprint/gate.cjs --draft=<draft_path> --target="${projectPath}" --iter=${iterNum}`, 'yellow');
            log(`  ⚠ 找不到 draft 路徑，請手動指定`, 'yellow');
        }
        return;
    }

    // ─── POC Step 3 後置 gate: TDD LITE 交叉驗證（contract 寫完後立即執行）────────────
    if (state.phase === 'POC' && String(state.step) === '3') {
        const iterPath = path.join(projectPath, '.gems', 'iterations', state.iteration);
        const logsDir = path.join(iterPath, 'logs');
        const pocDir = path.join(iterPath, 'poc');
        const contractPath = path.join(pocDir, `contract_${state.iteration}.ts`);
        const tddPassed = fs.existsSync(logsDir) &&
            fs.readdirSync(logsDir).some(f => f.startsWith('poc-step-3-tdd-pass'));
        if (fs.existsSync(contractPath) && !tddPassed) {
            log(`\n📋 [Task-Pipe] POC Step 3 TDD LITE Gate（contract 寫完後強制 AC cross-check）`, 'cyan');
            log(`\n@TASK`, 'yellow');
            log(`ACTION: 對 ${contractPath} 執行 TDD LITE 交叉驗證（在進 Step 4 前完成）`, 'yellow');
            log(`步驟:`, 'yellow');
            log(`  [A] 列出所有 @CONTRACT: 條目 → [(funcName, Story-X.Y), ...]`, 'yellow');
            log(`      確認每個條目有對應的 @TEST: 或 @TEST-SKIP:`, 'yellow');
            log(`      ❌ 常見錯誤：同函式有多個測試時，確認每個 @TEST: 都正確對應到實作函式`, 'yellow');
            log(`  [B] 純計算函式（LIB/CONST）的 @TEST: 測試檔必須有真實 it()/test() 呼叫（非空殼）`, 'yellow');
            log(`  [C] SVC/ROUTE 有外部依賴者：應有 @TEST-SKIP: MOCK — <理由>`, 'yellow');
            log(``, 'yellow');
            log(`若有問題：直接修正 contract.ts，無需重跑 Step 3`, 'yellow');
            log(`無問題或修正完成後，寫入 log 格式: @PASS | poc-step-3-tdd | TDD LITE 交叉驗證通過 | ${state.iteration}`, 'yellow');
            log(`log 路徑: ${path.join(logsDir, 'poc-step-3-tdd-pass-<timestamp>.log')}`, 'yellow');
            log(`寫完後再次執行此腳本繼續 Step 4`, 'yellow');
            return;
        }
    }

    // ─── POC Step 4 後置 gate: POC.HTML quality gate（design-quality-gate.md 75pt）──────
    if (state.phase === 'POC' && String(state.step) === '4') {
        const iterPath = path.join(projectPath, '.gems', 'iterations', state.iteration);
        const logsDir = path.join(iterPath, 'logs');
        const pocDir = path.join(iterPath, 'poc');
        const pocFiles = fs.existsSync(pocDir) ? fs.readdirSync(pocDir).filter(f => f.endsWith('.html')) : [];
        const htmlQualityPassed = fs.existsSync(logsDir) &&
            fs.readdirSync(logsDir).some(f => f.startsWith('poc-html-quality-pass'));
        if (pocFiles.length > 0 && !htmlQualityPassed) {
            const pocHtml = path.join(pocDir, pocFiles[0]);
            log(`\n📋 [Task-Pipe] POC Step 4 HTML Quality Gate（design-quality-gate.md 75pt 評分）`, 'cyan');
            log(`\n@TASK`, 'yellow');
            log(`ACTION: 讀 .agent/skills/sdid/references/design-quality-gate.md POC.HTML 節點評分細則`, 'yellow');
            log(`FILE: ${pocHtml}`, 'yellow');
            log(`EXPECTED: 75 分制 4 維度 @GUIDED 三態評分:`, 'yellow');
            log(`  ① Spec 路由覆蓋（30pts）— draft/spec 每個路由都有示意畫面`, 'yellow');
            log(`  ② 實體名稱與 spec 一致（25pts）— 畫面名稱與 spec 定義對齊`, 'yellow');
            log(`  ③ 關鍵互動可操作（25pts）— 非純靜態，submit 有 mock 反應`, 'yellow');
            log(`  ④ 無佔位內容（20pts）— 無 Lorem ipsum / TODO / 空白欄位`, 'yellow');
            log(``, 'yellow');
            log(`@PASS (≥75): 寫入 ${path.join(logsDir, 'poc-html-quality-pass-<timestamp>.log')}`, 'yellow');
            log(`  log 格式: @PASS | poc-html-quality | <score>/100 | ${state.iteration}`, 'yellow');
            log(`  寫完後再次執行此腳本繼續 Step 5`, 'yellow');
            log(`@GUIDED (50~74): 列出失分項 + 修法，AI 自行修正 HTML，重評只有 @PASS 或 @FAIL`, 'yellow');
            log(`@FAIL (<50): 回到 Step 4 重新產生 POC HTML`, 'yellow');
            return;
        }
    }

    // 執行 runner
    // BUILD 階段：如果 story 未指定，從 plan 目錄自動偵測第一個未完成的 Story
    let resolvedStory = args.story || state.story || null;
    if (state.phase === 'BUILD' && !resolvedStory) {
        const planPath = path.join(projectPath, '.gems', 'iterations', state.iteration, 'plan');
        const buildPath = path.join(projectPath, '.gems', 'iterations', state.iteration, 'build');
        if (fs.existsSync(planPath)) {
            const planFiles = fs.readdirSync(planPath).filter(f => f.startsWith('implementation_plan_'));
            const completedStories = fs.existsSync(buildPath)
                ? fs.readdirSync(buildPath).filter(f => f.startsWith('Fillback_')).map(f => { const m = f.match(/Story-(\d+\.\d+)/); return m ? `Story-${m[1]}` : null; }).filter(Boolean)
                : [];
            const allPlanStories = planFiles.map(f => { const m = f.match(/Story-(\d+\.\d+)/i); return m ? `Story-${m[1]}` : null; }).filter(Boolean).sort();
            resolvedStory = allPlanStories.find(s => !completedStories.includes(s)) || allPlanStories[0] || null;
            if (resolvedStory) {
                log(`  📋 自動偵測 Story: ${resolvedStory}`, 'cyan');
            }
        }
    }

    const result = runRunner(
        projectPath,
        state.phase,
        state.step,
        state.iteration,
        args.level,
        resolvedStory,
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
