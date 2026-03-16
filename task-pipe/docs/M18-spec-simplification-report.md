# M18 — SPEC 產物精簡 + 藍圖整合評估報告

**日期**: 2026-03-13
**狀態**: 分段進行中
**決策**: AC 保留（是動作不只是驗收），TDD 暫不做

---

## 第一段：藍圖樣板（Enhanced Draft）精簡評估

### 現狀

黃金樣板 `enhanced-draft-golden.template.v2.md` 有 12 個主題區塊，
EcoTrack 範例實際產出約 500+ 行。大量註解和重複資訊佔據 context window。

### 逐區塊評估

| # | 區塊 | 判定 | 理由 |
|---|------|------|------|
| 1 | 檔頭 metadata | 保留（精簡） | iter/日期/規模/狀態是機械必要欄位，但「方法論」可刪 |
| 2 | 用戶原始需求 | 保留 | 唯一的需求原文錨點，gate 和 AI 都需要 |
| 3 | 一句話目標 | 合併到 2 | 跟 9 功能模組清單重疊，改成 2 底部加一行 |
| 4 | 模組化設計藍圖 | 保留（重構） | 核心結構，但子區塊需調整 |
| 4.1 | 族群識別 | 保留 | 影響 UI/權限設計，不可刪 |
| 4.2 | 實體定義 | 保留 | CONTRACT 的前身，gate 驗證依賴此 |
| 4.3 | 共用模組 | 合併到 5 | 跟迭代規劃表的 Foundation iter 重複 |
| 4.4 | 獨立模組 | 合併到 5 | 同上，每個 iter 行帶模組 API 摘要即可 |
| 4.5 | 路由結構 | 保留（精簡） | AI 骨架生成需要，但可以從 3 級縮到 2 級 |

| 5 | 迭代規劃表 | 保留（精簡） | 核心排程，但 Blueprint Score 和 Action Budget 長註解移到 gate 文件 |
| 6 | 變異點分析 | 條件保留 | 只有需求含「彈性/可變」時才需要。CYNEFIN=Simple 時整塊跳過 |
| 7 | 模組動作清單 | 保留（精簡） | BUILD 的直接輸入，但 11 欄說明註解比內容長，註解移到 gate 文件 |
| 8 | 驗收條件 (AC) | 保留 | AC 是動作不只是驗收，穿透到 contract → ac.ts → BUILD Phase 2 |
| 9 | 功能模組清單 | 刪除 | 跟 2+3+5 完全重複。「做什麼/不做什麼」合併到 2 底部 |
| 10 | 釐清項目 | 刪除 | 對話過程記錄，不是 AI 實作需要的資訊。使用者角色已在 4.1，核心目標已在 2 |
| 11 | POC 驗證模式 | 刪除 | 只有一行 Level S/M/L，已在 1 檔頭 metadata |
| 12 | 尾部藍圖狀態 | 刪除 | 跟 1 檔頭重複 |

### 精簡後結構（提案）

```
1. 檔頭 metadata（iter/日期/規模/狀態）
2. 用戶原始需求 + 一句話目標 + 不做什麼
3. 模組化設計藍圖
   3.1 族群識別
   3.2 實體定義
   3.3 路由結構（2 級）
4. 迭代規劃表（含模組 API 摘要，取代原 4.3/4.4）
5. 變異點分析（CYNEFIN 非 Simple 時才出現）
6. 模組動作清單（註解移到 gate 文件）
7. 驗收條件 (AC)
```

預估效果: 12 區塊 → 7 區塊，註解量減少 ~60%，context footprint 降低約 40%

### 影響範圍

需要修改的腳本：
- `sdid-tools/lib/draft-parser-standalone.cjs` — 解析器適配新結構
- `sdid-tools/lib/gate-checkers.cjs` — gate 規則適配
- `sdid-tools/prompts/gemini-gem-architect-v2.2.md` — Gem chatbot prompt 更新
- `task-pipe/templates/enhanced-draft-golden.template.v2.md` → v3
- 範例檔案更新

### 不能刪的理由整理

| 區塊 | 為什麼不能刪 |
|------|-------------|
| 族群識別 | 影響 UI 權限設計，gate VSC 規則依賴 |
| 實體定義 | CONTRACT 的前身，gate TAG 規則依賴 |
| 迭代規劃表 | BUILD 排程的唯一來源，state-machine 依賴 |
| 動作清單 | draft-to-plan 的直接輸入，plan 生成依賴 |
| AC | 穿透整個 BUILD 閉環（contract → ac.ts → ac-runner → verify） |

---

