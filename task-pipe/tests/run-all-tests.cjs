#!/usr/bin/env node
/**
 * SDID Integration Test Runner
 * 
 * 跑所有 task-pipe/tests/ 下的測試，產出統一報告
 * 
 * 用法:
 *   node task-pipe/tests/run-all-tests.cjs
 *   node task-pipe/tests/run-all-tests.cjs --filter=e2e
 *   node task-pipe/tests/run-all-tests.cjs --report=json
 *   node task-pipe/tests/run-all-tests.cjs --report=md --out=report.md
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── CLI args ──
const args = process.argv.slice(2);
const filter = args.find(a => a.startsWith('--filter='))?.split('=')[1] || null;
const reportFormat = args.find(a => a.startsWith('--report='))?.split('=')[1] || 'text';
const outFile = args.find(a => a.startsWith('--out='))?.split('=')[1] || null;
const timeout = parseInt(args.find(a => a.startsWith('--timeout='))?.split('=')[1] || '30000');

// ── Test discovery ──
const TESTS_DIR = __dirname;
const ALL_TESTS = fs.readdirSync(TESTS_DIR)
  .filter(f => f.startsWith('test-') && f.endsWith('.cjs'))
  .sort();

const tests = filter
  ? ALL_TESTS.filter(f => f.includes(filter))
  : ALL_TESTS;

if (tests.length === 0) {
  console.error(`No tests found${filter ? ` matching "${filter}"` : ''}`);
  process.exit(1);
}

// ── Run tests ──
const startTime = Date.now();
const results = [];

console.log(`\n🧪 SDID Test Runner`);
console.log(`${'─'.repeat(60)}`);
console.log(`Tests: ${tests.length}${filter ? ` (filter: "${filter}")` : ''}`);
console.log(`${'─'.repeat(60)}\n`);

for (const testFile of tests) {
  const testPath = path.join(TESTS_DIR, testFile);
  const testStart = Date.now();

  process.stdout.write(`  ▶ ${testFile} ... `);

  const result = spawnSync('node', [testPath], {
    encoding: 'utf8',
    timeout,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    cwd: path.resolve(__dirname, '../..'),
  });

  const elapsed = Date.now() - testStart;
  const passed = result.status === 0;
  const timedOut = result.status === null;

  // Parse pass/fail counts from output if available
  const output = (result.stdout || '') + (result.stderr || '');
  const countMatch = output.match(/(\d+) passed,\s*(\d+) failed/);
  const passCnt = countMatch ? parseInt(countMatch[1]) : null;
  const failCnt = countMatch ? parseInt(countMatch[2]) : null;

  const statusIcon = timedOut ? '⏱' : passed ? '✅' : '❌';
  const countStr = countMatch ? ` (${passCnt}✓ ${failCnt}✗)` : '';
  console.log(`${statusIcon} ${elapsed}ms${countStr}`);

  results.push({
    file: testFile,
    passed,
    timedOut,
    elapsed,
    passCnt,
    failCnt,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  });
}

const totalElapsed = Date.now() - startTime;
const totalPassed = results.filter(r => r.passed).length;
const totalFailed = results.filter(r => !r.passed).length;
const totalTimedOut = results.filter(r => r.timedOut).length;

// ── Summary ──
console.log(`\n${'─'.repeat(60)}`);
console.log(`📊 Summary: ${totalPassed}/${results.length} passed  |  ${totalFailed} failed  |  ${totalElapsed}ms total`);
if (totalTimedOut > 0) console.log(`   ⏱ ${totalTimedOut} timed out`);

// Show failures detail
const failures = results.filter(r => !r.passed);
if (failures.length > 0) {
  console.log(`\n❌ Failed tests:`);
  for (const f of failures) {
    console.log(`\n  ${f.file} (exit ${f.exitCode ?? 'timeout'})`);
    // Show last 20 lines of output
    const lines = (f.stdout + f.stderr).split('\n').filter(Boolean);
    const tail = lines.slice(-20);
    tail.forEach(l => console.log(`    ${l}`));
  }
}

console.log(`${'─'.repeat(60)}\n`);

// ── Report output ──
if (reportFormat === 'json' || outFile?.endsWith('.json')) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: { total: results.length, passed: totalPassed, failed: totalFailed, timedOut: totalTimedOut, elapsed: totalElapsed },
    tests: results.map(r => ({
      file: r.file,
      passed: r.passed,
      timedOut: r.timedOut,
      elapsed: r.elapsed,
      exitCode: r.exitCode,
      passCnt: r.passCnt,
      failCnt: r.failCnt,
      output: r.stdout + r.stderr,
    })),
  };
  const json = JSON.stringify(report, null, 2);
  if (outFile) { fs.writeFileSync(outFile, json, 'utf8'); console.log(`Report saved: ${outFile}`); }
  else console.log(json);
}

if (reportFormat === 'md' || outFile?.endsWith('.md')) {
  const lines = [
    `# SDID Test Report`,
    ``,
    `**Date**: ${new Date().toISOString()}  `,
    `**Result**: ${totalPassed}/${results.length} passed | ${totalFailed} failed | ${totalElapsed}ms`,
    ``,
    `## Results`,
    ``,
    `| Test | Status | Time | Pass | Fail |`,
    `|------|--------|------|------|------|`,
    ...results.map(r => {
      const icon = r.timedOut ? '⏱' : r.passed ? '✅' : '❌';
      return `| ${r.file} | ${icon} | ${r.elapsed}ms | ${r.passCnt ?? '-'} | ${r.failCnt ?? '-'} |`;
    }),
  ];

  if (failures.length > 0) {
    lines.push(``, `## Failures`, ``);
    for (const f of failures) {
      lines.push(`### ${f.file}`, ``, '```');
      const tail = (f.stdout + f.stderr).split('\n').filter(Boolean).slice(-30);
      lines.push(...tail);
      lines.push('```', '');
    }
  }

  const md = lines.join('\n');
  if (outFile) { fs.writeFileSync(outFile, md, 'utf8'); console.log(`Report saved: ${outFile}`); }
  else console.log(md);
}

process.exit(totalFailed > 0 ? 1 : 0);
