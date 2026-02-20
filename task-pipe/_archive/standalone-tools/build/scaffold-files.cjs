#!/usr/bin/env node

/**
 * GEMS: scaffold-files | P0 | ✓✓ | (planPath, mode)→Report | Story-4.2 | 根據 implementation_plan 產出檔案骨架
 * GEMS-FLOW: ParseArgs→DetectMode→ReadPlan→ParseJSON→CheckExisting→LoadTemplate(mode)→GenerateFiles→Report
 * GEMS-ALGO: 支援 skeleton/full 兩種模式，skeleton 用於 Module 0 基礎建設，full 用於 Module N 功能模組
 * GEMS-DEPS:
 *   - [docs/templates/code/*.template.*] (程式碼樣板來源)
 *   - [docs/templates/code/skeleton/*.skeleton.*] (骨架樣板來源)
 *   - [implementation_plan.md] (規格書來源)
 * GEMS-DEPS-RISK: MEDIUM (依賴樣板檔案存在)
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: __tests__/scaffold-files.test.cjs
 */

const fs = require('fs');
const path = require('path');

// 模式常數
const MODE = {
  SKELETON: 'skeleton',
  FULL: 'full'
};

/**
 * GEMS: readImplementationPlan | P0 | ✓✓ | (planPath)→content | Story-2.0 | 讀取 implementation_plan.md
 * GEMS-FLOW: ValidatePath→ReadFile→ReturnContent
 * GEMS-DEPS:
 *   - [fs.readFileSync] (檔案讀取)
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: __tests__/scaffold-files.test.cjs
 */
function readImplementationPlan(planPath) {
  if (!fs.existsSync(planPath)) {
    throw new Error(`Implementation plan not found: ${planPath}`);
  }
  return fs.readFileSync(planPath, 'utf-8');
}

/**
 * GEMS: parseFileStructure | P0 | ✓✓ | (content)→structure | Story-2.0 | 解析 fileStructure JSON 區塊
 * GEMS-FLOW: ExtractJSON→ParseJSON→ValidateStructure→ReturnObject
 * GEMS-DEPS:
 *   - [JSON.parse] (JSON 解析)
 * GEMS-DEPS-RISK: MEDIUM (JSON 格式錯誤風險)
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: __tests__/scaffold-files.test.cjs
 */
function parseFileStructure(content) {
  // 提取 JSON 區塊（在 ```json 和 ``` 之間）
  const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    throw new Error('No JSON block found in implementation plan');
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (!parsed.fileStructure || !parsed.fileStructure.modules) {
      throw new Error('Invalid fileStructure format: missing modules');
    }
    return parsed.fileStructure;
  } catch (error) {
    throw new Error(`Failed to parse fileStructure JSON: ${error.message}`);
  }
}

/**
 * GEMS: detectMode | P0 | ✓✓ | (planContent)→Mode | Story-4.2 | 自動偵測模式
 * GEMS-FLOW: ExtractStoryId→CheckX0→Return
 * GEMS-ALGO: Story-X.0 → skeleton mode，Story-X.1+ → full mode
 * GEMS-DEPS: none
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/scaffold-files.test.cjs
 */
function detectMode(planContent) {
  // 尋找 Story ID 模式
  // 常見格式: Story-1.0, Story-2.0 (Module 0) 或 Story-1.1, Story-2.3 (Module N)
  const storyMatch = planContent.match(/Story[- ]?(\d+)\.(\d+)/i);

  if (!storyMatch) {
    // 找不到 Story ID，預設使用 full mode
    return MODE.FULL;
  }

  const minorVersion = parseInt(storyMatch[2], 10);

  // X.0 表示 Module 0 (基礎建設)，使用 skeleton mode
  if (minorVersion === 0) {
    return MODE.SKELETON;
  }

  // X.1+ 表示 Module N (功能開發)，使用 full mode
  return MODE.FULL;
}

/**
 * GEMS: checkExistingFiles | P0 | ✓✓ | (files)→existingFiles | Story-2.0 | 檢查檔案是否已存在
 * GEMS-FLOW: IterateFiles→CheckExists→CollectExisting→ReturnList
 * GEMS-DEPS:
 *   - [fs.existsSync] (檔案檢查)
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: __tests__/scaffold-files.test.cjs
 */
