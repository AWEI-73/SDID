# Draft iter-2: DataEntry

**迭代**: iter-2
**模組**: DataEntry
**目標**: 碳排資料登錄：輸入表單 + 排放係數查詢 + CO2e 自動計算
**依賴**: shared (iter-1)

<!--
  @CONTEXT_SCOPE:
    READ: blueprint.md, contract_iter-1.ts (介面參考: CoreTypes, IDataEntryService)
    SKIP: draft_iter-1.md
-->

---

## Story 拆法

> Story-2.0: 後端服務 — calcEmission + createRecord + getRecords
> Story-2.1: 前端串接 — EmissionForm + RecordList 頁面

## 動作清單

| 業務語意 | 類型 | 技術名稱 | Signature | P | 流向 | 依賴 | TDD |
|---------|------|---------|-----------|---|------|------|-----|
| CO2e 自動計算 | CALC | calcEmission | (amount: number, factorId: string) → number | P0 | VALIDATE_INPUT→LOOKUP_FACTOR→MULTIPLY→RETURN | [shared/EmissionFactor] | [TDD] |
| 新增碳排記錄 | CREATE | createRecord | (data: Omit<EmissionRecord,'id'\|'co2e'>) → EmissionRecord | P1 | VALIDATE→CALC_CO2E→PERSIST→RETURN | [Internal.calcEmission] | [DB] |
| 查詢碳排記錄 | READ | getRecords | (orgId: string, period: string) → EmissionRecord[] | P1 | VALIDATE→QUERY→FILTER→RETURN | [shared/EmissionRecord] | [DB] |
| 碳排資料輸入表單 | UI | EmissionForm | N/A | P1 | LOAD_FACTORS→RENDER_FORM→VALIDATE→SUBMIT | [Internal.calcEmission, Internal.createRecord] | [UI] |
| 碳排記錄列表頁 | ROUTE | DataEntryPage | N/A | P1 | LOAD_RECORDS→RENDER_LIST→BIND_FORM | [Internal.EmissionForm, Internal.getRecords] | [UI] |

## TDD 測試需求

<!-- [TDD] action：needsTest:true，由 TDD Contract Subagent 寫測試檔 -->

- calcEmission: Given amount=1000, factorId="elec-tw-2024" / When `calcEmission(1000, "elec-tw-2024")` / Then 回傳 494
- calcEmission 零值: Given amount=0 / When `calcEmission(0, "elec-tw-2024")` / Then 回傳 0
- calcEmission 無效係數: Given factorId 不存在 / When `calcEmission(1000, "non-existent")` / Then throw ValidationError

<!-- [DB]/[UI] action 不填（Phase 2 只跑 tsc --noEmit） -->

## 模組 API 摘要

- 對外 API: calcEmission(amount,factorId)→number, createRecord(data)→EmissionRecord, getRecords(orgId,period)→EmissionRecord[]
- 內部依賴: [shared.CoreTypes, shared.EmissionFactor, shared.IDataEntryService]
