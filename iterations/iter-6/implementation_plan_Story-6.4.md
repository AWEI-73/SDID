# Implementation Plan - Story-6.4

**迭代**: iter-6  
**Story ID**: Story-6.4  
**日期**: 2025-12-13  
**目標模組**: flow-tools

> 📋 **放置位置**: `.gems/iterations/iter-6/implementation_plan_Story-6.4.md`

---

## 1. Story 目標

**一句話目標**: 建立 SCAN 備份工具和備份管理 UI

**範圍**:
- ✅ 包含: backup-iteration.cjs 工具、備份管理 UI、API endpoint
- ❌ 不包含: GEMS Scanner（已存在）

---

## 2. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | backup-iteration.cjs 工具 | FEATURE | P1 | ✅ 明確 | 3-4h |
| 2 | 備份 API endpoint | FEATURE | P1 | ✅ 明確 | 2-3h |
| 3 | 備份管理 UI | FEATURE | P1 | ✅ 明確 | 3-4h |

**執行順序**: Item 1 → Item 2 → Item 3

---

## 4. Item 詳細規格

### Item 1: backup-iteration.cjs 工具

**Type**: FEATURE  
**Priority**: P1  
**明確度**: ✅ 明確

**功能描述**: 建立迭代備份工具

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `control-tower/tools/backup-iteration.cjs` | New | 備份工具 |

**核心函式**:
1. `backupIteration(projectPath, iteration)` - 備份迭代
2. `listBackups(projectPath)` - 列出備份
3. `deleteBackup(backupPath)` - 刪除備份

**備份內容**:
- `src/` 目錄
- `docs/` 目錄
- `.gems/iterations/iter-X/` 目錄

**備份位置**:
- `.gems/backups/iter-X/[timestamp]/`

**驗收標準**:
- AC-6.4.1: 可備份指定迭代
- AC-6.4.2: 備份儲存到 `.gems/backups/`
- AC-6.4.3: 可列出所有備份
- AC-6.4.4: 可刪除指定備份
- AC-6.4.5: 回傳備份資訊（路徑、大小、時間戳）

---

### Item 2: 備份 API endpoint

**Type**: FEATURE  
**Priority**: P1  
**明確度**: ✅ 明確

**功能描述**: 建立備份相關 API

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `control-tower/src/modules/dashboard/api/backupRoutes.ts` | New | 備份 API 路由 |
| `control-tower/src/modules/dashboard/services/backupService.ts` | New | 備份服務邏輯 |

**API 設計**:
```typescript
// 備份迭代
POST /api/scan/backup
{
  "projectPath": "/path/to/project",
  "iteration": 6
}

// 列出備份
GET /api/backups?projectPath=/path/to/project

// 刪除備份
DELETE /api/backups/:id
```

**驗收標準**:
- AC-6.4.6: POST /api/scan/backup 可正常呼叫
- AC-6.4.7: GET /api/backups 回傳備份列表
- AC-6.4.8: DELETE /api/backups/:id 可刪除備份

---

### Item 3: 備份管理 UI

**Type**: FEATURE  
**Priority**: P1  
**明確度**: ✅ 明確

**功能描述**: 建立備份管理區塊

**檔案清單**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| `control-tower/public/index.html` | Modify | 加入備份管理區塊 |
| `control-tower/public/app.js` | Modify | 備份管理邏輯 |
| `control-tower/public/styles.css` | Modify | 備份管理樣式 |

**核心函式**:
1. `handleScanBackup()` - 執行備份
2. `loadBackupList()` - 載入備份列表
3. `deleteBackup(id)` - 刪除備份

**UI 功能**:
- 顯示備份總覽（數量、總大小）
- 列表顯示所有備份
- 可查看備份內容
- 可刪除備份
- 不自動清理

**驗收標準**:
- AC-6.4.9: 顯示備份總覽
- AC-6.4.10: 列表顯示所有備份
- AC-6.4.11: 可查看備份內容
- AC-6.4.12: 可刪除備份
- AC-6.4.13: 點擊「Backup」執行備份

---

## 5. 規格注入

### 5.1 資料契約 (@GEMS-CONTRACT)

```typescript
// @GEMS-STORY: Story-6.4
// @GEMS-CONTRACT: BackupResult
interface BackupResult {
  success: boolean;
  backupPath: string;
  size: number;
  timestamp: string;
}

// @GEMS-CONTRACT: BackupItem
interface BackupItem {
  id: string;
  iterationNumber: number;
  timestamp: string;
  size: number;
  path: string;
  contents: string[];
}

// @GEMS-CONTRACT: BackupSummary
interface BackupSummary {
  count: number;
  totalSize: number;
  items: BackupItem[];
}
```

---

## 6. 檔案結構定義

```json
{
  "fileStructure": {
    "modules": [
      {
        "id": "dashboard",
        "path": "control-tower/src/modules/dashboard",
        "isNew": false,
        "files": [
          {
            "name": "api/backupRoutes.ts",
            "type": "route"
          },
          {
            "name": "services/backupService.ts",
            "type": "service",
            "functions": [
              {
                "name": "backupIteration",
                "priority": "P1",
                "testTypes": ["Unit"]
              },
              {
                "name": "listBackups",
                "priority": "P1",
                "testTypes": ["Unit"]
              },
              {
                "name": "deleteBackup",
                "priority": "P1",
                "testTypes": ["Unit"]
              }
            ]
          }
        ],
        "tests": [
          {
            "name": "services/__tests__/backupService.test.ts",
            "covers": ["backupIteration", "listBackups", "deleteBackup"]
          }
        ]
      }
    ]
  }
}
```

---

## 7. 依賴關係

| 依賴 | 類型 | 說明 |
|------|------|------|
| backup-iteration.cjs | internal | 備份工具 |
| fs-extra | lib | 檔案操作 |
| Express | lib | API 框架 |

---

## 8. 架構審查 (Constitution Audit)

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| **複雜度檢核** | ✅ 通過 | 使用 fs-extra，無其他新依賴 |
| **封裝檢核** | ✅ 通過 | Service 層封裝適當 |
| **P0 函式檢核** | ✅ 通過 | 3 個核心函式 |

---

## 9. 風險評估

| Risk | Impact | Mitigation |
|------|--------|------------|
| 備份占用空間 | Low | 手動管理，不自動清理 |
| 備份失敗 | Medium | 錯誤處理 + rollback |
| 權限不足 | Medium | 權限檢查 + 錯誤訊息 |

---

**產出日期**: 2025-12-13 | **Agent**: PLAN
