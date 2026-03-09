# SDID 大重構執行計畫 v1.0
**建立**: 2026-03-09
**目標**: 資料夾重構，流程行為完全不變

---

## 原則

- 每個 Wave 前先 dry run（列出要移動/刪除的檔案）
- 確認 dry run 後再動手
- 每個 Wave 完成後 git commit
- 禁止 PowerShell 批量操作（UTF-8 破壞風險）
- 只用 Kiro 工具移動/刪除檔案

---

## 架構目標

```
sdid-tools/
├── blueprint/              ← 新建，從根層移入
│   ├── gate.cjs            ← ← blueprint-gate.cjs
│   ├── contract-writer.cjs ← ← blueprint-contract-writer.cjs
│   ├── draft-to-plan.cjs   ← ← draft-to-plan.cjs
│   ├── shrink.cjs          ← ← blueprint-shrink.cjs
│   ├── expand.cjs          ← ← blueprint-expand.cjs
│   └── verify.cjs          ← ← blueprint-verify.cjs
├── poc-fix/                ← 新建
│   └── micro-fix-gate.cjs  ← ← micro-fix-gate.cjs
├── spec/                   ← 新建
│   ├── gen.cjs             ← ← spec-gen.cjs
│   └── gate.cjs            ← ← spec-gate.cjs
├── lib/                    ← 不動
├── ac-runner.cjs           ← 不動
├── cynefin-log-writer.cjs  ← 不動
├── state-guide.cjs         ← 不動
├── dict-sync.cjs           ← 不動
├── poc-to-scaffold.cjs     ← 不動（POC-FIX 工具，根層保留）
├── plan-to-scaffold.cjs    ← 不動
└── mcp-server/             ← adapter 路徑更新

task-pipe/lib/scan/         ← 收斂
├── gems-scanner-unified.cjs  ← 保留（主力）
├── gems-validator-lite.cjs   ← 保留（主力）
├── gems-validator.cjs        ← 保留（unified 的 fallback）
├── gems-scanner-enhanced.cjs ← 保留（unified 依賴 findACLines）
└── 刪除：
    ├── gems-scanner-v2-proxy.cjs  ← 25行 deprecated proxy
    └── gems-validator.cjs         ← 待確認是否被 unified 以外的地方直接引用

task-pipe/lib/              ← 根層清理
└── 刪除：
    ├── gems-scanner.cjs           ← deprecated
    ├── project-type.cjs           ← 根層重複版（lib/shared/ 有正版）
    └── stress-test-*.cjs          ← 待確認

.agent/skills/sdid/scripts/ ← 清理
└── 刪除：
    ├── blueprint-loop.cjs         ← deprecated 8行
    └── taskpipe-loop.cjs          ← deprecated 8行

sdid-tools/
└── 刪除/移動：
    └── gems-scanner-v2.cjs        ← 移到 sdid-tools/lib/gems-scanner-v2.cjs
```

---

## Wave 0：git commit 回滾點

```bash
git add -A
git commit -m "chore: pre-refactor snapshot — Wave 0 rollback point"
```

---

## Wave 1：sdid-tools 根層整理（移動 blueprint/poc-fix/spec）

### 要移動的檔案

| 來源 | 目的地 |
|------|--------|
| `sdid-tools/blueprint-gate.cjs` | `sdid-tools/blueprint/gate.cjs` |
| `sdid-tools/blueprint-contract-writer.cjs` | `sdid-tools/blueprint/contract-writer.cjs` |
| `sdid-tools/draft-to-plan.cjs` | `sdid-tools/blueprint/draft-to-plan.cjs` |
| `sdid-tools/blueprint-shrink.cjs` | `sdid-tools/blueprint/shrink.cjs` |
| `sdid-tools/blueprint-expand.cjs` | `sdid-tools/blueprint/expand.cjs` |
| `sdid-tools/blueprint-verify.cjs` | `sdid-tools/blueprint/verify.cjs` |
| `sdid-tools/micro-fix-gate.cjs` | `sdid-tools/poc-fix/micro-fix-gate.cjs` |
| `sdid-tools/spec-gen.cjs` | `sdid-tools/spec/gen.cjs` |
| `sdid-tools/spec-gate.cjs` | `sdid-tools/spec/gate.cjs` |
| `sdid-tools/gems-scanner-v2.cjs` | `sdid-tools/lib/gems-scanner-v2.cjs` |

