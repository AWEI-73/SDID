# SDID 2026 全局結構圖 — 完整接線版

> **版本**: v4.1 | **日期**: 2026-02-27
> **定位**: SDID 全系統的完整架構接線圖，涵蓋現行機制 + 2026 GEMS 字典演進
> **核心變更**: 標籤有生命週期——寫時完整、驗後 Shrink、讀時極簡。字典是規格真相源，錨點是 hub 路標。

---

## 0. 一句話定義（2026 版）

SDID 是一套「AI 驗收協議」。2026 演進的核心是：**字典即規格，錨點即路標，標籤寫完即 Shrink，Gate 讀字典不讀程式碼。**

---

## 1. 全局架構總覽

```
╔══════════════════════════════════════════════════════════════════════════╗
║                         使用者意圖入口                                  ║
╚══════════════════════════╦═══════════════════════════════════════════════╝
                           ║
              ┌────────────╨────────────┐
              │    SKILL.md Hub 路由     │
              └────┬───────┬───────┬────┘
                   │       │       │
         ┌─────────┘       │       └──────────┐
         ▼                 ▼                   ▼
   ┌───────────┐   ┌──────────────┐   ┌──────────────┐
   │ MICRO-FIX │   │  Blueprint   │   │  Task-Pipe   │
   │  (旁路)    │   │  (80% 情境)  │   │  (獨立路線)   │
   └─────┬─────┘   └──────┬───────┘   └──────┬───────┘
         │                 │                   │
         │                 ▼                   ▼
         │         ┌──────────────┐    ┌──────────────┐
         │         │ 5 輪對話      │    │ POC Step 1-4 │
         │         │ Enhanced Draft│    │ UI + Contract │
         │         └──────┬───────┘    └──────┬───────┘
         │                │                   │
         │                ▼                   │
         │         ┌──────────────┐            │
         │         │blueprint-gate│            │
         │         │ (17 項檢查)   │            │
         │         └──────┬───────┘            │
         │                │                   │
         │                ▼                   ▼
         │    ┌─────────────────────────────────────┐
         │    │          POC Quick                   │
         │    │  快速邏輯驗證 + 功能骨架              │
         │    │  程式碼中帶 @GEMS 壓縮錨點 + [STEP]   │
         │    └──────────────┬──────────────────────┘
         │                   │
         │                   ▼
         │    ┌─────────────────────────────────────┐
         │    │     ★ Skill: 產物整理 + 字典生成 ★    │
         │    │                                     │
         │    │  IN:  程式碼（壓縮錨點 + [STEP]）      │
         │    │  OUT: .gems/specs/*.json（字典）      │
         │    │                                     │
         │    │  · AST 掃描 export/import            │
         │    │  · 萃取 @GEMS 行 → 解析語意           │
         │    │  · 萃取 [STEP] + 說明 → steps 欄位    │
         │    │  · 推斷 DEPS/RISK → deps 欄位        │
         │    │  · 生成字典 JSON                     │
         │    └──────────────┬──────────────────────┘
         │                   │
         │                   ▼
         │    ┌─────────────────────────────────────┐
         │    │         .gems/specs/*.json           │
         │    │       ★ 字典 = 唯一規格真相源 ★        │
         │    │                                     │
         │    │  · 完整 DEPS（精確到表名/模組名）       │
         │    │  · RISK 等級                         │
         │    │  · TEST 狀態                         │
         │    │  · AC（Given/When/Then）              │
         │    │  · Story ref                         │
         │    │  · FLOW + STEP 說明                   │
         │    │  · allowedDeps                       │
         │    │  · Cynefin 域分類                     │
         │    └──────────┬──────┬───────────────────┘
         │               │      │
         │        ┌──────┘      └──────┐
         │        ▼                    ▼
         │  ┌───────────┐     ┌──────────────────┐
         │  │spec-gate  │     │  CYNEFIN-CHECK    │
         │  │字典品質門控 │     │  讀字典做域分類    │
         │  │繼承 TAG/   │     │  Budget 計算      │
         │  │FLOW/API    │     └────────┬─────────┘
         │  │系列檢查    │              │
         │  └─────┬─────┘              │
         │        │                    │
         │        └────────┬───────────┘
         │                 │
         │                 ▼
         │    ┌─────────────────────────────────────┐
         │    │         BUILD Phase 1-8              │
         │    │                                     │
         │    │  Phase 1: 骨架檢查                   │
         │    │  Phase 2: ★ 字典↔程式碼雙向比對 ★     │◄── 核心變更
         │    │           讀 JSON 字典               │
         │    │           掃程式碼 @GEMS 錨點 + [STEP]│
         │    │           差異 → BLOCKER/WARN        │
         │    │  Phase 3: 測試腳本                   │
         │    │  Phase 4: Test Gate                  │
         │    │  Phase 5: TDD 執行                   │
         │    │  Phase 6: 整合測試                   │
         │    │  Phase 7: 整合檢查                   │
         │    │  Phase 8: Fillback + 字典同步更新     │◄── 核心變更
         │    └──────────────┬──────────────────────┘
         │                   │
         │                   ▼
         │    ┌─────────────────────────────────────┐
         │    │     ★ tag-shrink（新機制）★           │
         │    │                                     │
         │    │  觸發: BUILD Phase 8 @PASS 後        │
         │    │                                     │
         │    │  完整 JSDoc block                    │
         │    │    → 搬進 .gems/specs/*.json 字典    │
         │    │                                     │
         │    │  程式碼中 JSDoc block                 │
         │    │    → 壓縮成一行錨點 + 行數             │
         │    │    // @GEMS [P1] Meal.Load | L80-120 │
         │    │    //   → .gems/specs/meal-svc.json  │
         │    │                                     │
         │    │  [STEP] + 說明 → 保留不動             │
         │    └──────────────┬──────────────────────┘
         │                   │
         │                   ▼
         │    ┌─────────────────────────────────────┐
         │    │    ★ Skill: 標籤審查 + 持續監控 ★     │
         │    │                                     │
         │    │  · 字典 JSON ↔ 程式碼錨點 差異報告    │
         │    │  · 缺失的 [STEP] 提醒                │
         │    │  · 新增函式未登錄字典 提醒             │
         │    │  · DEPS 變更未同步 提醒               │
         │    │  · 可掛在 Phase 2 或獨立 check        │
         │    └──────────────┬──────────────────────┘
         │                   │
         ▼                   ▼
   ┌──────────────────────────────┐
   │        完成 / 下一個 iter      │
   │  SHRINK → VERIFY → CONTINUE  │
   └──────────────────────────────┘
```

