# GEMS Next: Continuous Architecture Validation (2026 思維)

> **核心理念**：從「內嵌於程式碼的冗長標籤 (Embedded Tags)」進化為「極簡錨點對齊外部真實字典 (Minimal Anchors + SSOAT)」。
> **適用環境**：TypeScript / Node.js 專案（發揮 AST 極限威力）

## 1. 痛點與現狀 (2024-2025 的做法)

在早期的 SDID/GEMS 開發工作流中，我們依賴 AI 產生含有大量狀態標註的 JSDoc (例如：`GEMS-FLOW`, `GEMS-DEPS`, `GEMS-DEPS-RISK`) 並將它們直接塞入程式碼中。
這帶來了以下問題：

1. **污染原始碼 (Code Clutter)**：單純修改一個模組的 Risk Level 或是新增了依賴，卻需要建立 PR 更改業務源碼，讓 Git 歷史失真。
2. **AI 注意力耗損 (Token Fatigue)**：AI 在實作 (`BUILD Phase`) 時，必須花費高額的心智來回憶、排版出符合格式的 GEMS 星號註解，而無法專注於核心業務邏輯的演算法與防錯。
3. **假實作問題 (Fraud Implementation)**：標籤寫得再漂亮，裡面的防偽機制如果跟不上（像是只寫了 `// TODO`，或者偷偷少做一個步驟），仍容易造成架構與實際程式碼脫節。

## 2. 核心架構演進：單一真實來源 (Single Source of Truth)

與其要求開發者/AI 兼任「程式設計師」與「規格標籤員」，不如徹底分離這兩項職責。

### A. 外部知識字典 (The Dictionary - SSOAT)

架構的「約定」應存放在外部專門的字典檔中。為了兼顧 AI 可讀性與版控隔離，我們採用 **模組化 JSON 分片 (Modular JSON)** 作為存放載體。

- **為什麼不用單一 JSON (`spec-dictionary.json`)？** 當功能超過上百個時，單一巨型檔案會造成 AI 閱讀疲勞（Context 污染），且容易引發 Git 衝突。
- **解決方案 (分片化)**：以「腳本級別 (Script Level) 與 SPEC 拆出的模組」為主要劃分標準。與其用抽象的業務領域，不如讓每一份 JSON 字典檔精準對應到實體腳本或具體模組的粒度。例如 `.gems/specs/auth-api.json` 專職管轄 `auth-api.ts` 裡的函式群；`.gems/specs/pdf-text-extractor.json` 管轄特定的提取服務模組。
- **防錯與介入機制**：當 AI 在生成/修改這些規格 JSON 時，如果不小心把 JSON 寫錯了，人類可以非常輕易地介入修改純 JSON 檔。相比於傳統去成堆的程式碼裡撈出寫錯的標籤，這種「在字典端查錯」的成本極低。
- **內容範例 (`.gems/specs/auth-api.json`)**：
  ```json
  {
    "Auth.Login": {
      "priority": "P0",
      "depsRisk": "HIGH",
      "expectedSteps": [
        "VALIDATE_INPUT",
        "QUERY_USER",
        "HASH_COMPARE",
        "ISSUE_TOKEN"
      ],
      "allowedDeps": ["Database", "Crypto"]
    }
  }
  ```

### B. 極簡錨點程式碼 (Minimal Anchors)

程式庫內不再出現冗長的說明字串，只留下用來**尋址與定位**的記號：

- **功能識別證 (`@GEMS`)**：讓 AST Scanner 知道這個函式或類別歸屬於字典裡的哪筆紀錄。
- **步驟麵包屑 (`[STEP]`)**：讓 AST Scanner 能夠重組這個函式的內部處理流程。

```typescript
// @GEMS Auth.Login
async function login(req, res) {
  // [STEP] VALIDATE_INPUT
  const { user, pass } = req.body;

  // [STEP] QUERY_USER
  const record = await db.users.find(user);

  // [STEP] HASH_COMPARE
  const valid = compare(pass, record.hash);

  // [STEP] ISSUE_TOKEN
  return jwt.sign(record.id);
}
```

## 3. 門控機制 (Continuous Architecture Validation Gate)

把原本拿來單純「提取 JSON」的掃描工具，升級為 **「斷言測試器 (Test-Driven Architecture Runner)」**。這支 Node.js 環境的 CJS 腳本，將擔任無情的判官：

