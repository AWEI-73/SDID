#!/usr/bin/env node
/**
 * PLAN Step 5: 完成 Implementation Plan
 * v2.0: 檢查所有 Story 是否都 READY FOR BUILD
 */
const fs = require('fs');
const path = require('path');
const { getOutputHeader } = require('../../lib/shared/output-header.cjs');
const { createErrorHandler, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorOutput, anchorPass, anchorError, anchorErrorSpec, emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
const { validatePlan: validatePlanSchema, formatResult: formatSchemaResult } = require('../../lib/plan/plan-validator.cjs');

function run(options) {

  console.log(getOutputHeader('PLAN', 'Step 5'));

  const { target, iteration = 'iter-1', story } = options;
  const planPath = `.gems/iterations/${iteration}/plan`;

  // 初始化錯誤處理器
  const errorHandler = createErrorHandler('PLAN', 'step-5', story);

  if (!story) {
    anchorOutput({
      context: `PLAN Step 5 | 缺少參數`,
      error: {
        type: 'BLOCKER',
        summary: '缺少 --story 參數'
      },
      output: `NEXT: node task-pipe/runner.cjs --phase=PLAN --step=5 --story=Story-X.Y`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-5',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  const planFile = path.join(target, planPath, `implementation_plan_${story}.md`);
  const relativePlanFile = `${planPath}/implementation_plan_${story}.md`;

  if (!fs.existsSync(planFile)) {
    anchorOutput({
      context: `PLAN Step 3 | 未找到 Plan`,
      error: {
        type: 'BLOCKER',
        summary: `未找到 ${relativePlanFile}`
      },
      output: `NEXT: node task-pipe/runner.cjs --phase=PLAN --step=2 --story=${story}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-5',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  const content = fs.readFileSync(planFile, 'utf8');
  const checks = validatePlan(content);

  // 新增：與 requirement_spec 勾稽驗證
  const specPath = path.join(target, `.gems/iterations/${iteration}/poc/requirement_spec_${iteration}.md`);
  const specValidation = validateAgainstSpec(content, specPath, story);
  checks.push(...specValidation);

  const failed = checks.filter(c => !c.pass);
  const gateSpec = getGateSpec(checks);

  if (failed.length) {
    // TACTICAL_FIX 機制
    const attempt = errorHandler.recordError('E2', failed.map(c => c.name).join('; '));

    if (errorHandler.shouldBlock()) {
      anchorErrorSpec({
        targetFile: relativePlanFile,
        missing: failed.map(c => c.name),
        example: `## Story 目標
一句話目標: 建立完整的 XXX 功能

## 資料契約
\`\`\`typescript
// @GEMS-CONTRACT: Item
interface Item {
  id: string;
  title: string;
}
\`\`\`

## 功能清單
| # | 函式名稱 | Priority | 說明 |
|---|----------|----------|------|
| 1 | createItem | P0 | 建立項目 |
| 2 | getItems | P1 | 取得列表 |

## 架構審查
| 檢查項目 | 結果 |
|----------|------|
| 單一職責 | ✅ 通過 |

## 標籤規格
\`\`\`typescript
/**
 * GEMS: createItem | P0 | ✓✓ | (title)→Item | Story-1.0 | 建立項目
 * GEMS-FLOW: Validate→Save→Return
 */
\`\`\``,
        nextCmd: `node task-pipe/runner.cjs --phase=PLAN --step=5 --story=${story}`,
        attempt: MAX_ATTEMPTS,
        maxAttempts: MAX_ATTEMPTS,
        gateSpec: gateSpec
      }, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'plan',
        step: 'step-5',
        story
      });
      return { verdict: 'BLOCKER', reason: 'tactical_fix_limit' };
    }

    anchorErrorSpec({
      targetFile: relativePlanFile,
      missing: failed.map(c => c.name),
      example: failed.some(c => c.name === 'Story目標')
        ? `## Story 目標
一句話目標: 建立完整的 XXX 功能`
        : failed.some(c => c.name === '資料契約')
          ? `## 資料契約
\`\`\`typescript
// @GEMS-CONTRACT: Item
interface Item {
  id: string;
  title: string;
}
\`\`\``
          : failed.some(c => c.name === '功能清單(P0/1/2)')
            ? `## 功能清單
| # | 函式名稱 | Priority | 說明 |
|---|----------|----------|------|
| 1 | createItem | P0 | 建立項目 |`
            : `## 架構審查
| 檢查項目 | 結果 |
|----------|------|
| 單一職責 | ✅ 通過 |`,
      nextCmd: `node task-pipe/runner.cjs --phase=PLAN --step=5 --story=${story}`,
      attempt,
      maxAttempts: MAX_ATTEMPTS,
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-5',
      story
    });
    return { verdict: 'BLOCKER', attempt };
  }

  if (!/READY FOR BUILD/i.test(content)) {
    anchorOutput({
      context: `PLAN Step 3 | 需要更新狀態 | ${story}`,
      task: [
        `更新 ${relativePlanFile} 的 Status → READY FOR BUILD`
      ],
      output: `NEXT: node task-pipe/runner.cjs --phase=PLAN --step=5 --story=${story}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-5',
      story
    });
    return { verdict: 'PENDING' };
  }

  // 檢查所有 Story 進度
  const allStories = findAllStories(target, iteration);
  const readyStories = allStories.filter(s => {
    const p = path.join(target, planPath, `implementation_plan_${s}.md`);
    if (!fs.existsSync(p)) return false;
    return /READY FOR BUILD/i.test(fs.readFileSync(p, 'utf8'));
  });

  const pendingStories = allStories.filter(s => !readyStories.includes(s));

  if (pendingStories.length > 0) {
    anchorOutput({
      context: `PLAN Step 3 | ${story} 完成`,
      info: {
        '進度': `${readyStories.length}/${allStories.length} Stories READY`,
        '待完成': pendingStories.join(', ')
      },
      output: `NEXT: node task-pipe/runner.cjs --phase=PLAN --step=2 --story=${pendingStories[0]}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-5',
      story
    });
    return { verdict: 'PASS', allReady: false, pending: pendingStories };
  }

  // 成功時重置計數
  errorHandler.resetAttempts();

  // Plan Protocol: Schema 驗證 (WARNING 級，不阻擋)
  const schemaResult = validatePlanSchema(planFile);
  if (!schemaResult.valid || schemaResult.warnings.length > 0) {
    console.log(`\n⚠️  Plan Schema 檢查 (${story}):`);
    for (const e of schemaResult.errors) {
      console.log(`   [${e.rule}] ${e.message}`);
    }
    for (const w of schemaResult.warnings) {
      console.log(`   [${w.rule}] ${w.message}`);
    }
    console.log('   (WARNING 級，不阻擋 BUILD)\n');
  }

  anchorPass('PLAN', 'Step 5', `✅ 所有 PLAN 完成！進度: ${readyStories.length}/${allStories.length} Stories READY`,
    `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${allStories[0]}`, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'plan',
    step: 'step-5',
    story
  });
  console.log(`順序: ${allStories.join(' → ')}`);

  return { verdict: 'PASS', allReady: true, stories: allStories };
}

/**
 * 取得 PLAN Step 3 的門控規格
 */
function getGateSpec(checks) {
  return {
    checks: checks.map(c => ({
      name: c.name,
      pass: c.pass,
      desc: c.fix || ''
    }))
  };
}

/**
 * 從 requirement_spec 提取所有 Story
 */
function findAllStories(target, iteration) {
  const specPath = path.join(target, `.gems/iterations/${iteration}/poc/requirement_spec_${iteration}.md`);
  if (!fs.existsSync(specPath)) return [];

  const content = fs.readFileSync(specPath, 'utf8');
  const stories = [];
  const pattern = /Story[\s\-](\d+\.\d+)/gi;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const storyId = `Story-${match[1]}`;
    if (!stories.includes(storyId)) {
      stories.push(storyId);
    }
  }

  return stories.sort((a, b) => {
    const [, aNum] = a.match(/Story-(\d+\.\d+)/);
    const [, bNum] = b.match(/Story-(\d+\.\d+)/);
    return parseFloat(aNum) - parseFloat(bNum);
  });
}

