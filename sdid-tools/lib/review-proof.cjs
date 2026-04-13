'use strict';

const fs = require('fs');
const path = require('path');

const stateMachine = require('../../sdid-core/state-machine.cjs');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function mapKindAlias(kind) {
  const text = String(kind || '').trim().toLowerCase();
  if (!text) return null;
  const aliases = {
    draft: 'draft-design-review',
    'draft-review': 'draft-design-review',
    'draft-design-review': 'draft-design-review',
    contract: 'contract-design-review',
    'contract-review': 'contract-design-review',
    'contract-design-review': 'contract-design-review',
    blueprint: 'blueprint-design-review',
    'blueprint-review': 'blueprint-design-review',
    'blueprint-design-review': 'blueprint-design-review',
    plan: 'plan-review',
    'plan-review': 'plan-review',
  };
  return aliases[text] || text;
}

function buildReportTemplate(requirement) {
  const lines = [
    `# ${requirement.kind}`,
    '',
    `Artifact: ${requirement.artifactPath}`,
    `Phase: ${requirement.phase}`,
    `Checkpoint: ${requirement.checkpointPath}`,
    `Generated At: ${new Date().toISOString()}`,
    '',
    'Required Skill Paths:',
    ...requirement.skillPaths.map((skillPath) => `- ${skillPath}`),
    '',
    '## Verdict',
    '@TODO',
    '',
    'Allowed values:',
    '- @PASS',
    '- @NEEDS_FIX',
    '',
    '## Summary',
    '- TODO: one-line review summary',
    '',
    '## Findings',
    '- TODO: cite concrete issues or say "none"',
    '',
    '## Required Fixes',
    '- TODO: list fixes when verdict is @NEEDS_FIX',
    '',
    '## Notes',
    '- TODO: artifact-specific observations',
    '',
    '## Completion Rules',
    '- Replace @TODO with @PASS or @NEEDS_FIX',
    '- Keep this report newer than the reviewed artifact',
    '- Do not mark @PASS unless the review is complete',
    '',
  ];
  return lines.join('\n');
}

function upsertCheckpoint(checkpointPath, entries) {
  const current = fs.existsSync(checkpointPath)
    ? JSON.parse(fs.readFileSync(checkpointPath, 'utf8'))
    : { reads: [] };
  const reads = Array.isArray(current.reads) ? current.reads.slice() : [];

  for (const entry of entries) {
    const idx = reads.findIndex((existing) =>
      existing &&
      existing.skillPath === entry.skillPath &&
      existing.artifactPath === entry.artifactPath &&
      Number(existing.artifactMtimeMs) === Number(entry.artifactMtimeMs)
    );
    if (idx >= 0) {
      reads[idx] = { ...reads[idx], ...entry };
    } else {
      reads.push(entry);
    }
  }

  fs.writeFileSync(checkpointPath, JSON.stringify({ reads }, null, 2), 'utf8');
}

function resolveRequirement(projectRoot, iter, story, kind) {
  const state = stateMachine.detectFullState(projectRoot, iter, story || null);
  const normalizedKind = mapKindAlias(kind);
  const requirement = normalizedKind
    ? (state.requiredSkillReads || []).find((item) => item.kind === normalizedKind)
    : (state.requiredSkillReads || []).find((item) => !item.satisfied) || null;

  if (!requirement) {
    const available = (state.requiredSkillReads || []).map((item) => item.kind);
    return {
      state,
      requirement: null,
      error: normalizedKind
        ? `No review requirement matched kind="${normalizedKind}". Available: ${available.join(', ')}`
        : 'No active route blocker or review requirement was found.',
    };
  }

  return { state, requirement, error: null };
}

function createReviewProof({ projectRoot, iter = 'iter-1', story = null, kind = null, force = false }) {
  const { requirement, error, state } = resolveRequirement(projectRoot, iter, story, kind);
  if (error) return { ok: false, error, state };

  ensureDir(path.dirname(requirement.reportPath));
  ensureDir(path.dirname(requirement.checkpointPath));

  if (!fs.existsSync(requirement.artifactPath)) {
    return { ok: false, error: `Artifact not found: ${requirement.artifactPath}`, state, requirement };
  }

  if (force || !fs.existsSync(requirement.reportPath)) {
    fs.writeFileSync(requirement.reportPath, buildReportTemplate(requirement), 'utf8');
  }

  const checkpointEntries = requirement.skillPaths.map((skillPath) => ({
    phase: requirement.phase,
    kind: requirement.kind,
    skillPath,
    artifactPath: requirement.artifactPath,
    artifactMtimeMs: requirement.artifactMtimeMs,
    reportPath: requirement.reportPath,
    readAt: new Date().toISOString(),
  }));
  upsertCheckpoint(requirement.checkpointPath, checkpointEntries);

  return {
    ok: true,
    state,
    requirement,
    reportPath: requirement.reportPath,
    checkpointPath: requirement.checkpointPath,
    suggestedNextStep: `Open ${requirement.reportPath} and replace @TODO with @PASS or @NEEDS_FIX after the review.`,
  };
}

module.exports = {
  createReviewProof,
  mapKindAlias,
  buildReportTemplate,
};
