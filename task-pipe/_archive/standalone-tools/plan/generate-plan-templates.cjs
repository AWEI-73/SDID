#!/usr/bin/env node

/**
 * generate-plan-templates.cjs - PLAN 樣板產生工具
 * Story-6.2
 * 
 * 功能: 從 requirement_spec 產生 implementation_plan 和 todo_checklist 樣板
 * 用法: node tools/generate-plan-templates.cjs --spec <spec-file> [--output-dir <dir>]
 */

const fs = require('fs');
const path = require('path');

/**
 * GEMS: parseArgs | P1 | ✓✓ | (argv)→Args | Story-6.2 | 解析命令列參數
 */
function parseArgs(argv) {
    const args = { 
        specFile: null,
        outputDir: null,
        force: false
    };

    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--spec' && argv[i + 1]) {
            args.specFile = argv[i + 1];
            i++;
        } else if (argv[i] === '--output-dir' && argv[i + 1]) {
            args.outputDir = argv[i + 1];
            i++;
        } else if (argv[i] === '--force') {
            args.force = true;
        }
    }

    return args;
}

/**
 * GEMS: parseRequirementSpec | P0 | ✓✓ | (content)→SpecInfo | Story-6.2 | 解析 requirement_spec
 * GEMS-FLOW: ReadContent→ExtractStories→ExtractIteration→Return
 */
function parseRequirementSpec(content) {
    const info = {
        iteration: null,
        stories: [],
        totalEstimate: 0
    };

    // 提取迭代編號
    const iterMatch = content.match(/\*\*迭代\*\*:\s*iter-(\d+)/);
    if (iterMatch) {
        info.iteration = parseInt(iterMatch[1], 10);
    }

    // 提取 Stories 表格
    const tablePattern = /\|\s*Story\s*\|[^\n]+\n\|[-:\s|]+\n((?:\|[^\n]+\n)+)/;
    const tableMatch = content.match(tablePattern);
    
    if (tableMatch) {
        const rows = tableMatch[1].trim().split('\n');
        rows.forEach(row => {
            const cols = row.split('|').map(c => c.trim()).filter(c => c);
            if (cols.length >= 5) {
                const storyId = cols[0]; // Story-X.Y
                const name = cols[1];
                const type = cols[2];
                const priority = cols[3];
                const description = cols[4];

                info.stories.push({
                    id: storyId,
                    name,
                    type,
                    priority,
                    description
                });
            }
        });
    }

    return info;
}

/**
 * GEMS: generateImplementationPlan | P0 | ✓✓ | (story, iteration, template)→string | Story-6.2 | 產生 implementation_plan
 * GEMS-FLOW: ReadTemplate→ReplaceVariables→Return
 */
function generateImplementationPlan(story, iteration, templatePath) {
    let template = fs.readFileSync(templatePath, 'utf8');
    
    const today = new Date().toISOString().split('T')[0];
    
    // 替換變數
    template = template
        .replace(/\{X\.Y\}/g, story.id.replace('Story-', ''))
        .replace(/\{X\}/g, iteration)
        .replace(/\{YYYY-MM-DD\}/g, today)
        .replace(/\{module-id\}/g, '[請填寫模組 ID]')
        .replace(/\{本次 Story 要達成什麼\}/g, story.description || '[請填寫目標]')
        .replace(/\{功能 A\}/g, '[功能 A]')
        .replace(/\{功能 B\}/g, '[功能 B]')
        .replace(/\{功能 C\}/g, '[功能 C]')
        .replace(/\{module-name\}/g, '[module-name]')
        .replace(/\{name\}/g, '[name]')
        .replace(/\{Item 名稱\}/g, '[Item 名稱]')
        .replace(/\{簡短描述此 Item 的功能\}/g, '[請填寫功能描述]')
        .replace(/\{功能說明\}/g, '[功能說明]')
        .replace(/\{functionName\}/g, '[functionName]')
        .replace(/\{驗收描述\}/g, '[驗收描述]')
        .replace(/\{module\}/g, '[module]')
        .replace(/\{file\}/g, '[file]')
        .replace(/\{修改說明\}/g, '[修改說明]')
        .replace(/\{描述\}/g, '[描述]')
        .replace(/\{什麼情況算通過\}/g, '[什麼情況算通過]')
        .replace(/\{EntityName\}/g, '[EntityName]')
        .replace(/\{table_name\}/g, '[table_name]')
        .replace(/\{field\}/g, '[field]')
        .replace(/\{type\}/g, '[type]')
        .replace(/\{DB_TYPE\}/g, '[DB_TYPE]')
        .replace(/\{CONSTRAINTS\}/g, '[CONSTRAINTS]')
        .replace(/\{Container\}/g, '[Container]')
        .replace(/\{Layout\}/g, '[Layout]')
        .replace(/\{Zone1\}/g, '[Zone1]')
        .replace(/\{Zone2\}/g, '[Zone2]')
        .replace(/\{Step1\}/g, '[Step1]')
        .replace(/\{Step2\}/g, '[Step2]')
        .replace(/\{Step3\}/g, '[Step3]')
        .replace(/\{模組\/函式\}/g, '[模組/函式]')
        .replace(/\{為什麼需要\}/g, '[為什麼需要]')
        .replace(/\{風險描述\}/g, '[風險描述]')
        .replace(/\{緩解措施\}/g, '[緩解措施]');

    return template;
}

/**
 * GEMS: generateTodoChecklist | P0 | ✓✓ | (stories, iteration, template)→string | Story-6.2 | 產生 todo_checklist
 * GEMS-FLOW: ReadTemplate→BuildStoryList→BuildProgressTable→ReplaceVariables→Return
 */