function checkExistingFiles(files) {
  const existing = [];
  for (const file of files) {
    if (fs.existsSync(file.fullPath)) {
      existing.push(file.fullPath);
    }
  }
  return existing;
}

/**
 * GEMS: loadSkeletonTemplate | P0 | ✓✓ | (templateType)→content | Story-4.2 | 載入 skeleton template
 * GEMS-FLOW: DetermineTemplate→ReadFile→ReturnContent
 * GEMS-ALGO: 根據 templateType 載入對應的 skeleton 範本
 * GEMS-DEPS:
 *   - [docs/templates/code/skeleton/*.skeleton.*] (骨架樣板檔案)
 * GEMS-DEPS-RISK: MEDIUM (樣板檔案不存在風險)
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/scaffold-files.test.cjs
 */
function loadSkeletonTemplate(templateType) {
  // 測試檔案使用簡單骨架
  if (templateType === 'test') {
    return `/**
 * @GEMS-STORY: Story-{STORY_ID}
 * @GEMS-DESC: TODO: Add test description
 */

// TODO: Implement tests in BUILD phase

describe('{ModuleName}', () => {
  test('should be implemented', () => {
    // TODO: Write test cases
    expect(true).toBe(true);
  });
});
`;
  }

  const skeletonMap = {
    'config': 'config.skeleton.ts',
    'store': 'store.skeleton.ts',
    'component': 'component.skeleton.tsx',
    'layout': 'layout.skeleton.tsx',
    'service': 'config.skeleton.ts',  // 默認使用 config skeleton
    'api': 'config.skeleton.ts',
    'hook': 'component.skeleton.tsx',
    'util': 'config.skeleton.ts',
    'entry': 'config.skeleton.ts',
  };

  const skeletonFile = skeletonMap[templateType] || 'config.skeleton.ts';
  const skeletonPath = path.join('docs', 'templates', 'code', 'skeleton', skeletonFile);

  if (!fs.existsSync(skeletonPath)) {
    // 回傳通用骨架
    return `/**
 * {ModuleName}
 * 
 * @GEMS-STORY: Story-{STORY_ID}
 * @GEMS-DESC: TODO: Add description
 * @GEMS-AUTHOR: Scaffold (Module 0)
 */

// GEMS: {ModuleName} | P[0-3] | ○○ | -→- | Story-{STORY_ID} | TODO: Description
// GEMS-FLOW: -
// GEMS-DEPS: []
// GEMS-DEPS-RISK: LOW
// GEMS-TEST: - Unit | - Integration | - E2E
// GEMS-TEST-FILE: -

// TODO: Implement in BUILD phase

export {};
`;
  }

  return fs.readFileSync(skeletonPath, 'utf-8');
}

/**
 * GEMS: loadTemplate | P0 | ✓✓ | (templateType, mode)→content | Story-4.2 | 載入程式碼樣板
 * GEMS-FLOW: CheckMode→DetermineTemplate→ReadFile→ReturnContent
 * GEMS-ALGO: 根據 mode 決定使用 skeleton 或 full template
 * GEMS-DEPS:
 *   - [docs/templates/code/*.template.*] (樣板檔案)
 *   - [internal] loadSkeletonTemplate (skeleton 模式)
 * GEMS-DEPS-RISK: MEDIUM (樣板檔案不存在風險)
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: __tests__/scaffold-files.test.cjs
 * 
 * 注意：測試檔案不使用樣板，應由開發者手動編寫
 */
function loadTemplate(templateType, mode = MODE.FULL) {
  // Skeleton 模式
  if (mode === MODE.SKELETON) {
    return loadSkeletonTemplate(templateType);
  }

  // Full 模式（原有邏輯）
  // 測試檔案不使用樣板，回傳空內容
  if (templateType === 'test') {
    return '// TODO: Write test cases manually based on actual implementation\n';
  }

  const templateMap = {
    'service': 'service.template.ts',
    'api': 'service.template.ts',
    'util': 'service.template.ts',
    'component': 'component.template.tsx',
    'hook': 'component.template.tsx',
    'entry': 'service.template.ts',
  };

  const templateFile = templateMap[templateType] || 'service.template.ts';
  const templatePath = path.join('docs', 'templates', 'code', templateFile);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  return fs.readFileSync(templatePath, 'utf-8');
}

