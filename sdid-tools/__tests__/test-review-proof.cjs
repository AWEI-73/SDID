#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createReviewProof } = require('../lib/review-proof.cjs');
const stateMachine = require('../../sdid-core/state-machine.cjs');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL ${name}`);
  }
}

function writeFile(fp, content) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content, 'utf8');
}

function createProject(name) {
  const root = path.join(os.tmpdir(), `sdid-review-proof-${name}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  fs.mkdirSync(path.join(root, '.gems', 'design'), { recursive: true });
  fs.mkdirSync(path.join(root, '.gems', 'iterations', 'iter-1', 'logs'), { recursive: true });
  return root;
}

{
  const root = createProject('draft');
  const draftPath = path.join(root, '.gems', 'design', 'draft_iter-1.md');
  writeFile(draftPath, '# Draft\n');

  const result = createReviewProof({ projectRoot: root, iter: 'iter-1' });
  assert(result.ok, 'creates proof for current draft blocker');
  assert(fs.existsSync(result.reportPath), 'writes report skeleton');
  assert(fs.existsSync(result.checkpointPath), 'writes checkpoint file');

  const checkpoint = JSON.parse(fs.readFileSync(result.checkpointPath, 'utf8'));
  assert(Array.isArray(checkpoint.reads) && checkpoint.reads.length === 3, 'checkpoint stores required skill reads');

  const report = fs.readFileSync(result.reportPath, 'utf8');
  assert(report.includes('@TODO'), 'report starts as TODO instead of PASS');
  assert(report.includes('.agent\\skills\\design-review\\references\\gate-draft.md') || report.includes('.agent/skills/design-review/references/gate-draft.md'), 'report includes required skill path');
}

{
  const root = createProject('plan');
  const draftPath = path.join(root, '.gems', 'design', 'draft_iter-1.md');
  writeFile(draftPath, '# Draft\n');
  const draftReport = path.join(root, '.gems', 'iterations', 'iter-1', 'reviews', 'draft-design-review_iter-1.md');
  writeFile(draftReport, '# draft\n\n@PASS\n');
  const draftMtimeMs = fs.statSync(draftPath).mtimeMs;
  const draftCheckpointPath = stateMachine.getSkillCheckpointFile(root, 1);
  writeFile(draftCheckpointPath, JSON.stringify({
    reads: [
      '.agent/skills/design-review/SKILL.md',
      '.agent/skills/design-review/references/review-overview.md',
      '.agent/skills/design-review/references/gate-draft.md',
    ].map((skillPath) => ({
      skillPath,
      artifactPath: draftPath,
      artifactMtimeMs: draftMtimeMs,
      reportPath: draftReport,
      readAt: new Date().toISOString(),
    })),
  }, null, 2));
  const planPath = path.join(root, '.gems', 'iterations', 'iter-1', 'plan', 'implementation_plan_Story-1.0.md');
  writeFile(planPath, '# Story-1.0\n');
  writeFile(path.join(root, '.gems', 'iterations', 'iter-1', 'logs', 'gate-plan-pass-2026-04-08T00-00-00.log'), '@PASS\n');

  const result = createReviewProof({ projectRoot: root, iter: 'iter-1', story: 'Story-1.0', kind: 'plan' });
  assert(result.ok, 'creates proof for plan review when requested by kind');
  assert(result.requirement.kind === 'plan-review', 'plan kind resolves correctly');
  assert(fs.existsSync(result.reportPath), 'writes plan review report');
}

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
