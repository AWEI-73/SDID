#!/usr/bin/env node
/**
 * PLAN Step 4: 標籤規格設計 (GEMS Tags v2.1)
 * 輸入: implementation_plan | 產物: 更新 plan（加入標籤規格）
 * 
 * v2.1 更新：嚴格驗證完整標籤格式
 * - GEMS: funcName | P[0-3] | ✓✓ | (args)→Result | Story-X.X | 描述
 * - GEMS-FLOW: Step1→Step2→Step3
 * - GEMS-DEPS: [Type.Name (說明)]
 * - GEMS-DEPS-RISK: LOW | MEDIUM | HIGH
 * - GEMS-TEST: ✓ Unit | - Integration | - E2E
 * - GEMS-TEST-FILE: xxx.test.ts
 * - [STEP] 錨點（P0/P1 強制）
 * 
 * v2.2 更新：支援「函式清單」表格驗證
 */
const fs = require('fs');
const path = require('path');
const { getOutputHeader } = require('../../lib/shared/output-header.cjs');
const { extractFunctionManifest, validateFunctionManifest, formatFunctionManifest } = require('../../lib/plan/plan-spec-extractor.cjs');
const { createErrorHandler, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorOutput, anchorPass, anchorError, emitPass, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd, getPassCmd } = require('../../lib/shared/next-command-helper.cjs');