function generateTodoChecklist(stories, iteration, templatePath) {
    let template = fs.readFileSync(templatePath, 'utf8');
    
    const today = new Date().toISOString().split('T')[0];
    
    // 建立 Story 清單
    const storyList = stories.map(story => {
        return `- [ ] **${story.id}**: ${story.name} (${story.type}, ${story.priority})`;
    }).join('\n');

    // 建立進度追蹤表格
    const progressTable = stories.map(story => {
        return `| ${story.id} | ⬜ PENDING | - | - |`;
    }).join('\n');

    // 替換變數 - 先替換 Story 清單和進度表格，再替換其他變數
    template = template
        .replace(/- \[ \] Story-\{X\.Y\}: \[Story 名稱\] \(\[Type\], \[Priority\]\)/g, storyList)
        .replace(/\| Story-\{X\.0\} \| ⬜ PENDING \| - \| - \|\n\| Story-\{X\.1\} \| ⬜ PENDING \| - \| - \|/g, progressTable)
        .replace(/\{X\}/g, iteration)
        .replace(/\[X\]/g, iteration)
        .replace(/iter-\{X\}/g, `iter-${iteration}`)
        .replace(/\{YYYY-MM-DD\}/g, today);

    return template;
}

/**
 * GEMS: generatePlanTemplates | P0 | ✓✓ | (args)→GenerateResult | Story-6.2 | 執行樣板產生
 * GEMS-FLOW: ParseSpec→GeneratePlans→GenerateTodolist→WriteFiles→Return
 */
function generatePlanTemplates(args) {
    const { specFile, outputDir } = args;

    if (!specFile) {
        throw new Error('Missing required argument: --spec');
    }

    if (!fs.existsSync(specFile)) {
        throw new Error(`Spec file does not exist: ${specFile}`);
    }

    // 讀取 requirement_spec
    const specContent = fs.readFileSync(specFile, 'utf8');
    const specInfo = parseRequirementSpec(specContent);

    if (!specInfo.iteration) {
        throw new Error('Cannot extract iteration number from spec file');
    }

    if (specInfo.stories.length === 0) {
        throw new Error('No stories found in spec file');
    }

    // 判斷輸出目錄
    const targetDir = outputDir || path.dirname(specFile);

    // 讀取樣板
    const projectRoot = path.resolve(__dirname, '..');
    const planTemplatePath = path.join(projectRoot, 'docs/templates/implementation_plan.template.md');
    const todoTemplatePath = path.join(projectRoot, 'docs/templates/todo_checklist.template.md');

    if (!fs.existsSync(planTemplatePath)) {
        throw new Error(`Plan template not found: ${planTemplatePath}`);
    }

    if (!fs.existsSync(todoTemplatePath)) {
        throw new Error(`Todo template not found: ${todoTemplatePath}`);
    }

    const createdFiles = [];

    // 檢查是否會覆蓋檔案
    const willOverwrite = [];
    specInfo.stories.forEach(story => {
        const planFile = path.join(targetDir, `implementation_plan_${story.id}.md`);
        if (fs.existsSync(planFile)) {
            willOverwrite.push(path.basename(planFile));
        }
    });
    
    const todoFile = path.join(targetDir, `todo_checklist_iter-${specInfo.iteration}.md`);
    if (fs.existsSync(todoFile)) {
        willOverwrite.push(path.basename(todoFile));
    }

    // 如果有檔案會被覆蓋且未使用 --force，則警告並停止
    if (willOverwrite.length > 0 && !args.force) {
        return {
            success: false,
            error: 'FILES_EXIST',
            willOverwrite,
            message: `發現 ${willOverwrite.length} 個檔案已存在，使用 --force 強制覆蓋`,
            createdFiles: [],
            outputDir: targetDir
        };
    }

    // 產生 implementation_plan 檔案
    specInfo.stories.forEach(story => {
        const planContent = generateImplementationPlan(story, specInfo.iteration, planTemplatePath);
        const planFile = path.join(targetDir, `implementation_plan_${story.id}.md`);
        fs.writeFileSync(planFile, planContent, 'utf8');
        createdFiles.push(planFile);
    });

    // 產生 todo_checklist
    const todoContent = generateTodoChecklist(specInfo.stories, specInfo.iteration, todoTemplatePath);
    fs.writeFileSync(todoFile, todoContent, 'utf8');
    createdFiles.push(todoFile);

    return {
        success: true,
        iteration: specInfo.iteration,
        storyCount: specInfo.stories.length,
        createdFiles,
        outputDir: targetDir
    };
}

// CLI 執行
if (require.main === module) {
    try {
        const args = parseArgs(process.argv);
        const result = generatePlanTemplates(args);

        console.log('✅ PLAN 樣板產生成功');
        console.log(`📁 迭代: iter-${result.iteration}`);
        console.log(`📊 Stories: ${result.storyCount} 個`);
        console.log(`📂 輸出目錄: ${result.outputDir}`);
        console.log('📄 建立檔案:');
        result.createdFiles.forEach(file => {
            console.log(`   - ${path.basename(file)}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ 錯誤:', error.message);
        console.log('\n使用方式:');
        console.log('  node tools/generate-plan-templates.cjs --spec <spec-file> [--output-dir <dir>]');
        console.log('\n範例:');
        console.log('  node tools/generate-plan-templates.cjs --spec .gems/iterations/iter-6/requirement_spec_iter-6.md');
        console.log('  node tools/generate-plan-templates.cjs --spec requirement_spec.md --output-dir .gems/iterations/iter-6');
        process.exit(1);
    }
}

// 匯出供 API 使用
module.exports = { generatePlanTemplates, parseArgs, parseRequirementSpec };
