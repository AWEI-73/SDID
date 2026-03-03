#!/usr/bin/env node
/**
 * state-guide.cjs (Wave 3.1 - Blueprint + Task-Pipe unified navigation)
 * STATUS / @READ / @HINTS / @NEXT / @GUARD
 */
'use strict';
const fs = require('fs');
const path = require('path');
const SDID_ROOT = path.resolve(__dirname, '..');

function tryJson(fp) {
  if (!fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

const PHASE_SCRIPT_MAP = {
  POC: (s) => `task-pipe/phases/poc/step-${s}.cjs`,
  PLAN: (s) => `task-pipe/phases/plan/step-${s}.cjs`,
  BUILD: (s) => `task-pipe/phases/build/phase-${s}.cjs`,
  SCAN: () => 'task-pipe/phases/scan/scan.cjs',
};
function getPhaseScript(phase, step) {
  const fn = PHASE_SCRIPT_MAP[phase?.toUpperCase()];
  return fn ? fn(step) : null;
}

// ── Route detection ──
function detectRoute(projectRoot) {
  const iterDirs = path.join(projectRoot, '.gems', 'iterations');
  if (fs.existsSync(iterDirs)) {
    for (const it of fs.readdirSync(iterDirs)) {
      if (fs.existsSync(path.join(iterDirs, it, 'poc', 'poc-consolidation-log.md'))) return 'POC-FIX';
    }
  }
  if (fs.existsSync(path.join(projectRoot, '.gems', 'poc-consolidation-log.md'))) return 'POC-FIX';
  if (fs.existsSync(iterDirs)) {
    for (const it of fs.readdirSync(iterDirs)) {
      const pocDir = path.join(iterDirs, it, 'poc');
      if (fs.existsSync(pocDir) && fs.readdirSync(pocDir).some(f => f.startsWith('requirement_draft_')))
        return 'Blueprint';
    }
  }
  if (fs.existsSync(path.join(projectRoot, 'requirement-draft.md'))) return 'Blueprint';
  if (fs.existsSync(path.join(projectRoot, 'requirement-spec.md'))) return 'Task-Pipe';
  const specsDir = path.join(projectRoot, '.gems', 'specs');
  if (fs.existsSync(specsDir) && fs.readdirSync(specsDir).some(f => f.endsWith('.json') && f !== '_index.json'))
    return 'POC-FIX';
  return 'Unknown';
}

// ── Blueprint helpers ──
function findDraft(pp, n) {
  const d = path.join(pp, '.gems', 'iterations', `iter-${n}`, 'poc');
  if (!fs.existsSync(d)) return null;
  const f = fs.readdirSync(d).filter(x => x.startsWith('requirement_draft_'));
  return f.length ? path.join(d, f[0]) : null;
}
function findPlannedStories(pp, n) {
  const d = path.join(pp, '.gems', 'iterations', `iter-${n}`, 'plan');
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => f.startsWith('implementation_plan_'))
    .map(f => { const m = f.match(/Story-(\d+\.\d+)/); return m ? `Story-${m[1]}` : null; })
    .filter(Boolean).sort();
}
function findCompletedStories(pp, n) {
  const d = path.join(pp, '.gems', 'iterations', `iter-${n}`, 'build');
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => f.startsWith('Fillback_'))
    .map(f => { const m = f.match(/Story-(\d+\.\d+)/); return m ? `Story-${m[1]}` : null; })
    .filter(Boolean).sort();
}
function detectActiveIter(projectRoot) {
  const dir = path.join(projectRoot, '.gems', 'iterations');
  if (!fs.existsSync(dir)) return 'iter-1';
  const ds = fs.readdirSync(dir).filter(d => /^iter-\d+$/.test(d))
    .sort((a, b) => parseInt(b.replace('iter-', '')) - parseInt(a.replace('iter-', '')));
  if (!ds.length) return 'iter-1';
  for (const d of ds) {
    const st = tryJson(path.join(dir, d, '.state.json'));
    if (st && st.status === 'active') return d;
  }
  return ds[0];
}

// ── Log-based state inference (BUG-002 fix) ──
function inferStateFromLogs(projectRoot, iterNum, plannedStories, completedStories) {
  const logsDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
  if (!fs.existsSync(logsDir)) return null;
  const logs = fs.readdirSync(logsDir).sort();
  const has = (prefix) => logs.some(f => f.startsWith(prefix));

  // Check from most advanced state backward
  if (has('gate-verify-pass-')) {
    const nextDraft = findDraft(projectRoot, iterNum + 1);
    return nextDraft
      ? { phase: 'NEXT_ITER', step: null, story: null }
      : { phase: 'COMPLETE', step: null, story: null };
  }
  if (has('gate-shrink-pass-')) {
    const allDone = plannedStories.length > 0 && plannedStories.every(s => completedStories.includes(s));
    if (allDone) return { phase: 'VERIFY', step: null, story: null };
    const ns = plannedStories.find(s => !completedStories.includes(s));
    return ns ? { phase: 'BUILD', step: '1', story: ns } : { phase: 'VERIFY', step: null, story: null };
  }
  // Find highest BUILD phase pass
  let maxPhase = 0, latestStory = null;
  for (const f of logs) {
    const m = f.match(/^build-phase-(\d+)-Story-([\d.]+)-pass-/);
    if (m) { const p = parseInt(m[1]); if (p > maxPhase) { maxPhase = p; latestStory = `Story-${m[2]}`; } }
  }
  if (maxPhase > 0) {
    if (maxPhase >= 8) {
      const ns = plannedStories.find(s => !completedStories.includes(s));
      return ns ? { phase: 'BUILD', step: '1', story: ns } : { phase: 'SHRINK', step: null, story: null };
    }
    return { phase: 'BUILD', step: String(maxPhase + 1), story: latestStory };
  }
  if (has('gate-plan-pass-')) return { phase: 'BUILD', step: '1', story: plannedStories[0] || null };
  if (has('gate-check-pass-')) return { phase: 'PLAN', step: null, story: null };
  return null;
}

