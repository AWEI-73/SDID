#!/usr/bin/env node

/**
 * GEMS: story-number-advisor | P1 | ✓✓ | (options)→StoryAdvice | Story-4.3 | Story 編號判斷工具
 * GEMS-FLOW: ParseArgs→DetectProjectStructure→CheckModule→DetectArchitecture→Suggest→Report
 * GEMS-ALGO: 根據模組是否存在和架構變更自動建議使用 X.0（基礎建設）或 X.1+（功能開發）
 * GEMS-DEPS:
 *   - [lib] fs (檔案系統操作)
 *   - [lib] path (路徑處理)
 *   - [internal] .gems/config.json (專案配置)
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/story-number-advisor.test.cjs
 */

const fs = require('fs');
const path = require('path');

// 架構變更關鍵字
const ARCHITECTURE_KEYWORDS = [
    'database', 'db', 'schema', 'migration',
    'auth', 'authentication', 'authorization',
    'layout', 'theme', 'style', 'css',
    'router', 'routing', 'navigation',
    'state', 'store', 'redux', 'zustand',
    'config', 'configuration', 'environment',
    'api', 'http', 'fetch', 'axios',
    'test', 'testing', 'jest', 'vitest',
    'build', 'webpack', 'vite', 'bundler',
    'refactor', 'restructure', 'reorganize',
];

/**
 * GEMS: detectProjectStructure | P1 | ✓✓ | (projectPath)→ProjectStructure | Story-4.3 | 偵測專案結構
 * GEMS-FLOW: CheckGemsConfig→ReadConfig→ScanModules→Return
 * GEMS-ALGO: 讀取 .gems/config.json 和掃描 src/modules/ 目錄
 * GEMS-DEPS:
 *   - [lib] fs (檔案系統)
 *   - [lib] path (路徑處理)
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/story-number-advisor.test.cjs
 */
function detectProjectStructure(projectPath) {
    const absolutePath = path.resolve(projectPath);
    const gemsConfigPath = path.join(absolutePath, '.gems', 'config.json');

    let config = null;
    let hasGemsConfig = false;

    // 嘗試讀取 .gems/config.json
    if (fs.existsSync(gemsConfigPath)) {
        hasGemsConfig = true;
        try {
            config = JSON.parse(fs.readFileSync(gemsConfigPath, 'utf-8'));
        } catch (e) {
            console.warn('⚠️  無法解析 .gems/config.json');
        }
    }

    // 掃描 src/modules/ 目錄
    const modulesPath = path.join(absolutePath, 'src', 'modules');
    let modules = [];

    if (fs.existsSync(modulesPath)) {
        modules = fs.readdirSync(modulesPath)
            .filter(name => {
                const fullPath = path.join(modulesPath, name);
                return fs.statSync(fullPath).isDirectory() && !name.startsWith('.');
            });
    }

    // 掃描 iterations 目錄找最後一個 Story
    const iterationsPath = path.join(absolutePath, 'iterations') ||
        path.join(absolutePath, '.gems', 'iterations');
    let lastStoryNumber = '';
    let currentIteration = config?.currentIteration || 0;

    if (fs.existsSync(iterationsPath)) {
        const iterFolders = fs.readdirSync(iterationsPath)
            .filter(name => name.startsWith('iter-'))
            .sort((a, b) => {
                const numA = parseInt(a.replace('iter-', ''), 10);
                const numB = parseInt(b.replace('iter-', ''), 10);
                return numB - numA; // 降序
            });

        if (iterFolders.length > 0) {
            currentIteration = parseInt(iterFolders[0].replace('iter-', ''), 10);

            // 找最後一個 Story
            const lastIterPath = path.join(iterationsPath, iterFolders[0]);
            const files = fs.readdirSync(lastIterPath);

            for (const file of files) {
                const match = file.match(/Story[- ]?(\d+\.\d+)/i);
                if (match) {
                    const storyNum = match[1];
                    if (!lastStoryNumber || compareStoryNumbers(storyNum, lastStoryNumber) > 0) {
                        lastStoryNumber = `Story-${storyNum}`;
                    }
                }
            }
        }
    }

    return {
        projectPath: absolutePath,
        hasGemsConfig,
        modules,
        currentIteration,
        lastStoryNumber,
        config,
    };
}

/**
 * GEMS: compareStoryNumbers | P2 | ✓✓ | (a, b)→number | Story-4.3 | 比較 Story 編號
 * GEMS-FLOW: ParseNumbers→Compare→Return
 * GEMS-DEPS: none
 * GEMS-DEPS-RISK: LOW
 */
function compareStoryNumbers(a, b) {
    const [majorA, minorA] = a.split('.').map(Number);
    const [majorB, minorB] = b.split('.').map(Number);

    if (majorA !== majorB) return majorA - majorB;
    return minorA - minorB;
}

/**
 * GEMS: checkModuleExists | P1 | ✓✓ | (projectPath, moduleName)→boolean | Story-4.3 | 檢查模組是否存在
 * GEMS-FLOW: BuildPath→CheckExists→Return
 * GEMS-ALGO: 檢查 src/modules/[moduleName]/ 是否存在
 * GEMS-DEPS:
 *   - [lib] fs (檔案系統)
 *   - [lib] path (路徑處理)
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/story-number-advisor.test.cjs
 */
