#!/usr/bin/env node
/**
 * Test: Blueprint Gate + Contract Gate auto-patch
 *
 * 驗證從 Blueprint 到 Contract 的格式問題都能機械式修正：
 *
 * Blueprint Gate auto-patch:
 *   1. 樣式策略複合值 → 取第一個
 *   2. 迭代規劃表缺 [CURRENT] → 第一個 iter 自動標記
 *   3. ## 一句話目標 → **一句話目標**: 單行
 *   4. 實體表格欄位名稱別名修正
 *
 * Contract Gate auto-patch:
 *   6. @GEMS-STORIES 區塊 → @GEMS-STORY: 單行格式
 *   7. @GEMS-ENTITY → @GEMS-CONTRACT
 *   8. @GEMS-TYPE → @GEMS-CONTRACT
 *   9. Story 1.0（空格）→ Story-1.0（連字號）
 *   10. 缺 @GEMS-CONTRACT → 自動補第一個 interface
 */
'use strict';

const { autoPatchBlueprint, checkBlueprint, parseBlueprint } = require('../blueprint/v5/blueprint-gate.cjs');
const { autoPatchContract, checkContract } = require('../blueprint/v5/contract-gate.cjs');

// ── 測試工具 ──
let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
    failed++;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertPatch(patches, keyword) {
  assert(patches.some(p => p.includes(keyword)), `應有 patch 包含 "${keyword}"，實際: ${JSON.stringify(patches)}`);
}
function assertNoPatch(patches, keyword) {
  assert(!patches.some(p => p.includes(keyword)), `不應有 patch 包含 "${keyword}"，實際: ${JSON.stringify(patches)}`);
}

// ════════════════════════════════════════════════════════
console.log('\n🔧 Test: Blueprint Gate auto-patch\n');

// ── BP-1: 樣式策略複合值 ──
test('BP-1: 樣式策略 "CSS Modules / Tailwind" → "CSS Modules"', () => {
  const raw = '**樣式策略**: CSS Modules / Tailwind\n';
  const { patched, patches } = autoPatchBlueprint(raw);
  assert(patched.includes('**樣式策略**: CSS Modules'), `應修正為 CSS Modules，實際: ${patched}`);
  assert(!patched.includes('/ Tailwind'), '不應保留 / Tailwind');
  assertPatch(patches, '樣式策略');
});

test('BP-1b: 樣式策略 "Tailwind / Global CSS" → "Tailwind"', () => {
  const raw = '**樣式策略**: Tailwind / Global CSS\n';
  const { patched, patches } = autoPatchBlueprint(raw);
  assert(patched.includes('**樣式策略**: Tailwind'), `應修正為 Tailwind，實際: ${patched}`);
  assertPatch(patches, '樣式策略');
});

test('BP-1c: 樣式策略單一值 → 不 patch', () => {
  const raw = '**樣式策略**: Tailwind\n';
  const { patches } = autoPatchBlueprint(raw);
  assertNoPatch(patches, '樣式策略');
});

// ── BP-2: 迭代規劃表缺 [CURRENT] ──
test('BP-2: 迭代規劃表缺 [CURRENT] → 第一個 iter 自動標記', () => {
  const raw = `## 3. 迭代規劃

| iter | 模組 | 目標 | 交付 | 狀態 |
|------|------|------|------|------|
| 1 | Auth | 登入 | 登入頁 | PLANNED |
| 2 | Dashboard | 儀表板 | 儀表板頁 | PLANNED |
`;
  const { patched, patches } = autoPatchBlueprint(raw);
  assert(/\[CURRENT\]/i.test(patched), '應加入 [CURRENT]');
  assertPatch(patches, 'CURRENT');
});

test('BP-2b: 已有 [CURRENT] → 不 patch', () => {
  const raw = `## 3. 迭代規劃

| iter | 模組 | 目標 | 交付 | 狀態 |
|------|------|------|------|------|
| 1 | Auth | 登入 | 登入頁 | [CURRENT] |
`;
  const { patches } = autoPatchBlueprint(raw);
  assertNoPatch(patches, 'CURRENT');
});