---

## 2. 標籤生命週期 — 寫時完整、驗後 Shrink、讀時極簡

```
┌─────────────────────────────────────────────────────────────────────┐
│                     標籤的一生（Tag Lifecycle）                       │
│                                                                     │
│  ❶ 誕生（BUILD 階段 — 你/AI 正在寫程式碼）                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  /**                                                         │  │
│  │   * GEMS: loadClassMealData | P1 | ✓✓ | (classId,weekId)→   │  │
│  │   *       Promise<MealData[]> | Story-16.1 | 載入用餐資料     │  │
│  │   * GEMS-FLOW: Validate→Query→Map→Return                    │  │
│  │   * GEMS-DEPS: [Database.tbl_students], [Database.tbl_meals] │  │
│  │   * GEMS-DEPS-RISK: LOW                                     │  │
│  │   * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E               │  │
│  │   */                                                         │  │
│  │  // [STEP] Validate — 檢查 classId, weekId 有效              │  │
│  │  // [STEP] Query — 查 tbl_students + tbl_meals               │  │
│  │  // [STEP] Map — toMealDataDomain 轉換                       │  │
│  │  // [STEP] Return                                            │  │
│  └───────────────────────────────────────────────────────────────┘  │
│       完整標籤是給 Gate 驗證用的。你需要所有欄位來確認設計正確。         │
│                                                                     │
│                          │                                          │
│                          ▼                                          │
│  ❷ 驗證（Phase 2 標籤驗收 → Phase 5 TDD → Phase 8 Fillback）        │
│                                                                     │
│       Gate 讀完整 JSDoc，逐欄檢查：                                   │
│       · FLOW 步驟數 = [STEP] 數量 ✓                                  │
│       · DEPS 精確到表名 ✓                                            │
│       · P1 有 Unit + Integration ✓                                   │
│       · 全部 @PASS                                                   │
│                                                                     │
│                          │                                          │
│                          ▼                                          │
│  ❸ Shrink（★ 新機制 — tag-shrink ★）                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │  完整 JSDoc block ──→ 搬進字典 JSON                            │  │
│  │                         .gems/specs/meal-service.json         │  │
│  │                                                               │  │
│  │  程式碼中 JSDoc ──→ 壓縮成錨點                                  │  │
│  │                                                               │  │
│  │  // @GEMS [P1] Meal.LoadClassData | FLOW: Validate→Query→    │  │
│  │  //       Map→Return | L80-120                                │  │
│  │  //   → .gems/specs/meal-service.json                         │  │
│  │  async function loadClassMealData(classId, weekId) {          │  │
│  │    // [STEP] Validate — 檢查 classId, weekId 有效             │  │
│  │    ...                                                        │  │
│  │    // [STEP] Query — 查 tbl_students + tbl_meals              │  │
│  │    ...                                                        │  │
│  │    // [STEP] Map — toMealDataDomain 轉換                      │  │
│  │    ...                                                        │  │
│  │    // [STEP] Return                                           │  │
│  │  }                                                            │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│       壓縮錨點帶行數（L80-120），AI 看到就知道：                       │
│       · 這個函式在第 80-120 行                                       │
│       · 完整規格在 meal-service.json                                 │
│       · 不需要讀這個檔案的其他部分                                    │
│                                                                     │
│                          │                                          │
│                          ▼                                          │
│  ❹ 日常使用                                                         │
│                                                                     │
│  ┌─ 你看程式碼 ─────────────────────────────────────────────────┐   │
│  │  掃壓縮標籤行 → 知道語意 + 優先級                              │   │
│  │  掃 [STEP] 說明 → 知道每步在幹什麼                             │   │
│  │  需要細節 → 點進字典 JSON 看                                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─ AI 來施工 ──────────────────────────────────────────────────┐   │
│  │  讀 _index.json → 找到目標函式在哪個字典檔                     │   │
│  │  讀字典 JSON → 取得 DEPS/AC/STEP（20 行，超精準 context）      │   │
│  │  grep @GEMS Meal.LoadClassData → 定位到 L80                   │   │
│  │  只讀 L80-120 → 局部替換                                      │   │
│  │  不讀其他函式、不讀完整檔案                                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─ Gate 腳本 ──────────────────────────────────────────────────┐   │
│  │  require('.gems/specs/meal-service.json')                     │   │
│  │  一行讀進結構化資料，不用 regex                                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                          │                                          │
│                          ▼                                          │
│  ❺ 變更（下次修改這個函式時）                                        │
│                                                                     │
│       修改程式碼 → Skill B 偵測錨點↔字典不同步                       │
│       → 更新字典 JSON → Gate 重新驗證 → Shrink 更新行數              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 錨點作為 Hub 的引導機制

```
AI 打開一個 500 行的檔案，看到的是：

