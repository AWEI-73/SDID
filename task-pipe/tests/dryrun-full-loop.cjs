#!/usr/bin/env node
/**
 * Dry-run: 完整 Blueprint Flow 閉環測試
 *
 * 覆蓋範圍:
 *   1. state-machine: detectRoute / inferStateFromLogs / detectFullState
 *   2. Blueprint Flow 狀態轉移: NO_DRAFT → GATE → CONTRACT → PLAN → BUILD 1-4 → SCAN → VERIFY → COMPLETE
 *   3. Milestone 功能驗證: M24(log精簡) M25(adversarial hint) M17(@UNTAGGED) M23(subagent hint) M16(API簽名)
 *   4. 閉環驗證: 每個 phase 的 terminal state 是否正確觸發下一步
 *
 * 用法: node task-pipe/tests/dryrun-full-loop.cjs
 */

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const stateMachine = require(path.join(ROOT, 'sdid-core', 'state-machine.cjs'));
const logOutput = require(path.join(ROOT, 'task-pipe', 'lib', 'shared', 'log-output.cjs'));

// ─── 測試基礎設施 ────────────────────────────────────────────
let passed = 0, failed = 0, warnings = 0;
const origLog = console.log;

function ok(name) { origLog(`  ✅ ${name}`); passed++; }
function fail(name, reason) { origLog(`  ❌ ${name}\n     ${reason}`); failed++; }
function warn(name, reason) { origLog(`  ⚠️  ${name}: ${reason}`); warnings++; }

function assert(name, cond, reason = '') {
  cond ? ok(name) : fail(name, reason || 'assertion failed');
}

function assertContains(name, str, pattern) {
  assert(name, str.includes(pattern), `缺少 "${pattern}"\n     實際: ${str.slice(0, 200)}`);
}

function assertNotContains(name, str, pattern) {
  assert(name, !str.includes(pattern), `不應出現 "${pattern}"`);
}

// 攔截 console.log
let captured = [];
function startCapture() { captured = []; console.log = (...a) => captured.push(a.join(' ')); }
function stopCapture() { console.log = origLog; return captured.join('\n'); }