function validatePlan(content) {
  // 檢查是否有純骨架函式（只有 [STEP] 註解但沒有實作描述）
  const skeletonOnlyFunctions = detectSkeletonFunctions(content);
  const hasSkeletonOnly = skeletonOnlyFunctions.length > 0;

  return [
    { name: 'Story目標', pass: /Story 目標|一句話目標/i.test(content), fix: '加 ## Story 目標' },
    { name: '資料契約', pass: /@GEMS-CONTRACT|interface\s+\w+/i.test(content), fix: '加 interface 或 @GEMS-CONTRACT' },
    { name: '功能清單(P0/1/2)', pass: /\|\s*P[012]\s*\|/i.test(content), fix: '表格加 P0/P1/P2 欄' },
    { name: '架構審查', pass: /架構審查|單一職責/i.test(content), fix: '加 ## 架構審查' },
    { name: '標籤規格', pass: /GEMS-FLOW|GEMS-DEPS|@GEMS-FUNC/i.test(content), fix: '加 GEMS 標籤模板' },
    {
      name: '實作邏輯',
      pass: !hasSkeletonOnly,
      fix: `將骨架函式填入 pseudo-code 或業務邏輯描述。問題函式: ${skeletonOnlyFunctions.join(', ') || '無'}`
    },
  ];
}

/**
 * 偵測純骨架函式 - 只有 [STEP] 註解但沒有實際邏輯描述
 */
