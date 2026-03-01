# SDID Framework Roadmap

> 每次 session 開始前看這裡，挑一個 milestone 繼續。
> 最後更新：2026-03-01 (session 6 — Skill A → spec-gen.cjs 實作完成)

---

## 框架現狀 (v4.0 — 2026 演進中)

**路線策略（2026-03-01 更新）**

```
兩條正式路線 + 兩條旁路：

  Blueprint 路線（模糊需求）       Task-Pipe 路線（清晰需求）
  5 輪對話 → blueprint-gate        POC → CYNEFIN → PLAN → BUILD
              ↘                      ↙
         spec-gen.cjs（字典生成）✅ 完成
                  ↓
        .gems/specs/*.json（字典 = 唯一規格真相源）
                  ↓
        spec-gate → CYNEFIN → BUILD 1-8 → dict-sync → SCAN
                                                         ↓
                                              state-guide 路由下一輪

  旁路（不走字典迴圈）：
    POC-FIX   — 已驗證 POC → 直接移植，必寫測試，micro-fix-gate 驗收
    MICRO-FIX — 改一兩行 → micro-fix-gate 驗收，不寫測試
```

**Task-Pipe 部分廢棄**
- `task-pipe/phases/plan/` — 廢棄（Blueprint + 字典取代 implementation_plan 角色）
- `task-pipe/phases/poc/` — 廢棄（不再獨立使用）
- `task-pipe/phases/build/` — **仍在使用**（BUILD 1-8 + SCAN 統一入口）
- `task-pipe/phases/scan/` — **仍在使用**（已改走 gems-scanner-v2 降級鏈）
- 現有已廢棄腳本保留不動（加 deprecated 標頭），不刪除

**GEMS-Next 演進**

