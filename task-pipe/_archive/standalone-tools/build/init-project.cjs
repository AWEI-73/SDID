#!/usr/bin/env node

/**
 * GEMS Flow - Project Initialization Script
 * 
 * 自動複製 GEMS 基礎設施到新專案，產生專案配置檔和橫向分層結構
 * 
 * @usage: node tools/init-project.cjs --path=/path/to/project --name=ProjectName
 * 
 * GEMS: init-project | P0 | ✓✓ | (args)→InitResult | Story-4.1 | 專案初始化工具
 * GEMS-FLOW: ParseArgs→ValidatePath→CheckGems→Copy→GenerateConfig→CreateLayers→Report
 * GEMS-DEPS:
 *   - [lib] fs (檔案系統操作)
 *   - [lib] path (路徑處理)
 * GEMS-DEPS-RISK: LOW
 * GEMS-ALGO: 1.驗證專案路徑 2.檢查.gems是否存在 3.複製基礎設施 4.產生配置檔 5.建立橫向分層 6.產出報告
 * GEMS-TEST: ✓ Unit | ✓ Integration
 * GEMS-TEST-FILE: __tests__/init-project.test.cjs
 */

const fs = require('fs');
const path = require('path');

// GEMS 基礎設施來源目錄（相對於此腳本）
const GEMS_SOURCE_DIR = path.join(__dirname, '..');

// 橫向分層結構
const HORIZONTAL_LAYERS = [
    'src/config',
    'src/assets/styles',
    'src/lib',
    'src/shared/components',
    'src/shared/layouts',
    'src/shared/store',
    'src/shared/utils',
    'src/shared/types',
    'src/modules',
    'src/routes'
];

// 要複製的 GEMS 目錄和檔案
const GEMS_ITEMS_TO_COPY = [
    'flow',
    'prompts',
    'tools',
    'docs/guides',
    'docs/templates'
];

/**
 * GEMS: validateProjectPath | P0 | ✓✓ | (projectPath)→boolean | Story-4.1 | 驗證專案路徑
 * GEMS-FLOW: CheckExists→CheckDirectory→Return
 * GEMS-DEPS:
 *   - [lib] fs (檔案系統)
 * GEMS-DEPS-RISK: LOW
 * GEMS-ALGO: 檢查路徑是否存在且為目錄
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/init-project.test.cjs
 */
function validateProjectPath(projectPath) {
    if (!projectPath) {
        throw new Error('專案路徑不能為空');
    }

    const absolutePath = path.resolve(projectPath);

    if (!fs.existsSync(absolutePath)) {
        // 如果目錄不存在，嘗試建立
        fs.mkdirSync(absolutePath, { recursive: true });
        console.log(`📁 建立專案目錄: ${absolutePath}`);
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isDirectory()) {
        throw new Error(`路徑不是目錄: ${absolutePath}`);
    }

    return true;
}

/**
 * GEMS: checkGemsExists | P0 | ✓✓ | (projectPath)→boolean | Story-4.1 | 檢查 .gems/ 是否已存在
 * GEMS-FLOW: BuildPath→CheckExists→Return
 * GEMS-DEPS:
 *   - [lib] fs (檔案系統)
 *   - [lib] path (路徑處理)
 * GEMS-DEPS-RISK: LOW
 * GEMS-ALGO: 檢查 .gems 目錄是否已存在
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/init-project.test.cjs
 */
function checkGemsExists(projectPath) {
    const gemsPath = path.join(projectPath, '.gems');
    return fs.existsSync(gemsPath);
}

/**
 * GEMS: copyDirectory | P1 | ✓✓ | (src, dest)→number | Story-4.1 | 遞迴複製目錄
 * GEMS-FLOW: CreateDestDir→ListFiles→CopyEach→Return
 * GEMS-DEPS:
 *   - [lib] fs (檔案系統)
 *   - [lib] path (路徑處理)
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/init-project.test.cjs
 */