function checkModuleExists(projectPath, moduleName) {
    if (!moduleName) return false;

    const absolutePath = path.resolve(projectPath);
    const modulePath = path.join(absolutePath, 'src', 'modules', moduleName);

    return fs.existsSync(modulePath) && fs.statSync(modulePath).isDirectory();
}

/**
 * GEMS: detectArchitectureChange | P1 | ✓✓ | (projectPath, description)→string[] | Story-4.3 | 偵測架構變更
 * GEMS-FLOW: ParseDescription→MatchKeywords→CheckFiles→Return
 * GEMS-ALGO: 根據描述關鍵字判斷是否涉及架構變更
 * GEMS-DEPS: none
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/story-number-advisor.test.cjs
 */
function detectArchitectureChange(projectPath, description) {
    if (!description) return [];

    const changes = [];
    const lowerDesc = description.toLowerCase();

    for (const keyword of ARCHITECTURE_KEYWORDS) {
        if (lowerDesc.includes(keyword)) {
            changes.push(keyword);
        }
    }

    // 檢查特定模式
    if (lowerDesc.includes('新增模組') || lowerDesc.includes('new module')) {
        changes.push('new-module');
    }

    if (lowerDesc.includes('重構') || lowerDesc.includes('refactor')) {
        changes.push('refactor');
    }

    if (lowerDesc.includes('基礎建設') || lowerDesc.includes('infrastructure')) {
        changes.push('infrastructure');
    }

    return [...new Set(changes)]; // 去重
}

/**
 * GEMS: suggestStoryNumber | P1 | ✓✓ | (options)→StoryAdvice | Story-4.3 | 建議 Story 編號
 * GEMS-FLOW: DetectProject→CheckModule→DetectChanges→Calculate→Return
 * GEMS-ALGO: 模組不存在或有架構變更 → X.0，否則 → X.1+
 * GEMS-DEPS:
 *   - [internal] detectProjectStructure
 *   - [internal] checkModuleExists
 *   - [internal] detectArchitectureChange
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/story-number-advisor.test.cjs
 */
function suggestStoryNumber(options) {
    const { projectPath, moduleName, description } = options;

    // 偵測專案結構
    const structure = detectProjectStructure(projectPath);

    // 檢查模組是否存在
    const moduleExists = moduleName ? checkModuleExists(projectPath, moduleName) : true;

    // 偵測架構變更
    const architectureChanges = detectArchitectureChange(projectPath, description);

    // 計算下一個 Story 編號
    let nextMajor = structure.currentIteration + 1;
    let needsInfrastructure = false;
    let reason = '';
    let relatedFiles = [];

    // 判斷是否需要 X.0
    if (!moduleExists && moduleName) {
        needsInfrastructure = true;
        reason = `模組 "${moduleName}" 不存在，需要建立新的模組結構`;
        relatedFiles = [
            `src/modules/${moduleName}/index.ts`,
            `src/modules/${moduleName}/types/`,
            `src/modules/${moduleName}/services/`,
            `src/modules/${moduleName}/components/`,
        ];
    } else if (architectureChanges.length > 0) {
        const infraKeywords = ['infrastructure', 'refactor', 'new-module', 'database', 'schema', 'auth'];
        needsInfrastructure = architectureChanges.some(change => infraKeywords.includes(change));

        if (needsInfrastructure) {
            reason = `涉及架構變更: ${architectureChanges.join(', ')}`;
        } else {
            reason = `功能開發，涉及: ${architectureChanges.join(', ')}`;
        }
    } else {
        reason = moduleName
            ? `在既有模組 "${moduleName}" 新增功能`
            : '一般功能開發或修改';
    }

    // 產生建議編號
    let suggestedNumber;
    if (needsInfrastructure) {
        suggestedNumber = `Story-${nextMajor}.0`;
    } else {
        // 解析 lastStoryNumber 來決定 minor version
        if (structure.lastStoryNumber) {
            const match = structure.lastStoryNumber.match(/Story-(\d+)\.(\d+)/);
            if (match) {
                const lastMajor = parseInt(match[1], 10);
                const lastMinor = parseInt(match[2], 10);

                if (lastMajor === structure.currentIteration) {
                    suggestedNumber = `Story-${lastMajor}.${lastMinor + 1}`;
                } else {
                    suggestedNumber = `Story-${nextMajor}.1`;
                }
            } else {
                suggestedNumber = `Story-${nextMajor}.1`;
            }
        } else {
            suggestedNumber = `Story-${nextMajor}.1`;
        }
    }

    return {
        suggestedNumber,
        reason,
        needsInfrastructure,
        relatedFiles,
        architectureChanges,
        projectStructure: structure,
    };
}

/**
 * GEMS: generateAdviceReport | P1 | ✓✓ | (advice, json)→void | Story-4.3 | 產生建議報告
 * GEMS-FLOW: FormatAdvice→Print
 * GEMS-DEPS: none
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/story-number-advisor.test.cjs
 */
