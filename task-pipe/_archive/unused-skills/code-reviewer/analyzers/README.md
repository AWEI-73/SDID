# Analyzers 目錄

此目錄用於存放各種專業分析器模組。

## 📋 規劃中的分析器

### 1. Architecture Analyzer (架構分析器)
**檔案**: `architecture.cjs`  
**功能**:
- 函式複雜度分析（Cyclomatic Complexity）
- 循環依賴偵測
- 模組耦合度分析
- GEMS 標籤與實作一致性檢查

### 2. Security Analyzer (資安分析器)
**檔案**: `security.cjs`  
**功能**:
- SQL Injection 風險偵測
- XSS 風險掃描
- 硬編碼密鑰檢查
- 不安全的隨機數使用
- OWASP Top 10 檢查

### 3. Performance Analyzer (效能分析器)
**檔案**: `performance.cjs`  
**功能**:
- N+1 查詢問題偵測
- 演算法複雜度分析
- 記憶體洩漏風險
- 不必要的重複計算

### 4. Test Strategy Analyzer (測試策略分析器)
**檔案**: `test-strategy.cjs`  
**功能**:
- 測試覆蓋率分析
- 測試案例品質評估
- Edge Case 覆蓋檢查
- Mock/Stub 使用合理性

---

## 🔌 分析器介面

所有分析器應實作統一的介面：

```javascript
class BaseAnalyzer {
  /**
   * 分析源碼檔案
   * @param {Object} context - 分析上下文
   * @returns {Object} 分析結果
   */
  analyze(context) {
    return {
      analyzer: 'AnalyzerName',
      issues: [
        {
          severity: 'CRITICAL|HIGH|MEDIUM|LOW',
          type: 'ERROR_TYPE',
          message: '問題描述',
          location: '檔案:行號',
          suggestion: '修正建議'
        }
      ],
      metrics: {
        // 分析指標
      }
    };
  }
}
```

---

## 📝 使用範例

```javascript
const { ArchitectureAnalyzer } = require('./analyzers/architecture.cjs');
const { SecurityAnalyzer } = require('./analyzers/security.cjs');

// 建立分析器
const analyzers = [
  new ArchitectureAnalyzer(),
  new SecurityAnalyzer()
];

// 執行分析
const results = [];
for (const analyzer of analyzers) {
  const result = await analyzer.analyze(context);
  results.push(result);
}

// 彙整報告
const report = {
  analyzers: results.map(r => r.analyzer),
  totalIssues: results.reduce((sum, r) => sum + r.issues.length, 0),
  criticalIssues: results.flatMap(r => r.issues.filter(i => i.severity === 'CRITICAL'))
};
```

---

**狀態**: 📋 規劃中  
**預計實作**: Phase 2
