# BlueMouse 快速開始

## ✅ 已整合完成

BlueMouse 的核心功能已整合到 task-pipe（純 JavaScript，無需 Python）。

---

## 🚀 立即測試

### 1. 測試蘇格拉底問題生成器

```bash
node task-pipe/test-socratic-demo.cjs
```

**輸出範例**:
```
=== 🧠 蘇格拉底邏輯預檢 ===

檢測到領域: ecommerce, numerical_safety

1. 如果是牽涉到「錢」的計算，電腦的小數點有時候會算錯（浮點數誤差）。您打算怎麼辦？
   A. 用專業金融格式 (Decimal)
   B. 多寫幾個檢查 (Defensive)
```

### 2. 測試代碼驗證器

```bash
node task-pipe/lib/code-validator.cjs task-pipe/lib/socratic-generator.cjs
```

### 3. 測試完整流程（POC Step 0）

```bash
# 創建測試專案
mkdir test-project
cd test-project
echo "# 電商平台\n\n建立一個電商平台，有購物車和結帳功能。" > ecommerce.md

# 執行 POC Step 0
cd ..
node task-pipe/runner.cjs --phase=POC --step=0 --target=test-project
```

---

## 📦 整合內容

| 檔案 | 功能 |
|------|------|
| `lib/knowledge_base.json` | 70 個精選問題 |
| `lib/socratic-generator.cjs` | 蘇格拉底問題生成器 |
| `lib/code-validator.cjs` | 8+3 層代碼驗證 |
| `lib/security-checker.cjs` | 安全性檢查 |
| `lib/bluemouse-adapter-v2.cjs` | 統一適配器 |

---

## 🎛️ 配置

**檔案**: `config.json`

```json
{
  "bluemouse": {
    "socraticQuestions": {
      "enabled": true        // ✅ 預設啟用
    },
    "codeValidation": {
      "enabled": false       // ⚠️ 預設停用
    }
  }
}
```

---

## � 完整文檔

詳見：`task-pipe/docs/BLUEMOUSE_GUIDE.md`
