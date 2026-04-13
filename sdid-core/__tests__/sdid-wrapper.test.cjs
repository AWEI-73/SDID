'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const wrapper = require('../sdid-wrapper.cjs');

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

function testStatusReportsBlockedWhenDraftReviewMissing() {
  const projectRoot = makeTempProject('sdid-wrapper-blocked-draft');

  try {
    writeFile(path.join(projectRoot, '.gems', 'design', 'draft_iter-1.md'), '# draft');

    const status = wrapper.inspectProject({ projectRoot });

    assert.equal(status.state.phase, 'GATE');
    assert.equal(status.stage.id, 'draft-gate');
    assert.equal(status.canRun, true);
    assert.equal(status.blocked, true);
    assert.equal(status.blockedBy.code, 'REQUIRED_DRAFT_REVIEW');
    assert.equal(status.actionableStage.id, 'review-proof');
    assert.ok(status.nextCommand.includes('review-proof.cjs'));
    assert.equal(status.resumeStage.id, 'draft-gate');
  } finally {
    cleanup(projectRoot);
  }
}

function testStatusDoesNotSkipPlanWhenContractExists() {
  const projectRoot = makeTempProject('sdid-wrapper-contract');

  try {
    writeFile(path.join(projectRoot, '.gems', 'design', 'draft_iter-1.md'), '# draft');
    writeFile(path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'contract_iter-1.ts'), '// contract');
    writeFile(
      path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'logs', 'gate-check-pass-2026-04-13T09-59-00.log'),
      '@PASS'
    );
    writeFile(
      path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'reviews', 'contract-design-review_iter-1.md'),
      '@PASS'
    );
    writeFile(
      path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'logs', 'contract-pass-2026-04-13T10-00-00.log'),
      '@PASS'
    );

    const status = wrapper.inspectProject({ projectRoot });

    assert.equal(status.state.phase, 'PLAN');
    assert.equal(status.stage.id, 'plan');
    assert.equal(status.canRun, true);
    assert.equal(status.blocked, true);
    assert.equal(status.blockedBy.code, 'REQUIRED_CONTRACT_REVIEW');
    assert.equal(status.actionableStage.id, 'review-proof');
    assert.equal(status.resumeStage.id, 'plan');
  } finally {
    cleanup(projectRoot);
  }
}

function testDryRunBlockedPersistsStructuredResult() {
  const projectRoot = makeTempProject('sdid-wrapper-dryrun-blocked');

  try {
    writeFile(path.join(projectRoot, '.gems', 'design', 'draft_iter-1.md'), '# draft');

    const result = wrapper.run({
      projectRoot,
      mode: 'auto',
      dryRun: true,
    });

    assert.equal(result.status, 'dry_run');
    assert.equal(result.canRun, true);
    assert.equal(result.blockedBy.code, 'REQUIRED_DRAFT_REVIEW');
    assert.equal(result.actionableStage.id, 'review-proof');
    assert.equal(result.resumeStage.id, 'draft-gate');
    assert.ok(result.commandString.includes('review-proof.cjs'));
    assert.ok(fs.existsSync(result.resultPath));

    const saved = JSON.parse(fs.readFileSync(result.resultPath, 'utf8'));
    assert.equal(saved.status, 'dry_run');
    assert.equal(saved.blocked, true);
    assert.equal(saved.blockedBy.code, 'REQUIRED_DRAFT_REVIEW');
    assert.equal(saved.actionableStage.id, 'review-proof');
  } finally {
    cleanup(projectRoot);
  }
}

function testLegacyPocLogsStillInferLegacyFallbackState() {
  const projectRoot = makeTempProject('sdid-wrapper-legacy-poc');

  try {
    writeFile(
      path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'poc', 'requirement_draft_iter-1.md'),
      '# legacy draft'
    );
    writeFile(
      path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'logs', 'poc-step-4-pass-2026-04-13T10-00-01.log'),
      '@PASS'
    );
    writeFile(
      path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'logs', 'poc-step-5-error-2026-04-13T10-00-02.log'),
      '@ERROR'
    );

    const status = wrapper.inspectProject({ projectRoot });

    assert.equal(status.state.phase, 'POC');
    assert.equal(status.state.step, '5');
    assert.equal(status.stage.id, 'unsupported');
    assert.equal(status.canRun, true);
    assert.equal(status.blocked, true);
    assert.equal(status.blockedBy.code, 'REQUIRED_DRAFT_REVIEW');
    assert.equal(status.actionableStage.id, 'review-proof');
  } finally {
    cleanup(projectRoot);
  }
}

function testBuildStageCarriesStoryAndStepWhenUnblocked() {
  const projectRoot = makeTempProject('sdid-wrapper-build');

  try {
    writeFile(path.join(projectRoot, '.gems', 'design', 'draft_iter-1.md'), '# draft');
    const contractPath = path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'contract_iter-1.ts');
    const planPath = path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'plan', 'implementation_plan_Story-1.0.md');
    const contractReviewPath = path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'reviews', 'contract-design-review_iter-1.md');
    const planReviewPath = path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'reviews', 'plan-review_Story-1.0.md');

    writeFile(contractPath, '// contract');
    writeFile(
      planPath,
      '# plan'
    );
    writeFile(
      path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'logs', 'gate-plan-pass-2026-04-13T10-00-00.log'),
      '@PASS'
    );
    writeFile(
      path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'logs', 'gate-implementation-ready-pass-2026-04-13T10-01-00.log'),
      '@PASS'
    );
    writeFile(
      path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'logs', 'gate-check-pass-2026-04-13T09-58-00.log'),
      '@PASS'
    );
    writeFile(
      path.join(projectRoot, '.gems', 'iterations', 'iter-1', 'logs', 'contract-pass-2026-04-13T09-59-00.log'),
      '@PASS'
    );
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

    const status = wrapper.inspectProject({ projectRoot });

    assert.equal(status.state.phase, 'BUILD');
    assert.equal(status.state.step, '1');
    assert.equal(status.stage.id, 'build');
    assert.equal(status.stage.story, 'Story-1.0');
    assert.equal(status.canRun, true);
    assert.equal(status.blocked, false);
  } finally {
    cleanup(projectRoot);
  }
}

function main() {
  testStatusReportsBlockedWhenDraftReviewMissing();
  testStatusDoesNotSkipPlanWhenContractExists();
  testDryRunBlockedPersistsStructuredResult();
  testLegacyPocLogsStillInferLegacyFallbackState();
  testBuildStageCarriesStoryAndStepWhenUnblocked();
  console.log('sdid-wrapper tests passed');
}

main();