## 第二段：SPEC 層定位 — CYNEFIN 決定是否跑

### 現狀分析

目前流程：
```
DRAFT → CONTRACT → AC.ts & POC.html → SPEC(requirement_spec) → PLAN
```

SPEC（requirement_spec_iter-N.md）的角色：
- 需求語句（SHALL/MUST + 分片）
- BDD 驗收標準
- Story 拆分建議
- 可行性評估

### 跟 AC.ts 的重疊

| 資訊 | CONTRACT | AC.ts | SPEC | 重疊？ |
|------|----------|-------|------|--------|
| 型別定義 | 主要 | — | 部分 | CONTRACT vs SPEC |
| 行為契約 (WHEN/THEN) | — | 主要 | BDD | AC.ts vs SPEC |
| 模組介面 | interface | — | — | 無 |
| 可執行驗收 | — | ac-runner | 純文字 | — |
| 跨 iter 累積 | per-iter | per-iter | 可累積 | SPEC 獨有 |
| Story 拆分 | — | — | 有 | SPEC 獨有 |

### 決策規則

```
CYNEFIN = Simple / Obvious（單 iter 小功能）
  → DRAFT → CONTRACT → AC.ts & POC.html → PLAN
  → 跳過 SPEC，AC.ts 直接到 PLAN，完全夠用

CYNEFIN = Complicated / Complex（多 iter 中大型功能）
  → DRAFT → CONTRACT → AC.ts & POC.html → SPEC → PLAN
  → SPEC 從 AC.ts + DRAFT 自動生成（不是另外手寫）
  → 提供跨 iter 可追蹤的規格記錄
```

### 實作方式

SPEC 自動生成而非手寫：
- 輸入：AC.ts 的 @GEMS-AC 區塊 + DRAFT 的用戶需求 + 動作清單
- 輸出：requirement_spec_iter-N.md（機械轉換，零 AI 推導）
- 時機：POC step-5 或 PLAN step-2 自動觸發
- 好處：不多做事，但有了跨 iter 可追蹤的規格記錄

### 對 task-pipe 的影響

- POC step-5 改為條件觸發（CYNEFIN 結果決定）
- 新增 `spec-generator.cjs`（從 AC.ts 機械生成 SPEC）
- PLAN step-2 的 spec 讀取改為 optional

---

## 第三段：OpenSpec 精神借鑑

### OpenSpec 核心架構

```
schema.yaml 定義 artifact 依賴圖：
  proposal → specs → design → tasks → apply

每個 change = 一個獨立的修改單元：
  changes/<name>/
    .openspec.yaml    ← metadata
    proposal.md       ← WHY（動機）
    specs/**/*.md     ← WHAT（需求，delta 格式）
    design.md         ← HOW（技術設計）
    tasks.md          ← DO（實作清單，checkbox 追蹤）

主 spec = source of truth（累積）：
  openspec/specs/<capability>/spec.md
  → archive 時 delta merge 回主 spec
```

### SDID vs OpenSpec 對照

