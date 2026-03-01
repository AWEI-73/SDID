# SDID 2026 演進實施計畫

> **版本**: v1.0 | **日期**: 2026-02-27
> **定位**: 從現有 SDID v3.0 演進到 2026 字典架構的具體實施計畫
> **前置文件**: SDID_2026_ARCHITECTURE_MAP v4.1

---

## 一句話目標

把 GEMS 標籤系統從「程式碼內的大坨 JSDoc」演進為「字典 JSON + 壓縮錨點 + 行數定位」，讓人看得輕鬆、AI 讀得精準、腳本跑得穩。

---

## 實施項目總覽

| # | 項目 | 做什麼 | 改什麼 | 難度 |
|---|------|--------|--------|------|
| 1 | 字典 JSON Schema | 定義字典格式 | 新增 | 低 |
| 2 | function-index 擴充 | 索引 → 字典 | 擴充現有 | 低 |
| 3 | tag-shrink 機制 | JSDoc → 字典 + 壓縮錨點 | 新增腳本 | 低 |
| 4 | state-guide | 狀態機 skill，AI 進來直接拿指令包 | 擴充 loop.cjs | 低 |
| 5 | Phase 2 改讀字典 | scanner 從 regex JSDoc → 讀 JSON | 改寫 phase-2.cjs | 中 |
| 6 | spec-gate | 字典品質門控 | 新增，繼承 blueprint-gate 部分檢查 | 低 |
| 7 | Phase 8 字典同步 | Fillback 同時更新字典 | 擴充 phase-8.cjs | 低 |

---

## 項目 1：字典 JSON Schema

**做什麼**：定義 `.gems/specs/*.json` 的標準格式。

**為什麼先做這個**：所有後續項目都依賴字典格式。格式不定，其他的都沒辦法接。

**具體產出**：

一份 JSON Schema 定義檔，涵蓋 tagging guide v3.0 的所有欄位：

```json
{
  "Meal.LoadClassData": {
    "priority": "P1",
    "status": "✓✓",
    "signature": "(classId, weekId)→Promise<MealData[]>",
    "description": "載入班級用餐資料",
    "targetFile": "src/modules/meal/services/preview-service.ts",
    "lineRange": "L80-120",
    "flow": "ValidateInput→QueryDatabase→MapToDomain→Return",
    "steps": {
      "ValidateInput": "檢查 classId, weekId 有效",
      "QueryDatabase": "查 tbl_students + tbl_meals",
      "MapToDomain": "toMealDataDomain 轉換",
      "Return": ""
    },
    "deps": {
      "Database.tbl_roster_students": "查詢學員",
      "Database.tbl_meal_log": "查詢記錄",
      "Lib.supabaseClient": "連線",
      "Internal.toMealDataDomain": "轉換"
    },
    "depsRisk": "LOW",
    "allowedImports": ["@supabase/supabase-js", "./mappers"],
    "test": {
      "unit": true,
      "integration": true,
      "e2e": false,
      "testFile": "previewService.test.ts"
    },
    "storyRef": "Story-16.1",
    "ac": [
      "Given valid classId+weekId, When loadClassMealData, Then return MealData[]",
      "Given invalid classId, When loadClassMealData, Then throw validation error"
    ]
  }
}
```

**必填 vs 選填**：

| 欄位 | P0 | P1 | P2 | P3 |
|------|----|----|----|----|
| priority, targetFile, lineRange | ✅ | ✅ | ✅ | ✅ |
| flow, steps | ✅ | ✅ | 選填 | 選填 |
| deps, depsRisk | ✅ | ✅ | 選填 | - |
| allowedImports | ✅ | 選填 | - | - |
| test, testFile | ✅ | ✅ | 選填 | - |
| ac | ✅ | ✅ | - | - |
| storyRef | ✅ | ✅ | ✅ | 選填 |
| signature, description, status | ✅ | ✅ | ✅ | ✅ |

**困難度**：低。就是把 tagging guide 的表格翻譯成 JSON 結構。你已經把所有規則都定義好了。

**驗證方式**：拿一個現有專案的 3-5 個函式，手動寫成字典 JSON，確認欄位夠不夠用。

---

## 項目 2：function-index 擴充

**做什麼**：把現有的 function-index.json 從「索引」擴充為「字典入口」。

**現況**：Phase 8 Fillback 已經在自動維護 function-index.json，包含函式名、檔案路徑、行數、優先級等基本資訊。

**改動方式**：

