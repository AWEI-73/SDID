#!/usr/bin/env node
/**
 * Blueprint Runner v2 - Enhanced Draft 驅動的開發執行器
 * 
 * 基於 SDID Enhanced Draft (Markdown) 驅動開發流程：
 * - 解析 requirement_draft 中的迭代規劃表
 * - 按 iter 順序驅動 POC → PLAN → BUILD → SCAN
 * - 支援中斷/重置/跳轉
 * - 依賴檢查 + 並行模組偵測
 * 
 * 零依賴：不需要 js-yaml，直接解析 Markdown
 * 
 * 用法:
 *   node blueprint-runner.cjs --project=./my-app
 *   node blueprint-runner.cjs --project=./my-app --iter=2
 *   node blueprint-runner.cjs --project=./my-app --status
 *   node blueprint-runner.cjs --project=./my-app --reset --iter=3
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const draftParser = require('./draft-parser.cjs');

const TASK_PIPE_ROOT = path.resolve(__dirname, '..');

// ============================================
// 顏色輸出
// ============================================
const c = {
    reset: '\x1b[0m', bold: '\x1b[1m',
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m', gray: '\x1b[90m',
};
function log(msg, color = 'reset') { console.log(`${c[color]}${msg}${c.reset}`); }

// ============================================
// 參數解析
// ============================================
function parseArgs() {
    const args = {
        project: null, iter: null, module: null,
        reset: false, status: false, dryRun: false,
        level: 'M', help: false, iteration: 'iter-1',
    };
    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith('--project=')) args.project = path.resolve(arg.split('=')[1]);
        else if (arg.startsWith('--iter=')) args.iter = parseInt(arg.split('=')[1], 10);
        else if (arg.startsWith('--module=')) args.module = arg.split('=')[1];
        else if (arg.startsWith('--level=')) args.level = arg.split('=')[1].toUpperCase();
        else if (arg.startsWith('--iteration=')) args.iteration = arg.split('=')[1];
        else if (arg === '--reset') args.reset = true;
        else if (arg === '--status') args.status = true;
        else if (arg === '--dry-run') args.dryRun = true;
        else if (arg === '--help' || arg === '-h') args.help = true;
    }
    return args;
}

// ============================================
// 藍圖狀態管理
// ============================================
class BlueprintState {
    constructor(gemsDir) {
        this.filePath = path.join(gemsDir, 'blueprint_state.json');
        this.ensureFile();
    }

    ensureFile() {
        if (!fs.existsSync(this.filePath)) {
            const initial = {
                currentIter: 1, currentModule: null,
                currentPhase: 'POC', currentStep: '1',
                completedModules: [],
                startedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                history: [],
            };
            fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2), 'utf8');
        }
    }

    load() { return JSON.parse(fs.readFileSync(this.filePath, 'utf8')); }

    save(data) {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    }

    reset(iter, reason = 'Manual reset') {
        const data = this.load();
        if (!data.history) data.history = [];
        data.history.push({
            resetAt: new Date().toISOString(),
            previousIter: data.currentIter,
            previousModule: data.currentModule,
            reason,
        });
        data.currentIter = iter;
        data.currentModule = null;
        data.currentPhase = 'POC';
        data.currentStep = '1';
        this.save(data);
        return data;
    }

    markModuleComplete(moduleId) {
        const data = this.load();
        if (!data.completedModules.includes(moduleId)) {
            data.completedModules.push(moduleId);
        }
        this.save(data);
    }

    updateProgress(iter, module, phase, step) {
        const data = this.load();
        data.currentIter = iter;
        data.currentModule = module;
        data.currentPhase = phase;
        data.currentStep = step;
        this.save(data);
    }
}

// ============================================
// 找到 Draft 檔案
// ============================================
function findDraft(projectPath, iteration) {
    const pocPath = path.join(projectPath, '.gems', 'iterations', iteration, 'poc');
    const draftPath = path.join(pocPath, `requirement_draft_${iteration}.md`);
    if (fs.existsSync(draftPath)) return draftPath;

    // fallback: 找任何 requirement_draft*.md
    if (fs.existsSync(pocPath)) {
        const files = fs.readdirSync(pocPath);
        const draft = files.find(f => f.startsWith('requirement_draft') && f.endsWith('.md'));
        if (draft) return path.join(pocPath, draft);
    }
    return null;
}

// ============================================
// 顯示狀態
// ============================================
function showStatus(projectPath, iteration) {
    const gemsDir = path.join(projectPath, '.gems');
    const state = new BlueprintState(gemsDir);
    const data = state.load();

    log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
    log('║              📐 Blueprint Status                           ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════╝', 'cyan');

    log(`\n📁 專案: ${projectPath}`, 'reset');
    log(`🎯 當前: iter-${data.currentIter} | ${data.currentModule || '(待選擇)'} | ${data.currentPhase} Step ${data.currentStep}`, 'yellow');
    log(`✅ 已完成: ${data.completedModules.length > 0 ? data.completedModules.join(', ') : '(無)'}`, 'green');

    // 嘗試解析 draft
    const draftPath = findDraft(projectPath, iteration);
    if (draftPath) {
        try {
            const draft = draftParser.load(draftPath);
            const stats = draftParser.calculateStats(draft);
            const summary = draftParser.getIterationSummary(draft);
            const isEnhanced = draftParser.isEnhancedDraft(draft);

            log(`\n📐 Draft: ${path.relative(projectPath, draftPath)}`, 'cyan');
            log(`   Enhanced: ${isEnhanced ? '✅' : '❌ (普通 Draft)'}`, isEnhanced ? 'green' : 'yellow');
            log(`   Level: ${stats.level || '未設定'}`, 'reset');
            log(`   模組: ${stats.totalModules} | 動作: ${stats.totalActions} | 實體: ${stats.totalEntities}`, 'reset');

            if (Object.keys(summary).length > 0) {
                log('\n🗓️ 迭代規劃:', 'blue');
                for (const [iter, info] of Object.entries(summary)) {
                    const allDone = info.modules.every(m => data.completedModules.includes(m));
                    const someDone = info.modules.some(m => data.completedModules.includes(m));
                    const icon = allDone ? '✅' : someDone ? '🔄' : '⬜';
                    const parallel = info.canParallel ? ' ⚡' : '';
                    log(`   iter-${iter}: ${info.modules.join(', ')} ${icon}${parallel}`, 'reset');
                }

                const completionRate = stats.totalModules > 0
                    ? Math.round(data.completedModules.length / stats.totalModules * 100)
                    : 0;
                log(`\n📊 完成率: ${completionRate}%`, 'blue');
            }
        } catch (e) {
            log(`\n⚠️ Draft 解析失敗: ${e.message}`, 'yellow');
        }
    } else {
        log(`\n⚠️ 未找到 Draft: ${iteration}`, 'yellow');
    }

    if (data.history && data.history.length > 0) {
        log('\n📜 重置歷史:', 'gray');
        data.history.slice(-3).forEach(h => {
            log(`   ${h.resetAt}: iter-${h.previousIter} → 重置 (${h.reason})`, 'gray');
        });
    }
}

// ============================================
// 執行 runner.cjs 指令
// ============================================
function runPhaseStep(projectPath, phase, step, options = {}) {
    const { level = 'M', story, iteration = 'iter-1', dryRun = false } = options;
    const relativeProject = path.relative(process.cwd(), projectPath) || '.';
    const runnerPath = path.join(TASK_PIPE_ROOT, 'runner.cjs');

    const args = [
        runnerPath,
        `--phase=${phase}`,
        `--step=${step}`,
        `--target=${relativeProject}`,
        `--level=${level}`,
        `--iteration=${iteration}`,
    ];
    if (story) args.push(`--story=${story}`);

    const cmd = `node ${args.join(' ')}`;

    if (dryRun) {
        log(`  [dry-run] ${cmd}`, 'gray');
        return { success: true, output: cmd };
    }

    log(`  ▶ ${cmd}`, 'cyan');
    const result = spawnSync('node', args, {
        cwd: process.cwd(),
        stdio: 'inherit',
        encoding: 'utf8',
    });

    return {
        success: result.status === 0,
        exitCode: result.status,
    };
}

// ============================================
// 執行模組的完整開發流程
// ============================================
function runModuleDevelopment(projectPath, mod, state, iterNum, options = {}) {
    const { level = 'M', dryRun = false } = options;
    const iteration = `iter-${iterNum}`;

    log(`\n🚀 開發模組: ${mod.id}`, 'magenta');
    log(`   描述: ${mod.desc || '(無)'}`, 'cyan');
    log(`   依賴: ${mod.deps.join(', ') || '(無)'}`, 'cyan');
    log(`   動作: ${mod.actions.length} (${mod.fillLevel})`, 'cyan');

    // POC Step 1-5
    const pocSteps = [1, 2, 3, 4, 5];
    for (const step of pocSteps) {
        state.updateProgress(iterNum, mod.id, 'POC', String(step));
        const result = runPhaseStep(projectPath, 'POC', step, { level, iteration, dryRun });
        if (!result.success) {
            log(`  ❌ POC Step ${step} 失敗`, 'red');
            return { success: false, failedAt: `POC-${step}` };
        }
    }

    // PLAN Step 1-5
    const planSteps = [1, 2, 3, 4, 5];
    for (const step of planSteps) {
        state.updateProgress(iterNum, mod.id, 'PLAN', String(step));
        const result = runPhaseStep(projectPath, 'PLAN', step, { level, iteration, dryRun });
        if (!result.success) {
            log(`  ❌ PLAN Step ${step} 失敗`, 'red');
            return { success: false, failedAt: `PLAN-${step}` };
        }
    }

    // BUILD Phase 1-8
    const buildPhases = [1, 2, 3, 4, 5, 6, 7, 8];
    for (const phase of buildPhases) {
        state.updateProgress(iterNum, mod.id, 'BUILD', String(phase));
        const result = runPhaseStep(projectPath, 'BUILD', phase, { level, iteration, dryRun });
        if (!result.success) {
            log(`  ❌ BUILD Phase ${phase} 失敗`, 'red');
            return { success: false, failedAt: `BUILD-${phase}` };
        }
    }

    // SCAN
    state.updateProgress(iterNum, mod.id, 'SCAN', '1');
    const scanResult = runPhaseStep(projectPath, 'SCAN', 1, { level, iteration, dryRun });
    if (!scanResult.success) {
        log(`  ⚠️ SCAN 失敗 (非阻塞)`, 'yellow');
    }

    return { success: true };
}

// ============================================
// 主流程
// ============================================
function main() {
    const args = parseArgs();

    if (args.help) { showHelp(); process.exit(0); }

    if (!args.project) {
        log('❌ 請指定專案路徑: --project=<path>', 'red');
        process.exit(1);
    }

    const gemsDir = path.join(args.project, '.gems');
    if (!fs.existsSync(gemsDir)) fs.mkdirSync(gemsDir, { recursive: true });

    const state = new BlueprintState(gemsDir);

    // === 狀態模式 ===
    if (args.status) {
        showStatus(args.project, args.iteration);
        process.exit(0);
    }

    // === 重置模式 ===
    if (args.reset) {
        const targetIter = args.iter || 1;
        log(`\n⚡ 重置到 iter-${targetIter}`, 'yellow');
        state.reset(targetIter, `Manual reset to iter-${targetIter}`);
        log('✅ 重置完成', 'green');
        process.exit(0);
    }

    // === 藍圖執行模式 ===
    log('\n╔════════════════════════════════════════════════════════════╗', 'magenta');
    log('║        📐 Blueprint Runner v2 - Enhanced Draft 驅動        ║', 'magenta');
    log('╚════════════════════════════════════════════════════════════╝', 'magenta');

    // 找 Draft
    const draftPath = findDraft(args.project, args.iteration);
    if (!draftPath) {
        log(`\n❌ 未找到 Draft: ${args.iteration}`, 'red');
        log(`   請先建立: .gems/iterations/${args.iteration}/poc/requirement_draft_${args.iteration}.md`, 'yellow');
        process.exit(1);
    }

    // 解析 Draft
    const draft = draftParser.load(draftPath);
    const isEnhanced = draftParser.isEnhancedDraft(draft);
    const stats = draftParser.calculateStats(draft);
    const allIters = draftParser.getAllIterations(draft);

    log(`\n📐 Draft: ${path.relative(args.project, draftPath)}`, 'cyan');
    log(`   Enhanced: ${isEnhanced ? '✅' : '❌ 普通 Draft (將使用標準流程)'}`, isEnhanced ? 'green' : 'yellow');
    log(`   Level: ${stats.level || args.level}`, 'cyan');

    if (!isEnhanced) {
        // 普通 Draft → 直接跑標準流程 (不需要藍圖驅動)
        log('\n📋 普通 Draft 模式：直接執行標準 POC → PLAN → BUILD → SCAN', 'yellow');
        const result = runModuleDevelopment(args.project, {
            id: draft.title || 'main',
            desc: draft.goal,
            deps: [],
            actions: [],
            fillLevel: 'stub',
        }, state, parseInt(args.iteration.replace('iter-', '')), {
            level: stats.level || args.level,
            dryRun: args.dryRun,
        });

        if (result.success) {
            log('\n🎉 開發完成！', 'green');
        } else {
            log(`\n❌ 開發中斷於 ${result.failedAt}`, 'red');
        }
        process.exit(result.success ? 0 : 1);
    }

    // Enhanced Draft → 藍圖驅動
    log(`   模組: ${stats.totalModules} | 動作: ${stats.totalActions} | 迭代: ${stats.totalIterations}`, 'cyan');

    const stateData = state.load();
    let currentIter = args.iter || stateData.currentIter || 1;

    if (args.iter && args.iter !== stateData.currentIter) {
        log(`\n⚡ 跳轉到 iter-${args.iter}`, 'yellow');
        state.reset(args.iter, `Jump to iter-${args.iter}`);
        currentIter = args.iter;
    }

    // 主迴圈：逐迭代執行
    for (const iter of allIters.filter(i => i >= currentIter)) {
        log(`\n${'═'.repeat(60)}`, 'yellow');
        log(`  🗓️ 迭代 ${iter}`, 'yellow');
        log(`${'═'.repeat(60)}`, 'yellow');

        const modulesInIter = draftParser.getModulesByIter(draft, iter);
        log(`  📦 模組: ${modulesInIter.map(m => m.id).join(', ')}`, 'cyan');

        if (modulesInIter.length > 1) {
            log('  ⚡ 可並行開發！', 'green');
        }

        for (const mod of modulesInIter) {
            if (stateData.completedModules.includes(mod.id)) {
                log(`\n  ✅ ${mod.id} 已完成，跳過`, 'green');
                continue;
            }

            // 依賴檢查
            const depCheck = draftParser.checkDependencies(draft, mod.id, stateData.completedModules);
            if (!depCheck.satisfied) {
                log(`\n  ⏳ ${mod.id} 依賴未滿足: ${depCheck.missing.join(', ')}`, 'yellow');
                continue;
            }

            // 執行開發
            const result = runModuleDevelopment(args.project, mod, state, iter, {
                level: stats.level || args.level,
                dryRun: args.dryRun,
            });

            if (result.success) {
                state.markModuleComplete(mod.id);
                log(`  ✅ ${mod.id} 完成`, 'green');
            } else {
                log(`  ❌ ${mod.id} 失敗於 ${result.failedAt}`, 'red');
                log(`\n⚠️ 使用 --reset --iter=${iter} 重新開始`, 'yellow');
                process.exit(1);
            }
        }

        log(`\n  🎉 iter-${iter} 完成！`, 'green');
    }

    log('\n🎊 所有迭代完成！', 'magenta');
}

// ============================================
// 幫助
// ============================================
function showHelp() {
    console.log(`
${c.magenta}Blueprint Runner v2${c.reset} - Enhanced Draft 驅動開發

${c.bold}用法:${c.reset}
  node blueprint-runner.cjs --project=<path> [選項]

${c.bold}選項:${c.reset}
  --project=<path>        專案路徑 (必須)
  --iteration=<iter-N>    指定迭代 (預設: iter-1)
  --iter=<N>              從指定迭代開始 (藍圖模式)
  --module=<id>           只開發特定模組
  --level=<S|M|L>         執行等級 (預設: M)
  --reset                 重置狀態，配合 --iter 使用
  --status                顯示當前狀態
  --dry-run               預覽模式
  --help                  顯示此幫助

${c.bold}範例:${c.reset}
  ${c.cyan}# 查看狀態${c.reset}
  node blueprint-runner.cjs --project=./my-app --status

  ${c.cyan}# 開始/繼續開發${c.reset}
  node blueprint-runner.cjs --project=./my-app

  ${c.cyan}# 從 iter-2 開始 (Enhanced Draft)${c.reset}
  node blueprint-runner.cjs --project=./my-app --iter=2

  ${c.cyan}# 重置到 iter-1${c.reset}
  node blueprint-runner.cjs --project=./my-app --reset --iter=1

${c.bold}Draft 格式:${c.reset}
  支援普通 Draft 和 Enhanced Draft (SDID)。
  Enhanced Draft 包含迭代規劃表、實體定義、模組動作清單。
  普通 Draft 會直接執行標準 POC → PLAN → BUILD → SCAN。
`);
}

// ============================================
// 導出 (供其他模組引用)
// ============================================
module.exports = {
    BlueprintState,
    findDraft,
    showStatus,
    runPhaseStep,
    runModuleDevelopment,
    parseArgs,
};

// ============================================
// 入口
// ============================================
if (require.main === module) {
    main();
}