L1   // @GEMS [P0] Auth.Login | FLOW: Validate→Query→Hash→Issue | L3-45
L2   //   → .gems/specs/auth-api.json
L3   async function login(req, res) { ... }
     ...
L46  // @GEMS [P1] Auth.Register | FLOW: Validate→Create→Send→Return | L46-95
L47  //   → .gems/specs/auth-api.json
L48  async function register(req, res) { ... }
     ...
L96  // @GEMS [P2] Auth.ParseToken | FLOW: Decode→Verify→Return | L96-115
L97  //   → .gems/specs/auth-middleware.json
L98  function parseToken(token) { ... }
     ...

AI 不需要讀 500 行。它看到的是一份「目錄」：
  · 3 個函式，各自的語意、優先級、行數範圍
  · 需要哪個就去讀哪段 + 對應的字典

這就是 hub 引導：錨點是路標，字典是目的地，行數是座標。
```

---

## 3. 程式碼 ↔ 字典 的對應關係

```
┌─ 程式碼（人類 + AI 看的） ─────────────────────────────────────────┐
│                                                                  │
│  // @GEMS [P0] Auth.Login | FLOW: Validate→Query→Hash→Issue      │ ← 壓縮語意（一行）
│  //   → .gems/specs/auth-api.json                                │ ← 字典位置（一行）
│  async function login(req, res) {                                │
│    // [STEP] Validate — 檢查 email 格式與必填欄位                  │ ← STEP + 說明
│    const { user, pass } = validateInput(req.body);               │
│                                                                  │
│    // [STEP] Query — 用 email 查 tbl_users                       │
│    const record = await db.users.find(user);                     │
│                                                                  │
│    // [STEP] Hash — bcrypt compare                               │
│    if (!compare(pass, record.hash)) throw new AuthError();       │
│                                                                  │
│    // [STEP] Issue — 簽發 JWT，有效期 24h                          │
│    return jwt.sign({ id: record.id }, '24h');                    │
│  }                                                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
        │                              ▲
        │  Skill A 萃取生成              │  Skill B 比對差異
        ▼                              │
