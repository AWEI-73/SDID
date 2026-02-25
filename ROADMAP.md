# SDID Framework Roadmap

> 每次 session 開始前看這裡，挑一個 milestone 繼續。
> 最後更新：2026-02-25 (session 2)

---

## 框架現狀 (v3.0)

```
Blueprint Route (模糊需求)        Task-Pipe Route (清晰需求)
  5-round dialogue                  POC Step 0-5
  blueprint-gate (19 checks)        CYNEFIN-CHECK
  draft-to-plan                     PLAN Step 1-5
         ↘                              ↙
              implementation_plan
                    ↓
              BUILD Phase 1-8
                    ↓
                  SCAN
```

---

## Milestone 清單

### M1 — Gate 驗證覆蓋完整化 ✅ 進行中
> 目標：Blueprint Gate 的機械驗證與設計規則完全對齊

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| ACC-001：AC 欄位存在性 | ✅ 完成 | P0 | blueprint-gate checkACIntegrity |
| ACC-002：Then 含效益指標驗證 | ⬜ 待做 | P1 | blueprint-design Round 5 有規則但 gate 沒有對應機械驗證。需在 checkACIntegrity 加 Then 語意掃描（排除純技術描述） |
| ACC-003：Demo Checkpoint 必填 | ⬜ 待做 | P1 | Round 4 硬規則，但 gate 未驗證迭代規劃表的 Demo Checkpoint 欄位是否填寫 |
| blueprint-gate 重複 checkACIntegrity | ✅ 已修 | P0 | 兩個同名函式 → 已刪除舊版 |

---

### M2 — Spec-Parser 健壯性 ✅ 進行中
> 目標：5.5 函式規格表 → plan-generator 的 E2E pipeline 更可靠

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| table-first fallback 無警告 | ✅ 已修 | P0 | 5.5 區塊存在但 story 無有效行時，現在會 stderr 警告 |
| 表格格式容錯 | ⬜ 待做 | P2 | 目前若 AI 多一個空格或少一個 `\|` 會 silently fallback，可加更多 regex 容錯 |
| 跨 story 重複函式名稱偵測 | ⬜ 待做 | P2 | 若同名函式出現在兩個 story，plan-generator 可能產生衝突 |

---

### M3 — Cynefin Check 觸發時機明確化 ⬜ 未開始
> 目標：確保 Cynefin 在 POC 完成後立即攔截，而不是等到 PLAN

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| Task-Pipe loop 的 Cynefin 攔截點 | ⬜ 待確認 | P1 | 目前 loop.cjs 在 POC 完成後觸發，但需確認 Complex domain 的建議是否在 POC 階段就回饋 |
| Blueprint loop 的 Cynefin 攔截點 | ⬜ 待確認 | P1 | blueprint-loop.cjs Cynefin 觸發位置 vs draft-to-plan 執行順序 |
| Cynefin 結果對 Level 的影響 | ⬜ 待做 | P2 | Complex → 自動建議降 Level 或拆 story |

---

### M4 — Monitor 整合強化 ⬜ 未開始
> 目標：sdid-monitor 能完整反映兩條路的狀態

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| Blueprint 路的 phase 識別 | ⬜ 待確認 | P2 | monitor 能否識別 blueprint-gate / draft-to-plan 的進度事件 |
| Cynefin 結果在 monitor 顯示 | ⬜ 待做 | P3 | 每個 project 的 Cynefin domain 標示 |
| VSC gate 結果在 monitor 顯示 | ⬜ 待做 | P3 | blueprint-gate VSC-001/002 + phase-1 VSC 結果可視化 |

---

### M5 — SKILL.md routing 完整性 ✅ 進行中
> 目標：routing table 覆蓋所有實際使用場景

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| POC-FIX 快速路徑 | ✅ 完成 | P1 | SKILL.md 加入 POC-FIX 模式：POC 已驗證 + 目標明確 → 跳過 PLAN，直接移植 + micro-fix-gate |
| SKILL.md routing table 完整性確認 | ⬜ 待確認 | P1 | bc70dcb 的其他 mode 邏輯是否正確 |

---

### M6 — Task-Pipe PLAN 全 Story 分片 ⬜ 未開始
> 目標：runner 自動走完 spec 裡所有 story，不靠手動逐一餵 --story