function detectSkeletonFunctions(content) {
  const skeletonFunctions = [];

  // 找所有 code block 中的函式定義
  const codeBlockPattern = /```(?:typescript|javascript|ts|js)?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockPattern.exec(content)) !== null) {
    const codeBlock = match[1];

    // 檢查是否是函式定義
    const funcMatch = codeBlock.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    if (!funcMatch) continue;

    const funcName = funcMatch[1];
    const funcBody = codeBlock.split('{').slice(1).join('{');

    // 檢查函式體是否只有 [STEP] 註解（骨架）
    const lines = funcBody.split('\n').filter(l => l.trim() && !l.includes('}'));
    const stepOnlyLines = lines.filter(l => /^\s*\/\/\s*\[STEP\]/.test(l));

    // 如果所有非空行都是 [STEP] 註解，就是純骨架
    if (lines.length > 0 && stepOnlyLines.length === lines.length) {
      skeletonFunctions.push(funcName);
    }
  }

  return skeletonFunctions;
}

/**
 * 與 requirement_spec 勾稽驗證
 * 確保 implementation_plan 與規格書的一致性
 */
function validateAgainstSpec(planContent, specPath, storyId) {
  const checks = [];

  if (!fs.existsSync(specPath)) {
    // 沒有 spec 檔案，跳過勾稽（但發出警告）
    checks.push({
      name: 'Spec勾稽(警告)',
      pass: true, // 不阻擋，但會顯示警告
      fix: `找不到 ${specPath}，無法進行勾稽驗證`
    });
    return checks;
  }

  const specContent = fs.readFileSync(specPath, 'utf8');

  // 1. 檢查 Story ID 是否存在於 spec
  const storyPattern = new RegExp(`Story[\\s\\-]?${storyId.replace('Story-', '')}`, 'i');
  const storyExistsInSpec = storyPattern.test(specContent);
  checks.push({
    name: 'Story存在於Spec',
    pass: storyExistsInSpec,
    fix: `${storyId} 未在 requirement_spec 中定義。請先在 spec 中新增此 Story。`
  });

  // 2. 提取並比對 AC（驗收標準）
  const planACs = extractACs(planContent);
  const specACs = extractACsForStory(specContent, storyId);

  if (specACs.length > 0) {
    // 檢查 plan 中是否有對應的 AC
    const planACIds = planACs.map(ac => ac.id);
    const missingACs = specACs.filter(specAC => {
      // 只要 plan 中有提到這個 AC ID 就算對應
      return !planACIds.some(planAC => planAC.includes(specAC.id));
    });

    checks.push({
      name: 'AC驗收標準對應',
      pass: missingACs.length === 0,
      fix: missingACs.length > 0
        ? `Plan 缺少以下 AC: ${missingACs.map(ac => ac.id).join(', ')}。請在驗收標準區域補充。`
        : ''
    });
  }

  // 3. 檢查功能清單與 spec 的一致性（Item 對應 Story 功能）
  const planItems = extractPlanItems(planContent);
  const specStoryFeatures = extractStoryFeatures(specContent, storyId);

  if (specStoryFeatures.length > 0 && planItems.length === 0) {
    checks.push({
      name: '功能項目清單',
      pass: false,
      fix: `Spec 定義了 ${specStoryFeatures.length} 個功能，但 Plan 無功能項目。請填寫 Item 表格。`
    });
  }

  return checks;
}

/**
 * 從 plan 內容提取 AC 清單
 */
function extractACs(content) {
  const acs = [];
  // 匹配 AC-X.Y 格式
  const pattern = /AC-(\d+\.\d+)[:\s]+([^\n]+)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    acs.push({ id: `AC-${match[1]}`, desc: match[2].trim() });
  }
  return acs;
}

/**
 * 從 spec 內容提取特定 Story 的 AC
 * v2.1: 修正 AC 匹配邏輯 - AC-X.Y 對應 Story-X.Y
 */
function extractACsForStory(specContent, storyId) {
  const acs = [];
  const storyNum = storyId.replace('Story-', '');
  
  // v2.1: AC-X.Y 直接對應 Story-X.Y，不是 AC-X.* 對應 Story-X.0
  // 例如：Story-1.0 對應 AC-1.0，Story-1.1 對應 AC-1.1
  const pattern = new RegExp(`AC-${storyNum.replace('.', '\\.')}[:\\s]+([^\\n]+)`, 'gi');
  let match;
  while ((match = pattern.exec(specContent)) !== null) {
    acs.push({ id: `AC-${storyNum}`, desc: match[1].trim() });
  }
  return acs;
}

/**
 * 從 plan 提取 Item 清單
 */
function extractPlanItems(content) {
  const items = [];
  // 匹配表格中的 Item 行
  const pattern = /\|\s*(\d+)\s*\|\s*(\w+)\s*\|/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    items.push({ num: match[1], name: match[2] });
  }
  return items;
}

/**
 * 從 spec 提取特定 Story 的功能列表
 */
function extractStoryFeatures(specContent, storyId) {
  const features = [];
  const storyNum = storyId.replace('Story-', '');

  // 找到 Story 區塊
  const storyPattern = new RegExp(`Story[\\s\\-]?${storyNum}[^#]*?(?=###|$)`, 'is');
  const storyMatch = specContent.match(storyPattern);

  if (storyMatch) {
    // 提取 - [x] 或 - [ ] 的功能項目
    const featurePattern = /- \[[ x]\]\s+([^\n]+)/g;
    let match;
    while ((match = featurePattern.exec(storyMatch[0])) !== null) {
      features.push(match[1].trim());
    }
  }

  return features;
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
