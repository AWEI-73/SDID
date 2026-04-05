# SDID 重構計畫

> 目標：把現有 SDID 從「多腳本、多狀態」整理成一個可重用的 workflow harness。
>
> 原則：
> - 不重寫，先重構
> - 以現有腳本慢慢組合
> - Node-only，未來可承載 GAS
> - `task-pipe` 負責執行，`sdid-tools` 負責 gate / 轉換，`sdid-core` 負責狀態推斷，`sdid-monitor` 負責觀測與 hub 更新

---

## 1. 這次重構的目的

這次不是要把 SDID 做得更大，而是把它收斂成一個真正可重用的 workflow framework。

我現在要解的問題只有三個：

1. 讓 AI 只靠 `task bucket + log + state` 就能繼續跑。
2. 讓 `tag / contract / scan / log / guide / blueprint` 的語意對齊。
3. 讓現有腳本能逐步拼成 harness，而不是互相打架。

---

## 2. 目前可用的主線

現階段 SDID 的主要來源文件與協定如下：

- `ARCHITECTURE.md`
- `ROADMAP.md`
- `task-pipe/docs/FULL_OUTPUT_REFERENCE_v3.md`
- `task-pipe/docs/HOW-IT-WORKS.md`
- `task-pipe/docs/modular-architecture-guide.md`
- `task-pipe/docs/plan-schema.md`
- `sdid-monitor/hub.json`
- `sdid-monitor/update-hub.cjs`

這些文件一起構成現在的「流程語意、輸出協定、狀態匯聚」。

---

## 3. 重構路線

### Phase 1: 凍結語意

先固定每個層的角色，不急著改實作。

- `tag` 是行為語義，不是裝飾
- `scan` 的輸出是規格摘要
- `log` 是執行證據與下一步指示
- `guide` 是導引，不是實作
- `contract` 是流程契約，不只是某個檔案格式
- `blueprint` 是上位規劃，不是可選備註

### Phase 2: 腳本分層

把現有腳本切成六層：

- 核心協調層
- Gate 驗證層
- Runner 執行層
- Scan / Backfill 層
- Monitor / 觀測層
- Legacy / 過渡層

### Phase 3: Harness 化

建立唯一協調入口：

1. 讀 state
2. 讀 log
3. 讀 memory
4. 決定 next command
5. 呼叫 runner
6. 回填 blueprint / memory / docs

### Phase 4: 漸進替換

舊腳本不一次砍掉，而是：

- 能包就包
- 能轉就轉
- 不能用的才退場

---

## 4. 腳本角色定義

### 4.1 `sdid-core/`

這層是狀態與架構核心。

| 檔案 | 角色 | 定義 |
|---|---|---|
| `state-machine.cjs` | 狀態推斷核心 | 從 logs / state / artifacts 推斷目前 route 與下一步 |
| `architecture-contract.cjs` | 架構約束核心 | 定義系統層級邊界、規則、禁止事項 |
| `orchestrator.cjs` | 協調器 / harness 雛形 | 串起 state 推斷、runner、回溯與下一步 |

---

### 4.2 `sdid-tools/`

這層是 Gate / 設計 / 轉換工具層。

#### 協助設計與同步

| 檔案 | 角色 | 定義 |
|---|---|---|
| `state-guide.cjs` | 狀態導引器 | 輸出目前狀態與下一步指令 |
| `sync-skills.cjs` | skill 同步器 | 同步 `.agent / .claude / .kiro / .codex` 的 skill 版本 |
| `cynefin-log-writer.cjs` | 語意分類記錄器 | 將 action / domain / needsTest 寫入決策記錄 |

#### Blueprint / Contract / Plan 轉換

