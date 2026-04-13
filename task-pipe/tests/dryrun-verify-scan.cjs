#!/usr/bin/env node
/**
 * DRY RUN: SCAN/VERIFY 產物契約驗證
 *
 * 覆蓋：
 * [1]  verify.cjs: 缺 functions.json → BLOCKER + SCAN next command
 * [2]  verify.cjs: 只有 function-index.json → 不當作 functions cache（BLOCKER）
 * [3]  verify.cjs: 只有 functions-snapshot.json → 不隱式通過（BLOCKER）
 * [4]  verify.cjs: functions.json 空陣列 → BLOCKER（不自動刪除重掃）
 * [5]  verify.cjs: 顯式 --functions= 可指定任意路徑
 * [6]  verify.cjs: 不再 auto-scan（no gems-scanner-unified call）
 * [7]  scan.cjs: 不產出 function-index.json（或產出後立刻刪除）
 * [8]  scan.cjs: 不產出 system-blueprint.json
 * [9]  scan.cjs: PASS summary 只列實際檔案
 * [10] phase-registry.json: SCAN/VERIFY produces/requires 對齊契約
 */
'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

let passed = 0, failed = 0;
function assert(name, condition, reason) {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else           { failed++; console.log(`  ❌ ${name}${reason ? `\n     ${reason}` : ''}`); }
}
function makeTmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'sdid-vs-')); }
function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

// ══════════════════════════════════════════════════════════════
// Helper: capture process.exit and console.error for verify.cjs
// ══════════════════════════════════════════════════════════════
function captureVerifyExit(fn) {
  // verify.cjs calls process.exit(1) on BLOCKER
  // We monkey-patch to capture the call
  const errors = [];
  const origError  = console.error;
  const origExit   = process.exit;
  let exitCode = null;

  console.error = (...a) => errors.push(a.join(' '));
  process.exit   = (code) => { exitCode = code; throw new Error(`EXIT:${code}`); };

  let threw = false;
  try { fn(); }
  catch (e) { if (e.message?.startsWith('EXIT:')) threw = true; else throw e; }
  finally {
    console.error = origError;
    process.exit  = origExit;
  }
  return { exitCode, errors, threw };
}

// ══════════════════════════════════════════════════════════════
// Read verify.cjs source to check for patterns
// ══════════════════════════════════════════════════════════════
const verifySrc = fs.readFileSync(
  path.join(ROOT, 'sdid-tools', 'blueprint', 'verify.cjs'), 'utf8');
const scanSrc = fs.readFileSync(
  path.join(ROOT, 'task-pipe', 'phases', 'scan', 'scan.cjs'), 'utf8');
const registry = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'task-pipe', 'phase-registry.json'), 'utf8'));

// ══════════════════════════════════════════════════════════════
// [1] verify.cjs: 缺 functions.json → BLOCKER + SCAN next command
// ══════════════════════════════════════════════════════════════
console.log('\n[1] verify.cjs: missing functions.json → BLOCKER');
{
  // Test via source inspection (verify.cjs calls process.exit when functions.json missing)
  assert('1a: BLOCKER on missing functions.json (exit 1 path exists)',
    verifySrc.includes("process.exit(1)") &&
    verifySrc.includes("functions.json 不存在"));

  assert('1b: next command points to SCAN --phase=SCAN',
    verifySrc.includes('--phase=SCAN'));

  assert('1c: SCAN next command includes --target=',
    verifySrc.includes('--phase=SCAN --target='));

  // Confirm fix command uses iteration flag
  assert('1d: fix command includes --iteration= if iter provided',
    verifySrc.includes('iterArg') && verifySrc.includes('--iteration=iter-'));
}

