#!/usr/bin/env node
/**
 * Test Blueprint Gate v1.2 new checks:
 * - API-001/002: 公開 API ↔ 動作清單一致性
 * - FLOW-010/011: Flow 精確度
 * - SIG-001/002/003: API 簽名完整性
 */
const gate = require('../blueprint-gate.cjs');
const parser = require('../lib/draft-parser-standalone.cjs');

const testContent = [
  '# 測試 - 活藍圖 (Living Blueprint)',
  '',
  '**迭代**: iter-1',
  '**日期**: 2026-02-13',
  '**草稿狀態**: [x] DONE',
  '**規模**: M',
  '**方法論**: SDID v2.1',
  '',
  '---',
  '',
  '## 一句話目標',
  '',
  '測試 API 一致性和 Flow 精確度檢查功能是否正確運作',
  '',
  '## 用戶原始需求',
  '',
  '> 測試用需求，驗證 GATE v1.2 新增的三個檢查規則是否正確運作，需要足夠長度。',
  '',
  '---',
  '',
  '## 模組化設計藍圖',
  '',
  '### 1. 族群識別',
  '',
  '| 族群名稱 | 描述 | 特殊需求 |',
  '|---------|------|---------|',
  '| 開發者 | 測試 | 無 |',
  '',
  '### 2. 實體定義 (Entity Tables)',
  '',
  '#### Item',
  '| 欄位 | 型別 | 約束 | 說明 |',
  '|------|------|------|------|',
  '| id | string | PK | 主鍵 |',
  '',
  '### 4. 獨立模組',
  '',
  '#### 模組: test-mod',
  '- 依賴: [shared]',
  '- 公開 API:',
  '  - exportData(format: string): string',
  '  - importData(data: string, format: string): Item[]',
  '  - missingFn(x): void',
  '- [x] 匯出',
  '- [x] 匯入',
  '',
  '---',
  '',
  '## 📅 迭代規劃表',
  '',
  '| Iter | 範圍 | 模組 | 目標 | 交付 | 狀態 |',
  '|------|------|------|------|------|------|',
  '| 1 | 測試 | test-mod | 測試 | FULL | [CURRENT] |',
  '',
  '---',
  '',
  '## 📋 模組動作清單',
  '',
  '### Iter 1: test-mod [CURRENT]',
  '',
  '| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | 狀態 |',
  '|---------|------|---------|---|------|------|------|',
  '| 匯出資料 | SVC | exportData | P1 | INIT→PROCESS→RETURN | 無 | ○○ |',
  '| 匯入資料 | SVC | importData | P1 | INIT→PROCESS→RETURN | 無 | ○○ |',
  '| 驗證資料 | SVC | validateData | P1 | VALIDATE_SCHEMA→CHECK_FIELDS→REPORT_ERRORS→RETURN | 無 | ○○ |',
  '',
  '---',
  '',
  '**草稿狀態**: [x] DONE',
].join('\n');

const draft = parser.parse(testContent);

let pass = 0;
let fail = 0;

function assert(condition, msg) {
  if (condition) { pass++; console.log('  ✅ ' + msg); }
  else { fail++; console.log('  ❌ ' + msg); }
}

// === Test 1: API-ACT 一致性 ===
console.log('\n=== API-001: 公開 API 函式不在動作清單 ===');
const apiIssues = gate.checkAPIActionConsistency(draft, 1);
const api001 = apiIssues.filter(i => i.code === 'API-001');
const api002 = apiIssues.filter(i => i.code === 'API-002');

assert(api001.length === 1, 'missingFn 應觸發 API-001 BLOCKER (公開 API 有但動作清單沒有)');
assert(api001[0] && api001[0].msg.includes('missingFn'), 'API-001 應提到 missingFn');
assert(api001[0] && api001[0].level === 'BLOCKER', 'API-001 應為 BLOCKER');

console.log('\n=== API-002: 動作清單有但公開 API 沒有 ===');
assert(api002.length === 1, 'validateData 應觸發 API-002 WARN (動作清單有但公開 API 沒有)');
assert(api002[0] && api002[0].msg.includes('validateData'), 'API-002 應提到 validateData');

// === Test 2: Flow 精確度 ===
console.log('\n=== FLOW-010: 泛用 flow 偵測 ===');
const flowIssues = gate.checkFlowPrecision(draft, 1);
const flow010 = flowIssues.filter(i => i.code === 'FLOW-010');

assert(flow010.length === 2, 'exportData 和 importData 的 INIT→PROCESS→RETURN 應觸發 FLOW-010');
assert(flow010.every(i => i.level === 'BLOCKER'), 'FLOW-010 應為 BLOCKER');

// validateData 的 flow 有業務語意，不應觸發
const validateFlow = flowIssues.filter(i => i.msg && i.msg.includes('validateData'));
assert(validateFlow.length === 0, 'validateData 的 flow 有業務語意，不應觸發');

// === Test 3: API 簽名完整性 ===
console.log('\n=== SIG-003: 參數缺少型別 ===');
const sigIssues = gate.checkAPISignatureCompleteness(draft, 1);
const sig003 = sigIssues.filter(i => i.code === 'SIG-003');

assert(sig003.length === 1, 'missingFn(x) 的參數 x 缺少型別應觸發 SIG-003');
assert(sig003[0] && sig003[0].msg.includes('x'), 'SIG-003 應提到參數 x');

// exportData 和 importData 有完整簽名，不應觸發
const sig001 = sigIssues.filter(i => i.code === 'SIG-001');
const sig002 = sigIssues.filter(i => i.code === 'SIG-002');
assert(sig001.length === 0, '所有 API 都有括號，SIG-001 不應觸發');
assert(sig002.length === 0, '所有 API 都有回傳型別，SIG-002 不應觸發');

// === Summary ===
console.log('\n' + '='.repeat(50));
console.log(`結果: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
