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
  'sdid-core', 'sdid-tools', 'sdid-monitor', 'task-pipe',
  '.agent', 'github_project',
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

// ─── ROADMAP / Milestone 讀取 ────────────────────────────────
// 從 sdid-monitor/milestones.json 讀取（唯一來源，手動維護）

function parseRoadmap() {
  const msPath = path.join(__dirname, 'milestones.json');
  const data = safeJSON(msPath);
  if (!data?.milestones) return null;
  return { milestones: data.milestones };
}

// ─── ARCHITECTURE 摘要 ───────────────────────────────────────
// 從根目錄 ARCHITECTURE.md 提取路線與腳本地圖摘要

function parseArchitecture() {
  const archPath = path.join(WORKSPACE_ROOT, 'ARCHITECTURE.md');
  const raw = safeRead(archPath);
  if (!raw) return null;

  // 取版本（支援 "> 版本: v6.0" 格式）
  const verMatch = raw.match(/版本:\s*(v[\d.]+)/);
  const version = verMatch ? verMatch[1] : '—';

  // 取更新日期
  const dateMatch = raw.match(/更新:\s*([\d-]+)/);
  const updatedAt = dateMatch ? dateMatch[1] : '—';

  // v6: 從四層設計模型提取路線名稱（Layer 0/1/2/3）
  const routes = [];
  const layerRegex = /^Layer\s+\d+:\s+(.+?)（/gm;
  let m;
  while ((m = layerRegex.exec(raw)) !== null) {
    routes.push(m[1].trim());
  }

  // fallback: 舊格式 "### 路線 A: ..."
  if (routes.length === 0) {
    const routeRegex = /^### 路線\s*[A-D][：:]\s*(.+)$/gm;
    while ((m = routeRegex.exec(raw)) !== null) {
      routes.push(m[1].trim());
    }
  }

  // 再 fallback: 從 MCP Loop 流程圖抓路線
  if (routes.length === 0) {
    const flowRegex = /^\s+(Blueprint|Task-Pipe|POC-FIX|MICRO-FIX):/gm;
    const seen = new Set();
    while ((m = flowRegex.exec(raw)) !== null) {
      if (!seen.has(m[1])) { seen.add(m[1]); routes.push(m[1]); }
    }
  }

  return { version, updatedAt, routes };
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

// ─── 掃描框架目錄（不依賴 .gems/，看工具本身健康狀態）──────────

function countCodeFiles(p) {
  let n = 0;
  try {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      if (e.isDirectory()) { n += countCodeFiles(path.join(p, e.name)); continue; }
      if (/\.(cjs|ts|js)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) n++;
    }
  } catch {}
  return n;
}

function scanFrameworkDir(dirName, dirPath) {
  const topTools = dirEntries(dirPath)
    .filter(e => !e.isDirectory() && /\.cjs$/.test(e.name))
    .map(e => e.name);

  const lastCommit = safeExec(
    `git log -1 --format=%cd --date=short -- ${dirName}/`
  );

  const depsJson = safeJSON(path.join(dirPath, '.gems', 'docs', 'deps.json'));

  return {
    name:       dirName,
    fileCount:  countCodeFiles(dirPath),
    tools:      topTools,
    lastCommit: lastCommit || null,
    deps: depsJson ? {
      edges:    depsJson.summary?.totalEdges      ?? 0,
      circular: Array.isArray(depsJson.circular)  ? depsJson.circular.length : 0,
    } : null,
  };
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
      if (FRAMEWORK_DIRS.has(e.name)) {
        framework[e.name] = scanFrameworkDir(e.name, projPath);
      } else {
        projects[e.name] = scanProject(e.name, projPath);
      }
    } catch (err) {
      const bucket = FRAMEWORK_DIRS.has(e.name) ? framework : projects;
      bucket[e.name] = { name: e.name, error: err.message };
    }
  }

  // roadmap：直接從 milestones.json 讀，updatedAt 用本次生成時間
  const parsedRoadmap = parseRoadmap();
  const roadmap = {
    updatedAt: new Date().toISOString().slice(0, 10),
    milestones: parsedRoadmap?.milestones || [],
  };

  return {
    generatedAt:   new Date().toISOString(),
    workspaceRoot: WORKSPACE_ROOT,
    roadmap,
    architecture:  parseArchitecture(),
    git:           getGitInfo(),
    framework,
    projects,
  };
}

