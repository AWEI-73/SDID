M#!/usr/bin/env node
/**
 * Blueprint CONTRACT 流程 dry-run 測試
 * 模擬 GATE → CYNEFIN_CHECK → CONTRACT → PLAN 的完整狀態轉換
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const sm = require('./sdid-core/state-machine.cjs');
const { loadContract, parseContract, runGate } = require('./sdid-tools/blueprint/contract-writer.cjs');

// ─── 建立臨時測試目錄 ───────────────────────────────────────
const tmpDir = path.join(os.tmpdir(), `sdid-contract-test-${Date.now()}`);
const logsDir = path.join(tmpDir, '.gems', 'iterations', 'iter-1', 'logs');
const pocDir  = path.join(tmpDir, '.gems', 'iterations', 'iter-1', 'poc');
fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(pocDir,  { recursive: true });

// 放一個假 draft
fs.writeFileSync(path.join(pocDir, 'requirement_draft_iter-1.md'), '# Test Draft\n', 'utf8');

function addLog(name) {
  fs.writeFileSync(path.join(logsDir, name), '', 'utf8');
}

function check(label, expected, actual) {
  const ok = actual === expected;
  console.log(`  ${ok ? '✅' : '❌'} ${label}: ${ok ? actual : `expected=${expected}, got=${actual}`}`);
  return ok;
}

let allPass = true;

// ─── Step 1: 只有 gate-check-pass → CYNEFIN_CHECK ───────────
console.log('\n[Step 1] gate-check-pass → 應推斷 CYNEFIN_CHECK');
addLog('gate-check-pass-2026-01-01T00-00-00.log');
{
  const r = sm.inferStateFromLogs(tmpDir, 1, [], []);
  allPass &= check('phase', 'CYNEFIN_CHECK', r?.phase);
  const cmd = sm.buildNextCommand({ phase: r?.phase, iter: 'iter-1', draftPath: path.join(pocDir, 'requirement_draft_iter-1.md'), projectRoot: tmpDir });
  console.log(`  📋 buildNextCommand: ${cmd}`);
}

// ─── Step 2: 加 cynefin-check-pass → CONTRACT ───────────────
console.log('\n[Step 2] + cynefin-check-pass → 應推斷 CONTRACT');
addLog('cynefin-check-pass-2026-01-01T00-00-01.log');
{
  const r = sm.inferStateFromLogs(tmpDir, 1, [], []);
  allPass &= check('phase', 'CONTRACT', r?.phase);
  const cmd = sm.buildNextCommand({ phase: r?.phase, iter: 'iter-1', draftPath: path.join(pocDir, 'requirement_draft_iter-1.md'), projectRoot: tmpDir });
  console.log(`  📋 buildNextCommand: ${cmd}`);
}

// ─── Step 3: contract-writer gate — 格式錯誤 ────────────────
console.log('\n[Step 3] contract-writer gate — 格式錯誤的 contract');
const badContract = `
// @GEMS-CONTRACT: User
export interface User {
  name: string; // VARCHAR(100)
}
`;
const contractPath = path.join(pocDir, 'contract_iter-1.ts');
fs.writeFileSync(contractPath, badContract, 'utf8');
{
  const parsed = parseContract(badContract);
  const gate = runGate(parsed, badContract);
  console.log(`  Entities: ${parsed.entities.map(e => e.name).join(', ')}`);
  console.log(`  Blockers: ${gate.blockers.length}`);
  for (const b of gate.blockers) {
    console.log(`    ❌ [${b.code}] ${b.message}`);
  }
  allPass &= check('has blockers', true, gate.blockers.length > 0);
}

// ─── Step 4: contract-writer gate — 正確格式 ────────────────
console.log('\n[Step 4] contract-writer gate — 正確格式的 contract');
const goodContract = `
// @GEMS-CONTRACT-VERSION: 1.0
// @GEMS-ITER: iter-1
// @GEMS-PROJECT: TestProject

// @GEMS-CONTRACT: User
// @GEMS-TABLE: tbl_users
// @GEMS-STORY: Story-1.0
export interface User {
  id: string;           // UUID, PK
  name: string;         // VARCHAR(100), NOT NULL
  email: string;        // VARCHAR(255), UNIQUE
  createdAt: string;    // TIMESTAMP, NOT NULL
}

// @GEMS-VIEW: UserView
// @GEMS-FIELD-COVERAGE: id=frontend, name=frontend, email=frontend, createdAt=api-only
export interface UserView {
  id: string;
  name: string;
  email: string;
}

// @GEMS-API: UserService
// @GEMS-STORY: Story-1.0
export interface UserService {
  getUser(id: string): Promise<UserView>;
  createUser(data: Partial<User>): Promise<User>;
}
`;
fs.writeFileSync(contractPath, goodContract, 'utf8');
{
  const parsed = parseContract(goodContract);
  const gate = runGate(parsed, goodContract);
  console.log(`  Entities: ${parsed.entities.map(e => e.name).join(', ')}`);
  console.log(`  Views:    ${parsed.views.map(v => v.name).join(', ')}`);
  console.log(`  APIs:     ${parsed.apis.map(a => a.name).join(', ')}`);
  console.log(`  Blockers: ${gate.blockers.length}`);
  console.log(`  Warnings: ${gate.warnings.length}`);
  for (const w of gate.warnings) console.log(`    ⚠ [${w.code}] ${w.message}`);
  allPass &= check('no blockers', 0, gate.blockers.length);
}

// ─── Step 5: 加 contract-pass log → PLAN ────────────────────
console.log('\n[Step 5] + contract-pass log → 應推斷 PLAN');
addLog('contract-pass-2026-01-01T00-00-02.log');
{
  const r = sm.inferStateFromLogs(tmpDir, 1, [], []);
  allPass &= check('phase', 'PLAN', r?.phase);
}

// ─── Step 6: loadContract 讀取 ──────────────────────────────
console.log('\n[Step 6] loadContract() 讀取 contract');
{
  const loaded = loadContract(tmpDir, 1);
  allPass &= check('loaded not null', true, loaded !== null);
  allPass &= check('entity count', 1, loaded?.entities?.length);
  allPass &= check('entity name', 'User', loaded?.entities?.[0]?.name);
  allPass &= check('entity table', 'tbl_users', loaded?.entities?.[0]?.table);
  allPass &= check('entity story', 'Story-1.0', loaded?.entities?.[0]?.story);
  allPass &= check('field count', 4, loaded?.entities?.[0]?.fields?.length);
  console.log(`  Fields: ${loaded?.entities?.[0]?.fields?.map(f => f.name).join(', ')}`);
}

// ─── Step 7: draft-to-plan generateScaffold contract 注入 ───
console.log('\n[Step 7] generateScaffold — contract 型別注入 (dry-run)');
{
  const { generateScaffold } = require('./sdid-tools/blueprint/draft-to-plan.cjs');
  const actions = [{
    techName: 'CoreTypes',
    type: 'CONST',
    priority: 'P0',
    semantic: '核心型別定義',
    flow: 'DEFINE_TYPES→EXPORT',
    deps: '無',
    operation: 'NEW',
  }];
  const result = generateScaffold(tmpDir, 1, 0, 'shared', actions, { dryRun: true });
  console.log(`  Generated: ${result.generated.length}`);
  for (const g of result.generated) console.log(`    📄 ${g}`);
  for (const s of result.skipped) console.log(`    ⏭ ${s}`);
  allPass &= check('generated 1 file', 1, result.generated.length);
}

// ─── Step 8: blueprint-contract-writer CLI dry-run ──────────
console.log('\n[Step 8] blueprint-contract-writer CLI — @PASS 輸出');
{
  const { execSync } = require('child_process');
  try {
    const out = execSync(
      `node sdid-tools/blueprint/contract-writer.cjs --contract="${contractPath}" --target="${tmpDir}" --iter=1`,
      { cwd: path.resolve('.'), encoding: 'utf8' }
    );
    const hasPass = out.includes('@PASS');
    console.log(`  Output preview: ${out.split('\n').slice(0,4).join(' | ')}`);
    allPass &= check('@PASS in output', true, hasPass);
  } catch (e) {
    console.log(`  ❌ CLI 失敗: ${e.message}`);
    allPass = false;
  }
}

// ─── 清理 ────────────────────────────────────────────────────
fs.rmSync(tmpDir, { recursive: true, force: true });

// ─── 結果 ────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(50));
console.log(allPass ? '✅ 全部通過' : '❌ 有測試失敗');
console.log('═'.repeat(50));
process.exit(allPass ? 0 : 1);
