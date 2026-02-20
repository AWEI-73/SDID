# Simple Code Reviewer - MVP 使用指南

## 📋 概述

Simple Code Reviewer 是一個輕量級的錯誤分析工具，依照 GEMS Pipeline 的不同階段提供針對性的錯誤回饋。

### 核心特性

✅ **階段化錯誤分類**: 每個 Phase 有專屬的錯誤模式定義  
✅ **結構化報告**: 產出 JSON 格式，支援未來 RAG 優化  
✅ **自動觸發**: 失敗 3 次後自動啟動  
✅ **輕量設計**: 無需 LSP，僅依賴基本 Node.js  

---

## 🚀 快速開始

### 1. 基本使用

```javascript
const { SimpleCodeReviewer } = require('./lib/simple-code-reviewer.cjs');

// 建立 Reviewer（指定階段）
const reviewer = new SimpleCodeReviewer('build', '4');

// 產生報告
const report = reviewer.generateReport({
  errors: [
    { message: '缺少 GEMS-DEPS 標籤', location: 'src/utils/storage.js:45' },
    { message: 'P0 函式缺少 GEMS-FLOW', location: 'src/config.js:12' }
  ],
  retryCount: 3,
  timestamp: new Date().toISOString()
});

// 輸出 Markdown
const markdown = reviewer.formatMarkdown(report);
console.log(markdown);
```

### 2. 整合到 Phase

```javascript
// 在 phase-4.cjs 中
const { RetryTracker } = require('../../lib/retry-tracker.cjs');
const { generateReviewReport, displayReviewSummary } = require('../../lib/phase-4-review-integration.cjs');

function run(options) {
  // ... 原有邏輯 ...
  
  if (!passed) {
    // 追蹤失敗次數
    const tracker = new RetryTracker(target, iteration, story, 'phase-4');
    const retryState = tracker.increment(complianceIssues);
    
    // 3 次失敗 → 產生 Code Review
    if (retryState.shouldReview) {
      const report = generateReviewReport({
        target,
        iteration,
        story,
        errors: complianceIssues,
        context: retryState.context
      });
      
      displayReviewSummary(report);
      
      return { verdict: 'NEEDS_REVIEW', report };
    }
    
    return { verdict: 'PENDING' };
  }
  
  // 通過時重置計數器
  tracker.reset();
  return { verdict: 'PASS' };
}
```

---

## 📊 報告格式

### JSON 結構（用於 RAG）

```json
{
  "metadata": {
    "phase": "BUILD Phase 4 - 標籤驗收",
    "phaseKey": "build-4",
    "timestamp": "2026-01-08T11:30:00.000Z",
    "retryCount": 3
  },
  "analysis": {
    "detectedErrors": [
      {
        "type": "TAG_ERROR",
        "message": "缺少 GEMS-DEPS 標籤",
        "location": "src/utils/storage.js:45",
        "severity": "medium"
      }
    ],
    "commonPatterns": [
      {
        "pattern": "P0/P1 缺少擴展標籤",
        "confidence": "high"
      }
    ],
    "reviewFocus": ["標籤合規性", "標籤與程式碼一致性"]
  },
  "recommendations": {
    "immediate": [
      {
        "action": "補充 GEMS 標籤",
        "target": "src/utils/storage.js:45",
        "priority": "high"
      }
    ],
    "preventive": [
      "補充缺失的 GEMS 標籤",
      "確保標籤在函式定義正上方（< 2000 字元）"
    ],
    "references": ["gems-scanner.cjs", "GEMS 標籤規範"]
  },
  "ragData": {
    "errorTypes": ["TAG_ERROR", "MISSING_CONTENT"],
    "keywords": ["GEMS", "標籤", "P0", "函式"],
    "severity": "CRITICAL"
  }
}
```

### Markdown 報告

```markdown
# Code Review Report

**階段**: BUILD Phase 4 - 標籤驗收
**時間**: 2026-01-08T11:30:00.000Z
**失敗次數**: 3
**嚴重程度**: CRITICAL

---

## 🔍 錯誤分析

### 常見錯誤模式
- P0/P1 缺少擴展標籤 (信心度: high)

### 偵測到的錯誤
1. **TAG_ERROR**: 缺少 GEMS-DEPS 標籤
   - 位置: `src/utils/storage.js:45`

## 💡 建議行動

### 立即修正
1. 補充 GEMS 標籤 - `src/utils/storage.js:45` (優先級: high)

### 預防措施
1. 補充缺失的 GEMS 標籤
2. 確保標籤在函式定義正上方（< 2000 字元）

## 📚 參考資料
- gems-scanner.cjs
- GEMS 標籤規範

---

**審查重點**: 標籤合規性, 標籤與程式碼一致性
```