// ─── 判斷 project 即時 badge（從 log 檔名，v6 log 前綴）────────────────────

function deriveBadge(projData) {
  if (!projData.hasGems) return null;
  const ps = projData.projState;
  if (!ps) return null;

  const { latestIter } = ps;
  const logs = projData.iters?.[latestIter]?.logs || [];
  if (logs.length === 0) return { iter: latestIter, phase: null, badge: null };

  // 按時間戳排序（從 log 名稱末尾提取 ISO 時間戳）
  const extractTs = (name) => {
    const m = name.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    return m ? m[1] : name;
  };
  const sorted = [...logs].sort((a, b) => extractTs(a).localeCompare(extractTs(b)));

  // DONE：有 gate-verify-pass 或 scan-scan-pass
  if (sorted.some(l => /^gate-verify-pass-/.test(l) || /^scan-scan-pass-/.test(l))) {
    return { iter: latestIter, phase: 'DONE', badge: '@PASS' };
  }

  // 找最新的「有意義」log（排除 info/template/smoke-test/report 等輔助 log）
  const meaningfulPrefixes = [
    { re: /^gate-verify-error-/,   phase: 'VERIFY',   badge: '@BLOCK' },
    { re: /^scan-scan-/,           phase: 'SCAN',      badge: (l) => l.includes('-pass-') ? '@PASS' : '@BLOCK' },
    { re: /^build-phase-(\d+)-(?:Story-[\d.]+-)?(.+?)-\d{4}/, phase: null, badge: null }, // 特殊處理
    { re: /^pocfix-/,              phase: 'POC-FIX',   badge: (l) => l.includes('pass') ? '@PASS' : '@BLOCK' },
    { re: /^contract-gate-/,       phase: 'CONTRACT',  badge: (l) => l.includes('pass') ? '@PASS' : '@BLOCK' },
    { re: /^contract-error-/,      phase: 'CONTRACT',  badge: '@BLOCK' },
    { re: /^draft-gate-/,          phase: 'GATE',      badge: (l) => l.includes('pass') ? '@PASS' : '@BLOCK' },
    { re: /^blueprint-gate-/,      phase: 'GATE',      badge: (l) => l.includes('pass') ? '@PASS' : '@BLOCK' },
    { re: /^cynefin-check-/,       phase: 'CYNEFIN',   badge: (l) => l.includes('pass') ? '@PASS' : '@BLOCK' },
    // v5 legacy
    { re: /^gate-verify-error-/,   phase: 'VERIFY',    badge: '@BLOCK' },
    { re: /^gate-check-/,          phase: 'GATE',      badge: (l) => l.includes('pass') ? '@PASS' : '@BLOCK' },
    { re: /^gate-plan-/,           phase: 'PLAN',      badge: (l) => l.includes('pass') ? '@PASS' : '@BLOCK' },
    { re: /^plan-step-/,           phase: null,        badge: null }, // 特殊處理
    { re: /^poc-step-/,            phase: null,        badge: null }, // 特殊處理
  ];

  // 找最新的有意義 log（從後往前掃）
  for (let i = sorted.length - 1; i >= 0; i--) {
    const l = sorted[i];
    // 跳過純輔助 log
    if (/-(info|template|smoke-test|report|checkpoint)-/.test(l) || l.endsWith('.json')) continue;

    // BUILD（特殊處理，需解析 phase number）
    const buildM = l.match(/^build-phase-(\d+)-(?:Story-[\d.]+-)?(.+?)-\d{4}/);
    if (buildM) {
      const phaseNum = parseInt(buildM[1]);
      const status = buildM[2];
      return {
        iter: latestIter,
        phase: `BUILD-${phaseNum}`,
        badge: status.includes('pass') ? '@PASS'
             : status.includes('fix') ? '@FIX'
             : '@BLOCK',
      };
    }

    // PLAN（特殊處理）
    const planM = l.match(/^plan-step-([\d.]+)-(?:Story-[\d.]+-)?(.+?)-\d{4}/);
    if (planM) {
      return { iter: latestIter, phase: `PLAN-${planM[1]}`, badge: planM[2].includes('pass') ? '@PASS' : '@BLOCK' };
    }

    // POC（特殊處理）
    const pocM = l.match(/^poc-step-([\d.]+)-(.+?)-\d{4}/);
    if (pocM) {
      return { iter: latestIter, phase: `POC-${pocM[1]}`, badge: pocM[2].includes('pass') ? '@PASS' : '@BLOCK' };
    }

    // 其他前綴
    for (const { re, phase: p, badge: b } of meaningfulPrefixes) {
      if (re.test(l) && p !== null) {
        return { iter: latestIter, phase: p, badge: typeof b === 'function' ? b(l) : b };
      }
    }
  }

  return { iter: latestIter, phase: null, badge: null };
}