┌─ 字典 JSON（機器 + Gate 讀的） ────────┴─────────────────────────────┐
│                                                                    │
│  // .gems/specs/auth-api.json                                      │
│  {                                                                 │
│    "Auth.Login": {                                                 │
│      "priority": "P0",                                             │
│      "targetFile": "src/modules/auth/services/auth-api.ts",        │
│      "flow": "Validate→Query→Hash→Issue",                          │
│      "steps": {                                                    │
│        "Validate": "檢查 email 格式與必填欄位",                      │
│        "Query": "用 email 查 tbl_users",                            │
│        "Hash": "bcrypt compare",                                   │
│        "Issue": "簽發 JWT，有效期 24h"                               │
│      },                                                            │
│      "deps": {                                                     │
│        "Database.tbl_users": "查詢",                                │
│        "Lib.bcrypt": "密碼比對",                                     │
│        "Lib.jsonwebtoken": "JWT 簽發"                               │
│      },                                                            │
│      "depsRisk": "MEDIUM",                                         │
│      "allowedDeps": ["pg", "bcrypt", "jsonwebtoken"],              │
│      "test": { "unit": true, "integration": true, "e2e": false }, │
│      "testFile": "auth-api.test.ts",                               │
│      "storyRef": "Story-1.1",                                      │
│      "cynefinDomain": "complicated-costly",                        │
│      "ac": [                                                       │
│        "Given valid creds, When login, Then JWT",                  │
│        "Given wrong pass, When login, Then 401"                    │
│      ]                                                             │
│    }                                                               │
│  }                                                                 │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 誰看什麼

```
┌──────────────┬─────────────────────────────────┬──────────────────┐
│   角色        │  看什麼                          │  不需要看什麼      │
├──────────────┼─────────────────────────────────┼──────────────────┤
│ 你（開發者）   │ 壓縮標籤行 + [STEP] 說明          │ DEPS 細節、TEST  │
│              │                                 │ 狀態、AC、RISK    │
├──────────────┼─────────────────────────────────┼──────────────────┤
│ AI（施工）    │ 字典 JSON 的目標函式段落           │ 其他函式的字典     │
│              │ + 程式碼中 [STEP] 定位            │                  │
├──────────────┼─────────────────────────────────┼──────────────────┤
│ Gate 腳本    │ 字典 JSON（結構化讀取）            │ 程式碼內容        │
│              │ + 程式碼錨點（比對用）              │ （只掃錨點）       │
├──────────────┼─────────────────────────────────┼──────────────────┤
│ Scanner      │ 字典 JSON（期望）                 │ JSDoc block      │
│              │ + AST（實際 import/export/STEP） │ （已不存在）       │
└──────────────┴─────────────────────────────────┴──────────────────┘
```

---

## 4. 兩條路線的完整流程（2026 版）

### 3.1 Blueprint 路線（80% 情境）

