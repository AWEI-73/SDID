#!/usr/bin/env node
'use strict';

const path = require('path');
const { createReviewProof } = require('./lib/review-proof.cjs');

function parseArgs(argv) {
  const args = {
    project: process.cwd(),
    iter: null,
    story: null,
    kind: null,
    force: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--force') args.force = true;
    else if (arg.startsWith('--project=')) args.project = path.resolve(arg.split('=')[1]);
    else if (arg.startsWith('--iter=')) {
      const raw = arg.split('=')[1];
      args.iter = /^iter-\d+$/.test(raw) ? raw : `iter-${raw}`;
    } else if (arg.startsWith('--story=')) args.story = arg.split('=')[1];
    else if (arg.startsWith('--kind=')) args.kind = arg.split('=')[1];
  }

  return args;
}

function showHelp() {
  console.log('Usage: node sdid-tools/review-proof.cjs [--project=<path>] [--iter=13] [--story=Story-13.0] [--kind=draft|contract|plan] [--force]');
  console.log('');
  console.log('Behavior:');
  console.log('- Without --kind, create proof for the current route blocker');
  console.log('- With --kind, create proof for that review type if required');
  console.log('- Writes .skill-checkpoints.json and a fixed-format review report skeleton');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const result = createReviewProof({
    projectRoot: args.project,
    iter: args.iter || 'iter-1',
    story: args.story,
    kind: args.kind,
    force: args.force,
  });

  if (!result.ok) {
    console.error(`ERROR: ${result.error}`);
    process.exit(1);
  }

  console.log(`OK: ${result.requirement.kind}`);
  console.log(`ARTIFACT: ${result.requirement.artifactPath}`);
  console.log(`REPORT: ${result.reportPath}`);
  console.log(`CHECKPOINT: ${result.checkpointPath}`);
  console.log('SKILL_PATHS:');
  for (const skillPath of result.requirement.skillPaths) {
    console.log(`- ${skillPath}`);
  }
  console.log(`NEXT: ${result.suggestedNextStep}`);
}

main();