| 檔案 | 角色 | 定義 |
|---|---|---|
| `blueprint/contract-writer.cjs` | 合約撰寫器 | 根據設計結果產出 contract 草稿 |
| `blueprint/verify.cjs` | 設計驗證器 | 驗證 draft / 實作 / contract 一致性 |
| `blueprint/v5/blueprint-gate.cjs` | Blueprint gate | 驗證 blueprint 是否可進下一步 |
| `blueprint/v5/draft-gate.cjs` | Draft gate | 驗證 draft 是否足以進 contract |
| `blueprint/v5/contract-gate.cjs` | Contract gate | 驗證 contract 是否可封版 |
| `blueprint/v5/poc-gate.cjs` | POC gate | 驗證 POC 類流程產物 |
| `blueprint/v5/adversarial-reviewer.cjs` | 對抗審查器 | 壓測設計缺陷、誤導與漏點 |

#### POC / Micro-fix

| 檔案 | 角色 | 定義 |
|---|---|---|
| `poc-fix/micro-fix-gate.cjs` | 局部驗收 gate | 小範圍修補與驗收 |
| `poc-to-scaffold.cjs` | POC 轉骨架 | 把 consolidation log 落地成骨架 |
| `plan-to-scaffold.cjs` | Plan 轉骨架 | 由 plan 生成初始 code scaffold |
| `ac-runner.cjs` | 驗收/協作 runner | 輔助執行器 |

#### Lib 支援層

| 檔案 | 角色 | 定義 |
|---|---|---|
| `lib/consolidation-parser.cjs` | 匯整解析器 | 讀 POC / consolidation 類輸入 |
| `lib/draft-parser-standalone.cjs` | Draft 解析器 | 抽 draft 結構成可處理格式 |
| `lib/gate-checkers.cjs` | Gate 檢查器集合 | 各種 gate 的共用檢查函式 |
| `lib/gate-report.cjs` | Gate 報告器 | 將 gate 結果標準化輸出 |
| `lib/gems-scanner-v2.cjs` | 舊版掃描器 | 舊掃描流程或過渡工具 |
| `lib/decision-log.cjs` | 決策記錄器 | 記錄 route / blocker / why |

---

### 4.3 `sdid-tools/mcp-server/`

這層是 MCP 對外入口層。

| 檔案 | 角色 | 定義 |
|---|---|---|
| `index.mjs` | MCP server 主入口 | 對外暴露 tools |
| `adapters/loop.mjs` | loop adapter | 把 loop / route 決策包成 MCP 呼叫 |
| `adapters/runners.mjs` | runner adapter | 把 runner 變成 MCP tool |
| `adapters/cli-tools.mjs` | CLI adapter | blueprint-gate / shrink / expand 等 CLI tool 封裝 |
| `adapters/data-tools.mjs` | 資料工具 adapter | state-guide / scanner 等資料讀取工具 |
| `adapters/state-guide.mjs` | state guide adapter | 狀態導引輸出 |
| `adapters/test-runner.mjs` | 測試執行 adapter | 用於 eval / dryrun / 迴圈測試 |
| `adapters/init-test-project.mjs` | 測試專案初始化 | 給 eval / fixture 用 |
| `adapters/audit-report.mjs` | 稽核報告 adapter | 封裝 audit / report 類輸出 |

MCP tools 角色：

- `sdid-loop`：主循環入口
- `sdid-build`：跑 BUILD / PLAN / SCAN
- `sdid-scanner`：掃描與 tag 收集
- `sdid-blueprint-gate`：blueprint gate
- `sdid-draft-to-plan`：draft 轉 plan
- `sdid-expand` / `sdid-shrink`：blueprint 演進
- `sdid-verify`：驗證
- `sdid-micro-fix-gate`：局部修補

---

### 4.4 `task-pipe/`

這層是實際執行引擎。

#### 主入口

| 檔案 | 角色 | 定義 |
|---|---|---|
| `runner.cjs` | 主 runner | 根據 phase / step / story 驅動全流程 |

#### Phase 實作

