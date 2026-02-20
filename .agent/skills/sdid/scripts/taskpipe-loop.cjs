#!/usr/bin/env node
/**
 * SDID Task-Pipe Loop Proxy
 * 轉發到實際的 sdid-loop loop.cjs
 */
const path = require('path');
const { spawnSync } = require('child_process');

// 轉發到 task-pipe 實體腳本 (4個 ../ 才會回到 SDID project root)
const ACTUAL_SCRIPT = path.resolve(__dirname, '../../../../task-pipe/skills/sdid-loop/scripts/loop.cjs');
const args = process.argv.slice(2);

const result = spawnSync('node', [ACTUAL_SCRIPT, ...args], {
  stdio: 'inherit',
  cwd: process.cwd(),
  encoding: 'utf-8'
});

process.exit(result.status || 0);
