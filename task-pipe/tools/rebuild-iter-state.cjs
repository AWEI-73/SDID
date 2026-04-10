#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const {
  createInitialState,
  writeState,
  completeIteration,
} = require('../lib/shared/state-manager-v3.cjs');

function parseArgs(argv) {
  const args = { target: null, iter: null, help: false, dryRun: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--target=')) args.target = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iter=')) args.iter = normalizeIteration(arg.split('=')[1]);
    else if (arg.startsWith('--iteration=')) args.iter = normalizeIteration(arg.split('=')[1]);
  }
  return args;
}

function normalizeIteration(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^iter-\d+$/.test(text)) return text;
  if (/^\d+$/.test(text)) return `iter-${text}`;
  return text;
}

function usage() {
  console.log([
    'Usage: node task-pipe/tools/rebuild-iter-state.cjs --target=<project> --iter=<N|iter-N> [--dry-run]',
    '',
    'Rebuilds .gems/iterations/iter-N/.state.json from SDID artifacts:',
    '- draft / contract / plans',
    '- build phase4 markers',
    '- decision-log.jsonl',
    '- iter log files (scan / verify)',
  ].join('\n'));
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function listFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath).map((name) => path.join(dirPath, name));
}

function parseContractStories(contractPath) {
  const raw = readText(contractPath);
  const stories = [];
  const pattern = /^\/\/\s*@GEMS-STORY:\s*(Story-\d+\.\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/gm;
  let match;
  while ((match = pattern.exec(raw)) !== null) {
    stories.push({
      id: match[1].trim(),
      module: match[2].trim(),
      name: match[3].trim(),
    });
  }
  return stories;
}

function parsePlanStories(planDir) {
  return listFiles(planDir)
    .filter((filePath) => /implementation_plan_Story-\d+\.\d+\.md$/i.test(path.basename(filePath)))
    .map((filePath) => {
      const match = path.basename(filePath).match(/implementation_plan_(Story-\d+\.\d+)\.md/i);
      return match ? match[1] : null;
    })
    .filter(Boolean);
}

function parsePhase4DoneStories(buildDir) {
  return listFiles(buildDir)
    .filter((filePath) => /^phase4-done_Story-\d+\.\d+$/i.test(path.basename(filePath)))
    .map((filePath) => {
      const match = path.basename(filePath).match(/phase4-done_(Story-\d+\.\d+)/i);
      return match ? match[1] : null;
    })
    .filter(Boolean);
}

function parseDecisionLog(target, iteration) {
  const entries = [];
  const logPath = path.join(target, '.gems', 'decision-log.jsonl');
  if (!fs.existsSync(logPath)) return entries;

  const lines = readText(logPath).split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.iter !== iteration) continue;
      entries.push(entry);
    } catch {
      // ignore malformed lines
    }
  }
  return entries.sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));
}

function listIterLogs(iterDir) {
  return listFiles(path.join(iterDir, 'logs')).map((filePath) => path.basename(filePath));
}

function detectLatestEvidence({ decisionEntries, iterLogs }) {
  const hasVerifyPass = decisionEntries.some((entry) => entry.gate === 'VERIFY' && /^PASS/.test(String(entry.status || '')))
    || iterLogs.some((name) => /^gate-verify-pass-/i.test(name));
  if (hasVerifyPass) return { phase: 'VERIFY', step: 'run', passed: true };

  const hasScanPass = decisionEntries.some((entry) => /^SCAN/.test(String(entry.gate || '')) && /^PASS/.test(String(entry.status || '')))
    || iterLogs.some((name) => /^scan-scan-pass-/i.test(name));
  if (hasScanPass) return { phase: 'SCAN', step: 'scan', passed: true };

  const buildPasses = decisionEntries
    .filter((entry) => /^BUILD-step\d+$/.test(String(entry.gate || '')) && /^PASS/.test(String(entry.status || '')))
    .sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));
  if (buildPasses.length > 0) {
    const latest = buildPasses[buildPasses.length - 1];
    const match = String(latest.gate).match(/^BUILD-step(\d+)$/);
    return { phase: 'BUILD', step: match ? match[1] : '1', passed: true };
  }

  return null;
}

function inferStoryStatus(storyId, { verifyPassed, scanPassed, phase4DoneSet, planStorySet, storyBuildEntries }) {
  if (verifyPassed) {
    return { status: 'completed', currentPhase: 'VERIFY', currentStep: 'pass' };
  }
  if (scanPassed) {
    return { status: 'scanned', currentPhase: 'SCAN', currentStep: 'scan' };
  }
  if (phase4DoneSet.has(storyId)) {
    return { status: 'built', currentPhase: 'BUILD', currentStep: '4' };
  }
  if (storyBuildEntries.some((entry) => /^PASS/.test(String(entry.status || '')))) {
    const latest = storyBuildEntries[storyBuildEntries.length - 1];
    const match = String(latest.gate || '').match(/^BUILD-step(\d+)$/);
    return { status: 'in-progress', currentPhase: 'BUILD', currentStep: match ? match[1] : '1' };
  }
  if (planStorySet.has(storyId)) {
    return { status: 'planned', currentPhase: 'BUILD', currentStep: '1' };
  }
  return { status: 'drafted', currentPhase: 'DESIGN', currentStep: 'draft' };
}