// ── BP-3: ## 一句話目標 → **一句話目標**: ──
test('BP-3: ## 一句話目標 + 下一行 → **一句話目標**: 單行', () => {
  const raw = `## 一句話目標

打造一個簡單的記帳應用
`;
  const { patched, patches } = autoPatchBlueprint(raw);
  assert(patched.includes('**一句話目標**: 打造一個簡單的記帳應用'), `應轉換格式，實際: ${patched}`);
  assertPatch(patches, '一句話目標');
});

test('BP-3b: 已是 **一句話目標**: 格式 → 不 patch', () => {
  const raw = '**一句話目標**: 打造一個簡單的記帳應用\n';
  const { patches } = autoPatchBlueprint(raw);
  assertNoPatch(patches, '一句話目標');
});

// ── BP-4: 實體表格欄位名稱別名 ──
test('BP-4: 欄位名稱/資料型別/限制條件/備註 → 標準名稱', () => {
  const raw = '| 欄位名稱 | 資料型別 | 限制條件 | 備註 |\n';
  const { patched, patches } = autoPatchBlueprint(raw);
  assert(patched.includes('| 欄位 |'), `應修正欄位名稱，實際: ${patched}`);
  assert(patched.includes('| 型別 |'), `應修正型別，實際: ${patched}`);
  assert(patched.includes('| 約束 |'), `應修正約束，實際: ${patched}`);
  assert(patched.includes('| 說明 |'), `應修正說明，實際: ${patched}`);
  assert(patches.length >= 4, `應有 4 個 patch，實際: ${patches.length}`);
});

// ── BP-5: 組合測試 — 多個問題同時修正 ──
test('BP-5: 組合 — 樣式策略+缺CURRENT 同時修正', () => {
  const raw = `**樣式策略**: CSS Modules / Tailwind

## 3. 迭代規劃

| iter | 模組 | 目標 | 交付 | 狀態 |
|------|------|------|------|------|
| 1 | Core | 核心 | 核心功能 | PLANNED |
`;
  const { patched, patches } = autoPatchBlueprint(raw);
  assert(patched.includes('**樣式策略**: CSS Modules'), '樣式策略應修正');
  assert(/\[CURRENT\]/i.test(patched), '應加入 CURRENT');
  assert(patches.length >= 2, `應有至少 2 個 patch，實際: ${patches.length}`);
});

// ── BP-6: 修正後 checkBlueprint 不再報 BP-007 ──
test('BP-6: 修正後 BP-007(樣式策略) 不再 BLOCKER', () => {
  const raw = `# Test - Blueprint
**日期**: 2026-01-01
**一句話目標**: 測試用目標，長度超過十個字
**樣式策略**: CSS Modules / Tailwind

## 1. 目標
> 測試用需求，驗證 auto-patch 後 gate 不再報 BP-007，這段文字需要超過二十個字才算通過。

## 2. 實體定義

#### User
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK | 主鍵 |
| name | string | NOT NULL | 名稱 |
| email | string | UNIQUE | 信箱 |

## 3. 迭代規劃

| iter | 模組 | 目標 | 交付 | 狀態 |
|------|------|------|------|------|
| 1 | User | 用戶管理 | 用戶頁 | [CURRENT] |
`;
  const { patched } = autoPatchBlueprint(raw);
  const bp = parseBlueprint(patched);
  const issues = checkBlueprint(bp, patched);
  const bp007 = issues.find(i => i.code === 'BP-007');
  assert(!bp007, `BP-007 應已修正，但仍存在: ${bp007 ? bp007.msg : ''}`);
});

// ════════════════════════════════════════════════════════
console.log('\n🔧 Test: Contract Gate auto-patch\n');

// ── CG-6: @GEMS-STORIES 區塊 → @GEMS-STORY: 單行 ──
test('CG-6: @GEMS-STORIES 區塊 → @GEMS-STORY: 單行格式', () => {
  const content = `// @GEMS-STORIES
// Story-1.0 | shared | 基礎建設 | INFRA
// Story-1.1 | auth | 登入 | FEATURE
`;
  const { patched, patches } = autoPatchContract(content);
  assert(patched.includes('// @GEMS-STORY: Story-1.0'), '應轉換 Story-1.0');
  assert(patched.includes('// @GEMS-STORY: Story-1.1'), '應轉換 Story-1.1');
  assert(!patched.includes('@GEMS-STORIES\n'), '舊格式應移除');
  assertPatch(patches, '@GEMS-STORIES');
});