### 👉 雙向查核流程：

1. **掃描器解析 AST**：提取出 `login` 函式，讀取其上的 `@GEMS Auth.Login` 標籤，並解析出其內部擁有 4 個 `[STEP]` 實體，以及它的 `import` 依賴。
2. **對比外部字典**：掃描器拿 `Auth.Login` 去外部的 `.gems/specs/auth-api.json` 找尋這筆紀錄。
3. **執行斷言拋出結果 (GATE)**：
   - 🎯 **異常情境 A (缺少規格)**：如果程式碼寫了 `@GEMS xxx` 但所有 JSON 分片中都沒這筆資料 -> `@BLOCKER: 字典中未定義該功能，請先回到架構設計階段定義規格！`
   - 🎯 **異常情境 B (偷工減料)**：如果字典規定必須有 `[STEP] HASH_COMPARE`，但程式碼裡的 AST 找不到這行註解 -> `@BLOCKER: 實作缺漏，缺少 [STEP] HASH_COMPARE。`
   - 🎯 **異常情境 C (越權使用庫)**：如果程式碼出現了 `import fs from 'fs'`，但字典允許的 `allowedDeps` 沒有它 -> `@BLOCKER: 非法依賴引入。`

### 💡 終極理想：完全拆除實體規格腳本 (Zero-Script Spec)

你提出了一個極具破壞力的想法：「到底有沒有辦法實踐完全拆除腳本？全域 + FUNCTION 級別動作？」
答案是：**有的，這正是 AST 掃描器的最終歸宿**。

如果我們把架構徹底翻轉：

1. 你的 SDID 平台只維護 **UI 介面或是最核心的大字典 JSON**（這個字典定義了全域的高層次結構，以及底下的 Function 級別動作）。
2. 在寫碼階段，AI 或開發者完全不需要依賴我們額外去產生一個名為 `spec.md` 或 `implementation_plan.md` 的中間實體腳本。
3. AI 只要看著那個「全域字典 + Function 節點」，它就知道要進到哪隻檔案去實作 `[STEP]`。
4. Scanner 跑完後，直接產出**「現況的 JSON 結構」**，拿去跟**「理想的 JSON 字典」**比對。

**這樣就實現了「全域 (目標) + Function (單點實作)」的兩極化，中間不再需要任何冗餘的 markdown 計畫腳本！** 這是一套完全「規格即檢測 (Spec-as-Test)」的閉環機制。

## 4. 資訊壓縮與聚合：折衷的混合式壓縮 (Hybrid Compression)

從「把所有屬性寫進程式碼」直接跳躍到「純粹依賴外部字典」，步子可能邁得太大，在導入期會缺乏彈性。
我們在此提出一種**「折衷的極簡標籤 (Hybrid Compression)」**機制：**把一整疊狀態，壓縮成橫向的一條高密度 Information 來實施 Review。**

### 推薦的 GEMS 折衷壓縮格式：

```typescript
// @GEMS <P優先級> | <領域動作> | FLOW: <步驟A>→<步驟B> | DEPS: <依賴1>,<依賴2>
```

**實戰範例對比：**

❌ **傳統版 (Data Dumping - 佔版面且易干擾 AI)：**

```typescript
/**
 * GEMS: AuthService_login
 * GEMS-PRIORITY: P0
 * GEMS-FLOW: VALIDATE_INPUT -> VERIFY_HASH -> ISSUE_TOKEN
 * GEMS-DEPS: Database, Crypto, JWT
 * GEMS-DEPS-RISK: HIGH
 */
async function login(req, res) { ... }
```

✅ **壓縮版 (Information Compression - 一目瞭然的高密度資訊)：**

```typescript
// @GEMS [P0] Auth.Login | FLOW: VALIDATE -> VERIFY -> ISSUE | DEPS: Db,Crypto,JWT
async function login(req, res) { ... }
```

### 為什麼這套折衷方案是 Review 機制的終極進化？