**背景**：ExamForge iter-11 有 3 個 story，PLAN log 只跑了 11.0 和 11.1，11.2 從未被 BUILD。
根本原因：step-2 的 NEXT 指令永遠指向 step-3（往深走），不會橫向提示「還有 Story-X.2 沒跑」。

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| step-2 生成後印出全 story 指令清單 | ⬜ 待做 | P0 | `generatePlansFromSpec()` 成功後，stdout 印出每個 story 的完整 PLAN Step 2-5 指令，讓 AI 一次看到全部 |
| plan/step-5 加全局 gate | ⬜ 待做 | P1 | `--all-stories` 模式：掃描 spec 的 story 清單 vs plan/ 目錄，輸出哪些 story 還沒 READY，全部通過才放行進 BUILD |
| runner story 進度追蹤 | ⬜ 待做 | P2 | state-manager 記錄每個 story 的 PLAN 完成狀態，`--resume` 時自動跳到第一個未完成的 story |

---

### M7 — Story 邊界偵測 ⬜ 未開始
> 目標：偵測 spec 拆 story 時與 POC 函式邊界不對齊的問題

**背景**：ExamForge iter-11 的 metadata 過濾邏輯在 POC 裡是 `extractImagesFromPage` 的 inline if-continue，
但 spec 拆成獨立的 Story-11.2 `filterPagingAndCategories`，導致 story-11.1 的 plan 已經做了 story-11.2 的事。

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| PLAN step-1 跨 story FLOW 重疊偵測 | ⬜ 待做 | P2 | 若兩個 story 的 GEMS-FLOW 有相同 step 名稱，發出 WARN |
| spec 函式表 vs POC 函式清單對齊檢查 | ⬜ 待做 | P2 | 比對 5.5 函式規格表的函式名稱是否全部能在 POC 產物中找到對應 |

---

### M8 — 框架文件收斂 ⬜ 未開始
> 目標：對外說明和內部規格文件保持一致

| 項目 | 狀態 | 優先 | 說明 |
|------|------|------|------|
| SDID_FRAMEWORK_OVERVIEW.md | ⬜ 待做 | P2 | 曾在 30f0c45 新增、bc70dcb 刪除。若需對外說明，建議重建並維護在 docs/ 下 |
| README.md 與實際工具同步 | ⬜ 待確認 | P2 | README 在 bc70dcb 有大量更新，確認 entry point 指令正確 |

---

## 已完成的重要里程碑

| 完成時間 | 內容 |
|---------|------|
| 2026-02-25 | M5: SKILL.md 加入 POC-FIX 模式（POC 已驗證 → 直接移植，跳過 PLAN） |
| 2026-02-25 | M1: blueprint-gate 重複函式修復 |
| 2026-02-25 | M2: spec-parser 5.5 fallback warning |
| 2026-02-25 | feat: 5.5 函式規格表 → spec-parser → plan-generator E2E |
| 2026-02-24 | feat: Blueprint 硬規則強化（VSC 強制 + Demo Checkpoint + AC 效益導向） |
| 2026-02-22 | feat: Cynefin Check 整合進 loop 攔截 |
| 2026-02-21 | feat: VSC gate 整合至 Blueprint + Task-Pipe (phase-1) |
| 舊 | feat: micro-fix-gate.cjs + SKILL.md routing |

---

## 下一個 Session 建議入口

1. **M6-P0**：改 `task-pipe/phases/plan/step-2.cjs`，`generatePlansFromSpec()` 成功後印出所有 story 的指令清單
2. **M1-ACC-002**：在 `blueprint-gate.cjs` 的 `checkACIntegrity` 加入 Then 效益指標的語意掃描
3. **M3**：讀 `blueprint-loop.cjs` + `task-pipe/skills/sdid-loop/scripts/loop.cjs` 確認 Cynefin 攔截時機

---

## 工具快速參考

```bash
# Blueprint route
node sdid-tools/blueprint-gate.cjs --draft=<path> --iter=1

# Task-Pipe route (新專案)
node task-pipe/runner.cjs --phase=POC --step=0 --target=<project>

# Monitor
node sdid-monitor/server.cjs   # http://localhost:3737

# Blueprint loop
node .agent/skills/blueprint-loop/scripts/loop.cjs --project=<path>
```
