#!/usr/bin/env node
/**
 * SDID Blueprint Loop Proxy
 * 轉發到實際的 blueprint-loop.cjs
 */
const path = require('path');
const { spawnSync } = require('child_process');

const ACTUAL_SCRIPT = path.resolve(__dirname, '../../blueprint-loop/scripts/loop.cjs');
const args = process.argv.slice(2);

const result = spawnSync('node', [ACTUAL_SCRIPT, ...args], {
  stdio: 'inherit',
  cwd: process.cwd(),
  encoding: 'utf-8'
});

process.exit(result.status || 0);