### 內部路徑依賴（移動後需修正）

移動後，這些檔案內部可能有 `require('../xxx')` 或 `require('./xxx')` 的相對路徑，
需要逐一確認並修正。

**blueprint/gate.cjs** 原本在根層，移到 `blueprint/` 後：
- `require('./lib/xxx')` → `require('../lib/xxx')`
- `require('../sdid-core/xxx')` → `require('../../sdid-core/xxx')`

**poc-fix/micro-fix-gate.cjs** 同理。

**spec/gen.cjs**, **spec/gate.cjs** 同理。

**lib/gems-scanner-v2.cjs**：
- `gems-scanner-unified.cjs` 的 V2_PATH 硬寫 `sdid-tools/gems-scanner-v2.cjs`，
  移動後需更新 unified.cjs 的路徑。

### Dry Run 確認清單
- [ ] 確認 blueprint-gate.cjs 內部 require 路徑
- [ ] 確認 blueprint-contract-writer.cjs 內部 require 路徑
- [ ] 確認 draft-to-plan.cjs 內部 require 路徑
- [ ] 確認 blueprint-shrink.cjs 內部 require 路徑
- [ ] 確認 blueprint-expand.cjs 內部 require 路徑
- [ ] 確認 blueprint-verify.cjs 內部 require 路徑
- [ ] 確認 micro-fix-gate.cjs 內部 require 路徑
- [ ] 確認 spec-gen.cjs 內部 require 路徑
- [ ] 確認 spec-gate.cjs 內部 require 路徑
- [ ] 確認 gems-scanner-v2.cjs 內部 require 路徑

---

## Wave 2：MCP adapter 路徑更新

### loop.mjs 需要更新的 runCli 呼叫

| 原始呼叫 | 更新後 |
|---------|--------|
| `runCli('blueprint-gate.cjs', ...)` | `runCli('blueprint/gate.cjs', ...)` |
| `runCli('draft-to-plan.cjs', ...)` | `runCli('blueprint/draft-to-plan.cjs', ...)` |
| `runCli('blueprint-verify.cjs', ...)` | `runCli('blueprint/verify.cjs', ...)` |
| `runCli('blueprint-expand.cjs', ...)` | `runCli('blueprint/expand.cjs', ...)` |
| `runCli('blueprint-contract-writer.cjs', ...)` | `runCli('blueprint/contract-writer.cjs', ...)` |
| `runCli('micro-fix-gate.cjs', ...)` | `runCli('poc-fix/micro-fix-gate.cjs', ...)` |

### cli-tools.mjs 需要更新的 runCli 呼叫

| 原始呼叫 | 更新後 |
|---------|--------|
| `runCli('blueprint-gate.cjs', ...)` | `runCli('blueprint/gate.cjs', ...)` |
| `runCli('micro-fix-gate.cjs', ...)` | `runCli('poc-fix/micro-fix-gate.cjs', ...)` |
| `runCli('spec-gen.cjs', ...)` | `runCli('spec/gen.cjs', ...)` |
| `runCli('spec-gate.cjs', ...)` | `runCli('spec/gate.cjs', ...)` |
| `runCli('poc-to-scaffold.cjs', ...)` | 不動（poc-to-scaffold 留根層） |

### utils.mjs
- `runCli` 以 `TOOLS_DIR`（= `sdid-tools/`）為 base 拼路徑，不需改
- `runRunner` 硬寫 `task-pipe/runner.cjs`，不需改