// ─── 生成 ROADMAP.md（架構快照 + 導航）─────────────────────

function generateRoadmap(hub) {
  const lines = [];
  const ts = hub.generatedAt.replace('T', ' ').slice(0, 19);

  lines.push(`# SDID 快速導航`);
  lines.push(`> 自動生成 — ${ts} UTC | 手動更新: \`node sdid-monitor/update-hub.cjs\``);
  lines.push('');

  // ── 框架路線 ──
  lines.push(`## 框架路線`);
  if (hub.architecture) {
    const { version, routes } = hub.architecture;
    lines.push(`ARCHITECTURE.md ${version}`);
    lines.push('');
    if (routes.length > 0) {
      routes.forEach(r => lines.push(`- ${r}`));
    } else {
      lines.push('- Blueprint Flow（主線）');
      lines.push('- POC-FIX');
      lines.push('- MICRO-FIX');
    }
  } else {
    lines.push(`_找不到 ARCHITECTURE.md_`);
  }
  lines.push('');

  // ── 專案動向 ──
  lines.push(`## 專案動向`);
  lines.push('');

  const sdidProjects = Object.entries(hub.projects)
    .filter(([, p]) => p.hasGems)
    .sort(([a], [b]) => a.localeCompare(b));

  if (sdidProjects.length === 0) {
    lines.push('_無 SDID 管理中的專案_');
  } else {
    for (const [name, p] of sdidProjects) {
      const info = deriveBadge(p);
      const iter  = info?.iter  || '—';
      const phase = info?.phase || '—';
      const badge = info?.badge || '';

      // 推斷下一步指令（v6 路徑）
      let nextCmd = null;
      const iterN = iter.replace('iter-', '');
      if (phase && phase !== 'DONE' && phase !== '—') {
        if (phase === 'GATE' || phase === 'BLUEPRINT_GATE') {
          nextCmd = `node sdid-tools/blueprint/v5/blueprint-gate.cjs --blueprint=.gems/design/blueprint.md --target=${name}`;
        } else if (phase === 'DRAFT_GATE') {
          nextCmd = `node sdid-tools/blueprint/v5/draft-gate.cjs --draft=.gems/design/draft_iter-${iterN}.md --target=${name}`;
        } else if (phase === 'CONTRACT') {
          nextCmd = `node sdid-tools/blueprint/v5/contract-gate.cjs --contract=.gems/iterations/${iter}/contract_iter-${iterN}.ts --target=${name} --iter=${iterN}`;
        } else if (phase === 'CYNEFIN') {
          nextCmd = `node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> --target=${name} --iter=${iterN}`;
        } else if (phase === 'PLAN') {
          nextCmd = `node task-pipe/tools/spec-to-plan.cjs --target=${name} --iteration=${iter}`;
        } else if (phase.startsWith('BUILD-')) {
          const phaseNum = parseInt(phase.replace('BUILD-', '')) || 1;
          const nextPhase = badge === '@BLOCK' ? phaseNum : Math.min(phaseNum + 1, 4);
          nextCmd = `node task-pipe/runner.cjs --phase=BUILD --step=${nextPhase} --story=Story-X.Y --target=${name} --iteration=${iter}`;
        } else if (phase === 'SCAN') {
          nextCmd = `node task-pipe/runner.cjs --phase=SCAN --target=${name} --iteration=${iter}`;
        } else if (phase === 'VERIFY') {
          nextCmd = `node sdid-tools/blueprint/verify.cjs --draft=.gems/design/draft_iter-${iterN}.md --target=${name} --iter=${iterN}`;
        } else if (phase === 'POC-FIX') {
          nextCmd = `node sdid-tools/poc-fix/micro-fix-gate.cjs --target=${name} --iter=${iterN}`;
        } else if (phase.startsWith('POC-')) {
          const stepNum = parseInt(phase.replace('POC-', '')) || 1;
          nextCmd = `node task-pipe/runner.cjs --phase=POC --step=${stepNum} --target=${name} --iteration=${iter}`;
        } else if (phase.startsWith('PLAN-')) {
          const stepNum = parseInt(phase.replace('PLAN-', '')) || 1;
          nextCmd = `node task-pipe/runner.cjs --phase=PLAN --step=${stepNum} --target=${name} --iteration=${iter}`;
        }
      }

      const badgeStr = badge ? ` \`${badge}\`` : '';
      lines.push(`### ${name}${badgeStr}`);
      lines.push(`- iter: ${iter} | phase: ${phase}`);
      if (nextCmd) lines.push(`- 下一步: \`${nextCmd}\``);

      // project-memory pitfall 摘要（最多 2 條）
      const memPath = path.join(WORKSPACE_ROOT, name, '.gems', 'project-memory.json');
      const mem = safeJSON(memPath);
      if (mem?.pitfalls?.length) {
        const recent = mem.pitfalls.slice(-2);
        lines.push(`- ⚠ pitfall: ${recent.map(p => p.summary || p.message || String(p)).join(' | ')}`);
      }
      lines.push('');
    }
  }

  const nonSdid = Object.entries(hub.projects).filter(([, p]) => !p.hasGems);
  if (nonSdid.length) {
    lines.push(`_非 SDID 管理: ${nonSdid.map(([n]) => n).join(', ')}_`);
    lines.push('');
  }

  // ── 工具快速參考（v6）──
  lines.push(`## 工具快速參考`);
  lines.push('');
  lines.push('```bash');
  lines.push('# Blueprint Flow (v6)');
  lines.push('node sdid-tools/blueprint/v5/blueprint-gate.cjs --blueprint=.gems/design/blueprint.md --target=<proj>');
  lines.push('node sdid-tools/blueprint/v5/draft-gate.cjs --draft=.gems/design/draft_iter-N.md --target=<proj>');
  lines.push('node sdid-tools/blueprint/v5/contract-gate.cjs --contract=.gems/iterations/iter-N/contract_iter-N.ts --target=<proj> --iter=N');
  lines.push('node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> --target=<proj> --iter=N');
  lines.push('node task-pipe/tools/spec-to-plan.cjs --target=<proj> --iteration=iter-N');
  lines.push('node task-pipe/runner.cjs --phase=BUILD --step=N --story=Story-X.Y --target=<proj> --iteration=iter-N');
  lines.push('node task-pipe/runner.cjs --phase=SCAN --target=<proj> --iteration=iter-N');
  lines.push('node sdid-tools/blueprint/verify.cjs --draft=.gems/design/draft_iter-N.md --target=<proj> --iter=N');
  lines.push('');
  lines.push('# POC-FIX');
  lines.push('node sdid-tools/poc-to-scaffold.cjs --log=<consolidation-log.md> --target=<proj>');
  lines.push('node sdid-tools/poc-fix/micro-fix-gate.cjs --target=<proj> --iter=N');
  lines.push('');
  lines.push('# MICRO-FIX');
  lines.push('node sdid-tools/poc-fix/micro-fix-gate.cjs --changed=<files> --target=<proj>');
  lines.push('');
  lines.push('# 狀態查詢');
  lines.push('node sdid-tools/state-guide.cjs --project=<proj>');
  lines.push('node task-pipe/tools/project-status.cjs --target=<proj>');
  lines.push('');
  lines.push('# Monitor');
  lines.push('node sdid-monitor/server.cjs   # http://localhost:3737');
  lines.push('node sdid-monitor/update-hub.cjs  # 手動刷新');
  lines.push('```');

  return lines.join('\n');
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

  // ── 1. SDID 框架架構 ──
  lines.push(`## SDID 框架架構`);
  if (hub.architecture) {
    const { version, updatedAt, routes } = hub.architecture;
    lines.push(`ARCHITECTURE.md ${version}，更新 ${updatedAt}`);
    if (routes.length > 0) {
      lines.push('');
      lines.push(`**路線**:`);
      routes.forEach(r => lines.push(`- ${r}`));
    }
  } else {
    lines.push(`_找不到 ARCHITECTURE.md_`);
  }
  lines.push('');

  // ── 2. ROADMAP Milestone ──
  lines.push(`## ROADMAP Milestone`);
  if (hub.roadmap?.milestones?.length > 0) {
    const { milestones } = hub.roadmap;
    lines.push(`最後更新 —`);
    lines.push('');
    const wip  = milestones.filter(m => m.status === 'wip');
    const p1   = milestones.filter(m => m.status === 'pending' && m.priority === 1);
    const p2   = milestones.filter(m => m.status === 'pending' && m.priority === 2);
    const p3   = milestones.filter(m => m.status === 'pending' && m.priority === 3);
    const done = milestones.filter(m => m.status === 'done');
    if (wip.length)  lines.push(`**進行中**: ${wip.map(m => m.label).join(' | ')}`);
    if (p1.length)   lines.push(`**待做 P1**: ${p1.map(m => m.label).join(' | ')}`);
    if (p2.length)   lines.push(`**待做 P2**: ${p2.map(m => m.label).join(' | ')}`);
    if (p3.length)   lines.push(`**待做 P3**: ${p3.map(m => m.label).join(' | ')}`);
    if (done.length) lines.push(`**完成**: ${done.map(m => m.label).join(' | ')}`);
  } else {
    lines.push(`_找不到 milestones.json_`);
  }
  lines.push('');

  // ── 3. SDID 框架健康 ──
  lines.push(`## SDID 框架健康`);
  lines.push('');
  const fwEntries = Object.values(hub.framework).sort((a, b) => a.name.localeCompare(b.name));
  for (const fw of fwEntries) {
    if (fw.error) { lines.push(`- \`${fw.name}/\` ⚠ ${fw.error}`); continue; }
    const depStr = fw.deps
      ? ` | ${fw.deps.edges} 邊${fw.deps.circular > 0 ? ` ⚠ ${fw.deps.circular} circular` : ' ✅'}`
      : '';
    const tools = fw.tools?.length ? ` | 入口: ${fw.tools.join(', ')}` : '';
    lines.push(`- \`${fw.name}/\` ${fw.fileCount} 支 | 最後異動: ${fw.lastCommit || '—'}${depStr}${tools}`);
  }
  lines.push('');

  // ── 4. Git 狀態 ──
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

  // ── 5. 專案即時狀態 ──
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

  // ── 6. 關鍵路徑提示 ──
  lines.push(`## 關鍵路徑`);
  lines.push(`\`\`\``);
  lines.push(`SDID 核心腳本:`);
  lines.push(`  task-pipe/runner.cjs          ← 執行 phase/step`);
  lines.push(`  sdid-core/state-machine.cjs   ← 狀態推斷引擎`);
  lines.push(`  sdid-tools/mcp-server/        ← MCP 入口（sdid-loop 等）`);
  lines.push(`  .agent/skills/sdid/SKILL.md   ← AI skill hub`);
  lines.push('');
  lines.push(`Project 資料路徑:`);
  lines.push(`  {proj}/.gems/iterations/iter-N/.state.json  ← 執行狀態`);
  lines.push(`  {proj}/.gems/iterations/iter-N/logs/*.log   ← phase log`);
  lines.push(`  {proj}/.gems/project-memory.json            ← 歷史記憶`);
  lines.push(`  {proj}/.gems/docs/functions.json            ← 函式索引`);
  lines.push(`\`\`\``);
  lines.push('');

  // ── 7. Log 命名規則（保留，Claude 常需要） ──
  lines.push(`## Log 命名規則`);
  lines.push(`\`\`\``);
  lines.push(`# v6 Blueprint Flow`);
  lines.push(`blueprint-gate-{pass|error}-{ts}.log`);
  lines.push(`draft-gate-{pass|error}-{ts}.log`);
  lines.push(`contract-gate-{pass|error}-{ts}.log`);
  lines.push(`cynefin-check-{pass|fail}-{ts}.log`);
  lines.push(`pocfix-active-{ts}.log`);
  lines.push(`pocfix-pass-{ts}.log`);
  lines.push(`build-phase-{N}-Story-{X.Y}-{status}-{ts}.log`);
  lines.push(`scan-scan-{pass|error}-{ts}.log`);
  lines.push(`gate-verify-{pass|error}-{ts}.log`);
  lines.push(`adversarial-review-{pass|drift}-{ts}.log`);
  lines.push(`# MICRO-FIX（全局，不屬於 iter）`);
  lines.push(`microfix-{pass|error}-{ts}.log  → .gems/logs/`);
  lines.push(`# v5 legacy（向後相容）`);
  lines.push(`gate-{check|plan|shrink|expand|verify}-{status}-{ts}.log`);
  lines.push(`poc-step-{N}-{status}-{ts}.log`);
  lines.push(`plan-step-{N}-Story-{X.Y}-{status}-{ts}.log`);
  lines.push(`\`\`\``);

  // ── 8. 規則 ──
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

// 同步更新 Kiro steering（只更新已存在的檔案，不新建）
const kiroSteeringFile = path.join(WORKSPACE_ROOT, '.kiro', 'steering', 'workspace-hub.md');
if (fs.existsSync(kiroSteeringFile)) {
  // 保留 front-matter，內容替換為最新快照
  const frontMatter = '---\ninclusion: always\n---\n\n';
  fs.writeFileSync(kiroSteeringFile, frontMatter + md, 'utf8');
  console.log(`  kiro      : updated ${kiroSteeringFile}`);
}

const total   = Object.keys(hub.projects).length;
const hasGems = Object.values(hub.projects).filter(p => p.hasGems).length;
const hasFn   = Object.values(hub.projects).filter(p => p.fnData).length;

// 覆寫 ROADMAP.md（架構快照 + 導航）
const roadmapFile = path.join(WORKSPACE_ROOT, 'ROADMAP.md');
fs.writeFileSync(roadmapFile, generateRoadmap(hub), 'utf8');
console.log(`  roadmap   : regenerated ${roadmapFile}`);

console.log(`[update-hub] ${new Date().toISOString()}`);
console.log(`  workspace : ${WORKSPACE_ROOT}`);
console.log(`  framework : ${Object.keys(hub.framework).join(', ')}`);
console.log(`  projects  : ${total} total, ${hasGems} with .gems, ${hasFn} with functions`);
console.log(`  roadmap   : ${hub.roadmap ? hub.roadmap.milestones.length + ' milestones (milestones.json)' : 'not found'}`);
console.log(`  arch      : ${hub.architecture ? hub.architecture.version + ', ' + hub.architecture.routes.length + ' routes' : 'not found'}`);
console.log(`  git       : branch=${hub.git?.branch}, worktrees=${hub.git?.worktrees?.length || 0}`);
console.log(`  hub.json  : ${OUT_FILE}`);
console.log(`  hub.md    : updated ${mdWritten} memory file(s)`);
