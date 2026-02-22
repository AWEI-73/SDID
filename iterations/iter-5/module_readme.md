# [Module Name] 模組

**模組 ID**: `[module-id]`  
**版本**: v1.0  
**更新**: 2025-12-10

---

## 概述

[一句話描述這個模組的職責]

---

## 公開 API

```typescript
// 從 index.ts 匯出
export { functionA } from './services/[name].service';
export { ComponentA } from './components/[Name]';
export type { TypeA } from './types';
```

---

## 檔案結構

```
modules/[module-id]/
├── index.ts              # 唯一公開入口
├── [module].routes.ts    # 路由定義
├── [module].schema.ts    # 資料結構
├── [module].service.ts   # 業務邏輯
├── components/           # UI 元件 (如適用)
└── __tests__/            # 測試
```

---

## 依賴關係

| 依賴 | 類型 | 說明 |
|------|------|------|
| `shared/utils` | shared | 工具函數 |
| `[other-module]` | cross-module | [說明] |

---

## 使用範例

```typescript
import { functionA } from '@/modules/[module-id]';

const result = await functionA(params);
```

---

## 相關文件

- Story: Story-[X.X]
- 驗收標準: AC-5

---

**維護者**: [團隊/個人] | **產出日期**: 2025-12-10
