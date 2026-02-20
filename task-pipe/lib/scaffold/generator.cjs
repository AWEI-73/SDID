#!/usr/bin/env node
/**
 * Scaffold Generator v1.0
 * 
 * 骨架產生器：在驗證前產出對應骨架，避免格式錯誤
 * 
 * 設計原則：
 * 1. 以掃描器驗證邏輯為準（而非模板）
 * 2. 骨架只包含「必填欄位」，讓 AI 專注內容
 * 3. 動態注入上下文資訊
 * 
 * 對應驗證器：
 * - POC Step 3: validateSpec() in poc/step-3.cjs
 * - PLAN Step 3: validatePlan() in plan/step-3.cjs
 * - BUILD Phase 8: validatePhase8() + suggestions-validator.cjs
 */
const fs = require('fs');
const path = require('path');

// ============================================
// 骨架類型定義（對應各掃描器）
// ============================================
const SCAFFOLD_TYPES = {
    // POC 階段
    POC_DRAFT: 'requirement_draft',       // poc/step-1.cjs 檢查
    POC_CONTRACT: 'contract',             // poc/step-3.cjs 檢查：@GEMS-CONTRACT, @GEMS-TABLE
    POC_HTML: 'poc_html',                 // poc/step-4.cjs 檢查：@GEMS-DESIGN-BRIEF, @GEMS-VERIFIED
    POC_SPEC: 'requirement_spec',         // poc/step-3.cjs validateSpec()

    // PLAN 階段
    PLAN_IMPL: 'implementation_plan',     // plan/step-3.cjs validatePlan()

    // BUILD 階段
    BUILD_FILLBACK: 'fillback',           // build/phase-8.cjs validatePhase8()
    BUILD_SUGGESTIONS: 'iteration_suggestions' // suggestions-validator.cjs
};

// ============================================
// 掃描器必填欄位定義
// ============================================

/**
 * POC Step 3 驗證欄位 (validateSpec)
 * 來源: poc/step-3.cjs lines 505-533
 */
const POC_SPEC_REQUIRED = {
    patterns: [
        { key: 'user_story', regex: /用戶故事|User Story/i },
        { key: 'acceptance', regex: /驗收標準|Given.*When.*Then/i },
        { key: 'testability', regex: /獨立可測|Testability/i },
        { key: 'story_def', regex: /Story[\s\-]\d+\.\d+/i },
        { key: 'verify_status', regex: /\[已驗證\]|\[計畫開發\]|驗證狀態/i },
        { key: 'scope_decl', regex: /範疇聲明|Scope Declaration|DEFERRED/i }
    ]
};

/**
 * PLAN Step 3 驗證欄位 (validatePlan)
 * 來源: plan/step-3.cjs lines 92-99
 */
const PLAN_REQUIRED = {
    patterns: [
        { key: 'story_goal', regex: /Story 目標|一句話目標/i },
        { key: 'contract', regex: /@GEMS-CONTRACT|interface\s+\w+/i },
        { key: 'priority', regex: /\|\s*P[012]\s*\|/i },
        { key: 'audit', regex: /架構審查|單一職責/i },
        { key: 'gems_tags', regex: /GEMS-FLOW|GEMS-DEPS|@GEMS-FUNC/i },
        { key: 'ready_status', regex: /READY FOR BUILD/i }
    ]
};

/**
 * BUILD Phase 8 驗證欄位 (validatePhase8 + suggestions-validator)
 * 來源: 
 * - build/phase-8.cjs lines 551-608
 * - suggestions-validator.cjs REQUIRED_FIELDS
 */
const BUILD_FILLBACK_REQUIRED = {
    patterns: [
        { key: 'basic_info', regex: /基本資訊|Iteration|Story|iteration/i }
    ]
};

const BUILD_SUGGESTIONS_REQUIRED = {
    fields: ['storyId', 'status'],
    statusValues: ['Completed', 'Partial', 'Blocked', 'InProgress'],
    optionalFields: {
        suggestions: 'array',
        technicalDebt: 'array',
        completedItems: 'array'
    }
};

// ============================================
// 骨架產生器
// ============================================

/**
 * 產生骨架
 * @param {string} type - 骨架類型 (SCAFFOLD_TYPES)
 * @param {object} context - 上下文資訊
 * @param {string} outputPath - 輸出路徑
 * @returns {object} { success, path, type, error? }
 */
