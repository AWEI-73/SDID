# 🛡️ BlueMouse 紅隊審計：端到端使用者旅程擬真

本文檔詳細記錄了開發者與終端使用者接觸「藍圖小老鼠」系統的兩條主要路徑，並作為紅隊攻擊測試的基礎場景。

---

## 🚪 正門：GitHub 開發者實戰旅程 (The Main Entrance)

此情境模擬一名軟體工程師 (DevOps) 如何整合 BlueMouse 核心。

1.  **Repo 探索**：使用者克隆倉庫後，查閱 `README.md` 與 `BlueMouse_v6.1_MASTER_ARCH.md`。
2.  **環境初始化**：執行 `setup_mcp.py` 並建立 `venv`。
3.  **核心調度**：執行 `run_standalone.py` 啟動 CLI 模式。
4.  **需求碰撞**：使用者輸入需求（例如：`建立一個電商後台`）。
5.  **蘇格拉底攻防**：系統識別場景，跳出關鍵問題（如：如何處理超賣？）。使用者在此階段透過選擇方案與系統達成「架構共識」。
6.  **代碼具現化**：系統啟動 `antigravity_code_generator`，經過 17 層 AST 物理驗證後產出安全代碼。

## 🚪 側門：MCP AI 代理生態路徑 (The Side Entrance - Cursor/Windsurf/Antigravity)

此路徑模擬 AI 代理在使用者不知情或高併發協同下調用 BlueMouse 的過程。

### 1. 🪟 Cursor / Windsurf 接入步驟
- **配置**: 使用者點開 Settings -> MCP，點擊 "Add New MCP Server"。
- **接入點**: 類型選擇 `command`，輸入 `python3 /path/to/bluemouse/mcp_server.py`。
- **認證**: 系統自動掃描本地環境變數，完成 Antigravity 內聯授權。

### 2. ⚡ AI 代理協作 (The Agentic Loop)
- **Windsurf 動作**: 當使用者輸入「開發這項功能」時，Windsurf 會先調用 `list_tools` 發現 `mmla_validate_code`。
- **預檢**: Windsurf 主動將待生成的代碼片段傳給 BlueMouse 進行 L1-L17 物理掃描。
- **防禦**: 若代碼包含 `os.system('rm')`，BlueMouse 立即回傳 `Passed: False, Message: [L16] Dangerous command detected`。
- **修復**: Windsurf 接收到攔截訊號，自動重寫代碼並再次驗證，直到 17 層濾網全部變綠。

### 3. 🛸 Antigravity 原生路徑
- **深度整合**: Antigravity 代理在生成代碼的過程中，每一行都會經過 `validation_17_layers.py` 的影子檢查。
- **無感保護**: 使用者看到的只是產出的完美代碼，而不知道後端已經進行了幾百次的高併發攻防攔截。

---

## 🚩 紅隊測試場景 (攻擊向量)

| 攻擊目標 | 測試動作 (Attack Vector) | 預期防禦行為 |
| :--- | :--- | :--- |
| **輸入層** | 輸入完全無關的垃圾字串（如：`asdfghjkl`）或超長 Payload。 | 觸發 Layer 4 保底規則或拒絕服務。 |
| **邏輯層** | 輸入惡意指令（指令注入或敏感字眼需求）。 | 安全掃描層 (L16) 自動攔截危險語法。 |
| **穩定層** | 在 MCP 環境中發起 100+ 併發工具調用。 | 多層 AI 降級機制確保系統不崩潰。 |
| **欺騙層** | 對蘇格拉底問題給出邏輯矛盾的答案。 | 系統應能識別並持續追問或給出風險警告。 |
