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

  // v4: 解析 @CONTRACT/@TEST/@RISK/Behavior: 區塊，建立 storyId → contracts 映射
  const isV4 = /\/\/\s*@CONTRACT:\s*\w+/.test(content);
  const v4ContractMap = isV4 ? parseV4Contracts(content) : {};

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
    const v4Info = v4ContractMap[story.id] || null;
    const planContent = generatePlanForStory(story, iterNum, parsed, srcRoot, v4Info, contractPath);
    const planFile = path.join(planDir, `implementation_plan_${story.id}.md`);

    if (!dryRun) {
      fs.writeFileSync(planFile, planContent, 'utf8');
    }

    result.generated.push({
      storyId: story.id,
      module: story.module,
      file: path.relative(target, planFile),
      // v4: 用 @CONTRACT blocks 數量（contract block = slice）；fallback 用 story.items
      functionCount: (v4Info && v4Info.length > 0) ? v4Info.length : story.items.length,
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
 * 解析 v4 contract 中的 @CONTRACT/@TEST/Behavior: 區塊
 * 回傳 storyId → [{ name, testPath, risk, flow, behaviors }] 的映射
 */
function parseV4Contracts(content) {
  const map = {};
  // 找每個 @CONTRACT: 區塊（到下一個 @CONTRACT: 或 export 為止）
  const blockRegex = /\/\/\s*@CONTRACT:\s*(.+?)(?=\n\/\/\s*@CONTRACT:|\nexport\s+(?:interface|declare|type|class|function)|$)/gs;
  for (const m of content.matchAll(blockRegex)) {
    const block = m[0];
    const headerParts = m[1].trim().split('|').map(s => s.trim());
    const storyId = headerParts[3] || '';
    if (!storyId) continue;

    const testMatch = block.match(/\/\/\s*@TEST:\s*(.+\.(?:test|spec)\.tsx?)/);
    const riskMatch = block.match(/\/\/\s*@RISK:\s*(.+)/);
    const flowMatch = block.match(/\/\/\s*@GEMS-FLOW:\s*(.+)/);
    const behaviorLines = [...block.matchAll(/\/\/\s*-\s*(.+)/g)].map(b => b[1].trim());

    if (!map[storyId]) map[storyId] = [];
    map[storyId].push({
      name: headerParts[0] || '',
      priority: headerParts[1] || '',
      type: headerParts[2] || '',
      testPath: testMatch ? testMatch[1].trim() : null,
      risk: riskMatch ? riskMatch[1].trim() : null,
      flow: flowMatch ? flowMatch[1].trim() : null,
      behaviors: behaviorLines,
    });
  }
  return map;
}

/**
 * 為單一 Story 產生 implementation_plan Markdown
 * @param {object} story - { id, module, title, type, items: [...] }
 * @param {number} iterNum
 * @param {object} parsed - parseContract 的完整結果
 * @param {string} srcRoot - src 根目錄
 * @param {Array|null} v4Info - parseV4Contracts 解析出的該 story contracts（v4 專用）
 * @param {string|null} contractPath - contract 檔案路徑（供 @PLAN_TRACE 嵌入）
 */
function generatePlanForStory(story, iterNum, parsed, srcRoot = 'src', v4Info = null, contractPath = null) {
  const today = new Date().toISOString().split('T')[0];
  const storyId = story.id;
  const isFoundation = story.type === 'INFRA' || /shared|config|infrastructure/i.test(story.module);

  // v4: @CONTRACT blocks 作為主要 slices（contract block = slice = plan task）
  // fallback: story.items（來自 @GEMS-STORY-ITEM，向後相容）
  const isV4 = v4Info && v4Info.length > 0;
  const slices = isV4
    ? v4Info.map(c => ({
        name: c.name,
        type: c.type || 'SVC',
        priority: c.priority || 'P1',
        flow: c.flow || null,
        risk: c.risk || null,
        testPath: c.testPath || null,
        behaviors: c.behaviors || [],
        deps: null,
        ac: null,
      }))
    : story.items;

  // @PLAN_TRACE 區塊（嵌入 plan 檔案，供 validator 機械驗證）
  const relativeContractPath = contractPath
    ? contractPath.replace(/\\/g, '/')
    : `.gems/iterations/iter-${iterNum}/contract_iter-${iterNum}.ts`;
  const planTracePath = `.gems/iterations/iter-${iterNum}/plan/implementation_plan_${storyId}.md`;
  const planTraceBlock = `<!--
@PLAN_TRACE | ${storyId}
  SOURCE_CONTRACT: ${relativeContractPath}
  TARGET_PLAN: ${planTracePath}
  SLICE_COUNT: ${slices.length}
-->

`;

  // 工作項目表
  const workItems = slices.map((item, i) =>
    `| ${i + 1} | ${item.name} | ${item.type} | ${item.priority} | ✅ 明確 | - |`
  ).join('\n');

  // Item 詳細規格
  const itemSpecs = slices.map((item, i) => {
    const stepAnchors = item.flow
      ? item.flow.split('→').map(s => `// [STEP] ${s.trim()}`).join('\n')
      : '';

    const depsStr = (item.deps && item.deps !== '無') ? item.deps : '無';
    const depsRisk = depsStr === '無' ? 'LOW' : (depsStr.split(',').length >= 3 ? 'HIGH' : 'MEDIUM');
    const filePath = inferFilePath(item.name, item.type, story.module, srcRoot);
    const riskLine = item.risk ? `\n**Risk**: ${item.risk}` : '';

    // v4 PRESERVE 區塊：@CONTRACT/@TEST/Behavior 原樣嵌入（機械驗證用）
    const preserveRef = isV4 ? `
<!-- SLICE_PRESERVE
@CONTRACT: ${item.name} | ${item.priority} | ${item.type} | ${storyId}${item.testPath ? `\n@TEST: ${item.testPath}` : ''}${item.risk ? `\n@RISK: ${item.risk}` : ''}${item.flow ? `\n@GEMS-FLOW: ${item.flow}` : ''}${item.behaviors.length > 0 ? '\nBehavior:\n' + item.behaviors.map(b => `  - ${b}`).join('\n') : ''}
-->` : '';

    return `### Item ${i + 1}: ${item.name}
${preserveRef}
**Type**: ${item.type} | **Priority**: ${item.priority}${riskLine}

\`\`\`typescript
// @GEMS-FUNCTION: ${item.name}
/**
 * GEMS: ${item.name} | ${item.priority} | ○○ | (args)→Result | ${storyId} | ${item.name}
 * GEMS-FLOW: ${item.flow || ''}
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
  const p0p1 = slices.filter(f => f.priority === 'P0' || f.priority === 'P1');
  const integrationSpec = p0p1.length > 0
    ? p0p1.map(f => `- ${f.name}: 禁止 mock 依賴，使用真實實例`).join('\n')
    : '- 本 Story 無 P0/P1 函式，無需 Integration 測試';

  // 範圍清單
  const scopeNames = slices.map(f => f.name).join(', ');

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

  // Step 0（v4 only）: 寫 RED 測試
  const step0Section = v4Info && v4Info.some(c => c.testPath)
    ? `## 0. ⚡ TDD 第一步：寫 RED 測試（v4 必做）

> **在 Phase 1 建骨架之前**，先寫好 @TEST 指定的測試檔（RED 狀態）。
> Phase 2 只改實作讓測試 GREEN，不能動測試檔。

${v4Info.filter(c => c.testPath).map(c => `### ${c.name}（${c.priority} | ${c.type}）

**測試檔**：\`${c.testPath}\`
${c.risk ? `**風險**：${c.risk}` : ''}

**Behavior: 對應測試案例**：
${c.behaviors.length > 0
  ? c.behaviors.map(b => `- \`it('${b.replace(/→/, '→').replace(/^[^(]+\([^)]*\)\s*→\s*/, '')}', () => { ... })\``).join('\n')
  : '（依 contract Behavior: 自行補充）'}

**RED 確認**：
\`\`\`bash
npx vitest run ${c.testPath} --reporter=verbose
# → FAIL（因 import 的函式不存在）= 正確 RED
\`\`\`
`).join('\n---\n\n')}

---

`
    : '';

  return `${planTraceBlock}# Implementation Plan - ${storyId}

**迭代**: iter-${iterNum}
**Story ID**: ${storyId}
**日期**: ${today}
**目標模組**: ${story.module}
**來源**: contract-parser 自動生成 (plan-generator v2.1${v4Info ? ' | v4-HARNESS' : ''})

> Status: READY FOR BUILD${v4Info && v4Info.some(c => c.testPath) ? '\n> ⚡ v4 模式：先寫 RED 測試（Step 0），再建骨架（Phase 1）' : ''}

---

${step0Section}## 1. Story 目標

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