/**
 * GEMS: replaceTemplateVariables | P0 | ✓✓ | (template,vars)→content | Story-2.0 | 替換樣板變數
 * GEMS-FLOW: IterateVars→ReplaceAll→ReturnContent
 * GEMS-DEPS: None
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: __tests__/scaffold-files.test.cjs
 */
function replaceTemplateVariables(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

/**
 * GEMS: generateFile | P0 | ✓✓ | (filePath,content,dryRun)→success | Story-2.0 | 產出檔案
 * GEMS-FLOW: CreateDir→WriteFile→ReturnSuccess
 * GEMS-DEPS:
 *   - [fs.mkdirSync] (目錄建立)
 *   - [fs.writeFileSync] (檔案寫入)
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: __tests__/scaffold-files.test.cjs
 */
function generateFile(filePath, content, dryRun = false) {
  if (dryRun) {
    return { success: true, dryRun: true, path: filePath };
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return { success: true, path: filePath };
}

/**
 * GEMS: generateReport | P0 | ✓✓ | (result)→report | Story-4.2 | 產出報告
 * GEMS-FLOW: FormatMode→FormatGenerated→FormatSkipped→FormatSummary→ReturnReport
 * GEMS-DEPS: None
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: __tests__/scaffold-files.test.cjs
 */
function generateReport(result) {
  const { generated, skipped, dryRun, mode } = result;

  let report = '\n=== Scaffold Files Report ===\n\n';

  // 顯示模式
  if (mode === MODE.SKELETON) {
    report += '📦 Mode: SKELETON (Module 0 - 基礎建設)\n\n';
  } else {
    report += '🚀 Mode: FULL (Module N - 功能開發)\n\n';
  }

  if (dryRun) {
    report += '🔍 DRY RUN MODE (no files created)\n\n';
  }

  report += `✅ Generated: ${generated.length} files\n`;
  generated.forEach(file => {
    report += `   - ${file}\n`;
  });

  if (skipped.length > 0) {
    report += `\n⏭️  Skipped: ${skipped.length} files (already exist)\n`;
    skipped.forEach(file => {
      report += `   - ${file}\n`;
    });
  }

  report += `\n📊 Total: ${generated.length + skipped.length} files processed\n`;

  return report;
}

/**
 * GEMS: parseArgs | P1 | ✓✓ | (args)→Options | Story-4.2 | 解析命令列參數
 * GEMS-FLOW: IterateArgs→ExtractValues→Return
 * GEMS-DEPS: none
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit
 * GEMS-TEST-FILE: __tests__/scaffold-files.test.cjs
 */
function parseArgs(args) {
  let planPath = null;
  let mode = null;
  let dryRun = false;
  let force = false;

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      mode = arg.replace('--mode=', '');
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--force' || arg === '-f') {
      force = true;
    } else if (arg === '--help' || arg === '-h') {
      return { help: true };
    } else if (!arg.startsWith('-') && !planPath) {
      planPath = arg;
    }
  }

  return { planPath, mode, dryRun, force };
}

/**
 * GEMS: main | P0 | ✓✓ | (args)→void | Story-4.2 | 主程式入口
 * GEMS-FLOW: ParseArgs→DetectMode→ReadPlan→ParseJSON→CheckExisting→GenerateFiles→Report
 * GEMS-ALGO: 主流程支援 skeleton/full 模式切換
 * GEMS-DEPS:
 *   - [internal] parseArgs
 *   - [internal] detectMode
 *   - [internal] readImplementationPlan
 *   - [internal] parseFileStructure
 *   - [internal] checkExistingFiles
 *   - [internal] loadTemplate
 *   - [internal] generateFile
 *   - [internal] generateReport
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: - Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: __tests__/scaffold-files.test.cjs
 */
