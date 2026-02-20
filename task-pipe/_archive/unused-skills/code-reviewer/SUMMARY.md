# Code Reviewer Skill - 階段化 Auto Fixer 總結

**完成日期**: 2026-01-10  
**版本**: 2.1.0 (全階段 Error Handler 整合)  

---

## ✅ 重大更新

### v2.1.0 - 全階段三次錯誤機制整合

**新增** (v2.1):
- ✅ POC 全部 5 個步驟整合 error-handler
- ✅ PLAN 全部 5 個步驟整合 error-handler
- ✅ 3 次失敗後觸發 `[TACTICAL_FIX_LIMIT]` 標記
- ✅ 建議啟動 Code Reviewer Skill 進行深度分析

### 從單一 Phase 4 → 支援所有階段

**之前** (v1.0):
```
只支援 BUILD Phase 4 的標籤修正
```

**現在** (v2.1):
```
全階段支援三次錯誤機制 + 自動修正
├─ POC 階段 (5 steps) ✅ 全部整合 error-handler
├─ PLAN 階段 (5 steps) ✅ 全部整合 error-handler
└─ BUILD 階段 (8 phases) ✅ Phase 3-7 已整合
```

---

## 📁 檔案結構

```
task-pipe/skills/code-reviewer/
├── fixers/                          # Fixer 模組目錄
│   ├── index.cjs                    # Factory (自動選擇 Fixer)
│   ├── base-fixer.cjs               # 基礎類別
│   ├── build-phase4-fixer.cjs       # BUILD Phase 4 ✅
│   ├── build-phase5-fixer.cjs       # BUILD Phase 5 ✅
│   ├── poc-step0-fixer.cjs          # POC Step 0 ✅
│   └── [future-fixers].cjs          # 未來擴充
├── index.cjs                        # Code Reviewer 核心
├── retry-tracker.cjs                # 重試追蹤器
├── gems-tag-knowledge.cjs           # GEMS 標籤知識庫
├── integration-example.cjs          # 通用整合範例
└── ...
```

---

## 🎯 三次錯誤機制整合狀態

| 階段 | 步驟 | Error Handler | 3次 Block 機制 |
|------|------|---------------|----------------|
| **POC** | Step 0 | ✅ 已整合 | ✅ 支援 |
| **POC** | Step 0.5 | ✅ 已整合 | ✅ 支援 |
| **POC** | Step 1 | ✅ 已整合 | ✅ 支援 |
| **POC** | Step 2 | ✅ 已整合 | ✅ 支援 |
| **POC** | Step 3 | ✅ 已整合 | ✅ 支援 |
| **PLAN** | Step 1 | ✅ 已整合 | ✅ 支援 |
| **PLAN** | Step 2 | ✅ 已整合 | ✅ 支援 |
| **PLAN** | Step 2.5 | ✅ 已整合 | ✅ 支援 |
| **PLAN** | Step 2.6 | ✅ 已整合 | ✅ 支援 |
| **PLAN** | Step 3 | ✅ 已整合 | ✅ 支援 |
| **BUILD** | Phase 3-7 | ✅ 已整合 | ✅ 支援 |

## 🔧 Fixer 實作狀態

| 階段 | 步驟 | Fixer 狀態 | 可自動修正 |
|------|------|-----------|-----------| 
| **POC** | Step 0 | ✅ 已實作 | 補充需求描述、勾選功能模組 |
| POC | Step 1 | 📋 待實作 | 補充契約標籤 |
| POC | Step 2 | 📋 待實作 | 補充 UI 標籤 |
| POC | Step 3 | 📋 待實作 | 補充 User Stories |
| **PLAN** | Step 1 | 📋 待實作 | 補充資料契約 |
| PLAN | Step 2 | 📋 待實作 | 補充 implementation_plan |
| PLAN | Step 2.6 | 📋 待實作 | 補充標籤模板 |
| **BUILD** | Phase 1 | 📋 待實作 | 建立源碼目錄 |
| BUILD | Phase 2 | 📋 待實作 | 建立骨架檔案 |
| BUILD | Phase 3 | 📋 待實作 | 建立測試案例 |
| **BUILD** | **Phase 4** | **✅ 已實作** | **補充 GEMS 標籤** |
| **BUILD** | **Phase 5** | **✅ 已實作** | **建立測試檔案** |
| BUILD | Phase 6 | 📋 待實作 | 修正整合測試 |
| BUILD | Phase 7 | 📋 待實作 | 補充 Fillback |

---

## 🚀 使用方式

### 通用處理函式

```javascript
const { handlePhaseFailure } = require('./skills/code-reviewer/integration-example.cjs');

// 在任何 Phase 腳本中使用
if (!passed) {
  const result = await handlePhaseFailure({
    phase: 'BUILD',      // POC, PLAN, BUILD
    step: '4',           // 步驟編號
    target: target,
    iteration: iteration,
    story: story,        // 可選
    errors: errors,
    autoFix: options.autoFix || false
  });
  
  return result;
}
```

### Factory 模式

