# Task-Pipe 設計模式 — POC-PLAN 漸進式規則

## 概覽

Task-Pipe 是細部漸進式設計模式，適合需求已經比較明確、或是局部功能開發的場景。
透過 POC Step 1-5 做細部需求探索 + 契約設計 + UI 原型，再透過 PLAN Step 1-5 產出 implementation_plan。

## 執行方式

所有步驟都透過 `scripts/taskpipe-loop.cjs` 自動偵測和執行：

```bash
# 繼續現有專案（自動偵測狀態）
node .agent/skills/sdid/scripts/taskpipe-loop.cjs --project=[path]

# 新專案
node .agent/skills/sdid/scripts/taskpipe-loop.cjs --new --project=[name] --type=[type]

# 強制從特定步驟開始
node .agent/skills/sdid/scripts/taskpipe-loop.cjs --project=[path] --force-start=POC-1
node .agent/skills/sdid/scripts/taskpipe-loop.cjs --project=[path] --force-start=PLAN-1
```

## 流程

```
POC Step 1-5 → PLAN Step 1-5 → implementation_plan（匯流到 BUILD）
```

### POC 階段 (Step 1-5)
1. 模糊消除 — 讀取 requirement_draft，消除歧義（若 draft 不存在，POC Step 1 會自動 scaffold 空白 draft template，AI 需根據使用者需求填寫後再繼續）
2. 規模評估 — 評估 S/M/L，檢查 Story 數量
3. 契約設計 — 產出 @GEMS-CONTRACT 型別定義
4. UI 原型 — 產出 POC.html + @GEMS-DESIGN-BRIEF
5. 需求規格 — 產出 requirement_spec

### PLAN 階段 (Step 1-5)
1. 需求確認 — 確認需求，模糊消除
2. 規格注入 — 生成 implementation_plan_Story-X.Y.md
3. 架構審查 — Constitution Audit
4. 標籤規格設計 — 設計 GEMS 標籤規格
5. 需求規格說明 — 最終確認

## 執行循環

1. 執行 `taskpipe-loop.cjs --project=[path]`
2. 讀取 output
   - @PASS → 腳本會告訴你下一步，再次執行
   - @TACTICAL_FIX → 讀 error log，修復，再次執行
3. 重複直到進入 BUILD 階段

## 錯誤處理

- 讀取 `.gems/iterations/iter-X/logs/` 下最新的 error log
- 找 `@TACTICAL_FIX` 標記 — 告訴你要修什麼
- 修復專案檔案（不是工具檔案）
- 重新執行 loop

## 參數

| 參數 | 用途 |
|------|------|
| `--project=[path]` | 專案路徑（必填） |
| `--new --project=[name]` | 新專案 |
| `--type=[type]` | 專案類型（任意名稱） |
| `--force-start=POC-1` | 強制從 POC Step 1 開始 |
| `--force-start=PLAN-1` | 強制從 PLAN Step 1 開始 |
| `--level=S/M/L` | 執行等級 |
| `--mode=full\|quick` | full=全流程, quick=小步快跑 |
