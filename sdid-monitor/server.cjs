const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3737;
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const sseClients = new Set();

app.use(express.json());
app.use(express.static(__dirname));

// ─── SSE ─────────────────────────────────────────────────────
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function broadcast(data) {
  sseClients.forEach(c => c.write(`data: ${JSON.stringify(data)}\n\n`));
}

app.post('/api/notify', (req, res) => {
  broadcast({ type: 'refresh' });
  res.json({ ok: true });
});

// ─── Helpers ─────────────────────────────────────────────────
function normalizeStatus(raw) {
  if (!raw) return 'info';
  if (raw.includes('error') || raw.includes('fail')) return 'error';
  if (raw === 'pass' || raw === 'test-pass' || raw === 'smoke-test') return 'pass';
  return 'info';
}

function sortIters(iters) {
  return iters.sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));
}

// ─── Flow type detection ──────────────────────────────────────
// Returns: 'blueprint' | 'task-pipe' | 'quick-start' | 'mixed'
function detectFlowType(logs, gemsRoot) {
  const hasBlueprintGate = logs.some(l => /^gate-(check|expand|shrink|verify)-/.test(l));
  const hasTaskPipeSteps = logs.some(l => /^(poc|plan)-step-/.test(l));
  // quick-start: story_status.json at project root or .gems root
  const projectRoot = path.resolve(gemsRoot, '..', '..');
  const hasStoryStatus = fs.existsSync(path.join(projectRoot, 'story_status.json')) ||
    fs.existsSync(path.join(gemsRoot, '..', 'story_status.json'));

  if (hasBlueprintGate && hasTaskPipeSteps) return 'mixed';
  if (hasBlueprintGate) return 'blueprint';
  if (hasTaskPipeSteps) return 'task-pipe';
  if (hasStoryStatus) return 'quick-start';
  return 'task-pipe';
}

// ─── Parse POC/PLAN steps (Task-Pipe flow) ───────────────────
function parsePocPlanSteps(logs) {
  // poc-step-{N}-{status}-{ts}.log  (N can be decimal: 2.5, 2.6)
  // plan-step-{N}-{status}-{ts}.log
  // plan-step-{N}-Story-{X.Y}-{status}-{ts}.log
  const pocSteps = {};
  const planSteps = {};

  for (const log of logs) {
    // Match with optional Story segment
    const m = log.match(/^(poc|plan)-step-([\d.]+)-(?:Story-[\d.]+-)?(.+?)-\d{4}-\d{2}-\d{2}T/);
    if (!m) continue;
    const [, phase, step, statusRaw] = m;
    const status = normalizeStatus(statusRaw);
    const target = phase === 'poc' ? pocSteps : planSteps;

    // Priority: pass > error > info. Never let template/info overwrite pass.
    const existing = target[step];
    if (existing) {
      if (existing.status === 'pass') continue;           // pass is final
      if (existing.status === 'error' && status === 'info') continue; // error > info
    }
    target[step] = { status, logFile: log };
  }

  return { pocSteps, planSteps };
}

// ─── Parse BUILD phases ───────────────────────────────────────
function parseBuildPhases(logs) {
  const storyMap = {};   // story → { phaseNum → {status, logFile} }
  const noStoryMap = {}; // phaseNum → {status, logFile}  (old format without Story)

  for (const log of logs) {
    // with Story: build-phase-{N}-Story-{X.Y}-{status}-{ts}.log
    const withStory = log.match(/^build-phase-(\d+)-Story-([\d.]+)-(.+?)-\d{4}-\d{2}-\d{2}T/);
    if (withStory) {
      const [, phaseStr, story, statusRaw] = withStory;
      const phaseNum = parseInt(phaseStr);
      const status = normalizeStatus(statusRaw);
      if (!storyMap[story]) storyMap[story] = {};
      const existing = storyMap[story][phaseNum];
      if (existing && existing.status === 'pass') continue;
      if (existing && existing.status === 'error' && status === 'info') continue;
      storyMap[story][phaseNum] = { status, logFile: log };
      continue;
    }
    // without Story: build-phase-{N}-{status}-{ts}.log
    const noStory = log.match(/^build-phase-(\d+)-(.+?)-\d{4}-\d{2}-\d{2}T/);
    if (noStory) {
      const [, phaseStr, statusRaw] = noStory;
      const phaseNum = parseInt(phaseStr);
      const status = normalizeStatus(statusRaw);
      const existing = noStoryMap[phaseNum];
      if (existing && existing.status === 'pass') continue;
      if (existing && existing.status === 'error' && status === 'info') continue;
      noStoryMap[phaseNum] = { status, logFile: log };
    }
  }

  return { storyMap, noStoryMap };
}