| OpenSpec | SDID 對應 | 差異 |
|----------|----------|------|
| proposal.md | Enhanced Draft 用戶需求 | SDID 更重（含模組設計） |
| specs/*.md (delta) | requirement_spec（目前可選） | OpenSpec 有累積機制 |
| design.md | Enhanced Draft 模組設計 + 變異點 | SDID 合在 draft 裡 |
| tasks.md | implementation_plan_Story-X.Y.md | SDID 更細（GEMS 標籤） |
| apply | BUILD Phase 1-4 | SDID 有 gate 機制 |
| archive | SCAN / VERIFY | SDID 有 shrink+verify |

### 可借鑑的精神

1. **Artifact 依賴圖（DAG）— 暫不採用**
   - OpenSpec 用 schema.yaml 定義 artifact 順序，Kahn's Algorithm 拓撲排序
   - SDID 目前是硬編碼的 phase 順序（POC→PLAN→BUILD→SCAN）
   - ⚠️ 決策：DAG 不做。OpenSpec 的 schema.yaml 是靜態定義，無法支援 SDID 的條件跳過（如 prototype/quick-build 跳過 SPEC）。SDID 的 CYNEFIN 動態路線選擇比靜態 DAG 更適合
   - 只做 TAG（GEMS 標籤體系強化），不做 DAG 依賴圖

2. **Delta Spec 累積**
   - OpenSpec 的 ADDED/MODIFIED/REMOVED/RENAMED 語意
   - SDID 目前每個 iter 的 draft 是獨立的，沒有累積
   - 借鑑：SPEC 層（如果啟用）用 delta 格式累積到主 spec

3. **Change 隔離**
   - OpenSpec 每個 change 是獨立目錄，互不干擾
   - SDID 的 iter 已經有類似概念（.gems/iterations/iter-N/）
   - 現狀已足夠，不需要改

4. **Context + Rules 注入**
   - OpenSpec 的 config.yaml 有 context（技術棧）和 rules（per-artifact 規則）
   - SDID 的 steering files + SKILL.md 已經做到類似效果
   - 現狀已足夠

### 不需要借鑑的部分

- OpenSpec 的 CLI 工具鏈（SDID 已有 MCP + runner）
- OpenSpec 的 AI 工具適配器（SDID 用 skill 系統）
- OpenSpec 的 telemetry（不需要）
- OpenSpec 的 parallel merge 問題（SDID 的 iter 是線性的，不會並行）

---

## 第四段：藍圖工具整合到 task-pipe 的可行性

### 現狀

藍圖工具分散在兩個目錄：
```
sdid-tools/blueprint/
  gate.cjs, draft-to-plan.cjs, contract-writer.cjs,
  shrink.cjs, expand.cjs, verify.cjs

sdid-tools/lib/
  draft-parser-standalone.cjs, gate-checkers.cjs,
  gate-report.cjs, gate-score.cjs, consolidation-parser.cjs

task-pipe/
  runner.cjs, phases/build/, phases/poc/, phases/plan/, phases/scan/
```

### 整合方案

目標：取消 sdid-tools/blueprint/ 作為獨立工具，整合到 task-pipe 的 phase 體系。

```
task-pipe/
  runner.cjs                    ← 統一入口（擴展支援 GATE/PLAN-GEN/SHRINK/VERIFY）
  phases/
    gate/                       ← 新增：從 sdid-tools/blueprint/ 搬入
      gate.cjs                  ← blueprint-gate
      contract.cjs              ← contract-writer
    plan-gen/                   ← 新增：從 sdid-tools/blueprint/ 搬入
      draft-to-plan.cjs         ← draft-to-plan + plan-to-scaffold
    poc/                        ← 不變
    plan/                       ← 不變（Task-Pipe 路線用）
    build/                      ← 不變
    scan/                       ← 不變
    shrink/                     ← 新增
      shrink.cjs
    verify/                     ← 新增
      verify.cjs
    expand/                     ← 新增
      expand.cjs
  lib/
    blueprint/                  ← 新增：從 sdid-tools/lib/ 搬入
      draft-parser.cjs
      gate-checkers.cjs
      gate-report.cjs
      gate-score.cjs
    build/                      ← 不變
    plan/                       ← 不變
    scan/                       ← 不變
    shared/                     ← 不變
```

### 統一入口

整合後 runner.cjs 擴展：
```bash
# Blueprint Flow（新增）
node task-pipe/runner.cjs --phase=GATE --target=<project>
node task-pipe/runner.cjs --phase=PLAN-GEN --target=<project> --iter=N
node task-pipe/runner.cjs --phase=SHRINK --target=<project> --iter=N
node task-pipe/runner.cjs --phase=VERIFY --target=<project> --iter=N
node task-pipe/runner.cjs --phase=EXPAND --target=<project> --iter=N

# 既有（不變）
node task-pipe/runner.cjs --phase=POC --step=N --target=<project>
node task-pipe/runner.cjs --phase=PLAN --step=N --target=<project>
node task-pipe/runner.cjs --phase=BUILD --step=N --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=SCAN --target=<project>
```

### 可行性評估

| 面向 | 評估 | 說明 |
|------|------|------|
| 技術可行性 | 高 | 藍圖工具已經 import task-pipe 的 log-output、plan-validator，依賴方向正確 |
| 向後相容 | 中 | MCP adapter 的路徑需要更新（loop.mjs 等），state-machine 的路線偵測不受影響 |
| 工作量 | 中 | 搬移 ~10 個檔案 + 更新 ~15 個 require 路徑 + MCP adapter 路徑 |
| 風險 | 中 | 搬移過程中 require 路徑容易出錯（之前 Wave 1-5 重構已有經驗） |
| 收益 | 高 | 統一入口、統一 phase-registry、統一 log 格式、減少認知負擔 |

### 整合步驟（建議）

```
Wave 1: 搬移 lib（低風險）
  - sdid-tools/lib/draft-parser-standalone.cjs → task-pipe/lib/blueprint/
  - sdid-tools/lib/gate-checkers.cjs → task-pipe/lib/blueprint/
  - sdid-tools/lib/gate-report.cjs → task-pipe/lib/blueprint/
  - sdid-tools/lib/gate-score.cjs → task-pipe/lib/blueprint/
  - 更新 require 路徑
  - 跑測試

Wave 2: 搬移 phases（中風險）
  - sdid-tools/blueprint/gate.cjs → task-pipe/phases/gate/
  - sdid-tools/blueprint/draft-to-plan.cjs → task-pipe/phases/plan-gen/
  - sdid-tools/blueprint/contract-writer.cjs → task-pipe/phases/gate/
  - sdid-tools/blueprint/shrink.cjs → task-pipe/phases/shrink/
  - sdid-tools/blueprint/verify.cjs → task-pipe/phases/verify/
  - sdid-tools/blueprint/expand.cjs → task-pipe/phases/expand/
  - 更新 runner.cjs phase-registry
  - 更新 MCP adapter 路徑

Wave 3: 清理（低風險）
  - sdid-tools/blueprint/ 目錄刪除或留 redirect
  - 更新 ARCHITECTURE.md
  - 更新 steering files
  - 更新 SKILL.md 路徑引用
```

### sdid-tools 整合後剩餘

整合後 sdid-tools/ 只剩：
```
sdid-tools/
  mcp-server/          ← MCP 入口（保留，只改 adapter 路徑）
  poc-fix/             ← POC-FIX / MICRO-FIX（可考慮也搬入 task-pipe）
  ac-runner.cjs        ← AC 執行器（BUILD Phase 2 依賴）
  state-guide.cjs      ← AI session 入口
  cynefin-log-writer.cjs
  plan-to-scaffold.cjs ← 已被 draft-to-plan 內建，可 deprecate
  poc-to-scaffold.cjs  ← POC-FIX 用
  prompts/             ← Gem chatbot prompt
```

長期可考慮把 ac-runner、poc-fix 也搬入 task-pipe，
讓 sdid-tools 只剩 mcp-server + prompts + state-guide。
---

## 第五段：Blueprint vs Task-Pipe Story 產出量差異根因分析

### 現象

| 路線 | 專案範例 | 單 iter Story 數 | 每 Story 動作數 |
|------|---------|-----------------|----------------|
| Task-Pipe | my_workflow | 7 (Story-1.0~1.6) | 2~4 |
| Blueprint | test-blueprint-flow | 1 (Story-1.0) | 4~6 |

同樣是 Level M 專案，Task-Pipe 路線在一個 iter 裡切出 7 個 Story，Blueprint 只有 1 個。

### 根因分析

#### 瓶頸 1：draft-to-plan 的 module→Story 1:1 映射

`draft-to-plan.cjs` 的核心邏輯：

```javascript
// getModulesByIter() 按 iter 篩選模組
const modules = parser.getModulesByIter(draft, args.iter);

// 每個模組 = 一個 Story
for (const mod of modules) {
  const storyId = `Story-${args.iter}.${storyIndex}`;
  const planContent = generatePlan(draft, args.iter, storyIndex, mod.id, mod.actions);
  storyIndex++;
}
```

問題：**迭代規劃表中每個 iter 通常只有 1~2 個模組**（因為 VSC-004 垂直切片原則要求一個 iter = 一個完整業務垂直切片），所以 Story 數 = 模組數 = 1~2。

#### 瓶頸 2：Enhanced Draft 的 11 欄動作表格佔滿 context

黃金樣板的動作清單是 11 欄表格：

```
| 業務語意 | 類型 | 技術名稱 | Signature | P | 流向 | 依賴 | 操作 | 狀態 | 演化 | AC |
```

一個模組 6 個動作 × 11 欄 = 大量 token。加上 AC 區塊（每個 AC 有 DOMAIN/ERROR_RETURNS/Happy/Edge/Failure），一個 iter 的完整展開就已經接近 AI 單次產出上限。

#### 瓶頸 3：draft 同時承擔「設計」和「規劃」兩個角色

Enhanced Draft 既是設計文件（模組結構、實體定義、路由），又是執行規劃（動作清單、AC）。這導致：
- 設計部分（~200 行）+ 規劃部分（~300 行）= 500+ 行
- AI 在一次 context 中無法同時處理多個模組的完整展開
- 所以 expand 只能一次展開一個 [STUB] 模組

#### 對比：Task-Pipe 路線為什麼能切多個 Story

my_workflow 的 Spec（requirement_spec_iter-1.md）：
- 每個 Story 只有：目標 + 範圍 + AC（Gherkin）+ 檔案清單
- 沒有 11 欄動作表格、沒有 Signature、沒有 GEMS-FLOW
- 每個 Story 約 30~40 行，7 個 Story 總共 ~250 行
- **Spec 做了 Story 細分的工作，plan-generator 只需要 1:1 轉換**

my_workflow 的 Draft（requirement_draft_iter-1.md）：
- 只有 ~100 行（需求 + 釐清 + 技術規格）
- 不含動作清單、不含 AC 細節
- **Draft 只負責「說清楚要做什麼」，不負責「怎麼切 Story」**

### 根因總結

```
Blueprint 路線：
  Draft (設計+規劃, 500行) → draft-to-plan (module=Story) → 1 Story/iter
  ↑ 瓶頸：Draft 太重，module→Story 1:1 綁定

Task-Pipe 路線：
  Draft (需求, 100行) → Spec (Story 細分, 250行) → plan-generator → 7 Stories/iter
  ↑ 優勢：Spec 層做了 Story 拆分，Draft 保持輕量
```

**核心差異：Blueprint 缺少一個「Story 細分」的中間層。**

---

## 第六段：流程重構提案 — 插入 Spec 層做 Story 細分

### 提案流程

```
draft (iter 分) → contract-iter-N → spec-iter-N (細分 Story) → spec-to-plan → BUILD (ac test) → verify
```

### 與現行流程對比

```
現行 Blueprint:
  draft → gate → contract → draft-to-plan (1 Story) → BUILD → verify
                                    ↑ 瓶頸

提案流程:
  draft → gate → contract → spec (多 Story) → spec-to-plan (N Stories) → BUILD → verify
                                    ↑ 新增：Story 細分層
```

### 每個階段的職責重新定義

| 階段 | 產物 | 職責 | Context 大小 |
|------|------|------|-------------|
| Draft | enhanced-draft.md | 全局設計（模組、實體、路由、iter 規劃） | ~300 行（精簡後） |
| Gate | gate log | 驗證 draft 結構完整性 | 不產出文件 |
| Contract | contract_iter-N.ts | 型別定義 + API 介面 + AC 期望值 | ~100 行/iter |
| **Spec (新)** | spec_iter-N.md | **Story 細分 + 每 Story 範圍 + AC 對應** | ~150 行/iter |
| Spec-to-Plan | implementation_plan_Story-X.Y.md | 機械轉換（Spec Story → Plan） | ~50 行/Story |
| BUILD | 原始碼 | Phase 1-4 實作 | per Story |
| Verify | verify log | 驗證完整性 | 不產出文件 |

### Spec 層的具體格式

Spec 從 contract + draft 的動作清單機械生成，負責 Story 拆分：

```markdown
# Spec iter-1

## Story-1.0: 基礎建設
**範圍**: CoreTypes, ENV_CONFIG
**AC**: AC-0.0, AC-0.1
**檔案**:
| 檔案 | 動作 | 來源 |
|------|------|------|
| src/config/core-types.ts | New | contract CoreTypes |
| src/config/env-config.ts | New | contract ENV_CONFIG |

## Story-1.1: 服務層
**範圍**: ServiceA, ServiceB
**AC**: AC-1.0, AC-1.1
**檔案**:
| 檔案 | 動作 | 來源 |
|------|------|------|
| src/modules/X/service-a.ts | New | contract IServiceA |
| src/modules/X/service-b.ts | New | contract IServiceB |

## Story-1.2: UI 層
...
```

### Story 拆分規則（機械化）

從 draft 的動作清單自動拆分：

1. **Story-X.0**: 所有 CONST/LIB 類型動作（基礎建設）
2. **Story-X.1~N**: 按模組的 publicAPI 分組，每組 SVC+API 動作 = 一個 Story
3. **Story-X.(N+1)~M**: 每組 UI/ROUTE/HOOK 動作 = 一個 Story
4. 每個 Story 不超過 6 個動作（超過就再拆）

這個規則可以寫成腳本（`spec-generator.cjs`），零 AI 推導。

### 對現有工具鏈的影響

| 工具 | 變更 | 工作量 |
|------|------|--------|
| draft-to-plan.cjs | 改名為 spec-to-plan.cjs，輸入從 draft 改為 spec | 中 |
| contract-writer.cjs | 不變（contract 仍然從 draft 生成） | 無 |
| gate.cjs | 不變（gate 仍然驗 draft） | 無 |
| **新增 spec-generator.cjs** | 從 contract + draft 動作清單生成 spec | 新建 |
| ac-runner.cjs | 不變（AC 仍然在 contract 裡） | 無 |
| verify.cjs | 不變 | 無 |
| loop.mjs | 更新流程：gate → contract → spec → plan → BUILD | 小 |
| state-machine.cjs | 新增 SPEC 狀態節點 | 小 |

### 預期效果

| 指標 | 現行 | 提案後 |
|------|------|--------|
| 單 iter Story 數 | 1~2 | 3~7 |
| 每 Story context 大小 | ~300 行 plan | ~50 行 plan |
| AI 單次產出壓力 | 高（整個模組） | 低（單個 Story） |
| 骨架生成精準度 | 中（module 粒度） | 高（Story 粒度） |
| 與 Task-Pipe 路線一致性 | 低（不同 plan 格式） | 高（共用 spec→plan 路徑） |

### 實作優先級

```
Phase 1: spec-generator.cjs（核心，解決 Story 拆分問題）
Phase 2: spec-to-plan.cjs（改造 draft-to-plan，讀 spec 而非 draft）
Phase 3: loop.mjs 流程更新（串接新步驟）
Phase 4: state-machine 新增 SPEC 節點
```

---

## 第七段：新流程與現有 loop/runner 配適度評估

### 提案流程（精煉版）

```
Blueprint 前段:  draft → gate → cynefin → contract + poc.html/ac
                                              ↓
主流程匯入:                              spec (Story 細分) → spec-to-plan → BUILD 1-4 → SCAN → verify
```

核心思路：Blueprint 階段負責產 draft 和 contract，然後轉入主流程（Task-Pipe 的 spec→plan→BUILD 路徑）。

### loop.mjs 配適度分析

現行 loop.mjs 的 switch/case 結構：

```
GATE → CYNEFIN_CHECK → CONTRACT → PLAN → BUILD → SCAN → VERIFY → COMPLETE
```

新流程需要在 CONTRACT 和 PLAN 之間插入 SPEC 節點：

```
GATE → CYNEFIN_CHECK → CONTRACT → SPEC → PLAN → BUILD → SCAN → VERIFY → COMPLETE
```

配適度評估：

| 面向 | 評估 | 說明 |
|------|------|------|
| switch/case 擴展 | 簡單 | 加一個 `case 'SPEC':` 即可，跟 CONTRACT 的模式一樣（AI 產出 → 腳本驗證） |
| state-machine 推斷 | 簡單 | `inferStateFromLogs()` 加一條規則：`contract-pass` 存在但 `spec-pass` 不存在 → phase=SPEC |
| forceStart 支援 | 簡單 | phaseMap 加 `'SPEC': 'SPEC'` |
| route 偵測 | 不變 | Blueprint 路線偵測邏輯不受影響（看 draft 有無 spec 來判斷） |

loop.mjs 新增的 case 大約長這樣：

```javascript
case 'SPEC': {
  // spec 不存在 → @TASK 讓 AI 從 contract + draft 動作清單生成
  // spec 存在 → 跑 spec-validator 驗證格式
  const specPath = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'poc', `requirement_spec_iter-${iterNum}.md`);
  if (fs.existsSync(specPath)) {
    result = await runCli('spec-validator.cjs', [`--spec=${specPath}`, `--target=${projectRoot}`]);
  } else {
    // 輸出 @TASK：從 contract + draft 動作清單機械生成 spec
    lines.push('@TASK');
    lines.push('ACTION: 從 contract 動作清單生成 spec（Story 細分）');
    lines.push(`FILE: ${specPath}`);
  }
  break;
}
```

工作量：~30 行新增，零破壞性。

### state-machine.cjs 配適度分析

`inferStateFromLogs()` 的推斷邏輯是線性掃描 log 檔名前綴。新增 SPEC 節點只需要：

```javascript
// 在 contract-pass 判斷之後加：
if (has('contract-pass-') && !has('spec-pass-')) {
  return { phase: 'SPEC', step: null, story: null };
}
if (has('spec-pass-')) {
  // spec 通過 → 進 PLAN（或直接進 BUILD，如果 spec-to-plan 也自動跑了）
  return { phase: 'PLAN', step: null, story: null };
}
```

`detectRoute()` 不需要改 — 新流程仍然是 Blueprint 路線（有 draft 就是 Blueprint），只是 Blueprint 路線內部多了一個 SPEC 步驟。

`buildNextCommand()` 加一個 case：

```javascript
case 'SPEC': return `node sdid-tools/spec-generator.cjs --target=${projectRoot} --iter=${iterNum}`;
```

工作量：~10 行修改。

### runner.cjs / phase-registry.json 配適度分析

runner.cjs 本身不需要改 — 它只處理 POC/PLAN/BUILD/SCAN 四個 phase。
SPEC 節點是 Blueprint 前段的一部分，由 loop.mjs 直接處理（跟 GATE/CONTRACT 一樣）。

但 `phase-registry.json` 的 `flowSequence` 可以更新，讓 Task-Pipe 路線也受益：

```json
{
  "flowSequence": [
    { "phase": "POC", "step": "1" },
    { "phase": "POC", "step": "2" },
    { "phase": "POC", "step": "3" },
    { "phase": "POC", "step": "4" },
    { "phase": "POC", "step": "5" },
    { "phase": "SPEC_TO_PLAN", "step": "run" },
    { "phase": "BUILD", "step": "1" },
    ...
  ]
}
```

這個已經有了（`SPEC_TO_PLAN`），所以 Task-Pipe 路線的 spec→plan 路徑不需要改。

### spec-to-plan.cjs 配適度分析

現有 `task-pipe/tools/spec-to-plan.cjs` 已經能從 spec 生成 plan。
Blueprint 路線的 SPEC 產物格式只要跟 Task-Pipe 的 spec 格式對齊，就能直接複用。

關鍵對齊點：

| Spec 欄位 | Task-Pipe 格式 | Blueprint SPEC 需要 |
|-----------|---------------|-------------------|
| Story ID | `### Story-X.Y: 標題` | 相同 |
| 範圍 | `**範圍**: 函式列表` | 相同 |
| AC | `**驗收標準 (AC-X.Y)**:` + Gherkin | 相同（從 contract AC 帶入） |
| 檔案清單 | 表格（檔案/動作/GEMS 標籤） | 相同（從 draft 動作清單帶入） |

只要 `spec-generator.cjs` 產出的格式跟 my_workflow 的 spec 一致，
`spec-to-plan.cjs` 就能零修改直接吃。

### 匯流點分析

```
Blueprint 擴充前段:                Task-Pipe POC 前段:
  draft → gate → cynefin             draft → POC 1-5
  → contract + poc.html/ac           → spec (POC step 5 產出)
  → spec-generator (新)                    ↓
         ↓                                 ↓
         ↓                                 ↓
    spec_iter-N.md  ←←←←←←←←←←←←  spec_iter-N.md
         ↓                                 ↓
    ─────────── 主幹（共用）──────────────
         ↓                                 ↓
    spec-to-plan (共用)  ←←←←←←←←  spec-to-plan (共用)
         ↓                                 ↓
    BUILD 1-4 (共用)                  BUILD 1-4 (共用)
         ↓                                 ↓
    SCAN → VERIFY (共用)              SCAN → VERIFY (共用)
```

兩個前段在 spec 層匯入主幹，之後完全共用。主幹只有一條路。

### 風險評估

| 風險 | 等級 | 緩解 |
|------|------|------|
| spec-generator 產出格式不對齊 | 低 | 用 my_workflow spec 當 golden sample 對照 |
| contract→spec 資訊遺失 | 低 | spec 只做 Story 分組，不刪減 contract 資訊 |
| loop.mjs SPEC case 跟 CONTRACT case 衝突 | 極低 | 兩者是線性順序，不會並行 |
| 既有 Blueprint 專案回溯相容 | 中 | 舊專案沒有 spec-pass log，state-machine 會 fallback 到 PLAN |
| draft-to-plan.cjs 廢棄影響 | 低 | 保留但 deprecate，loop.mjs 改走 spec→plan 路徑 |

### 配適度總結

| 元件 | 改動量 | 破壞性 |
|------|--------|--------|
| loop.mjs | +30 行（新 case） | 零 |
| state-machine.cjs | +10 行（推斷規則） | 零 |
| runner.cjs | 不改 | — |
| phase-registry.json | 不改（已有 SPEC_TO_PLAN） | — |
| spec-to-plan.cjs | 不改（格式對齊即可） | — |
| **新增 spec-generator.cjs** | ~150 行 | 新檔案 |
| draft-to-plan.cjs | deprecate（保留） | 零 |

總改動量：~200 行新增/修改，零破壞性。核心工作就是寫 `spec-generator.cjs`。

---

## 第八段：Blueprint = Task-Pipe 擴充 — 架構定位

### 核心洞察

Task-Pipe 是主幹，Blueprint 是它的擴充模組。不是兩條獨立路線，是一條主幹加一個前段擴充。

```
Task-Pipe 主幹（所有專案都走）:
  spec → plan → BUILD 1-4 → SCAN → VERIFY

Blueprint 擴充（大型專案選用）:
  draft → gate → cynefin → contract + poc.html/ac → spec-generator
                                                        ↓
                                                   匯入主幹 spec
```

### 為什麼是「擴充」不是「路線」

| 面向 | 「兩條路線」思維 | 「主幹+擴充」思維 |
|------|----------------|-----------------|
| 架構複雜度 | 兩套 flow，匯流點模糊 | 一套 flow，擴充點明確 |
| 維護成本 | 兩套 plan 格式、兩套 state 推斷 | 一套 spec→plan，擴充只加前段 |
| 認知負擔 | 使用者要選路線 | 使用者只決定「要不要跑 Blueprint 前段」 |
| 程式碼重用 | spec-to-plan 要兼容兩種輸入 | spec-to-plan 只吃一種格式 |

### Blueprint 擴充的價值

Blueprint 的獨特價值是**一次產出全部 iter 的全局設計**：
- 模組結構（哪些模組、怎麼分）
- 實體定義（全局 contract，跨 iter 一致）
- 路由結構（全局 URL 規劃）
- 迭代規劃（哪個 iter 做什麼）

這些是 Task-Pipe 的 POC 階段做不到的（POC 只看當前 iter）。

### 分片問題：Draft → per-iter Spec

Blueprint 產出的是全局設計，但主幹需要的是 per-iter spec。中間需要「分片」：

```
全局 Draft
  ├── iter-1 動作 → contract_iter-1.ts → spec_iter-1.md (Story 細分)
  ├── iter-2 動作 → contract_iter-2.ts → spec_iter-2.md (Story 細分)
  └── iter-3 動作 → contract_iter-3.ts → spec_iter-3.md (Story 細分)
```

分片的三個子任務：

| 子任務 | 輸入 | 輸出 | 性質 |
|--------|------|------|------|
| 動作分組 | draft 動作表（per-module per-iter） | per-Story 動作組 | 機械（CONST→Story-0, SVC→Story-1, UI→Story-2） |
| Contract 子集 | 全局 contract entities | per-iter contract | 機械（按 iter 篩選 entity） |
| AC 對應 | 全局 AC 區塊 | per-Story AC | 機械（AC 跟著動作走） |

三個子任務都是**確定性的機械操作**（零 AI 推導），寫一次 `spec-generator.cjs` 就永久複用。

### 對 loop.mjs 的影響

loop.mjs 的 Blueprint 路線只需要在 CONTRACT 之後加一步 SPEC：

```
現行: GATE → CYNEFIN → CONTRACT → PLAN → BUILD → ...
改後: GATE → CYNEFIN → CONTRACT → SPEC → PLAN → BUILD → ...
                                    ↑
                          spec-generator.cjs 機械生成
                          然後匯入主幹的 spec→plan 路徑
```

Task-Pipe 路線完全不受影響（POC step-5 已經產 spec）。

### 對 ARCHITECTURE.md 的影響

ARCHITECTURE.md v5.0 的「四條路線」描述需要更新：

```
現行:
  路線 A: Blueprint Flow（主線）
  路線 B: POC-FIX
  路線 C: MICRO-FIX
  路線 D: Task-Pipe Flow（備用）

建議更新:
  主幹: Task-Pipe Flow（spec → plan → BUILD → SCAN → VERIFY）
  擴充 A: Blueprint 前段（draft → gate → contract → spec-generator → 匯入主幹）
  擴充 B: POC 前段（POC 1-5 → spec → 匯入主幹）
  快修 C: POC-FIX / MICRO-FIX（不走主幹）
```

這個更新不急，等 spec-generator.cjs 實作完再改。

---

## 總結

| 項目 | 決策 | 優先級 |
|------|------|--------|
| M18 描述更新 | 已完成 | — |
| 藍圖樣板精簡 | 12→7 區塊，註解移到 gate 文件 | 中 |
| SPEC 層定位 | CYNEFIN 決定是否跑，啟用時自動生成 | 低 |
| 藍圖整合到 task-pipe | 3 波搬移，統一 runner 入口 | 中 |
| OpenSpec 借鑑 | TAG 標籤強化（DAG 不做） | 低 |
| Story 產出量瓶頸 | draft-to-plan 的 module→Story 1:1 映射是根因 | 高 |
| 流程重構提案 | draft→contract→spec(Story 細分)→plan→BUILD | 高 |
| loop/runner 配適度 | ~200 行改動，零破壞性，兩條路線在 spec 層匯流 | 高 |
| **Blueprint = Task-Pipe 擴充** | **主幹+擴充取代雙路線，spec-generator 是唯一新增** | **高（架構定位）** |
