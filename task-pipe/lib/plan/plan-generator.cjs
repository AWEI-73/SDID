#!/usr/bin/env node
/**
 * Plan Generator v1.0 - 從 requirement_spec 自動產生 implementation_plan
 * 
 * 結合 spec-parser 的結構化資料和 draft-to-plan 的 GEMS 標籤推導邏輯，
 * 產出可直接通過 BUILD Phase 2 標籤驗收的 implementation_plan。
 * 
 * 用法:
 *   const { generatePlansFromSpec } = require('./plan-generator.cjs');
 *   const result = generatePlansFromSpec(specPath, iterNum, target);
 */
const fs = require('fs');
const path = require('path');
const { parseSpec } = require('./spec-parser.cjs');

/**
 * 從 requirement_spec 產生所有 Story 的 implementation_plan
 * @param {string} specPath - requirement_spec 檔案路徑
 * @param {number} iterNum - 迭代編號
 * @param {string} target - 專案根目錄
 * @param {object} options - { dryRun, contractPath }
 * @returns {object} { generated: [{ storyId, module, file, functionCount }], errors: [] }
 */
function generatePlansFromSpec(specPath, iterNum, target, options = {}) {
  const { dryRun = false } = options;
  const result = { generated: [], errors: [] };

  const spec = parseSpec(specPath);
  if (spec.error) {
    result.errors.push(spec.error);
    return result;
  }

  if (spec.stories.length === 0) {
    result.errors.push('requirement_spec 中未找到 Story 定義');
    return result;
  }

  const planDir = path.join(target, '.gems', 'iterations', `iter-${iterNum}`, 'plan');
  if (!dryRun) {
    fs.mkdirSync(planDir, { recursive: true });
  }

  for (const story of spec.stories) {
    const planContent = generatePlanForStory(story, iterNum, spec);
    const planFile = path.join(planDir, `implementation_plan_${story.id}.md`);

    if (!dryRun) {
      fs.writeFileSync(planFile, planContent, 'utf8');
    }

    result.generated.push({
      storyId: story.id,
      module: story.moduleName,
      file: path.relative(target, planFile),
      functionCount: story.functions.length,
    });
  }

  return result;
}

/**
 * 為單一 Story 產生 implementation_plan Markdown
 */
function generatePlanForStory(story, iterNum, spec) {
  const today = new Date().toISOString().split('T')[0];
  const storyId = story.id;

  // 工作項目表
  const workItems = story.functions.map((fn, i) =>
    `| ${i + 1} | ${fn.name} | FEATURE | ${fn.priority} | ✅ 明確 | - |`
  ).join('\n');

  // Item 詳細規格
  const itemSpecs = story.functions.map((fn, i) => {
    const stepAnchors = fn.flow
      ? fn.flow.split('→').map(s => `// [STEP] ${s.trim()}`).join('\n')
      : '';

    return `### Item ${i + 1}: ${fn.name}

**Type**: FEATURE | **Priority**: ${fn.priority}

\`\`\`typescript
// @GEMS-FUNCTION: ${fn.name}
/**
 * GEMS: ${fn.name} | ${fn.priority} | ○○ | (args)→Result | ${storyId} | ${fn.description || fn.name}
 * GEMS-FLOW: ${fn.flow || 'TODO'}
 * GEMS-DEPS: ${fn.deps || '無'}
 * GEMS-DEPS-RISK: ${fn.depsRisk || 'LOW'}
 * GEMS-TEST: ${fn.testStrategy}
 * GEMS-TEST-FILE: ${fn.testFile}
 */
${stepAnchors}
\`\`\`

**檔案**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| \`${fn.filePath}\` | New | ${fn.description || fn.name} |`;
  }).join('\n\n---\n\n');

  // Integration 規範
  const p0p1 = story.functions.filter(f => f.priority === 'P0' || f.priority === 'P1');
  const integrationSpec = p0p1.length > 0
    ? p0p1.map(f => `- ${f.name}: 禁止 mock 依賴，使用真實實例`).join('\n')
    : '- 本 Story 無 P0/P1 函式，無需 Integration 測試';

  // 範圍清單
  const scopeNames = story.functions.map(f => f.name).join(', ');

  // 契約注入（基礎 Story 定義契約，功能 Story 引用契約）
  let contractSection = '';
  if (spec.contracts.length > 0) {
    const contract = spec.contracts[0];
    if (story.isFoundation) {
      const fields = contract.fields.map(f =>
        `  ${f.name}: ${f.type};  // ${f.description}`
      ).join('\n');
      contractSection = `
---

## 6. 規格注入

\`\`\`typescript
// @GEMS-CONTRACT: ${contract.entityName}
interface ${contract.entityName} {
${fields}
}
\`\`\``;
    } else {
      // 功能模組引用 Story-X.0 定義的契約
      contractSection = `
---

## 6. 規格注入

> 引用 Story-${story.id.match(/\d+/)[0]}.0 定義的核心型別

\`\`\`typescript
// @GEMS-CONTRACT-REF: ${contract.entityName}
// 本模組使用 shared/types 匯出的 ${contract.entityName} interface
import type { ${contract.entityName} } from '../../shared/types/core-types';
\`\`\``;
    }
  }

  return `# Implementation Plan - ${storyId}

**迭代**: iter-${iterNum}
**Story ID**: ${storyId}
**日期**: ${today}
**目標模組**: ${story.moduleName}
**來源**: spec-parser 自動生成 (plan-generator v1.0)

> Status: READY FOR BUILD

---

## 1. Story 目標

**一句話目標**: ${story.title}

**範圍**:
- ✅ 包含: ${scopeNames}
- ❌ 不包含: 非本 Story 的功能

---

## 2. 模組資訊

- **Story 類型**: ${story.isFoundation ? '[x] Story-X.0' : '[ ] Story-X.0'} | ${story.isFoundation ? '[ ] 功能模組' : '[x] 功能模組'}
- **模組名稱**: ${story.moduleName}
- **模組類型**: ${story.isFoundation ? 'infrastructure' : 'feature'}
- **是否新模組**: ✅ 是

---

## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
${workItems}

---

## 4. Item 詳細規格

${itemSpecs}

---

## 5. Integration 非 Mock 規範

${integrationSpec}
${contractSection}

---

## 8. 架構審查

| 檢查項目 | 結果 |
|----------|------|
| 模組化結構 | ✅ |
| 依賴方向 | ✅ ${story.moduleName} → shared |
| 複雜度 | ✅ ${story.functions.length} 個動作 |

---

**產出日期**: ${today}
**生成方式**: plan-generator v1.0 (從 requirement_spec 機械轉換)
`;
}

module.exports = { generatePlansFromSpec, generatePlanForStory };
