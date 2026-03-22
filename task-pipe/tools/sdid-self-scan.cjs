#!/usr/bin/env node
/**
 * sdid-self-scan.cjs — SDID 自身 GEMS 標籤掃描器
 *
 * 用 git ls-files 作為 source-of-truth，只掃 git 追蹤的 SDID 核心 .cjs 檔，
 * 過濾 tests / node_modules / 其他子專案，輸出到 functions.json。
 *
 * 用法:
 *   node task-pipe/tools/sdid-self-scan.cjs [--output=<path>]
 */
'use strict';
const { execSync } = require('child_process');
const unified = require('../lib/scan/gems-scanner-unified.cjs');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const defaultOutput = path.join(root, '.gems', 'iterations', 'iter-1', 'functions.json');
const outputArg = process.argv.find(a => a.startsWith('--output='));
const outputPath = outputArg ? path.resolve(outputArg.split('=')[1]) : defaultOutput;

// git ls-files 取得追蹤中的 .cjs/.ts 檔（SDID 核心目錄）
const gitFiles = execSync('git ls-files', { cwd: root }).toString().split('\n')
  .filter(f => /\.(cjs|ts)$/.test(f))
  .filter(f => /^(sdid-core|sdid-tools|task-pipe|sdid-monitor)/.test(f))
  .filter(f => !/node_modules|\.test\.|dryrun-full-loop|test-path-resolution|shrink-tags/.test(f));

console.log(`掃描 git-tracked 檔案: ${gitFiles.length} 個`);

// 掃各核心目錄，只保留 git-tracked 的函式
const dirs = ['sdid-core', 'sdid-tools', 'task-pipe', 'sdid-monitor'];
const allFns = [];
const seen = new Set();

for (const d of dirs) {
  const srcDir = path.join(root, d);
  if (!fs.existsSync(srcDir)) continue;
  const result = unified.scan(srcDir, root);
  for (const fn of result.functions) {
    const rel = fn.file.replace(/\\/g, '/');
    const inGit = gitFiles.some(gf => gf.replace(/\\/g, '/') === rel || gf.replace(/\\/g, '/').endsWith('/' + rel));
    if (!seen.has(fn.name) && inGit) {
      seen.add(fn.name);
      allFns.push(fn);
    }
  }
}

const p0 = allFns.filter(f => f.priority === 'P0').length;
const p1 = allFns.filter(f => f.priority === 'P1').length;
console.log(`結果: ${allFns.length} 函式 (P0:${p0} P1:${p1})`);

// 輸出
const output = { functions: allFns, generatedAt: new Date().toISOString(), source: 'sdid-self-scan' };
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`輸出: ${path.relative(root, outputPath)}`);
