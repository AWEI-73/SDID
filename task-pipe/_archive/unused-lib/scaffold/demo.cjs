#!/usr/bin/env node
/**
 * Scaffold Demo - 完整流程演示
 * 
 * 流程: 產出骨架 → AI 填值 → 驗證
 */
const fs = require('fs');
const path = require('path');

// ============================================
// Step 1: 高完整度骨架產生器
// ============================================

/**
 * 產出 Implementation Plan 骨架（高完整度版本）
 * 包含完整的 GEMS 標籤規格
 */
function generatePlanScaffold(ctx) {
    const date = new Date().toISOString().split('T')[0];
    const storyId = ctx.storyId || 'Story-1.0';
    const iterNum = storyId.match(/(\d+)\.\d+/)?.[1] || '1';
    const moduleName = ctx.moduleName || 'QuestionBank';

    return `# Implementation Plan - ${storyId}

**迭代**: iter-${iterNum}  
**Story ID**: ${storyId}  
**日期**: ${date}  
**目標模組**: ${ctx.moduleId || moduleName.toLowerCase()}

> Status: READY FOR BUILD

---

## 1. Story 目標

**一句話目標**: ${ctx.objective || '{填寫本次 Story 目標}'}

**範圍**:
- ✅ 包含: ${ctx.includes || '{功能 A}, {功能 B}'}
- ❌ 不包含: ${ctx.excludes || '{功能 C}'}

---

## 2. 模組資訊

- **Story 類型**: [x] **Story-${storyId.endsWith('.0') ? 'X.0 (Module 0)** - 基礎建設' : 'X.Y (Module N)** - 業務模組'}
- **模組名稱**: ${moduleName}
- **模組類型**: standard
- **是否新模組**: ✅ 是

---

## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | ${ctx.item1Name || '{核心功能}'} | FEATURE | P0 | ✅ 明確 | 2h |
| 2 | ${ctx.item2Name || '{輔助功能}'} | FEATURE | P1 | ✅ 明確 | 1h |

---

## 4. Item 詳細規格

### Item 1: ${ctx.item1Name || '{核心功能}'}

**Type**: FEATURE  
**Priority**: P0  
**明確度**: ✅ 明確

#### 📋 GEMS 標籤規格（高完整度版本）

##### 資料契約 (@GEMS-CONTRACT)

\`\`\`typescript
// @GEMS-CONTRACT: ${moduleName}Contract
// @GEMS-STORY: ${storyId}
// @GEMS-TABLE: tbl_${moduleName.toLowerCase()}

/**
 * ${moduleName} 實體型別
 */
export interface ${moduleName}Entity {
  /** @GEMS-FIELD: id | PK | UUID | auto-generated */
  id: string;
  
  /** @GEMS-FIELD: ${ctx.field1 || 'title'} | string | required | 主要欄位 */
  ${ctx.field1 || 'title'}: string;
  
  /** @GEMS-FIELD: ${ctx.field2 || 'content'} | string | optional | 內容欄位 */
  ${ctx.field2 || 'content'}?: string;
  
  /** @GEMS-FIELD: createdAt | DateTime | auto-generated */
  createdAt: Date;
  
  /** @GEMS-FIELD: updatedAt | DateTime | auto-updated */
  updatedAt: Date;
}

/**
 * 新增輸入型別
 */
export interface Create${moduleName}Input {
  ${ctx.field1 || 'title'}: string;
  ${ctx.field2 || 'content'}?: string;
}

/**
 * 更新輸入型別
 */
export interface Update${moduleName}Input {
  id: string;
  ${ctx.field1 || 'title'}?: string;
  ${ctx.field2 || 'content'}?: string;
}
\`\`\`

##### 核心函式標籤

\`\`\`typescript
/**
 * GEMS: ${ctx.fn1Name || 'create' + moduleName} | P0 | ✓✓ | (Create${moduleName}Input)→Promise<${moduleName}Entity> | ${storyId} | ${ctx.fn1Desc || '新增記錄'}
 * GEMS-FLOW: ValidateInput→GenerateId→SetTimestamp→SaveToStorage→ReturnEntity
 * GEMS-DEPS: [Internal.${moduleName}Contract (型別), Internal.Storage (儲存)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: ${ctx.fn1Name || 'create' + moduleName}.test.ts
 */
export async function ${ctx.fn1Name || 'create' + moduleName}(input: Create${moduleName}Input): Promise<${moduleName}Entity> {
  // [STEP] ValidateInput - 驗證輸入資料
  validateInput(input);
  
  // [STEP] GenerateId - 產生唯一 ID
  const id = generateUUID();
  
  // [STEP] SetTimestamp - 設定時間戳
  const now = new Date();
  
  // [STEP] SaveToStorage - 儲存到 Storage
  const entity: ${moduleName}Entity = { id, ...input, createdAt: now, updatedAt: now };
  await storage.save(entity);
  
  // [STEP] ReturnEntity - 返回實體
  return entity;
}

/**
 * GEMS: ${ctx.fn2Name || 'get' + moduleName + 'List'} | P0 | ✓○ | ()→Promise<${moduleName}Entity[]> | ${storyId} | ${ctx.fn2Desc || '取得列表'}
 * GEMS-FLOW: LoadFromStorage→SortByDate→ReturnList
 * GEMS-DEPS: [Internal.Storage (讀取)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: ${ctx.fn2Name || 'get' + moduleName + 'List'}.test.ts
 */
export async function ${ctx.fn2Name || 'get' + moduleName + 'List'}(): Promise<${moduleName}Entity[]> {
  // [STEP] LoadFromStorage - 從 Storage 載入
  const items = await storage.getAll();
  
  // [STEP] SortByDate - 依日期排序
  items.sort((a, b) => b.createdAt - a.createdAt);
  
  // [STEP] ReturnList - 返回列表
  return items;
}

/**
 * GEMS: ${ctx.fn3Name || 'update' + moduleName} | P1 | ✓○ | (Update${moduleName}Input)→Promise<${moduleName}Entity> | ${storyId} | ${ctx.fn3Desc || '更新記錄'}
 * GEMS-FLOW: ValidateId→LoadExisting→MergeChanges→UpdateTimestamp→SaveToStorage→ReturnEntity
 * GEMS-DEPS: [Internal.${moduleName}Contract (型別), Internal.Storage (讀寫)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: ${ctx.fn3Name || 'update' + moduleName}.test.ts
 */
export async function ${ctx.fn3Name || 'update' + moduleName}(input: Update${moduleName}Input): Promise<${moduleName}Entity> {
  // [STEP] ValidateId - 驗證 ID 存在
  // [STEP] LoadExisting - 載入現有資料
  // [STEP] MergeChanges - 合併變更
  // [STEP] UpdateTimestamp - 更新時間戳
  // [STEP] SaveToStorage - 儲存
  // [STEP] ReturnEntity - 返回
}

/**
 * GEMS: ${ctx.fn4Name || 'delete' + moduleName} | P1 | ○○ | (id: string)→Promise<boolean> | ${storyId} | ${ctx.fn4Desc || '刪除記錄'}
 * GEMS-FLOW: ValidateId→CheckExists→RemoveFromStorage→ReturnSuccess
 * GEMS-DEPS: [Internal.Storage (刪除)]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: ${ctx.fn4Name || 'delete' + moduleName}.test.ts
 */
export async function ${ctx.fn4Name || 'delete' + moduleName}(id: string): Promise<boolean> {
  // [STEP] ValidateId - 驗證 ID
  // [STEP] CheckExists - 確認存在
  // [STEP] RemoveFromStorage - 移除
  // [STEP] ReturnSuccess - 返回成功
}
\`\`\`

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| \`src/types.ts\` | New | 型別定義 |
| \`src/storage.ts\` | New | 儲存邏輯 |
| \`src/main.ts\` | New | 核心功能 |
| \`src/ui.ts\` | New | UI 邏輯 |

**驗收標準**:
- AC-${storyId.replace('Story-', '')}.1: 可新增記錄
- AC-${storyId.replace('Story-', '')}.2: 可查看列表

---

## 5. 規格注入

### 5.1 資料契約 (@GEMS-CONTRACT)

✅ 已在 Item 1 定義完整 Contract

### 5.2 業務流程 (GEMS-FLOW)

\`\`\`
GEMS-FLOW: UserAction→ValidateInput→ProcessData→UpdateStorage→RefreshUI
\`\`\`

---

## 8. 架構審查 (Constitution Audit)

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| **模組化結構** | ✅ 通過 | 遵循單一職責原則 |
| **依賴方向** | ✅ 通過 | 無循環依賴 |
| **模組隔離** | ✅ 通過 | 透過 Facade 暴露 API |
| **複雜度** | ✅ 通過 | P0 函式不超過 4 個 |
| **封裝** | ✅ 通過 | 適度封裝 |

---

**產出日期**: ${date} | **Agent**: PLAN
`;
}