// 建立臨時專案目錄
function mkTmp(name) {
  const p = path.join(os.tmpdir(), `sdid-dryrun-${Date.now()}-${name}`);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function writeLog(proj, iterNum, prefix, content = '@PASS\n') {
  const logsDir = path.join(proj, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  fs.writeFileSync(path.join(logsDir, `${prefix}-${ts}.log`), content);
}

function writeFile(proj, relPath, content = '') {
  const full = path.join(proj, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

// ─── Section 1: state-machine 狀態推斷 ──────────────────────
origLog('\n══════════════════════════════════════════════════');
origLog('  Section 1: state-machine 狀態推斷');
origLog('══════════════════════════════════════════════════\n');

// 1.1 detectRoute — v6 Blueprint (design/draft_iter-1.md)
{
  const proj = mkTmp('route-bp');
  writeFile(proj, '.gems/design/draft_iter-1.md', '# Draft\n');
  const route = stateMachine.detectRoute(proj, 'iter-1');
  assert('detectRoute: v6 draft → Blueprint', route === 'Blueprint', `got: ${route}`);
  fs.rmSync(proj, { recursive: true, force: true });
}

// 1.2 detectRoute — v6 Blueprint (design/blueprint.md)
{
  const proj = mkTmp('route-bp2');
  writeFile(proj, '.gems/design/blueprint.md', '# Blueprint\n');
  const route = stateMachine.detectRoute(proj, 'iter-1');
  assert('detectRoute: v6 blueprint.md → Blueprint', route === 'Blueprint', `got: ${route}`);
  fs.rmSync(proj, { recursive: true, force: true });
}

// 1.3 detectRoute — v5 legacy Task-Pipe
{
  const proj = mkTmp('route-tp');
  writeFile(proj, '.gems/iterations/iter-1/poc/requirement_spec_iter-1.md', '# Spec\n');
  const route = stateMachine.detectRoute(proj, 'iter-1');
  assert('detectRoute: v5 spec → Task-Pipe', route === 'Task-Pipe', `got: ${route}`);
  fs.rmSync(proj, { recursive: true, force: true });
}

// 1.4 inferStateFromLogs — NO_DRAFT (no logs)
{
  const proj = mkTmp('state-nodraft');
  stateMachine.ensureIterStructure(proj, 1);
  const state = stateMachine.inferStateFromLogs(proj, 1, [], []);
  assert('inferStateFromLogs: no logs → null', state === null, `got: ${JSON.stringify(state)}`);
  fs.rmSync(proj, { recursive: true, force: true });
}

// 1.5 inferStateFromLogs — gate-check-pass → CONTRACT（CYNEFIN 不再是 phase）
{
  const proj = mkTmp('state-contract');
  writeLog(proj, 1, 'gate-check-pass');
  const state = stateMachine.inferStateFromLogs(proj, 1, [], []);
  assert('inferStateFromLogs: gate-check-pass → CONTRACT', state?.phase === 'CONTRACT', `got: ${JSON.stringify(state)}`);
  fs.rmSync(proj, { recursive: true, force: true });
}

// 1.6 inferStateFromLogs — gate-check-pass + contract-pass → PLAN
{
  const proj = mkTmp('state-plan');
  writeLog(proj, 1, 'gate-check-pass');
  writeLog(proj, 1, 'contract-pass');
  const state = stateMachine.inferStateFromLogs(proj, 1, [], []);
  assert('inferStateFromLogs: contract-pass → PLAN', state?.phase === 'PLAN', `got: ${JSON.stringify(state)}`);
  fs.rmSync(proj, { recursive: true, force: true });
}

// 1.8 inferStateFromLogs — gate-plan-pass → BUILD Phase 1
{
  const proj = mkTmp('state-build1');
  writeLog(proj, 1, 'gate-plan-pass');
  writeFile(proj, '.gems/iterations/iter-1/plan/implementation_plan_Story-1.0.md', '# Plan\n');
  const planned = stateMachine.findPlannedStories(proj, 1);
  const state = stateMachine.inferStateFromLogs(proj, 1, planned, []);
  assert('inferStateFromLogs: gate-plan-pass → BUILD Phase 1', state?.phase === 'BUILD' && state?.step === '1', `got: ${JSON.stringify(state)}`);
  fs.rmSync(proj, { recursive: true, force: true });
}

// 1.9 inferStateFromLogs — build-phase-4-pass → VERIFY (all stories done)
{
  const proj = mkTmp('state-verify');
  writeLog(proj, 1, 'gate-plan-pass');
  writeLog(proj, 1, 'build-phase-4-Story-1.0-pass');
  writeFile(proj, '.gems/iterations/iter-1/plan/implementation_plan_Story-1.0.md', '# Plan\n');
  writeFile(proj, '.gems/iterations/iter-1/build/Fillback_Story-1.0.md', '# Fillback\n');
  const planned = stateMachine.findPlannedStories(proj, 1);
  const completed = stateMachine.findCompletedStories(proj, 1);
  const state = stateMachine.inferStateFromLogs(proj, 1, planned, completed);
  assert('inferStateFromLogs: build-phase-4-pass (all done) → VERIFY', state?.phase === 'VERIFY', `got: ${JSON.stringify(state)}`);
  fs.rmSync(proj, { recursive: true, force: true });
}

// 1.10 inferStateFromLogs — gate-verify-pass → COMPLETE
{
  const proj = mkTmp('state-complete');
  writeLog(proj, 1, 'gate-verify-pass');
  const state = stateMachine.inferStateFromLogs(proj, 1, [], []);
  assert('inferStateFromLogs: gate-verify-pass → COMPLETE', state?.phase === 'COMPLETE', `got: ${JSON.stringify(state)}`);
  fs.rmSync(proj, { recursive: true, force: true });
}

// 1.11 inferStateFromLogs — build-phase-2-pass → BUILD Phase 3 (same story)
{
  const proj = mkTmp('state-build3');
  writeLog(proj, 1, 'gate-plan-pass');
  writeLog(proj, 1, 'build-phase-2-Story-1.0-pass');
  writeFile(proj, '.gems/iterations/iter-1/plan/implementation_plan_Story-1.0.md', '# Plan\n');
  const planned = stateMachine.findPlannedStories(proj, 1);
  const state = stateMachine.inferStateFromLogs(proj, 1, planned, []);
  assert('inferStateFromLogs: build-phase-2-pass → BUILD Phase 3', state?.phase === 'BUILD' && state?.step === '3', `got: ${JSON.stringify(state)}`);
  fs.rmSync(proj, { recursive: true, force: true });
}

// 1.12 inferStateFromLogs — multi-story: Story-1.0 done → Story-1.1 BUILD Phase 1
{
  const proj = mkTmp('state-multistory');
  writeLog(proj, 1, 'gate-plan-pass');
  writeLog(proj, 1, 'build-phase-4-Story-1.0-pass');
  writeFile(proj, '.gems/iterations/iter-1/plan/implementation_plan_Story-1.0.md', '# Plan\n');
  writeFile(proj, '.gems/iterations/iter-1/plan/implementation_plan_Story-1.1.md', '# Plan\n');
  writeFile(proj, '.gems/iterations/iter-1/build/Fillback_Story-1.0.md', '# Fillback\n');
  const planned = stateMachine.findPlannedStories(proj, 1);
  const completed = stateMachine.findCompletedStories(proj, 1);
  const state = stateMachine.inferStateFromLogs(proj, 1, planned, completed);
  assert('inferStateFromLogs: Story-1.0 done → Story-1.1 BUILD Phase 1',
    state?.phase === 'BUILD' && state?.story === 'Story-1.1', `got: ${JSON.stringify(state)}`);
  fs.rmSync(proj, { recursive: true, force: true });
}

// 1.13 detectFullState — v6 draft exists → GATE
{
  const proj = mkTmp('full-gate');
  writeFile(proj, '.gems/design/draft_iter-1.md', '# Draft\n');
  stateMachine.ensureIterStructure(proj, 1);
  const state = stateMachine.detectFullState(proj, 'iter-1', null);
  assert('detectFullState: v6 draft → GATE', state?.phase === 'GATE', `got: ${JSON.stringify(state)}`);
  fs.rmSync(proj, { recursive: true, force: true });
}

// 1.14 buildNextCommand — BUILD phase
{
  const proj = mkTmp('next-cmd');
  const cmd = stateMachine.buildNextCommand({
    phase: 'BUILD', step: '2', story: 'Story-1.0', iter: 'iter-1', projectRoot: proj
  });
  assert('buildNextCommand: BUILD → runner.cjs', cmd.includes('runner.cjs') && cmd.includes('--phase=BUILD') && cmd.includes('--step=2'), `got: ${cmd}`);
  fs.rmSync(proj, { recursive: true, force: true });
}

// ─── Section 2: log-output 精簡化 (M24) ─────────────────────
origLog('\n══════════════════════════════════════════════════');
origLog('  Section 2: log-output 精簡化 (M24)');
origLog('══════════════════════════════════════════════════\n');

const tmpLogDir = path.join(os.tmpdir(), `sdid-log-test-${Date.now()}`);
const logsPath = path.join(tmpLogDir, '.gems', 'iterations', 'iter-1', 'logs');
fs.mkdirSync(logsPath, { recursive: true });
const commonOpts = { projectRoot: tmpLogDir, iteration: 1, phase: 'build', step: 'phase-2', story: 'Story-1.0' };

// 2.1 anchorPass — 終端只印 @PASS + NEXT:
{
  startCapture();
  logOutput.anchorPass('BUILD', 'Phase 2', '標籤驗收通過', 'node runner.cjs --phase=BUILD --step=3', commonOpts);
  const out = stopCapture();
  assertContains('anchorPass: 有 @PASS', out, '@PASS');
  assertContains('anchorPass: 有 NEXT:', out, 'NEXT:');
  assertNotContains('anchorPass: 無「下一步」', out, '下一步');
}

// 2.2 anchorError — 終端有 @READ: 指向 log
{
  startCapture();
  logOutput.anchorError('TACTICAL_FIX', '標籤缺失', 'node runner.cjs --phase=BUILD --step=2',
    { ...commonOpts, attempt: 1, maxAttempts: 3, details: '詳細...' });
  const out = stopCapture();
  assertContains('anchorError: 有 @READ:', out, '@READ:');
  assertContains('anchorError: 有 @GUARD', out, '@GUARD');
  assertNotContains('anchorError: 無 @FORBIDDEN', out, '@FORBIDDEN');
  assertNotContains('anchorError: 無 MILITARY-SPECS', out, 'MILITARY-SPECS');
}

// 2.3 anchorErrorSpec — 終端精簡，詳情在 log
{
  startCapture();
  logOutput.anchorErrorSpec({
    targetFile: 'src/services/foo.ts',
    missing: ['GEMS-FLOW'],
    example: '/** GEMS: foo | P0 */',
    nextCmd: 'node runner.cjs --phase=BUILD --step=2',
    attempt: 1, maxAttempts: 3,
    gateSpec: { checks: [{ name: 'GEMS-FLOW', pass: false }] }
  }, commonOpts);
  const out = stopCapture();
  assertContains('anchorErrorSpec: 有 @ERROR_SPEC', out, '@ERROR_SPEC');
  assertContains('anchorErrorSpec: 有 @READ:', out, '@READ:');
  assertNotContains('anchorErrorSpec: 無完整 GATE_SPEC', out, '@GATE_SPEC (本步驟');
  assertNotContains('anchorErrorSpec: 無 ═══ 分隔線', out, '═══');
}

// 2.4 anchorOutput — @ARCHITECTURE_REVIEW 只印摘要
{
  startCapture();
  logOutput.anchorOutput({
    context: 'BUILD Phase 4 | Story-1.0',
    architectureReview: {
      summary: '架構健康',
      details: '詳細分析內容...\n'.repeat(20)
    },
    output: 'NEXT: node runner.cjs --phase=SCAN'
  }, commonOpts);
  const out = stopCapture();
  // 終端不應印出大量詳細內容
  const lineCount = out.split('\n').length;
  assert('anchorOutput: @ARCHITECTURE_REVIEW 不塞 context', lineCount < 30, `輸出 ${lineCount} 行，太多了`);
}

// 2.5 emitTaskBlock — 有 @TASK-N + @NEXT_COMMAND + @GUARD
{
  if (logOutput.emitTaskBlock) {
    startCapture();
    logOutput.emitTaskBlock({
      tasks: [
        { action: 'FIX', file: 'src/a.ts', expected: '加 GEMS-FLOW' },
        { action: 'FIX', file: 'src/b.ts', expected: '加 GEMS-DEPS' }
      ],
      nextCommand: 'node runner.cjs --phase=BUILD --step=2',
      verdict: 'BLOCKER',
      context: 'BUILD Phase 2 | Story-1.0'
    }, commonOpts);
    const out = stopCapture();
    assertContains('emitTaskBlock: 有 @TASK-1', out, '@TASK-1');
    assertContains('emitTaskBlock: 有 @TASK-2', out, '@TASK-2');
    assertContains('emitTaskBlock: 有 @NEXT_COMMAND', out, '@NEXT_COMMAND');
    assertContains('emitTaskBlock: 有 @GUARD', out, '@GUARD');
    assertNotContains('emitTaskBlock: 無 @FORBIDDEN', out, '@FORBIDDEN');
  } else {
    warn('emitTaskBlock', '函式不存在，跳過');
  }
}

fs.rmSync(tmpLogDir, { recursive: true, force: true });

// ─── Section 3: CYNEFIN quick-scan (M26) ────────────────────
origLog('\n══════════════════════════════════════════════════');
origLog('  Section 3: CYNEFIN quick-scan (M26)');
origLog('══════════════════════════════════════════════════\n');

{
  let gate;
  try { gate = require(path.join(ROOT, 'sdid-tools', 'blueprint', 'gate.cjs')); } catch (e) {
    warn('gate.cjs 載入', e.message); gate = null;
  }

  if (gate && gate.quickScanChaotic) {
    // 3.1 正常 draft — 不觸發 Chaotic
    // gate.cjs 用 Object.entries(draft.moduleActions)，所以要用物件格式
    const normalDraft = {
      moduleActions: {
        UserModule: { items: [{ name: 'createUser' }, { name: 'deleteUser' }], fillLevel: 'done' },
        OrderModule: { items: [{ name: 'placeOrder' }, { name: 'cancelOrder' }], fillLevel: 'done' }
      }
    };
    const r1 = gate.quickScanChaotic('正常的需求文件，功能明確，沒有模糊詞', normalDraft);
    assert('quickScanChaotic: 正常 draft 不觸發', !r1.isCharotic, `signals: ${JSON.stringify(r1.signals)}`);

    // 3.2 模糊詞密度高 — 觸發 Chaotic（3+ 模糊詞）
    const vagueDraft = '可能需要某種方式來處理一些情況，也許可以考慮某些方案，待定，TBD，未確定';
    const r2 = gate.quickScanChaotic(vagueDraft, { moduleActions: {} });
    assert('quickScanChaotic: 模糊詞密度高 → Chaotic', r2.isCharotic, `signals: ${JSON.stringify(r2.signals)}`);

    // 3.3 空模組（缺動作清單）— 觸發 Chaotic
    const emptyModuleDraft = {
      moduleActions: {
        EmptyModule: { items: [], fillLevel: 'stub' },
        AnotherEmpty: { items: [] },
        ThirdEmpty: { items: [] }
      }
    };
    const r3 = gate.quickScanChaotic('正常文字', emptyModuleDraft);
    assert('quickScanChaotic: 空模組 → Chaotic', r3.isCharotic, `signals: ${JSON.stringify(r3.signals)}`);
  } else {
    warn('quickScanChaotic', gate ? '函式未 export' : 'gate.cjs 載入失敗');
  }
}

// ─── Section 4: SCAN @UNTAGGED 路徑 (M17) ───────────────────
origLog('\n══════════════════════════════════════════════════');
origLog('  Section 4: SCAN @UNTAGGED 路徑 (M17)');
origLog('══════════════════════════════════════════════════\n');

{
  // 使用 test-blueprint-flow（已知有 untagged 函式）來驗證 @UNTAGGED 輸出格式
  const testProj = path.join(ROOT, 'test-blueprint-flow');
  if (!fs.existsSync(testProj)) {
    warn('Section 4', 'test-blueprint-flow 不存在，跳過');
  } else {
    let scanOut = '';
    try {
      scanOut = execSync(
        `node task-pipe/runner.cjs --phase=SCAN --target=test-blueprint-flow --iteration=iter-2`,
        { cwd: ROOT, encoding: 'utf8', timeout: 30000 }
      );
    } catch (e) {
      scanOut = (e.stdout || '') + (e.stderr || '');
    }

    // 4.1 @UNTAGGED 區塊存在
    assert('SCAN: 有 @UNTAGGED 輸出', scanOut.includes('@UNTAGGED'), `輸出: ${scanOut.slice(0, 300)}`);

    // 4.2 路徑不含 src\src 重複
    const hasDuplicate = scanOut.includes('src\\src') || scanOut.includes('src/src');
    assert('SCAN: @UNTAGGED 路徑無 src/src 重複', !hasDuplicate, `輸出: ${scanOut.slice(0, 500)}`);

    // 4.3 路徑格式正確（含 src/）
    if (scanOut.includes('@UNTAGGED')) {
      const lines = scanOut.split('\n').filter(l => l.trim().startsWith('- '));
      if (lines.length > 0) {
        const firstPath = lines[0];
        assert('SCAN: @UNTAGGED 路徑含 src/', firstPath.includes('src'), `路徑: ${firstPath}`);
      }
    }

    // 4.4 functions.json 有 untaggedCount
    const fnJson = path.join(testProj, '.gems', 'docs', 'functions.json');
    if (fs.existsSync(fnJson)) {
      const fj = JSON.parse(fs.readFileSync(fnJson, 'utf8'));
      assert('SCAN: functions.json 有 untaggedCount', typeof fj.untaggedCount === 'number',
        `untaggedCount: ${fj.untaggedCount}`);
      assert('SCAN: functions.json 有 untagged 陣列', Array.isArray(fj.untagged),
        `untagged: ${JSON.stringify(fj.untagged)}`);
    } else {
      warn('functions.json', '不存在，跳過驗證');
    }
  }
}

// ─── Section 5: loop.mjs @SUBAGENT-HINT (M23) ───────────────
origLog('\n══════════════════════════════════════════════════');
origLog('  Section 5: loop.mjs @SUBAGENT-HINT (M23)');
origLog('══════════════════════════════════════════════════\n');

{
  // 讀取 loop.mjs 原始碼，確認 @SUBAGENT-HINT 邏輯存在
  const loopPath = path.join(ROOT, 'sdid-tools', 'mcp-server', 'adapters', 'loop.mjs');
  const loopSrc = fs.readFileSync(loopPath, 'utf8');

  assert('loop.mjs: 有 @SUBAGENT-HINT', loopSrc.includes('@SUBAGENT-HINT'),
    '找不到 @SUBAGENT-HINT 字串');
  assert('loop.mjs: 有 complexity= 標記', loopSrc.includes('complexity='),
    '找不到 complexity= 標記');
  assert('loop.mjs: 有 model= 標記', loopSrc.includes('model='),
    '找不到 model= 標記');
  assert('loop.mjs: Phase 1 HIGH complexity', loopSrc.includes("complexity: 'HIGH'"),
    '找不到 Phase 1 HIGH');
  assert('loop.mjs: Phase 3/4 LOW complexity', loopSrc.includes("complexity: 'LOW'"),
    '找不到 Phase 3/4 LOW');
  assert('loop.mjs: 有 lite model 建議', loopSrc.includes("model: 'lite'"),
    '找不到 lite model');
}

// ─── Section 6: phase-1 API 簽名對齊 (M16) ──────────────────
origLog('\n══════════════════════════════════════════════════');
origLog('  Section 6: phase-1 API 簽名對齊 (M16)');
origLog('══════════════════════════════════════════════════\n');

{
  const phase1Path = path.join(ROOT, 'task-pipe', 'phases', 'build', 'phase-1.cjs');
  const phase1Src = fs.readFileSync(phase1Path, 'utf8');

  // 6.1 generatePlanSpecsBlock 存在
  assert('phase-1: generatePlanSpecsBlock 函式存在', phase1Src.includes('function generatePlanSpecsBlock'),
    '找不到 generatePlanSpecsBlock');

  // 6.2 manifest 分支有 API 簽名對齊表
  assert('phase-1: manifest 分支有 API 簽名對齊表', phase1Src.includes('API 簽名對齊表'),
    '找不到「API 簽名對齊表」');

  // 6.3 從 signature 推導函式骨架
  assert('phase-1: 有函式骨架推導', phase1Src.includes('throw new Error'),
    '找不到骨架推導（throw new Error）');

  // 6.4 實際執行 generatePlanSpecsBlock（透過 mock plan）
  const proj = mkTmp('phase1-api');
  const planContent = `# Story-1.0: 使用者管理

**Story ID**: Story-1.0
**Story 目標**: 實作使用者建立與刪除功能

## 1. Story 目標

建立使用者管理的核心 CRUD 功能。

## 3. 工作項目

| Item | 名稱 | Type | Priority | 說明 |
|------|------|------|----------|------|
| 1 | createUser | FEATURE | P0 | 建立使用者 |
| 2 | deleteUser | FEATURE | P1 | 刪除使用者 |

## 4. Item 詳細規格

### Item 1: createUser

\`\`\`typescript
/**
 * GEMS: createUser | P0 | ✓✓ | (name: string, email: string)→User | Story-1.0 | 建立使用者
 * GEMS-FLOW: validate→create→return
 * GEMS-DEPS: []
 */
// AC-1.0 建立使用者成功
// [STEP] 驗證輸入
// [STEP] 建立使用者
// [STEP] 回傳結果
export function createUser(name: string, email: string): User {
  throw new Error('not implemented');
}
\`\`\`

**檔案**: \`src/shared/services/user-service.ts\`

### Item 2: deleteUser

\`\`\`typescript
/**
 * GEMS: deleteUser | P1 | ✓✓ | (id: string)→void | Story-1.0 | 刪除使用者
 * GEMS-FLOW: find→delete
 * GEMS-DEPS: []
 */
// AC-1.1 刪除使用者成功
export function deleteUser(id: string): void {
  throw new Error('not implemented');
}
\`\`\`

**檔案**: \`src/shared/services/user-service.ts\`

## 8. 架構審查

無特殊架構風險。
`;
  writeFile(proj, '.gems/iterations/iter-1/plan/implementation_plan_Story-1.0.md', planContent);

  let phase1Out = '';
  try {
    phase1Out = execSync(
      `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.0 --target="${proj}" --iteration=iter-1`,
      { cwd: ROOT, encoding: 'utf8', timeout: 30000 }
    );
  } catch (e) {
    phase1Out = (e.stdout || '') + (e.stderr || '');
  }

  // Phase 1 應輸出 API 簽名相關內容（PLAN_SPECS 或 API 簽名對齊表）
  const hasApiInfo = phase1Out.includes('createUser') || phase1Out.includes('API 簽名') || phase1Out.includes('PLAN_SPECS');
  assert('phase-1: 輸出含 API 簽名資訊', hasApiInfo, `輸出: ${phase1Out.slice(0, 400)}`);

  fs.rmSync(proj, { recursive: true, force: true });
}

// ─── Section 7: Blueprint Flow 完整閉環 ─────────────────────
origLog('\n══════════════════════════════════════════════════');
origLog('  Section 7: Blueprint Flow 完整閉環');
origLog('══════════════════════════════════════════════════\n');

{
  const proj = mkTmp('full-loop');
  stateMachine.ensureIterStructure(proj, 1);

  // 7.1 初始狀態：有 draft → GATE
  writeFile(proj, '.gems/design/draft_iter-1.md', '# Draft\n## 模組動作表\n');
  const s0 = stateMachine.detectFullState(proj, 'iter-1', null);
  assert('閉環 Step 0: draft → GATE', s0?.phase === 'GATE', `got: ${s0?.phase}`);

  // 7.2 gate-check-pass → CYNEFIN_CHECK
  writeLog(proj, 1, 'gate-check-pass');
  const s1 = stateMachine.inferStateFromLogs(proj, 1, [], []);
  assert('閉環 Step 1: gate-check-pass → CYNEFIN_CHECK', s1?.phase === 'CYNEFIN_CHECK', `got: ${s1?.phase}`);

  // 7.3 cynefin-check-pass → CONTRACT
  writeLog(proj, 1, 'cynefin-check-pass');
  const s2 = stateMachine.inferStateFromLogs(proj, 1, [], []);
  assert('閉環 Step 2: cynefin-check-pass → CONTRACT', s2?.phase === 'CONTRACT', `got: ${s2?.phase}`);

  // 7.4 contract-pass → PLAN
  writeLog(proj, 1, 'contract-pass');
  const s3 = stateMachine.inferStateFromLogs(proj, 1, [], []);
  assert('閉環 Step 3: contract-pass → PLAN', s3?.phase === 'PLAN', `got: ${s3?.phase}`);

  // 7.5 gate-plan-pass → BUILD Phase 1
  writeLog(proj, 1, 'gate-plan-pass');
  writeFile(proj, '.gems/iterations/iter-1/plan/implementation_plan_Story-1.0.md', '# Plan\n');
  const planned = stateMachine.findPlannedStories(proj, 1);
  const s4 = stateMachine.inferStateFromLogs(proj, 1, planned, []);
  assert('閉環 Step 4: gate-plan-pass → BUILD Phase 1',
    s4?.phase === 'BUILD' && s4?.step === '1', `got: ${JSON.stringify(s4)}`);

  // 7.6 build-phase-1-pass → BUILD Phase 2
  writeLog(proj, 1, 'build-phase-1-Story-1.0-pass');
  const s5 = stateMachine.inferStateFromLogs(proj, 1, planned, []);
  assert('閉環 Step 5: build-phase-1-pass → BUILD Phase 2',
    s5?.phase === 'BUILD' && s5?.step === '2', `got: ${JSON.stringify(s5)}`);

  // 7.7 build-phase-2-pass → BUILD Phase 3
  writeLog(proj, 1, 'build-phase-2-Story-1.0-pass');
  const s6 = stateMachine.inferStateFromLogs(proj, 1, planned, []);
  assert('閉環 Step 6: build-phase-2-pass → BUILD Phase 3',
    s6?.phase === 'BUILD' && s6?.step === '3', `got: ${JSON.stringify(s6)}`);

  // 7.8 build-phase-3-pass → BUILD Phase 4
  writeLog(proj, 1, 'build-phase-3-Story-1.0-pass');
  const s7 = stateMachine.inferStateFromLogs(proj, 1, planned, []);
  assert('閉環 Step 7: build-phase-3-pass → BUILD Phase 4',
    s7?.phase === 'BUILD' && s7?.step === '4', `got: ${JSON.stringify(s7)}`);

  // 7.9 build-phase-4-pass (all stories done) → VERIFY
  writeLog(proj, 1, 'build-phase-4-Story-1.0-pass');
  writeFile(proj, '.gems/iterations/iter-1/build/Fillback_Story-1.0.md', '# Fillback\n');
  const completed = stateMachine.findCompletedStories(proj, 1);
  const s8 = stateMachine.inferStateFromLogs(proj, 1, planned, completed);
  assert('閉環 Step 8: build-phase-4-pass (all done) → VERIFY',
    s8?.phase === 'VERIFY', `got: ${JSON.stringify(s8)}`);

  // 7.10 gate-verify-pass → COMPLETE
  writeLog(proj, 1, 'gate-verify-pass');
  const s9 = stateMachine.inferStateFromLogs(proj, 1, planned, completed);
  assert('閉環 Step 9: gate-verify-pass → COMPLETE', s9?.phase === 'COMPLETE', `got: ${s9?.phase}`);

  fs.rmSync(proj, { recursive: true, force: true });
}

// ─── Section 8: SCAN → VERIFY 前置條件 ──────────────────────
origLog('\n══════════════════════════════════════════════════');
origLog('  Section 8: SCAN → VERIFY 前置條件');
origLog('══════════════════════════════════════════════════\n');

{
  // loop.mjs 在 VERIFY 前會先確認 scan-scan-pass log 存在
  const loopPath = path.join(ROOT, 'sdid-tools', 'mcp-server', 'adapters', 'loop.mjs');
  const loopSrc = fs.readFileSync(loopPath, 'utf8');

  assert('loop.mjs: VERIFY 前檢查 scan-scan-pass', loopSrc.includes('scan-scan-pass-'),
    '找不到 scan-scan-pass 前置條件檢查');
  assert('loop.mjs: VERIFY 前無 scan → 轉 SCAN', loopSrc.includes("state.phase = 'SCAN'"),
    '找不到 VERIFY→SCAN 重導向邏輯');
}

// ─── Section 9: adversarial-reviewer 存在 (M25) ─────────────
origLog('\n══════════════════════════════════════════════════');
origLog('  Section 9: adversarial-reviewer 存在 (M25)');
origLog('══════════════════════════════════════════════════\n');

{
  const reviewerPath = path.join(ROOT, 'sdid-tools', 'blueprint', 'v5', 'adversarial-reviewer.cjs');
  assert('adversarial-reviewer.cjs 存在', fs.existsSync(reviewerPath), '檔案不存在');

  if (fs.existsSync(reviewerPath)) {
    const src = fs.readFileSync(reviewerPath, 'utf8');
    assert('adversarial-reviewer: 有 @DRIFT 輸出', src.includes('@DRIFT') || src.includes('DRIFT'),
      '找不到 @DRIFT');
    assert('adversarial-reviewer: 有 contract 比對邏輯', src.includes('contract') || src.includes('CONTRACT'),
      '找不到 contract 比對');
  }

  // loop.mjs 在 VERIFY 前呼叫 adversarial-reviewer
  const loopSrc = fs.readFileSync(path.join(ROOT, 'sdid-tools', 'mcp-server', 'adapters', 'loop.mjs'), 'utf8');
  assert('loop.mjs: VERIFY 前呼叫 adversarial-reviewer', loopSrc.includes('adversarial-reviewer.cjs'),
    '找不到 adversarial-reviewer.cjs 呼叫');
}

// ─── Section 10: runner.cjs 基本健康 ────────────────────────
origLog('\n══════════════════════════════════════════════════');
origLog('  Section 10: runner.cjs 基本健康');
origLog('══════════════════════════════════════════════════\n');

{
  // 10.1 runner.cjs 可以正常載入
  let runner;
  try {
    runner = require(path.join(ROOT, 'task-pipe', 'runner.cjs'));
    assert('runner.cjs 可載入', true);
  } catch (e) {
    fail('runner.cjs 可載入', e.message);
  }

  // 10.2 runner.cjs --dry-run 不崩潰
  try {
    const out = execSync(
      `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.0 --target=. --dry-run`,
      { cwd: ROOT, encoding: 'utf8', timeout: 10000 }
    );
    assert('runner.cjs --dry-run 不崩潰', true);
  } catch (e) {
    // exit code 1 是正常的（缺少 plan 檔案），只要不是 syntax error
    const isExpectedError = (e.stdout || '').includes('BLOCKER') || (e.stdout || '').includes('缺少') || (e.stderr || '').includes('缺少');
    assert('runner.cjs --dry-run 不崩潰（預期 BLOCKER）', isExpectedError,
      `stderr: ${(e.stderr || '').slice(0, 200)}`);
  }

  // 10.3 SCAN phase 可以正常執行（用 test-blueprint-flow）
  const testProj = path.join(ROOT, 'test-blueprint-flow');
  if (fs.existsSync(testProj)) {
    try {
      const out = execSync(
        `node task-pipe/runner.cjs --phase=SCAN --target=test-blueprint-flow --iteration=iter-2`,
        { cwd: ROOT, encoding: 'utf8', timeout: 30000 }
      );
      assert('SCAN on test-blueprint-flow: @PASS', out.includes('@PASS'), `輸出: ${out.slice(0, 300)}`);
    } catch (e) {
      const out = (e.stdout || '') + (e.stderr || '');
      assert('SCAN on test-blueprint-flow: @PASS', out.includes('@PASS'), `輸出: ${out.slice(0, 300)}`);
    }
  } else {
    warn('test-blueprint-flow', '目錄不存在，跳過 SCAN 測試');
  }
}

// ─── 最終結果 ────────────────────────────────────────────────
origLog('\n══════════════════════════════════════════════════');
origLog(`  結果: ${passed} passed, ${failed} failed, ${warnings} warnings`);
origLog('══════════════════════════════════════════════════\n');

if (failed > 0) {
  origLog(`❌ ${failed} 個測試失敗，請檢查上方錯誤`);
  process.exit(1);
} else {
  origLog(`✅ 全部通過！Blueprint Flow 閉環正常`);
  process.exit(0);
}

