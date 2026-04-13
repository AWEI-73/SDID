#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validatePlan } = require('../lib/plan/plan-validator.cjs');
const { anchorPass, anchorError } = require('../lib/shared/log-output.cjs');

function parseArgs() {
  const args = { target: null, iteration: 'iter-1' };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--target=')) args.target = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iteration=')) args.iteration = arg.split('=')[1];
  }
  return args;
}

function evaluatePlans(target, iteration) {
  const iterNum = parseInt(iteration.replace('iter-', ''), 10);
  const planDir = path.join(target, '.gems', 'iterations', iteration, 'plan');
  if (!fs.existsSync(planDir)) {
    return {
      ok: false,
      iterNum,
      planDir,
      files: [],
      summary: [],
      blocker: `No plan directory found: ${planDir}`,
    };
  }

  const files = fs.readdirSync(planDir)
    .filter((file) => /^implementation_plan_Story-\d+\.\d+\.md$/.test(file))
    .sort();

  if (files.length === 0) {
    return {
      ok: false,
      iterNum,
      planDir,
      files: [],
      summary: [],
      blocker: `No implementation_plan files found in ${planDir}`,
    };
  }

  const summary = [];
  let hasErrors = false;

  for (const file of files) {
    const planPath = path.join(planDir, file);
    const result = validatePlan(planPath);
    summary.push({
      file,
      planPath,
      result,
    });
    if (!result.valid) hasErrors = true;
  }

  return {
    ok: !hasErrors,
    iterNum,
    planDir,
    files,
    summary,
    blocker: null,
  };
}

function formatFailureDetails(evaluation) {
  const lines = [
    `PLAN_GATE | ${evaluation.planDir}`,
    '',
    'REFERENCE:',
    '- .agent/skills/sdid/references/plan-writer.md',
    '- .agent/skills/superpowers/writing-plans/plan-document-reviewer-prompt.md',
    '',
    'VALIDATE EACH PLAN:',
  ];

  for (const item of evaluation.summary) {
    lines.push(`- node task-pipe/lib/plan/plan-validator.cjs "${item.planPath}"`);
  }

  lines.push('');
  lines.push('FAILURES:');
  for (const item of evaluation.summary) {
    if (item.result.valid) continue;
    lines.push(`- ${item.file}`);
    for (const error of item.result.errors) {
      lines.push(`  - [${error.rule}] ${error.message}`);
    }
  }

  lines.push('');
  lines.push('NEXT: rewrite invalid plans using the canonical template, then rerun plan-gate.');
  return lines.join('\n');
}

function main() {
  const args = parseArgs();
  if (!args.target) {
    console.error('ERROR: --target is required');
    process.exit(1);
  }

  const evaluation = evaluatePlans(args.target, args.iteration);
  const iterNum = evaluation.iterNum;
  const nextBuildStory = evaluation.summary.find((item) => item.result.valid)?.file?.match(/(Story-\d+\.\d+)/)?.[1] || 'Story-1.0';

  if (!evaluation.ok) {
    const nextCommand = evaluation.files.length > 0
      ? `node task-pipe/tools/plan-gate.cjs --target="${args.target}" --iteration=${args.iteration}`
      : `node task-pipe/tools/spec-to-plan.cjs --target="${args.target}" --iteration=${args.iteration}`;
    const summary = evaluation.blocker
      ? `plan-gate blocked — ${evaluation.blocker}`
      : `plan-gate blocked — ${evaluation.summary.filter((item) => !item.result.valid).length} invalid plan file(s)`;
    const details = evaluation.blocker || formatFailureDetails(evaluation);

    console.log(`REFERENCE: .agent/skills/sdid/references/plan-writer.md`);
    console.log(`REFERENCE: .agent/skills/superpowers/writing-plans/plan-document-reviewer-prompt.md`);
    anchorError('BLOCKER', summary, nextCommand, {
      projectRoot: args.target,
      iteration: iterNum,
      phase: 'gate',
      step: 'plan',
      details,
    });
    process.exit(1);
  }

  console.log(`REFERENCE: .agent/skills/sdid/references/plan-writer.md`);
  console.log(`VALIDATE: node task-pipe/lib/plan/plan-validator.cjs "<project>/.gems/iterations/${args.iteration}/plan/implementation_plan_Story-X.Y.md"`);

  const nextCommand = `node task-pipe/tools/implementation-ready-gate.cjs --target="${args.target}" --iteration=${args.iteration}`;
  anchorPass('gate', 'plan',
    `plan-gate passed — ${evaluation.summary.length} plan file(s) validated, ready for implementation-ready gate`,
    nextCommand,
    {
      projectRoot: args.target,
      iteration: iterNum,
      phase: 'gate',
      step: 'plan',
      details: evaluation.summary.map((item) => `${item.file} | warnings=${item.result.warnings.length}`).join('\n'),
    }
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  evaluatePlans,
};