function inferFlowNode({ verifyPassed, scanPassed, latestEvidence, hasPlan, hasContract, hasDraft }) {
  if (verifyPassed) return { currentNode: 'COMPLETE', exitPoint: 'VERIFY' };
  if (scanPassed) return { currentNode: 'VERIFY-run', exitPoint: null };
  if (latestEvidence && latestEvidence.phase === 'BUILD') return { currentNode: `BUILD-${latestEvidence.step}`, exitPoint: null };
  if (hasPlan) return { currentNode: 'BUILD-1', exitPoint: null };
  if (hasContract) return { currentNode: 'PLAN-WRITE', exitPoint: null };
  if (hasDraft) return { currentNode: 'DESIGN', exitPoint: null };
  return { currentNode: 'DESIGN', exitPoint: null };
}

function buildNotes({ hasDraft, hasContract, planStories, phase4DoneStories, verifyPassed, scanPassed, contractStories }) {
  const notes = [];
  if (hasDraft) notes.push('Rebuilt from draft_iter-N.md evidence.');
  if (hasContract) notes.push('Contract evidence present for this iteration.');
  if (planStories.length > 0) notes.push(`Detected ${planStories.length} implementation plan file(s).`);
  if (phase4DoneStories.length > 0) {
    notes.push(`Detected ${phase4DoneStories.length} phase4-done marker(s).`);
  } else if (scanPassed) {
    notes.push('No phase4-done markers found; story status was inferred from successful SCAN evidence.');
  }
  if (scanPassed && !verifyPassed) notes.push('SCAN passed; next canonical node is VERIFY-run.');
  if (verifyPassed) notes.push('VERIFY passed; iteration can be treated as complete.');
  if (contractStories.length === 0 && hasContract) notes.push('Contract file exists but no @GEMS-STORY lines were parsed.');
  return notes;
}

function rebuildIterState(target, iteration, options = {}) {
  const iterDir = path.join(target, '.gems', 'iterations', iteration);
  const iterNumber = Number(String(iteration).replace('iter-', '')) || 1;
  const draftPath = path.join(target, '.gems', 'design', `draft_iter-${iterNumber}.md`);
  const contractPath = path.join(iterDir, `contract_iter-${iterNumber}.ts`);
  const planDir = path.join(iterDir, 'plan');
  const buildDir = path.join(iterDir, 'build');

  const hasDraft = fs.existsSync(draftPath);
  const hasContract = fs.existsSync(contractPath);
  const planStories = parsePlanStories(planDir);
  const phase4DoneStories = parsePhase4DoneStories(buildDir);
  const decisionEntries = parseDecisionLog(target, iteration);
  const iterLogs = listIterLogs(iterDir);
  const latestEvidence = detectLatestEvidence({ decisionEntries, iterLogs });
  const verifyPassed = latestEvidence?.phase === 'VERIFY';
  const scanPassed = latestEvidence?.phase === 'SCAN' || verifyPassed;
  const contractStories = parseContractStories(contractPath);
  const storyIds = [...new Set([
    ...contractStories.map((story) => story.id),
    ...planStories,
    ...phase4DoneStories,
    ...decisionEntries.map((entry) => entry.story).filter(Boolean),
  ])].sort();

  const state = createInitialState(iteration, { entryPoint: 'DESIGN', mode: 'full' });
  const planStorySet = new Set(planStories);
  const phase4DoneSet = new Set(phase4DoneStories);
  const contractStoryMap = new Map(contractStories.map((story) => [story.id, story]));

  for (const storyId of storyIds) {
    const contractStory = contractStoryMap.get(storyId);
    const storyBuildEntries = decisionEntries
      .filter((entry) => entry.story === storyId && /^BUILD-step\d+$/.test(String(entry.gate || '')))
      .sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));
    const inferred = inferStoryStatus(storyId, {
      verifyPassed,
      scanPassed,
      phase4DoneSet,
      planStorySet,
      storyBuildEntries,
    });
    state.stories[storyId] = {
      id: storyId,
      name: contractStory?.name || storyId,
      status: inferred.status,
      currentPhase: inferred.currentPhase,
      currentStep: inferred.currentStep,
    };
  }

  const inferredFlow = inferFlowNode({
    verifyPassed,
    scanPassed,
    latestEvidence,
    hasPlan: planStories.length > 0,
    hasContract,
    hasDraft,
  });

  state.currentNode = inferredFlow.currentNode;
  state.entryPoint = 'DESIGN';
  state.flow = {
    currentNode: inferredFlow.currentNode,
    entryPoint: 'BUILD-1',
    exitPoint: inferredFlow.exitPoint,
    mode: 'full',
  };
  state.iteration = iteration;
  state.module = contractStories[0]?.module || null;
  state.notes = buildNotes({
    hasDraft,
    hasContract,
    planStories,
    phase4DoneStories,
    verifyPassed,
    scanPassed,
    contractStories,
  });

  if (options.dryRun) return state;

  writeState(target, iteration, state);
  if (verifyPassed) {
    completeIteration(target, iteration);
    return readJson(path.join(iterDir, '.state.json'), state);
  }
  return readJson(path.join(iterDir, '.state.json'), state);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.target || !args.iter) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const result = rebuildIterState(args.target, args.iter, { dryRun: args.dryRun });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  rebuildIterState,
  parseContractStories,
  parsePlanStories,
  parsePhase4DoneStories,
  parseDecisionLog,
  detectLatestEvidence,
  inferStoryStatus,
  inferFlowNode,
};
