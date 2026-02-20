# Task-Pipe 工具黑盒子規格

> ⚠️ **AI 必讀**：本文件說明 task-pipe 工具的使用方式。
> 🚫 **禁止**讀取任何 `.cjs` 檔案來「了解工具如何運作」。

---

## 核心原則

```
工具 = 黑盒子
輸入 = 指令參數
輸出 = 終端機文字

AI 只需要：
1. 執行指令
2. 讀取輸出
3. 依據輸出修改「目標檔案」
```

---

## 工具清單與用途

### POC 階段

| 指令 | 用途 | 輸入 | 輸出 |
|------|------|------|------|
| `--phase=POC --step=0` | 模糊消除 | requirement_draft | PASS/PENDING + 缺少項目 |
| `--phase=POC --step=0.5` | 規模評估 | requirement_draft | Level S/M/L |
| `--phase=POC --step=1` | 契約設計 | Contract.ts | PASS/PENDING + 缺少標籤 |
| `--phase=POC --step=2` | UI 原型 | POC.html | PASS/PENDING + 缺少標籤 |
| `--phase=POC --step=3` | 需求規格 | requirement_spec | PASS/PENDING + 缺少區塊 |

### PLAN 階段

| 指令 | 用途 | 輸入 | 輸出 |
|------|------|------|------|
| `--phase=PLAN --step=1` | 需求確認 | requirement_spec | PASS/PENDING |
| `--phase=PLAN --step=2` | 規格注入 | implementation_plan | PASS/PENDING + 缺少區塊 |
| `--phase=PLAN --step=2.5` | 架構審查 | implementation_plan | PASS/PENDING + 警告 |
| `--phase=PLAN --step=2.6` | 標籤設計 | implementation_plan | PASS/PENDING |
| `--phase=PLAN --step=3` | 規格說明 | implementation_plan | PASS/PENDING |

### BUILD 階段

| 指令 | 用途 | 輸入 | 輸出 |
|------|------|------|------|
| `--phase=BUILD --step=1` | 骨架檢查 | src/ | PASS/PENDING |
| `--phase=BUILD --step=2-3` | 實作 | src/ | PASS/PENDING |
| `--phase=BUILD --step=4` | GEMS 掃描 | src/ | PASS/FAIL + 缺少標籤 |
| `--phase=BUILD --step=5` | TDD 執行 | __tests__/ | PASS/FAIL |
| `--phase=BUILD --step=6` | 修改檔案測試 | src/ | PASS/FAIL |
| `--phase=BUILD --step=7` | 整合檢查 | src/ | PASS/PENDING |
| `--phase=BUILD --step=8` | 完成 | suggestions.json | PASS/PENDING |

---

## 輸出格式解讀

### @PASS
```
@PASS | POC Step 1 | Contract 驗證通過
下一步: node task-pipe/runner.cjs --phase=POC --step=2
```
**動作**: 執行「下一步」指令

### @TEMPLATE_PENDING
```
═══════════════════════════════════════════════════════════
@TEMPLATE_PENDING
═══════════════════════════════════════════════════════════
📁 目標檔案: xxx

@GATE_SPEC (本步驟驗證邏輯 - 填寫後會檢查這些)
  ⏳ Story 目標: /Story 目標|一句話目標/i
  ⏳ 工作項目: /工作項目|Item.*\|/i
  ⏳ 規格注入: /@GEMS-CONTRACT|規格注入|interface/i

📝 需要填寫: 1. xxx  2. xxx
📋 模板內容: ...
✅ 填寫完成後執行: xxx
```
**動作**: 
1. 建立「目標檔案」
2. 查看 `@GATE_SPEC` 了解填寫後會檢查什麼
3. 複製「模板內容」
4. 填寫「需要填寫」的項目（確保符合 GATE_SPEC 的驗證）
5. 執行「填寫完成後執行」指令