---

## 🎯 支援的階段

| Phase Key | 階段名稱 | 常見錯誤 |
|-----------|---------|---------|
| `poc-1` | POC Step 1 - 模糊消除 | 需求不明確、功能模組未勾選 |
| `poc-2` | POC Step 2 - 規模評估 | 規模評估不準確、Story 數量超出限制 |
| `poc-3` | POC Step 3 - 契約設計 | 缺少 GEMS-CONTRACT 標籤 |
| `poc-4` | POC Step 4 - UI 原型 | 缺少 GEMS-VERIFIED |
| `poc-5` | POC Step 5 - 需求規格 | 缺用戶故事、缺驗收標準 |
| `plan-1` | PLAN Step 1 - 需求確認 | 缺資料契約 |
| `plan-2` | PLAN Step 2 - 規格注入 | implementation_plan 格式錯誤 |
| `plan-3` | PLAN Step 3 - 架構審查 | 架構設計不合理 |
| `plan-4` | PLAN Step 4 - 標籤規格設計 | GEMS 標籤覆蓋率不足 |
| `plan-5` | PLAN Step 5 - 需求規格說明 | 規格說明不完整 |
| `build-1` | BUILD Phase 1 - 開發腳本 | 源碼目錄不存在 |
| `build-2` | BUILD Phase 2 - 骨架檢查 | 缺少必要檔案 |
| `build-3` | BUILD Phase 3 - 測試執行 | 測試失敗 |
| `build-4` | BUILD Phase 4 - 標籤驗收 | GEMS 標籤覆蓋率 < 80% |
| `build-5` | BUILD Phase 5 - 測試檔案驗證 | 測試檔案不存在 |
| `build-6` | BUILD Phase 6 - 整合測試 | 整合測試失敗 |
| `build-7` | BUILD Phase 7 - Fillback | Fillback 格式錯誤 |

---

## 🔮 未來擴充（RAG 優化）

### 階段 1: 資料收集
```javascript
// 收集所有 Code Review 報告
const reports = fs.readdirSync('.gems/iterations/*/build')
  .filter(f => f.startsWith('code_review_'))
  .map(f => JSON.parse(fs.readFileSync(f)));

// 建立錯誤模式資料庫
const errorPatterns = reports.map(r => ({
  phase: r.metadata.phaseKey,
  errors: r.ragData.errorTypes,
  keywords: r.ragData.keywords,
  resolution: r.recommendations
}));
```

### 階段 2: 向量化
```javascript
// 使用 Embedding API 將錯誤描述向量化
const embeddings = await Promise.all(
  errorPatterns.map(p => 
    embedText(p.errors.join(' ') + ' ' + p.keywords.join(' '))
  )
);

// 儲存到向量資料庫（如 ChromaDB）
await vectorDB.upsert({
  ids: errorPatterns.map((_, i) => `error-${i}`),
  embeddings: embeddings,
  metadatas: errorPatterns
});
```

### 階段 3: 智能檢索
```javascript
// 當新錯誤發生時，檢索相似案例
const newError = "缺少 GEMS-DEPS 標籤";
const similar = await vectorDB.query({
  queryEmbeddings: [await embedText(newError)],
  nResults: 3
});

// 提供歷史解決方案
console.log('相似案例的解決方案:');
similar.metadatas.forEach(m => {
  console.log(`- ${m.resolution.immediate[0].action}`);
});
```

---

## 🛠️ 測試

```bash
# 測試 Simple Code Reviewer
node -e "
const { SimpleCodeReviewer } = require('./task-pipe/lib/simple-code-reviewer.cjs');
const reviewer = new SimpleCodeReviewer('build', '4');
const report = reviewer.generateReport({
  errors: [
    { message: '缺少 GEMS-DEPS', location: 'test.js:10' }
  ],
  retryCount: 3
});
console.log(reviewer.formatMarkdown(report));
"
```

---

## 📝 擴充新階段

```javascript
// 在 simple-code-reviewer.cjs 的 PHASE_PROFILES 中新增
const PHASE_PROFILES = {
  // ... 現有階段 ...
  
  'build-8': {
    name: 'BUILD Phase 8 - 效能測試',
    commonErrors: [
      '效能測試失敗',
      '回應時間過長',
      '記憶體洩漏'
    ],
    reviewFocus: ['效能指標', '資源使用'],
    suggestedActions: [
      '檢查 N+1 查詢問題',
      '優化演算法複雜度',
      '加入快取機制'
    ]
  }
};
```

---

**版本**: MVP 1.0  
**更新日期**: 2026-01-08  
**維護者**: GEMS Team
