# Auto Fixers 目錄

此目錄包含各階段的自動修正工具（Fixers）。

---

## 📋 Fixer 列表

| Fixer | 階段 | 狀態 | 說明 |
|-------|------|------|------|
| `base-fixer.cjs` | - | ✅ | 基礎類別，所有 Fixer 繼承此類別 |
| `index.cjs` | - | ✅ | Factory，自動選擇對應的 Fixer |
| `build-phase4-fixer.cjs` | BUILD Phase 4 | ✅ | 自動補充 GEMS 標籤 |
| `build-phase5-fixer.cjs` | BUILD Phase 5 | ✅ | 自動建立測試檔案 |
| `poc-step0-fixer.cjs` | POC Step 0 | ✅ | 自動補充需求描述 |

---

## 🚀 使用方式

### 使用 Factory（推薦）

```javascript
const { AutoFixerFactory } = require('./fixers');

// 自動選擇對應的 Fixer
const fixer = AutoFixerFactory.create('BUILD', '4', {
  target: './my-project',
  dryRun: false
});

if (fixer) {
  const fixPlan = fixer.generateFixPlan(reviewReport);
  const results = await fixer.applyFixes(fixPlan);
}
```

### 檢查是否支援

```javascript
if (AutoFixerFactory.isSupported('BUILD', '4')) {
  console.log('支援自動修正');
}

// 取得所有支援的階段
const supported = AutoFixerFactory.getSupportedPhases();
console.log(supported);
```

---

## 🛠️ 建立新 Fixer

### 1. 繼承 BaseAutoFixer

```javascript
const { BaseAutoFixer } = require('./base-fixer.cjs');

class MyFixer extends BaseAutoFixer {
  constructor(options) {
    super({ ...options, phase: 'PLAN', step: '2' });
  }
  
  generateFixPlan(reviewReport) {
    // 實作修正計畫邏輯
    return {
      totalFixes: 0,
      fixes: [],
      estimatedTime: this.estimateTime([]),
      canAutoFix: false
    };
  }
  
  async applyFixes(fixPlan) {
    // 實作修正邏輯
    return {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      results: []
    };
  }
}

module.exports = { MyFixer };
```

### 2. 在 Factory 中註冊

```javascript
// index.cjs
const { MyFixer } = require('./my-fixer.cjs');

const fixerMap = {
  // ... 現有 Fixers
  'plan-2': MyFixer  // 新增這行
};
```

### 3. 更新支援列表

```javascript
// index.cjs
static getSupportedPhases() {
  return {
    'PLAN': {
      '2': { name: 'PLAN Step 2 - 規格注入', supported: true }  // 更新這行
    }
  };
}
```

---

## 📚 BaseAutoFixer API

### 必須實作的方法

```javascript
// 產生修正計畫
generateFixPlan(reviewReport) {
  return {
    totalFixes: number,
    fixes: Array<Fix>,
    estimatedTime: { auto, manual, total },
    canAutoFix: boolean
  };
}

// 執行修正
async applyFixes(fixPlan) {
  return {
    total: number,
    success: number,
    failed: number,
    skipped: number,
    results: Array<Result>
  };
}
```

### 可用的輔助方法

```javascript
// 估算修正時間
estimateTime(fixes)

// 產生修正報告
generateFixReport(fixPlan, results)

// 讀取檔案
readFile(filePath)

// 寫入檔案
writeFile(filePath, content)

// 取得狀態圖示
getStatusIcon(status)
```

---

## 🎯 Fix 物件格式

```javascript
{
  type: 'ADD_TAG',           // 修正類型
  file: 'src/utils.js',      // 檔案路徑
  line: 45,                  // 行號（可選）
  tag: 'GEMS-DEPS',          // 標籤名稱（可選）
  template: ' * GEMS-DEPS: [...]',  // 模板內容
  autoFixable: true,         // 是否可自動修正
  action: 'insertLine',      // 動作類型
  suggestion: '...'          // 人工修正建議（可選）
}
```

---

## 📊 Result 物件格式

```javascript
{
  fix: Fix,                  // 對應的 Fix 物件
  status: 'SUCCESS',         // SUCCESS, FAILED, SKIPPED, DRY_RUN
  message: '...',            // 成功訊息（可選）
  error: '...',              // 錯誤訊息（可選）
  reason: '...'              // 跳過原因（可選）
}
```

---

**維護者**: GEMS Team  
**最後更新**: 2026-01-08