// ─── Parse gate phases ────────────────────────────────────────
function parseGatePhases(logs) {
  const gates = { check: null, plan: null, shrink: null, expand: null, verify: null, scan: null };
  for (const log of logs) {
    const gm = log.match(/^gate-(check|plan|shrink|expand|verify)-(pass|error|fail)-/);
    if (gm) { gates[gm[1]] = gm[2] === 'pass' ? 'pass' : 'error'; continue; }
    const sm = log.match(/^scan-scan-(pass|error|fail|info)-/);
    if (sm) { gates.scan = sm[1] === 'pass' ? 'pass' : sm[1] === 'info' ? 'info' : 'error'; }
  }
  return gates;
}

// ─── Build story list from storyMap ──────────────────────────
function buildStoryList(storyMap) {
  return Object.entries(storyMap)
    .sort(([a], [b]) => {
      const [ma, na] = a.split('.').map(Number);
      const [mb, nb] = b.split('.').map(Number);
      return ma !== mb ? ma - mb : na - nb;
    })
    .map(([story, phases]) => {
      const phaseNums = Object.keys(phases).map(Number).sort((a, b) => a - b);
      const lastPhase = phaseNums[phaseNums.length - 1];
      let worstStatus = 'pass';
      for (const info of Object.values(phases)) {
        if (info.status === 'error') { worstStatus = 'error'; break; }
        if (info.status === 'info') worstStatus = 'info';
      }
      const badge = worstStatus === 'error' ? '@BLOCK' : worstStatus === 'info' ? '@FIX' : '@PASS';
      const badgeClass = worstStatus === 'error' ? 'block' : worstStatus === 'info' ? 'fix' : 'pass';
      const retries = {};
      for (const [p, info] of Object.entries(phases)) {
        if (info.status === 'error') retries[p] = (retries[p] || 0) + 1;
      }
      return { story, phases, lastPhase, badge, badgeClass, retries };
    });
}

