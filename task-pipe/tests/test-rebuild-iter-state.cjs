'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { rebuildIterState } = require('../tools/rebuild-iter-state.cjs');

function mkdirp(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function withTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rebuild-iter-state-'));
  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function testScanPassMovesStateToVerify() {
  withTempProject((root) => {
    mkdirp(path.join(root, '.gems', 'design'));
    mkdirp(path.join(root, '.gems', 'iterations', 'iter-14', 'plan'));
    mkdirp(path.join(root, '.gems', 'iterations', 'iter-14', 'logs'));

    fs.writeFileSync(path.join(root, '.gems', 'design', 'draft_iter-14.md'), '# draft', 'utf8');
    fs.writeFileSync(path.join(root, '.gems', 'iterations', 'iter-14', 'contract_iter-14.ts'), [
      '// @GEMS-STORY: Story-14.0 | gantt-efficiency-pass | Safe gantt lane rendering | FRONTEND',
      '// @GEMS-STORY: Story-14.1 | gantt-efficiency-pass | Working views and owner filtering | FRONTEND',
    ].join('\n'), 'utf8');
    fs.writeFileSync(path.join(root, '.gems', 'iterations', 'iter-14', 'plan', 'implementation_plan_Story-14.0.md'), 'plan', 'utf8');
    fs.writeFileSync(path.join(root, '.gems', 'iterations', 'iter-14', 'plan', 'implementation_plan_Story-14.1.md'), 'plan', 'utf8');
    fs.writeFileSync(path.join(root, '.gems', 'decision-log.jsonl'), JSON.stringify({
      ts: '2026-04-10T07:37:29.546Z',
      gate: 'SCAN-stepnull',
      status: 'PASS',
      iter: 'iter-14',
      story: null,
      errors: [],
      context: null,
      why: null,
      resolution: null,
    }) + '\n', 'utf8');

    const state = rebuildIterState(root, 'iter-14', { dryRun: true });
    assert.equal(state.flow.currentNode, 'VERIFY-run');
    assert.equal(state.stories['Story-14.0'].status, 'scanned');
    assert.equal(state.stories['Story-14.1'].status, 'scanned');
  });
}

function testVerifyPassCompletesIteration() {
  withTempProject((root) => {
    mkdirp(path.join(root, '.gems', 'design'));
    mkdirp(path.join(root, '.gems', 'iterations', 'iter-13', 'plan'));

    fs.writeFileSync(path.join(root, '.gems', 'design', 'draft_iter-13.md'), '# draft', 'utf8');
    fs.writeFileSync(path.join(root, '.gems', 'iterations', 'iter-13', 'contract_iter-13.ts'), [
      '// @GEMS-STORY: Story-13.0 | gantt-ui-refactor | GanttV5Topbar | FRONTEND',
    ].join('\n'), 'utf8');
    fs.writeFileSync(path.join(root, '.gems', 'iterations', 'iter-13', 'plan', 'implementation_plan_Story-13.0.md'), 'plan', 'utf8');
    fs.writeFileSync(path.join(root, '.gems', 'decision-log.jsonl'), JSON.stringify({
      ts: '2026-04-10T07:50:00.000Z',
      gate: 'VERIFY',
      status: 'PASS',
      iter: 'iter-13',
      story: null,
      errors: [],
      context: null,
      why: null,
      resolution: null,
    }) + '\n', 'utf8');

    const state = rebuildIterState(root, 'iter-13', { dryRun: true });
    assert.equal(state.flow.currentNode, 'COMPLETE');
    assert.equal(state.stories['Story-13.0'].status, 'completed');
  });
}

function main() {
  testScanPassMovesStateToVerify();
  testVerifyPassCompletesIteration();
  console.log('test-rebuild-iter-state: 2 passed');
}

main();