```javascript
const { AutoFixerFactory } = require('./skills/code-reviewer/fixers');

// 自動選擇對應的 Fixer
const fixer = AutoFixerFactory.create('BUILD', '4', { target, dryRun: false });

if (fixer) {
  const fixPlan = fixer.generateFixPlan(reviewReport);
  const results = await fixer.applyFixes(fixPlan);
}

// 檢查是否支援
if (AutoFixerFactory.isSupported('BUILD', '4')) {
  // 支援自動修正
}
```

---

## 🔧 各階段 Fixer 能力

### BUILD Phase 4 Fixer (已實作)

**可自動修正**:
- ✅ 缺少 GEMS-DEPS → 插入模板
- ✅ 缺少 GEMS-FLOW → 插入模板
- ✅ 缺少 GEMS-DEPS-RISK → 插入 LOW
- ✅ 缺少 GEMS-TEST → 插入模板
- ✅ 缺少 GEMS-TEST-FILE → 插入模板

**無法自動修正**:
- ❌ [STEP] 錨點 → 需理解邏輯

### BUILD Phase 5 Fixer (已實作)

**可自動修正**:
- ✅ 測試檔案不存在 → 建立測試檔案模板

### POC Step 0 Fixer (已實作)

**可自動修正**:
- ✅ 缺使用者角色 → 勾選 checkbox
- ✅ 需求描述為空 → 填入提示文字

**無法自動修正**:
- ❌ 功能模組未勾選 → 需人工決定

---

## 💡 設計理念

### 1. 為什麼用 Factory 模式？

**答**: 統一介面，易於擴充
```javascript
// 不需要知道具體的 Fixer 類別
const fixer = AutoFixerFactory.create(phase, step, options);

// 未來新增 Fixer 只需：
// 1. 繼承 BaseAutoFixer
// 2. 在 Factory 中註冊
```

### 2. 為什麼用繼承？

**答**: 共用基礎功能
```javascript
class BaseAutoFixer {
  // 所有 Fixer 共用的功能
  generateFixReport()
  estimateTime()
  readFile()
  writeFile()
}

class BuildPhase4Fixer extends BaseAutoFixer {
  // 只需實作特定邏輯
  generateFixPlan()
  applyFixes()
}
```

### 3. 修正後如何通知繼續？

**答**: 返回 verdict 狀態
```javascript
if (verdict === 'AUTO_FIXED') {
  // 自動修正成功，重新執行該階段
  console.log(`重新執行: node task-pipe/runner.cjs --phase=${phase} --step=${step}`);
}

if (verdict === 'NEEDS_REVIEW') {
  // 需要人工修正
  console.log(`請查看報告並修正問題`);
}
```

---

## 📊 擴充路徑

### 短期（本週）

1. ✅ BUILD Phase 4 Fixer
2. ✅ BUILD Phase 5 Fixer
3. ✅ POC Step 0 Fixer
4. ⭕ PLAN Step 2.6 Fixer（補充標籤模板）

### 中期（下週）

5. ⭕ POC Step 1 Fixer（補充契約標籤）
6. ⭕ POC Step 3 Fixer（補充 User Stories）
7. ⭕ BUILD Phase 2 Fixer（建立骨架檔案）

### 長期（下次迭代）

8. ⭕ 使用 LLM 智能推測修正內容
9. ⭕ 學習歷史修正案例
10. ⭕ RAG 優化修正建議

---

## 🎓 最佳實踐

### 建立新 Fixer 的步驟

1. **繼承 BaseAutoFixer**
```javascript
const { BaseAutoFixer } = require('./base-fixer.cjs');

class MyFixer extends BaseAutoFixer {
  constructor(options) {
    super({ ...options, phase: 'PLAN', step: '2' });
  }
}
```

2. **實作 generateFixPlan()**
```javascript
generateFixPlan(reviewReport) {
  const fixes = [];
  // 分析錯誤，建立修正計畫
  return { totalFixes, fixes, estimatedTime, canAutoFix };
}
```

3. **實作 applyFixes()**
```javascript
async applyFixes(fixPlan) {
  const results = [];
  for (const fix of fixPlan.fixes) {
    // 執行修正
  }
  return { total, success, failed, skipped, results };
}
```

4. **在 Factory 中註冊**
```javascript
// fixers/index.cjs
const fixerMap = {
  'plan-2': MyFixer  // 新增這行
};
```

---

## ✨ 總結

Code Reviewer Skill v2.0 現在具備：

✅ **階段化 Auto Fixer** (支援 POC, PLAN, BUILD)  
✅ **Factory 模式** (自動選擇對應 Fixer)  
✅ **繼承架構** (易於擴充新 Fixer)  
✅ **通用整合介面** (handlePhaseFailure)  
✅ **修正後自動繼續** (AUTO_FIXED verdict)  
✅ **3 個已實作 Fixer** (Phase 4, Phase 5, POC Step 0)  

**下一步**: 根據實際使用情況，逐步實作其他階段的 Fixer。

---

**完成者**: AI Assistant  
**審查者**: User  
**狀態**: ✅ v2.0 完成，支援階段化 Auto Fixer
