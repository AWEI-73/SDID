#!/usr/bin/env node
/**
 * Project Status Scanner - 掃描 workspace 下所有 GEMS 專案的進度
 * 
 * 用途: hook 觸發時自動注入專案狀態給 AI
 * 輸出: 精簡的專案進度摘要 (適合 AI 讀取)
 * 
 * Usage: node task-pipe/tools/project-status.cjs [--workspace=.]
 */
const fs = require('fs');
const path = require('path');

function run(workspaceRoot) {
  const projects = findGemsProjects(workspaceRoot);
  
  if (projects.length === 0) {
    console.log('@PROJECT_STATUS: No GEMS projects found');
    return;
  }

  console.log(`@PROJECT_STATUS | ${projects.length} project(s)`);
  console.log('');

  for (const proj of projects) {
    const status = getProjectStatus(proj.path, proj.name);
    const icon = status.verdict === 'PASS' ? '✅' : status.verdict === 'BLOCKED' ? '🔴' : '🟡';
    
    console.log(`${icon} ${proj.name}`);
    console.log(`  Iteration: ${status.iteration}`);
    console.log(`  Phase: ${status.phase} | Step: ${status.step}`);
    if (status.story) console.log(`  Story: ${status.story}`);
    console.log(`  Status: ${status.verdict}`);
    if (status.lastError) console.log(`  Last Issue: ${status.lastError}`);
    if (status.nextCommand) console.log(`  Next: ${status.nextCommand}`);
    console.log('');
  }
}

/**
 * 找出 workspace 下所有有 .gems/ 的專案目錄
 */
function findGemsProjects(root) {
  const projects = [];
  
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      
      const projPath = path.join(root, entry.name);
      const gemsPath = path.join(projPath, '.gems');
      
      if (fs.existsSync(gemsPath)) {
        projects.push({ name: entry.name, path: projPath });
      }
    }
  } catch (e) { /* ignore */ }
  
  return projects;
}

/**
 * 從 logs 目錄推斷專案目前的進度
 */
function getProjectStatus(projPath, projName) {
  const itersPath = path.join(projPath, '.gems', 'iterations');
  if (!fs.existsSync(itersPath)) {
    return { iteration: 'none', phase: 'NOT_STARTED', step: '-', verdict: 'NEW', story: null, lastError: null, nextCommand: null };
  }

  // 找最新的 iteration
  const iters = fs.readdirSync(itersPath)
    .filter(d => d.startsWith('iter-'))
    .sort((a, b) => {
      const numA = parseInt(a.replace('iter-', ''));
      const numB = parseInt(b.replace('iter-', ''));
      return numB - numA;
    });

  if (iters.length === 0) {
    return { iteration: 'none', phase: 'NOT_STARTED', step: '-', verdict: 'NEW', story: null, lastError: null, nextCommand: null };
  }

  const latestIter = iters[0];
  const iterPath = path.join(itersPath, latestIter);

  // 從 logs 找最新的 log 檔案
  const logsPath = path.join(iterPath, 'logs');
  let latestLog = null;
  let latestLogTime = 0;

  if (fs.existsSync(logsPath)) {
    const logFiles = fs.readdirSync(logsPath).filter(f => f.endsWith('.log'));
    
    for (const logFile of logFiles) {
      const stat = fs.statSync(path.join(logsPath, logFile));
      if (stat.mtimeMs > latestLogTime) {
        latestLogTime = stat.mtimeMs;
        latestLog = logFile;
      }
    }
  }

  // 解析 log 檔名: build-phase-2-Story-1.0-error-2026-02-10T16-10-25.log
  const result = {
    iteration: latestIter,
    phase: 'UNKNOWN',
    step: '-',
    verdict: 'IN_PROGRESS',
    story: null,
    lastError: null,
    nextCommand: null
  };

  if (latestLog) {
    const parsed = parseLogFileName(latestLog);
    result.phase = parsed.phase.toUpperCase();
    result.step = parsed.step;
    if (parsed.story) result.story = parsed.story;
    
    if (parsed.type === 'pass') {
      result.verdict = 'PASS';
    } else if (parsed.type === 'error' || parsed.type === 'error-spec') {
      result.verdict = 'BLOCKED';
      // 讀取 log 第一行作為 lastError
      try {
        const logContent = fs.readFileSync(path.join(logsPath, latestLog), 'utf8');
        const firstMeaningful = logContent.split('\n').find(l => l.startsWith('@') && !l.startsWith('@CONTEXT'));
        if (firstMeaningful) result.lastError = firstMeaningful.slice(0, 80);
      } catch (e) { /* ignore */ }
    } else if (parsed.type === 'template' || parsed.type === 'pending') {
      result.verdict = 'PENDING';
    }

    // 推斷 next command
    const relTarget = path.relative(process.cwd(), projPath) || '.';
    if (result.verdict === 'BLOCKED' || result.verdict === 'PENDING') {
      result.nextCommand = `node task-pipe/runner.cjs --phase=${result.phase} --step=${parsed.stepNum} --target=${relTarget} --iteration=${latestIter}${parsed.story ? ` --story=${parsed.story}` : ''}`;
    } else if (result.verdict === 'PASS') {
      const nextStep = getNextStep(parsed.phase, parsed.stepNum);
      if (nextStep) {
        result.nextCommand = `node task-pipe/runner.cjs --phase=${nextStep.phase} --step=${nextStep.step} --target=${relTarget} --iteration=${latestIter}${parsed.story ? ` --story=${parsed.story}` : ''}`;
      }
    }
  } else {
    // 沒有 log，看有什麼產物
    if (fs.existsSync(path.join(iterPath, 'build'))) {
      result.phase = 'BUILD';
    } else if (fs.existsSync(path.join(iterPath, 'plan'))) {
      result.phase = 'PLAN';
    } else if (fs.existsSync(path.join(iterPath, 'poc'))) {
      result.phase = 'POC';
    }
  }

  return result;
}