```
[1] 5 輪對話
    │  產出: Enhanced Draft（模組結構、迭代規劃、動作清單）
    ▼
[2] blueprint-gate.cjs（17 項檢查）
    │  讀: Enhanced Draft markdown
    │  驗: 格式完整性、DAG、依賴循環、Level 限制、Flow 精確度
    │  出: @PASS → 繼續 / @BLOCKER → 修復
    ▼
[3] POC Quick
    │  目的: 快速邏輯驗證（硬幹探索，不走完整 task-pipe POC）
    │  產出: 可運行的程式碼 + 壓縮 @GEMS 錨點 + [STEP] 說明
    │  重點: 先讓邏輯跑通，標籤後補也行
    ▼
[4] ★ Skill A: 產物整理 + 字典生成 ★
    │  讀: POC Quick 的程式碼
    │  做: AST 掃描 → 萃取錨點 + STEP → 推斷 DEPS
    │  寫: .gems/specs/*.json（字典）
    │  補: 程式碼中缺的壓縮錨點行（如果你 POC 時沒寫）
    ▼
[5] spec-gate（新 Gate）
    │  讀: .gems/specs/*.json
    │  驗: techName 完整性、Flow 精確度、DEPS 合法性、API 簽名
    │  繼承: blueprint-gate 的 TAG/FLOW/API/SIG 系列檢查
    │  出: @PASS / @BLOCKER
    ▼
[6] CYNEFIN-CHECK
    │  讀: .gems/specs/*.json（字典中的函式清單 + 優先級 + DEPS）
    │  做: 語意域分類（Clear / Complicated / Complex）
    │  寫: cynefinDomain 回寫字典 JSON（或獨立 report）
    │  驗: Budget 計算 → @PASS / @NEEDS-FIX
    ▼
[7] BUILD Phase 1-8
    │  Phase 2 讀字典做標籤驗收（不再 parse JSDoc）
    │  Phase 8 Fillback 同步更新字典
    ▼
[8] ★ tag-shrink（新機制）★
    │  觸發: Phase 8 @PASS 之後自動執行
    │  做: 完整 JSDoc block → 搬進字典 JSON
    │      程式碼中 JSDoc → 壓縮成錨點 + 行數
    │  結果: 程式碼瞬間變乾淨，字典保留完整資訊
    ▼
[9] ★ Skill B: 標籤審查（持續監控）★
    │  時機: Phase 2 位置 或 BUILD 後獨立 check
    │  做: 字典 ↔ 程式碼錨點 差異報告
    ▼
[10] SHRINK → VERIFY → 下一個 iter 或完成
```

### 3.2 Task-Pipe 路線（獨立存在）

```
[1] POC Step 1-4（UI 驗證 + Contract 設計）
    │  產出: POC HTML/TSX + @GEMS 標籤
    ▼
[2] POC Step 5（萃取規格）
    │  讀: POC 產物中的 @GEMS 標籤
    │  寫: requirement_spec markdown
    │  ★ 2026 變更: 同時生成 .gems/specs/*.json 字典 ★
    ▼
[3] CYNEFIN-CHECK
    │  讀: 字典 JSON
    ▼
[4] PLAN Step 1-5
    │  讀: 字典 JSON + requirement_spec
    │  寫: implementation_plan
    ▼
[5] BUILD Phase 1-8（同上）
    ▼
[6] SCAN
```

### 3.3 MICRO-FIX（旁路）

```
觸發詞 → Escalation Check → 直接改 → micro-fix-gate
                                        │
                                        ├── 讀字典 JSON 確認改動範圍
                                        └── 不經過 CYNEFIN / 完整 BUILD
```

---

## 5. 字典生態系統

### 4.1 字典的生命週期

