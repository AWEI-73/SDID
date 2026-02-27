#!/usr/bin/env node
/**
 * update-hub.cjs
 * 掃描 SDID workspace，生成 hub.json + workspace-hub.md（Claude 認知快照）
 * 觸發時機：git post-commit hook / server.cjs fs.watch / 手動執行
 *
 * Usage: node update-hub.cjs [workspace-root]
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE_ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..');

const OUT_FILE = path.join(__dirname, 'hub.json');

// ─── SDID 框架目錄（本身不是被管理的 project）────────────────
const FRAMEWORK_DIRS = new Set([
  'task-pipe', 'sdid-tools', '.agent', 'sdid-monitor',
  'sdid-tools', 'github_project',
]);

// ─── helpers ──────────────────────────────────────────────────

function safeRead(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function safeJSON(p) {
  const raw = safeRead(p);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function dirEntries(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }); } catch { return []; }
}

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function safeExec(cmd, cwd) {
  try {
    return execSync(cmd, { cwd: cwd || WORKSPACE_ROOT, encoding: 'utf8', timeout: 5000 }).trim();
  } catch { return null; }
}

// ─── ROADMAP 解析 ────────────────────────────────────────────
// 從 STRATEGY_ROADMAP.md 解析各 Phase 的完成狀態

function parseRoadmap() {
  const roadmapPath = path.join(WORKSPACE_ROOT, 'task-pipe', 'docs', 'STRATEGY_ROADMAP.md');
  const raw = safeRead(roadmapPath);
  if (!raw) return null;

  // 取第一行的版本資訊
  const versionMatch = raw.match(/# SDID 戰略藍圖 (v[\d.]+)/);
  const version = versionMatch ? versionMatch[1] : '—';

  // 取更新日期
  const dateMatch = raw.match(/更新日期: ([\d-]+)/);
  const updatedAt = dateMatch ? dateMatch[1] : '—';

  // 解析每個 Phase 區塊：### P{N}... 開頭
  const phases = [];
  const phaseRegex = /^### (P[\d.]+[^(]+?)(?:\s*\(([\d-]+[^)]*)\))?\s*(✅|⏸|🚧)?\s*$/gm;
  let match;
  while ((match = phaseRegex.exec(raw)) !== null) {
    const label = match[1].trim();
    const date  = match[2] ? match[2].trim() : null;
    const icon  = match[3] || null;

    // 判斷狀態：有 ✅ 或括號內有「完成」→ done；有 ⏸ 或「暫緩」→ paused；其他 → pending
    let status = 'pending';
    if (icon === '✅' || (date && /完成|done/i.test(date))) status = 'done';
    else if (icon === '⏸' || /暫緩|pause|deferred/i.test(label + (date || ''))) status = 'paused';
    else if (icon === '🚧') status = 'wip';

    // 補充：用內文的 ✅ 計數比對（取 ### 後下一個 ### 前的區塊）
    phases.push({ label, date, status });
  }

  // 若 regex 沒抓到（格式可能略有不同），改用更寬鬆的方式
  if (phases.length === 0) {
    const lines = raw.split('\n');
    for (const line of lines) {
      const m = line.match(/^###\s+(P[\d.]+.+)/);
      if (!m) continue;
      const label = m[1].trim();
      let status = 'pending';
      if (/✅/.test(label) || /完成/.test(label)) status = 'done';
      else if (/⏸/.test(label) || /暫緩/.test(label)) status = 'paused';
      phases.push({ label: label.replace(/✅|⏸|🚧/g, '').trim(), status });
    }
  }

  return { version, updatedAt, phases };
}

// ─── 讀 project 最新 iter 的 .state.json ─────────────────────

function scanProjectState(projName, projPath) {
  const itersPath = path.join(projPath, '.gems', 'iterations');
  if (!isDir(itersPath)) return null;

  // 找最新的 iter（數字最大，或最後一個有 .state.json 的）
  const iters = dirEntries(itersPath)
    .filter(e => e.isDirectory() && /^iter-\d+$/.test(e.name))
    .map(e => e.name)
    .sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));

  if (iters.length === 0) return null;

  // 找最後一個有 logs 的 iter
  let latestIter = iters[iters.length - 1];
  for (let i = iters.length - 1; i >= 0; i--) {
    const lp = path.join(itersPath, iters[i], 'logs');
    if (isDir(lp) && dirEntries(lp).some(f => f.name.endsWith('.log'))) {
      latestIter = iters[i];
      break;
    }
  }

  const statePath = path.join(itersPath, latestIter, '.state.json');
  const state = safeJSON(statePath);

  return {
    latestIter,
    totalIters: iters.length,
    state: state ? {
      currentNode:   state.flow?.currentNode || null,
      entryPoint:    state.flow?.entryPoint  || null,
      tacticalFixes: state.tacticalFixes     || {},
      stories:       state.stories           || {},
    } : null,
  };
}

// ─── Git 資訊 ────────────────────────────────────────────────

function getGitInfo() {
  // recent commits
  const logRaw = safeExec('git log --oneline -8');
  const commits = logRaw
    ? logRaw.split('\n').filter(Boolean).map(l => l.trim())
    : [];

  // worktrees
  const wtRaw = safeExec('git worktree list');
  const worktrees = [];
  if (wtRaw) {
    for (const line of wtRaw.split('\n').filter(Boolean)) {
      const m = line.match(/^(.+?)\s+[0-9a-f]+\s+\[(.+?)\]/);
      if (m) worktrees.push({ path: m[1].trim(), branch: m[2].trim() });
    }
  }

  // current branch
  const branch = safeExec('git branch --show-current') || '—';

  return { branch, commits, worktrees };
}

// ─── 掃描 functions.json（rich format v7）─────────────────────

function scanFunctions(docsPath) {
  const fj = safeJSON(path.join(docsPath, 'functions.json'));
  if (fj && Array.isArray(fj.functions)) {
    return {
      format: 'functions.json',
      totalCount: fj.totalCount || fj.functions.length,
      byRisk: fj.byRisk || {},
      avgFunctionLines: fj.avgFunctionLines || 0,
      functions: fj.functions.map(f => ({
        name:        f.name,
        description: f.description || '',
        flow:        f.flow || '',
        deps:        f.deps || '',
        depsRisk:    f.depsRisk || '',
        risk:        f.risk || 'P3',
        storyId:     f.storyId || '',
        file:        f.file || '',
        lines:       f.startLine && f.endLine ? `${f.startLine}-${f.endLine}` : '',
        signature:   f.signature || '',
        testStatus:  f.testStatus || '',
      })),
    };
  }

  // fallback: function-index.json
  const fi = safeJSON(path.join(docsPath, 'function-index.json'));
  if (fi && fi.byFile) {
    const functions = [];
    for (const [file, items] of Object.entries(fi.byFile || {})) {
      for (const item of items) {
        const story = Object.keys(fi.byStory || {})
          .find(s => (fi.byStory[s] || []).includes(item.name)) || '';
        functions.push({
          name: item.name, description: '', flow: '', deps: '',
          depsRisk: '', risk: item.priority || 'P3', storyId: story,
          file, lines: item.lines || '', signature: '', testStatus: '',
        });
      }
    }
    return {
      format: 'function-index.json',
      totalCount: functions.length,
      byRisk: fi.byPriority || {},
      avgFunctionLines: 0,
      functions,
    };
  }

  return null;
}

// ─── 掃描 iterations 目錄結構 ────────────────────────────────

function scanIters(itersPath) {
  const result = {};
  for (const e of dirEntries(itersPath)) {
    if (!e.isDirectory() || !/^iter-\d+$/.test(e.name)) continue;
    const iterPath = path.join(itersPath, e.name);
    const entry = {};
    for (const sub of dirEntries(iterPath)) {
      if (!sub.isDirectory()) continue;
      entry[sub.name] = dirEntries(path.join(iterPath, sub.name))
        .filter(f => !f.isDirectory())
        .map(f => f.name);
    }
    result[e.name] = entry;
  }
  return result;
}

// ─── 掃描單一 project ────────────────────────────────────────

function scanProject(projName, projPath) {
  const gemsPath = path.join(projPath, '.gems');
  const hasGems  = isDir(gemsPath);

  if (!hasGems) {
    return { name: projName, hasGems: false };
  }

  const docsPath  = path.join(gemsPath, 'docs');
  const itersPath = path.join(gemsPath, 'iterations');

  const docs      = isDir(docsPath)  ? dirEntries(docsPath).filter(e => !e.isDirectory()).map(e => e.name) : [];
  const iters     = isDir(itersPath) ? scanIters(itersPath) : {};
  const fnData    = isDir(docsPath)  ? scanFunctions(docsPath) : null;
  const techStack = safeJSON(path.join(docsPath, 'tech-stack.json'));
  const projState = scanProjectState(projName, projPath);

  return {
    name: projName,
    hasGems: true,
    docs,
    iters,
    techStack: techStack ? (techStack.stack || techStack) : null,
    fnData,
    projState,
  };
}

// ─── 主掃描 ──────────────────────────────────────────────────

function scan() {
  const projects  = {};
  const framework = {};

  for (const e of dirEntries(WORKSPACE_ROOT)) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('.')) continue;

    const projPath = path.join(WORKSPACE_ROOT, e.name);
    try {
      const data = scanProject(e.name, projPath);
      if (FRAMEWORK_DIRS.has(e.name)) {
        framework[e.name] = data;
      } else {
        projects[e.name] = data;
      }
    } catch (err) {
      const bucket = FRAMEWORK_DIRS.has(e.name) ? framework : projects;
      bucket[e.name] = { name: e.name, hasGems: false, error: err.message };
    }
  }

  return {
    generatedAt:   new Date().toISOString(),
    workspaceRoot: WORKSPACE_ROOT,
    roadmap:       parseRoadmap(),
    git:           getGitInfo(),
    framework,
    projects,
  };
}

// ─── 判斷 project 即時 badge（從 log 檔名）────────────────────

function deriveBadge(projData) {
  if (!projData.hasGems) return null;
  const ps = projData.projState;
  if (!ps) return null;

  const { latestIter } = ps;
  // 從 hub 的 iters 資料取 logs
  const logs = projData.iters?.[latestIter]?.logs || [];
  if (logs.length === 0) return { iter: latestIter, phase: null, badge: null };

  // 簡單判斷：找最後一筆有狀態的 log
  const sorted = [...logs].sort();
  let phase = null, badge = null;

  // 判斷 DONE
  if (sorted.some(l => /^scan-scan-pass-/.test(l) || /^gate-verify-pass-/.test(l))) {
    return { iter: latestIter, phase: 'DONE', badge: '@PASS' };
  }
  // BUILD
  const buildLogs = sorted.filter(l => /^build-phase-/.test(l));
  if (buildLogs.length > 0) {
    const last = buildLogs[buildLogs.length - 1];
    const m = last.match(/^build-phase-(\d+)-(?:Story-[\d.]+-)?(.+?)-\d{4}/);
    if (m) {
      phase = `BUILD-${m[1]}`;
      badge = m[2].includes('pass') ? '@PASS' : m[2].includes('template') || m[2].includes('info') ? '@FIX' : '@BLOCK';
    }
  }
  // PLAN
  if (!phase) {
    const planLogs = sorted.filter(l => /^plan-step-/.test(l));
    if (planLogs.length > 0) {
      const last = planLogs[planLogs.length - 1];
      const m = last.match(/^plan-step-([\d.]+)-(?:Story-[\d.]+-)?(.+?)-\d{4}/);
      if (m) {
        phase = `PLAN-${m[1]}`;
        badge = m[2].includes('pass') ? '@PASS' : '@BLOCK';
      }
    }
  }
  // POC
  if (!phase) {
    const pocLogs = sorted.filter(l => /^poc-step-/.test(l));
    if (pocLogs.length > 0) {
      const last = pocLogs[pocLogs.length - 1];
      const m = last.match(/^poc-step-([\d.]+)-(.+?)-\d{4}/);
      if (m) {
        phase = `POC-${m[1]}`;
        badge = m[2].includes('pass') ? '@PASS' : '@BLOCK';
      }
    }
  }

  return { iter: latestIter, phase, badge };
}

// ─── 生成 workspace-hub.md（Claude 認知快照）────────────────

function generateMarkdown(hub) {
  const lines = [];
  const ts = hub.generatedAt;

  lines.push(`# SDID Workspace 認知快照`);
  lines.push(`**更新**: ${ts.replace('T', ' ').slice(0, 19)} UTC`);
  lines.push(`**Root**: \`${hub.workspaceRoot}\``);
  lines.push(`**Monitor**: http://localhost:3737`);
  lines.push('');

  // ── 1. ROADMAP 進度 ──
  lines.push(`## ROADMAP 進度`);
  if (hub.roadmap) {
    const { version, updatedAt, phases } = hub.roadmap;
    lines.push(`Strategy Roadmap ${version}，最後更新 ${updatedAt}`);
    lines.push('');
    lines.push(`| Phase | 狀態 |`);
    lines.push(`|-------|------|`);
    for (const p of phases) {
      const icon = p.status === 'done' ? '✅' : p.status === 'paused' ? '⏸' : p.status === 'wip' ? '🚧' : '⬜';
      const dateStr = p.date ? ` (${p.date})` : '';
      lines.push(`| ${p.label}${dateStr} | ${icon} |`);
    }
  } else {
    lines.push(`_找不到 STRATEGY_ROADMAP.md_`);
  }
  lines.push('');

  // ── 2. SDID 框架目錄 ──
  lines.push(`## SDID 框架`);
  lines.push(`這些是框架本身，不是被管理的 project，通常不需要大量掃描：`);
  lines.push('');
  const fwNames = Object.keys(hub.framework).sort();
  for (const name of fwNames) {
    lines.push(`- \`${name}/\``);
  }
  lines.push('');

  // ── 3. Git 狀態 ──
  lines.push(`## Git`);
  if (hub.git) {
    const { branch, commits, worktrees } = hub.git;
    lines.push(`**目前 branch**: \`${branch}\``);
    lines.push('');
    if (worktrees.length > 0) {
      lines.push(`**Worktrees**:`);
      for (const wt of worktrees) {
        lines.push(`- \`${wt.branch}\` → ${wt.path}`);
      }
      lines.push('');
    }
    lines.push(`**最近 commits**:`);
    for (const c of commits) {
      lines.push(`- ${c}`);
    }
  }
  lines.push('');

  // ── 4. 專案即時狀態 ──
  lines.push(`## 專案狀態（SDID 管理中）`);
  lines.push('');
  lines.push(`| Project | Iter | Phase | Badge | Tech |`);
  lines.push(`|---------|------|-------|-------|------|`);

  const sdidProjects = Object.entries(hub.projects)
    .filter(([, p]) => p.hasGems)
    .sort(([a], [b]) => a.localeCompare(b));

  const nonSdidProjects = Object.entries(hub.projects)
    .filter(([, p]) => !p.hasGems)
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [name, p] of sdidProjects) {
    const info = deriveBadge(p);
    const iter  = info?.iter  || '—';
    const phase = info?.phase || '—';
    const badge = info?.badge || '—';

    // Tech stack 摘要
    let tech = '—';
    if (p.techStack) {
      const items = Array.isArray(p.techStack.items) ? p.techStack.items : [];
      const core = items
        .filter(i => i.priority === 1)
        .map(i => i.name)
        .slice(0, 3)
        .join(', ');
      tech = core || '—';
    }

    lines.push(`| ${name} | ${iter} | ${phase} | ${badge} | ${tech} |`);
  }

  if (nonSdidProjects.length > 0) {
    lines.push('');
    lines.push(`**無 .gems（非 SDID 管理）**: ${nonSdidProjects.map(([n]) => n).join(', ')}`);
  }
  lines.push('');

  // ── 5. 關鍵路徑提示 ──
  lines.push(`## 關鍵路徑`);
  lines.push(`\`\`\``);
  lines.push(`SDID 核心腳本:`);
  lines.push(`  task-pipe/runner.cjs          ← 執行 phase/step`);
  lines.push(`  task-pipe/loop.cjs            ← 狀態導航`);
  lines.push(`  sdid-tools/ralph-loop.cjs     ← Blueprint flow`);
  lines.push(`  .agent/skills/sdid/SKILL.md   ← AI skill hub`);
  lines.push('');
  lines.push(`Project 資料路徑:`);
  lines.push(`  {proj}/.gems/iterations/iter-N/.state.json  ← 執行狀態`);
  lines.push(`  {proj}/.gems/iterations/iter-N/logs/*.log   ← phase log`);
  lines.push(`  {proj}/.gems/project-memory.json            ← 歷史記憶`);
  lines.push(`  {proj}/.gems/docs/functions.json            ← 函式索引`);
  lines.push(`\`\`\``);
  lines.push('');

  // ── 6. Log 命名規則（保留，Claude 常需要） ──
  lines.push(`## Log 命名規則`);
  lines.push(`\`\`\``);
  lines.push(`build-phase-{N}-Story-{X.Y}-{status}-{ts}.log`);
  lines.push(`poc-step-{N}-{status}-{ts}.log`);
  lines.push(`plan-step-{N}-Story-{X.Y}-{status}-{ts}.log`);
  lines.push(`gate-{check|plan|shrink|expand|verify}-{status}-{ts}.log`);
  lines.push(`cynefin-check-{pass|fail}-{ts}.log`);
  lines.push(`scan-scan-{status}-{ts}.log`);
  lines.push(`\`\`\``);

  // ── 7. 規則 ──
  lines.push('');
  lines.push(`## 規則`);
  lines.push(`- 先讀這個快照，不要直接 Glob 掃整個 SDID root（會 timeout）`);
  lines.push(`- SDID 框架目錄不需要掃，除非被明確要求修改框架`);
  lines.push(`- 用 \`/api/projects\` 取即時 project 狀態（Monitor 在線時）`);
  lines.push(`- hub.json 有完整 function 資料，此 .md 是摘要`);

  return lines.join('\n');
}

// ─── 執行 ────────────────────────────────────────────────────

const hub = scan();
fs.writeFileSync(OUT_FILE, JSON.stringify(hub, null, 2), 'utf8');

// 同步更新所有 worktree 的 memory/workspace-hub.md
const claudeProjectsRoot = path.join(require('os').homedir(), '.claude', 'projects');
const md = generateMarkdown(hub);
let mdWritten = 0;

if (fs.existsSync(claudeProjectsRoot)) {
  for (const e of dirEntries(claudeProjectsRoot)) {
    if (!e.isDirectory()) continue;
    const memDir = path.join(claudeProjectsRoot, e.name, 'memory');
    const mdFile = path.join(memDir, 'workspace-hub.md');
    if (fs.existsSync(mdFile)) {
      fs.writeFileSync(mdFile, md, 'utf8');
      mdWritten++;
    }
  }
}

const total   = Object.keys(hub.projects).length;
const hasGems = Object.values(hub.projects).filter(p => p.hasGems).length;
const hasFn   = Object.values(hub.projects).filter(p => p.fnData).length;

console.log(`[update-hub] ${new Date().toISOString()}`);
console.log(`  workspace : ${WORKSPACE_ROOT}`);
console.log(`  framework : ${Object.keys(hub.framework).join(', ')}`);
console.log(`  projects  : ${total} total, ${hasGems} with .gems, ${hasFn} with functions`);
console.log(`  roadmap   : ${hub.roadmap ? hub.roadmap.phases.length + ' phases parsed' : 'not found'}`);
console.log(`  git       : branch=${hub.git?.branch}, worktrees=${hub.git?.worktrees?.length || 0}`);
console.log(`  hub.json  : ${OUT_FILE}`);
console.log(`  hub.md    : updated ${mdWritten} memory file(s)`);
