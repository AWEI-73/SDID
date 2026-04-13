#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const stateMachine = require('./state-machine.cjs');

const SKILL_PATHS = {
  designReviewSkill: path.join('.agent', 'skills', 'design-review', 'SKILL.md'),
  designReviewOverview: path.join('.agent', 'skills', 'design-review', 'references', 'review-overview.md'),
  gateDraft: path.join('.agent', 'skills', 'design-review', 'references', 'gate-draft.md'),
};

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
  const root = path.join(os.tmpdir(), `sdid-route-${name}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(root, '.gems', 'design'), { recursive: true });
  fs.mkdirSync(path.join(root, '.gems', 'iterations', 'iter-1', 'logs'), { recursive: true });
  return root;
}

function writeDraftProject(root) {
  const draftPath = path.join(root, '.gems', 'design', 'draft_iter-1.md');
  writeFile(draftPath, '# Draft\n\nGiven test\nWhen route runs\nThen review is required\n');
  return draftPath;
}

function writeDraftReviewProof(root, artifactPath) {
  const iterDir = path.join(root, '.gems', 'iterations', 'iter-1');
  const reportPath = path.join(iterDir, 'reviews', 'draft-design-review_iter-1.md');
  writeFile(reportPath, '## Design Review\n\n@PASS\n');
  const artifactMtimeMs = fs.statSync(artifactPath).mtimeMs;
  const checkpointPath = path.join(iterDir, '.skill-checkpoints.json');
  const reads = [
    SKILL_PATHS.designReviewSkill,
    SKILL_PATHS.designReviewOverview,
    SKILL_PATHS.gateDraft,
  ].map((skillPath) => ({
    skillPath,
    artifactPath,
    artifactMtimeMs,
    reportPath,
    readAt: new Date().toISOString(),
  }));
  writeFile(checkpointPath, JSON.stringify({ reads }, null, 2));
}

function writePlan(root, withGatePass = false) {
  const planPath = path.join(root, '.gems', 'iterations', 'iter-1', 'plan', 'implementation_plan_Story-1.0.md');
  writeFile(planPath, '# Story-1.0\n');
  if (withGatePass) {
    const logsDir = path.join(root, '.gems', 'iterations', 'iter-1', 'logs');
    writeFile(path.join(logsDir, 'gate-plan-pass-2026-04-08T00-00-00.log'), '@PASS\n');
  }
}

{
  const root = createProject('draft-blocked');
  writeDraftProject(root);
  const state = stateMachine.detectFullState(root, 'iter-1', null);
  assert(state.routeBlocker?.code === 'REQUIRED_DRAFT_REVIEW', 'draft review missing blocks route');
  assert(state.routeBlocker?.requiredSkillPaths?.includes(SKILL_PATHS.gateDraft), 'draft blocker includes gate-draft skill path');
}

{
  const root = createProject('draft-pass');
  const draftPath = writeDraftProject(root);
  writeDraftReviewProof(root, draftPath);
  const state = stateMachine.detectFullState(root, 'iter-1', null);
  assert(!state.routeBlocker, 'draft review proof clears route blocker');
}

{
  const root = createProject('plan-blocked');
  const draftPath = writeDraftProject(root);
  writeDraftReviewProof(root, draftPath);
  writePlan(root, true);
  const state = stateMachine.detectFullState(root, 'iter-1', 'Story-1.0');
  assert(state.phase === 'IMPLEMENTATION_READY', 'plan gate pass now routes to implementation-ready');
  assert(state.routeBlocker?.code === 'REQUIRED_PLAN_REVIEW', 'missing plan review blocks implementation-ready route');
}

{
  const root = createProject('plan-gate');
  const draftPath = writeDraftProject(root);
  writeDraftReviewProof(root, draftPath);
  writePlan(root, false);
  const state = stateMachine.detectFullState(root, 'iter-1', 'Story-1.0');
  assert(state.phase === 'PLAN_GATE', 'existing plans without gate pass route to PLAN_GATE');
}

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