| 檔案 | 角色 | 定義 |
|---|---|---|
| `phases/build/phase-1.cjs` | BUILD Phase 1 | plan 結構與 target mapping 驗證 |
| `phases/build/phase-2.cjs` | BUILD Phase 2 | TDD 測試與最小修復 |
| `phases/build/phase-3.cjs` | BUILD Phase 3 | exports / type / `tsc --noEmit` |
| `phases/build/phase-4.cjs` | BUILD Phase 4 | scan / tag / docs 回填 |
| `phases/scan/scan.cjs` | SCAN phase | 產出 docs / function inventory |
| `phases/review/review.cjs` | REVIEW phase | 回顧 / 驗證 / 補強 |

#### 共享核心

| 檔案 | 角色 | 定義 |
|---|---|---|
| `lib/shared/log-output.cjs` | Log protocol 核心 | 輸出 `@PASS / @BLOCKER / @TASK / @NEXT_COMMAND` |
| `lib/shared/state-manager-v3.cjs` | 狀態檔管理器 | 讀寫 `.state.json` |
| `lib/shared/project-memory.cjs` | 記憶管理器 | 跨 iter 的 memory / pitfall / hint |
| `lib/shared/phase-registry-loader.cjs` | phase registry loader | 載入 phase 定義 |
| `lib/shared/next-command-helper.cjs` | 下一步命令生成 | 從 log / state 組出 next cmd |
| `lib/shared/backtrack-router.cjs` | 回溯路由器 | blocker 時回到上一步 |
| `lib/shared/retry-strategy.cjs` | 重試策略 | gate / phase 的 retry 規則 |
| `lib/shared/project-type.cjs` | 專案類型辨識 | Node / GAS / 其他 target 類型判斷 |
| `lib/shared/error-handler.cjs` | 錯誤處理 | 轉成可讀 blocker / log |
| `lib/shared/taint-analyzer.cjs` | 汙染分析 | 追蹤標籤 / 結構污染 |

#### Plan / Scan 工具

| 檔案 | 角色 | 定義 |
|---|---|---|
| `lib/plan/plan-generator.cjs` | Plan 生成器 | 由 spec / contract 產生 plan |
| `lib/plan/plan-spec-extractor.cjs` | Plan 規格抽取器 | 把 plan 解析成結構 |
| `lib/plan/plan-validator.cjs` | Plan 驗證器 | 驗 plan schema / story / item |
| `lib/scan/contract-generator.cjs` | Contract 生成器 | 由掃描結果生成 contract 類資訊 |
| `lib/scan/gems-patterns.cjs` | 標籤模式庫 | GEMS tag pattern 定義 |
| `lib/scan/gems-scanner-unified.cjs` | 統一掃描器 | 主掃描引擎 |
| `lib/scan/gems-scanner-enhanced.cjs` | 增強掃描器 | 強化輸出 / 補充資訊 |
| `lib/scan/gems-validator.cjs` | 標籤驗證器 | 驗 tag 規則 |
| `lib/scan/gems-validator-lite.cjs` | 輕量驗證器 | 快速檢查版本 |

#### 工具腳本

| 檔案 | 角色 | 定義 |
|---|---|---|
| `tools/spec-to-plan.cjs` | legacy spec→plan | 舊版 plan 生成，過渡工具 |
| `tools/dep-scan.cjs` | 依賴掃描器 | 讀依賴關係 |
| `tools/health-report.cjs` | 健康報告 | 系統健康摘要 |
| `tools/project-status.cjs` | 專案狀態查詢 | 目前狀態資訊 |
| `tools/sdid-self-scan.cjs` | 自我掃描 | 掃 SDID 自身狀態 |
| `tools/shrink-tags.cjs` | tag 壓縮工具 | 將長 tag 壓縮整理 |
| `tools/zombie-scan.cjs` | 僵屍掃描 | 找 dead code / 遺留物 |
| `tools/force-commands.cjs` | 強制命令 | 特殊狀態下的強制流程 |
| `tools/blueprint-studio.html` | 視覺化工具 | blueprint 編排輔助頁 |

