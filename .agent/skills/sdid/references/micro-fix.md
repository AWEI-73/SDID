# MICRO-FIX 模式（旁路）

## 定位

旁路，不算正式路線。不經過 CYNEFIN / Gate / BUILD，直接改完跑 gate 就結束。

---

## Escalation Check（先判斷）

| 信號 | 判斷 |
|------|------|
| "just", "fix", "改一下", "小改", 單一檔案/函式 | → 直接走 MICRO-FIX |
| 多個模組、架構調整、新功能、"重構" | → 升級到 SDID 正常流程 |

---

## 執行步驟

1. 確認要改什麼（一句話確認，不問多餘問題）
2. 直接修改檔案
3. 執行 gate 驗證：
   ```bash
   node sdid-tools/micro-fix-gate.cjs --changed=<改動的檔案> --target=<project>
   ```
4. `@PASS` → 完成
5. `@BLOCKER` → 根據輸出修復，重跑 gate

---

## 不做的事

- 不寫測試
- 不跑完整 BUILD
- 不需要 story/plan
- 不需要 CYNEFIN-CHECK

---

## 全授權模式

直接改，不確認。