function run(options) {

  console.log(getOutputHeader('PLAN', 'Step 4'));

  const { target, iteration = 'iter-1', story } = options;
  const planPath = `.gems/iterations/${iteration}/plan`;

  // 初始化錯誤處理器
  const errorHandler = createErrorHandler('PLAN', 'step-4', story);

  if (!story) {
    anchorOutput({
      context: `PLAN Step 4 | 缺少參數`,
      error: {
        type: 'BLOCKER',
        summary: '缺少 --story 參數'
      },
      output: `NEXT: node task-pipe/runner.cjs --phase=PLAN --step=4 --story=Story-X.Y`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-4',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  const planFile = path.join(target, planPath, `implementation_plan_${story}.md`);
  const relativePlanFile = `${planPath}/implementation_plan_${story}.md`;

  if (!fs.existsSync(planFile)) {
    anchorOutput({
      context: `PLAN Step 4 | 未找到 Plan`,
      error: {
        type: 'BLOCKER',
        summary: `未找到 ${relativePlanFile}`
      },
      output: `NEXT: node task-pipe/runner.cjs --phase=PLAN --step=2 --story=${story}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-4',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  const content = fs.readFileSync(planFile, 'utf8');
  const validation = validateStep26(content, story);

  // v2.2: 額外檢查函式清單表格
  const manifest = extractFunctionManifest(planFile);
  const manifestValidation = validateFunctionManifest(manifest);

  // 合併驗證結果
  const hasManifestIssues = !manifestValidation.valid && manifest.hasManifest;
  const allPassed = validation.passed && !hasManifestIssues;

  if (allPassed) {
    // 成功時重置計數
    errorHandler.resetAttempts();

    // 顯示函式清單資訊（如果有）
    const manifestInfo = manifest.hasManifest
      ? ` | 函式清單: ${manifest.stats.total} 個 (P0:${manifest.stats.p0} P1:${manifest.stats.p1})`
      : '';

    anchorPass('PLAN', 'Step 4',
      `完整標籤: ${validation.stats.completeTagBlocks} 個, P0/P1 函式: ${validation.stats.p0p1Functions} 個, 覆蓋率: ${validation.stats.coverage}%${manifestInfo}`,
      `node task-pipe/runner.cjs --phase=PLAN --step=5 --story=${story}`, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-4',
      story
    });
    return { verdict: 'PASS', manifest };
  }

  // TACTICAL_FIX 機制
  const attempt = errorHandler.recordError('E6', validation.issues.join('; '));

  if (errorHandler.shouldBlock()) {
    anchorError('BLOCKER',
      `標籤規格設計連續失敗 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS}) | ${story}`,
      '需要: Code Reviewer Skill 或人類介入',
      {
        details: `### PLAN Step 4 標籤規格設計連續失敗 | ${story}\n\n問題:\n${validation.issues.map(i => `- ${i}`).join('\n')}\n\n建議行動:\n1. 啟動 Code Reviewer Skill 進行深度分析\n2. 檢查 GEMS 標籤格式是否正確\n3. 確認 P0/P1 函式都有完整標籤區塊`,
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'plan',
        step: 'step-4',
        story
      });
    return { verdict: 'BLOCKER', reason: 'tactical_fix_limit' };
  }

  const recoveryLevel = errorHandler.getRecoveryLevel();

  // 構建缺少項目列表
  const missingList = validation.missingItems.slice(0, 5);
  const moreCount = validation.missingItems.length > 5 ? `\n...還有 ${validation.missingItems.length - 5} 個` : '';

  const gemsTagTemplate = `/**
 * GEMS: funcName | P0 | ✓✓ | (input: Input)→Output | ${story} | 函式描述
 * GEMS-FLOW: Validate→Process→Return
 * GEMS-DEPS: [Book.types (書籍型別)], [validation.utils (驗證工具)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: funcName.test.ts
 */
// [STEP] Validate - 驗證輸入參數
// [STEP] Process - 處理業務邏輯
// [STEP] Return - 返回結果
export function funcName(input: Input): Output {
  // 實作
}`;

  const integrationTemplate = `
## Level 3: Integration (P2)

### 3.1 整合點規劃

#### main.ts 整合
\`\`\`typescript
/**
 * GEMS: register{ModuleName}Module | P2 | ✓✓ | ()→void | ${story} | 註冊模組
 * GEMS-FLOW: LoadConfig→RegisterRoutes→InitServices
 * GEMS-DEPS: [{ModuleName}Routes.router], [{ModuleName}Service.init]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: - Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: main.integration.test.ts
 */
// [STEP] LoadConfig - 載入模組配置
const config = loadModuleConfig('{module-name}');

// [STEP] RegisterRoutes - 註冊路由
app.use('/api/{module-name}', {moduleName}Routes);

// [STEP] InitServices - 初始化服務
await {moduleName}Service.init(config);
\`\`\`

#### routes.ts 整合
\`\`\`typescript
/**
 * GEMS: setup{ModuleName}Routes | P2 | ✓✓ | (router)→void | ${story} | 設定路由
 * GEMS-FLOW: DefineRoutes→AttachMiddleware→MountHandlers
 * GEMS-DEPS: [{ModuleName}Controller.*], [AuthMiddleware.verify]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: - Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: routes.integration.test.ts
 */
\`\`\`

### 3.2 Integration 測試規範（禁止 Mock）

| 測試場景 | Given | When | Then | Mock 限制 |
|----------|-------|------|------|-----------|
| 模組啟動 | 系統啟動 | 載入模組 | 路由可訪問 | 禁止 mock 路由註冊 |
| API 呼叫 | 模組已註冊 | GET /api/xxx | 返回資料 | 禁止 mock HTTP 層 |
| 錯誤處理 | 服務未初始化 | 呼叫 API | 返回 503 | 禁止 mock 錯誤處理 |

**Integration 測試原則**：
- ✅ 允許: 使用真實的路由、中介層、控制器
- ✅ 允許: 使用記憶體資料庫（如 SQLite in-memory）
- ❌ 禁止: Mock Express Router
- ❌ 禁止: Mock HTTP Request/Response
- ❌ 禁止: Mock 核心業務邏輯

### 3.3 E2E 測試場景規劃

#### 場景 1: 完整 CRUD 流程
\`\`\`gherkin
Given 使用者已登入系統
When 使用者建立新項目
And 使用者編輯項目
And 使用者刪除項目
Then 所有操作成功完成
And 資料庫狀態正確
\`\`\`

#### 場景 2: 錯誤處理流程
\`\`\`gherkin
Given 使用者未登入
When 使用者嘗試訪問受保護資源
Then 系統返回 401 錯誤
And 導向登入頁面
\`\`\`

**E2E 測試工具**: Playwright (前端) / Supertest (API)
`;

  anchorOutput({
    context: `PLAN Step 4 | 標籤規格設計 | ${story}`,
    info: {
      'Plan': relativePlanFile,
      '狀態': '需要補齊標籤',
      '完整標籤區塊': `${validation.stats.completeTagBlocks} 個`,
      'P0/P1 函式': `${validation.stats.p0p1Functions} 個`,
      '[STEP] 錨點': `${validation.stats.stepAnchors} 個`,
      '覆蓋率': `${validation.stats.coverage}% (需 >=80%)`
    },
    error: {
      type: 'TACTICAL_FIX',
      summary: `問題: ${validation.issues.slice(0, 3).join(', ')}${validation.issues.length > 3 ? '...' : ''}`,
      attempt,
      maxAttempts: MAX_ATTEMPTS
    },
    rules: [
      '每個 P0/P1 函式必須有【完整標籤區塊】',
      `GEMS: funcName | P[0-3] | ✓✓ | (args)→Result | ${story} | 描述`,
      'GEMS-FLOW: Step1→Step2→Step3',
      'GEMS-DEPS: [Type.Name (說明)] 或 [Type.Name]',
      'GEMS-DEPS-RISK: LOW | MEDIUM | HIGH',
      'GEMS-TEST: ✓ Unit | - Integration | - E2E',
      'GEMS-TEST-FILE: xxx.test.ts',
      'P0/P1 函式必須有 [STEP] 錨點對應 GEMS-FLOW',
      '覆蓋率必須 >= 80%'
    ],
    task: [
      '為每個 Item 中的函式加入完整標籤區塊',
      `缺少項目: ${missingList.join(', ')}${moreCount}`
    ],
    template: {
      title: 'TEMPLATE',
      content: gemsTagTemplate,
      description: '完整標籤區塊範例'
    },
    guide: {
      title: 'ALLOWED_OUTPUT',
      content: `本步驟唯一允許產出: 更新 ${relativePlanFile} (加入 GEMS 標籤規格)\n禁止產出其他任何檔案`
    },
    output: `NEXT: ${relativePlanFile}\nNEXT: node task-pipe/runner.cjs --phase=PLAN --step=4 --story=${story}`
  }, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'plan',
    step: 'step-4',
    story
  });

  return { verdict: 'PENDING', attempt };
}