#### 品質檢查

| 檔案 | 角色 | 定義 |
|---|---|---|
| `tools/quality-check/content-quality-checker.cjs` | 內容品質檢查 | 文件 / 輸出品質檢查 |
| `tools/quality-check/poc-quality-checker.cjs` | POC 品質檢查 | POC 產物品質檢查 |

---

### 4.5 `sdid-monitor/`

這層是觀測與 hub 匯聚層。

| 檔案 | 角色 | 定義 |
|---|---|---|
| `server.cjs` | 監控服務 | 提供 UI / dashboard |
| `hub.json` | 狀態中心 | 專案狀態匯聚 snapshot |
| `update-hub.cjs` | hub 更新器 | 自動化偵測專案狀態並刷新 hub |

這層不負責做決策，也不直接改 code。
它只做：

- 看狀態
- 彙總狀態
- 更新 hub
- 提供 dashboard / 觀測入口

---

## 5. 總契約骨架

這裡說的「總契約」不是再發明一套新框架，而是把現有 SDID 的語意統一起來。

### 建議章節

1. **目的**
   - 這套系統要讓 AI / 人用同一套 workflow 跑

2. **角色定義**
   - tag / contract / scan / log / guide / blueprint / state / memory / runner / monitor

3. **優先級**
   - 哪些是 source of truth
   - tag 與 scan 衝突時以誰為準
   - log 與 guide 衝突時以誰為準

4. **狀態機**
   - Blueprint → Draft → Contract → Plan → Build → Scan → Verify → Backfill

5. **產物契約**
   - `contract_iter-N.ts`
   - `implementation_plan_Story-X.Y.md`
   - `functions.json`
   - `project-memory.json`
   - `.state.json`
   - log 格式

6. **執行規則**
   - runner 只看 log
   - 不猜下一步
   - blocker 必須回報原因

7. **收斂規則**
   - 何時算完成
   - 何時回填 blueprint
   - 何時更新 memory
   - 何時進下一 iter

---

## 6. ROADMAP / hub 的定位

我現在的理解是：

- `ROADMAP.md`：總進度與里程碑
- `sdid-monitor/hub.json`：狀態匯聚的 hub
- `sdid-monitor/update-hub.cjs`：自動更新 hub 的腳本

也就是說：

- `ROADMAP.md` 管「要做什麼」
- `hub.json` 管「現在做到哪」
- `update-hub.cjs` 管「怎麼自動同步」

這三者應該一起看，不要分開看。

---

## 7. Memory Read Order Contract

目前最大的問題不是沒有 memory，而是 memory source 太分散，沒有固定讀序。

### 7.1 目的

這份協議的目的，是讓 AI / 人在重開後能順著同一條路讀記憶，不再自己猜先看哪個檔案。

### 7.2 標準讀序

每次重開時，建議固定依序讀：

1. `ROADMAP.md`
2. `ARCHITECTURE.md`
3. `sdid-monitor/hub.json`
4. `.gems/project-memory.json`
5. `.gems/iterations/iter-N/.state.json`
6. 最近的 `logs`
7. `functions.json`
8. 必要時再回到 `blueprint / draft / contract`

### 7.3 各層定位

| 層級 | 檔案 | 職責 |
|---|---|---|
| 主規格 | `ROADMAP.md`, `ARCHITECTURE.md` | 定義整體方向與語意 |
| 匯聚層 | `sdid-monitor/hub.json` | 彙總目前專案與迭代狀態 |
| 主記憶 | `.gems/project-memory.json` | 保存跨 iter 的結論、風險、偏好、下一步 |
| 工作記憶 | `.gems/iterations/iter-N/.state.json` | 保存當前 iter 的流程狀態 |
| 證據記憶 | `logs/` | 保存實際執行證據 |
| 規格記憶 | `functions.json` | 保存 scan 出來的函式、tag 與 flow 資訊 |

