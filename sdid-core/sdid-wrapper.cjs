'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const stateMachine = require('./state-machine.cjs');
const orchestrator = require('./orchestrator.cjs');
const logOutput = require('../task-pipe/lib/shared/log-output.cjs');

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    mode: 'auto',
    projectRoot: process.cwd(),
    iteration: null,
    story: null,
    dryRun: false,
    json: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--mode=')) args.mode = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--target=')) args.projectRoot = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iteration=')) args.iteration = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--story=')) args.story = arg.split('=').slice(1).join('=');
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--json') args.json = true;
  }

  return args;
}

function getIterationNumber(iteration) {
  return parseInt(String(iteration || 'iter-1').replace('iter-', ''), 10);
}

function quoteArg(value) {
  if (value == null) return '';
  const str = String(value);
  return /[\s"]/u.test(str) ? `"${str.replace(/"/g, '\\"')}"` : str;
}

function commandToString(command) {
  return command.map(quoteArg).join(' ');
}

function buildActionableStage(state, stage, blockedBy) {
  if (!blockedBy) {
    return {
      id: stage.id,
      phase: stage.phase,
      step: stage.step,
      story: stage.story,
      command: [...stage.command],
    };
  }

  return {
    id: 'review-proof',
    phase: blockedBy.phase || stage.phase,
    step: null,
    story: blockedBy.story || stage.story || null,
    kind: blockedBy.kind || null,
    command: blockedBy.suggestedCommand || '',
  };
}

function executeStageCommand(stageCommand) {
  if (Array.isArray(stageCommand)) {
    return spawnSync(stageCommand[0], stageCommand.slice(1), {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
    });
  }

  return spawnSync(stageCommand, [], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    shell: true,
  });
}

function buildStageSpec(state) {
  const iteration = state.iter || state.iteration || 'iter-1';
  const projectRoot = state.projectRoot;
  const iterNum = getIterationNumber(iteration);
  const draftPath = state.draftPath || path.join(projectRoot, '.gems', 'design', `draft_iter-${iterNum}.md`);
  const blueprintPath = state.blueprintPath || path.join(projectRoot, '.gems', 'design', 'blueprint.md');
  const contractPath = state.contractPath || path.join(projectRoot, '.gems', 'iterations', iteration, `contract_iter-${iterNum}.ts`);

  switch (state.phase) {
    case 'GATE':
    case 'DRAFT_GATE':
      return {
        id: 'draft-gate',
        phase: state.phase,
        step: state.step || null,
        story: state.story || null,
        command: [
          'node',
          'sdid-tools/blueprint/v5/draft-gate.cjs',
          `--draft=${draftPath}`,
          ...(fs.existsSync(blueprintPath) ? [`--blueprint=${blueprintPath}`] : []),
          `--target=${projectRoot}`,
        ],
      };
    case 'CONTRACT':
      return {
        id: 'contract-gate',
        phase: state.phase,
        step: state.step || null,
        story: state.story || null,
        command: [
          'node',
          'sdid-tools/blueprint/v5/contract-gate.cjs',
          `--contract=${contractPath}`,
          `--target=${projectRoot}`,
          `--iter=${iterNum}`,
          ...(fs.existsSync(blueprintPath) ? [`--blueprint=${blueprintPath}`] : []),
        ],
      };
    case 'PLAN':
      return {
        id: 'plan',
        phase: state.phase,
        step: state.step || null,
        story: state.story || null,
        command: [
          'node',
          'task-pipe/tools/spec-to-plan.cjs',
          `--target=${projectRoot}`,
          `--iteration=${iteration}`,
        ],
      };
    case 'PLAN_GATE':
      return {
        id: 'plan-gate',
        phase: state.phase,
        step: state.step || null,
        story: state.story || null,
        command: [
          'node',
          'task-pipe/tools/plan-gate.cjs',
          `--target=${projectRoot}`,
          `--iteration=${iteration}`,
        ],
      };
    case 'IMPLEMENTATION_READY':
      return {
        id: 'implementation-ready',
        phase: state.phase,
        step: state.step || null,
        story: state.story || null,
        command: [
          'node',
          'task-pipe/tools/implementation-ready-gate.cjs',
          `--target=${projectRoot}`,
          `--iteration=${iteration}`,
        ],
      };
    case 'BUILD':
      return {
        id: 'build',
        phase: state.phase,
        step: state.step || '1',
        story: state.story || null,
        command: [
          'node',
          'task-pipe/runner.cjs',
          '--phase=BUILD',
          `--step=${state.step || '1'}`,
          ...(state.story ? [`--story=${state.story}`] : []),
          `--target=${projectRoot}`,
          `--iteration=${iteration}`,
        ],
      };
    case 'SCAN':
      return {
        id: 'scan',
        phase: state.phase,
        step: state.step || null,
        story: state.story || null,
        command: [
          'node',
          'task-pipe/runner.cjs',
          '--phase=SCAN',
          `--target=${projectRoot}`,
          `--iteration=${iteration}`,
        ],
      };
    case 'VERIFY':
      return {
        id: 'verify',
        phase: state.phase,
        step: state.step || null,
        story: state.story || null,
        command: [
          'node',
          'sdid-tools/blueprint/verify.cjs',
          `--draft=${draftPath}`,
          `--target=${projectRoot}`,
          `--iter=${iterNum}`,
        ],
      };
    case 'COMPLETE':
      return {
        id: 'complete',
        phase: state.phase,
        step: null,
        story: null,
        command: [],
      };
    default:
      return {
        id: 'unsupported',
        phase: state.phase || 'UNKNOWN',
        step: state.step || null,
        story: state.story || null,
        command: [],
      };
  }
}

function getRunArtifacts(projectRoot, iteration, stage) {
  const logsDir = logOutput.getLogsDir(projectRoot, getIterationNumber(iteration));
  logOutput.ensureLogsDir(logsDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = `wrapper-${stage.id}${stage.story ? `-${stage.story}` : ''}-${stamp}`;
  return {
    logsDir,
    logPath: path.join(logsDir, `${baseName}.log`),
    resultPath: path.join(logsDir, `${baseName}.result.json`),
  };
}

function persistRunArtifacts(result, artifacts) {
  fs.writeFileSync(artifacts.logPath, result.logContent, 'utf8');
  fs.writeFileSync(artifacts.resultPath, JSON.stringify(result, null, 2), 'utf8');
}

function inspectProject({ projectRoot, iteration = null, story = null }) {
  const state = orchestrator.detectProjectState(projectRoot, { iter: iteration, story });
  const stage = buildStageSpec(state);
  const blockedBy = state.routeBlocker || null;
  const blocked = Boolean(blockedBy);
  const actionableStage = buildActionableStage(state, stage, blockedBy);
  const canRun = blocked
    ? Boolean(actionableStage.command)
    : stage.id !== 'unsupported' && stage.id !== 'complete';
  const nextCommand = blockedBy?.suggestedCommand || stateMachine.buildNextCommand(state);

  return {
    projectRoot,
    iteration: state.iteration || state.iter || iteration || 'iter-1',
    state,
    stage: {
      ...stage,
      command: commandToString(stage.command),
    },
    actionableStage: {
      ...actionableStage,
      command: Array.isArray(actionableStage.command)
        ? commandToString(actionableStage.command)
        : actionableStage.command,
    },
    resumeStage: blocked ? {
      ...stage,
      command: commandToString(stage.command),
    } : null,
    canRun,
    blocked,
    blockedBy,
    nextCommand,
  };
}

function run(options = {}) {
  const inspected = inspectProject(options);
  const iteration = inspected.iteration;
  const stage = buildStageSpec(inspected.state);
  const actionableStage = buildActionableStage(inspected.state, stage, inspected.blockedBy);
  const artifacts = getRunArtifacts(options.projectRoot || inspected.projectRoot, iteration, stage);

  const baseResult = {
    projectRoot: inspected.projectRoot,
    iteration,
    state: {
      phase: inspected.state.phase,
      step: inspected.state.step || null,
      story: inspected.state.story || null,
      reason: inspected.state.reason || null,
    },
    stage: {
      id: stage.id,
      phase: stage.phase,
      step: stage.step,
      story: stage.story,
    },
    actionableStage: {
      id: actionableStage.id,
      phase: actionableStage.phase,
      step: actionableStage.step,
      story: actionableStage.story,
      kind: actionableStage.kind || null,
    },
    resumeStage: inspected.blocked ? {
      id: stage.id,
      phase: stage.phase,
      step: stage.step,
      story: stage.story,
    } : null,
    canRun: inspected.canRun,
    blocked: inspected.blocked,
    blockedBy: inspected.blockedBy,
    command: actionableStage.command,
    commandString: Array.isArray(actionableStage.command)
      ? commandToString(actionableStage.command)
      : actionableStage.command,
    resumeCommand: inspected.blocked ? commandToString(stage.command) : null,
    nextCommand: inspected.nextCommand,
    startedAt: new Date().toISOString(),
    status: null,
    exitCode: null,
    logPath: artifacts.logPath,
    resultPath: artifacts.resultPath,
    logContent: '',
  };

  if (stage.id === 'complete') {
    const result = {
      ...baseResult,
      endedAt: new Date().toISOString(),
      status: 'complete',
      exitCode: 0,
      logContent: '@PASS | SDID wrapper | workflow already complete\n',
    };
    persistRunArtifacts(result, artifacts);
    return result;
  }

  if (stage.command.length === 0) {
    const result = {
      ...baseResult,
      endedAt: new Date().toISOString(),
      status: 'unsupported',
      exitCode: 1,
      logContent: `@BLOCKER | Unsupported stage: ${stage.phase}\n`,
    };
    persistRunArtifacts(result, artifacts);
    return result;
  }

  if (options.dryRun) {
    const result = {
      ...baseResult,
      endedAt: new Date().toISOString(),
      status: 'dry_run',
      exitCode: 0,
      logContent: inspected.blocked
        ? `@DRY_RUN | blocked at ${stage.id}\nREPAIR: ${baseResult.commandString}\nRESUME: ${baseResult.resumeCommand}\n`
        : `@DRY_RUN | ${stage.id}\nNEXT: ${baseResult.commandString}\n`,
    };
    persistRunArtifacts(result, artifacts);
    return result;
  }

  const execResult = executeStageCommand(actionableStage.command);

  const stdout = execResult.stdout || '';
  const stderr = execResult.stderr || '';
  const exitCode = typeof execResult.status === 'number' ? execResult.status : 1;
  const result = {
    ...baseResult,
    endedAt: new Date().toISOString(),
    status: exitCode === 0 ? (inspected.blocked ? 'repair_pass' : 'pass') : (inspected.blocked ? 'repair_fail' : 'fail'),
    exitCode,
    logContent: [
      inspected.blocked
        ? `@REPAIR | ${inspected.blockedBy.code}\n${inspected.blockedBy.message}\nRESUME: ${baseResult.resumeCommand}\n`
        : '',
      stdout,
      stderr,
    ].filter(Boolean).join('\n'),
  };

  persistRunArtifacts(result, artifacts);
  return result;
}

function main() {
  const args = parseArgs();
  const mode = args.mode.toLowerCase();
  const payload = mode === 'status'
    ? inspectProject(args)
    : run(args);

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (mode === 'status') {
    console.log(`[sdid-wrapper] ${payload.state.phase}${payload.state.step ? `-${payload.state.step}` : ''}`);
    console.log(`canRun: ${payload.canRun}`);
    console.log(`blocked: ${payload.blocked}`);
    if (payload.blockedBy) console.log(`blockedBy: ${payload.blockedBy.code}`);
    console.log(`next: ${payload.actionableStage.command}`);
    if (payload.resumeStage) console.log(`resume: ${payload.resumeStage.command}`);
    return;
  }

  console.log(`[sdid-wrapper] ${payload.status}`);
  console.log(`stage: ${payload.stage.id}`);
  console.log(`result: ${payload.resultPath}`);
  console.log(`log: ${payload.logPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  buildStageSpec,
  inspectProject,
  run,
};