---

## Wave 3：task-pipe/lib/scan 收斂（刪廢棄）

### 確認依賴關係

**gems-scanner-unified.cjs** 依賴：
- `./gems-validator.cjs` ← 保留
- `./gems-scanner-enhanced.cjs` ← 保留（findACLines）
- `sdid-tools/gems-scanner-v2.cjs` ← Wave 1 移到 `sdid-tools/lib/gems-scanner-v2.cjs`，需更新路徑

**gems-scanner-v2-proxy.cjs**（25行）：
- 確認有沒有人 require 它，如果只有 unified 以前用過 → 刪除

**gems-scanner-enhanced.cjs**：
- unified 依賴它的 `findACLines` → 保留

**gems-validator.cjs**（完整版）：
- unified 依賴它 → 保留

### 要刪除的檔案

| 檔案 | 原因 |
|------|------|
| `task-pipe/lib/scan/gems-scanner-v2-proxy.cjs` | 25行 deprecated proxy，unified 已取代 |

### Dry Run 確認清單
- [ ] grep `gems-scanner-v2-proxy` 確認沒有其他引用
- [ ] 更新 unified.cjs 的 V2_PATH（Wave 1 移動後）

---

## Wave 4：task-pipe/lib 根層清理

### 要確認的檔案

| 檔案 | 狀態 | 行動 |
|------|------|------|
| `task-pipe/lib/gems-scanner.cjs` | deprecated v5.2 | grep 確認無引用 → 刪 |
| `task-pipe/lib/project-type.cjs` | 根層重複版 | grep 確認 → 刪（lib/shared/ 有正版） |
| `task-pipe/lib/stress-test-*.cjs` | 待確認 | grep 確認用途 → 決定 |

### Dry Run 確認清單
- [ ] `grep -r "lib/gems-scanner"` 確認無引用
- [ ] `grep -r "lib/project-type"` 確認無引用（排除 lib/shared/project-type）
- [ ] 確認 stress-test 檔案的用途

---

## Wave 5：deprecated scripts 清理

### 要刪除的檔案

| 檔案 | 原因 |
|------|------|
| `.agent/skills/sdid/scripts/blueprint-loop.cjs` | deprecated 8行，只有 console.log |
| `.agent/skills/sdid/scripts/taskpipe-loop.cjs` | deprecated 8行，只有 console.log |

### Dry Run 確認清單
- [ ] 確認這兩個檔案確實只是 deprecated stub

---

## Wave 6：SKILL.md 路徑更新

`.agent/skills/sdid/SKILL.md` 可能有引用舊路徑，需要更新：
- `blueprint-gate.cjs` → `blueprint/gate.cjs`
- `draft-to-plan.cjs` → `blueprint/draft-to-plan.cjs`
- 等等

---

## 執行順序

```
Wave 0 → git commit
Wave 1 → dry run → 確認 → 移動 → 修正內部路徑 → git commit
Wave 2 → dry run → 確認 → 更新 adapter → git commit
Wave 3 → dry run → 確認 → 刪廢棄 + 更新 unified 路徑 → git commit
Wave 4 → dry run → 確認 → 刪廢棄 → git commit
Wave 5 → dry run → 確認 → 刪廢棄 → git commit
Wave 6 → 更新 SKILL.md → git commit
```

---

## 風險評估

| 風險 | 緩解 |
|------|------|
| 移動後內部 require 路徑錯誤 | Wave 1 dry run 時逐一確認每個檔案的 require |
| MCP adapter 路徑更新遺漏 | Wave 2 用 grep 確認所有 runCli 呼叫 |
| unified.cjs V2_PATH 失效 | Wave 3 明確更新路徑 |
| 刪錯有用的檔案 | 每個 Wave 前 grep 確認無引用 |
| 整體流程中斷 | Wave 0 有回滾點，每個 Wave 有獨立 commit |
