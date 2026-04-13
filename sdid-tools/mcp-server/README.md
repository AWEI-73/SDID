# SDID MCP Server

將 SDID 工具鏈暴露為 MCP tools，讓 Claude Code 直接呼叫。

## 安裝

```bash
cd sdid-tools/mcp-server
npm install
```

## 專案端配置

在你的專案（如 ExamForge）的 `.claude/settings.json` 加入：

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

重啟 Claude Code 後，9 個 SDID tools 自動可用。

## Tools 一覽

| Tool | 用途 | 常用時機 |
|------|------|----------|
| `sdid-state-guide` | 狀態指令包（狀態/該讀/歷史/下一步/紅線） | 每次進入專案時 |
| `sdid-build` | 執行 BUILD/POC/PLAN Phase | 開發主流程 |
| `sdid-scan` | 執行 canonical SCAN，產出 `.gems/docs/functions.json` | BUILD 完成後 |
| `sdid-spec-gen` | 字典生成（Draft → specs/*.json） | 藍圖完成後 |
| `sdid-spec-gate` | 字典品質驗證（5 項檢查） | 字典變更後 |
| `sdid-dict-sync` | 行號回寫（源碼 → specs） | BUILD 完成後 |
| `sdid-scanner` | 委派 canonical SCAN，canonical output 是 `.gems/docs/functions.json` | BUILD 完成後 |
| `sdid-blueprint-gate` | 藍圖品質驗證 | 藍圖設計後 |
| `sdid-micro-fix-gate` | 小修/POC-FIX 驗收 | 小修完成後 |

## 典型流程

### Blueprint 路線（模糊需求）
```
1. sdid-state-guide     → 確認狀態
2. （SKILL.md 引導 5 輪對話設計藍圖）
3. sdid-blueprint-gate  → 驗證藍圖
4. sdid-spec-gen        → 生成字典
5. sdid-spec-gate       → 驗證字典
6. sdid-build           → 跑 BUILD Phase 1-8
7. sdid-scan            → 全景報告
8. sdid-dict-sync       → 行號回寫
```

### POC-FIX / MICRO-FIX 路線
```
1. sdid-state-guide     → 確認路線
2. （修改程式碼）
3. sdid-micro-fix-gate  → 驗收
```

### 自動模式
```
sdid-build --auto       → PASS 後自動跑下一個 Phase，BLOCKER 時停下
sdid-build --diagnose   → 查看所有迭代狀態
```

## 搭配 SKILL.md

MCP 負責工具執行，SKILL.md 負責路由決策。兩者互不干擾：

- **MCP**：跑腳本、產報告、驗證品質（執行層）
- **SKILL.md**：判斷走哪條路線、引導對話流程（決策層）

將 `.agent/skills/sdid/` 放到專案中即可同時啟用兩者。

## 技術細節

- Transport: stdio（Claude Code 原生支持）
- SDK: `@modelcontextprotocol/sdk` v1.x
- 格式: ESM (`.mjs`)，用 `createRequire()` 橋接現有 CJS 工具
- 有 `module.exports` 的工具直接 require，沒有的用 `child_process.execFile`
- 所有 CLI 輸出自動去除 ANSI color codes