### 7.4 優先級規則

- `ROADMAP / ARCHITECTURE` 決定語意與方向
- `hub.json` 決定目前匯聚狀態
- `project-memory.json` 決定跨 iter 的歷史與偏好
- `.state.json` 決定當前 iter 的實際流程
- `logs` 決定剛剛到底發生什麼
- `functions.json` 決定 scan 後的結構化結果

### 7.5 讀取規則

- `hub.json` 只能當匯聚結果，不能當唯一真相
- `project-memory.json` 是主記憶，但不能覆蓋最新的 `.state.json`
- `functions.json` 是規格摘要，不等於實作本身
- `logs` 是證據，不是推論
- 若上述來源衝突，以最新的流程證據與 iter state 為準，再回填 memory

### 7.6 成功標準

如果這條讀序做對了，AI 重開後應該可以：

- 先知道這個專案在做什麼
- 再知道目前做到哪
- 再知道上一輪發生什麼
- 最後才去看需要補哪些文件或步驟

---

## 8. Memory Map Contract

`Memory Map` 不是記憶本體，而是導覽圖。
它的作用是把 `HUB / BLUEPRINT / STATE / MEMORY / LOG / SCAN` 收斂成一張可行動的圖。

### 8.1 目的

- 人一看圖就知道現在在哪
- AI 一看圖就知道下一步要去哪
- 不再需要到處翻文件猜入口

### 8.2 Map 層級

#### A. Workspace Map
最上層總覽，只看大方向。

- `HUB`
- `PROJECT`
- `BLUEPRINT`
- `CURRENT ITER`
- `ARCHIVE`

作用：
- 先知道是誰的工作空間
- 現在走到哪個 iter
- 目前進入哪條流程

#### B. Layer Map
把系統分成幾個大層。

- `Monitor Layer`
- `Blueprint Layer`
- `State Layer`
- `Memory Layer`
- `Execution Layer`
- `Scan / Backfill Layer`

每層都標：
- 職責
- 讀誰
- 寫誰
- 哪些文件屬於這層

#### C. Block Map
這是最重要的層，每個 block 是具體工作區。

- `Hub Block`
- `Blueprint Block`
- `Draft Block`
- `Contract Block`
- `Plan Block`
- `Build Block`
- `Scan Block`
- `Verify Block`
- `Backfill Block`

每個 block 固定顯示：
- `Purpose`
- `Owner`
- `Inputs`
- `Outputs`
- `Current State`
- `Next Action`
- `Blocker`
- `Source of Truth`

### 8.3 Block 模板

每個 block 建議都遵守這個模板：

| 欄位 | 說明 |
|---|---|
| `Name` | block 名稱 |
| `Role` | 入口、狀態、記憶、證據、執行器、匯聚層 |
| `Reads` | 需要看哪些資料 |
| `Writes` | 會更新哪些產物 |
| `Current State` | `active` / `done` / `blocked` / `stale` / `pending` |
| `Next Action` | 下一步要做什麼 |
| `Fallback` | 出問題要回哪裡 |

### 8.4 建議輸出格式

`Memory Map` 最好同時有三種版本：

- `memory-map.md`：文字版總圖
- `memory-map.json`：機器可讀版
- `memory-map.mmd`：Mermaid 圖版

如果要做 monitor，還可以讓 `sdid-monitor` 直接讀這份 map 來顯示 dashboard。

### 8.5 一句話定義

> HUB 負責最新，MAP 負責導覽，MEMORY 負責歷史。

---

## 9. 成功標準

這次重構如果做對，應該可以達到：

- AI 不需要完整上下文也能續跑
- log 能明確引導下一步
- monitor 能直接看出目前狀態
- `task-pipe` 負責執行，不負責發明規則
- `sdid-tools` 負責 gate / 轉換，不負責跑主流程
- `sdid-core` 負責狀態推斷，不負責業務邏輯
- `hub.json` 與 `ROADMAP.md` 可以互相對照