// ─── Main derive ─────────────────────────────────────────────
function deriveStatus(logs, gemsRoot) {
  if (logs.length === 0) {
    return { flowType: 'unknown', phase: null, badge: null, badgeClass: 'idle', progress: 0, stories: [], pocSteps: {}, planSteps: {}, noStoryPhases: {}, gatePhases: {} };
  }

  const flowType = detectFlowType(logs, gemsRoot);
  const gatePhases = parseGatePhases(logs);
  const { pocSteps, planSteps } = parsePocPlanSteps(logs);
  const { storyMap, noStoryMap } = parseBuildPhases(logs);
  const stories = buildStoryList(storyMap);

  // Max passed BUILD phase (with or without Story)
  const totalPhases = 8;
  let maxPassedPhase = 0;
  for (const s of stories) {
    for (const [p, info] of Object.entries(s.phases)) {
      if (info.status === 'pass' && parseInt(p) > maxPassedPhase) maxPassedPhase = parseInt(p);
    }
  }
  for (const [p, info] of Object.entries(noStoryMap)) {
    if (info.status === 'pass' && parseInt(p) > maxPassedPhase) maxPassedPhase = parseInt(p);
  }

  // POC/PLAN step analysis — sort steps numerically (handles 2.5, 2.6)
  const sortStepNums = obj => Object.keys(obj).map(Number).sort((a, b) => a - b);
  const pocStepNums = sortStepNums(pocSteps);
  const planStepNums = sortStepNums(planSteps);
  const pocDone = pocStepNums.filter(n => pocSteps[n]?.status === 'pass').length;
  const planDone = planStepNums.filter(n => planSteps[n]?.status === 'pass').length;
  const pocBlocked = pocStepNums.find(n => pocSteps[n]?.status === 'error');
  const planBlocked = planStepNums.find(n => planSteps[n]?.status === 'error');
  const pocLastStep = pocStepNums.length ? pocStepNums[pocStepNums.length - 1] : null;
  const planLastStep = planStepNums.length ? planStepNums[planStepNums.length - 1] : null;

  // COMPLETE detection (mirrors ralph-loop logic):
  // scan pass OR (verify pass) = done
  const isComplete = gatePhases.scan === 'pass' || gatePhases.verify === 'pass';

  // Determine current phase label + badge
  let currentPhase = null, badge = null, badgeClass = 'idle';

  if (isComplete) {
    currentPhase = 'DONE'; badge = '@PASS'; badgeClass = 'pass';
  } else if (gatePhases.verify === 'error') {
    currentPhase = 'VERIFY'; badge = '@BLOCK'; badgeClass = 'block';
  } else if (gatePhases.shrink === 'pass') {
    currentPhase = 'SHRINK✓'; badge = '@PASS'; badgeClass = 'pass';
  } else if (stories.length > 0) {
    const blocking = stories.find(s => s.badgeClass === 'block');
    const fixing = stories.find(s => s.badgeClass === 'fix');
    if (blocking) { currentPhase = `BUILD-${blocking.lastPhase}`; badge = '@BLOCK'; badgeClass = 'block'; }
    else if (fixing) { currentPhase = `BUILD-${fixing.lastPhase}`; badge = '@FIX'; badgeClass = 'fix'; }
    else { currentPhase = `BUILD-${maxPassedPhase}`; badge = '@PASS'; badgeClass = 'pass'; }
  } else if (Object.keys(noStoryMap).length > 0) {
    const lastPhase = Math.max(...Object.keys(noStoryMap).map(Number));
    const lastStatus = noStoryMap[lastPhase]?.status;
    if (lastStatus === 'error') { currentPhase = `BUILD-${lastPhase}`; badge = '@BLOCK'; badgeClass = 'block'; }
    else if (lastStatus === 'info') { currentPhase = `BUILD-${lastPhase}`; badge = '@FIX'; badgeClass = 'fix'; }
    else { currentPhase = `BUILD-${lastPhase}`; badge = '@PASS'; badgeClass = 'pass'; }
  } else if (planBlocked !== undefined) {
    currentPhase = `PLAN-${planBlocked}`; badge = '@BLOCK'; badgeClass = 'block';
  } else if (planDone > 0) {
    currentPhase = `PLAN-${planLastStep}`; badge = '@PASS'; badgeClass = 'pass';
  } else if (pocBlocked !== undefined) {
    currentPhase = `POC-${pocBlocked}`; badge = '@BLOCK'; badgeClass = 'block';
  } else if (pocDone > 0) {
    currentPhase = `POC-${pocLastStep}`; badge = '@PASS'; badgeClass = 'pass';
  } else if (gatePhases.plan === 'pass') {
    currentPhase = 'BUILD'; badge = null; badgeClass = 'idle';
  } else if (gatePhases.check === 'pass') {
    currentPhase = 'PLAN'; badge = null; badgeClass = 'idle';
  } else if (gatePhases.check === 'error') {
    currentPhase = 'GATE'; badge = '@BLOCK'; badgeClass = 'block';
  }

  // Progress: POC 10% + PLAN 20% + BUILD 70%
  let progress = 0;
  if (isComplete) {
    progress = 100;
  } else {
    const pocTotal = Math.max(pocStepNums.length, 1);
    const planTotal = Math.max(planStepNums.length, 1);
    if (pocDone > 0) progress += Math.round((pocDone / pocTotal) * 10);
    if (planDone > 0) progress += Math.round((planDone / planTotal) * 20);
    if (maxPassedPhase > 0) progress += Math.round((maxPassedPhase / totalPhases) * 70);
    // Blueprint: gate-check/plan count as POC/PLAN done
    if (gatePhases.check === 'pass' && pocDone === 0) progress += 10;
    if (gatePhases.plan === 'pass' && planDone === 0) progress += 20;
  }

  return { flowType, phase: currentPhase, badge, badgeClass, progress, stories, pocSteps, planSteps, noStoryPhases: noStoryMap, gatePhases };
}

