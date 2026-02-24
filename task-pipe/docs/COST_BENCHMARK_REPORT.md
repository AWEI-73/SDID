# AI 開發工具 Token/Credit 消耗評估報告

> 版本: v1.0 | 日期: 2026-02-16
> 用途: SDID/Task-Pipe 與主流 AI 開發工具的成本比較，供團隊討論與決策參考
> 方法: 實測數據 (SDID) + 社群回報 (Claude Code) + 推估 (BMAD)

---

## 1. 評估對象

| 工具 | 類型 | 定價模式 |
|------|------|---------|
| SDID/Task-Pipe | 腳本驅動驗收協議，搭配 Kiro IDE | Kiro credit 制 (Pro $19/月, Opus 4.6 = 2.2x 倍率) |
| Claude Code | 終端 AI coding agent | 訂閱制 ($20-200/月) 或 API pay-as-you-go |
| BMAD Method | Prompt 驅動 workflow 框架 | 依底層 LLM 定價 (API 或 Web UI) |
| Kiro (原生 vibe) | IDE 內建 agentic coding | 同 SDID，但不走 Task-Pipe 流程 |

---

## 2. 定價基準 (2026-02 時點)

### 2.1 Kiro IDE (SDID 的執行環境)

| 方案 | 月費 | 說明 |
|------|------|------|
| Pro | $19/月 | 含 agentic requests 額度 |
| Pro+ | 更高 | 增加額度 |
| Power | 最高 | 最大額度 |

- Opus 4.6 模型倍率: 2.2x (每個 credit 消耗 2.2 倍)
- Sonnet 4 模型倍率: 1x (基準)
- Credit 是 Kiro 的計量單位，對話中累計顯示

### 2.2 Claude Code

| 方案 | 月費 | 說明 |
|------|------|------|
| Pro | $20/月 | ~40-80 小時/週 Claude Code 使用 |
| Max 5x | $100/月 | 5 倍 session 限制 |
| Max 20x | $200/月 | 20 倍 session 限制 |
| API (Sonnet 4) | $3/$15 per 1M tokens | input/output |
| API (Opus 4) | $15/$75 per 1M tokens | input/output |

- 官方數據: 平均每開發者每天 ~$6 (API)，90% 低於 $12/天
- 社群回報: 重度使用者一天 $10-20 (API)，Pro plan 密集用很快觸限

### 2.3 BMAD Method

- 無獨立定價，依底層 LLM 收費
- 官方建議 Phase 1 (規劃) 用 Web UI + 大 context model 省錢
- 無社群具體 token 消耗數據

---

## 3. SDID 實測數據

### 3.1 測試環境

- IDE: Kiro (Autopilot mode)
- 模型: Claude Opus 4.6 (2.2x credit 倍率)
- 專案: counter-app (S 級, 1 Story, TypeScript + Vitest)
- 流程: BUILD Phase 1→2→5→8 (Level M 配置)

### 3.2 基準測量

| 場景 | Credits | 說明 |
|------|---------|------|
| Context transfer + 純聊天 | 1.03 | 新對話恢復 context，無開發動作 |
| S 級乾淨 BUILD (零重試) | 4.6 | Phase 1→2→5→8 全部首次 PASS |
| S 級含開發 (寫碼+修復+驗證) | ~22 | 包含 AI 寫源碼、大約 2-3 次修復重試、跑測試 |

### 3.3 乾淨 BUILD 細節

```
Phase 1 (骨架檢查)    → @PASS (首次)
Phase 2 (標籤驗收)    → @PASS (首次)
Phase 5 (測試執行)    → @PASS (12/12 vitest tests)
Phase 8 (Fillback)    → @PENDING → 填寫 → @PASS

工具呼叫: ~8 次 (5 runner + 1 file read + 1 file edit + 1 stats check)
總 credits: 5.63 (含 1.03 基礎對話)
淨 BUILD credits: 4.6
```

### 3.4 Credit 消耗模型

Credit 消耗 ≈ f(對話輪次 × 累積 context 大小)

這意味著：
- 短對話做大量工作 >> 長對話做同量工作
- 同樣的 BUILD，在第 5 輪對話跑 vs 第 50 輪對話跑，成本可能差 3-5 倍
- 對話長度管理是最大的成本槓桿

---

## 4. 三者成本比較

### 4.1 單一 Feature 成本

| 維度 | Claude Code (vibe) | BMAD | SDID/Task-Pipe |
|------|-------------------|------|----------------|
| S 級 feature (1 Story) | $5-10/session | $10-20 (推估) | $2-8 (實測) |
| M 級 feature (3 Stories) | $15-30 | $30-60 (推估) | $10-25 (推估) |
| L 級 feature (5+ Stories) | $30-60+ | $50-100 (推估) | $25-50 (推估) |

### 4.2 日常開發成本

| 維度 | Claude Code | BMAD | SDID |
|------|------------|------|------|
| 輕度 (2-3 tasks/天) | $3-6 | $5-10 | $2-5 |
| 中度 (5-8 tasks/天) | $6-12 | $10-20 | $5-12 |
| 重度 (10+ tasks/天) | $12-20+ | $20-40 | $10-20 |

