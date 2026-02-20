# Task-Pipe Skills 目錄

此目錄存放各種專業技能模組（Skills），用於增強 GEMS Pipeline 的能力。

---

## 📋 現有 Skills

### 1. Code Reviewer (架構師視角)
**路徑**: `code-reviewer/`  
**角色**: 資深架構師  
**狀態**: ✅ MVP 完成  
**版本**: 1.0.0  

**功能**:
- 階段化錯誤分析（14 個 Pipeline 階段）
- 自動觸發機制（失敗 3 次）
- 結構化報告（JSON + Markdown）
- RAG 就緒（errorTypes, keywords, severity）

**使用**:
```javascript
const { SimpleCodeReviewer } = require('./skills/code-reviewer');
const reviewer = new SimpleCodeReviewer('build', '4');
```

**文件**: [code-reviewer/SKILL.md](./code-reviewer/SKILL.md)

---

## 🔮 規劃中的 Skills

### 2. Security Reviewer (資安師視角)
**路徑**: `security-reviewer/` (待建立)  
**角色**: 資安專家  
**狀態**: 📋 規劃中  

**功能**:
- OWASP Top 10 檢查
- SQL Injection / XSS 偵測
- 硬編碼密鑰掃描
- 依賴漏洞分析

### 3. Performance Optimizer (效能專家視角)
**路徑**: `performance-optimizer/` (待建立)  
**角色**: 效能專家  
**狀態**: 📋 規劃中  

**功能**:
- N+1 查詢偵測
- 演算法複雜度分析
- 記憶體洩漏風險
- Bundle Size 優化建議

### 4. Test Strategist (測試專家視角)
**路徑**: `test-strategist/` (待建立)  
**角色**: 測試專家  
**狀態**: 📋 規劃中  

**功能**:
- 測試覆蓋率分析
- Edge Case 覆蓋檢查
- 測試案例品質評估
- Mock/Stub 使用建議

---

## 🎯 Skill 設計原則

### 1. 模組化
每個 Skill 是獨立的模組，有自己的：
- 配置檔 (`skill.json`)
- 核心引擎 (`index.cjs`)
- 測試腳本 (`test.cjs`)
- 文件 (`SKILL.md`, `README.md`)

### 2. 統一介面
所有 Skill 應實作統一的介面：
```javascript
class BaseSkill {
  constructor(phase, step, options) { ... }
  generateReport(context) { ... }
  formatMarkdown(report) { ... }
}
```

### 3. 可組合
多個 Skills 可以組合使用：
```javascript
const skills = [
  new CodeReviewer('build', '4'),
  new SecurityReviewer('build', '4'),
  new PerformanceOptimizer('build', '4')
];

const reports = skills.map(skill => skill.generateReport(context));
```

### 4. RAG 就緒
所有 Skill 的報告都應包含結構化資料，支援未來的 RAG 優化：
```json
{
  "metadata": { ... },
  "analysis": { ... },
  "recommendations": { ... },
  "ragData": {
    "errorTypes": [...],
    "keywords": [...],
    "severity": "..."
  }
}
```

---

## 📂 目錄結構

```
task-pipe/skills/
├── README.md                   # 本文件
├── code-reviewer/              # Code Reviewer Skill ✅
│   ├── skill.json
│   ├── index.cjs
│   ├── retry-tracker.cjs
│   ├── integration-example.cjs
│   ├── test.cjs
│   ├── SKILL.md
│   ├── README.md
│   ├── SUMMARY.md
│   └── analyzers/
│       └── README.md
├── security-reviewer/          # 未來：資安審查 📋
├── performance-optimizer/      # 未來：效能優化 📋
└── test-strategist/            # 未來：測試策略 📋
```

---

## 🚀 快速開始

### 測試現有 Skill

```bash
# 測試 Code Reviewer
node task-pipe/skills/code-reviewer/test.cjs
```

### 建立新 Skill

1. 建立目錄：`mkdir task-pipe/skills/my-skill`
2. 複製模板：`cp -r code-reviewer/* my-skill/`
3. 修改 `skill.json` 和核心邏輯
4. 實作分析邏輯
5. 撰寫測試和文件

---

## 🔗 與 Pipeline 的整合

Skills 可以在 Pipeline 的任何階段被觸發：

```javascript
// 在 phase-4.cjs 中
const { RetryTracker } = require('../../skills/code-reviewer/retry-tracker.cjs');
const { SimpleCodeReviewer } = require('../../skills/code-reviewer');

if (!passed) {
  const tracker = new RetryTracker(target, iteration, story, 'phase-4');
  const retryState = tracker.increment(errors);
  
  if (retryState.shouldReview) {
    const reviewer = new SimpleCodeReviewer('build', '4');
    const report = reviewer.generateReport({
      errors: errors,
      retryCount: retryState.context.retries
    });
    
    // 產出報告
    const reportPath = `${target}/.gems/iterations/${iteration}/build/code_review_${story}.md`;
    fs.writeFileSync(reportPath, reviewer.formatMarkdown(report));
    
    return { verdict: 'NEEDS_REVIEW', report };
  }
}
```

---

## 📊 Skill 生命週期

```
觸發條件滿足
    ↓
載入 Skill
    ↓
執行分析
    ↓
產生報告 (JSON + Markdown)
    ↓
儲存報告
    ↓
回傳結果給 Pipeline
```

---

**維護者**: GEMS Team  
**最後更新**: 2026-01-08