/**
 * 解析 log 檔名
 * 格式: build-phase-2-Story-1.0-error-2026-02-10T16-10-25.log
 *        poc-step-4-error-2026-02-10T15-46-54.log
 *        gate-check-error-2026-02-13T17-16-41.log
 */
function parseLogFileName(fileName) {
  const result = { phase: 'unknown', step: '-', stepNum: '1', story: null, type: 'info' };
  
  const name = fileName.replace('.log', '');
  
  // 提取 Story ID
  const storyMatch = name.match(/Story-(\d+\.\d+)/);
  if (storyMatch) result.story = `Story-${storyMatch[1]}`;
  
  // 提取 type (最後一個已知 type 關鍵字)
  const types = ['pass', 'error-spec', 'error', 'fix', 'template', 'pending', 'smoke-test', 'info'];
  for (const t of types) {
    if (name.includes(`-${t}-`) || name.includes(`-${t}`)) {
      result.type = t;
      break;
    }
  }
  
  // 提取 phase 和 step
  if (name.startsWith('build-phase-')) {
    result.phase = 'build';
    const stepMatch = name.match(/build-phase-(\d+)/);
    if (stepMatch) {
      result.step = `phase-${stepMatch[1]}`;
      result.stepNum = stepMatch[1];
    }
  } else if (name.startsWith('poc-step-')) {
    result.phase = 'poc';
    const stepMatch = name.match(/poc-step-(\d+)/);
    if (stepMatch) {
      result.step = `step-${stepMatch[1]}`;
      result.stepNum = stepMatch[1];
    }
  } else if (name.startsWith('plan-step-')) {
    result.phase = 'plan';
    const stepMatch = name.match(/plan-step-(\d+)/);
    if (stepMatch) {
      result.step = `step-${stepMatch[1]}`;
      result.stepNum = stepMatch[1];
    }
  } else if (name.startsWith('gate-')) {
    result.phase = 'blueprint';
    result.step = 'gate';
    result.stepNum = '0';
  } else if (name.startsWith('scan-')) {
    result.phase = 'scan';
    result.step = 'scan';
    result.stepNum = '1';
  }
  
  return result;
}

/**
 * 推斷下一步
 */
function getNextStep(phase, currentStep) {
  const num = parseInt(currentStep);
  
  if (phase === 'poc') {
    if (num < 5) return { phase: 'POC', step: num + 1 };
    return { phase: 'PLAN', step: 1 };
  }
  if (phase === 'plan') {
    if (num < 5) return { phase: 'PLAN', step: num + 1 };
    return { phase: 'BUILD', step: 1 };
  }
  if (phase === 'build') {
    if (num < 8) return { phase: 'BUILD', step: num + 1 };
    return { phase: 'SCAN', step: 1 };
  }
  return null;
}

// CLI
if (require.main === module) {
  let workspace = process.cwd();
  
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--workspace=')) workspace = arg.split('=')[1];
  });
  
  if (!path.isAbsolute(workspace)) {
    workspace = path.resolve(process.cwd(), workspace);
  }
  
  run(workspace);
}

module.exports = { run, findGemsProjects, getProjectStatus };
