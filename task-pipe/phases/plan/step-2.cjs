#!/usr/bin/env node
/**
 * PLAN Step 2: 規格注入 (POC 模式)
 * 輸入: requirement_spec + Contract | 產物: plan 初稿
 */
const fs = require('fs');
const path = require('path');
const { getOutputHeader } = require('../../lib/shared/output-header.cjs');
const { createErrorHandler, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorOutput, anchorPass, anchorErrorSpec, anchorTemplatePending, emitPass, emitFix, emitFill } = require('../../lib/shared/log-output.cjs');
const { generatePlansFromSpec } = require('../../lib/plan/plan-generator.cjs');

function run(options) {

  console.log(getOutputHeader('PLAN', 'Step 2'));

  const { target, iteration = 'iter-1', story } = options;
  const planPath = `.gems/iterations/${iteration}/plan`;

  // 初始化錯誤處理器
  const errorHandler = createErrorHandler('PLAN', 'step-2', story);

  if (!story) {
    anchorOutput({
      context: `PLAN Step 2 | 缺少參數`,
      error: {
        type: 'BLOCKER',
        summary: '缺少 --story 參數'
      },
      output: `NEXT: node task-pipe/runner.cjs --phase=PLAN --step=2 --story=Story-X.Y`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-2',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  const planFile = `${planPath}/implementation_plan_${story}.md`;

  // 檢查是否已存在且有基本結構
  const fullPlanPath = path.join(target, planFile);
  if (fs.existsSync(fullPlanPath)) {
    const content = fs.readFileSync(fullPlanPath, 'utf8');
    const checks = validateStep2(content);
    const failed = checks.filter(c => !c.pass);

    // 門控規格
    const gateSpec = {
      checks: [
        { name: 'Story 目標', pattern: '/Story 目標|一句話目標/i', pass: checks.find(c => c.name === 'Story 目標')?.pass },
        { name: '工作項目', pattern: '/工作項目|Item.*\\|/i', pass: checks.find(c => c.name === '工作項目')?.pass },
        { name: '規格注入', pattern: '/@GEMS-CONTRACT|規格注入|interface/i', pass: checks.find(c => c.name === '規格注入')?.pass }
      ]
    };

    if (failed.length === 0) {
      // 成功時重置計數
      errorHandler.resetAttempts();

      anchorPass('PLAN', 'Step 2', `已完成: ${planFile}`,
        `node task-pipe/runner.cjs --phase=PLAN --step=3 --story=${story}`, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'plan',
        step: 'step-2',
        story
      });
      return { verdict: 'PASS' };
    }

    // TACTICAL_FIX 機制
    const attempt = errorHandler.recordError('E2', failed.map(c => c.name).join('; '));

    if (errorHandler.shouldBlock()) {
      // 使用精準錯誤輸出
      anchorErrorSpec({
        targetFile: planFile,
        missing: failed.map(c => c.name),
        example: `## 1. Story 目標
**一句話目標**: 實作 ${story} 的核心功能
**範圍**: ✅ 包含 CRUD / ❌ 不包含 進階功能

## 3. 工作項目
| Item | 名稱 | Type | Priority | 預估 |
|------|------|------|----------|------|
| 1 | 新增功能 | FEATURE | P0 | 2h |
| 2 | 列表顯示 | FEATURE | P1 | 1h |

## 5. 規格注入
\`\`\`typescript
// @GEMS-CONTRACT: EntityName
interface EntityName { id: string; name: string; }
\`\`\``,
        nextCmd: `node task-pipe/runner.cjs --phase=PLAN --step=2 --story=${story}`,
        attempt: MAX_ATTEMPTS,
        maxAttempts: MAX_ATTEMPTS,
        gateSpec: gateSpec
      }, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'plan',
        step: 'step-2',
        story
      });
      return { verdict: 'BLOCKER', reason: 'tactical_fix_limit' };
    }

    // 使用精準錯誤輸出
    anchorErrorSpec({
      targetFile: planFile,
      missing: failed.map(c => c.name),
      example: failed.some(c => c.name === 'Story 目標')
        ? `## 1. Story 目標
**一句話目標**: [從 requirement_spec 提取]
**範圍**: ✅ 包含 / ❌ 不包含`
        : failed.some(c => c.name === '工作項目')
          ? `## 3. 工作項目
| Item | 名稱 | Type | Priority | 預估 |
|------|------|------|----------|------|
| 1 | 核心功能 | FEATURE | P0 | 2h |
| 2 | 輔助功能 | FEATURE | P1 | 1h |`
          : `## 5. 規格注入
\`\`\`typescript
// @GEMS-CONTRACT: EntityName
interface EntityName { id: string; }
\`\`\``,
      nextCmd: `node task-pipe/runner.cjs --phase=PLAN --step=2 --story=${story}`,
      attempt,
      maxAttempts: MAX_ATTEMPTS,
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-2',
      story
    });
    return { verdict: 'PENDING', attempt };
  }

  // 判斷是 X.0 還是 X.1+
  const storyMatch = story.match(/Story-(\d+)\.(\d+)/);
  const storyY = storyMatch ? parseInt(storyMatch[2]) : 0;
  const isFoundation = storyY === 0;

  // ========================================
  // 嘗試從 requirement_spec 自動生成 plan
  // ========================================
  const specPath = path.join(target, `.gems/iterations/${iteration}/poc`);
  const specFiles = fs.existsSync(specPath)
    ? fs.readdirSync(specPath).filter(f => f.startsWith('requirement_spec_'))
    : [];

  if (specFiles.length > 0) {
    const specFile = path.join(specPath, specFiles[0]);
    const iterNum = parseInt(iteration.replace('iter-', ''));

    try {
      const genResult = generatePlansFromSpec(specFile, iterNum, target);

      if (genResult.generated.length > 0) {
        // 檢查目標 story 是否在生成結果中
        const targetPlan = genResult.generated.find(g => g.storyId === story);

        if (targetPlan) {
          console.log(`[AUTO-GEN] 從 requirement_spec 自動生成 ${genResult.generated.length} 個 plan`);
          for (const g of genResult.generated) {
            console.log(`   ✅ ${g.storyId} → ${g.module} (${g.functionCount} 函式)`);
          }

          // 重新驗證生成的 plan
          const generatedContent = fs.readFileSync(path.join(target, planFile), 'utf8');
          const checks = validateStep2(generatedContent);
          const failed = checks.filter(c => !c.pass);

          if (failed.length === 0) {
            errorHandler.resetAttempts();
            anchorPass('PLAN', 'Step 2', `自動生成完成: ${planFile} (${targetPlan.functionCount} 函式)`,
              `node task-pipe/runner.cjs --phase=PLAN --step=3 --story=${story}`, {
              projectRoot: target,
              iteration: parseInt(iteration.replace('iter-', '')),
              phase: 'plan',
              step: 'step-2',
              story
            });
            return { verdict: 'PASS' };
          }
          // 如果自動生成的 plan 驗證失敗，繼續走 template 路徑
          console.log(`[AUTO-GEN] 自動生成的 plan 驗證未通過: ${failed.map(c => c.name).join(', ')}`);
        }
      }
    } catch (err) {
      console.log(`[AUTO-GEN] 自動生成失敗: ${err.message}，改用 template`);
    }
  }

  // 產生模板內容（fallback）
  const templateContent = isFoundation
    ? `# Implementation Plan - ${story}

**迭代**: ${iteration}
**Story ID**: ${story}
**目標**: 基礎建設 (橫向分層)

> Status: PENDING

---

## 1. Story 目標

**一句話目標**: {填寫：建立專案基礎架構}
**範圍**: ✅ 包含 config/shared/routes / ❌ 不包含 業務邏輯

---

## 3. 工作項目

| Item | 名稱 | Type | Priority | 預估 |
|------|------|------|----------|------|
| 1 | 入口點連接 | FEATURE | P0 | 1h |
| 2 | Config 層 | FEATURE | P1 | 0.5h |
| 3 | Shared 層 | FEATURE | P1 | 1h |
| 4 | Routes 層 | FEATURE | P1 | 0.5h |

---

## 5. 規格注入

\`\`\`typescript
// @GEMS-CONTRACT: AppConfig
interface AppConfig {
  appName: string;
  version: string;
}
\`\`\`

---

## 8. 架構審查

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| 模組化結構 | ⏳ 待檢查 | |
| 依賴方向 | ⏳ 待檢查 | |
`
    : `# Implementation Plan - ${story}

**迭代**: ${iteration}
**Story ID**: ${story}
**目標模組**: {填寫模組名稱}

> Status: PENDING

---

## 1. Story 目標

**一句話目標**: {填寫：實作 XXX 功能}
**範圍**: ✅ 包含 CRUD / ❌ 不包含 進階功能

---

## 3. 工作項目

| Item | 名稱 | Type | Priority | 預估 |
|------|------|------|----------|------|
| 1 | 新增功能 | FEATURE | P0 | 2h |
| 2 | 列表顯示 | FEATURE | P1 | 1h |
| 3 | 驗證邏輯 | FEATURE | P1 | 1h |
| 4 | 路由整合 | INTEGRATION | P1 | 0.5h |

---

## 5. 規格注入

\`\`\`typescript
// @GEMS-CONTRACT: EntityName
// @GEMS-TABLE: tbl_entities
interface EntityName {
  id: string;      // UUID, PK
  name: string;    // VARCHAR(100), NOT NULL
  createdAt: Date; // TIMESTAMP
}
\`\`\`

---

## 8. 架構審查

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| 模組隔離 | ⏳ 待檢查 | |
| 依賴風險 | ⏳ 待檢查 | |
`;

  // 門控規格 - 告訴 AI 這個 step 會檢查什麼
  const gateSpec = {
    checks: [
      { name: 'Story 目標', pattern: '/Story 目標|一句話目標/i', desc: '必須有目標描述' },
      { name: '工作項目', pattern: '/工作項目|Item.*\\|/i', desc: '必須有工作項目表格' },
      { name: '規格注入', pattern: '/@GEMS-CONTRACT|規格注入|interface/i', desc: '必須有型別定義' }
    ]
  };

  // 使用 Template Pending 輸出
  console.log(getOutputHeader('PLAN', 'Step 2'));
  anchorTemplatePending({
    targetFile: planFile,
    templateContent: templateContent,
    fillItems: [
      '一句話目標 - 從 requirement_spec 提取',
      '工作項目表格 - 確認 Priority 分配 (P0 1-2個, P1 3-5個)',
      '規格注入 - 從 Contract 複製型別定義',
      isFoundation ? '六層結構定義' : '路由整合 Item (必填)'
    ],
    nextCmd: `node task-pipe/runner.cjs --phase=PLAN --step=2 --story=${story}`,
    gateSpec: gateSpec
  }, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'plan',
    step: 'step-2',
    story
  });

  // 額外輸出 Priority 指引
  console.log('');
  console.log('@PRIORITY_GUIDE (v3.3)');
  console.log('  P0 = 端到端流程 (UI→邏輯→儲存→回饋) → 1-2 個');
  console.log('  P1 = 有依賴狀態 (有 import) → 3-5 個');
  console.log('  P2 = 內部工具 (純邏輯) → 1-2 個');
  console.log('  P3 = 輔助函式 (常數)');
  console.log('');

  return { verdict: 'PENDING' };
}

function findPOC(target, iteration) {
  const dirs = [
    path.join(target, `.gems/iterations/${iteration}/poc`),
    path.join(target, `.gems/iterations/${iteration}`)
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.includes('POC') && (f.endsWith('.html') || f.endsWith('.tsx'))) {
        return { found: true, path: path.join(dir, f) };
      }
    }
  }
  return { found: false };
}

function findContract(target, iteration) {
  const dirs = [
    path.join(target, `.gems/iterations/${iteration}/poc`),
    path.join(target, `.gems/iterations/${iteration}`)
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.endsWith('Contract.ts')) {
        return { found: true, path: path.join(dir, f) };
      }
    }
  }
  return { found: false };
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


function validateStep2(content) {
  return [
    { name: 'Story 目標', pass: /Story 目標|一句話目標/i.test(content) },
    { name: '工作項目', pass: /工作項目|Item.*\|/i.test(content) },
    { name: '規格注入', pass: /@GEMS-CONTRACT|規格注入|interface/i.test(content) },
  ];
}
