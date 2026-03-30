#!/usr/bin/env node
/**
 * Plan Generator v2.0 - 從 contract @GEMS-STORIES 自動產生 implementation_plan
 * 
 * contract 是單一規格來源（Single Source of Truth）。
 * plan-generator 只讀 contract 的 @GEMS-STORY / @GEMS-STORY-ITEM，
 * 機械轉換為 implementation_plan_Story-X.Y.md。
 * 
 * 用法:
 *   const { generatePlansFromContract } = require('./plan-generator.cjs');
 *   const result = generatePlansFromContract(contractPath, iterNum, target);
 */
const fs = require('fs');
const path = require('path');

// contract-writer 提供 parseContract + loadContract
let contractWriter;
try {
  contractWriter = require(path.join(__dirname, '..', '..', '..', 'sdid-tools', 'blueprint', 'contract-writer.cjs'));
} catch {
  // fallback: 相對路徑可能因 cwd 不同而失敗
  contractWriter = null;
}

/**
 * 從 contract 產生所有 Story 的 implementation_plan
 * @param {string} contractPath - contract_iter-N.ts 檔案路徑
 * @param {number} iterNum - 迭代編號
 * @param {string} target - 專案根目錄
 * @param {object} options - { dryRun }
 * @returns {object} { generated: [{ storyId, module, file, functionCount }], errors: [] }
 */
/** GEMS: generatePlansFromContract | P1 | parseContract(IO)→generatePlanContent(Complicated)→writePlanFiles(IO)→RETURN:GenerateResult | Story-4.0 */
function generatePlansFromContract(contractPath, iterNum, target, options = {}) {
  const { dryRun = false } = options;
  const result = { generated: [], errors: [] };

  if (!fs.existsSync(contractPath)) {
    result.errors.push(`contract 檔案不存在: ${contractPath}`);
    return result;
  }

  const content = fs.readFileSync(contractPath, 'utf8');
  let parsed;
  if (contractWriter) {
    parsed = contractWriter.parseContract(content);
  } else {
    result.errors.push('無法載入 contract-writer.cjs — parseContract 不可用');
    return result;
  }

  if (!parsed.stories || parsed.stories.length === 0) {
    result.errors.push('contract 中未找到 @GEMS-STORY 定義');
    return result;
  }

  const planDir = path.join(target, '.gems', 'iterations', `iter-${iterNum}`, 'plan');
  if (!dryRun) {
    fs.mkdirSync(planDir, { recursive: true });
  }

  // v7.1: 從 blueprint **源碼路徑** 讀取 srcRoot（支援多根目錄）
  let srcRoot = 'src';
  try {
    const { getSrcDirs } = require('../shared/project-type.cjs');
    const srcDirs = getSrcDirs(target);
    if (srcDirs.length > 0) {
      srcRoot = path.relative(target, srcDirs[0]).replace(/\\/g, '/') || 'src';
    }
  } catch { /* fallback to src */ }

  for (const story of parsed.stories) {
    const planContent = generatePlanForStory(story, iterNum, parsed, srcRoot);
    const planFile = path.join(planDir, `implementation_plan_${story.id}.md`);

    if (!dryRun) {
      fs.writeFileSync(planFile, planContent, 'utf8');
    }

    result.generated.push({
      storyId: story.id,
      module: story.module,
      file: path.relative(target, planFile),
      functionCount: story.items.length,
    });
  }

  // 產出 ac.ts（從 contract 的 @GEMS-AC 區塊分離，如果 contract-writer 還沒做的話）
  const acTsPath = path.join(target, '.gems', 'iterations', `iter-${iterNum}`, 'poc', 'ac.ts');
  if (!fs.existsSync(acTsPath)) {
    // ac.ts 由 contract-writer @PASS 時自動分離，這裡不重複
    result.acGenerated = null;
  }

  return result;
}

// 向後相容：舊的 generatePlansFromSpec 轉接到 generatePlansFromContract
function generatePlansFromSpec(specPath, iterNum, target, options = {}) {
  // 嘗試找 contract 檔案
  // v6: contract 在 iter-N/ 下；v5 legacy fallback: iter-N/poc/
  const contractPathV6 = path.join(target, '.gems', 'iterations', `iter-${iterNum}`, `contract_iter-${iterNum}.ts`);
  const contractPathV5 = path.join(target, '.gems', 'iterations', `iter-${iterNum}`, 'poc', `contract_iter-${iterNum}.ts`);
  const contractPath = fs.existsSync(contractPathV6) ? contractPathV6
    : fs.existsSync(contractPathV5) ? contractPathV5 : null;
  if (contractPath && fs.existsSync(contractPath)) {
    return generatePlansFromContract(contractPath, iterNum, target, options);
  }
  // 真的沒有 contract → 報錯
  const expectedPath = contractPathV6;
  return { generated: [], errors: [`找不到 contract: ${expectedPath}（請先完成 CONTRACT 階段）`] };
}

/**
 * 為單一 Story 產生 implementation_plan Markdown
 * @param {object} story - { id, module, title, type, items: [{ name, type, priority, flow, deps, ac }] }
 * @param {number} iterNum
 * @param {object} parsed - parseContract 的完整結果
 * @param {string} srcRoot - src 根目錄（相對 target，如 'src' 或 'backend-gas/src'），從 blueprint 讀取
 */
