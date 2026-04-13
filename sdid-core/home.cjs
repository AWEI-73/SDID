'use strict';

const path = require('path');

const wrapper = require('./sdid-wrapper.cjs');

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    projectRoot: process.cwd(),
    iteration: null,
    story: null,
    json: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--target=')) args.projectRoot = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iteration=')) args.iteration = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--story=')) args.story = arg.split('=').slice(1).join('=');
    else if (arg === '--json') args.json = true;
  }

  return args;
}

function formatCursor(state) {
  if (!state || !state.phase) return 'UNKNOWN';
  return state.step ? `${state.phase}-${state.step}` : state.phase;
}

function mapStatus(inspected) {
  if (inspected.stage.id === 'complete') return 'DONE';
  if (inspected.blocked && inspected.canRun) return 'REPAIR';
  if (inspected.canRun) return 'RUN';
  return 'UNKNOWN';
}

function summarizeProject(options = {}) {
  const inspected = wrapper.inspectProject(options);
  return {
    status: mapStatus(inspected),
    cursor: formatCursor(inspected.state),
    command: inspected.actionableStage.command || null,
    resume: inspected.resumeStage ? inspected.resumeStage.command : null,
    iteration: inspected.iteration,
  };
}

function main() {
  const args = parseArgs();
  const summary = summarizeProject(args);

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(summary.status);
  console.log(`cursor=${summary.cursor}`);
  console.log(`command=${summary.command || ''}`);
  if (summary.resume) console.log(`resume=${summary.resume}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  formatCursor,
  mapStatus,
  summarizeProject,
};
