---
name: frontend-design
description: 強化 POC 的前端設計品質，避免 AI 通用美學，創造獨特可記憶的視覺體驗。當需要建立 POC HTML、檢查設計品質、或需要前端設計指引時使用此 skill。自動檢查字體、配色、動態效果、CSS 變數系統等設計要素。整合到 Task-Pipe POC Step 2。
license: Complete terms in LICENSE.txt
version: 1.1.0
---

此 skill 指導創建獨特、高品質的 POC 前端介面，避免通用「AI slop」美學。

使用者需求包括：建立可運行的 POC HTML、驗證設計品質、或獲取設計指引。

## Design Thinking

在編碼前，承諾一個明確的美學方向：
- **Purpose**: 這個 POC 驗證什麼功能？誰使用？
- **Tone**: 選擇明確風格，不要折衷
- **Differentiation**: 什麼讓這個設計令人難忘？一個人會記住什麼？

**CRITICAL**: 選擇明確的概念方向並精準執行。大膽的極簡主義和精緻的極繁主義都可以，關鍵是意圖明確。

## 禁止的「AI Slop」美學

| 類別 | ❌ 禁止使用 | 原因 |
|------|------------|------|
| **字體** | Arial, Inter, Roboto, Helvetica, system-ui | 通用無特色 |
| **配色** | 純白 #FFFFFF 背景、紫白漸層、藍紫色系 | 刺眼且 AI 味重 |
| **圓角** | 全部 `rounded-lg` | 千篇一律 |
| **效果** | 無動畫、無 hover 效果 | 死板無生命 |
| **佈局** | 預設 Bootstrap 卡片網格 | 缺乏創意 |

## ✅ 推薦字體清單

### Display / 標題字體
| 字體 | 風格 | Google Fonts |
|------|------|--------------|
| Space Grotesk | 幾何現代 | ✅ |
| Outfit | 圓潤友善 | ✅ |
| Syne | 大膽前衛 | ✅ |
| Plus Jakarta Sans | 專業精緻 | ✅ |
| DM Sans | 乾淨俐落 | ✅ |

### Mono / 數據字體
| 字體 | 風格 | Google Fonts |
|------|------|--------------|
| JetBrains Mono | 程式碼風 | ✅ |
| Fira Code | 連字支援 | ✅ |
| IBM Plex Mono | 企業專業 | ✅ |
| Geist Mono | 現代極簡 | Vercel CDN |

### 中文字體
| 字體 | 風格 | 來源 |
|------|------|------|
| Noto Sans TC | 標準中文 | Google Fonts |
| LXGW WenKai | 文藝手寫 | GitHub |

## @GEMS-DESIGN-BRIEF 格式

POC 必須包含結構化的 `@GEMS-DESIGN-BRIEF`：

```html
<!--
@GEMS-DESIGN-BRIEF:
- Purpose: [驗證什麼功能]
- Aesthetic: [風格名稱]
- Typography: [字體名稱 + 來源]
- ColorPalette:
  - Primary: #xxxxxx
  - Accent: #xxxxxx
  - Background: #xxxxxx
- Motion: [動畫效果]
- Avoid: [禁止元素]
- Memorable: [獨特記憶點]
-->
```

**必填**: Purpose, Aesthetic, Typography

## 設計品質評分

| 項目 | 權重 | 說明 |
|------|------|------|
| DESIGN_BRIEF | 20% | 必填欄位完整 |
| Typography | 20% | 獨特字體，非通用 |
| Color System | 25% | CSS 變數，避免純白 |
| Motion | 15% | hover + transition |
| Memorable | 10% | 獨特視覺效果 |
| CSS Variables | 10% | :root 變數系統 |

**品質等級**: GOOD (80+), POOR (50-79), SKELETON (<50)

## 使用

### 設計品質檢查

```bash
node task-pipe/skills/frontend-design/design-quality-checker.cjs --target=/path/to/project
```

### API

```javascript
const { checkDesignQuality } = require('./skills/frontend-design/design-quality-checker.cjs');
const result = checkDesignQuality('/path/to/POC.html');
// result.quality: 'GOOD' | 'POOR' | 'SKELETON'
// result.score: 0-100
```

## 風格參考

| 風格 | 特徵 | 適用場景 |
|------|------|----------|
| **Neo-Brutalist Dark** | 深色底、銳利邊角、霓虹強調色、clip-path | 開發者工具、儀表板 |
| **Glassmorphism** | 毛玻璃 backdrop-filter、柔和漸層、圓角 | 現代 SaaS、行動應用 |
| **Editorial Clean** | 大量留白、精緻襯線字體、網格系統 | 內容平台、部落格 |
| **Organic Soft** | 圓角、暖色調、手繪元素 | 兒童、健康、生活風格 |
| **Retro-Futuristic** | 復古色彩、像素元素、CRT 效果 | 遊戲、創意工具 |
| **Industrial Minimal** | 深灰底、螢光強調、等寬字體 | 工業應用、監控系統 |

## 範例

見 `../../templates/examples/poc/DesignFirst_POC_GOLD.html`
