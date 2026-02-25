# POC-FIX 模式 — 四階段執行規則

> 用於無法用 spec/tag 充分描述的**特化功能** — 第三方串接、客製化演算法、複雜資料處理等。
> 「契約（contract）與實際調整細節差太多」，spec 寫得再好也不如直接看 prototype。
> **POC 就是規格**，驗證完後直接 BUILD，不走 PLAN。

---

## 與 MICRO-FIX 的關鍵差異

| | MICRO-FIX | POC-FIX |
|---|-----------|---------|
| 目的 | 小修、快修 | 特化模組驗證 + 落地 |
| 測試 | **不寫** | **必寫**（單元 / 整合 / E2E） |
| 範圍 | 單一檔案/函式 | 可跨多檔案，但聚焦一個特化模組 |
| 流程 | 直接改 → gate | 四階段循環 → gate |
| spec/plan | 不需要 | 不需要（POC = spec） |

---

## 識別信號（兩種入口）

| 狀態 | 入口 |
|------|------|
| **尚未有 POC** — 使用者描述一個特化需求 | → Phase 1 開始（建 POC 資料夾） |
| **已有 POC 產物** — poc/ 裡有可執行腳本 | → Phase 2 開始（驗證/調整） |

## Escalation Check

| 信號 | 判斷 |
|------|------|
| 第三方 API、演算法、資料格式轉換、特殊 UI 邏輯 | → POC-FIX |
| 標準 CRUD、UI 組件、路由設定 | → 不適用，走 Task-Pipe / Blueprint |
| 需要跨多模組的大型架構設計 | → 升級到 Blueprint |

---

## 四階段執行流程

```
Phase 1: SETUP        — 建立 POC 環境
Phase 2: VERIFY       — 反覆驗證調整（可多輪）
Phase 3: CONSOLIDATE  — 整合清除，產出乾淨模組
Phase 4: BUILD + TEST — 落地到正式碼 + 必寫測試
```

---

### Phase 1: SETUP（建立 POC 環境）

1. 在 `.gems/iterations/iter-X/poc/` 建立工作目錄
2. 使用者放入原型檔案（HTML、Node script、測試腳本等，什麼都可以）
3. 若有 contract 檔案（`*.contract.ts`），先讀取了解預期介面
4. 環境預設：Node + HTML（除非使用者指定其他）

---

### Phase 2: VERIFY（反覆驗證，可多輪迭代）

1. 執行 POC 腳本，觀察結果
2. 根據結果調整邏輯 — 串 API、修參數、調演算法等
3. 重複直到**可驗證通過**（使用者確認 or 腳本輸出正確）
4. 這個階段不限來回次數，光串或調就要花時間的場景很正常

> 📌 此階段每輪結束報告：「POC 驗證 Round N：[通過/需調整]，[問題摘要]」

---

### Phase 3: CONSOLIDATE（整合清除）

1. 掃描 poc/ 下所有檔案，列出散落的原型
2. 整合成乾淨的函式/模組清單（一句話確認）：
   > 「整合後的模組：[模組A → targetA.ts], [模組B → targetB.ts]，可以嗎？」
3. 清除多餘的測試用檔案、暫存檔
4. 產出 `poc-consolidation-log.md`（記錄哪些原型→哪個正式檔案）

---

### Phase 4: BUILD + TEST（落地 + 必寫測試）

1. 按 Phase 3 的整合清單，直接把邏輯搬進正式程式碼（不重新設計）
2. **必寫測試** — 根據模組性質選擇：
   - 純函式 / 資料處理 → 單元測試
   - API 串接 / 第三方 → 整合測試（mock external）
   - 完整流程 → E2E 測試
3. 執行 gate 驗證：
   ```bash
   node sdid-tools/micro-fix-gate.cjs --changed=<改動的檔案> --target=<project>
   ```
4. `@PASS` → 完成
5. `@BLOCKER` → 修復後重跑 gate

---

## 不做的事

- 不寫 requirement_spec
- 不跑 PLAN Step 1-5
- 不做 Cynefin Check（原型驗證本身就是 domain 探索）
- 不重新設計已驗證的邏輯