// ══════════════════════════════════════════════════════════════
// [2] verify.cjs: function-index.json 不當作 fallback
// ══════════════════════════════════════════════════════════════
console.log('\n[2] verify.cjs: function-index.json not a fallback');
{
  // function-index.json may appear in header/JSDoc comments explaining removal;
  // ensure it does NOT appear in live (non-comment) candidate resolution code
  assert('2a: function-index.json not in live candidate-resolution code',
    !verifySrc.split('\n')
      .filter(l => !/^\s*[/*]/.test(l))
      .join('\n')
      .includes('function-index.json'));

  // The only auto-resolved path is .gems/docs/functions.json
  assert('2b: canonical path is .gems/docs/functions.json',
    verifySrc.includes("'.gems', 'docs', 'functions.json'") ||
    verifySrc.includes('".gems", "docs", "functions.json"') ||
    verifySrc.includes("path.join(args.target, '.gems', 'docs', 'functions.json')"));
}

// ══════════════════════════════════════════════════════════════
// [3] verify.cjs: functions-snapshot.json 不隱式通過
// ══════════════════════════════════════════════════════════════
console.log('\n[3] verify.cjs: functions-snapshot.json not implicit fallback');
{
  // Should NOT appear in the auto-resolution candidates block
  // (May appear in comments explaining what's NOT accepted)
  const candidateBlock = (() => {
    const start = verifySrc.indexOf('functionsPath = path.join');
    const end   = verifySrc.indexOf('process.exit(1)', start);
    return start > -1 ? verifySrc.slice(start, end) : '';
  })();
  assert('3a: functions-snapshot.json not in auto-resolve path',
    !candidateBlock.includes('functions-snapshot'));

  assert('3b: explicit --functions= flag allows any path (snapshot ok if explicit)',
    verifySrc.includes('args.functions') && verifySrc.includes('--functions='));
}

// ══════════════════════════════════════════════════════════════
// [4] verify.cjs: functions.json 空陣列 → BLOCKER，不自動刪除
// ══════════════════════════════════════════════════════════════
console.log('\n[4] verify.cjs: empty functions array → BLOCKER, no auto-delete');
{
  assert('4a: checks for empty functions array',
    verifySrc.includes('fns.length === 0'));

  // Must NOT delete the file (no fs.unlinkSync on functionsPath in empty-check context)
  // The old code did: fs.unlinkSync(functionsPath) when empty
  const emptyBlock = (() => {
    const start = verifySrc.indexOf('fns.length === 0');
    const end   = start > -1 ? verifySrc.indexOf('}', start + 50) : -1;
    return start > -1 ? verifySrc.slice(start, end + 1) : '';
  })();
  assert('4b: no fs.unlinkSync in empty-array BLOCKER block',
    !emptyBlock.includes('unlinkSync'));

  // Find process.exit(1) inside the empty-array guard block (may be after inner if/else)
  assert('4c: empty array triggers process.exit(1)',
    (() => {
      const start   = verifySrc.indexOf('fns.length === 0');
      const exitIdx = start > -1 ? verifySrc.indexOf('process.exit(1)', start) : -1;
      // Make sure process.exit comes before the next unrelated block
      const nextFuncIdx = verifySrc.indexOf('\nfunction ', start > -1 ? start : 0);
      return exitIdx > -1 && (nextFuncIdx === -1 || exitIdx < nextFuncIdx);
    })());
}

// ══════════════════════════════════════════════════════════════
// [5] verify.cjs: 顯式 --functions= 不受限制
// ══════════════════════════════════════════════════════════════
console.log('\n[5] verify.cjs: explicit --functions= accepted');
{
  assert('5a: args.functions checked before canonical path',
    verifySrc.indexOf('args.functions') < verifySrc.indexOf("'.gems', 'docs', 'functions.json'"));
}

// ══════════════════════════════════════════════════════════════
// [6] verify.cjs: 不再 auto-scan (no gems-scanner-unified require)
// ══════════════════════════════════════════════════════════════
console.log('\n[6] verify.cjs: no auto-scan');
{
  // gems-scanner-unified should not be required inside the main() function
  // (It may be in a comment explaining what was removed)
  const requireUnifiedInCode = verifySrc
    .split('\n')
    .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n')
    .includes("require('../../task-pipe/lib/scan/gems-scanner-unified");

  assert('6a: no require gems-scanner-unified in non-comment code',
    !requireUnifiedInCode);

  assert('6b: no auto-scan text in live code',
    !verifySrc.split('\n')
      .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')
      .includes('自動掃描源碼'));

  assert('6c: comment documents removal of auto-scan',
    verifySrc.includes('auto-scan') || verifySrc.includes('auto_scan') ||
    verifySrc.includes('不自行掃描') || verifySrc.includes('VERIFY 不生成'));
}

// ══════════════════════════════════════════════════════════════
// [7] scan.cjs: 不產出 function-index.json
// ══════════════════════════════════════════════════════════════
console.log('\n[7] scan.cjs: no function-index.json production');
{
  // The old code generated it then deleted it
  // Now it should neither generate it nor still mention it in produced[]
  assert('7a: function-index.json not in produced array',
    !scanSrc.includes("'function-index.json'") ||
    // only mention should be in the cleanup/delete array
    scanSrc.split("'function-index.json'").length <= 2); // at most in cleanup + comment

  // generated-then-deleted logic removed
  assert('7b: generateFunctionIndex no longer called',
    !scanSrc.split('\n')
      .filter(l => !l.trim().startsWith('//'))
      .join('\n')
      .includes('generateFunctionIndex('));
}

// ══════════════════════════════════════════════════════════════
// [8] scan.cjs: 不產出 system-blueprint.json
// ══════════════════════════════════════════════════════════════
console.log('\n[8] scan.cjs: no system-blueprint.json production');
{
  const codeLines = scanSrc.split('\n')
    .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');

  // system-blueprint.json should only appear in cleanup (delete) block, not writeFileSync
  // system-blueprint.json should only appear in the cleanup unlinkSync array, never in writeFileSync
  assert('8a: system-blueprint.json only in unlinkSync cleanup, not writeFileSync',
    (() => {
      // Find all writeFileSync calls — system-blueprint.json must not appear as arg
      const writeFsLines = scanSrc.split('\n')
        .filter(l => l.includes('writeFileSync'));
      return !writeFsLines.some(l => l.includes('system-blueprint'));
    })());

  assert('8b: produced const does not include system-blueprint',
    !scanSrc.includes("'system-blueprint.json'") ||
    // only in the cleanup/delete array
    (() => {
      const prodIdx  = scanSrc.indexOf("const produced");
      const bluepIdx = scanSrc.indexOf("'system-blueprint.json'");
      return bluepIdx === -1 || bluepIdx < prodIdx; // only pre-produced (cleanup)
    })());
}

// ══════════════════════════════════════════════════════════════
// [9] scan.cjs: PASS summary 只列實際產物
// ══════════════════════════════════════════════════════════════
console.log('\n[9] scan.cjs: PASS summary lists actual produced files');
{
  assert('9a: produced const has functions.json',
    scanSrc.includes("'functions.json'") &&
    scanSrc.includes("const produced"));

  assert('9b: produced const has project-overview.json',
    scanSrc.includes("'project-overview.json'"));

  assert('9c: produced const has DB_SCHEMA.md',
    scanSrc.includes("'DB_SCHEMA.md'"));

  assert('9d: produced does NOT contain system-blueprint.json or function-index.json',
    (() => {
      // Find the produced array definition
      const m = scanSrc.match(/const produced\s*=\s*\[([^\]]+)\]/);
      if (!m) return false;
      const arr = m[1];
      return !arr.includes('system-blueprint') && !arr.includes('function-index');
    })());

  assert('9e: anchorPass uses actualProduced (not hardcoded list)',
    scanSrc.includes('actualProduced'));

  assert('9f: canonical check confirms functions.json exists before PASS',
    scanSrc.includes('canonicalExists'));
}

// ══════════════════════════════════════════════════════════════
// [10] phase-registry.json: SCAN/VERIFY produces/requires
// ══════════════════════════════════════════════════════════════
console.log('\n[10] phase-registry.json: SCAN/VERIFY contract');
{
  const scan   = registry?.SCAN?.definitions?.scan;
  const verify = registry?.VERIFY?.definitions?.verify;

  assert('10a: SCAN definition exists', !!scan);
  assert('10b: VERIFY definition exists', !!verify);

  if (scan) {
    const canonical = scan.produces?.canonical || scan.produces || [];
    const canonicalArr = Array.isArray(canonical) ? canonical : Object.values(canonical).flat();
    assert('10c: SCAN canonical produces functions_json',
      JSON.stringify(scan.produces).includes('functions_json'));

    assert('10d: SCAN _not_produced lists system_blueprint',
      JSON.stringify(scan._not_produced || []).includes('system_blueprint'));

    assert('10e: SCAN _not_produced lists function_index',
      JSON.stringify(scan._not_produced || []).includes('function_index'));

    assert('10f: SCAN produces has auxiliary_docs (project_overview, db_schema_md)',
      JSON.stringify(scan.produces).includes('project_overview') &&
      JSON.stringify(scan.produces).includes('db_schema_md'));
  }

  if (verify) {
    const requires = verify.requires || [];
    assert('10g: VERIFY requires only functions_json',
      requires.length === 1 && requires[0] === 'functions_json');

    assert('10h: VERIFY _not_accepted lists function_index and functions_snapshot',
      JSON.stringify(verify._not_accepted || []).includes('function_index') &&
      JSON.stringify(verify._not_accepted || []).includes('functions_snapshot'));

    assert('10i: VERIFY produces blueprint_verify_report',
      JSON.stringify(verify.produces || []).includes('blueprint_verify_report'));

    assert('10j: VERIFY produces blueprint_fillback_pending',
      JSON.stringify(verify.produces || []).includes('blueprint_fillback_pending'));
  }

  // flowSequence includes SCAN then VERIFY
  const flow = registry?.flowSequence || [];
  const scanIdx   = flow.findIndex(s => s.phase === 'SCAN');
  const verifyIdx = flow.findIndex(s => s.phase === 'VERIFY');
  assert('10k: flowSequence has SCAN before VERIFY',
    scanIdx > -1 && verifyIdx > -1 && scanIdx < verifyIdx);
}

// ══════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════
console.log(`\n${'─'.repeat(50)}`);
console.log(`dryrun-verify-scan: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
