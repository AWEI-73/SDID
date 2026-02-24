# Cynefin Check — 進 PLAN 前語意域分析

> 知識來源：[Cynefin 白皮書 v7](../../task-pipe/docs/cynefin_whitepaper_v7.md)

## 觸發時機

兩條路線共用，在進入 PLAN 前強制執行：

| 路線 | 觸發點 | 輸入文件 |
|------|--------|---------|
| Blueprint | Enhanced Draft 組裝完成後，`draft-to-plan` 執行前 | `requirement_draft_iter-X.md` |
| Task-Pipe | POC Step 5 完成後，PLAN Step 1 執行前 | `requirement_spec_iter-X.md` |

---

## 核心防線：隱含複雜度展開

**最危險的情況不是需求模糊，而是需求寫得很簡單但背後藏著複雜度。**

模糊消除問不出來的原因：使用者自己也不知道背後有多複雜。

### 展開規則

對每個功能動作，主動問：「這個動作背後有沒有隱含的步驟？」

常見的隱含複雜度模式：

| 表面需求 | 隱含步驟 |
|---------|---------|
| 支援第三方登入 | OAuth flow、token 管理、refresh 機制、安全考量、帳號綁定衝突 |
| 支援多語言 | i18n 架構、日期/數字格式、RTL 支援、動態載入 |
| 即時通知 | WebSocket/SSE 連線管理、斷線重連、訊息佇列、推播服務整合 |
| 匯出 PDF | 排版引擎、字型嵌入、大檔案分頁、非同步產生 |
| 搜尋功能 | 索引策略、模糊比對、分詞、效能考量 |
| 支付整合 | 金流 API、webhook 驗證、冪等性、退款流程、對帳 |
| 權限管理 | RBAC 設計、繼承規則、動態權限、稽核日誌 |
| 資料同步 | 衝突解決策略、版本控制、離線支援、同步佇列 |

### 展開步驟

1. 讀取每個模組的功能動作清單
2. 對每個動作套用「隱含步驟展開」：
   - 這個動作有沒有外部服務依賴？（API、第三方平台）
   - 這個動作有沒有狀態管理需求？（session、cache、queue）
   - 這個動作有沒有錯誤處理路徑？（retry、fallback、rollback）
   - 這個動作有沒有安全考量？（auth、validation、rate limit）
3. 如果展開後的步驟數 > 原始描述的 3 倍，標記為「隱含複雜度」

---

## AI 執行步驟

### Step 1: 讀取輸入文件

讀取對應的 draft 或 spec 文件，提取：
- 所有模組名稱
- 每個模組的功能動作清單（FLOW 步驟）
- 每個模組的依賴關係（deps）
- 是否有外部服務依賴（AI API、第三方平台、不可控服務）

### Step 2: 隱含複雜度展開（優先執行）

對每個模組的每個動作，執行上方「展開步驟」。
**這是最重要的一步**，在做三問域識別之前先展開，確保分析的是真實複雜度而非表面描述。

### Step 3: 對每個模組做三問域識別

```
問 1: 這個模組的做法，現在清楚嗎？（展開後的完整步驟）
  → 清楚 → 傾向 Complicated 以上
  → 不清楚 → 傾向 Complex

問 2: 有沒有類似的東西做過或參考過？
  → 有 → 傾向 Complicated
  → 沒有 → 傾向 Complex

問 3: 如果做錯了，代價大嗎？
  → 大 → 需要更嚴謹的域識別與驗收標準
  → 小 → 允許較寬鬆的探索
```

三問組合推導域：
| 問1 | 問2 | 問3 | 推導域 |
|-----|-----|-----|--------|
| 清楚 | 有 | 任意 | Complicated |
| 清楚 | 沒有 | 小 | Complicated |
| 清楚 | 沒有 | 大 | Complex |
| 不清楚 | 任意 | 任意 | Complex |

### Step 4: 複雜度指標檢查

對每個模組計算（使用展開後的步驟數）：

| 指標 | 閾值 | 超標行為 |
|------|------|---------|
| FLOW 步驟數（展開後） | > 7 | 標記超標，建議拆分協調層 + subfunction |
| deps 數量 | > 5 | 標記超標，建議抽中間層 |
| Clear 同步等待 Complex | 任何一個 | 標記時間耦合，建議非同步隔離 |
| 隱含複雜度倍數 | > 3x | 標記為 BLOCKER，需要在文件中明確展開 |

### Step 5: 產出 Report JSON 並呼叫驗證腳本

**5-A: 將分析結果寫成 report JSON**

將上方所有模組的分析結果（Step 2-4）寫成一個 JSON 檔並存檔：

```
存檔位置: .gems/iterations/iter-X/logs/cynefin-report-<timestamp>.json
```

JSON 格式（必須完全符合 cynefin-log-writer.cjs 所需的 schema）：