function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // 顯示說明
  if (options.help) {
    console.log(`
GEMS Scaffold Files v4.0

根據 implementation_plan 產生檔案骨架

用法:
  node scaffold-files.cjs <path/to/implementation_plan.md> [options]

選項:
  --mode=skeleton  產生 Module 0 骨架（只有 GEMS 標籤）
  --mode=full      產生 Module N 骨架（包含函數簽名）[預設]
  --dry-run        預覽模式（不實際建立檔案）
  --force, -f      強制覆蓋已存在的檔案
  --help, -h       顯示此說明

範例:
  # Module 0 基礎建設（自動偵測 Story-X.0）
  node scaffold-files.cjs iterations/iter-1/implementation_plan_Story-1.0.md

  # Module N 功能開發（自動偵測 Story-X.1+）
  node scaffold-files.cjs iterations/iter-2/implementation_plan_Story-2.1.md

  # 手動指定模式
  node scaffold-files.cjs plan.md --mode=skeleton
  node scaffold-files.cjs plan.md --mode=full

  # 預覽模式
  node scaffold-files.cjs plan.md --dry-run
`);
    return;
  }

  if (!options.planPath) {
    console.error('Usage: node scaffold-files.cjs <path/to/implementation_plan.md> [--mode=skeleton|full] [--dry-run]');
    process.exit(1);
  }

  try {
    // Step 1: 讀取規格書
    console.log(`📖 Reading implementation plan: ${options.planPath}`);
    const content = readImplementationPlan(options.planPath);

    // Step 2: 決定模式
    let mode = options.mode;
    if (!mode) {
      mode = detectMode(content);
      console.log(`🔍 Auto-detected mode: ${mode} (based on Story ID)`);
    } else {
      console.log(`📋 Using mode: ${mode}`);
    }

    // 驗證模式
    if (mode !== MODE.SKELETON && mode !== MODE.FULL) {
      console.error(`❌ Invalid mode: ${mode}. Use 'skeleton' or 'full'.`);
      process.exit(1);
    }

    // Step 3: 解析 fileStructure JSON
    console.log('🔍 Parsing fileStructure JSON...');
    const fileStructure = parseFileStructure(content);

    // Step 4: 收集所有檔案
    const allFiles = [];
    for (const module of fileStructure.modules) {
      for (const file of module.files) {
        // module.path 已經包含完整路徑（如 gems-flow-test/tools）
        const fullPath = path.join(module.path, file.name);
        allFiles.push({
          fullPath,
          name: file.name,
          type: file.type,
          modulePath: module.path,
        });
      }
      for (const test of module.tests || []) {
        const fullPath = path.join(module.path, test.name);
        allFiles.push({
          fullPath,
          name: test.name,
          type: 'test',
          modulePath: module.path,
        });
      }
    }

    // Step 5: 檢查已存在的檔案
    console.log('🔎 Checking existing files...');
    const existingFiles = options.force ? [] : checkExistingFiles(allFiles);

    // Step 6: 產出檔案
    const generated = [];
    const skipped = [];

    // 從規格書提取 Story ID 供變數替換
    const storyMatch = content.match(/Story[- ]?(\d+\.\d+)/i);
    const storyId = storyMatch ? storyMatch[1] : 'X.Y';

    for (const file of allFiles) {
      if (existingFiles.includes(file.fullPath)) {
        skipped.push(file.fullPath);
        continue;
      }

      try {
        // 載入樣板（根據模式）
        const isTest = file.name.includes('.test.');
        const templateType = isTest ? 'test' : file.type;
        const template = loadTemplate(templateType, mode);

        // 替換變數
        const baseName = path.basename(file.name, path.extname(file.name));
        const moduleName = baseName.replace('.test', '').replace('.skeleton', '');
        const vars = {
          ModuleName: moduleName.charAt(0).toUpperCase() + moduleName.slice(1),
          moduleName: moduleName.toLowerCase(),
          modulePath: file.modulePath,
          fileName: file.name,
          STORY_ID: storyId,
          Description: `${moduleName} module`,
        };
        const fileContent = replaceTemplateVariables(template, vars);

        // 產出檔案
        const result = generateFile(file.fullPath, fileContent, options.dryRun);
        if (result.success) {
          generated.push(file.fullPath);
        }
      } catch (error) {
        console.error(`❌ Failed to generate ${file.fullPath}: ${error.message}`);
      }
    }

    // Step 7: 產出報告
    const report = generateReport({ generated, skipped, dryRun: options.dryRun, mode });
    console.log(report);

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// 執行主程式
if (require.main === module) {
  main();
}

// 匯出函式供測試使用
module.exports = {
  readImplementationPlan,
  parseFileStructure,
  detectMode,
  checkExistingFiles,
  loadSkeletonTemplate,
  loadTemplate,
  replaceTemplateVariables,
  generateFile,
  generateReport,
  parseArgs,
  MODE,
};