不動 function-index.json 的結構。改為讓它指向對應的字典分片：

```json
{
  "functions": [
    {
      "name": "loadClassMealData",
      "file": "src/modules/meal/services/preview-service.ts",
      "line": 80,
      "priority": "P1",
      "gemsId": "Meal.LoadClassData",
      "specFile": "specs/meal-service.json"
    }
  ]
}
```

新增的欄位只有兩個：`gemsId`（字典 key）和 `specFile`（字典分片路徑）。

function-index 繼續當快速索引（AI 搜尋用），字典分片帶完整規格（AI 施工用）。

**困難度**：低。Phase 8 的 Fillback 邏輯加兩個欄位。

---

## 項目 3：tag-shrink 機制

**做什麼**：Gate 全過後，把程式碼裡的完整 JSDoc block 壓縮成一行錨點，完整資訊搬進字典 JSON。

**觸發時機**：Phase 8 @PASS 之後自動執行（跟 blueprint-shrink 同一個時間點）。

**腳本邏輯（tag-shrink.cjs）**：

```
1. 讀目標檔案，用 AST 或 regex 找所有 GEMS JSDoc block
2. 對每個 block：
   a. 解析 JSDoc 欄位（你現有的 scanner 已經有這個能力）
   b. 寫入對應的 .gems/specs/*.json 字典分片
   c. 把 JSDoc block 替換成壓縮錨點：
      // @GEMS [P1] Meal.LoadClassData | FLOW: Validate→Query→Map→Return | L80-120
      //   → .gems/specs/meal-service.json
3. [STEP] 行 + 說明保留不動（不壓縮）
4. 更新 function-index.json 的 gemsId 和 specFile 欄位
```

**關鍵決策**：

行數（`L80-120`）在 shrink 時寫入，但程式碼修改後行數會飄。兩個選項：
- 每次 Phase 8 Fillback 重算行數（推薦，因為 Fillback 本來就在掃程式碼）
- 不寫行數，讓 AI 用 grep 定位（備案，最簡單但少了精準度）

**困難度**：低。核心邏輯就是「parse JSDoc → 寫 JSON → 替換文字」，你的 scanner 和 blueprint-shrink 已經有類似的操作模式。最難的部分是 JSDoc parsing，但你現有的 phase-2.cjs 已經在做了，拿來用就好。

**工程量**：一支 CJS 腳本，估計 150-250 行。

---

## 項目 4：state-guide（狀態機 Skill）

**做什麼**：AI 每次進入時，跑一支腳本，輸出一份「指令包」——你在哪、該看什麼、該做什麼。

**現況**：loop.cjs 已經在讀 .state.json 並輸出 `@NEXT_COMMAND`。SKILL.md 有路由規則但是寫給 AI 讀的 markdown。

**改動方式**：擴充 loop.cjs 的輸出，或新寫一支 state-guide.cjs，輸出格式：

```
═══════════════════════════════════════════
SDID State Guide
═══════════════════════════════════════════

📍 狀態: BUILD Phase 3, Story-1.0, iter-1
📂 路線: Blueprint

📖 該讀的:
   腳本規則: task-pipe/phases/build/phase-3.cjs
   字典規格: .gems/specs/auth-api.json
   目標函式: Auth.Login (src/modules/auth/auth-api.ts L3-45)

⚠️ 歷史提示:
   @PITFALL: 上次 Phase 3 在 Story-1.0 失敗，原因: 測試 import 路徑錯誤
   @HINT: auth-api.ts 的 bcrypt import 要用 named import

🎯 下一步:
   @NEXT_COMMAND: node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-1.0

🚫 施工紅線:
   @GUARD: 禁止修改 src/shared/types
   @GUARD: 禁止新增 allowedImports 以外的 import
```

**資料來源**：

| 資訊 | 來源 | 已有 |
|------|------|------|
| 現在在哪 | .state.json | ✅ |
| 下一步指令 | loop.cjs 的 @NEXT_COMMAND | ✅ |
| 歷史提示 | project-memory.json 的 pitfall | ✅ |
| 該讀的字典 | function-index → specFile | 項目 2 加的 |
| 目標函式位置 | function-index → line | ✅ |
| 施工紅線 | 字典 JSON 的 allowedImports | 項目 1 加的 |
| 該讀的腳本 | phase/step → 檔案路徑映射 | 寫死就好 |

**困難度**：低。所有資料來源都已經存在，這支腳本就是一個「讀 N 個 JSON → 組裝成一份文字輸出」的彙總器。project-memory 的 getResumeContext() 和 getHistoricalHint() 你已經寫好了，直接呼叫。