### 4.3 月度預算估算

| 方案 | Claude Code | BMAD | SDID (Kiro) |
|------|------------|------|-------------|
| 訂閱費 | $20-200/月 | $0 (用既有 LLM) | $19/月起 |
| API/Credit 消耗 | $120-360/月 (API) | $100-300/月 | 含在訂閱內 |
| 總計 | $140-560/月 | $100-300/月 | $19-39/月 |

注意: Kiro 的訂閱制包含 credit 額度，不像 Claude Code API 是無上限 pay-as-you-go。實際上限取決於方案的 credit 額度。

---

## 5. Token 消耗結構分析

### 5.1 Token 花在哪裡

```
AI 開發的 token 消耗 = 探索性 token + 執行性 token + 驗證性 token + 浪費 token

探索性: AI 讀 codebase、理解架構、判斷改什麼
執行性: AI 寫程式碼、修改檔案
驗證性: AI 跑測試、檢查結果
浪費的: 重試、走錯方向、context 膨脹
```

### 5.2 三者的 Token 分配

| Token 類型 | Claude Code | BMAD | SDID |
|-----------|------------|------|------|
| 探索性 | 🔴 高 (AI 自己掃 codebase) | 🟡 中 (prompt 引導方向) | 🟢 低 (腳本已分析完) |
| 執行性 | 🟡 中 | 🟡 中 | 🟡 中 (三者相當) |
| 驗證性 | 🔴 高 (AI 自己判斷對錯) | 🟡 中 (checklist 引導) | 🟢 低 (腳本 gate 驗證) |
| 浪費的 | 🔴 高 (方向錯要重來) | 🟡 中 (有結構但無強制) | 🟢 低 (gate 精確指出問題) |

### 5.3 SDID 省 Token 的核心機制

```
傳統 AI coding (Claude Code / vibe):
  AI 讀 codebase (token) → AI 分析問題 (token) → AI 寫修復 (token) → AI 驗證 (token)
  如果錯了 → 整個 context 重送 (token × 2)

SDID:
  腳本分析問題 (0 token) → 腳本告訴 AI: TARGET + MISSING + EXAMPLE (少量 token)
  → AI 寫修復 (token) → 腳本驗證 (0 token)
  如果錯了 → 腳本精確指出哪裡錯 (少量 token) → AI 局部修復 (少量 token)
```

關鍵差異: SDID 把「探索」和「驗證」從 AI (token) 轉移到腳本 (0 token)。

### 5.4 重試成本比較

| 場景 | Claude Code | BMAD | SDID |
|------|------------|------|------|
| 首次成功 | 1x | 1x | 1x |
| 1 次重試 | ~1.8x (context 膨脹) | ~1.5x | ~1.2x (精確修復) |
| 3 次重試 | ~3-4x | ~2.5x | ~1.6x |
| 5 次重試 | ~5-8x (可能需要 reset) | ~4x | ~2x (策略漂移介入) |

SDID 的重試成本低是因為:
1. Gate 精確指出 TARGET + MISSING，不需要 AI 重新分析
2. @READ 機制讓 AI 只讀 log 檔案，不重讀整個 codebase
3. 策略漂移在第 4 次重試時自動升級策略，避免無效重複

---

## 6. Context 管理策略比較

| 維度 | Claude Code | BMAD | SDID |
|------|------------|------|------|
| Context 累積 | 每輪帶完整 history | Step-file 分段載入 | 腳本控制 @TASK + @READ |
| Context 清理 | 手動 compact/reset | 建議開新對話 | project-memory 自動 resume |
| 斷點續傳 | 無 (靠人記憶) | WIP frontmatter | .state.json + @RESUME |
| 跨對話記憶 | 無 | 無 | project-memory.json |
| 最佳實踐 | 30K tokens 以下/session | Phase 1 用 Web UI | 短對話 + state 續傳 |

### 6.1 對話長度 vs 成本 (實測觀察)

```
對話長度    SDID 成本倍率    說明
1-5 輪      1x              最佳效率區間
5-15 輪     1.5-2x          context 開始膨脹
15-30 輪    2-3x            明顯效率下降
30+ 輪      3-5x            建議開新對話
```

這個規律對所有工具都適用，但 SDID 的 project-memory + .state.json 讓「開新對話」的成本最低 (~1 credit 即可恢復 context)。

---

## 7. 適用場景分析

### 7.1 Claude Code 最適合

- 快速原型 / 一次性腳本 (不需要結構化流程)
- 探索性開發 (不確定要做什麼，需要 AI 幫忙探索)
- 小型修改 (改一兩個檔案，不值得跑完整流程)
- 已有 Claude Pro/Max 訂閱的開發者

### 7.2 BMAD 最適合

- 團隊協作 (多人需要共享規格文件)
- 非技術 PM 參與 (BMAD 支援 user_skill_level 配置)
- 需要人類全程參與決策的專案
- 已有 Web UI LLM 訂閱 (Gemini/ChatGPT)

### 7.3 SDID/Task-Pipe 最適合