1. **單視角檢視 (Single-Glance Review)**：在進行 Code Review 時，不再需要閱讀成堆的 JSDoc 設計理念，開發者與 AI 只需要檢視這單一一行代碼。它就跟 HTTP Request 的 Log 一樣緊湊。
2. **引導性語義壓縮 (Semantic Compression for Guidance)**：
   我們不再使用充滿實作細節的 `AuthService_login`，而是採用如 `Auth.Login` 或 `API/Auth/Login` 這種簡短的 Token。
   _精髓在於：這些簡短的 Token 給予了寫碼 AI 充足的「業務想像空間與邊界提示」，這叫做具備引導性的抽象壓縮。_
3. **Reviewer 視角的淨化**：Reviewer (AI Copilot 或人類) 只需要看一眼這一行「壓縮資訊」，再去核對這支函式的邏輯有沒有超出它的宣告。不需再為換行排版與冗長的註解格式傷腦筋。
4. **無痛相容現有 Scanner**：我們現有的 `gems-scanner-enhanced.cjs` 或 `gems-validator-lite.cjs` 底層是用正則表達式過濾特定關鍵字的。只要 Regex 寫得夠好 (能捕捉 `FLOW:` 以及 `DEPS:`)，這種單行壓縮格式**完全可以直接被現有的 Scanner 讀懂，不需徹底重寫 CJS 門控**！

## 5. 2026 年實務上的優勢

1. **架構權與施工權的物理隔離**：AI 寫碼搞砸了只有那幾行會壞，架構依然安全地躺在唯讀的 JSON 裡。
2. **一有異常，對症下藥**：因為有了外部字典的對比機制，**如果規格改變，去改字典 (JSON)；如果邏輯缺漏，去改程式碼**。職責一清二楚且容易人類介入復原。
3. **讓 SDID 流程更神經直覺 (Agentic Search & Read)**：
   **這是對 LLM 能力最極致的運用**。日後的 `BUILD Phase` 不需再「被動灌食」一堆巨量實作腳本給 AI，而是讓 AI 發揮 Agent 代理人的「局部閱讀與精準替換」能力。
   - **任務指派**：只告訴 AI「功能 ID 是 `Auth.Login`，目標檔案是 `auth-api.ts`」。
   - **AI 主動查閱**：AI 使用 SEARCH 工具自己去 JSON 字典看 `Auth.Login` 需要哪些步驟。
   - **精準替換**：因為邊界明確且只依賴 JSON，AI 可以精準只替換那幾行 `[STEP]` 邏輯，大幅降低 Token 消耗，並徹底消除傳統「整頁重寫程式碼」容易引發的架構崩壞災難。
4. **極致乾淨的代碼 (Clean Code)**：終於可以把程式碼中的那坨星號註解還給歷史，留下最純粹的工程語言。

## 6. AI 局部閱讀能力 (Pagination / Chunked Reading) 的完美契合

過去的痛點在於，當系統把上千行的程式碼連同落落長的規格全塞給 AI 時，容易導致 **「注意力丟失 (Lost in the Middle)」** 或是因為過長導致 AI 在回應時產生幻覺，去覆寫掉不相干的邏輯。

在 2026 版本的架構下，這項設計與現代 AI Agent 的**局部閱讀 / 分塊檢視 (Chunked Reading)** 能力達到了天作之合。

### AI 閱讀與實作的真實路徑：
1. **全域檢索極小化**：AI 不需要閱讀整包 codebase，它只要使用 `read_file` 讀取 `.gems/specs/auth-api.json` （或許只有不到 20 行）。AI 取得了這個 Task 單元的絕對無雜質 Context（有什麼 Step，能 Import 什麼）。
2. **精準定錨與局部載入**：AI 對原始碼下達 `search` 或 `grep` 尋找 `// @GEMS Auth.Login`，得知該函式位於第 80 行。接著，AI 只會請求閱讀第 80 到 120 行（`startLine: 80, endLine: 120`）。
3. **無損的微觀開刀手術**：對 AI 來說，它左手拿著極端精確的 JSON 規格，右手看著毫無干擾的 40 行原碼。在這種 **超高密度的完美 Context** 狀態下，AI 即便只使用「局部替換」來寫程式碼，它也**絕對不會漏掉重要的架構依賴或是上下文**，因為全域的約束早就在那一小塊 JSON 裡面宣告完畢了。

這種設計徹底解開了「大型專案 Token 爆炸」的死結，讓 AI 能安心地像一名外科醫生一樣只劃開並修復需要的那幾公分程式碼。