---

## 10. 目前風險

1. 文件多，但語意還沒完全對齊
2. `hub.json` / `ROADMAP.md` / `ARCHITECTURE.md` 需要一起看，不然容易斷層
3. `sdid-monitor` 目前是觀測層，不能讓它偷偷變成決策層
4. 舊腳本很多，短期內一定會有過渡狀態
5. 最容易失控的不是執行，而是「每個層都以為自己可以決策」

---

## 11. 下一步

下一步不是重寫，而是：

1. 把這份重構計畫跟 `SKILL.md` 對齊
2. 把 `ARCHITECTURE.md` 的語意跟現況補齊
3. 把 `ROADMAP.md`、`hub.json`、`update-hub.cjs` 這三個監控/進度面一起收斂
4. 再決定哪些腳本要先包成 harness adapter


---

## Addendum: Root / Project Layout Contract

SDID 的位置要固定成 framework root，不要和專案本體混在同一層。

### 目的

- `SDID/` 是 framework root
- `projects/` 放在下一層
- root 只留框架資產，不混專案業務內容

### 建議結構

```text
SDID/
  sdid-core/
  sdid-tools/
  task-pipe/
  sdid-monitor/
  docs/
  ROADMAP.md
  ARCHITECTURE.md
  SDID_REFACTOR_PLAN.md
  projects/
    <project-a>/
    <project-b>/
```

### 分工原則

- `sdid-core`：核心判斷層
- `sdid-tools`：設計 / gate / 轉換層
- `task-pipe`：BUILD AUTO / SCAN / runner 層
- `sdid-monitor`：觀測與 hub 匯聚層
- `projects/`：實際專案內容與 iter / logs / artifacts

### 為什麼要這樣放

- 可以減少 workspace dirty 的混雜感
- 專案與框架責任分開
- `BLUEPRINT` 會更適合當進專案入口
- `HUB` 先導覽，再進到專案 `BLUEPRINT`

### 與總契約的關係

- `總契約` 負責鎖定語意
- `Memory Map` 負責導覽
- `Hub` 負責最新狀態匯聚
- `Blueprint` 負責進專案主入口

---

## M29 — Skill 收斂（2026-04-05）

### 決策

| 決策 | 原因 |
|---|---|
| SKILL.md 縮成純路由器 | Agent 不需要理解 SDID，只需要找到狀態、選對 mode |
| STEP 0 只讀 4 個來源 | 路由只需要 hub + state + log + 工件，ROADMAP/ARCHITECTURE 降為備查 |
| CYNEFIN 搬進 Blueprint Round 6 | 在設計期解決複雜度，Draft 產出時已乾淨，pipeline 少一節點 |
| FLOW 標籤 = 純行為語意 | Read/Write/Compute/Orchestrate，不帶域標記到 contract |
| FLOW-REVIEW → optional | 行為分 FLOW 已取代三問法，降為可選工具 |
| POC-FIX 移除主流程 | 未來只有 Blueprint + MICRO-FIX 兩條路 |
| TASKPIPE 從路由移除 | 已整合進 SDID，不需要獨立路由項目 |

### 進度

| 子任務 | 狀態 |
|---|---|
| sdid.md 重寫為純路由器 | ✅ done |
| SDID_REFACTOR_PLAN.md 補 M29 | ✅ done |
| blueprint-design.md 加 Round 6 | ⬜ pending |
| cynefin-check.md 縮減為薄 gate | ⬜ pending |

### PENDING（保留文件，暫不接入主流程）

- `references/poc-fix.md`
- `references/taskpipe-design.md`
- `references/architecture-rules.md`
- `references/SDID_ARCHITECTURE.md`
- flow-review skill

### ARCHIVE 候選（確認無用後刪除）

- `references/action-type-mapping.md`
- `references/design-quality-gate.md`
- `references/design-reviewer-prompt.md`
