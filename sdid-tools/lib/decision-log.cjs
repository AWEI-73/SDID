'use strict';

const fs = require('fs');
const path = require('path');

const DETAIL_STATUSES = new Set(['BLOCKER-RESOLVED', 'PASS-DETAIL']);
const NORMALIZED_STATUSES = new Set([
  'PASS',
  'BLOCKER',
  'ERROR',
  'PENDING',
  'READY_TO_PASS',
  'BLOCKER-RESOLVED',
  'PASS-DETAIL',
  'SKIPPED',
]);

function normalizeIter(iter) {
  if (iter === undefined || iter === null || iter === '') return null;
  if (typeof iter === 'number' && Number.isFinite(iter)) return `iter-${iter}`;

  const text = String(iter).trim();
  if (!text) return null;
  if (/^iter-\d+$/.test(text)) return text;
  if (/^\d+$/.test(text)) return `iter-${text}`;
  return text;
}

function normalizeStatus(status) {
  const text = String(status || '').trim().toUpperCase();
  return NORMALIZED_STATUSES.has(text) ? text : (text || 'ERROR');
}

function normalizeErrors(errors) {
  if (!Array.isArray(errors)) return [];
  return errors
    .map((error) => String(error || '').trim())
    .filter(Boolean)
    .slice(0, 10);
}

function writeDecisionLog(target, {
  gate,
  status,
  iter = null,
  story = null,
  errors = [],
  context = null,
  why = null,
  resolution = null,
  supersedes = null,
}) {
  if (!target) return null;

  try {
    const gemsDir = path.join(target, '.gems');
    if (!fs.existsSync(gemsDir)) fs.mkdirSync(gemsDir, { recursive: true });

    const logPath = path.join(gemsDir, 'decision-log.jsonl');
    const normalizedStatus = normalizeStatus(status);
    const needsNarrative = DETAIL_STATUSES.has(normalizedStatus);
    const entry = {
      ts: new Date().toISOString(),
      gate: String(gate || '').trim(),
      status: normalizedStatus,
      iter: normalizeIter(iter),
      story: story ? String(story).trim() : null,
      errors: normalizeErrors(errors),
      context: context || null,
      why: needsNarrative && why ? String(why).trim() : null,
      resolution: needsNarrative && resolution ? String(resolution).trim() : null,
      supersedes: supersedes ? String(supersedes).trim() : null,
    };

    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');
    return path.relative(process.cwd(), logPath);
  } catch (error) {
    return null;
  }
}

module.exports = {
  writeDecisionLog,
  normalizeIter,
  normalizeStatus,
  normalizeErrors,
};
