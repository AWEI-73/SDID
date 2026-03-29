const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3737;
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || path.resolve(__dirname, '..');
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

// ─── Hub rebuild (background, non-blocking) ──────────────────
const { spawn } = require('child_process');
const UPDATE_HUB_SCRIPT = path.join(__dirname, 'update-hub.cjs');

let hubRebuildTimer = null;
function scheduleHubRebuild(reason) {
  clearTimeout(hubRebuildTimer);
  hubRebuildTimer = setTimeout(() => {
    console.log(`🔄  hub rebuild triggered by: ${reason}`);
    hubCache = { data: null, time: 0 };
    const child = spawn(process.execPath, [UPDATE_HUB_SCRIPT], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, WORKSPACE_ROOT, ELECTRON_RUN_AS_NODE: '1' },
    });
    child.unref();
  }, 1200); // debounce 1.2s，避免連續寫入觸發多次
}

// ─── Deep watch: 監聽關鍵路徑的檔案異動 ──────────────────────
// fs.watch recursive 在 Windows 有效，Linux/macOS 只有 non-recursive
// 分別 watch 各 project 的 .gems/docs 與 .gems/iterations

function watchProject(projName) {
  const docsPath = path.join(WORKSPACE_ROOT, projName, '.gems', 'docs');
  const itersPath = path.join(WORKSPACE_ROOT, projName, '.gems', 'iterations');

  for (const watchPath of [docsPath, itersPath]) {
    if (!fs.existsSync(watchPath)) continue;
    try {
      fs.watch(watchPath, { persistent: false, recursive: true }, (_, filename) => {
        if (!filename) return;
        // 只關心 json / md 檔案
        if (!/\.(json|md)$/.test(filename)) return;
        scheduleHubRebuild(`${projName}/${filename}`);
      });
    } catch (_) { /* 某些 path 不可 watch，略過 */ }
  }
}

// watch framework dirs（自己的腳本，沒有 .gems 但改了也要更新）
const FRAMEWORK_DIRS = ['sdid-tools', 'task-pipe', '.agent', 'sdid-monitor'];
for (const dir of FRAMEWORK_DIRS) {
  const p = path.join(WORKSPACE_ROOT, dir);
  if (!fs.existsSync(p)) continue;
  try {
    fs.watch(p, { persistent: false, recursive: true }, (_, filename) => {
      if (!filename) return;
      if (!/\.(json|md|cjs|mjs|js|ts)$/.test(filename)) return;
      if (filename.includes('hub.json')) return; // 避免 hub 更新觸發自己
      scheduleHubRebuild(`${dir}/${filename}`);
    });
    console.log(`👁  watching framework: ${dir}`);
  } catch (_) { }
}

// ─── Auto-detect new / removed projects ──────────────────────
// Watch WORKSPACE_ROOT top-level for new project dirs
let watchDebounce = null;
try {
  fs.watch(WORKSPACE_ROOT, { persistent: false }, (eventType, filename) => {
    if (!filename) return;
    clearTimeout(watchDebounce);
    watchDebounce = setTimeout(() => {
      projectsCache = { data: null, time: 0 };
      broadcast({ type: 'refresh' });
      // new project might have appeared — re-setup watches
      scheduleHubRebuild(`workspace root / ${filename}`);
    }, 800);
  });
  console.log(`👁  Watching workspace root: ${WORKSPACE_ROOT}`);
} catch (e) {
  console.warn('⚠  fs.watch unavailable:', e.message);
}

