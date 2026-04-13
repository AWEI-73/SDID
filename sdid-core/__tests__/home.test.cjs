'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const home = require('../home.cjs');

function makeTempProject(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  fs.mkdirSync(path.join(root, '.gems', 'design'), { recursive: true });
  fs.mkdirSync(path.join(root, '.gems', 'iterations', 'iter-1', 'logs'), { recursive: true });
  return root;
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

function writeFile(filePath, content = '') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createSkillRead(skillPath, artifactPath, reportPath) {
  return {
    skillPath,
    artifactPath,
    artifactMtimeMs: fs.statSync(artifactPath).mtimeMs,
    reportPath,
  };
}

function testSummarizeRepairState() {
  const projectRoot = makeTempProject('sdid-home-repair');

  try {
    writeFile(path.join(projectRoot, '.gems', 'design', 'draft_iter-1.md'), '# draft');

    const summary = home.summarizeProject({ projectRoot });

    assert.equal(summary.mode, 'repair');
    assert.equal(summary.cursor, 'GATE');
    assert.ok(summary.next.includes('review-proof.cjs'));
    assert.ok(summary.resume.includes('draft-gate.cjs'));
    assert.equal(summary.story, null);
    assert.ok(summary.reason);
    assert.ok(Array.isArray(summary.read));
  } finally {
    cleanup(projectRoot);
  }
}

function testSummarizeRunState() {
  const projectRoot = makeTempProject('sdid-home-run');

  try {
    writeFile(path.join(projectRoot, '.gems', 'design', 'draft_iter-1.md'), '# draft');
    const contractPath = path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'contract_iter-1.ts');
    const planPath = path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'plan', 'implementation_plan_Story-1.0.md');
    const contractReviewPath = path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'reviews', 'contract-design-review_iter-1.md');
    const planReviewPath = path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'reviews', 'plan-review_Story-1.0.md');

    writeFile(contractPath, '// contract');
    writeFile(planPath, '# plan');
    writeFile(path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'logs', 'gate-plan-pass-2026-04-13T10-00-00.log'), '@PASS');
    writeFile(path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'logs', 'gate-implementation-ready-pass-2026-04-13T10-01-00.log'), '@PASS');
    writeFile(path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'logs', 'gate-check-pass-2026-04-13T09-58-00.log'), '@PASS');
    writeFile(path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'logs', 'contract-pass-2026-04-13T09-59-00.log'), '@PASS');
    writeFile(contractReviewPath, '@PASS');
    writeFile(planReviewPath, '@PASS');
    writeFile(
      path.join(projectRoot, '.gems', 'iterations', 'iter-1', '.skill-checkpoints.json'),
      JSON.stringify({
        reads: [
          createSkillRead('.agent/skills/design-review/SKILL.md', contractPath, contractReviewPath),
          createSkillRead('.agent/skills/design-review/references/review-overview.md', contractPath, contractReviewPath),
          createSkillRead('.agent/skills/design-review/references/gate-contract.md', contractPath, contractReviewPath),
          createSkillRead('.agent/skills/sdid/references/plan-writer.md', planPath, planReviewPath),
          createSkillRead('.agent/skills/superpowers/writing-plans/plan-document-reviewer-prompt.md', planPath, planReviewPath),
        ],
      }, null, 2)
    );

    const summary = home.summarizeProject({ projectRoot });

    assert.equal(summary.mode, 'run');
    assert.equal(summary.cursor, 'BUILD-1');
    assert.ok(summary.next.includes('task-pipe/runner.cjs --phase=BUILD --step=1'));
    assert.equal(summary.resume, null);
    assert.equal(summary.story, 'Story-1.0');
    assert.equal(summary.reason, null);
    assert.deepEqual(summary.read, []);
  } finally {
    cleanup(projectRoot);
  }
}

function testSummarizeDoneState() {
  const projectRoot = makeTempProject('sdid-home-done');

  try {
    writeFile(
      path.join(projectRoot, '.gems', 'iterations', 'iter-1', '.state.json'),
      JSON.stringify({ status: 'completed' }, null, 2)
    );

    const summary = home.summarizeProject({ projectRoot });

    assert.equal(summary.mode, 'done');
    assert.equal(summary.cursor, 'COMPLETE');
    assert.equal(summary.next, null);
    assert.equal(summary.resume, null);
    assert.equal(summary.story, null);
    assert.equal(summary.reason, null);
    assert.deepEqual(summary.read, []);
  } finally {
    cleanup(projectRoot);
  }
}

function main() {
  testSummarizeRepairState();
  testSummarizeRunState();
  testSummarizeDoneState();
  console.log('home tests passed');
}

main();
