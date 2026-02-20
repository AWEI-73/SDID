# Code Reviewer Skill

**角色**: 資深架構師  
**版本**: 1.0.0  
**狀態**: ✅ MVP 完成  

---

## 📁 檔案結構

```
task-pipe/skills/code-reviewer/
├── skill.json                  # Skill 配置檔
├── index.cjs                   # 核心引擎（主入口）
├── retry-tracker.cjs           # 重試追蹤器
├── integration-example.cjs     # Phase 整合範例
├── test.cjs                    # 測試腳本
├── README.md                   # 使用指南
├── SUMMARY.md                  # 完成總結
└── analyzers/                  # 未來擴充：分析器模組
    ├── architecture.cjs        # 架構分析器（待實作）
    ├── security.cjs            # 資安分析器（待實作）
    └── performance.cjs         # 效能分析器（待實作）
```

---

## 🎯 核心功能

### 1. 階段化錯誤分析
依照 GEMS Pipeline 的不同階段提供針對性的錯誤回饋：
- **POC 階段** (4 steps): 需求完整性、契約設計、UI 原型、規格驗證
- **PLAN 階段** (3 steps): 需求確認、規格注入、標籤設計
- **BUILD 階段** (7 phases): 開發、測試、標籤驗收、整合

### 2. 自動觸發機制
- 失敗 3 次後自動啟動 Code Review
- 產生結構化報告（JSON + Markdown）
- 提供立即修正建議和預防措施

### 3. RAG 就緒
結構化輸出包含：
- `errorTypes`: 錯誤分類
- `keywords`: 關鍵字提取
- `severity`: 嚴重程度評估

---

## 🚀 快速開始

### 測試

```bash
# 執行測試腳本
node task-pipe/skills/code-reviewer/test.cjs
```

### 使用

```javascript
const { SimpleCodeReviewer } = require('./skills/code-reviewer');

// 建立 Reviewer
const reviewer = new SimpleCodeReviewer('build', '4');

// 產生報告
const report = reviewer.generateReport({
  errors: [...],
  retryCount: 3
});

// 輸出 Markdown
console.log(reviewer.formatMarkdown(report));
```

### 整合到 Phase

```javascript
const { RetryTracker } = require('./skills/code-reviewer/retry-tracker.cjs');
const { generateReviewReport } = require('./skills/code-reviewer/integration-example.cjs');

if (!passed) {
  const tracker = new RetryTracker(target, iteration, story, 'phase-4');
  const retryState = tracker.increment(errors);
  
  if (retryState.shouldReview) {
    const report = generateReviewReport({ target, iteration, story, errors, context: retryState.context });
    return { verdict: 'NEEDS_REVIEW', report };
  }
}
```

---

## 📚 文件

- **README.md**: 完整使用指南
- **SUMMARY.md**: MVP 完成總結
- **skill.json**: Skill 配置

---

## 🔮 未來擴充

### 資安分析器 (Security Analyzer)
```javascript
const { SecurityAnalyzer } = require('./skills/code-reviewer/analyzers/security.cjs');

const analyzer = new SecurityAnalyzer();
const issues = analyzer.analyze(sourceFiles);
// 偵測: SQL Injection, XSS, 硬編碼密鑰等
```

### 效能分析器 (Performance Analyzer)
```javascript
const { PerformanceAnalyzer } = require('./skills/code-reviewer/analyzers/performance.cjs');

const analyzer = new PerformanceAnalyzer();
const issues = analyzer.analyze(sourceFiles);
// 偵測: N+1 查詢, 複雜度過高, 記憶體洩漏等
```

### LLM 深度分析
```javascript
const reviewer = new SimpleCodeReviewer('build', '4', {
  useLLM: true,
  llmModel: 'gemini-2.0-flash'
});
// 語意理解、架構建議、設計模式識別
```

---

## 🎓 設計理念

### 為什麼獨立成 Skill？

1. **模組化**: 與核心 lib 分離，職責清晰
2. **可擴充**: 易於新增其他 Skill（如 security-reviewer, performance-reviewer）
3. **可替換**: 可以切換不同的 Reviewer 實作
4. **可測試**: 獨立測試，不影響主流程

### 為什麼叫 Skill？

- **Skill** 代表一種專業能力（Code Review）
- 未來可以有多個 Skills：
  - `code-reviewer` (架構師視角)
  - `security-reviewer` (資安師視角)
  - `performance-optimizer` (效能專家視角)
  - `test-strategist` (測試專家視角)

---

## 📊 與其他模組的關係

```
task-pipe/
├── lib/                        # 核心工具庫
│   ├── gems-validator.cjs      # GEMS 標籤驗證
│   ├── checkpoint.cjs          # Checkpoint 管理
│   └── ...
├── skills/                     # 專業技能模組
│   ├── code-reviewer/          # Code Review Skill ✨
│   ├── security-reviewer/      # 未來：資安審查
│   └── performance-optimizer/  # 未來：效能優化
└── phases/                     # Pipeline 階段腳本
    ├── poc/
    ├── plan/
    └── build/
```

---

**維護者**: GEMS Team  
**最後更新**: 2026-01-08