// ============================================
// Step 2: 模擬 AI 填值
// ============================================

function simulateAIFillIn(scaffold) {
    // 模擬 AI 將 placeholder 替換為具體值
    return scaffold
        .replace(/\{填寫本次 Story 目標\}/g, '建立題庫管理系統基礎架構，包含 CRUD 功能')
        .replace(/\{功能 A\}, \{功能 B\}/g, '題目新增, 題目查詢, 題目更新, 題目刪除')
        .replace(/\{功能 C\}/g, '進階篩選, 匯入匯出')
        .replace(/\{核心功能\}/g, '題目 CRUD 功能')
        .replace(/\{輔助功能\}/g, 'UI 互動邏輯');
}

// ============================================
// Step 3: 驗證器
// ============================================

function validatePlan(content) {
    const checks = [
        { name: 'Story目標', regex: /Story 目標|一句話目標/i, required: true },
        { name: '資料契約', regex: /@GEMS-CONTRACT|interface\s+\w+/i, required: true },
        { name: '功能清單(P0/P1/P2)', regex: /\|\s*P[012]\s*\|/i, required: true },
        { name: '架構審查', regex: /架構審查|單一職責/i, required: true },
        { name: 'GEMS-FLOW標籤', regex: /GEMS-FLOW:/i, required: true },
        { name: 'GEMS-DEPS標籤', regex: /GEMS-DEPS:/i, required: true },
        { name: 'GEMS-TEST標籤', regex: /GEMS-TEST:/i, required: true },
        { name: 'GEMS-TEST-FILE標籤', regex: /GEMS-TEST-FILE:/i, required: true },
        { name: '[STEP]錨點', regex: /\[STEP\]/i, required: true },
        { name: 'READY FOR BUILD', regex: /READY FOR BUILD/i, required: true },
    ];

    const results = [];
    for (const check of checks) {
        results.push({
            name: check.name,
            pass: check.regex.test(content),
            required: check.required
        });
    }

    return results;
}