// 自我執行判斷
if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let iteration = 'iter-1';
  let story = null;

  // 簡單參數解析
  args.forEach(arg => {
    if (arg.startsWith('--target=')) target = arg.split('=')[1];
    if (arg.startsWith('--project-path=')) target = arg.split('=')[1];
    if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
    if (arg.startsWith('--story=')) story = arg.split('=')[1];
  });

  // 確保 target 是絕對路徑
  if (!path.isAbsolute(target)) {
    target = path.resolve(process.cwd(), target);
  }

  run({ target, iteration, story });
}

module.exports = { run };

/**
 * 驗證 Step 4 - v2.1 嚴格版
 * 檢查每個函式是否都有完整標籤區塊
 * v3.1: 新增 Integration 非 Mock 規範和 E2E 場景規劃檢查
 */
function validateStep26(content, story) {
  const stats = {
    completeTagBlocks: 0,
    p0p1Functions: 0,
    stepAnchors: 0,
    coverage: 0
  };
  const issues = [];
  const missingItems = [];

  // 1. 提取所有 @GEMS-FUNCTION 標記的函式
  const functions = extractFunctions(content);
  stats.p0p1Functions = functions.length;

  // 2. 提取完整標籤區塊（必須包含所有必要標籤）
  const tagBlocks = extractCompleteTagBlocks(content);
  stats.completeTagBlocks = tagBlocks.length;

  // 3. 計算 [STEP] 錨點數量
  const stepMatches = content.match(/\[STEP\]/g) || [];
  stats.stepAnchors = stepMatches.length;

  // 4. 檢查必要標籤
  const hasGemsMain = /GEMS:\s*\w+\s*\|\s*P[0-3]\s*\|/.test(content);
  const hasGemsFlow = content.includes('GEMS-FLOW:');
  const hasGemsDeps = content.includes('GEMS-DEPS:');
  const hasGemsDepsRisk = content.includes('GEMS-DEPS-RISK:');
  const hasGemsTest = /GEMS-TEST:.*[✓-]\s*Unit/.test(content);
  const hasGemsTestFile = content.includes('GEMS-TEST-FILE:');
  const hasStepAnchors = stats.stepAnchors > 0;

  // v3.1: 檢查 Integration 非 Mock 規範
  const hasIntegrationSpec = /Integration.*真實|Integration.*非.*mock|整合測試.*禁止.*mock/i.test(content);

  // v3.1: 檢查 E2E 場景規劃（P0 函式必須）
  const hasP0Functions = /\|\s*P0\s*\|/.test(content);
  const hasE2EScenario = /E2E.*場景|E2E.*scenario|使用者流程|User Flow/i.test(content) ||
    /\.e2e\.test|cypress|playwright/i.test(content);

  // 5. 記錄缺少的項目
  if (!hasGemsMain) {
    issues.push('缺少完整 GEMS 標籤 (格式: GEMS: name | P0 | ✓✓ | sig | story | desc)');
    missingItems.push('GEMS 主標籤');
  }
  if (!hasGemsFlow) {
    issues.push('缺少 GEMS-FLOW');
    missingItems.push('GEMS-FLOW');
  }
  if (!hasGemsDeps) {
    issues.push('缺少 GEMS-DEPS');
    missingItems.push('GEMS-DEPS');
  }
  if (!hasGemsDepsRisk) {
    issues.push('缺少 GEMS-DEPS-RISK (LOW/MEDIUM/HIGH)');
    missingItems.push('GEMS-DEPS-RISK');
  }
  if (!hasGemsTest) {
    issues.push('缺少 GEMS-TEST (格式: ✓ Unit | - Integration | - E2E)');
    missingItems.push('GEMS-TEST');
  }
  if (!hasGemsTestFile) {
    issues.push('缺少 GEMS-TEST-FILE');
    missingItems.push('GEMS-TEST-FILE');
  }
  if (!hasStepAnchors && stats.p0p1Functions > 0) {
    issues.push('P0/P1 函式缺少 [STEP] 錨點');
    missingItems.push('[STEP] 錨點');
  }

  // v3.1: Integration 非 Mock 規範
  if (!hasIntegrationSpec) {
    issues.push('缺少 Integration 測試規範（需說明：Integration 測試禁止使用 mock）');
    missingItems.push('Integration 非 Mock 規範');
  }

  // v3.1: P0 必須有 E2E 場景
  if (hasP0Functions && !hasE2EScenario) {
    issues.push('P0 函式缺少 E2E 測試場景規劃');
    missingItems.push('E2E 場景規劃');
  }

  // v3.2: 前端 Story 必須包含 UI 移植任務 (Design Hub)
  const moduleTypeMatch = content.match(/模組類型[:\s]*(\S+)/);
  const moduleType = moduleTypeMatch ? moduleTypeMatch[1] : '';
  const isFrontendStory = /component|ui-layer|frontend|page-component/i.test(moduleType) ||
    /\.tsx|\.jsx|React|Vue|Angular|前端/.test(content.match(/Story 目標[\s\S]{0,300}/)?.[0] || '');
  const hasUiMigration = /UI.*移植|Design.*Hub|POC.*遷移|migrate-poc-ui/i.test(content);

  if (isFrontendStory && !hasUiMigration) {
    issues.push('前端 Story 缺少 UI 移植任務 (需引用 Design Hub 或使用 migrate-poc-ui)');
    missingItems.push('UI 移植任務');
  }

  // 6. 檢查每個函式是否有對應的完整標籤
  for (const fn of functions) {
    const hasCompleteTag = tagBlocks.some(t =>
      t.functionName.toLowerCase() === fn.name.toLowerCase()
    );
    if (!hasCompleteTag) {
      missingItems.push(`函式 ${fn.name} 缺少完整標籤區塊`);
    }
  }

  // 7. 計算覆蓋率（v3.1: 增加 Integration 和 E2E 規範，v3.2: UI 移植任務）
  const requiredTags = 9; // GEMS, FLOW, DEPS, DEPS-RISK, TEST, TEST-FILE, Integration規範, E2E場景, UI移植
  const presentTags = [
    hasGemsMain, hasGemsFlow, hasGemsDeps, hasGemsDepsRisk,
    hasGemsTest, hasGemsTestFile, hasIntegrationSpec, hasE2EScenario,
    (isFrontendStory ? hasUiMigration : true) // 非前端 Story 視為通過
  ].filter(Boolean).length;
  stats.coverage = Math.round((presentTags / requiredTags) * 100);

  // 8. 判斷是否通過
  const passed = issues.length === 0 && stats.coverage >= 80;

  return { passed, issues, stats, missingItems };
}

/**
 * 提取 @GEMS-FUNCTION 標記的函式
 */
function extractFunctions(content) {
  const functions = [];

  // 先匹配 @GEMS-FUNCTION: funcName (舊版) 或 GEMS: funcName (新版)
  const pattern = /(?:@GEMS-FUNCTION:|GEMS:)\s*([\w.]+)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    if (!functions.find(f => f.name === match[1])) {
      functions.push({ name: match[1] });
    }
  }

  return functions;
}

/**
 * 提取完整標籤區塊
 * 必須包含: GEMS: name | P[0-3] | ... 格式
 */
function extractCompleteTagBlocks(content) {
  const blocks = [];

  // 匹配完整的 GEMS 標籤格式
  // GEMS: funcName | P0 | ✓✓ | (args)→Result | Story-X.X | 描述
  const pattern = /GEMS:\s*([\w.]+)\s*\|\s*(P[0-3])\s*\|\s*[✓○-]+\s*\|\s*\([^)]*\)\s*→\s*\w+/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    blocks.push({
      functionName: match[1],
      priority: match[2]
    });
  }

  return blocks;
}