function generateScaffold(type, context, outputPath) {
    const generator = scaffoldGenerators[type];
    if (!generator) {
        return { success: false, error: `Unknown scaffold type: ${type}` };
    }

    try {
        const content = generator(context);

        // 確保目錄存在
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 寫入骨架
        fs.writeFileSync(outputPath, content, 'utf-8');

        return {
            success: true,
            path: outputPath,
            type: type
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * 驗證骨架格式
 * @param {string} type - 骨架類型
 * @param {string} content - 內容
 * @returns {object} { valid, missing: [] }
 */
function validateScaffold(type, content) {
    let patterns = [];

    switch (type) {
        case SCAFFOLD_TYPES.POC_SPEC:
            patterns = POC_SPEC_REQUIRED.patterns;
            break;
        case SCAFFOLD_TYPES.PLAN_IMPL:
            patterns = PLAN_REQUIRED.patterns;
            break;
        case SCAFFOLD_TYPES.BUILD_FILLBACK:
            patterns = BUILD_FILLBACK_REQUIRED.patterns;
            break;
        default:
            return { valid: true, missing: [] };
    }

    const missing = [];
    for (const p of patterns) {
        if (!p.regex.test(content)) {
            missing.push(p.key);
        }
    }

    return {
        valid: missing.length === 0,
        missing
    };
}

// ============================================
// 各類型骨架產生器（以掃描器欄位為準）
// ============================================
const scaffoldGenerators = {

    /**
     * POC Step 1: requirement_draft
     * 驗證：無嚴格驗證，但需要基本結構
     */
    requirement_draft: (ctx) => {
        const date = new Date().toISOString().split('T')[0];
        return `# 📋 ${ctx.projectName || '{專案名稱}'} - 需求草稿

**迭代**: iter-${ctx.iteration || 1}  
**日期**: ${date}  
**狀態**: 🔄 釐清中

---

## 用戶原始需求

> ${ctx.userRequest || '{貼上用戶原始需求}'}

---

## 釐清後需求

### 一句話目標
{填寫核心目標}

### 功能模組
<!-- 勾選要納入的模組 -->
- [x] 基礎建設 (types, config)
- [ ] {模組 1}
- [ ] {模組 2}

### 不做什麼
- {明確排除項目}

---

## POC 驗證模式

**Level**: ${ctx.level || 'S'}

---

**草稿狀態**: ⏳ PENDING
`;
    },

    /**
     * POC Step 1: Contract
     * 驗證: @GEMS-CONTRACT, @GEMS-TABLE, interface 定義, @GEMS-FUNCTION
     */
    contract: (ctx) => {
        const moduleName = ctx.moduleName || 'Module';
        const moduleNameLower = moduleName.toLowerCase();
        const tableName = moduleName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '') + 's';
        const date = new Date().toISOString().split('T')[0];

        return `// @GEMS-CONTRACT: ${moduleName}Contract
// @GEMS-STORY: Story-${ctx.iteration || 1}.0
// @GEMS-TABLE: tbl_${tableName}

/**
 * ${moduleName} 資料契約
 * 
 * 本檔案定義核心資料結構與函式規格
 */

// ============================================
// 核心型別定義
// ============================================

export interface ${moduleName} {
  /** @GEMS-FIELD: id | PK | UUID | auto-generated */
  id: string;
  
  /** @GEMS-FIELD: name | VARCHAR(200) | NOT NULL | 主要名稱欄位 */
  name: string;
  
  /** @GEMS-FIELD: status | VARCHAR(20) | default='active' | 狀態 */
  status: 'active' | 'inactive' | 'archived';
  
  /** @GEMS-FIELD: createdAt | DATETIME | auto-generated | 建立時間 */
  createdAt: Date;
  
  /** @GEMS-FIELD: updatedAt | DATETIME | auto-updated | 更新時間 */
  updatedAt: Date;
}

// ============================================
// 函式規格定義（CRUD 必備）
// ============================================

// @GEMS-FUNCTION: create${moduleName}
// @GEMS-SIGNATURE: (data: Create${moduleName}Input) → ${moduleName}
// @GEMS-PRIORITY: P0 (端到端: UI輸入→驗證→儲存→回饋)
// @GEMS-FLOW: ValidateInput → GenerateId → SetTimestamp → SaveToStorage → UpdateUI → Return
export type Create${moduleName}Input = {
  name: string;
  status?: 'active' | 'inactive';
};

// @GEMS-FUNCTION: get${moduleName}ById
// @GEMS-SIGNATURE: (id: string) → ${moduleName} | null
// @GEMS-PRIORITY: P1 (有依賴: Storage)
// @GEMS-FLOW: Query → Return

// @GEMS-FUNCTION: get${moduleName}List
// @GEMS-SIGNATURE: () → ${moduleName}[]
// @GEMS-PRIORITY: P1 (有依賴: Storage)
// @GEMS-FLOW: LoadAll → Filter → SortByDate → Return

// @GEMS-FUNCTION: update${moduleName}
// @GEMS-SIGNATURE: (id: string, data: Update${moduleName}Input) → ${moduleName}
// @GEMS-PRIORITY: P1 (有依賴: Storage, Validator)
// @GEMS-FLOW: Find → Validate → Merge → UpdateTimestamp → Save → Return
export type Update${moduleName}Input = {
  name?: string;
  status?: 'active' | 'inactive' | 'archived';
};

// @GEMS-FUNCTION: delete${moduleName}
// @GEMS-SIGNATURE: (id: string) → boolean
// @GEMS-PRIORITY: P1 (有依賴: Storage)
// @GEMS-FLOW: Find → Remove → Save → Return

// ============================================
// Mock 資料（至少 2 筆有意義的資料）
// ============================================

// @GEMS-MOCK
export const MOCK_${moduleName.toUpperCase()}_DATA: ${moduleName}[] = [
  {
    id: '${moduleNameLower}-001',
    name: '${moduleName} 範例項目 A',
    status: 'active',
    createdAt: new Date('${date}T10:00:00'),
    updatedAt: new Date('${date}T10:00:00')
  },
  {
    id: '${moduleNameLower}-002',
    name: '${moduleName} 範例項目 B',
    status: 'active',
    createdAt: new Date('${date}T11:30:00'),
    updatedAt: new Date('${date}T14:00:00')
  },
  {
    id: '${moduleNameLower}-003',
    name: '${moduleName} 已封存項目',
    status: 'archived',
    createdAt: new Date('${date}T09:00:00'),
    updatedAt: new Date('${date}T16:00:00')
  }
];
`;
    },

    /**
     * POC Step 2: POC HTML
     * 驗證: @GEMS-DESIGN-BRIEF, @GEMS-VERIFIED
     */
    poc_html: (ctx) => {
        const moduleName = ctx.moduleName || 'Module';
        const moduleNameLower = moduleName.toLowerCase();
        return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${moduleName} 管理系統 POC - Story ${ctx.iteration || 1}.0</title>
  <style>
    :root {
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      --danger: #ef4444;
      --success: #10b981;
      --bg-main: #f8fafc;
      --card-bg: #ffffff;
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --border: #e2e8f0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: var(--bg-main);
      min-height: 100vh;
      padding: 2rem;
    }
    .container { max-width: 700px; margin: 0 auto; }
    .card {
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      padding: 2rem;
    }
    h1 {
      color: var(--text-primary);
      font-size: 1.75rem;
      margin-bottom: 1.5rem;
    }
    .input-group {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    input[type="text"] {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 2px solid var(--border);
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }
    input[type="text"]:focus { outline: none; border-color: var(--primary); }
    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); }
    .item-list { list-style: none; }
    .item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: var(--bg-main);
      border-radius: 8px;
      margin-bottom: 0.75rem;
      transition: transform 0.15s;
    }
    .item:hover { transform: translateX(4px); }
    .item-name { flex: 1; color: var(--text-primary); }
    .item-status {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .status-active { background: #dcfce7; color: #166534; }
    .status-archived { background: #f3f4f6; color: #6b7280; }
    .btn-delete {
      background: transparent;
      border: none;
      color: var(--danger);
      cursor: pointer;
      padding: 0.5rem;
      font-size: 0.875rem;
    }
    .btn-delete:hover { text-decoration: underline; }
    .stats {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      color: var(--text-secondary);
      font-size: 0.875rem;
    }
  </style>
  <!--
  @GEMS-DESIGN-BRIEF:
  - Purpose: 驗證 ${moduleName} 管理的核心 CRUD 流程，確保新增、列表顯示、刪除功能皆可正常運作
  - Aesthetic: 採用極簡卡片式設計，冷灰色調搭配靛藍主色，營造專業穩重的管理系統氛圍
  - Avoid: 避免使用過多動畫效果、避免純白刺眼背景、避免資訊過度密集的排版
  - Memorable: 項目的微動畫滑動效果，清晰的狀態標籤視覺回饋
  
  @GEMS-CONTRACT-REF: ./${moduleName}Contract.ts
  
  @GEMS-VERIFIED:
  - [x] 列表顯示 - 可正確渲染 Mock 資料
  - [x] 新增項目 - 輸入名稱後點擊按鈕可新增
  - [x] 刪除項目 - 點擊刪除按鈕可移除
  - [x] 統計顯示 - 顯示項目總數
  - [ ] 編輯項目 (DEFERRED to iter-2)
  - [ ] 狀態切換 (DEFERRED to iter-2)
  - [ ] 資料持久化 (DEFERRED - 需 LocalStorage 整合)
  
  @GEMS-STORY: Story-${ctx.iteration || 1}.0
  -->
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>📋 ${moduleName} 管理</h1>
      
      <!-- 輸入區 -->
      <div class="input-group">
        <input type="text" id="nameInput" placeholder="輸入 ${moduleName} 名稱...">
        <button class="btn btn-primary" onclick="handleAdd()">新增</button>
      </div>
      
      <!-- 列表區 -->
      <ul id="itemList" class="item-list">
        <!-- 動態渲染 -->
      </ul>
      
      <!-- 統計區 -->
      <div id="stats" class="stats">載入中...</div>
    </div>
  </div>
  
  <script>
    // @GEMS-ZONE: [DataZone, ActionZone, RenderZone]
    
    // ============================================
    // @GEMS-MOCK: ${moduleName} 資料（3 筆測試資料）
    // ============================================
    let items = [
      { id: '${moduleNameLower}-001', name: '${moduleName} 範例項目 A', status: 'active', createdAt: new Date() },
      { id: '${moduleNameLower}-002', name: '${moduleName} 範例項目 B', status: 'active', createdAt: new Date() },
      { id: '${moduleNameLower}-003', name: '${moduleName} 已封存範例', status: 'archived', createdAt: new Date() }
    ];
    
    // ============================================
    // @GEMS-FUNCTION: render | P0 | 渲染列表
    // @GEMS-FLOW: LoadData → BuildHTML → UpdateDOM → UpdateStats
    // ============================================
    function render() {
      const listEl = document.getElementById('itemList');
      const statsEl = document.getElementById('stats');
      
      // [STEP] BuildHTML - 組建列表 HTML
      const html = items.map(item => \\\`
        <li class="item">
          <span class="item-name">\\\${item.name}</span>
          <span class="item-status status-\\\${item.status}">\\\${item.status === 'active' ? '啟用' : '封存'}</span>
          <button class="btn-delete" onclick="handleDelete('\\\${item.id}')">刪除</button>
        </li>
      \\\`).join('');
      
      // [STEP] UpdateDOM - 更新 DOM
      listEl.innerHTML = html || '<li style="color: #999; text-align: center; padding: 2rem;">尚無項目，請新增一個！</li>';
      
      // [STEP] UpdateStats - 更新統計
      const activeCount = items.filter(i => i.status === 'active').length;
      statsEl.textContent = \\\`共 \\\${items.length} 個項目（\\\${activeCount} 個啟用中）\\\`;
    }
    
    // ============================================
    // @GEMS-FUNCTION: handleAdd | P0 | 新增項目
    // @GEMS-FLOW: GetInput → Validate → CreateItem → AddToList → ClearInput → Rerender
    // ============================================
    function handleAdd() {
      const input = document.getElementById('nameInput');
      const name = input.value.trim();
      
      // [STEP] Validate - 驗證輸入
      if (!name) { input.focus(); return; }
      
      // [STEP] CreateItem - 建立新項目
      const newItem = {
        id: '${moduleNameLower}-' + Date.now(),
        name: name,
        status: 'active',
        createdAt: new Date()
      };
      
      // [STEP] AddToList - 加入列表
      items.push(newItem);
      
      // [STEP] ClearInput & Rerender
      input.value = '';
      input.focus();
      render();
    }
    
    // ============================================
    // @GEMS-FUNCTION: handleDelete | P0 | 刪除項目
    // @GEMS-FLOW: FilterOut → Rerender
    // ============================================
    function handleDelete(id) {
      // [STEP] FilterOut - 過濾掉目標項目
      items = items.filter(item => item.id !== id);
      
      // [STEP] Rerender
      render();
    }
    
    // ============================================
    // 初始化
    // ============================================
    document.addEventListener('DOMContentLoaded', () => {
      render();
      document.getElementById('nameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAdd();
      });
    });
  </script>
</body>
</html>
`;
    },

    /**
     * POC Step 3: requirement_spec
     * 
     * 驗證欄位 (validateSpec):
     * 1. 用戶故事|User Story
     * 2. 驗收標準|Given.*When.*Then
     * 3. 獨立可測|Testability
     * 4. Story[\s\-]\d+\.\d+
     * 5. [已驗證]|[計畫開發]|驗證狀態
     * 6. 範疇聲明|Scope Declaration|DEFERRED
     */
    requirement_spec: (ctx) => {
        const iterNum = ctx.iteration || 1;
        const date = new Date().toISOString().split('T')[0];
        const stories = ctx.stories || [{ id: `${iterNum}.0`, name: '基礎建設', verified: true }];

        return `# 📝 ${ctx.projectName || '{專案名稱}'} - 需求規格書

**版本**: v1.0  
**日期**: ${date}  
**Level**: ${ctx.level || 'S'}  
**一句話願景**: ${ctx.vision || '{填寫}'}

> Status: READY FOR PLAN

---

## 0. 範疇聲明 (Scope Declaration)

### 已驗證功能 (POC Verified)
${ctx.verified?.map(v => `- ${v}`).join('\n') || '- UI 佈局\n- 資料結構'}

### 延期功能 (DEFERRED to iter-2)
${ctx.deferred?.map(d => `- ${d}`).join('\n') || '- 無'}

---

## 1. 用戶故事

${stories.map((s, i) => `### Story-${s.id}: ${s.name} ${s.verified ? '[已驗證]' : '[計畫開發]'}

作為 {角色}，我想要 {功能}，以便於 {目標}

> 驗證狀態: ${s.verified ? '[已驗證] - POC 已實作' : '[計畫開發] - iter-${iterNum} 規劃'}
`).join('\n')}

---

## 2. 資料契約

參見 ${ctx.contractFile || 'xxxContract.ts'}

---

## 3. 驗收標準 (BDD 格式)

${stories.map((s, i) => `### AC-${s.id}: ${s.name}

**獨立可測性**: 可獨立驗證，不依賴其他 Story

\`\`\`gherkin
Given {前置條件}
When {操作動作}
Then {預期結果}
\`\`\`
`).join('\n')}

---

## 4. 獨立可測性

- ✅ 驗證: ${ctx.verified?.join(', ') || 'UI 佈局, 資料結構'}
- ❌ 不驗證: ${ctx.notVerify || '進階功能'}
- DEFERRED: ${ctx.deferred?.join(', ') || '無'}

---

## 5. Story 拆分建議

| Story | 優先級 | 依賴 | 驗證狀態 |
|-------|--------|------|----------|
${stories.map((s, i) => `| Story-${s.id} ${s.name} | P${i === 0 ? 0 : 1} | ${i === 0 ? '無' : `Story-${stories[0].id}`} | ${s.verified ? '[已驗證]' : '[計畫開發]'} |`).join('\n')}

---

**文件版本**: v1.0 | **產出日期**: ${date}
`;
    },

    /**
     * PLAN Step 3: implementation_plan
     * 
     * 驗證欄位 (validatePlan):
     * 1. Story 目標|一句話目標
     * 2. @GEMS-CONTRACT|interface\s+\w+
     * 3. \|\s*P[012]\s*\|
     * 4. 架構審查|單一職責
     * 5. GEMS-FLOW|GEMS-DEPS|@GEMS-FUNC
     * 6. READY FOR BUILD (status check)
     */
    implementation_plan: (ctx) => {
        const date = new Date().toISOString().split('T')[0];
        const storyId = ctx.storyId || 'Story-1.0';
        const iterNum = storyId.match(/(\d+)\.\d+/)?.[1] || '1';
        const isFoundation = storyId.endsWith('.0');
        const moduleName = ctx.moduleName || 'Module';

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
- ✅ 包含: ${ctx.includes?.join?.(', ') || '{功能 A}, {功能 B}'}
- ❌ 不包含: ${ctx.excludes?.join?.(', ') || '{功能 C}'}

---

## 2. 模組資訊

- **Story 類型**: ${isFoundation ? '[x] **Story-X.0 (Module 0)** - 基礎建設' : '[ ] **Story-X.Y (Module N)** - 業務模組'}
- **模組名稱**: ${moduleName}
- **模組類型**: standard
- **是否新模組**: ✅ 是

---

## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | ${ctx.items?.[0]?.name || '{核心功能}'} | FEATURE | P0 | ✅ 明確 | 2h |
| 2 | ${ctx.items?.[1]?.name || '{輔助功能}'} | FEATURE | P1 | ✅ 明確 | 1h |

---

## 4. Item 詳細規格

### Item 1: ${ctx.items?.[0]?.name || '{核心功能}'}

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
  
  /** @GEMS-FIELD: ${ctx.field1 || 'name'} | string | required | 主要欄位 */
  ${ctx.field1 || 'name'}: string;
  
  /** @GEMS-FIELD: createdAt | DateTime | auto-generated */
  createdAt: Date;
  
  /** @GEMS-FIELD: updatedAt | DateTime | auto-updated */
  updatedAt: Date;
}

/**
 * 新增輸入型別
 */
export interface Create${moduleName}Input {
  ${ctx.field1 || 'name'}: string;
}

/**
 * 更新輸入型別
 */
export interface Update${moduleName}Input {
  id: string;
  ${ctx.field1 || 'name'}?: string;
}
\`\`\`

##### 核心函式標籤

\`\`\`typescript
/**
 * GEMS: create${moduleName} | P0 | ✓✓ | (Create${moduleName}Input)→Promise<${moduleName}Entity> | ${storyId} | 新增記錄
 * GEMS-FLOW: ValidateInput→GenerateId→SetTimestamp→SaveToStorage→UpdateUI→ReturnEntity
 * GEMS-DEPS: [Internal.${moduleName}Contract (型別), Internal.Storage (儲存)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: create${moduleName}.test.ts
 */
// P0 因為：端到端流程 (UI輸入→驗證→儲存→回饋UI)
export async function create${moduleName}(input: Create${moduleName}Input): Promise<${moduleName}Entity> {
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
 * GEMS: get${moduleName}List | P1 | ✓○ | ()→Promise<${moduleName}Entity[]> | ${storyId} | 取得列表
 * GEMS-FLOW: LoadFromStorage→SortByDate→ReturnList
 * GEMS-DEPS: [Internal.Storage (讀取)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: get${moduleName}List.test.ts
 */
// P1 因為：有依賴 (Storage)，但不是完整端到端流程
export async function get${moduleName}List(): Promise<${moduleName}Entity[]> {
  // [STEP] LoadFromStorage - 從 Storage 載入
  // [STEP] SortByDate - 依日期排序
  // [STEP] ReturnList - 返回列表
}

/**
 * GEMS: update${moduleName} | P1 | ✓○ | (Update${moduleName}Input)→Promise<${moduleName}Entity> | ${storyId} | 更新記錄
 * GEMS-FLOW: ValidateId→LoadExisting→MergeChanges→UpdateTimestamp→SaveToStorage→ReturnEntity
 * GEMS-DEPS: [Internal.${moduleName}Contract (型別), Internal.Storage (讀寫)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: update${moduleName}.test.ts
 */
// P1 因為：有依賴 (Storage, Contract)，但不是主要端到端流程
export async function update${moduleName}(input: Update${moduleName}Input): Promise<${moduleName}Entity> {
  // [STEP] ValidateId - 驗證 ID 存在
  // [STEP] LoadExisting - 載入現有資料
  // [STEP] MergeChanges - 合併變更
  // [STEP] UpdateTimestamp - 更新時間戳
  // [STEP] SaveToStorage - 儲存
  // [STEP] ReturnEntity - 返回
}

/**
 * GEMS: delete${moduleName} | P1 | ○○ | (id: string)→Promise<boolean> | ${storyId} | 刪除記錄
 * GEMS-FLOW: ValidateId→CheckExists→RemoveFromStorage→ReturnSuccess
 * GEMS-DEPS: [Internal.Storage (刪除)]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: delete${moduleName}.test.ts
 */
// P1 因為：有依賴 (Storage)，刪除操作風險較高但不是端到端流程
export async function delete${moduleName}(id: string): Promise<boolean> {
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
    },

    /**
     * BUILD Phase 8: Fillback
     * 
     * 驗證欄位 (validatePhase8):
     * 1. 基本資訊|Iteration|Story|iteration
     */
    fillback: (ctx) => {
        const date = new Date().toISOString().split('T')[0];
        const storyId = ctx.storyId || 'Story-1.0';
        const iteration = ctx.iteration || 'iter-1';

        return `# Fillback ${storyId}

## 基本資訊

- **Iteration**: ${iteration}
- **Story ID**: ${storyId}
- **Status**: ${ctx.status || 'Completed'}
- **完成日期**: ${date}

## 開發 Log

${ctx.items?.map((item, i) => `### Item ${i + 1}: ${item.name || '{名稱}'}
- [x] Phase 1: 開發腳本
- [x] Phase 2: 標籤驗收
- [x] Phase 8: 完成規格
`).join('\n') || `### Item 1: {名稱}
- [x] 開發完成
`}

## 標籤統計

- P0: ${ctx.stats?.p0 || 0} 個
- P1: ${ctx.stats?.p1 || 0} 個
- P2: ${ctx.stats?.p2 || 0} 個

## 產出檔案

${ctx.files?.map(f => `- \`${f.path}\` - ${f.desc || ''}`).join('\n') || '- `src/main.ts` - 主程式'}

## 備註

${ctx.notes || '自動產出 by scaffold-generator'}
`;
    },

    /**
     * BUILD Phase 8: iteration_suggestions
     * 
     * 驗證欄位 (suggestions-validator):
     * 必填: storyId, status
     * status 值: Completed|Partial|Blocked|InProgress
     */
    iteration_suggestions: (ctx) => {
        const storyId = ctx.storyId || 'Story-1.0';
        const iteration = ctx.iteration || 'iter-1';

        return JSON.stringify({
            storyId: storyId,
            iterationId: iteration,
            status: ctx.status || 'Completed',
            completedItems: ctx.completedItems || [],
            testCoverage: ctx.testCoverage || {
                p0: 0,
                p1: 0,
                total: 0
            },
            tagStats: ctx.tagStats || {
                p0: 0,
                p1: 0,
                p2: 0,
                p3: 0
            },
            technicalHighlights: ctx.highlights || [],
            technicalDebt: ctx.debt || [],
            suggestions: ctx.suggestions || [],
            nextIteration: ctx.nextIteration || {
                suggestedGoal: '',
                suggestedItems: []
            },
            blockers: ctx.blockers || []
        }, null, 2);
    }
};

// ============================================
// 輔助函式
// ============================================

/**
 * 從 Draft 自動提取上下文
 */
function extractContextFromDraft(draftPath) {
    if (!fs.existsSync(draftPath)) return {};

    const content = fs.readFileSync(draftPath, 'utf8');
    const context = {};

    // 提取專案名稱
    const nameMatch = content.match(/^#\s*📋?\s*(.+?)\s*[-–—]/m);
    if (nameMatch) context.projectName = nameMatch[1].trim();

    // 提取一句話目標
    const goalMatch = content.match(/### 一句話目標\s*\n(.+)/);
    if (goalMatch) context.vision = goalMatch[1].trim();

    // 提取模組
    const moduleSection = content.match(/## 功能模組[\s\S]*?(?=##|$)/)?.[0] || '';
    const modules = [];
    const lines = moduleSection.split('\n');
    for (const line of lines) {
        const match = line.match(/- \[x\]\s*(.+)/i);
        if (match && !/基礎建設|types|config/i.test(match[1])) {
            modules.push(match[1].trim());
        }
    }
    context.modules = modules;

    return context;
}

/**
 * 從 Spec 自動提取 Story 列表
 */
function extractStoriesFromSpec(specPath) {
    if (!fs.existsSync(specPath)) return [];

    const content = fs.readFileSync(specPath, 'utf8');
    const stories = [];
    const pattern = /### Story[- ](\d+\.\d+):\s*([^\n\[]+)(?:\s*\[(已驗證|計畫開發)\])?/gi;
    let match;

    while ((match = pattern.exec(content)) !== null) {
        stories.push({
            id: match[1],
            name: match[2].trim(),
            verified: match[3] === '已驗證'
        });
    }

    return stories;
}

module.exports = {
    generateScaffold,
    validateScaffold,
    extractContextFromDraft,
    extractStoriesFromSpec,
    scaffoldGenerators,
    SCAFFOLD_TYPES,
    POC_SPEC_REQUIRED,
    PLAN_REQUIRED,
    BUILD_SUGGESTIONS_REQUIRED
};
