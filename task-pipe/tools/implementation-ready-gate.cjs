#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { anchorPass, anchorError } = require('../lib/shared/log-output.cjs');

function parseArgs() {
  const args = { target: null, iteration: 'iter-1' };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--target=')) args.target = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iteration=')) args.iteration = arg.split('=')[1];
  }
  return args;
}

function extractItemBlocks(content) {
  const matches = [...content.matchAll(/^###\s+Item\s+(\d+):\s*([^\n]+)\s*$/gm)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : content.length;
    return {
      item: match[1],
      name: match[2].trim(),
      content: content.slice(start, end),
    };
  });
}

function extractTargetFile(blockContent) {
  const inline = blockContent.match(/\*\*Target File\*\*:\s*`([^`]+)`/);
  if (inline) return inline[1].trim();
  const plain = blockContent.match(/^\s*Target File:\s*`?([^\r\n`]+)`?\s*$/m);
  if (plain) return plain[1].trim();
  return null;
}

function extractGemsFunction(blockContent) {
  const match = blockContent.match(/@GEMS-FUNCTION:\s*([A-Za-z0-9_$]+)/);
  return match ? match[1].trim() : null;
}

function sourceHasFunction(content, fnName) {
  if (!fnName) return false;
  const escaped = fnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`export\\s+(?:default\\s+)?(?:async\\s+)?function\\s+${escaped}\\s*\\(`),
    new RegExp(`export\\s+const\\s+${escaped}\\s*=\\s*(?:async\\s*)?\\(`),
    new RegExp(`export\\s+class\\s+${escaped}\\b`),
    new RegExp(`export\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}`),
  ];
  return patterns.some((pattern) => pattern.test(content));
}

function evaluateImplementationReady(target, iteration) {
  const iterNum = parseInt(iteration.replace('iter-', ''), 10);
  const planDir = path.join(target, '.gems', 'iterations', iteration, 'plan');
  if (!fs.existsSync(planDir)) {
    return {
      ok: false,
      iterNum,
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
      files: [],
      summary: [],
      blocker: `No implementation_plan files found in ${planDir}`,
    };
  }

  const summary = files.map((file) => {
    const planPath = path.join(planDir, file);
    const content = fs.readFileSync(planPath, 'utf8');
    const itemBlocks = extractItemBlocks(content);
    const issues = [];
    const items = itemBlocks.map((block) => {
      const targetFile = extractTargetFile(block.content);
      const fnName = extractGemsFunction(block.content);
      const resolvedTargetFile = targetFile ? path.join(target, targetFile) : null;
      const fileExists = resolvedTargetFile ? fs.existsSync(resolvedTargetFile) : false;
      const source = fileExists ? fs.readFileSync(resolvedTargetFile, 'utf8') : '';
      const hasFn = fileExists && fnName ? sourceHasFunction(source, fnName) : false;
      const itemIssues = [];

      if (!targetFile) itemIssues.push(`Item ${block.item} (${block.name}) missing Target File anchor`);
      if (targetFile && !fileExists) itemIssues.push(`Item ${block.item} (${block.name}) target file missing: ${targetFile}`);
      if (!fnName) itemIssues.push(`Item ${block.item} (${block.name}) missing @GEMS-FUNCTION`);
      if (fnName && block.name !== fnName) itemIssues.push(`Item ${block.item} name "${block.name}" does not match @GEMS-FUNCTION "${fnName}"`);
      if (fileExists && fnName && !hasFn) itemIssues.push(`Item ${block.item} (${block.name}) function "${fnName}" not found in ${targetFile}`);

      issues.push(...itemIssues);
      return {
        item: block.item,
        name: block.name,
        targetFile,
        resolvedTargetFile,
        fnName,
        fileExists,
        hasFn,
        issues: itemIssues,
      };
    });

    return {
      file,
      planPath,
      items,
      valid: issues.length === 0,
      issues,
    };
  });

  return {
    ok: summary.every((item) => item.valid),
    iterNum,
    files,
    summary,
    blocker: null,
  };
}

function formatFailureDetails(evaluation) {
  const lines = [
    `IMPLEMENTATION_READY | iter-${evaluation.iterNum}`,
    '',
    'CHECKS:',
    '- Target File exists in project',
    '- @GEMS-FUNCTION exists in each plan item',
    '- Item name matches @GEMS-FUNCTION',
    '- Source file exports or re-exports the planned function/component',
    '',
    'FAILURES:',
  ];

  for (const item of evaluation.summary) {
    if (item.valid) continue;
    lines.push(`- ${item.file}`);
    for (const issue of item.issues) {
      lines.push(`  - ${issue}`);
    }
  }

  lines.push('');
  lines.push('NEXT: fix the plan/source alignment, then rerun implementation-ready-gate.');
  return lines.join('\n');
}

function main() {
  const args = parseArgs();
  if (!args.target) {
    console.error('ERROR: --target is required');
    process.exit(1);
  }

  const evaluation = evaluateImplementationReady(args.target, args.iteration);
  const nextBuildStory = evaluation.summary.find((item) => item.valid)?.file?.match(/(Story-\d+\.\d+)/)?.[1] || 'Story-1.0';

  if (!evaluation.ok) {
    const nextCommand = `node task-pipe/tools/implementation-ready-gate.cjs --target="${args.target}" --iteration=${args.iteration}`;
    anchorError('BLOCKER',
      evaluation.blocker || `implementation-ready blocked - ${evaluation.summary.filter((item) => !item.valid).length} plan/source mismatch file(s)`,
      nextCommand,
      {
        projectRoot: args.target,
        iteration: evaluation.iterNum,
        phase: 'gate',
        step: 'implementation-ready',
        details: evaluation.blocker || formatFailureDetails(evaluation),
      }
    );
    process.exit(1);
  }

  const nextCommand = `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${nextBuildStory} --target="${args.target}" --iteration=${args.iteration}`;
  anchorPass('gate', 'implementation-ready',
    `implementation-ready passed - ${evaluation.summary.length} plan file(s) mapped to source successfully`,
    nextCommand,
    {
      projectRoot: args.target,
      iteration: evaluation.iterNum,
      phase: 'gate',
      step: 'implementation-ready',
      details: evaluation.summary.map((item) => `${item.file} | items=${item.items.length}`).join('\n'),
    }
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  evaluateImplementationReady,
};
