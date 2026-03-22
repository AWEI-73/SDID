#!/usr/bin/env node
/**
 * zombie-scan.cjs — 殭屍代碼偵測器
 * 掃描整個 task-pipe，找出沒被任何人 require 的檔案
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── 收集所有 .cjs 檔案 ──────────────────────────────────────
function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.gems', '_archive', '__tests__', 'tests'].includes(e.name)) continue;
      walk(full, files);
    } else if (e.isFile() && /\.cjs$/.test(e.name) && !e.name.includes('.test.')) {
      files.push(full);
    }
  }
  return files;
}

// ── 解析 require() 呼叫 ─────────────────────────────────────
function parseRequires(filePath) {
  let src = '';
  try { src = fs.readFileSync(filePath, 'utf8'); } catch { return []; }
  // 移除 block comment 避免誤抓
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const deps = [];
  const re = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[1].startsWith('.')) deps.push(m[1]);
  }
  return deps;
}

// ── 解析相對路徑 → 絕對路徑 ────────────────────────────────
function resolve(from, dep) {
  const base = path.resolve(path.dirname(from), dep);
  const candidates = [
    base,
    base + '.cjs',
    base + '.js',
    path.join(base, 'index.cjs'),
    path.join(base, 'index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

// ── 已知 CLI 入口（不被 require，從外部直接執行）───────────
const ENTRIES = new Set([
  path.join(ROOT, 'runner.cjs'),
  path.join(ROOT, 'phases/build/phase-1.cjs'),
  path.join(ROOT, 'phases/build/phase-2.cjs'),
  path.join(ROOT, 'phases/build/phase-3.cjs'),
  path.join(ROOT, 'phases/build/phase-4.cjs'),
  path.join(ROOT, 'phases/scan/scan.cjs'),
  path.join(ROOT, 'tools/dep-scan.cjs'),
  path.join(ROOT, 'tools/spec-to-plan.cjs'),
  path.join(ROOT, 'tools/health-report.cjs'),
  path.join(ROOT, 'tools/project-status.cjs'),
  path.join(ROOT, 'tools/force-commands.cjs'),
  path.join(ROOT, 'tools/shrink-tags.cjs'),
  path.join(ROOT, 'tools/zombie-scan.cjs'),
  path.join(ROOT, 'tools/quality-check/poc-quality-checker.cjs'),
  path.join(ROOT, 'tools/quality-check/content-quality-checker.cjs'),
  path.join(ROOT, 'skills/sdid-loop/scripts/loop.cjs'),
]);

// ── 建立完整依賴圖 ─────────────────────────────────────────
const allFiles = walk(ROOT);
const hasInbound = new Set();

for (const file of allFiles) {
  for (const dep of parseRequires(file)) {
    const abs = resolve(file, dep);
    if (abs) hasInbound.add(abs);
  }
}

// ── 找殭屍 ────────────────────────────────────────────────
const zombies = allFiles.filter(f => !hasInbound.has(f) && !ENTRIES.has(f));

// ── 輸出 ──────────────────────────────────────────────────
console.log(`\n🧟 zombie-scan — task-pipe 殭屍偵測\n`);
console.log(`掃描: ${allFiles.length} 個 .cjs 檔案`);
console.log(`入口: ${ENTRIES.size} 個\n`);

if (zombies.length === 0) {
  console.log('✅ 無殭屍檔案');
} else {
  console.log(`⚠️  殭屍候選 ${zombies.length} 個（沒被任何人 require）:\n`);
  zombies.sort().forEach(f => {
    const rel = path.relative(ROOT, f);
    console.log(' ', rel);
  });
}

console.log(`\n提示：殭屍候選需人工確認（可能被 dynamic require 或外部工具使用）`);
