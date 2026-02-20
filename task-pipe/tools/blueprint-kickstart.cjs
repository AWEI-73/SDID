#!/usr/bin/env node
/**
 * Blueprint Kickstart v1.0 - 藍圖啟動器
 * 
 * 設計理念：腳本 print → AI 讀取 → AI 執行 → 再跑一次 → 直到 @PASS 接 runner.cjs
 * 
 * 流程：
 *   Step 0: 專案目錄不存在 → 告訴 AI 建立
 *   Step 1: .gems 結構不存在 → 腳本自動建立，印 @PASS
 *   Step 2: Draft 不存在 → 告訴 AI 建立 Enhanced Draft
 *   Step 3: Draft 存在但驗證失敗 → 印出失敗項目，告訴 AI 修
 *   Step 4: Draft 驗證通過 → @PASS + 印出 runner.cjs POC Step 1 指令
 * 
 * 用法:
 *   node task-pipe/tools/blueprint-kickstart.cjs --project=./my-app
 *   node task-pipe/tools/blueprint-kickstart.cjs --project=./my-app --input=需求.md
 *   node task-pipe/tools/blueprint-kickstart.cjs --project=./my-app --iteration=iter-2
 *   node task-pipe/tools/blueprint-kickstart.cjs --help
 */

const fs = require('fs');
const path = require('path');

const TASK_PIPE_ROOT = path.resolve(__dirname, '..');

// ============================================
// 參數解析
// ============================================
function parseArgs() {
    const args = {
        project: null,
        input: null,
        iteration: 'iter-1',
        help: false,
    };

    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith('--project=')) {
            args.project = path.resolve(arg.split('=').slice(1).join('='));
        } else if (arg.startsWith('--input=')) {
            args.input = path.resolve(arg.split('=').slice(1).join('='));
        } else if (arg.startsWith('--iteration=')) {
            args.iteration = arg.split('=')[1];
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }

    return args;
}

// ============================================
// 狀態偵測
// ============================================
function detectState(projectPath, iteration) {
    const state = {
        projectExists: false,
        gemsExists: false,
        pocDirExists: false,
        draftExists: false,
        draftPath: null,
        validation: null,
    };

    // 1. 專案目錄
    state.projectExists = fs.existsSync(projectPath);
    if (!state.projectExists) return state;

    // 2. .gems 結構
    const pocDir = path.join(projectPath, '.gems', 'iterations', iteration, 'poc');
    state.gemsExists = fs.existsSync(path.join(projectPath, '.gems'));
    state.pocDirExists = fs.existsSync(pocDir);

    // 3. Draft 檔案
    const draftPath = path.join(pocDir, `requirement_draft_${iteration}.md`);
    state.draftExists = fs.existsSync(draftPath);
    state.draftPath = draftPath;

    // 4. 驗證 Draft
    if (state.draftExists) {
        try {
            const { validateDraft } = require('./blueprint-architect.cjs');
            const content = fs.readFileSync(draftPath, 'utf8');
            state.validation = validateDraft(content);
        } catch (e) {
            state.validation = { valid: false, checks: [{ level: 'FAIL', msg: `驗證錯誤: ${e.message}` }], summary: { pass: 0, warn: 0, fail: 1 } };
        }
    }

    return state;
}

// ============================================
// 決定步驟
// ============================================
function determineStep(state) {
    if (!state.projectExists) return 0;
    if (!state.pocDirExists) return 1;
    if (!state.draftExists) return 2;
    if (!state.validation || !state.validation.valid) return 3;
    return 4;
}

// ============================================
// Step 0: 專案目錄不存在
// ============================================
function runStep0(projectPath) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('@KICKSTART Step 0/4 - 建立專案目錄');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`專案路徑不存在: ${projectPath}`);
    console.log('');
    console.log('@TASK');
    console.log(`1. 建立專案目錄: ${projectPath}`);
    console.log('');
    console.log('@OUTPUT');
    console.log('建立目錄後，重新執行此腳本:');
    console.log(`  node task-pipe/tools/blueprint-kickstart.cjs --project=${projectPath}`);
    console.log('');
}