```
┌─────────────────────────────────────────────────────────────┐
│                    字典生命週期                               │
│                                                             │
│  誕生 ─────────────────────────────────────────────────      │
│  │                                                          │
│  ├─ Blueprint 路線: Skill A 從 POC Quick 產物生成            │
│  ├─ Task-Pipe 路線: Step 5 萃取時同步生成                    │
│  └─ 手動建立: 你直接寫 JSON（複雜架構決策時）                 │
│                                                             │
│  驗證 ─────────────────────────────────────────────────      │
│  │                                                          │
│  ├─ spec-gate: 結構完整性（必填欄位、Flow 精確度）            │
│  ├─ CYNEFIN: 域分類 + Budget（回寫 cynefinDomain）           │
│  └─ blueprint-gate: 模組級檢查（DAG、循環、Level 限制）       │
│                                                             │
│  使用 ─────────────────────────────────────────────────      │
│  │                                                          │
│  ├─ BUILD Phase 2: 字典 ↔ 程式碼錨點 比對                   │
│  ├─ AI 施工: 讀字典取得 DEPS/STEP/AC 做局部實作              │
│  ├─ Skill B: 持續監控差異                                   │
│  └─ 你 Review: 只看壓縮標籤行（字典提供完整 context）         │
│                                                             │
│  Shrink ───────────────────────────────────────────────      │
│  │                                                          │
│  ├─ tag-shrink: Gate 全過後，完整 JSDoc → 字典 JSON          │
│  │              程式碼 JSDoc → 壓縮錨點 + 行數                │
│  └─ 觸發: Phase 8 @PASS 後自動執行（同 blueprint-shrink）    │
│                                                             │
│  更新 ─────────────────────────────────────────────────      │
│  │                                                          │
│  ├─ BUILD Phase 8 Fillback: 自動同步更新                     │
│  ├─ Skill A 重跑: 程式碼變更後重新萃取                       │
│  └─ 手動修改: 架構決策變更時直接改 JSON                      │
│                                                             │
│  退役 ─────────────────────────────────────────────────      │
│  │                                                          │
│  └─ SHRINK: 已完成 iter 的字典折疊為摘要                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 字典分片策略

```
.gems/
├── specs/                          ← 字典根目錄
│   ├── auth-api.json               ← 管轄 src/modules/auth/services/auth-api.ts
│   ├── auth-middleware.json         ← 管轄 src/modules/auth/middleware.ts
│   ├── todo-service.json           ← 管轄 src/modules/todo/services/todo-service.ts
│   ├── todo-components.json        ← 管轄 src/modules/todo/components/*.tsx
│   ├── shared-utils.json           ← 管轄 src/shared/utils/*.ts
│   └── _index.json                 ← ★ 全域索引（所有函式 ID → 字典檔案映射）
│
├── iterations/                     ← 不變
│   └── iter-X/...
│
└── project-memory.json             ← 不變
```

**`_index.json`（全域索引）**：
```json
{
  "Auth.Login":        "specs/auth-api.json",
  "Auth.Register":     "specs/auth-api.json",
  "Auth.Middleware":    "specs/auth-middleware.json",
  "Todo.Add":          "specs/todo-service.json",
  "Todo.List":         "specs/todo-service.json",
  "TodoCard":          "specs/todo-components.json"
}
```

AI 施工時只需要：
1. 讀 `_index.json` 找到目標函式在哪個字典檔
2. 讀那一個字典檔（可能只有 20 行）
3. 對程式碼 grep `@GEMS Auth.Login` 定位函式
4. 局部閱讀 + 精準替換

---

## 6. Gate 全覽（2026 版）

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Gate 資料來源對照                              │
│                                                                      │
│  Gate              │ 現在讀什麼           │ 2026 讀什麼               │
│  ─────────────────────────────────────────────────────────────────── │
│  blueprint-gate    │ Enhanced Draft MD    │ Enhanced Draft MD（不變） │
│  spec-gate (新)    │ -                    │ .gems/specs/*.json       │
│  CYNEFIN           │ spec MD / draft MD   │ .gems/specs/*.json       │
│  Phase 2 標籤驗收   │ 程式碼 JSDoc (regex) │ .gems/specs/*.json       │
│                    │                      │ + 程式碼錨點 (比對)       │
│  Phase 4 Test Gate │ 測試檔案 import      │ 不變                     │
│  Phase 5 TDD       │ 測試執行結果          │ 不變                     │
│  Phase 8 Fillback  │ 程式碼掃描           │ 程式碼掃描 + 字典同步更新  │
│  tag-shrink (新)   │ -                    │ 完整 JSDoc → 字典 + 錨點  │
│  SHRINK            │ 主藍圖 MD            │ 主藍圖 MD + 字典折疊      │
│  VERIFY            │ 藍圖↔源碼比對        │ 字典↔源碼比對             │
│  micro-fix-gate    │ 局部變更檢查          │ 局部變更 + 字典範圍確認    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. 標籤格式對照（舊 → 新）

### 7.1 程式碼中的變化（標籤生命週期）

```
┌─ ❶ 寫的時候（BUILD 階段，完整 JSDoc — Gate 要驗）──────────────────┐
│                                                                  │
│  /**                                                             │
│   * GEMS: loadClassMealData | P1 | ✓✓ | (classId, weekId)→      │
│   *       Promise<MealData[]> | Story-16.1 | 載入班級用餐資料     │
│   * GEMS-FLOW: ValidateInput→QueryDatabase→MapToDomain→Return    │
│   * GEMS-DEPS: [Database.tbl_roster_students (查詢學員)],        │
│   *            [Database.tbl_meal_log (查詢記錄)],               │
│   *            [Lib.supabaseClient (連線)],                      │
│   *            [Internal.toMealDataDomain (轉換)]                │
│   * GEMS-DEPS-RISK: LOW                                         │
│   * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E                   │
│   * GEMS-TEST-FILE: previewService.test.ts                       │
│   */                                                             │
│  // [STEP] ValidateInput — 檢查 classId, weekId 有效             │
│  // [STEP] QueryDatabase — 查 tbl_students + tbl_meals            │
│  // [STEP] MapToDomain — toMealDataDomain 轉換                   │
│  // [STEP] Return                                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                    │
                    │  Gate 全過 → tag-shrink 執行
                    ▼
