#!/usr/bin/env node
/**
 * update-hub.cjs
 * 掃描 SDID workspace，生成 hub.json
 * 觸發時機：git post-commit hook / 手動執行
 *
 * Usage: node update-hub.cjs [workspace-root]
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const WORKSPACE_ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..');

const OUT_FILE = path.join(__dirname, 'hub.json');

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

// ─── 掃描 functions.json（rich format v7） ────────────────────

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

  // fallback: function-index.json（只有 name/lines/priority）
  const fi = safeJSON(path.join(docsPath, 'function-index.json'));
  if (fi && fi.byFile) {
    const functions = [];
    for (const [file, items] of Object.entries(fi.byFile || {})) {
      for (const item of items) {
        const story = Object.keys(fi.byStory || {})
          .find(s => (fi.byStory[s] || []).includes(item.name)) || '';
        functions.push({
          name:        item.name,
          description: '',
          flow:        '',
          deps:        '',
          depsRisk:    '',
          risk:        item.priority || 'P3',
          storyId:     story,
          file,
          lines:       item.lines || '',
          signature:   '',
          testStatus:  '',
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

  const docs     = isDir(docsPath)  ? dirEntries(docsPath).filter(e => !e.isDirectory()).map(e => e.name) : [];
  const iters    = isDir(itersPath) ? scanIters(itersPath) : {};
  const fnData   = isDir(docsPath)  ? scanFunctions(docsPath) : null;

  // tech-stack
  const techStack = safeJSON(path.join(docsPath, 'tech-stack.json'));

  return {
    name:      projName,
    hasGems:   true,
    docs,
    iters,
    techStack: techStack ? (techStack.stack || techStack) : null,
    fnData,    // null = 沒有 functions 資料
  };
}

// ─── 主掃描 ──────────────────────────────────────────────────

function scan() {
  const projects = {};

  for (const e of dirEntries(WORKSPACE_ROOT)) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('.')) continue;

    const projPath = path.join(WORKSPACE_ROOT, e.name);
    try {
      projects[e.name] = scanProject(e.name, projPath);
    } catch (err) {
      projects[e.name] = { name: e.name, hasGems: false, error: err.message };
    }
  }

  return {
    generatedAt:   new Date().toISOString(),
    workspaceRoot: WORKSPACE_ROOT,
    projects,
  };
}

// ─── 生成 workspace-hub.md（給 Claude 讀的記憶檔）────────────

function generateMarkdown(hub) {
  const lines = [];
  const ts = hub.generatedAt;

  lines.push(`# SDID Workspace Hub Map`);
  lines.push(`\n**Auto-generated**: ${ts}  `);
  lines.push(`**Root**: \`${hub.workspaceRoot}\`  `);
  lines.push(`**Monitor**: \`sdid-monitor/\` → \`node server.cjs\` → http://localhost:3737`);
  lines.push(`\n---\n`);

  // ── Projects 表格 ──
  lines.push(`## Projects\n`);
  lines.push(`| Project | .gems | functions | format | fn count | iters |`);
  lines.push(`|---------|-------|-----------|--------|----------|-------|`);

  for (const [name, p] of Object.entries(hub.projects)) {
    if (!p.hasGems) {
      lines.push(`| ${name} | ❌ | — | — | — | — |`);
      continue;
    }
    const fn     = p.fnData;
    const format = fn ? fn.format : '—';
    const count  = fn ? fn.totalCount : '—';
    const fnMark = fn ? '✅' : '❌';
    const iterList = Object.keys(p.iters || {}).sort().join(', ') || '—';
    lines.push(`| ${name} | ✅ | ${fnMark} | ${format} | ${count} | ${iterList} |`);
  }

  // ── 各專案 functions 摘要（有 description 的才列）──
  lines.push(`\n---\n`);
  lines.push(`## Function 摘要（有 functions.json 的專案）\n`);

  for (const [name, p] of Object.entries(hub.projects)) {
    if (!p.fnData || !p.fnData.functions.length) continue;
    const { functions, byRisk } = p.fnData;
    const riskStr = Object.entries(byRisk || {})
      .map(([r, n]) => `${r}:${n}`).join(' / ');
    lines.push(`### ${name}  `);
    lines.push(`Risk: ${riskStr || '—'}\n`);
    lines.push(`| Function | 說明 | Flow | Story | Risk |`);
    lines.push(`|----------|------|------|-------|------|`);
    for (const f of functions) {
      const desc = String(f.description || '').replace(/\|/g, '｜');
      const flow = (Array.isArray(f.flow) ? f.flow.join(' → ') : String(f.flow || '')).replace(/\|/g, '｜');
      lines.push(`| ${f.name} | ${desc} | ${flow} | ${f.storyId || '—'} | ${f.risk} |`);
    }
    lines.push('');
  }

  // ── 固定區段（格式說明，不會變動）──
  lines.push(`---\n`);
  lines.push(`## .gems 結構\n`);
  lines.push(`\`\`\``);
  lines.push(`<project>/.gems/`);
  lines.push(`├── docs/`);
  lines.push(`│   ├── functions.json        ← 新格式 (description/flow/deps/risk)`);
  lines.push(`│   ├── function-index.json   ← 舊格式 fallback`);
  lines.push(`│   ├── contract.json`);
  lines.push(`│   └── system-blueprint.json`);
  lines.push(`├── iterations/`);
  lines.push(`│   └── iter-N/`);
  lines.push(`│       ├── logs/    ← *.log`);
  lines.push(`│       ├── plan/    ← implementation_plan_Story-X.Y.md`);
  lines.push(`│       ├── poc/`);
  lines.push(`│       └── build/`);
  lines.push(`└── project-memory.json`);
  lines.push(`\`\`\``);

  lines.push(`\n## Log 命名規則\n`);
  lines.push(`\`\`\``);
  lines.push(`build-phase-{N}-Story-{X.Y}-{status}-{ts}.log`);
  lines.push(`poc-step-{N}-{status}-{ts}.log`);
  lines.push(`plan-step-{N}-Story-{X.Y}-{status}-{ts}.log`);
  lines.push(`gate-{check|plan|shrink|expand|verify}-{status}-{ts}.log`);
  lines.push(`cynefin-check-{pass|fail}-{ts}.log`);
  lines.push(`scan-scan-{status}-{ts}.log`);
  lines.push(`\`\`\``);

  lines.push(`\n## Monitor API\n`);
  lines.push(`| Endpoint | 說明 |`);
  lines.push(`|----------|------|`);
  lines.push(`| GET /api/projects | 所有專案進度 |`);
  lines.push(`| GET /api/projects/:name | 專案所有 iter 詳情 |`);
  lines.push(`| GET /api/hub | 讀取 hub.json |`);
  lines.push(`| POST /api/hub/rebuild | 觸發重建 hub |`);
  lines.push(`| GET /api/log | 讀 log 內容 |`);
  lines.push(`| GET /api/scan/:project | 讀 function-index.json |`);
  lines.push(`| GET /api/code | 讀原始碼片段 |`);
  lines.push(`| POST /api/notify | 觸發 SSE refresh |`);

  lines.push(`\n## 規則\n`);
  lines.push(`- 不要用 Glob/Grep 搜尋整個 SDID root，會 timeout`);
  lines.push(`- 用 \`node -e\` + \`fs\` 直接讀取，速度快`);
  lines.push(`- 搜尋前先查本檔，避免重複掃描`);
  lines.push(`- hub.json 有最完整資料，workspace-hub.md 是給 Claude 讀的摘要`);

  return lines.join('\n');
}

// ─── 執行 ────────────────────────────────────────────────────

const hub = scan();
fs.writeFileSync(OUT_FILE, JSON.stringify(hub, null, 2), 'utf8');

// 同步更新 memory/workspace-hub.md（Claude 記憶檔）
// 可能在多個位置，全部更新
const MEMORY_CANDIDATES = [
  // worktree memory（Claude projects 目錄）
  path.join(
    process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming'),
    '..',  'Local', 'claude', 'projects'  // 不可靠，用 glob 找
  ),
  // 直接掃 %USERPROFILE%\.claude\projects\ 下所有 memory 目錄
];

// 更可靠：直接找 %USERPROFILE%\.claude\projects\*\memory\
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
console.log(`  projects  : ${total} total, ${hasGems} with .gems, ${hasFn} with functions`);
console.log(`  hub.json  : ${OUT_FILE}`);
console.log(`  hub.md    : updated ${mdWritten} memory file(s)`);