**工程量**：一支 CJS 腳本，估計 100-200 行。

---

## 項目 5：Phase 2 改讀字典

**做什麼**：Phase 2 標籤驗收從「regex 掃 JSDoc」改為「讀字典 JSON + 掃程式碼錨點做比對」。

**現況**：phase-2.cjs 用 regex 掃程式碼中的 GEMS JSDoc block，檢查覆蓋率 ≥80%，加上 STUB-001 偵測。

**改動方式**：

新寫 gems-scanner-v2.cjs，Phase 2 判斷用哪個版本：

```javascript
// phase-2.cjs 的判斷
const specsDir = path.join(target, '.gems/specs');
if (fs.existsSync(specsDir) && fs.readdirSync(specsDir).some(f => f.endsWith('.json'))) {
  // 有字典 → 走 v2
  return scannerV2.run(target, iteration);
} else {
  // 沒字典 → 走 v1（現有邏輯，向後相容）
  return scannerV1.run(target, iteration);
}
```

scanner-v2 的邏輯：

```
1. 讀 .gems/specs/*.json 所有字典分片
2. 對每筆字典記錄：
   a. 用 targetFile 找到程式碼檔案
   b. 掃描程式碼中是否有 @GEMS [Px] {gemsId} 錨點
   c. 掃描 [STEP] 數量是否 = 字典 steps 數量
   d. 掃描 import 是否在 allowedImports 範圍內
3. 反向檢查：程式碼中有 export function 但字典裡沒有 → WARN（未登錄）
4. 輸出 @PASS / @BLOCKER
```

**困難度**：中。這是唯一一個「中等」的項目，因為 scanner 是 Gate 的核心，改動要確保向後相容且不誤殺。但邏輯本身不複雜——讀 JSON 比 regex parse JSDoc 簡單多了。主要工作量在測試：確保 v2 scanner 的判斷結果跟 v1 一致。

**工程量**：一支 CJS 腳本，估計 200-350 行。建議先跑 v1 和 v2 雙軌並行一段時間，結果一致再正式切換。

**降低風險的方式**：v1 scanner 完全不動，v2 是新檔案。phase-2.cjs 根據有沒有字典自動選擇。舊專案永遠走 v1，不受影響。

---

## 項目 6：spec-gate（字典品質門控）

**做什麼**：驗證字典 JSON 的品質，確保進 BUILD 之前字典是完整且正確的。

**定位**：跑在 Skill A 生成字典之後、CYNEFIN 之前。繼承 blueprint-gate 的部分檢查邏輯。

**檢查項目（從 blueprint-gate 繼承 + 新增）**：

| 規則碼 | 內容 | 來源 |
|--------|------|------|
| SPEC-001 | 每筆記錄有 priority + targetFile + flow | 新增 |
| SPEC-002 | P0/P1 必須有 steps + deps + ac | 新增 |
| SPEC-003 | flow 步驟數 3-7 且非全泛用 | 繼承 FLOW-001/010 |
| SPEC-004 | deps 精確到表名/模組名 | 繼承 TAG-004 |
| SPEC-005 | targetFile 指向的檔案存在 | 新增 |
| SPEC-006 | allowedImports 不為空（P0） | 新增 |
| SPEC-007 | ac 有至少 2 個 Given/When/Then（P0/P1） | 新增 |

**困難度**：低。就是一堆 JSON 欄位的存在性和格式檢查。比 blueprint-gate 的 markdown parsing 簡單得多。

**工程量**：一支 CJS 腳本，估計 100-150 行。

---

## 項目 7：Phase 8 字典同步

**做什麼**：Phase 8 Fillback 執行時，同步更新字典 JSON 的內容和行數。

**現況**：Phase 8 已經在更新 function-index.json。

**改動方式**：

在 Phase 8 的 Fillback 流程中加一步：

```
現有: 掃描程式碼 → 更新 function-index → 產出 iteration_suggestions
新增: 掃描程式碼 → 更新 function-index → ★ 同步字典行數和狀態 ★ → 產出 iteration_suggestions
```

同步的內容：
- lineRange：從程式碼中重新計算
- status：如果測試全過，更新為 ✓✓
- test：根據實際測試檔案存在與否更新

**困難度**：低。就是多讀一份 JSON、多寫幾個欄位。

**工程量**：在 phase-8.cjs 中加 30-50 行。