// ============================================
// Step 1: 建立 .gems 結構 (腳本自動做)
// ============================================
function runStep1(projectPath, iteration) {
    const pocDir = path.join(projectPath, '.gems', 'iterations', iteration, 'poc');
    const planDir = path.join(projectPath, '.gems', 'iterations', iteration, 'plan');
    const buildDir = path.join(projectPath, '.gems', 'iterations', iteration, 'build');
    const logsDir = path.join(projectPath, '.gems', 'iterations', iteration, 'logs');

    fs.mkdirSync(pocDir, { recursive: true });
    fs.mkdirSync(planDir, { recursive: true });
    fs.mkdirSync(buildDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('@KICKSTART Step 1/4 - .gems 結構建立');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('@PASS | 已自動建立 .gems 目錄結構');
    console.log(`  ✅ ${path.relative(projectPath, pocDir)}`);
    console.log(`  ✅ ${path.relative(projectPath, planDir)}`);
    console.log(`  ✅ ${path.relative(projectPath, buildDir)}`);
    console.log(`  ✅ ${path.relative(projectPath, logsDir)}`);
    console.log('');
    console.log('@OUTPUT');
    console.log('結構已就緒，重新執行此腳本進入 Step 2:');
    console.log(`  node task-pipe/tools/blueprint-kickstart.cjs --project=${projectPath} --iteration=${iteration}`);
    console.log('');
}

// ============================================
// Step 2: 要求 AI 建立 Enhanced Draft
// ============================================
function runStep2(projectPath, iteration, inputFile) {
    const draftPath = path.join(projectPath, '.gems', 'iterations', iteration, 'poc', `requirement_draft_${iteration}.md`);
    const relDraftPath = path.relative(process.cwd(), draftPath);

    // 讀取黃金模板路徑
    const goldenTemplate = path.join(TASK_PIPE_ROOT, 'templates', 'enhanced-draft-golden.template.md');
    const exampleFile = path.join(TASK_PIPE_ROOT, 'templates', 'examples', 'enhanced-draft-ecotrack.example.md');

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('@KICKSTART Step 2/4 - 建立 Enhanced Draft');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`📁 目標檔案: ${relDraftPath}`);
    console.log('');

    // 如果有 input 文件，印出內容讓 AI 參考
    if (inputFile && fs.existsSync(inputFile)) {
        const inputContent = fs.readFileSync(inputFile, 'utf8');
        console.log('@INPUT (用戶需求文件)');
        console.log('---');
        // 限制長度避免終端截斷
        if (inputContent.length > 3000) {
            console.log(inputContent.substring(0, 3000));
            console.log('... (截斷，完整內容請讀取原檔)');
            console.log(`原檔路徑: ${inputFile}`);
        } else {
            console.log(inputContent);
        }
        console.log('---');
        console.log('');
    }

    console.log('@TASK');
    console.log('建立 Enhanced Draft (requirement_draft)，遵循以下規則:');
    console.log('');
    console.log('1. 參考黃金模板格式:');
    console.log(`   ${path.relative(process.cwd(), goldenTemplate)}`);
    console.log('2. 參考範例 (EcoTrack):');
    console.log(`   ${path.relative(process.cwd(), exampleFile)}`);

    if (inputFile && fs.existsSync(inputFile)) {
        console.log('3. 根據上方 @INPUT 的用戶需求文件，轉換為 Enhanced Draft 格式');
    } else {
        console.log('3. 使用 Blueprint Architect 5 輪對話流程引導用戶產出需求');
        console.log('   (或直接根據用戶描述撰寫 Draft)');
    }

    console.log('');
    console.log('@RULES');
    console.log('- Draft 必須包含: 一句話目標、族群識別、實體定義、共用模組、獨立模組、路由結構');
    console.log('- Draft 必須包含: 迭代規劃表、模組動作清單');
    console.log('- 設定 POC Level (S/M/L)');
    console.log('- 不要留佔位符 ({xxx})');
    console.log('- 使用繁體中文');
    console.log('');
    console.log(`📝 將 Draft 寫入: ${relDraftPath}`);
    console.log('');
    console.log('@OUTPUT');
    console.log('Draft 建立完成後，重新執行此腳本進行驗證:');
    console.log(`  node task-pipe/tools/blueprint-kickstart.cjs --project=${projectPath} --iteration=${iteration}`);
    console.log('');
}

// ============================================
// Step 3: Draft 驗證失敗，告訴 AI 修什麼
// ============================================
function runStep3(projectPath, iteration, validation) {
    const draftPath = path.join(projectPath, '.gems', 'iterations', iteration, 'poc', `requirement_draft_${iteration}.md`);
    const relDraftPath = path.relative(process.cwd(), draftPath);

    const fails = (validation.checks || []).filter(c => c.level === 'FAIL');
    const warns = (validation.checks || []).filter(c => c.level === 'WARN');

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('@KICKSTART Step 3/4 - Draft 驗證');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`📁 Draft: ${relDraftPath}`);
    console.log(`📊 結果: ${validation.summary.pass} pass | ${validation.summary.warn} warn | ${validation.summary.fail} fail`);
    console.log(`Enhanced: ${validation.enhanced ? '✅' : '❌ 普通 Draft'}`);
    console.log('');

    if (fails.length > 0) {
        console.log('@TACTICAL_FIX | Draft 驗證未通過');
        console.log('');
        console.log('❌ 必須修復:');
        fails.forEach((f, i) => {
            console.log(`  ${i + 1}. ${f.msg}`);
        });
    }

    if (warns.length > 0) {
        console.log('');
        console.log('⚠️ 建議改善:');
        warns.forEach((w, i) => {
            console.log(`  ${i + 1}. ${w.msg}`);
        });
    }

    console.log('');
    console.log('@TASK');
    console.log(`修改 ${relDraftPath}，修復上述 ❌ 項目`);
    console.log('');
    console.log('@OUTPUT');
    console.log('修復後，重新執行此腳本驗證:');
    console.log(`  node task-pipe/tools/blueprint-kickstart.cjs --project=${projectPath} --iteration=${iteration}`);
    console.log('');
}