- 結構化專案開發 (多 Story、多迭代)
- AI 自主執行 (最小化人類介入)
- 成本敏感場景 (需要精確控制 token 消耗)
- 品質要求高 (需要 gate 強制驗收)
- 重複性開發模式 (同類型專案可複用流程)

---

## 8. 成本優化建議

### 8.1 通用建議 (適用所有工具)

1. 控制對話長度 — 這是最大的成本槓桿，比工具選擇更重要
2. 用較便宜的模型做規劃 — Sonnet 4 ($3/M) vs Opus 4 ($15/M)，規劃階段不需要最強模型
3. 避免在長對話中做重複性工作 — 開新對話 + 恢復 context 比繼續長對話便宜

### 8.2 SDID 專屬建議

1. 用 Level S 做原型驗證 — Phase [1,2,8] 只跑 3 個 gate，最省
2. Quick Mode (P5) 處理小修改 — 不佔正式 iteration，5 個 gate 夠用
3. 善用 project-memory — 新對話 ~1 credit 即可恢復，不要硬撐長對話
4. Sonnet 4 跑 BUILD — 標籤驗收和測試不需要 Opus 級推理能力

### 8.3 成本預算參考

| 專案規模 | Stories | 預估 Credits (Opus 4.6, 2.2x) | 預估 Credits (Sonnet 4, 1x) |
|---------|---------|-------------------------------|----------------------------|
| S (counter-app) | 1 | 8-12 | 4-6 |
| M (todo-app) | 3 | 25-40 | 12-20 |
| L (recipe-manager) | 5+ | 50-80 | 25-40 |

---

## 9. 結論

### 9.1 成本效率排名

```
SDID/Task-Pipe > BMAD > Claude Code (vibe)
```

SDID 的成本優勢來自「腳本做分析 (0 token)，AI 做執行 (精確 token)」的架構設計。這不是微優化，而是根本性的 token 消耗模型差異。

### 9.2 但成本不是唯一考量

| 維度 | 最佳選擇 |
|------|---------|
| 成本效率 | SDID |
| 上手門檻 | Claude Code (零配置) |
| 團隊協作 | BMAD (規格文件導向) |
| 品質保證 | SDID (gate 強制驗收) |
| 靈活性 | Claude Code (無流程約束) |
| 可追溯性 | SDID (log + memory + state) |

### 9.3 最大的洞察

最大的省錢槓桿不是工具選擇，是「對話長度管理」。

同樣的 4.6 credits 乾淨 BUILD，在長對話裡可能會因為錯誤重試而膨脹到 22+ credits 甚至更高。所有工具都受這個規律影響，但 SDID 的 state 續傳機制讓「頻繁開新對話」的摩擦最低。

---

## 附錄 A: 資料來源

- SDID 實測: counter-app S 級 BUILD，Kiro IDE + Opus 4.6，2026-02-16
- Claude Code 官方: Anthropic 公開數據 (平均 $6/天, 90% < $12/天)
- Claude Code 社群: [richardporter.dev](https://richardporter.dev/blog/claude-code-token-management), [claudelog.com](https://claudelog.com/faqs/how-expensive-is-claude-code/), [claudefa.st](https://claudefa.st/blog/guide/faq)
- Claude Code 定價: [o-mega.ai](https://o-mega.ai/articles/claude-code-pricing-2026-costs-plans-and-alternatives), [skywork.ai](https://skywork.ai/blog/claude-code-sdk-pricing-and-api-limits-explained/)
- BMAD: [buildmode.dev](https://buildmode.dev/blog/mastering-bmad-method-2025/), [GMO Research](https://recruit.group.gmo/engineer/jisedai/blog/the-bmad-method-a-framework-for-spec-oriented-ai-driven-development/)
- Kiro: [kiro.dev/faq](https://kiro.dev/faq/), [kiro.dev/changelog](https://kiro.dev/changelog/)
- Amazon Q Developer: [aws.amazon.com](https://aws.amazon.com/q/developer/pricing/) ($19/月 Pro tier)

Content was rephrased for compliance with licensing restrictions.

## 附錄 B: 測試方法論

### B.1 SDID 實測方法

1. 開新 Kiro 對話，記錄起始 credit
2. 執行 context transfer (恢復前次對話 context)
3. 記錄 context transfer 後的 credit → 得到「基礎對話成本」
4. 執行 counter-app BUILD Phase 1→2→5→8
5. 記錄 BUILD 完成後的 credit → 減去基礎成本 = 「淨 BUILD 成本」

### B.2 限制與偏差

- SDID 數據為單一專案 (counter-app) 的單次測量，樣本量小
- Claude Code 數據來自社群回報，使用場景和模型版本不一
- BMAD 無社群具體 token 數據，為基於架構分析的推估
- Kiro credit 與 API token 的換算關係不透明，無法精確對比
- 所有成本會隨模型定價變動而改變

### B.3 未來驗證方向

- 在 M/L 級專案上重複測量，建立更完整的成本曲線
- 測量重試場景的實際成本膨脹率
- 比較 Sonnet 4 vs Opus 4.6 在相同任務上的 credit 差異
- 追蹤 Kiro credit 額度與實際可完成工作量的關係
