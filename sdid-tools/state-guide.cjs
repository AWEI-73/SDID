#!/usr/bin/env node
/**
 * state-guide.cjs (Wave 3.2 - delegates to sdid-core/state-machine)
 * STATUS / @READ / @HINTS / @NEXT / @GUARD
 *
 * 狀態推斷邏輯已移至 sdid-core/state-machine.cjs（單一真相源）。
 * 此檔保留：CLI 格式化、GEMS 解析、歷史提示、phase script 對應。
 */
'use strict';
const fs = require('fs');
const path = require('path');

// 委派狀態推斷給 state-machine
const sm = require('../sdid-core/state-machine.cjs');
const { tryJson, detectRoute, detectActiveIter, detectFullState, buildNextCommand,
        findDraft, findPlannedStories, findCompletedStories } = sm;

const PHASE_SCRIPT_MAP = {
  POC:  (s) => `task-pipe/phases/poc/step-${s}.cjs`,
  PLAN: (s) => `task-pipe/phases/plan/step-${s}.cjs`,
  BUILD:(s) => `task-pipe/phases/build/phase-${s}.cjs`,
  SCAN: ()  => 'task-pipe/phases/scan/scan.cjs',
};
function getPhaseScript(phase, step) {
  const fn = PHASE_SCRIPT_MAP[phase?.toUpperCase()];
  return fn ? fn(step) : null;
}
// ── Target GEMS resolution ──
function resolveTargetGems(projectRoot, storyId, filterGems) {
  const index = tryJson(path.join(projectRoot, '.gems', 'function-index-v2.json'));
  if (!index) return [];
  const specCache = new Map();
  function loadSpec(rel) {
    if (specCache.has(rel)) return specCache.get(rel);
    const d = tryJson(path.join(projectRoot, '.gems', rel));
    specCache.set(rel, d); return d;
  }
  const results = [];
  for (const [gemsId, entry] of Object.entries(index.byGemsId || {})) {
    if (filterGems && gemsId !== filterGems) continue;
    const specData = entry.specFile ? loadSpec(entry.specFile) : null;
    const dictEntry = specData ? specData[gemsId] : null;
    if (storyId && !filterGems) {
      const ref = dictEntry?.storyRef;
      if (ref && ref !== storyId) continue;
    }
    results.push({
      gemsId, name: entry.name, file: entry.file,
      lineRange: dictEntry?.lineRange || (entry.line ? `L${entry.line}` : null),
      priority: entry.priority, flow: entry.flow,
      specFile: entry.specFile, dictBacked: entry.dictBacked,
      allowedImports: dictEntry?.allowedImports || [],
      storyRef: dictEntry?.storyRef || null,
      status: dictEntry?.status || null,
    });
  }
  return results;
}

// ── History hints ──
function resolveHints(projectRoot, phase, step, story) {
  const mem = tryJson(path.join(projectRoot, '.gems', 'project-memory.json'));
  if (!mem) return { pitfalls: [], histHint: null, resumeCtx: null };
  const s = mem.summary || {};
  const pitfalls = (s.knownPitfalls || []).slice(-2);
  const phaseStep = `${phase}-${step}`;
  const pastErrors = (mem.entries || []).filter(e =>
    `${e.phase}-${e.step}` === phaseStep && e.verdict !== 'PASS' && (!story || e.story !== story));
  let histHint = null;
  if (pastErrors.length > 0) {
    const last = pastErrors[pastErrors.length - 1];
    const missing = last.missing || [];
    histHint = missing.length > 0
      ? `${phaseStep} failed at ${last.story || '?'}: ${missing.join(', ')}`
      : `step failed ${pastErrors.length} times (last: ${last.story || '?'})`;
  }
  const total = `${s.totalPasses || 0}P/${s.totalErrors || 0}E`;
  const resumeCtx = `${mem.project || '?'} | ${s.currentIteration || '?'} | ${total}`;
  return { pitfalls, histHint, resumeCtx };
}