┌─ ❷ Shrink 後（日常閱讀，極簡錨點 + 行數）───────────────────────┐
│                                                                  │
│  // @GEMS [P1] Meal.LoadClassData | FLOW: Validate→Query→        │
│  //       Map→Return | L80-120                                   │
│  //   → .gems/specs/meal-service.json                            │
│  async function loadClassMealData(classId, weekId) {             │
│    // [STEP] ValidateInput — 檢查 classId, weekId 有效           │
│    ...                                                           │
│    // [STEP] QueryDatabase — 查 tbl_students + tbl_meals          │
│    ...                                                           │
│    // [STEP] MapToDomain — toMealDataDomain 轉換                 │
│    ...                                                           │
│    // [STEP] Return                                              │
│  }                                                               │
│                                                                  │
│  8 行 JSDoc → 2 行錨點。DEPS/RISK/TEST 全在字典裡。              │
│  [STEP] + 說明保留不動，因為這是你要看的。                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 壓縮標籤語法（Shrink 後）

```
// @GEMS [P{0-3}] {Domain}.{Action} | FLOW: {Step1}→{Step2}→... | L{start}-{end}
//   → {字典路徑}
```

| 欄位 | 必填 | 說明 |
|------|------|------|
| `[P0-P3]` | ✅ | 優先級 |
| `Domain.Action` | ✅ | 語意 ID（字典 key） |
| `FLOW: ...` | ✅ P0/P1 | 步驟摘要 |
| `L{start}-{end}` | ✅ | 函式行數範圍（AI 定位用） |
| `→ 字典路徑` | ✅ | 指向完整規格 |

注意：`DEPS` 不再出現在錨點裡，完整 DEPS 在字典 JSON 中。壓縮錨點只保留 AI 和你需要一眼看到的東西：這是什麼、怎麼跑、在哪裡。

### 6.3 [STEP] 錨點格式（不變，加說明）

```typescript
// [STEP] StepName — 一句話說明這步在幹什麼
```

P0/P1 強制，P2/P3 可選。這個規則跟現有 tagging guide v3.0 一致。

---

## 8. 遷移策略

```
Phase A: 字典先到位
─────────────────────────────────────────────
· 定義字典 JSON Schema
· 拿一個專案手動寫字典驗證格式
· 寫 Skill A（自動從程式碼生成字典）
· 新專案 / POC Quick 直接用壓縮格式 + 字典

Phase B: 腳本接線
─────────────────────────────────────────────
· Phase 2 scanner 改讀 JSON（gems-scanner-v2.cjs）
· spec-gate 上線（繼承 blueprint-gate TAG 系列檢查）
· CYNEFIN 改讀字典 JSON
· Phase 8 Fillback 加字典同步更新

Phase C: 舊格式退役（不急）
─────────────────────────────────────────────
· 寫轉換器：JSDoc block → 壓縮錨點 + 字典 JSON
· 批次轉換現有專案
· gems-scanner-v1.cjs 退役
· JSDoc block 格式正式 deprecated
```

