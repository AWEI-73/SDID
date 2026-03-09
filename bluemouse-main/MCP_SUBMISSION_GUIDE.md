# 🌐 BlueMouse MCP 提交與註冊指南

BlueMouse v6.1 支援 **Model Context Protocol (MCP)**，這讓它可以像一個「靈魂插件」一樣注入到 Cursor、Claude Desktop 或 Antigravity 中。

---

## 模式 1：本地註冊 (給您自己或您的客戶)

如果您想在自己的開發環境中使用，或讓客戶測試，請依照以下步驟：

### 1. Cursor / Claude Desktop (StdIO 模式)
這是最穩定的方式，AI 直接執行您的 Python 腳本。

*   **開啟設定**: 在 Cursor 中進入 `Settings` -> `General` -> `MCP`。
*   **新增 Server**:
    *   **Name**: BlueMouse
    *   **Type**: `command`
    *   **Command**: `/你的/路徑/到/venv/bin/python`
    *   **Args**: `/你的/路徑/到/run_standalone.py`
    *   **Env**: `PYTHONUNBUFFERED=1`

### 2. Antigravity / 遠端 (SSE 模式)
這適合於 Web 背景運行的場景。

*   **URL**: `http://localhost:8001/sse`
*   **優點**: 同時支援 Web UI 與 MCP 連接，互不干擾。

---

## 模式 2：正式提交到官方生態系 (最大化商業價值)

如果您想讓全世界的人都能在 [Model Context Protocol 官網](https://modelcontextprotocol.io/) 看到您，請執行以下步驟：

### 1. 準備 GitHub 倉庫
*   確保您的 GitHub 頁面是乾淨的（我們剛剛已經完成了）。
*   確保 `README.md` 包含清楚的 MCP 安裝說明。

### 2. 提交到 MCP 官方伺服器目錄
這是目前曝光量最高的方式：
1.  前往 [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) 倉庫。
2.  **Fork** 該倉庫。
3.  在 `src/` 目錄下建立一個 `bluemouse` 資料夾，並放入您的 MCP 指向說明。
4.  發起 **Pull Request (PR)**。
5.  在 PR 說明中強調：**"A data-driven logic gate server protecting against AI hallucinations with 180k+ trap records."**

### 3. 加入 Smithery 商店
[Smithery.ai](https://smithery.ai/) 是目前最大的 MCP 插件商店。
*   前往 Smithery 官網，點擊 **"Add Server"**。
*   輸入您的 GitHub URL。
*   Smithery 會自動索引您的工具，讓全球用戶可以「一鍵安裝」。

---

## 💡 提交文案建議 (Pitch)

在提交時，請使用這段經過設計的文案，以增加通過率：

> **"BlueMouse is an advanced MCP server implementing the MMLA-MRM architecture. Unlike generic coding tools, it acts as a 'prefrontal cortex' for LLMs, utilizing a massive knowledge base of 180,000 failure patterns to interview the AI before it writes any code. It guarantees production-ready, sanitized, and logically sound output."**

---
**核准認證**: BlueMouse v6.1 核心開發組
