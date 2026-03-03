#!/usr/bin/env node
/**
 * SDID Loop Proxy - 轉發到 task-pipe 版本
 * 
 * 這個檔案只是一個 proxy，實際邏輯在 task-pipe/skills/sdid-loop/scripts/loop.cjs
 */
const path = require('path');
const { spawnSync } = require('child_process');

// 找到 task-pipe 的 loop.cjs
const taskPipeLoop = path.resolve(__dirname, '../../../../task-pipe/skills/sdid-loop/scripts/loop.cjs');

// 轉發所有參數
const result = spawnSync('node', [taskPipeLoop, ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: process.cwd()
});

process.exit(result.status || 0);