// ── Output formatter ──
function formatGuide(opts) {
  const { phase, step, story, iter, route, resumeCtx, scriptPath, gems: gemsRaw, pitfalls, histHint, phase2Script, fullState } = opts;
  const gems = gemsRaw || [];
  const SEP = '='.repeat(50);
  const L = [];
  L.push('', SEP, '  SDID State Guide', SEP, '');
  const label = phase ? `${phase}${step ? ' '+step : ''}` : '(unknown)';
  L.push(`STATUS: ${label}, ${story || '(no story)'}, ${iter}`);
  if (resumeCtx) L.push(`  memory: ${resumeCtx}`);
  L.push(`ROUTE: ${route}`);
  const planned = fullState?.plannedStories || [];
  const completed = fullState?.completedStories || [];
  if (planned.length > 0) {
    L.push('', `STORIES: ${completed.length}/${planned.length}`);
    for (const s of planned) {
      const done = completed.includes(s);
      L.push(`  ${s}: ${done ? 'DONE' : (s === story ? 'ACTIVE' : 'PENDING')}`);
    }
  }
  L.push('', '@READ:');
  if (scriptPath) L.push(`  script: ${scriptPath}`);
  if (phase2Script) L.push(`  gems-check: ${phase2Script}`);
  if (gems.length > 0) {
    const specFiles = [...new Set(gems.map(g => g.specFile).filter(Boolean))];
    for (const sf of specFiles) L.push(`  dict: .gems/${sf}`);
    L.push('', '  targets:');
    for (const g of gems) {
      const fp = g.file ? `${g.file.replace(/\\\\/g, '/')} ${g.lineRange || ''}`.trim() : '';
      L.push(`  - ${g.gemsId} [${g.priority || '?'}] ${g.status ? '('+g.status+')' : ''}`);
      if (fp) L.push(`    -> ${fp}`);
      if (g.flow) L.push(`    flow: ${g.flow}`);
    }
  } else { L.push('  targets: (none)'); }
  L.push('', '@HINTS:');
  if (pitfalls.length > 0) { for (const p of pitfalls) L.push(`  @PITFALL: ${p}`); }
  else { L.push('  (no pitfalls)'); }
  if (histHint) L.push(`  @HINT: ${histHint}`);
  L.push('', 'NEXT: ' + (fullState ? buildNextCommand(fullState) : '(confirm state first)'));
  L.push('', '@GUARD:');
  const hasImports = gems.some(g => g.allowedImports?.length > 0);
  if (hasImports) {
    for (const g of gems) {
      if (g.allowedImports?.length > 0) L.push(`  [${g.gemsId}]: allowedImports = [${g.allowedImports.join(', ')}]`);
    }
  }
  L.push('  no imports outside allowedImports');
  L.push('  no modifying src/shared/types');
  L.push('', SEP, '');
  return L.join('\n');
}

// ── CLI ──
if (require.main === module) {
  const argv = process.argv.slice(2);
  let projectRoot = process.cwd();
  let iterOpt = null, storyOpt = null, gemsOpt = null;
  for (const a of argv) {
    if (a.startsWith('--project=')) projectRoot = path.resolve(a.split('=')[1]);
    if (a.startsWith('--iter=')) iterOpt = a.split('=')[1];
    if (a.startsWith('--story=')) storyOpt = a.split('=')[1];
    if (a.startsWith('--gems=')) gemsOpt = a.split('=')[1];
    if (a === '--help' || a === '-h') {
      console.log('Usage: node sdid-tools/state-guide.cjs --project=<dir> [--iter=iter-N] [--story=Story-N.N] [--gems=Domain.Action]');
      process.exit(0);
    }
  }
  if (!fs.existsSync(projectRoot)) { console.error('error: not found: ' + projectRoot); process.exit(1); }
  const iter = iterOpt || detectActiveIter(projectRoot);
  const fullState = detectFullState(projectRoot, iter, storyOpt);
  const { phase, step, story } = fullState;
  const scriptPath = phase && step ? getPhaseScript(phase, step) : null;
  const phase2Script = (phase === 'BUILD' && parseInt(step) !== 2) ? 'task-pipe/phases/build/phase-2.cjs' : null;
  const gems = resolveTargetGems(projectRoot, story, gemsOpt);
  const { pitfalls, histHint, resumeCtx } = resolveHints(projectRoot, phase, step, story);
  process.stdout.write(formatGuide({ phase, step, story, iter, route: fullState.route, resumeCtx, scriptPath, phase2Script, gems, pitfalls, histHint, fullState }));
  process.exit(0);
}

module.exports = {
  detectRoute, detectActiveIter, detectFullState,
  resolveTargetGems, resolveHints, formatGuide, buildNextCommand,
  findDraft, findPlannedStories, findCompletedStories,
};