### 向後相容

```
gems-scanner-v1.cjs  ← 現有的（讀 JSDoc block），保留不動
gems-scanner-v2.cjs  ← 新的（讀 @GEMS 壓縮錨點 + JSON 字典）
phase-2.cjs          ← 讀 .gems/specs/ 目錄
                        有 specs/*.json → 走 v2
                        沒有 specs/     → 走 v1（fallback）
```

---

## 9. 四層資料模型（2026 版）

```
┌─────────────────────────────────────────────────────────────┐
│  SPEC (規格字典) — ★ 新增層 ★                                │
│  位置: .gems/specs/*.json                                   │
│  職責: 這個函式該做什麼、能用什麼、怎麼驗收                   │
│  讀寫: Skill A 生成、Gate 讀取、Phase 8 同步更新             │
├─────────────────────────────────────────────────────────────┤
│  STATE (狀態機) — 不變                                       │
│  位置: .gems/iterations/iter-X/.state.json                  │
│  職責: 現在在哪、重試幾次了、策略漂移到哪層                   │
│  讀寫: runner.cjs 啟動時讀、step 結束時寫                    │
├─────────────────────────────────────────────────────────────┤
│  LOG (任務接收機) — 不變                                     │
│  位置: .gems/iterations/iter-X/logs/*.log                   │
│  職責: 這次具體錯什麼、怎麼修                                │
│  讀寫: 腳本寫、AI 透過 @READ 讀                              │
├─────────────────────────────────────────────────────────────┤
│  MEMORY (記憶彙總) — 不變                                    │
│  位置: .gems/project-memory.json                            │
│  職責: 歷史上哪裡容易出問題                                   │
│  讀寫: 腳本 append、runner 啟動時讀 (@MEMORY/@PITFALL)       │
└─────────────────────────────────────────────────────────────┘

SPEC 是契約，STATE 是游標，LOG 是細節，MEMORY 是趨勢。
```

---

## 10. 核心原則（2026 增補）

| # | 原則 | 說明 |
|---|------|------|
| 1 | 腳本決定，AI 執行 | 不變 |
| 2 | 資訊落差驅動行為 | 不變 |
| 3 | 結構化記憶 > 語義記憶 | 不變 |
| 4 | Gate 比記憶重要 | 不變 |
| 5 | 預防優於追蹤 | 不變 |
| 6 | 展開隱含複雜度 | 不變 |
| 7 | **字典即規格** | 規格不在程式碼裡，在字典 JSON 裡。程式碼只有錨點。 |
| 8 | **寫時完整，驗後 Shrink** | 標籤有生命週期：誕生時完整（Gate 要驗），通過後壓縮（人要讀）。跟 blueprint-shrink 同一哲學。 |
| 9 | **錨點是 hub 路標** | 錨點帶語意 + 行數 + 字典路徑。AI 看到錨點就知道去哪讀完整規格、改哪幾行。不需要讀完整檔案。 |
| 10 | **字典先到位，腳本再接線** | 先有資料，再有工具。不要先寫 scanner 再定格式。 |

---

## 11. 刻意不做的事（2026 增補）

| 提案 | 為什麼不做 |
|------|-----------|
| 一步到位拆掉所有 JSDoc | 舊專案不需要遷移，v1 scanner fallback 保底 |
| 字典取代 implementation_plan | plan 有施工順序語意，字典是單函式粒度，兩者互補 |
| 字典取代 Enhanced Draft | Draft 是設計階段產物，字典是實作階段產物，層次不同 |
| AI 自動維護字典 | 字典是規格真相源，AI 改字典需要人確認，不能 auto |
| 複雜的 DEPS 語意映射 | 先用 package name 直接比對（Level 1），夠用再說 |

---

*SDID 2026 Architecture Map v4.0 | 2026-02-27*
*基於: Master Plan v3.0 + Architecture v2.3 + GEMS 2026 Concept + 標籤完整指南 v3.0*
