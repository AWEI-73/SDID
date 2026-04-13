#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { checkApiContractReadiness } = require('../phases/build/phase-1.cjs');

let passed = 0;
let failed = 0;

function assert(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  OK ${name}`);
  } else {
    failed++;
    console.log(`  NG ${name}${detail ? ` :: ${detail}` : ''}`);
  }
}

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sdid-p1-api-'));
}

function writeFile(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

console.log('\n[Phase 1 API gate]');

// 1. UI-only story -> SKIP
{
  const tmp = mkTmp();
  const result = checkApiContractReadiness(
    tmp,
    'iter-1',
    'Story-13.0',
    { functions: [{ name: 'GanttV5Grid', priority: 'P1', type: 'UI', signature: '(props: Props): JSX.Element' }] },
    ''
  );
  assert('UI-only story skips API gate', result.verdict === 'SKIP', JSON.stringify(result));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// 2. API story without contract -> BLOCKER
{
  const tmp = mkTmp();
  const result = checkApiContractReadiness(
    tmp,
    'iter-1',
    'Story-2.0',
    { functions: [{ name: 'createCategory', priority: 'P0', type: 'API', signature: '(dto: CategoryDto): Category' }] },
    ''
  );
  assert('API story without contract blocks', result.verdict === 'BLOCKER', JSON.stringify(result));
  assert('missing contract file reason', /contract/i.test(result.summary), result.summary);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// 3. API story with story-scoped contract -> PASS
{
  const tmp = mkTmp();
  writeFile(tmp, '.gems/iterations/iter-1/contract_iter-1.ts', `
// @CONTRACT: CategoryApi | P0 | API | Story-2.0
export interface CategoryApi {
  createCategory(dto: CategoryDto): Category;
}
`);
  const result = checkApiContractReadiness(
    tmp,
    'iter-1',
    'Story-2.0',
    { functions: [{ name: 'createCategory', priority: 'P0', type: 'API', signature: '(dto: CategoryDto): Category' }] },
    ''
  );
  assert('API story with contract passes', result.verdict === 'PASS', JSON.stringify(result));
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