// ============================================
// Demo 執行
// ============================================

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║           Scaffold Demo: 產出 → 填值 → 驗證                 ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Step 1: 產出骨架
console.log('📋 Step 1: 產出高完整度骨架...\n');
const context = {
    storyId: 'Story-1.0',
    moduleName: 'Question',
    moduleId: 'question-bank',
    field1: 'title',
    field2: 'content',
    fn1Name: 'createQuestion',
    fn1Desc: '新增題目',
    fn2Name: 'getQuestionList',
    fn2Desc: '取得題目列表',
    fn3Name: 'updateQuestion',
    fn3Desc: '更新題目',
    fn4Name: 'deleteQuestion',
    fn4Desc: '刪除題目',
    item1Name: '題目 CRUD 功能',
    item2Name: 'UI 互動邏輯'
};

const scaffold = generatePlanScaffold(context);
console.log('✅ 骨架產出完成！\n');

// 顯示骨架中的 GEMS 標籤數量
const gemsTagCount = (scaffold.match(/GEMS[-_]?[A-Z]+:/g) || []).length;
const stepCount = (scaffold.match(/\[STEP\]/g) || []).length;
console.log(`   📊 統計:
   - GEMS 標籤: ${gemsTagCount} 個
   - [STEP] 錨點: ${stepCount} 個
   - 總行數: ${scaffold.split('\n').length} 行\n`);

// Step 2: 模擬填值
console.log('✏️  Step 2: 模擬 AI 填入具體值...\n');
const filledPlan = simulateAIFillIn(scaffold);
console.log('✅ 填值完成！\n');

// Step 3: 驗證
console.log('🔍 Step 3: 執行驗證...\n');
const validationResults = validatePlan(filledPlan);

console.log('   驗證結果:');
console.log('   ─────────────────────────────────────');
let allPass = true;
for (const result of validationResults) {
    const status = result.pass ? '✅' : '❌';
    console.log(`   ${status} ${result.name}`);
    if (!result.pass && result.required) allPass = false;
}
console.log('   ─────────────────────────────────────\n');

if (allPass) {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ 驗證通過！所有必填欄位都已填寫                          ║');
    console.log('║  → 可以進入 BUILD Phase                                      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
} else {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  ❌ 驗證失敗！請補充缺失欄位                                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

// 輸出範例（截取前 50 行）
console.log('📄 產出範例 (前 60 行):');
console.log('───────────────────────────────────────────────────────────────');
console.log(filledPlan.split('\n').slice(0, 60).join('\n'));
console.log('...(省略)...\n');

// 保存到檔案
const demoOutputPath = path.join(__dirname, '../../demo_output');
if (!fs.existsSync(demoOutputPath)) {
    fs.mkdirSync(demoOutputPath, { recursive: true });
}
const outputFile = path.join(demoOutputPath, 'implementation_plan_demo.md');
fs.writeFileSync(outputFile, filledPlan, 'utf8');
console.log(`💾 完整檔案已保存: ${outputFile}`);