// ── CG-7: @GEMS-ENTITY → @GEMS-CONTRACT ──
test('CG-7: @GEMS-ENTITY → @GEMS-CONTRACT', () => {
  const content = `// @GEMS-ENTITY: User
export interface User { id: string; }
`;
  const { patched, patches } = autoPatchContract(content);
  assert(patched.includes('// @GEMS-CONTRACT: User'), `應轉換為 @GEMS-CONTRACT，實際: ${patched}`);
  assert(!patched.includes('@GEMS-ENTITY'), '舊標籤應移除');
  assertPatch(patches, 'ENTITY');
});

// ── CG-8: @GEMS-TYPE → @GEMS-CONTRACT ──
test('CG-8: @GEMS-TYPE → @GEMS-CONTRACT', () => {
  const content = `// @GEMS-TYPE: Product
export interface Product { id: string; }
`;
  const { patched, patches } = autoPatchContract(content);
  assert(patched.includes('// @GEMS-CONTRACT: Product'), `應轉換，實際: ${patched}`);
  assertPatch(patches, 'TYPE');
});

// ── CG-9: Story 空格 → 連字號 ──
test('CG-9: @GEMS-STORY: Story 1.0 → Story-1.0', () => {
  const content = `// @GEMS-STORY: Story 1.0 | shared | 基礎建設 | INFRA
`;
  const { patched, patches } = autoPatchContract(content);
  assert(patched.includes('Story-1.0'), `應修正為 Story-1.0，實際: ${patched}`);
  assertPatch(patches, 'Story');
});

// ── CG-10: 缺 @GEMS-CONTRACT → 自動補第一個 interface ──
test('CG-10: 缺 @GEMS-CONTRACT → 自動補第一個 interface', () => {
  const content = `// @GEMS-STORY: Story-1.0 | shared | 基礎建設 | INFRA

export interface AppConfig {
  apiUrl: string;
  timeout: number;
}
`;
  const { patched, patches } = autoPatchContract(content);
  assert(patched.includes('// @GEMS-CONTRACT: AppConfig'), `應補 @GEMS-CONTRACT，實際: ${patched}`);
  assertPatch(patches, '@GEMS-CONTRACT');
});

test('CG-10b: 已有 @GEMS-CONTRACT → 不重複補', () => {
  const content = `// @GEMS-STORY: Story-1.0 | shared | 基礎建設 | INFRA
// @GEMS-CONTRACT: AppConfig
export interface AppConfig { apiUrl: string; }
`;
  const { patches } = autoPatchContract(content);
  assertNoPatch(patches, '@GEMS-CONTRACT');
});

// ── CG-11: 修正後 checkContract 不再報 CG-001/CG-002 ──
test('CG-11: 修正後 checkContract 不再報 CG-001/CG-002', () => {
  // 故意用舊格式
  const content = `// @GEMS-STORIES
// Story-1.0 | shared | 基礎建設 | INFRA

// @GEMS-ENTITY: AppConfig
export interface AppConfig {
  apiUrl: string;
  timeout: number;
}
`;
  const { patched } = autoPatchContract(content);
  const { blockers } = checkContract(patched, 1);
  assert(blockers.length === 0, `修正後不應有 BLOCKER，實際: ${JSON.stringify(blockers)}`);
});

// ── CG-12: 組合 — 多個問題同時修正 ──
test('CG-12: 組合 — STORIES+ENTITY+Story空格 同時修正', () => {
  const content = `// @GEMS-STORIES
// Story 1.0 | shared | 基礎建設 | INFRA

// @GEMS-ENTITY: Config
export interface Config { id: string; name: string; }
`;
  const { patched, patches } = autoPatchContract(content);
  assert(patched.includes('// @GEMS-STORY: Story-1.0'), 'STORIES+空格應修正');
  assert(patched.includes('// @GEMS-CONTRACT: Config'), 'ENTITY應修正');
  assert(patches.length >= 2, `應有至少 2 個 patch，實際: ${patches.length}`);
});

// ════════════════════════════════════════════════════════
console.log(`\n結果: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
