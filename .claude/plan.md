# SDID MCP Server 實作計劃

## 目標
將 SDID 工具鏈包裝為 MCP Server，讓任何專案的 Claude Code 可以直接呼叫 SDID 工具。

## 架構

```
ExamForge/                          sdid-tools/
├── .claude/settings.json           ├── mcp-server/
│   └── mcpServers: {               │   ├── package.json
│         "sdid": {                  │   ├── index.mjs        ← MCP 入口（ESM）
│           "command": "node",       │   └── tools/
│           "args": ["path/to/      │       ├── state-guide.mjs
│             sdid-tools/mcp-server │       ├── spec-gen.mjs
│             /index.mjs"]           │       ├── spec-gate.mjs
│         }                          │       ├── dict-sync.mjs
│       }                           │       ├── scanner.mjs
└──                                  │       ├── blueprint-gate.mjs
                                     │       └── micro-fix-gate.mjs
                                     ├── spec-gen.cjs  ← 既有工具不動
                                     ├── spec-gate.cjs
                                     └── ...
```

## 技術選型

| 項目 | 選擇 | 原因 |
|------|------|------|
| SDK | `@modelcontextprotocol/sdk` | 官方 TypeScript SDK，穩定 v1.x |
| Schema | `zod` | SDK 必要 peer dependency |
| 格式 | ESM (`.mjs`) | SDK 是 ESM，既有工具保持 CJS 不動 |
| Transport | stdio | Claude Code 原生支持，零配置 |
| 整合方式 | `require()` 現有 CJS 工具 | 不重寫，直接呼叫 module.exports |

## 暴露的 Tools（7 個）

### 1. `sdid-state-guide`
> 路由大腦 — AI 每次進入時呼叫，取得狀態指令包

| 欄位 | 值 |
|------|---|
| 輸入 | `project` (必填), `iter?`, `story?`, `gems?` |
| 輸出 | 5 區塊文字（📍狀態/📖該讀的/⚠️歷史/🎯下一步/🚫紅線） |
| 映射 | `state-guide.cjs` → `formatGuide()` |

### 2. `sdid-spec-gen`
> 字典生成 — 讀 Draft/Spec 產出 specs/*.json

| 欄位 | 值 |
|------|---|
| 輸入 | `project` (必填), `input` (必填), `iter?`, `dryRun?` |
| 輸出 | 生成報告（模組數、條目數、TODO 清單） |
| 映射 | `spec-gen.cjs` CLI（fork/exec，因為沒有 module.exports） |

### 3. `sdid-spec-gate`
> 字典品質驗證 — 5 項檢查

| 欄位 | 值 |
|------|---|
| 輸入 | `project` (必填), `fixIndex?`, `dryRun?` |
| 輸出 | PASS/FAIL + errors/warnings 明細 |
| 映射 | `spec-gate.cjs` CLI（fork/exec） |

### 4. `sdid-dict-sync`
> 行號回寫 — 從源碼同步 lineRange 到 specs

| 欄位 | 值 |
|------|---|
| 輸入 | `project` (必填), `src?`, `dryRun?` |
| 輸出 | 同步報告（更新了哪些 entries） |
| 映射 | `dict-sync.cjs` → `syncDict()` |

### 5. `sdid-scanner`
> GEMS 標籤掃描 — 產出 function-index + 覆蓋率

| 欄位 | 值 |
|------|---|
| 輸入 | `project` (必填), `src?` |
| 輸出 | 掃描報告（tagged/untagged/coverage） |
| 映射 | `gems-scanner-v2.cjs` → `scanV2()` |

### 6. `sdid-blueprint-gate`
> 藍圖品質驗證 — 機械規則檢查

| 欄位 | 值 |
|------|---|
| 輸入 | `draft` (必填), `iter?`, `target?` |
| 輸出 | PASS/FAIL + 違規明細 |
| 映射 | `blueprint-gate.cjs` CLI（fork/exec） |

### 7. `sdid-micro-fix-gate`
> 小修驗收 — POC-FIX/MICRO-FIX 的 gate

| 欄位 | 值 |
|------|---|
| 輸入 | `target` (必填), `changed?` |
| 輸出 | PASS/FAIL + 標籤覆蓋報告 |
| 映射 | `micro-fix-gate.cjs` CLI（fork/exec） |

## 整合策略：CJS ↔ ESM 橋接

既有工具都是 `.cjs`，有三種整合方式：

| 工具 | 有 module.exports? | 整合方式 |
|------|---|---|
| state-guide.cjs | ✅ `{ detectRoute, formatGuide, ... }` | `createRequire()` 直接 require |
| gems-scanner-v2.cjs | ✅ `{ scanV2, generateFunctionIndexV2 }` | `createRequire()` 直接 require |
| dict-sync.cjs | ✅ `{ syncDict }` | `createRequire()` 直接 require |
| blueprint-gate.cjs | ✅ 有 exports | `createRequire()` 直接 require |
| spec-gen.cjs | ❌ 無 exports | `child_process.execFile` 跑 CLI |
| spec-gate.cjs | ❌ 無 exports | `child_process.execFile` 跑 CLI |
| micro-fix-gate.cjs | ❌ 無 exports（有但是內部用） | `child_process.execFile` 跑 CLI |

對於無 exports 的工具，用 `execFile` 捕獲 stdout 回傳，比較乾淨。

## 實作步驟

### Step 1：建立 mcp-server 目錄 + package.json
```bash
sdid-tools/mcp-server/
├── package.json      # type: "module", 依賴 @modelcontextprotocol/sdk + zod
└── index.mjs         # 入口
```

### Step 2：實作 index.mjs 骨架
- `McpServer` 實例化
- `StdioServerTransport` 連接
- 7 個 `server.registerTool()` 註冊

### Step 3：逐個實作 tool handler
- 優先做 `sdid-state-guide`（最常用）
- 再做 `sdid-spec-gate` + `sdid-scanner`（驗證類）
- 再做 `sdid-spec-gen` + `sdid-dict-sync`（生成/同步類）
- 最後做 `sdid-blueprint-gate` + `sdid-micro-fix-gate`（gate 類）

### Step 4：配置 Claude Code 使用
- 在專案的 `.claude/settings.json` 加 `mcpServers.sdid` 配置
- 測試：Claude Code 能列出 SDID tools

### Step 5：驗證
- 在 ExamForge 專案用 Claude Code 呼叫每個 tool
- 確認輸出格式對 AI 友善（結構化、不冗長）

## 輸出格式設計原則

MCP tool 的輸出要對 AI 友善，不是對人類終端機友善：
- **不要 ANSI color codes**（去掉 `\x1b[31m` 等）
- **結構化文字**，用 markdown 或 JSON
- **精簡**：gate 結果只回 pass/fail + error list，不要框框標題
- **可操作**：失敗時附上修復建議命令

## 專案端使用方式

專案在 `.claude/settings.json` 或 `.mcp.json` 加：
```json
{
  "mcpServers": {
    "sdid": {
      "command": "node",
      "args": ["C:/Users/user/Desktop/SDID/sdid-tools/mcp-server/index.mjs"]
    }
  }
}
```

然後 Claude Code 就能直接呼叫 `sdid-state-guide`、`sdid-spec-gate` 等。