| 波次 | 項目 | 狀態 |
|------|------|------|
| 波一 | dict-schema.cjs（schema + validator） | ✅ 完成 |
| 波一 | ExamForge/.gems/specs/ 目錄結構 | ✅ 完成 |
| 波一 | pdf-text-extractor.json 格式驗證 | ✅ 完成 |
| 波二 | tag-shrink.cjs | ✅ 完成 |
| 波二 | state-guide.cjs | ✅ 完成（5 區塊輸出：狀態/讀物/歷史/下一步/紅線） |
| 波三 | gems-scanner-v2.cjs + phase-2 判斷 | ✅ 完成（AST + 雙格式 + gemsId 連結）(03-01 修 VariableStatement bug) |
| 波三 | spec-gate.cjs | ✅ 完成 |
| 波三 | dict-sync.cjs（phase-8 字典同步） | ✅ 完成（lineRange + status 只升不降） |
| 波三 | SCAN phase 現代化 | ✅ 完成（03-01 移除舊 gems-scanner.cjs，統一走 v2→enhanced→lite 降級鏈）|
| 波四 | spec-gen.cjs（字典生成腳本） | ✅ 完成（session 6 — 自動偵測 Blueprint/Task-Pipe 格式，產出 specs/*.json + _index.json） |

**收斂目標（2026-03-01 確定）**

字典迴圈 = 框架閉合的最後一塊。**只有正式路線走字典迴圈**：
```
Blueprint ──┐
Task-Pipe ──┘→ spec-gen.cjs（字典生成）→ .gems/specs/*.json
                                         ↓
                                   spec-gate（品質驗證）
                                         ↓
                              BUILD 1-8 → dict-sync（行號回寫）
                                         ↓
                              SCAN（.gems/docs/ 全景報告）
                                         ↓
                              state-guide 讀 specs + docs → 下一輪路由

旁路（POC-FIX / MICRO-FIX）不走字典迴圈。
```
字典是路由 SEARCH 的核心，spec-gen.cjs 已完成，整個框架已收斂。

---

## Milestone 清單

### ★ M10 — spec-gen.cjs 字典生成 ✅ 完成（session 6）
> 目標：讓正式路線能自動產出 `.gems/specs/*.json` 字典，閉合整個框架迴圈

**現況**：spec-gen.cjs 已實作，自動偵測 Blueprint / Task-Pipe 兩種輸入格式，產出 dict-schema 合規的 specs/*.json + _index.json。下游工具鏈 (spec-gate / BUILD / dict-sync / SCAN) 全部就緒，字典迴圈已閉合。

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| spec-gen.cjs 字典生成腳本 | ✅ 完成 | **P0** | 讀 Enhanced Draft (Blueprint) 或 requirement_spec (Task-Pipe)，產出符合 dict-schema 的 specs/*.json + _index.json |
| 輸入格式定義 | ✅ 完成 | P0 | 自動偵測：有 `### Iter N:` → Blueprint；否則 → Task-Pipe。解析「模組動作清單表」markdown 表格 |
| E2E 驗證 | ✅ 完成 | P1 | ExamForge Enhanced Draft → 4 模組 23 函式 → spec-gate 驗證通過（0 warnings） |
| 測試 fixture | ✅ 完成 | P1 | `sdid-tools/__tests__/skill-a/fixtures/` — Blueprint (Auth) + Task-Pipe (Meal) 兩組 fixture |

---

### M1 — Gate 驗證覆蓋完整化 🟡 進行中
> 目標：Blueprint Gate 的機械驗證與設計規則完全對齊

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| ACC-001：AC 欄位存在性 | ✅ 完成 | P0 | blueprint-gate checkACIntegrity |
| ACC-002：Then 含效益指標驗證 | ⬜ 待做 | P1 | blueprint-design Round 5 有規則但 gate 沒有對應機械驗證 |
| ACC-003：Demo Checkpoint 必填 | ⬜ 待做 | P1 | Round 4 硬規則，但 gate 未驗證 |
| blueprint-gate 重複 checkACIntegrity | ✅ 已修 | P0 | 兩個同名函式 → 已刪除舊版 |

---

### M2 — Spec-Parser 健壯性 🟡 進行中
> 目標：5.5 函式規格表 → plan-generator 的 E2E pipeline 更可靠

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| table-first fallback 無警告 | ✅ 已修 | P0 | |
| 表格格式容錯 | ⬜ 待做 | P2 | AI 多空格或少一個 `\|` 會 silently fallback |
| 跨 story 重複函式名稱偵測 | ⬜ 待做 | P2 | 同名函式出現在兩個 story 可能產生衝突 |

---

### M3 — Cynefin Check 精煉 🟡 已有基礎實作
> 目標：確認兩條正式路線的 CYNEFIN 攔截時機正確

**已實作的部分**：
- Blueprint loop: `blueprint-loop/scripts/loop.cjs` 有 `CYNEFIN_CHECK` case (line 440)
- Task-Pipe loop: `task-pipe/skills/sdid-loop/scripts/loop.cjs` POC 完成後檢查 `cynefin-check-pass-*` log (line 461)
- `cynefin-log-writer.cjs` 工具腳本（不分路線）
- POC-FIX / MICRO-FIX 明確排除，不做 CYNEFIN

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| Blueprint loop CYNEFIN 攔截 | ✅ 已實作 | — | `blueprint-loop/scripts/loop.cjs` |
| Task-Pipe loop CYNEFIN 攔截 | ✅ 已實作 | — | `sdid-loop/scripts/loop.cjs` |
| Complex domain 建議拆 story | ⬜ 待做 | P2 | Complex → 自動建議降 Level 或拆 story |

---

### M4 — Monitor 整合強化 ⬜ 未開始（低優先）
> 目標：sdid-monitor 能完整反映狀態

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| Blueprint 路的 phase 識別 | ⬜ 待確認 | P2 | |
| Cynefin 結果在 monitor 顯示 | ⬜ 待做 | P3 | |
| VSC gate 結果在 monitor 顯示 | ⬜ 待做 | P3 | |

---

### M5 — SKILL.md routing 完整性 ✅ 完成
> 目標：routing table 覆蓋所有實際使用場景

| 項目 | 狀態 | 說明 |
|------|------|------|
| POC-FIX 快速路徑（v1） | ✅ 完成 | 初版 |
| POC-FIX 完整循環（v2） | ✅ 完成 | 四階段流程 SETUP→VERIFY→CONSOLIDATE→BUILD+TEST |
| SKILL.md routing table 確認 | ✅ 完成 | bc70dcb 已驗證 |

---

### M6 — 全 Story 分片 ⬜ 未開始
> 目標：runner 自動走完 spec 裡所有 story

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| step-2 印出全 story 指令清單 | ⬜ 待做 | P0 | `generatePlansFromSpec()` 後列出所有 story 的指令 |
| plan/step-5 全局 gate | ⬜ 待做 | P1 | `--all-stories` 模式 |
| runner story 進度追蹤 | ⬜ 待做 | P2 | state-manager 記錄 PLAN 完成狀態 |

---

### M7 — Story 邊界偵測 ⬜ 未開始
> 目標：偵測 spec 拆 story 時與 POC 函式邊界不對齊

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| 跨 story FLOW 重疊偵測 | ⬜ 待做 | P2 | 同名 step → WARN |
| spec vs POC 函式對齊檢查 | ⬜ 待做 | P2 | |

---

### M8 — 框架文件收斂 ⬜ 未開始
> 目標：對外說明和內部規格文件保持一致

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| SDID_FRAMEWORK_OVERVIEW.md | ⬜ 待做 | P2 | 需重建 |
| README.md 與實際工具同步 | ⬜ 待確認 | P2 | |

---

### M9 — micro-fix-gate 擴充 ⬜ 未開始
> 目標：POC-FIX / MICRO-FIX 的 gate 能驗證 GEMS 標籤完整性

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| `--mode=poc-fix` flag | ⬜ 待做 | P1 | 對 `--changed` 檔案掃描 GEMS 標籤 |
| `@GEMS-TEST-FILE` 存在性驗證 | ⬜ 待做 | P1 | |
| consolidation-log 自動讀取 | ⬜ 待做 | P2 | |

> ⏳ 等 POC-FIX 實戰跑過幾次再做

---

## 已完成的重要里程碑

| 完成時間 | 內容 |
|---------|------|
| 2026-03-01 | **M10: spec-gen.cjs 字典生成完成** — 自動偵測 Blueprint/Task-Pipe，產出 specs/*.json + _index.json，字典迴圈閉合 |
| 2026-03-01 | fix: gems-scanner-v2 VariableStatement bug（const X = {} 類無法辨識） |
| 2026-03-01 | fix: SCAN phase 移除舊 gems-scanner.cjs，統一走 v2 降級鏈 |
| 2026-03-01 | fix: scan.cjs relativeTarget ReferenceError |
| 2026-03-01 | test: sdid-test-app 完整跑完 BUILD Phase 1-8 + SCAN |
| 2026-02-25 | M5: POC-FIX v2 重寫 — 四階段完整循環 |
| 2026-02-25 | M1: blueprint-gate 重複函式修復 |
| 2026-02-25 | M2: spec-parser 5.5 fallback warning |
| 2026-02-25 | feat: 5.5 函式規格表 → spec-parser → plan-generator E2E |
| 2026-02-24 | feat: Blueprint 硬規則強化（VSC 強制 + Demo Checkpoint + AC 效益導向） |
| 2026-02-22 | feat: Cynefin Check 整合進 loop 攔截（Blueprint + Task-Pipe 兩條路線） |
| 2026-02-21 | feat: VSC gate 整合至 Blueprint + Task-Pipe (phase-1) |
| 舊 | feat: micro-fix-gate.cjs + SKILL.md routing |

---

## 下一個 Session 建議入口

> **M10 已完成**：spec-gen.cjs 字典迴圈已閉合。以下按優先順序排列。

1. **M6 全 Story 分片** — runner 自動走完 spec 裡所有 story（0.5 session）
2. **M1-ACC-002**：blueprint-gate 加 Then 效益指標語意掃描
3. **M8 框架文件收斂** — README / OVERVIEW 與工具鏈同步

---

## 工具快速參考

```bash
# spec-gen（字典生成 — 讀 Enhanced Draft 或 requirement_spec）
node sdid-tools/spec-gen.cjs --project=<project> --input=<draft.md> [--iter=N] [--dry-run]

# Blueprint route
node sdid-tools/blueprint-gate.cjs --draft=<path> --iter=1

# Task-Pipe route（BUILD 入口）
node task-pipe/runner.cjs --phase=BUILD --step=1 --target=<project> --story=Story-X.0

# SCAN（產出 .gems/docs/）
node task-pipe/runner.cjs --phase=SCAN --target=<project>

# dict-sync（回寫行號到 .gems/specs/）
node sdid-tools/dict-sync.cjs --project=<project> [--src=src] [--dry-run]

# spec-gate（驗證字典品質）
node sdid-tools/spec-gate.cjs --project=<project>

# Monitor
node sdid-monitor/server.cjs   # http://localhost:3737
```
