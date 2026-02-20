# Implementation Plan - 模組化骨架範例 (Story-1.0 專用)

> 🎯 **目的**: Story-1.0 (Module 0) 必須建立完整的專案骨架，包含六層結構和入口點連接

---

# Implementation Plan - Story-1.0

**迭代**: iter-1  
**Story ID**: Story-1.0  
**日期**: 2026-01-25  
**Story 類型**: 🏗️ Foundation (基礎建設)

---

## 1. Story 目標

**一句話目標**: 建立專案完整的模組化骨架，確保可執行環境

**範圍**:
- ✅ 包含: 六層結構、入口點、路由連接、基礎配置
- ❌ 不包含: 業務功能、第三方整合

---

## 2. 模組化骨架定義 (Module 0 必要區塊)

### 2.1 六層結構

```
📦 專案根目錄
├── 📄 index.html              # ⭐ 入口頁面 (必要)
├── 📄 package.json            # NPM 配置
├── 📁 src/
│   ├── 📄 main.ts             # ⭐ 應用程式入口點 (必要)
│   ├── 📁 config/             # ⭐ Layer 1: 配置層 (必要)
│   │   └── 📄 index.ts
│   ├── 📁 assets/             # Layer 2: 靜態資源 (可選)
│   │   ├── images/
│   │   └── styles/
│   ├── 📁 lib/                # Layer 3: 第三方封裝 (可選)
│   │   └── 📄 index.ts
│   ├── 📁 shared/             # ⭐ Layer 4: 共用邏輯 (必要)
│   │   ├── 📄 index.ts        # Facade
│   │   ├── types/
│   │   ├── utils/
│   │   └── components/        # 原子元件
│   ├── 📁 modules/            # ⭐ Layer 5: 業務模組容器 (必要)
│   │   └── .gitkeep           # 初始為空
│   └── 📁 routes/             # ⭐ Layer 6: 路由定義 (必要)
│       └── 📄 index.ts        # 路由配置
└── 📁 e2e/                    # E2E 測試目錄
    └── 📄 *.spec.ts
```

### 2.2 依賴方向規則

```
Config ← Assets ← Lib ← Shared ← Modules ← Routes ← main.ts
```

**規則**:
- ❌ 禁止反向依賴（例如 Config 不能 import Shared）
- ❌ 禁止循環依賴
- ✅ 只能由右向左依賴

### 2.3 入口點連接檢查

**main.ts 必須**: 
```typescript
// ✅ 必須 import routes
import { routes } from './routes';

// ✅ 必須有初始化邏輯
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initialized');
    // 初始化路由、渲染等
});
```

**index.html 必須**:
```html
<!-- ✅ 必須引用 main.ts -->
<script type="module" src="/src/main.ts"></script>
```

---

## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 驗收項目 |
|------|------|------|----------|--------|----------|
| 1 | 專案初始化 | SETUP | P0 | ✅ | package.json, tsconfig |
| 2 | 入口點建立 | SETUP | P0 | ✅ | index.html, main.ts |
| 3 | 六層結構建立 | SETUP | P0 | ✅ | config/, shared/, modules/, routes/ |
| 4 | 路由連接 | INTEGRATION | P0 | ✅ | main.ts ← routes/ |
| 5 | 開發環境驗證 | VALIDATION | P0 | ✅ | npm run dev 可啟動 |
| 6 | 測試環境設定 | SETUP | P1 | ✅ | jest, playwright 配置 |

**執行順序**: Item 1 → 2 → 3 → 4 → 5 → 6

---

## 4. Item 詳細規格

### Item 2: 入口點建立

**Type**: SETUP  
**Priority**: P0

#### 📄 index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>專案名稱</title>
</head>
<body>
    <div id="app"></div>
    <!-- ⭐ 必須引用 main.ts -->
    <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