// Scan existing projects and watch their .gems dirs
try {
  fs.readdirSync(WORKSPACE_ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .forEach(e => watchProject(e.name));
  console.log(`👁  Deep-watching all project .gems dirs`);
} catch (_) { }

// Fallback: poll every 10 s regardless (catches deep changes fs.watch might miss)
setInterval(() => {
  const prev = projectsCache.data ? JSON.stringify(projectsCache.data.map(p => p.name + p.phase)) : null;
  projectsCache = { data: null, time: 0 };
  try {
    const next = scanProjects ? JSON.stringify(scanProjects().map(p => p.name + p.phase)) : null;
    if (prev !== next) broadcast({ type: 'refresh' });
  } catch (_) { }
}, 10000);

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

// ─── Flow type detection (v7 — unified pipeline) ─────────────
// v7: one pipeline, always blueprint-style gate sequence
function detectFlowType(logs, gemsRoot) {
  // v7 gate prefixes
  const hasV7Gates = logs.some(l =>
    /^(draft-gate|cynefin-check|flow-review|contract-gate|contract|blueprint-gate|gate-plan|gate-verify)-/.test(l)
  );
  if (hasV7Gates) return 'blueprint';
  // Legacy fallback
  const hasBlueprintGate = logs.some(l => /^gate-(check|expand|shrink|verify)-/.test(l));
  const hasTaskPipeSteps = logs.some(l => /^(poc|plan)-step-/.test(l));
  if (hasBlueprintGate && hasTaskPipeSteps) return 'mixed';
  if (hasBlueprintGate) return 'blueprint';
  if (hasTaskPipeSteps) return 'task-pipe';
  return 'blueprint';
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

// ─── Parse gate phases (v7) ──────────────────────────────────
function parseGatePhases(logs) {
  const gates = {
    blueprintGate: null,  // blueprint-gate-pass/error
    draftGate: null,      // draft-gate-pass/error
    cynefin: null,        // cynefin-check-pass/fail
    flowReview: null,     // flow-review-pass/error
    contract: null,       // contract-pass / contract-gate-pass
    plan: null,           // gate-plan-pass
    scan: null,           // scan-scan-pass/error
    verify: null,         // gate-verify-pass/error
  };
  for (const log of logs) {
    if (/^blueprint-gate-(pass|error)-/.test(log)) {
      gates.blueprintGate = log.includes('pass') ? 'pass' : 'error'; continue;
    }
    if (/^draft-gate-(pass|error)-/.test(log)) {
      gates.draftGate = log.includes('pass') ? 'pass' : 'error'; continue;
    }
    if (/^cynefin-check-(pass|fail)-/.test(log)) {
      gates.cynefin = log.includes('pass') ? 'pass' : 'error'; continue;
    }
    if (/^flow-review-(pass|error)-/.test(log)) {
      gates.flowReview = log.includes('pass') ? 'pass' : 'error'; continue;
    }
    if (/^(contract-gate|contract)-(pass|error)-/.test(log)) {
      gates.contract = log.includes('pass') ? 'pass' : 'error'; continue;
    }
    if (/^gate-plan-(pass|error)-/.test(log)) {
      gates.plan = log.includes('pass') ? 'pass' : 'error'; continue;
    }
    if (/^scan-scan-(pass|error|fail|info)-/.test(log)) {
      gates.scan = log.includes('pass') ? 'pass' : log.includes('info') ? 'info' : 'error';
    }
    if (/^gate-verify-(pass|error)-/.test(log)) {
      gates.verify = log.includes('pass') ? 'pass' : 'error';
    }
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

  // Max passed BUILD phase (v7: P1-P4)
  const totalBuildPhases = 4;
  let maxPassedPhase = 0;
  for (const s of stories) {
    for (const [p, info] of Object.entries(s.phases)) {
      if (info.status === 'pass' && parseInt(p) > maxPassedPhase) maxPassedPhase = parseInt(p);
    }
  }
  for (const [p, info] of Object.entries(noStoryMap)) {
    if (info.status === 'pass' && parseInt(p) > maxPassedPhase) maxPassedPhase = parseInt(p);
  }

  const isComplete = gatePhases.verify === 'pass';
  let currentPhase = null, badge = null, badgeClass = 'idle';

  if (isComplete) {
    currentPhase = 'DONE'; badge = '@PASS'; badgeClass = 'pass';
  } else if (gatePhases.verify === 'error') {
    currentPhase = 'VERIFY'; badge = '@BLOCK'; badgeClass = 'block';
  } else if (gatePhases.scan === 'pass') {
    currentPhase = 'VERIFY'; badge = null; badgeClass = 'idle';
  } else if (stories.length > 0 || Object.keys(noStoryMap).length > 0) {
    const blocking = stories.find(s => s.badgeClass === 'block');
    const fixing   = stories.find(s => s.badgeClass === 'fix');
    if (blocking) {
      currentPhase = `BUILD-P${blocking.lastPhase}`; badge = '@BLOCK'; badgeClass = 'block';
    } else if (fixing) {
      currentPhase = `BUILD-P${fixing.lastPhase}`; badge = '@FIX'; badgeClass = 'fix';
    } else if (Object.keys(noStoryMap).length > 0) {
      const lastP = Math.max(...Object.keys(noStoryMap).map(Number));
      const ls = noStoryMap[lastP]?.status;
      currentPhase = `BUILD-P${lastP}`;
      if (ls === 'error') { badge = '@BLOCK'; badgeClass = 'block'; }
      else if (ls === 'info') { badge = '@FIX'; badgeClass = 'fix'; }
      else { badge = '@PASS'; badgeClass = 'pass'; }
    } else {
      currentPhase = `BUILD-P${maxPassedPhase}`; badge = '@PASS'; badgeClass = 'pass';
    }
  } else if (gatePhases.plan === 'pass') {
    currentPhase = 'BUILD'; badge = null; badgeClass = 'idle';
  } else if (gatePhases.plan === 'error') {
    currentPhase = 'PLAN'; badge = '@BLOCK'; badgeClass = 'block';
  } else if (gatePhases.contract === 'pass') {
    currentPhase = 'PLAN'; badge = null; badgeClass = 'idle';
  } else if (gatePhases.contract === 'error') {
    currentPhase = 'CONTRACT'; badge = '@BLOCK'; badgeClass = 'block';
  } else if (gatePhases.flowReview === 'pass') {
    currentPhase = 'CONTRACT'; badge = null; badgeClass = 'idle';
  } else if (gatePhases.flowReview === 'error') {
    currentPhase = 'FLOW-REVIEW'; badge = '@BLOCK'; badgeClass = 'block';
  } else if (gatePhases.cynefin === 'pass') {
    currentPhase = 'FLOW-REVIEW'; badge = null; badgeClass = 'idle';
  } else if (gatePhases.cynefin === 'error') {
    currentPhase = 'CYNEFIN'; badge = '@BLOCK'; badgeClass = 'block';
  } else if (gatePhases.draftGate === 'pass') {
    currentPhase = 'CYNEFIN'; badge = null; badgeClass = 'idle';
  } else if (gatePhases.draftGate === 'error') {
    currentPhase = 'DRAFT-GATE'; badge = '@BLOCK'; badgeClass = 'block';
  } else if (gatePhases.blueprintGate === 'pass') {
    currentPhase = 'DRAFT-GATE'; badge = null; badgeClass = 'idle';
  } else if (gatePhases.blueprintGate === 'error') {
    currentPhase = 'BLUEPRINT'; badge = '@BLOCK'; badgeClass = 'block';
  }

  // Progress: pre-build 25%, plan 5%, BUILD 60%, scan 5%, verify 5%
  let progress = 0;
  if (isComplete) {
    progress = 100;
  } else {
    const preBuildGates = ['blueprintGate', 'draftGate', 'cynefin', 'flowReview', 'contract'];
    const preBuildPassed = preBuildGates.filter(k => gatePhases[k] === 'pass').length;
    progress += Math.round((preBuildPassed / preBuildGates.length) * 25);
    if (gatePhases.plan === 'pass') progress += 5;
    if (maxPassedPhase > 0) progress += Math.round((maxPassedPhase / totalBuildPhases) * 60);
    if (gatePhases.scan === 'pass') progress += 5;
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

// ─── Hub map ─────────────────────────────────────────────────
const HUB_FILE = path.join(__dirname, 'hub.json');

// Rebuild hub synchronously (called by post-commit hook path or on demand)
function rebuildHub() {
  try {
    require('./update-hub.cjs');
  } catch (e) {
    console.warn('⚠  update-hub failed:', e.message);
  }
}

let hubCache = { data: null, time: 0 };
function loadHub() {
  // Invalidate if hub.json was modified after cache was built
  let mtime = 0;
  try { mtime = fs.statSync(HUB_FILE).mtimeMs; } catch { /* no file yet */ }
  if (hubCache.data && mtime <= hubCache.time) return hubCache.data;
  const raw = fs.existsSync(HUB_FILE) ? fs.readFileSync(HUB_FILE, 'utf8') : null;
  const data = raw ? JSON.parse(raw) : null;
  hubCache = { data, time: Date.now() };
  return data;
}

app.get('/api/hub', (req, res) => {
  try {
    const data = loadHub();
    if (!data) return res.status(404).json({ error: 'hub.json not found. Run: node update-hub.cjs' });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Trigger hub rebuild via POST (called by git hook)
app.post('/api/hub/rebuild', (req, res) => {
  try {
    hubCache = { data: null, time: 0 }; // invalidate
    // Run update-hub.cjs as child process (non-blocking)
    const child = spawn(process.execPath, [path.join(__dirname, 'update-hub.cjs')], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    });
    child.unref();
    broadcast({ type: 'hub-updated' });
    res.json({ ok: true, message: 'hub rebuild triggered' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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

    // Support new function-index.json
    const newIdxPath = path.resolve(WORKSPACE_ROOT, project, '.gems', 'docs', 'function-index.json');
    if (fs.existsSync(newIdxPath)) {
      const data = JSON.parse(fs.readFileSync(newIdxPath, 'utf8'));
      const functions = [];
      let totalLines = 0;
      let totalCount = 0;
      const byRisk = { P0: 0, P1: 0, P2: 0, P3: 0 };

      for (const [file, items] of Object.entries(data.byFile || {})) {
        for (const item of items) {
          const risk = item.priority || 'P3';
          byRisk[risk] = (byRisk[risk] || 0) + 1;

          let lineDiff = 0;
          if (item.lines) {
            const [start, end] = item.lines.split('-');
            lineDiff = Math.max(0, parseInt(end) - parseInt(start) + 1);
            totalLines += lineDiff;
          }

          functions.push({
            name: item.name,
            risk: risk,
            file: file,
            lines: item.lines,
            description: item.lines ? `Lines: ${item.lines}` : '',
            storyId: Object.keys(data.byStory || {}).find(s => data.byStory[s].includes(item.name)) || ''
          });
          totalCount++;
        }
      }
      return res.json({
        totalCount,
        byRisk,
        avgFunctionLines: totalCount > 0 ? Math.round(totalLines / totalCount) : 0,
        functions
      });
    }

    // Fallback old format
    const p = path.resolve(WORKSPACE_ROOT, project, '.gems', 'docs', 'functions.json');
    if (!p.startsWith(WORKSPACE_ROOT)) return res.status(403).json({ error: 'forbidden' });
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found' });
    res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/alignment/:project/:iter', (req, res) => {
  try {
    const { project, iter } = req.params;
    const planDir = path.resolve(WORKSPACE_ROOT, project, '.gems', 'iterations', iter, 'plan');
    const newIdxPath = path.resolve(WORKSPACE_ROOT, project, '.gems', 'docs', 'function-index.json');
    const oldIdxPath = path.resolve(WORKSPACE_ROOT, project, '.gems', 'docs', 'functions.json');

    if (!fs.existsSync(planDir)) return res.status(404).json({ error: 'Plan directory not found' });

    // Find the latest implementation plan file
    const planFiles = fs.readdirSync(planDir).filter(f => f.startsWith('implementation_plan_') && f.endsWith('.md'));
    if (planFiles.length === 0) return res.status(404).json({ error: 'No implementation plan found' });

    // Use the most recently modified or logically last one (we just take the latest by string sort for now)
    const latestPlanFile = planFiles.sort().pop();
    const planPath = path.join(planDir, latestPlanFile);

    // Read and parse the plan
    const planContent = fs.readFileSync(planPath, 'utf8');
    const plannedItems = new Set();
    const planDetails = {};
    const extractStoryMatch = planContent.match(/\*\*Story ID\*\*:?\s*([\w.-]+)/);
    const storyId = extractStoryMatch ? extractStoryMatch[1].trim() : '';

    // Extract items from markdown table (e.g. | 1 | StorageService | FEATURE | ...)
    const tableRegex = /\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g;
    let match;
    while ((match = tableRegex.exec(planContent)) !== null) {
      const itemName = match[1].trim();
      const type = match[2].trim();
      const priority = match[3].trim();
      if (itemName && itemName !== '名稱' && itemName !== '---') { // skip header
        plannedItems.add(itemName);
        planDetails[itemName] = { type, priority, planned: true };
      }
    }

    // Load actual functions
    let actualFunctions = [];
    if (fs.existsSync(newIdxPath)) {
      const data = JSON.parse(fs.readFileSync(newIdxPath, 'utf8'));
      for (const [file, items] of Object.entries(data.byFile || {})) {
        for (const item of items) {
          actualFunctions.push({
            name: item.name,
            risk: item.priority || 'P3',
            file: file,
            lines: item.lines,
            storyId: Object.keys(data.byStory || {}).find(s => data.byStory[s].includes(item.name)) || ''
          });
        }
      }
    } else if (fs.existsSync(oldIdxPath)) {
      // Very basic fallback
      const data = JSON.parse(fs.readFileSync(oldIdxPath, 'utf8'));
      if (data.functions) {
        actualFunctions = data.functions.map(f => ({ name: f.name, file: f.file }));
      }
    }

    const actualItemNames = new Set(actualFunctions.map(f => f.name));

    // Compare
    const alignment = {
      storyId,
      planFile: latestPlanFile,
      matched: [],
      missing: [],
      unplanned: [] // Implemented but not in plan (for this story, or broadly)
    };

    // Check what was planned vs actual
    for (const item of plannedItems) {
      const actualMatch = actualFunctions.find(f => f.name === item);
      if (actualMatch) {
        alignment.matched.push({ ...planDetails[item], ...actualMatch });
      } else {
        alignment.missing.push({ name: item, ...planDetails[item] });
      }
    }

    // Check what was actual vs planned (if we have a storyId, we probably only want to show unplanned FOR THIS STORY)
    // If we don't know the story ID, or the index format doesn't group by story, we might show everything unplanned, which is noisy.
    // Let's filter unplanned to only show items that claim to be for this storyId, OR if there's no story grouping available
    for (const actual of actualFunctions) {
      if (!plannedItems.has(actual.name)) {
        // if the actual item is tagged with the current story, but wasn't in the plan list!
        if (!storyId || actual.storyId === storyId) {
          alignment.unplanned.push(actual);
        }
      }
    }

    res.json(alignment);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/code', (req, res) => {
  try {
    const { project, file, lines } = req.query;
    if (!project || !file || !lines) return res.status(400).json({ error: 'missing params' });

    // Prevent directory traversal
    let safeFile = file.replace(/^(\.\.?[\\/])+/, '');

    // The JSON output records paths like `time-echo\\src\\shared\\...`
    // If the path starts with project name, slice it off so `resolve` doesn't double it.
    if (safeFile.startsWith(project + '\\')) {
      safeFile = safeFile.substring(project.length + 1);
    } else if (safeFile.startsWith(project + '/')) {
      safeFile = safeFile.substring(project.length + 1);
    }

    const p = path.resolve(WORKSPACE_ROOT, project, safeFile);

    if (!p.startsWith(WORKSPACE_ROOT)) return res.status(403).json({ error: 'forbidden' });
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found: ' + p });

    const content = fs.readFileSync(p, 'utf8');
    const [start, end] = lines.split('-').map(Number);
    const codeLines = content.split('\n');

    // Extract snippet (1-based index)
    const snippet = codeLines.slice(Math.max(0, start - 1), end).join('\n');

    res.type('text/plain').send(`// File: ${safeFile}\n// Lines: ${lines}\n\n${snippet}`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const server = app.listen(PORT, () => console.log(`SDID Monitor → http://localhost:${PORT}`));
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.warn(`[WARN] Port ${PORT} is already in use. Assuming server is already running elsewhere.`);
  } else {
    console.error('[ERROR] Server start failed:', e);
  }
});