---

## 實施順序

```
第一步（地基）         第二步（機制）          第三步（接線）
                    
① 字典 Schema ──────→ ③ tag-shrink ────────→ ⑤ Phase 2 改讀字典
② function-index ──→ ④ state-guide ────────→ ⑥ spec-gate
  擴充                                       ⑦ Phase 8 字典同步
                    
  1-2 天               2-3 天                 3-5 天
  手動驗證就好           跑一個專案驗證           雙軌並行驗證
```

**第一步做完就能用**：手動寫字典 JSON + 壓縮錨點，自己感受閱讀體驗。

**第二步做完就自動化**：tag-shrink 幫你自動壓縮，state-guide 幫 AI 自動定位。

**第三步做完就閉環**：Gate 全部讀字典，scanner 讀字典，整個系統從 JSDoc 時代畢業。

---

## 困難度評估與整合超級效益

### 一、困難度總評：低難度，高回報

說實話，**這個改版的整體技術難度非常低 (⭐⭐ 2/5)**。原因是：

你已經有了 90% 的基礎設施。function-index 有了、scanner 有了、phase-2 有了、loop.cjs 有了、project-memory 有了、shrink 機制有了、blueprint-gate 有了。這次不是從零蓋房子，是在現有的房子裡重新佈線。

每個項目的核心邏輯都很單純：
* 字典 Schema 是將現有規則翻譯成 JSON
* function-index 只是加欄位
* tag-shrink 是 parse JSDoc + 替換成單行字串
* state-guide 是讀 JSON 組裝輸出
* spec-gate 是 JSON 欄位檢查
* Phase 2 v2 是 JSON 讀取與簡單對比

最「難」的是 Phase 2 scanner v2，但那個「難」不是邏輯難，是**驗證要小心避免誤殺**。解法就是雙軌並行：v1 和 v2 同時跑，結果一致再切換。系統重構的陣痛期約為中等 (⭐⭐⭐ 3/5)，主要是適應新流程。

### 二、整合後的 4 大超級效益 🔥

如果把這套「字典驅動 (Dictionary-Driven) + 極簡錨點」的架構整合進 SDID，將迎來結構性突破：

#### 1. 消除 AI 的「幻覺」與「注意力丟失 (Token Fatigue)」
* **現狀**：AI 一次要吞幾百行實作腳本加上幾百行程式碼，到後面常忘記前面規定了什麼，甚至亂改不相關的功能。
* **效益**：強迫 AI **「局部閱讀」** (Chunked Reading)。工具 (`state-guide`) 只會叫它去讀那 20 行專屬的 JSON 字典，以及對應的 40 行原碼。在這種超高密度的 Context 下，AI 的準確率會逼近 100%，一次到位率極高。

#### 2. 徹底淨化專案原始碼 (Clean Code 100%)
* **現狀**：為了給 Gate（門控）掃描，你的 `.ts` 檔塞滿了巨大的 JSDoc，畫面很雜，真正寫邏輯的空間被擠壓。
* **效益**：有了 `tag-shrink` 機制，一旦驗收過關，幾十行的 JSDoc 會瞬間被抽走存入 JSON，程式碼裡只留下一行 `// @GEMS [P0] Auth.Login | L80-120`。人類與 AI 維護程式碼時，看到的都是最純淨的邏輯。

#### 3. 實現「防呆式」的人類介入與架構修復
* **現狀**：如果 AI 把依賴寫錯 (例如不小心 `import fs`)，要去源碼的 JSDoc 裡面找半天，或者重跑整個冗長的 Prompt。
* **效益**：架構 (Architecture) 跟施工 (Implementation) 完成**物理隔離**。如果邏輯對了但架構規範有誤，只需要去改 `.gems/specs/auth-api.json`，瞬間修復！AI 改錯 Code 也不會污染到架構字典。

#### 4. 開啟「完美並行分工 (Isolation Units)」的能力
* **現狀**：寫碼容易卡在一起，A 檔案改了怕影響 B 檔案。
* **效益**：每一份 JSON 檔案 (例如 `checkout.json`) 都是一個天然的 **Isolation Unit（隔離單元 / TASK）**。因為依賴邊界在 JSON 裡已經寫死，可以開多個 Terminal，讓多個 Agent (或不同開發者) 同時拿著不同的 JSON 去並行開發不同的檔案，保證不會互相衝突，實現工程級別的安全並行。

---

*SDID 2026 Implementation Plan v1.0 | 2026-02-27*
