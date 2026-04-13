#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  writeDecisionLog,
  normalizeIter,
  normalizeStatus,
  normalizeErrors,
} = require('../lib/decision-log.cjs');

const TEST_ROOT = path.join(__dirname, '_tmp-decision-log');
const LOG_PATH = path.join(TEST_ROOT, '.gems', 'decision-log.jsonl');

let pass = 0;
let fail = 0;

function assert(condition, message) {
  if (condition) {
    pass++;
    console.log('PASS ' + message);
  } else {
    fail++;
    console.log('FAIL ' + message);
  }
}

fs.rmSync(TEST_ROOT, { recursive: true, force: true });
fs.mkdirSync(TEST_ROOT, { recursive: true });

writeDecisionLog(TEST_ROOT, {
  gate: 'BUILD-step4',
  status: 'PASS',
  iter: 12,
  story: 'Story-12.0',
  errors: [' one ', '', null],
});

writeDecisionLog(TEST_ROOT, {
  gate: 'VERIFY',
  status: 'pass-detail',
  iter: '12',
  why: 'Used stale functions snapshot.',
  resolution: 'Reran VERIFY after SCAN.',
  supersedes: 'VERIFY|iter-12|stale_functions_json_read',
});

const rows = fs.readFileSync(LOG_PATH, 'utf8')
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line));

assert(rows.length === 2, 'writes JSONL entries');
assert(rows[0].iter === 'iter-12', 'normalizes numeric iter');
assert(rows[0].why === null && rows[0].resolution === null, 'keeps plain PASS concise');
assert(Array.isArray(rows[0].errors) && rows[0].errors.length === 1 && rows[0].errors[0] === 'one', 'normalizes errors');
assert(rows[1].status === 'PASS-DETAIL', 'normalizes detail status');
assert(rows[1].iter === 'iter-12', 'normalizes digit-string iter');
assert(rows[1].why === 'Used stale functions snapshot.', 'stores why on detail status');
assert(rows[1].resolution === 'Reran VERIFY after SCAN.', 'stores resolution on detail status');
assert(rows[1].supersedes === 'VERIFY|iter-12|stale_functions_json_read', 'stores supersedes link');

assert(normalizeIter('iter-9') === 'iter-9', 'normalizeIter keeps canonical iter');
assert(normalizeStatus('blocker-resolved') === 'BLOCKER-RESOLVED', 'normalizeStatus uppercases canonical values');
assert(normalizeErrors([' a ', '', 'b']).join(',') === 'a,b', 'normalizeErrors strips blanks');

fs.rmSync(TEST_ROOT, { recursive: true, force: true });

console.log(`decision-log tests: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