function generateAdviceReport(advice, json = false) {
    if (json) {
        console.log(JSON.stringify(advice, null, 2));
        return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 GEMS Story 編號建議');
    console.log('='.repeat(60) + '\n');

    // 主要建議
    if (advice.needsInfrastructure) {
        console.log(`📦 建議使用: ${advice.suggestedNumber} (基礎建設)`);
    } else {
        console.log(`🚀 建議使用: ${advice.suggestedNumber} (功能開發)`);
    }

    console.log(`\n📋 理由: ${advice.reason}`);

    // 架構變更
    if (advice.architectureChanges.length > 0) {
        console.log(`\n⚙️  涉及架構: ${advice.architectureChanges.join(', ')}`);
    }

    // 相關檔案
    if (advice.relatedFiles.length > 0) {
        console.log('\n📁 需要建立的檔案:');
        advice.relatedFiles.forEach(file => {
            console.log(`   - ${file}`);
        });
    }

    // 專案資訊
    const structure = advice.projectStructure;
    console.log('\n📊 專案資訊:');
    console.log(`   - 專案路徑: ${structure.projectPath}`);
    console.log(`   - 目前迭代: iter-${structure.currentIteration}`);
    console.log(`   - 最後 Story: ${structure.lastStoryNumber || '(無)'}`);
    console.log(`   - 已有模組: ${structure.modules.length > 0 ? structure.modules.join(', ') : '(無)'}`);

    console.log('\n' + '-'.repeat(60));
    console.log('💡 提示:');
    if (advice.needsInfrastructure) {
        console.log('   - X.0 表示需要基礎建設（新模組、架構調整）');
        console.log('   - 請先完成 PLAN 階段，再開始 BUILD');
    } else {
        console.log('   - X.1+ 表示在既有模組新增功能');
        console.log('   - 可以直接開始開發');
    }
    console.log('-'.repeat(60) + '\n');
}

/**
 * GEMS: parseArgs | P2 | ✓✓ | (args)→AdvisorOptions | Story-4.3 | 解析命令列參數
 * GEMS-FLOW: IterateArgs→ExtractValues→Return
 * GEMS-DEPS: none
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/story-number-advisor.test.cjs
 */
function parseArgs(args) {
    let projectPath = '.';
    let moduleName = null;
    let description = null;
    let json = false;

    for (const arg of args) {
        if (arg.startsWith('--project=')) {
            projectPath = arg.replace('--project=', '');
        } else if (arg.startsWith('--module=')) {
            moduleName = arg.replace('--module=', '');
        } else if (arg.startsWith('--description=')) {
            description = arg.replace('--description=', '');
        } else if (arg.startsWith('--desc=')) {
            description = arg.replace('--desc=', '');
        } else if (arg === '--json') {
            json = true;
        } else if (arg === '--help' || arg === '-h') {
            return { help: true };
        } else if (!arg.startsWith('-')) {
            // 第一個非選項參數作為 moduleName
            if (!moduleName) {
                moduleName = arg;
            }
        }
    }

    return { projectPath, moduleName, description, json };
}

/**
 * GEMS: main | P1 | ✓✓ | ()→void | Story-4.3 | 主程式入口
 * GEMS-FLOW: ParseArgs→SuggestStoryNumber→GenerateAdviceReport
 * GEMS-DEPS:
 *   - [internal] parseArgs
 *   - [internal] suggestStoryNumber
 *   - [internal] generateAdviceReport
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/story-number-advisor.test.cjs
 */
function main() {
    const args = process.argv.slice(2);
    const options = parseArgs(args);

    // 顯示說明
    if (options.help) {
        console.log(`
GEMS Story 編號建議工具 v4.0

自動判斷是否需要 X.0（基礎建設）或 X.1+（功能開發）

用法:
  node story-number-advisor.cjs [options]

選項:
  --project=<path>      專案路徑（預設: 當前目錄）
  --module=<name>       要檢查的模組名稱
  --description=<desc>  功能描述（用於偵測架構變更）
  --desc=<desc>         同 --description
  --json                輸出 JSON 格式
  --help, -h            顯示此說明

範例:
  # 檢查新模組
  node story-number-advisor.cjs --module=meal-management

  # 檢查既有模組
  node story-number-advisor.cjs --project=./MMS --module=user-management

  # 根據描述偵測架構變更
  node story-number-advisor.cjs --desc="新增用戶認證模組"

  # 輸出 JSON 格式
  node story-number-advisor.cjs --module=inventory --json
`);
        return;
    }

    try {
        const advice = suggestStoryNumber(options);
        generateAdviceReport(advice, options.json);
    } catch (error) {
        console.error(`❌ 錯誤: ${error.message}`);
        process.exit(1);
    }
}

// 只在直接執行時運行 main
if (require.main === module) {
    main();
}

// 匯出函式供測試使用
module.exports = {
    detectProjectStructure,
    checkModuleExists,
    detectArchitectureChange,
    suggestStoryNumber,
    generateAdviceReport,
    parseArgs,
    compareStoryNumbers,
    ARCHITECTURE_KEYWORDS,
};