function copyDirectory(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn(`⚠️  來源目錄不存在: ${src}`);
        return 0;
    }

    // 建立目標目錄
    fs.mkdirSync(dest, { recursive: true });

    let copiedCount = 0;
    const items = fs.readdirSync(src);

    for (const item of items) {
        // 跳過不需要複製的項目
        if (item === 'node_modules' || item === '.git' || item === 'iterations') {
            continue;
        }

        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        const stat = fs.statSync(srcPath);

        if (stat.isDirectory()) {
            copiedCount += copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
            copiedCount++;
        }
    }

    return copiedCount;
}

/**
 * GEMS: copyGemsInfrastructure | P0 | ✓✓ | (sourcePath, targetPath)→number | Story-4.1 | 複製 GEMS 基礎設施
 * GEMS-FLOW: CreateGemsDir→CopyEachItem→Return
 * GEMS-DEPS:
 *   - [internal] copyDirectory
 *   - [lib] fs (檔案系統)
 *   - [lib] path (路徑處理)
 * GEMS-DEPS-RISK: LOW
 * GEMS-ALGO: 複製 flow/prompts/tools/docs 到目標 .gems 目錄
 * GEMS-TEST: ✓ Unit | ✓ Integration
 * GEMS-TEST-FILE: __tests__/init-project.test.cjs
 */
function copyGemsInfrastructure(sourcePath, targetPath) {
    const gemsTargetPath = path.join(targetPath, '.gems');

    // 建立 .gems 目錄
    fs.mkdirSync(gemsTargetPath, { recursive: true });

    let totalCopied = 0;

    for (const item of GEMS_ITEMS_TO_COPY) {
        const srcPath = path.join(sourcePath, item);
        const destPath = path.join(gemsTargetPath, item);

        if (fs.existsSync(srcPath)) {
            const stat = fs.statSync(srcPath);
            if (stat.isDirectory()) {
                totalCopied += copyDirectory(srcPath, destPath);
            } else {
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.copyFileSync(srcPath, destPath);
                totalCopied++;
            }
        }
    }

    // 建立 iterations 目錄
    const iterationsPath = path.join(gemsTargetPath, 'iterations');
    fs.mkdirSync(iterationsPath, { recursive: true });

    return totalCopied;
}

/**
 * GEMS: generateProjectConfig | P0 | ✓✓ | (projectName, projectPath)→object | Story-4.1 | 產生專案配置檔
 * GEMS-FLOW: BuildConfig→WriteFile→Return
 * GEMS-DEPS:
 *   - [lib] fs (檔案系統)
 *   - [lib] path (路徑處理)
 * GEMS-DEPS-RISK: LOW
 * GEMS-ALGO: 產生 .gems/config.json 配置檔
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/init-project.test.cjs
 */