### @ERROR_SPEC
```
═══════════════════════════════════════════════════════════
@ERROR_SPEC (1/3)
═══════════════════════════════════════════════════════════
📁 目標檔案: xxx
❌ 缺少項目: xxx, xxx

@GATE_SPEC (本步驟驗證邏輯)
  ❌ @GEMS-CONTRACT: /@GEMS-CONTRACT/
  ✅ @GEMS-TABLE: /@GEMS-TABLE/
  ❌ @GEMS-FUNCTION: /@GEMS-FUNCTION/

📋 範例: ...
✅ 修復後執行: xxx
```
**動作**:
1. 開啟「目標檔案」
2. 查看 `@GATE_SPEC` 了解驗證邏輯（❌ = 未通過，✅ = 已通過）
3. 補充「缺少項目」（參考「範例」）
4. 執行「修復後執行」指令

### @GATE_SPEC 說明
```
@GATE_SPEC (本步驟驗證邏輯)
  ✅ 檢查項目名稱: 正則表達式或描述
  ❌ 檢查項目名稱: 正則表達式或描述
```
**用途**: 告訴 AI 這個步驟會檢查什麼，不需要讀取 `.cjs` 工具腳本
**符號**:
- ✅ = 已通過此檢查
- ❌ = 未通過此檢查（需要修復）
- ⏳ = 待檢查（Template Pending 模式）

### @FORBIDDEN
```
@FORBIDDEN (施工紅線)
  🚫 禁止讀取 task-pipe/*.cjs 工具腳本
  ✅ 只能修改上方「目標檔案」
```
**動作**: 遵守禁令，不要讀取工具腳本

---

## 常見錯誤行為 ❌

### 1. 讀取工具腳本
```
❌ 錯誤: "讓我看一下 step-1.cjs 是怎麼驗證的..."
✅ 正確: 直接執行指令，讀取輸出
```

### 2. 猜測驗證邏輯
```
❌ 錯誤: "我猜這個工具會檢查 xxx..."
✅ 正確: 執行指令，看輸出告訴你缺什麼
```

### 3. 修改工具腳本
```
❌ 錯誤: "這個驗證太嚴格了，我來改一下..."
✅ 正確: 修改你的專案檔案，不是工具
```

### 4. 忽略輸出
```
❌ 錯誤: "輸出太長了，我直接做..."
✅ 正確: 仔細讀取輸出，特別是「目標檔案」和「缺少項目」
```

---

## 正確工作流程

```
1. 執行指令
   $ node task-pipe/runner.cjs --phase=POC --step=1 --target=.

2. 讀取輸出
   - 看 @PASS / @TEMPLATE_PENDING / @ERROR_SPEC
   - 找到「目標檔案」
   - 找到「缺少項目」或「需要填寫」

3. 修改目標檔案
   - 只修改輸出指定的檔案
   - 參考輸出的範例/模板

4. 重新執行指令
   - 執行輸出的「下一步」或「修復後執行」

5. 重複直到 @PASS
```

---

## 禁止清單

| 禁止行為 | 原因 |
|----------|------|
| 讀取 `task-pipe/**/*.cjs` | 工具是黑盒子 |
| 修改 `task-pipe/**/*` | 工具不應被修改 |
| 刪除 `.gems/iterations/*/logs/*` | 日誌是除錯依據 |
| 猜測驗證邏輯 | 輸出會告訴你 |
| 跳過步驟 | 每個步驟都有檢查點 |

---

## 允許清單

| 允許行為 | 說明 |
|----------|------|
| 執行 `node task-pipe/runner.cjs ...` | 這是唯一的互動方式 |
| 讀取終端機輸出 | 這是工具的回饋 |
| 讀取 `.gems/iterations/*/logs/*.log` | 詳細錯誤資訊 |
| 修改專案檔案 (src/, .gems/iterations/*/poc/, plan/, build/) | 這是你的工作 |

---

## 總結

```
🎯 Task-Pipe 工具 = 黑盒子驗證器

輸入: 你的專案檔案
輸出: PASS / PENDING + 修復指引

你的工作:
1. 執行指令
2. 讀取輸出
3. 修改專案檔案
4. 重複直到 PASS

不是你的工作:
- 理解工具內部邏輯
- 修改工具腳本
- 猜測驗證規則
```