// ─── Project scanner ─────────────────────────────────────────
function buildProjectStatus(name, gemsPath) {
  const iters = sortIters(
    fs.readdirSync(gemsPath).filter(d => /^iter-\d+$/.test(d))
  );

  if (iters.length === 0) {
    return { name, currentIter: null, flowType: 'unknown', phase: null, badge: null, badgeClass: 'idle', progress: 0 };
  }

  let latestIter = iters[iters.length - 1];
  for (let i = iters.length - 1; i >= 0; i--) {
    const lp = path.join(gemsPath, iters[i], 'logs');
    if (fs.existsSync(lp) && fs.readdirSync(lp).some(f => f.endsWith('.log'))) {
      latestIter = iters[i]; break;
    }
  }

  const logsPath = path.join(gemsPath, latestIter, 'logs');
  const logs = fs.existsSync(logsPath)
    ? fs.readdirSync(logsPath).filter(f => f.endsWith('.log')).sort()
    : [];

  const { flowType, phase, badge, badgeClass, progress } = deriveStatus(logs, gemsPath);
  return { name, currentIter: latestIter, flowType, phase, badge, badgeClass, progress };
}

function scanProjects() {
  return fs.readdirSync(WORKSPACE_ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .filter(e => fs.existsSync(path.join(WORKSPACE_ROOT, e.name, '.gems', 'iterations')))
    .map(e => buildProjectStatus(e.name, path.join(WORKSPACE_ROOT, e.name, '.gems', 'iterations')));
}

// ─── API ─────────────────────────────────────────────────────
let projectsCache = { data: null, time: 0 };
app.get('/api/projects', (req, res) => {
  try {
    if (Date.now() - projectsCache.time < 1000 && projectsCache.data) {
      return res.json(projectsCache.data);
    }
    const data = scanProjects();
    projectsCache = { data, time: Date.now() };
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/projects/:name', (req, res) => {
  try {
    const { name } = req.params;
    const gemsPath = path.join(WORKSPACE_ROOT, name, '.gems', 'iterations');
    if (!fs.existsSync(gemsPath)) return res.status(404).json({ error: 'not found' });

    const iters = sortIters(fs.readdirSync(gemsPath).filter(d => /^iter-\d+$/.test(d)));
    const detail = iters.map(iter => {
      const logsPath = path.join(gemsPath, iter, 'logs');
      const logs = fs.existsSync(logsPath)
        ? fs.readdirSync(logsPath).filter(f => f.endsWith('.log')).sort()
        : [];
      return { iter, ...deriveStatus(logs, gemsPath), logs };
    });

    res.json({ name, iters: detail });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/log', (req, res) => {
  try {
    const { project, iter, file } = req.query;
    if (!project || !iter || !file) return res.status(400).json({ error: 'missing params' });
    const p = path.resolve(WORKSPACE_ROOT, project, '.gems', 'iterations', iter, 'logs', file);
    if (!p.startsWith(WORKSPACE_ROOT)) return res.status(403).json({ error: 'forbidden' });
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found' });
    res.type('text/plain').send(fs.readFileSync(p, 'utf8'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/scan/:project', (req, res) => {
  try {
    const { project } = req.params;
    const p = path.resolve(WORKSPACE_ROOT, project, '.gems', 'docs', 'functions.json');
    if (!p.startsWith(WORKSPACE_ROOT)) return res.status(403).json({ error: 'forbidden' });
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found' });
    res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`SDID Monitor → http://localhost:${PORT}`));