// ── Unified state detection (Wave 3 core) ──
function detectFullState(projectRoot, iter, storyOpt) {
  const iterNum = parseInt(iter.replace('iter-', ''), 10);
  const route = detectRoute(projectRoot);
  let sm = null;
  try { sm = require(path.join(SDID_ROOT, 'task-pipe', 'lib', 'shared', 'state-manager-v3.cjs')); } catch {}
  const draftPath = findDraft(projectRoot, iterNum);
  const plannedStories = findPlannedStories(projectRoot, iterNum);
  const completedStories = findCompletedStories(projectRoot, iterNum);
  const lastStep = tryJson(path.join(projectRoot, '.gems', 'last_step_result.json'));
  let state = sm ? sm.readState(projectRoot, iter) : null;
  let phase = null, step = null, story = storyOpt || null;

  if (state && sm) {
    if (state.status === 'completed' || state.status === 'abandoned') {
      return { phase: 'COMPLETE', step: null, story: null, route, iter, draftPath, plannedStories, completedStories, projectRoot, reason: `${iter} ${state.status}` };
    }
    if (state.flow && state.flow.currentNode && state.flow.currentNode !== 'COMPLETE') {
      const p = sm.parseNode(state.flow.currentNode);
      phase = p.phase; step = p.step;
    }
    if (!story && state.stories) {
      story = Object.keys(state.stories).find(s => state.stories[s].status === 'in-progress')
           || Object.keys(state.stories).find(s => state.stories[s].status === 'pending') || null;
    }
    if (phase === 'SHRINK') {
      const ns = plannedStories.find(s => !completedStories.includes(s));
      if (ns) { phase = 'BUILD'; step = '1'; story = ns; }
    }
    if (phase === 'NEXT_ITER') {
      const nd = findDraft(projectRoot, iterNum + 1);
      return nd
        ? { phase: 'NEXT_ITER', step: null, story: null, route, iter, draftPath, plannedStories, completedStories, projectRoot, nextIter: `iter-${iterNum+1}`, reason: 'next iter' }
        : { phase: 'COMPLETE', step: null, story: null, route, iter, draftPath, plannedStories, completedStories, projectRoot, reason: 'all done' };
    }
  }
  if (!phase && lastStep) { phase = lastStep.phase || null; step = lastStep.step || null; }
  if (phase === 'BUILD' && !story) { story = plannedStories.find(s => !completedStories.includes(s)) || null; }

  // Log-based inference: when no state-manager/lastStep, infer from logs/
  if (!phase || phase === 'GATE') {
    const inferred = inferStateFromLogs(projectRoot, iterNum, plannedStories, completedStories);
    if (inferred) { phase = inferred.phase; step = inferred.step; if (inferred.story) story = inferred.story; }
  }

  if (!phase && draftPath) { phase = 'GATE'; step = 'check'; }
  return { phase, step, story, route, iter, draftPath, plannedStories, completedStories, projectRoot,
    reason: phase ? `${state ? 'ledger' : 'fallback'}: ${phase}${step ? '-'+step : ''}` : 'no state' };
}

// ── NEXT command builder ──
function buildNextCommand(st) {
  const { phase, step, story, iter, draftPath, projectRoot } = st;
  const iterNum = parseInt((iter || 'iter-1').replace('iter-', ''), 10);
  const da = draftPath ? `--draft=${draftPath}` : '--draft=<draft>';
  const ta = projectRoot ? `--target=${projectRoot}` : '--target=<project>';
  if (!phase) return '(unknown)';
  switch (phase) {
    case 'GATE': return `node sdid-tools/blueprint-gate.cjs ${da} ${ta} --iter=${iterNum}`;
    case 'CYNEFIN_CHECK': return `node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> ${ta} --iter=${iterNum}`;
    case 'PLAN': return `node sdid-tools/draft-to-plan.cjs ${da} --iter=${iterNum} ${ta}`;
    case 'BUILD': return story
      ? `node task-pipe/runner.cjs --phase=BUILD --step=${step||1} --story=${story} ${ta} --iteration=${iter}`
      : `node task-pipe/runner.cjs --phase=BUILD --step=${step||1} ${ta} --iteration=${iter}`;
    case 'SHRINK': return `node sdid-tools/blueprint-shrink.cjs ${da} --iter=${iterNum} ${ta}`;
    case 'SCAN': return `node task-pipe/runner.cjs --phase=SCAN ${ta} --iteration=${iter}`;
    case 'VERIFY': return `node sdid-tools/blueprint-verify.cjs ${da} ${ta} --iter=${iterNum}`;
    case 'NEXT_ITER': {
      const ni = st.nextIter || `iter-${iterNum+1}`;
      return `node sdid-tools/blueprint-expand.cjs ${da} --iter=${parseInt(ni.replace('iter-',''),10)} ${ta}`;
    }
    case 'COMPLETE': return 'done';
    case 'POC': return `node task-pipe/runner.cjs --phase=POC --step=${step||1} ${ta} --iteration=${iter}`;
    default: return `node task-pipe/runner.cjs --phase=${phase} --step=${step||1} ${ta} --iteration=${iter}`;
  }
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