function generateProjectConfig(projectName, projectPath) {
    const config = {
        projectName: projectName,
        projectPath: path.resolve(projectPath),
        gemsVersion: '4.0',
        currentIteration: 0,
        currentStory: '',
        modules: [],
        createdAt: new Date().toISOString()
    };

    const configPath = path.join(projectPath, '.gems', 'config.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    return config;
}

/**
 * GEMS: createHorizontalLayers | P0 | ✓✓ | (projectPath)→string[] | Story-4.1 | 產生橫向分層結構
 * GEMS-FLOW: IterateLayers→CreateDir→CollectCreated→Return
 * GEMS-DEPS:
 *   - [lib] fs (檔案系統)
 *   - [lib] path (路徑處理)
 * GEMS-DEPS-RISK: LOW
 * GEMS-ALGO: 建立 src/config, src/assets, src/lib, src/shared, src/modules, src/routes 結構
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/init-project.test.cjs
 */
function createHorizontalLayers(projectPath) {
    const createdFolders = [];

    for (const layer of HORIZONTAL_LAYERS) {
        const layerPath = path.join(projectPath, layer);

        if (!fs.existsSync(layerPath)) {
            fs.mkdirSync(layerPath, { recursive: true });
            createdFolders.push(layer);
        }
    }

    // 建立基礎 index.ts 檔案
    createIndexFiles(projectPath, createdFolders);

    return createdFolders;
}

/**
 * GEMS: createIndexFiles | P2 | ✓✓ | (projectPath, folders)→void | Story-4.1 | 建立 index.ts 檔案
 * GEMS-FLOW: IterateFolders→CreateIndexFile
 * GEMS-DEPS:
 *   - [lib] fs (檔案系統)
 *   - [lib] path (路徑處理)
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/init-project.test.cjs
 */
function createIndexFiles(projectPath, folders) {
    const indexContent = (folderName) => `/**
 * ${folderName} Module - Index
 * 
 * @GEMS-STORY: Story-X.0 (Module 0 - 基礎建設)
 * @GEMS-DESC: ${folderName} 模組入口
 */

// TODO: 匯出模組公開 API
export {};
`;

    for (const folder of folders) {
        // 只為主要目錄建立 index
        if (folder.split('/').length <= 2) {
            const indexPath = path.join(projectPath, folder, 'index.ts');
            if (!fs.existsSync(indexPath)) {
                const folderName = path.basename(folder);
                fs.writeFileSync(indexPath, indexContent(folderName), 'utf-8');
            }
        }
    }
}

/**
 * GEMS: generateReport | P0 | ✓✓ | (result)→void | Story-4.1 | 產出初始化報告
 * GEMS-FLOW: FormatResult→PrintToConsole
 * GEMS-DEPS: none
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/init-project.test.cjs
 */
function generateReport(result) {
    console.log('\n' + '='.repeat(60));
    console.log('✅ GEMS 專案初始化完成');
    console.log('='.repeat(60) + '\n');

    console.log(`📁 專案路徑: ${result.projectPath}`);
    console.log(`📋 專案名稱: ${result.projectName}`);
    console.log(`🔖 GEMS 版本: 4.0`);
    console.log(`📅 建立時間: ${new Date().toLocaleString('zh-TW')}`);

    console.log('\n📦 複製的檔案:');
    console.log(`   - 共複製 ${result.copiedFiles} 個檔案到 .gems/`);

    console.log('\n📂 建立的資料夾:');
    for (const folder of result.createdFolders) {
        console.log(`   - ${folder}`);
    }

    console.log('\n✨ 配置檔案:');
    console.log(`   - ${result.configPath}`);

    console.log('\n' + '-'.repeat(60));
    console.log('📝 下一步:');
    console.log('   1. 執行 node .gems/tools/init-iteration.cjs 初始化迭代');
    console.log('   2. 建立 requirement_spec.md 撰寫需求');
    console.log('   3. 建立 implementation_plan.md 規劃實作');
    console.log('-'.repeat(60) + '\n');

    if (result.errors.length > 0) {
        console.log('⚠️  警告:');
        for (const error of result.errors) {
            console.log(`   - ${error}`);
        }
        console.log('');
    }
}

/**
 * GEMS: parseArgs | P1 | ✓✓ | (args)→{path, name, force} | Story-4.1 | 解析命令列參數
 * GEMS-FLOW: IterateArgs→ExtractValues→Return
 * GEMS-DEPS: none
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/init-project.test.cjs
 */
function parseArgs(args) {
    let projectPath = null;
    let projectName = null;
    let force = false;

    for (const arg of args) {
        if (arg.startsWith('--path=')) {
            projectPath = arg.replace('--path=', '');
        } else if (arg.startsWith('--name=')) {
            projectName = arg.replace('--name=', '');
        } else if (arg === '--force' || arg === '-f') {
            force = true;
        } else if (!arg.startsWith('-') && !projectPath) {
            projectPath = arg;
        }
    }

    // 如果沒有名稱，從路徑提取
    if (!projectName && projectPath) {
        projectName = path.basename(projectPath);
    }

    return { path: projectPath, name: projectName, force };
}

/**
 * GEMS: main | P0 | ✓✓ | ()→void | Story-4.1 | 主程式入口
 * GEMS-FLOW: ParseArgs→Validate→CheckGems→Copy→GenerateConfig→CreateLayers→Report
 * GEMS-DEPS:
 *   - [internal] parseArgs
 *   - [internal] validateProjectPath
 *   - [internal] checkGemsExists
 *   - [internal] copyGemsInfrastructure
 *   - [internal] generateProjectConfig
 *   - [internal] createHorizontalLayers
 *   - [internal] generateReport
 * GEMS-DEPS-RISK: LOW
 * GEMS-ALGO: 主流程：解析參數→驗證→檢查→複製→配置→分層→報告
 * GEMS-TEST: ✓ Unit | ✓ Integration
 * GEMS-TEST-FILE: __tests__/init-project.test.cjs
 */
function main() {
    try {
        const args = process.argv.slice(2);

        // 顯示說明
        if (args.includes('--help') || args.includes('-h')) {
            console.log(`
GEMS 專案初始化工具 v4.0

用法:
  node init-project.cjs --path=<專案路徑> --name=<專案名稱>

參數:
  --path=<path>   專案目錄路徑（必填）
  --name=<name>   專案名稱（選填，預設為目錄名稱）
  --force, -f     強制覆蓋已存在的 .gems（謹慎使用）
  --help, -h      顯示此說明

範例:
  node init-project.cjs --path=./my-project --name=MyProject
  node init-project.cjs ./my-project
  node init-project.cjs --path=C:/projects/MMS --name=MMS
`);
            return;
        }

        const { path: projectPath, name: projectName, force } = parseArgs(args);

        if (!projectPath) {
            console.error('❌ 錯誤: 請提供專案路徑');
            console.error('   用法: node init-project.cjs --path=<專案路徑>');
            process.exit(1);
        }

        const absolutePath = path.resolve(projectPath);

        // 驗證路徑
        validateProjectPath(absolutePath);

        // 檢查 .gems 是否已存在
        if (checkGemsExists(absolutePath)) {
            if (!force) {
                console.error('❌ 錯誤: .gems/ 目錄已存在');
                console.error('   如果要強制覆蓋，請使用 --force 參數');
                process.exit(1);
            } else {
                console.log('⚠️  警告: 強制覆蓋現有 .gems/ 目錄');
                // 刪除現有 .gems 目錄
                fs.rmSync(path.join(absolutePath, '.gems'), { recursive: true, force: true });
            }
        }

        // 複製 GEMS 基礎設施
        console.log('📦 複製 GEMS 基礎設施...');
        const copiedFiles = copyGemsInfrastructure(GEMS_SOURCE_DIR, absolutePath);

        // 產生專案配置檔
        console.log('⚙️  產生專案配置檔...');
        const config = generateProjectConfig(projectName, absolutePath);

        // 建立橫向分層結構
        console.log('📂 建立橫向分層結構...');
        const createdFolders = createHorizontalLayers(absolutePath);

        // 產出報告
        const result = {
            success: true,
            projectPath: absolutePath,
            projectName: projectName,
            copiedFiles: copiedFiles,
            createdFolders: createdFolders,
            configPath: path.join(absolutePath, '.gems', 'config.json'),
            errors: []
        };

        generateReport(result);

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
    validateProjectPath,
    checkGemsExists,
    copyDirectory,
    copyGemsInfrastructure,
    generateProjectConfig,
    createHorizontalLayers,
    createIndexFiles,
    generateReport,
    parseArgs,
    main,
    HORIZONTAL_LAYERS,
    GEMS_ITEMS_TO_COPY
};