// ============================================
// Step 4: 驗證通過 → 接續 runner.cjs
// ============================================
function runStep4(projectPath, iteration, validation) {
    const stats = validation.stats || {};

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('@KICKSTART Step 4/4 - Draft 驗證通過');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('@PASS | Blueprint Kickstart 完成');
    console.log('');
    console.log('@INFO');
    console.log(`  Level: ${stats.level || '?'}`);
    console.log(`  模組數: ${stats.totalModules || 0}`);
    console.log(`  迭代數: ${stats.totalIterations || 0}`);
    console.log(`  動作數: ${stats.totalActions || 0}`);
    console.log(`  實體數: ${stats.totalEntities || 0}`);
    console.log(`  Enhanced: ${validation.enhanced ? '✅' : '❌'}`);
    console.log('');
    console.log('@OUTPUT');
    console.log('Draft 已就緒，接續 GEMS 流程 POC Step 1:');
    console.log(`  node task-pipe/runner.cjs --phase=POC --step=1 --target=${projectPath} --iteration=${iteration}`);
    console.log('');
}

// ============================================
// 幫助訊息
// ============================================
function showHelp() {
    console.log(`
Blueprint Kickstart v1.0 - 藍圖啟動器

設計理念: 腳本 print → AI 讀取 → AI 執行 → 再跑一次 → 直到 @PASS 接 runner.cjs

用法:
  node task-pipe/tools/blueprint-kickstart.cjs --project=<path> [options]

選項:
  --project=<path>      專案路徑 (必填)
  --input=<file>        用戶需求文件 (可選，如 PRD、Smart Bin 匯出)
  --iteration=<iter-N>  迭代編號 (預設: iter-1)
  --help                顯示此訊息

流程:
  Step 0: 專案目錄不存在 → 告訴 AI 建立
  Step 1: .gems 結構不存在 → 腳本自動建立
  Step 2: Draft 不存在 → 告訴 AI 建立 Enhanced Draft
  Step 3: Draft 驗證失敗 → 印出失敗項目，告訴 AI 修
  Step 4: Draft 驗證通過 → @PASS + 印出 runner.cjs POC Step 1 指令

範例:
  # 全新專案
  node task-pipe/tools/blueprint-kickstart.cjs --project=./my-app

  # 有需求文件
  node task-pipe/tools/blueprint-kickstart.cjs --project=./my-app --input=需求.md

  # 第二次迭代
  node task-pipe/tools/blueprint-kickstart.cjs --project=./my-app --iteration=iter-2
`);
}

// ============================================
// 主程式
// ============================================
function main() {
    const args = parseArgs();

    if (args.help) {
        showHelp();
        process.exit(0);
    }

    if (!args.project) {
        console.log('❌ 請指定專案路徑: --project=<path>');
        console.log('   node task-pipe/tools/blueprint-kickstart.cjs --help');
        process.exit(1);
    }

    // 偵測狀態
    const state = detectState(args.project, args.iteration);
    const step = determineStep(state);

    // 標題
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║        🚀 Blueprint Kickstart v1.0                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`  專案: ${args.project}`);
    console.log(`  迭代: ${args.iteration}`);
    console.log(`  偵測步驟: Step ${step}/4`);

    // 執行對應步驟
    switch (step) {
        case 0:
            runStep0(args.project);
            break;
        case 1:
            runStep1(args.project, args.iteration);
            break;
        case 2:
            runStep2(args.project, args.iteration, args.input);
            break;
        case 3:
            runStep3(args.project, args.iteration, state.validation);
            break;
        case 4:
            runStep4(args.project, args.iteration, state.validation);
            break;
    }

    // Step 4 = 成功，其他 = 待處理
    process.exit(step === 4 ? 0 : 1);
}

// ============================================
// 執行
// ============================================
if (require.main === module) {
    main();
}

module.exports = { parseArgs, detectState, determineStep };