```json
{
  "route": "Blueprint",
  "inputFile": "輸入文件路徑",
  "modules": [
    {
      "name": "模組名",
      "domain": "Clear|Complicated|Complex",
      "threeQuestions": {
        "q1_clear": true,
        "q2_reference": true,
        "q3_costly": false
      },
      "flowSteps": 4,
      "depsCount": 2,
      "timeCoupling": false,
      "implicitExpansion": ["Step 2 展開的隱含步驟（若展開後無明顯增加可省略）"],
      "issues": [
        {
          "level": "BLOCKER",
          "description": "問題具體描述",
          "suggestions": ["具體修改建議"],
          "fixTarget": "需要修改的文件路徑"
        }
      ]
    }
  ]
}
```

> **Issues 分級規則**：
> - `BLOCKER`：需要修改才能進 PLAN（FLOW 超標、deps 超標、隱含複雜度 >3x）
> - `WARNING`：提醒但不阻擋（輕度超標、非同步警告）
> - 無問題模組：`"issues": []`

**5-B: 執行結果驗證腳本**

呼叫腳本，讓腳本客觀判定是否送進 PLAN：

```bash
node sdid-tools/cynefin-log-writer.cjs \
  --report-file=.gems/iterations/iter-X/logs/cynefin-report-<timestamp>.json \
  --target=<project 根目錄> \
  --iter=<N>
```

**5-C: 終端輸出摘要**（腳本執行前，AI 先輸出简潔表格）：

```
@CYNEFIN-CHECK | <Blueprint|TaskPipe> | 待腳本判定...

模組: <模組名>
  域: <Clear|Complicated|Complex>  [三問推導]
  FLOW: <N> 步驟 <✓|⚠ 超標>
  deps: <N> <✓|⚠ 超標>
  隱含複雜度展開: <無|展開後 Nx 原始描述>
  待腳本確認...

...（所有模組）
```



### Step 6: 根據腳本輸出決定下一步

> **判定權在腳本，不在 AI。** AI 的分析是投票，腳本才是裁判。

**腳本輸出 `@PASS`：**
- AI 在輸入文件末尾加上 `CYNEFIN-CHECK: PASS | iter-X | <timestamp>` 標記
- 繼續進入 PLAN

**腳本輸出 `@NEEDS-FIX`：**
- 讀腳本輸出的 BLOCKER 清單（腳本已格式化好）
- 直接修改 draft 或 spec 中對應的模組描述（根據 `fixTarget` 和 `suggestions`）
- 修改完成後重跑（從 Step 1 開始），產出新的 report JSON，重新呼叫腳本
- 不進入 PLAN，直到腳本說 @PASS

---

## Log 檔命名規則

與現有 sdid-tools log 格式一致：

```
cynefin-check-pass-<timestamp>.log   ← @PASS 時
cynefin-check-fail-<timestamp>.log   ← @NEEDS-FIX 時
```

存放路徑：`.gems/iterations/iter-X/logs/`

timestamp 格式：`2026-02-22T10-30-00`（ISO，冒號換成連字號）

---

## 修改指引（@NEEDS-FIX 時）

### 隱含複雜度 → 在文件中明確展開

在 draft/spec 的模組動作清單裡，把隱含步驟明確寫出來：

```
修改前:
  auth: 支援第三方登入

修改後:
  auth:
    - oauthRedirect: 產生 OAuth URL → 導向第三方
    - oauthCallback: 接收 code → 換 token → 驗證
    - tokenRefresh: 偵測過期 → 自動 refresh
    - accountBinding: 檢查衝突 → 綁定或提示
```

### FLOW 超標 → 拆分模組動作

在 draft/spec 的模組動作清單裡，把一個大動作拆成：
- 一個協調層動作（薄，只負責呼叫順序）
- 多個子動作（各自職責單一）

範例：
```
修改前:
  processOrder: ValidateUser→CheckInventory→CalcDiscount→ProcessPayment→UpdateInventory→SendNotification→UpdateLoyaltyPoints→GenerateInvoice→LogAudit

修改後:
  processOrder (協調層): ValidateOrder→ProcessPayment→FulfillOrder→Notify
  orderValidator: ValidateUser→CheckInventory→CheckStock
  paymentProcessor: CalcDiscount→ChargePayment→RecordTransaction
  orderFulfiller: UpdateInventory→UpdateLoyaltyPoints→GenerateInvoice
  notifier: SendNotification→LogAudit
```

### deps 超標 → 抽中間層

在 deps 清單裡加一個 Facade 或 Service 層，把多個外部依賴包起來。

### 時間耦合 → 標記非同步需求

在模組描述裡加上 `[ASYNC]` 標記，說明這個模組需要非同步隔離設計。
BUILD 時 AI 根據這個標記推導非同步實作方式。

---

## 注意事項

- 閾值（FLOW > 7、deps > 5）是經驗值，不是絕對規則。小型專案（Level S）可以放寬。
- Complex 域不是壞事，是「還在探索中」的誠實聲明。不要強行把 Complex 改成 Complicated。
- 這個 check 是語意分析，不是程式碼掃描。判斷依據是文件裡的功能描述，不是實際程式碼。
- 每次重跑都產生新的 log，舊 log 保留（可追溯修改歷程）。
- **隱含複雜度展開是主動行為**，不要等使用者說「這個很複雜」才展開。
