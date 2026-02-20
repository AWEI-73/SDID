# Blueprint 設計模式 — 5 輪對話規則

## 概覽

Blueprint 是大方向設計模式，透過 5 輪結構化對話將模糊需求收斂為 Enhanced Draft。
完成後存檔到 `{project}/.gems/iterations/iter-{X}/poc/requirement_draft_iter-{X}.md`，
然後交給 BUILD-AUTO 模式（blueprint-loop.cjs）執行。

> **迭代號規則**: 存檔前先掃描 `{project}/.gems/iterations/` 找到最大的 iter-N，新建 iter-(N+1)。若無任何迭代目錄則從 iter-1 開始。

## 5 輪對話流程

| 輪次 | 焦點 | 產出 |
|------|------|------|
| 1 | 目標釐清 | 一句話目標 + 族群識別表 |
| 2 | 實體識別 | 實體定義表格 (欄位/型別/約束) |
| 3 | 模組拆分 | 共用模組 + 獨立模組 + 路由結構 |
| 4 | 迭代規劃 | 迭代規劃表 + 不做什麼 |
| 5 | 動作細化 | 模組動作清單 (業務語意→技術名稱) |

## 每輪規則

### Round 1: 目標釐清
- MUST: 問「你想做什麼系統？解決什麼問題？誰會用？」
- FORBIDDEN-READ: src/*, .gems/*, task-pipe/*, *.cjs
- EXIT: 使用者確認一句話目標 + 族群表

### Round 2: 實體識別
- MUST: 問「系統需要管理哪些資料？每筆資料有什麼欄位？」
- FORBIDDEN-READ: src/*, task-pipe/*
- ALLOWED-READ: Round 1 對話紀錄
- 格式: `| 欄位 | 型別 | 約束 | 說明 |`
- EXIT: 使用者確認實體表格

### Round 3: 模組拆分
- MUST: 根據 Round 1-2 提出模組結構建議，問使用者確認
- ALLOWED-READ: [architecture-rules.md](architecture-rules.md)
- EXIT: 使用者確認模組結構

### Round 4: 迭代規劃
- MUST: 提出 MVP 範圍建議，問「第一版要做到什麼程度？」
- ALLOWED-READ: [action-type-mapping.md](action-type-mapping.md)
- shared 模組永遠在 Iter 1
- 明確列出「不做什麼」
- EXIT: 使用者確認迭代規劃表

### Round 5: 動作細化
- MUST: 列出每個模組的具體動作，問使用者確認
- ALLOWED-READ: [action-type-mapping.md](action-type-mapping.md)
- 用 P0-P3 標記優先級
- 用 `→` 描述資料流向
- EXIT: 使用者確認 → 組裝 Enhanced Draft

## 組裝 Enhanced Draft

5 輪完成後：
1. 組裝完整 Enhanced Draft Markdown
2. 設定 POC Level: S(≤3 Stories) / M(≤6) / L(≤10)
3. 確認當前迭代號（掃描 `.gems/iterations/` 取最大 iter-N，遞增為 iter-(N+1)；無則 iter-1）
4. 存到 `{project}/.gems/iterations/iter-{X}/poc/requirement_draft_iter-{X}.md`
5. 提示使用者：「Draft 已完成（iter-{X}），接下來執行 BUILD 嗎？」

## 全授權模式差異

內部推演 5 輪（每輪 AI 自己做決策，不問使用者）。
每步內部自我檢查：「如果我是使用者，這個回答夠具體嗎？」
不中斷、不分批展示，最終一次性輸出組裝好的完整 Enhanced Draft + 「下一步：啟動 BUILD」結論。

## 模板與範例

- Golden template: `task-pipe/templates/enhanced-draft-golden.template.md`
- EcoTrack example: `task-pipe/templates/examples/enhanced-draft-ecotrack.example.md`

## 通用規則

- 一輪一個主題，不要一次問所有問題
- 使用者模糊時，提供 2-3 個具體選項
- 每輪結束用表格/清單摘要，確認後才進下一輪
- 不確定的標記 `[NEEDS CLARIFICATION]`
- 使用繁體中文
