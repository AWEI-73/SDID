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

function mapMode(inspected) {
  const status = mapStatus(inspected);
  if (status === 'RUN') return 'run';
  if (status === 'REPAIR') return 'repair';
  if (status === 'DONE') return 'done';
  return 'unknown';
}

function getSummaryStory(inspected) {
  return inspected.actionableStage?.story
    || inspected.state?.story
    || inspected.blockedBy?.story
    || null;
}

function getReadPointers(inspected) {
  const reads = [];
  if (inspected.blockedBy?.reportPath) reads.push(inspected.blockedBy.reportPath);
  return reads;
}

function summarizeProject(options = {}) {
  const inspected = wrapper.inspectProject(options);
  const mode = mapMode(inspected);
  const cursor = formatCursor(inspected.state);
  const next = inspected.actionableStage.command || null;
  const resume = inspected.resumeStage && inspected.resumeStage.command
    ? inspected.resumeStage.command
    : null;
  const story = getSummaryStory(inspected);
  const reason = inspected.blockedBy?.message || null;
  const read = getReadPointers(inspected);

  return {
    mode,
    cursor,
    next,
    resume,
    reason,
    read,
    iteration: inspected.iteration,
    story,
    status: mapStatus(inspected),
    command: next,
  };
}

function main() {
  const args = parseArgs();
  const summary = summarizeProject(args);

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(summary.mode);
  console.log(`cursor=${summary.cursor}`);
  console.log(`next=${summary.next || ''}`);
  if (summary.resume) console.log(`resume=${summary.resume}`);
  if (summary.reason) console.log(`reason=${summary.reason}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  formatCursor,
  mapStatus,
  mapMode,
  summarizeProject,
};