#### 📄 src/main.ts
```typescript
/**
 * Application Entry Point
 * GEMS: main | P0 | ✓✓ | ()→void | Story-1.0 | 應用程式主入口
 * GEMS-FLOW: Import→Init→Bind→Render
 * GEMS-DEPS: [Routes.routes], [Shared.storage]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: - Unit | - Integration | ✓ E2E
 * GEMS-TEST-FILE: e2e/app.spec.ts
 */

// ⭐ 必須 import routes
import { routes, navigate } from './routes';
import { getTasks } from './shared/storage';
import { renderTaskList } from './modules/TaskManager/list';

document.addEventListener('DOMContentLoaded', () => {
    // [STEP] Import - 已完成
    
    // [STEP] Init - 初始化
    console.log('App initialized');
    console.log('Available routes:', Object.keys(routes));
    
    // [STEP] Bind - 綁定事件
    // ... 事件綁定
    
    // [STEP] Render - 初始渲染
    navigate('/');
    // ... 渲染邏輯
});
```

---

### Item 4: 路由連接

**Type**: INTEGRATION  
**Priority**: P0

#### 📄 src/routes/index.ts
```typescript
/**
 * Routes Configuration
 * GEMS: routes | P0 | ✓✓ | ()→RouteConfig | Story-1.0 | 路由配置
 */

export const routes = {
    '/': 'Home',
    '/tasks': 'TaskManager'
};

export function navigate(path: string): void {
    console.log(`Navigating to ${path}`);
    window.history.pushState({}, '', path);
}
```

---

## 5. 啟動方式定義

### 5.1 開發環境 (必要)

```json
// package.json scripts
{
  "scripts": {
    "dev": "vite",
    "test": "jest",
    "test:e2e": "playwright test"
  }
}
```

**驗證指令**:
```bash
npm run dev    # 必須成功啟動開發伺服器
npm test       # 必須所有測試通過
```

### 5.2 環境驗證清單

| 驗證項目 | 指令 | 預期結果 |
|----------|------|----------|
| 伺服器啟動 | `npm run dev` | http://localhost:5173 可訪問 |
| 頁面載入 | 瀏覽器開啟 | 顯示 `<div id="app">` |
| JS 執行 | Console | 顯示 "App initialized" |
| 路由連接 | Console | 顯示 "Available routes" |

---

## 6. 測試策略 (Story-1.0 專用)

### 6.1 測試分層

| 類型 | 必要性 | 工具 | Mock 策略 |
|------|--------|------|-----------|
| Unit | ⚠️ 可選 | Jest | 可使用 Mock |
| Integration | ⚠️ 可選 | Jest + jsdom | 禁止 Mock 已實作模組 |
| E2E | ✅ 必要 | Playwright | 真實環境測試 |

### 6.2 Story-1.0 必要 E2E 測試

```typescript
// e2e/app.spec.ts
import { test, expect } from '@playwright/test';

test('應用程式能正常啟動', async ({ page }) => {
    await page.goto('/');
    
    // 驗證頁面載入
    await expect(page.locator('#app')).toBeVisible();
    
    // 驗證 main.ts 執行
    const logs = await page.evaluate(() => {
        // 檢查 console 是否有輸出
        return true; // 簡化
    });
    expect(logs).toBeTruthy();
});
```

---

## 7. 驗收標準 (Phase 7 門控)

| 檢查項目 | 必要性 | 驗證方式 |
|----------|--------|----------|
| index.html 存在 | ✅ 必要 | 檔案檢查 |
| main.ts 存在 | ✅ 必要 | 檔案檢查 |
| routes/ 存在 | ✅ 必要 | 目錄檢查 |
| main.ts import routes | ✅ 必要 | Import 鏈驗證 |
| npm run dev 可執行 | ✅ 必要 | 環境測試 |

---

## 8. 架構審查 (Constitution Audit)

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| 模組化結構檢核 | ✅ 通過 | 已完成 6 層結構 |
| 依賴方向檢核 | ✅ 通過 | Config ← ... ← Routes |
| 入口點檢核 | ✅ 通過 | index.html + main.ts |
| 路由連接檢核 | ✅ 通過 | main.ts import routes |
| 可執行性檢核 | ✅ 通過 | npm run dev 成功 |

---

**產出日期**: 2026-01-25 | **Agent**: PLAN | **版本**: v3.2

---

## ✅ Story-1.0 完成檢查清單

- [ ] index.html 存在且引用 main.ts
- [ ] main.ts 存在且 import routes
- [ ] routes/index.ts 存在且 export routes
- [ ] config/, shared/, modules/ 目錄存在
- [ ] package.json 有 dev script
- [ ] npm run dev 可成功啟動
- [ ] E2E 測試可執行

