#!/usr/bin/env node
/**
 * Story Status CLI
 * 顯示 Story 或 Iteration 的 BUILD 進度
 * 
 * 用法:
 *   node task-pipe/tools/story-status.cjs --target=<path> --iteration=iter-1
 *   node task-pipe/tools/story-status.cjs --target=<path> --story=Story-1.0
 */
const { getStoryStatus, getIterationStatus } = require('../lib/checkpoint.cjs');

const args = process.argv.slice(2);
const target = args.find(a => a.startsWith('--target='))?.split('=')[1] || process.cwd();
const iteration = args.find(a => a.startsWith('--iteration='))?.split('=')[1] || 'iter-1';
const story = args.find(a => a.startsWith('--story='))?.split('=')[1];

// 顏色
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
  bold: '\x1b[1m'
};

// 狀態圖示
const icons = {
  pass: `${c.green}[OK]${c.reset}`,
  current: `${c.yellow}[..]${c.reset}`,
  pending: `${c.dim}[ ]${c.reset}`
};

if (story) {
  // 單一 Story 狀態
  const status = getStoryStatus(target, iteration, story);
  
  console.log(`\n${c.bold}[INFO] Story Status: ${story}${c.reset}`);
  console.log('─'.repeat(50));
  console.log(`Status: ${status.status === 'completed' ? `${c.green}[OK] Completed${c.reset}` : 
               status.status === 'in-progress' ? `${c.yellow}[..] In Progress${c.reset}` : 
               `${c.dim}[ ] Not Started${c.reset}`}`);
  
  if (status.phases.length > 0) {
    console.log(`\nPhases:`);
    const phaseRow = status.phases.map(p => {
      const icon = icons[p.status];
      return `${icon} ${p.phase}`;
    }).join(' → ');
    console.log(`  ${phaseRow}`);
  }
  
  if (status.completedAt) {
    console.log(`\nCompleted: ${status.completedAt}`);
  }
  
} else {
  // 整個 Iteration 狀態
  const status = getIterationStatus(target, iteration);
  
  console.log(`\n${c.bold}[INFO] Iteration Status: ${iteration}${c.reset}`);
  console.log('─'.repeat(50));
  console.log(`Total: ${status.summary.total} | OK ${status.summary.completed} | .. ${status.summary.inProgress} | - ${status.summary.notStarted}`);
  console.log('─'.repeat(50));
  
  for (const s of status.stories) {
    const statusIcon = s.status === 'completed' ? icons.pass : 
                       s.status === 'in-progress' ? icons.current : icons.pending;
    
    let progress = '';
    if (s.status === 'in-progress' && s.phases) {
      const completed = s.phases.filter(p => p.status === 'pass').length;
      progress = ` (${completed}/7)`;
    }
    
    console.log(`${statusIcon} ${s.story}${progress}`);
  }
}

console.log('');