function generatePlanForStory(story, iterNum, parsed, srcRoot = 'src') {
  const today = new Date().toISOString().split('T')[0];
  const storyId = story.id;
  const isFoundation = story.type === 'INFRA' || /shared|config|infrastructure/i.test(story.module);

  // 工作項目表
  const workItems = story.items.map((item, i) =>
    `| ${i + 1} | ${item.name} | ${item.type} | ${item.priority} | ✅ 明確 | - |`
  ).join('\n');

  // Item 詳細規格
  const itemSpecs = story.items.map((item, i) => {
    const stepAnchors = item.flow
      ? item.flow.split('→').map(s => `// [STEP] ${s.trim()}`).join('\n')
      : '';

    const depsStr = item.deps === '無' ? '無' : item.deps;
    const depsRisk = depsStr === '無' ? 'LOW' : (depsStr.split(',').length >= 3 ? 'HIGH' : 'MEDIUM');
    const filePath = inferFilePath(item.name, item.type, story.module, srcRoot);

    return `### Item ${i + 1}: ${item.name}

**Type**: ${item.type} | **Priority**: ${item.priority}

\`\`\`typescript
// @GEMS-FUNCTION: ${item.name}
/**
 * GEMS: ${item.name} | ${item.priority} | ○○ | (args)→Result | ${storyId} | ${item.name}
 * GEMS-FLOW: ${item.flow}
 * GEMS-DEPS: ${depsStr}
 * GEMS-DEPS-RISK: ${depsRisk}
 */
${item.ac && item.ac !== '無' && item.ac !== 'SKIP' ? `// ${item.ac}` : ''}
${stepAnchors}
\`\`\`

**檔案**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| \`${filePath}\` | New | ${item.name} |`;
  }).join('\n\n---\n\n');

  // Integration 規範
  const p0p1 = story.items.filter(f => f.priority === 'P0' || f.priority === 'P1');
  const integrationSpec = p0p1.length > 0
    ? p0p1.map(f => `- ${f.name}: 禁止 mock 依賴，使用真實實例`).join('\n')
    : '- 本 Story 無 P0/P1 函式，無需 Integration 測試';

  // 範圍清單
  const scopeNames = story.items.map(f => f.name).join(', ');

  // 契約注入
  let contractSection = '';
  if (parsed.entities.length > 0) {
    const storyEntities = parsed.entities.filter(e => e.story === storyId);
    if (storyEntities.length > 0) {
      const entityBlocks = storyEntities.map(entity => {
        const fields = entity.fields.map(f =>
          `  ${f.name}: ${f.tsType};  // ${f.dbType}`
        ).join('\n');
        return `\`\`\`typescript
// @GEMS-CONTRACT: ${entity.name}
interface ${entity.name} {
${fields}
}
\`\`\``;
      }).join('\n\n');
      contractSection = `
---

## 6. 規格注入

${entityBlocks}`;
    } else {
      // 功能模組引用基礎 Story 定義的契約
      const baseEntities = parsed.entities.filter(e => !e.story || /Story-\d+\.0/.test(e.story));
      if (baseEntities.length > 0) {
        const refs = baseEntities.map(e => e.name).join(', ');
        contractSection = `
---

## 6. 規格注入

> 引用基礎 Story 定義的核心型別

\`\`\`typescript
// @GEMS-CONTRACT-REF: ${refs}
import type { ${refs} } from '../../shared/types/core-types';
\`\`\``;
      }
    }
  }

  return `# Implementation Plan - ${storyId}

**迭代**: iter-${iterNum}
**Story ID**: ${storyId}
**日期**: ${today}
**目標模組**: ${story.module}
**來源**: contract-parser 自動生成 (plan-generator v2.0)

> Status: READY FOR BUILD

---

## 1. Story 目標

**一句話目標**: ${story.title}

**範圍**:
- ✅ 包含: ${scopeNames}
- ❌ 不包含: 非本 Story 的功能

---

## 2. 模組資訊

- **Story 類型**: ${isFoundation ? '[x] Story-X.0' : '[ ] Story-X.0'} | ${isFoundation ? '[ ] 功能模組' : '[x] 功能模組'}
- **模組名稱**: ${story.module}
- **模組類型**: ${isFoundation ? 'infrastructure' : 'feature'}
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
| 依賴方向 | ✅ ${story.module} → shared |
| 複雜度 | ✅ ${story.items.length} 個動作 |

---

**產出日期**: ${today}
**生成方式**: plan-generator v2.0 (從 contract @GEMS-STORIES 機械轉換)
`;
}

/**
 * 推導檔案路徑（從 contract story item）
 * v7.1: 接受 srcRoot 參數，從 blueprint **源碼路徑** 傳入
 * @param {string} name - 函式/元件名稱
 * @param {string} type - GEMS 類型（CONST/LIB/API/SVC/HOOK/UI/ROUTE）
 * @param {string} moduleName - 模組名稱
 * @param {string} srcRoot - src 根目錄相對路徑（預設 'src'，多根目錄時如 'backend-gas/src'）
 */
function inferFilePath(name, type, moduleName, srcRoot = 'src') {
  const kebab = name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

  const isShared = moduleName === 'shared';
  const base = isShared ? `${srcRoot}/shared` : `${srcRoot}/modules/${moduleName}`;

  switch (type) {
    case 'CONST': return `${base}/${isShared ? 'types/' : ''}${kebab}.ts`;
    case 'LIB': return `${base}/${isShared ? 'storage/' : 'lib/'}${kebab}.ts`;
    case 'SVC': return `${base}/services/${kebab}.ts`;
    case 'API': return `${base}/api/${kebab}.ts`;
    case 'HOOK': return `${base}/hooks/${kebab}.ts`;
    case 'UI': return `${base}/components/${kebab}.tsx`;
    case 'ROUTE': return `${base}/pages/${kebab}.tsx`;
    default: return `${base}/${kebab}.ts`;
  }
}

module.exports = { generatePlansFromContract, generatePlansFromSpec, generatePlanForStory };
