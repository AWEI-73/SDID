#!/usr/bin/env node
/**
 * Force Commands - 強制跳轉指令
 * 
 * 用於處理卡死、爛尾、中途插入等情況
 * 
 * 用法:
 *   node task-pipe/tools/force-commands.cjs --action=next-iteration --target=./my-project
 *   node task-pipe/tools/force-commands.cjs --action=start-from --node=PLAN-1 --target=./my-project
 *   node task-pipe/tools/force-commands.cjs --action=abandon --iteration=iter-1 --target=./my-project
 *   node task-pipe/tools/force-commands.cjs --action=diagnose --target=./my-project
 */
const fs = require('fs');
const path = require('path');

// 使用 v3 state manager
const stateManager = require('../lib/shared/state-manager-v3.cjs');

// ============================================
// 顏色輸出
// ============================================
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(msg, color = 'reset') {
  console.log(`${c[color]}${msg}${c.reset}`);
}

// ============================================
// 解析參數
// ============================================
function parseArgs() {
  const args = process.argv.slice(2);
  
  return {
    action: args.find(a => a.startsWith('--action='))?.split('=')[1] || null,
    target: args.find(a => a.startsWith('--target='))?.split('=')[1] || process.cwd(),
    iteration: args.find(a => a.startsWith('--iteration='))?.split('=')[1] || null,
    node: args.find(a => a.startsWith('--node='))?.split('=')[1] || null,
    story: args.find(a => a.startsWith('--story='))?.split('=')[1] || null,
    reason: args.find(a => a.startsWith('--reason='))?.split('=')[1] || null,
    help: args.includes('--help') || args.includes('-h')
  };
}

// ============================================
// 顯示幫助
// ============================================
function showHelp() {
  console.log(`
${c.bold}Force Commands - 強制跳轉指令${c.reset}

${c.cyan}用法:${c.reset}
  node task-pipe/tools/force-commands.cjs --action=<ACTION> [options]

${c.cyan}Actions:${c.reset}
  ${c.green}next-iteration${c.reset}    強制跳到下一個迭代（標記當前為 ABANDONED）
  ${c.green}start-from${c.reset}        從指定節點開始（重置當前迭代）
  ${c.green}abandon${c.reset}           標記指定迭代為 ABANDONED
  ${c.green}diagnose${c.reset}          診斷專案狀態
  ${c.green}list${c.reset}              列出所有迭代狀態

${c.cyan}Options:${c.reset}
  --target=<path>       專案路徑（預設: 當前目錄）
  --iteration=<iter-X>  指定迭代
  --node=<PHASE-STEP>   指定節點（如 PLAN-1, BUILD-4）
  --story=<Story-X.Y>   指定 Story
  --reason=<text>       原因說明

${c.cyan}範例:${c.reset}
  # iter-1 爛尾，跳到 iter-2
  node task-pipe/tools/force-commands.cjs --action=next-iteration --target=./my-project

  # 從 PLAN Step 1 開始（跳過 POC）
  node task-pipe/tools/force-commands.cjs --action=start-from --node=PLAN-1 --target=./my-project

  # 診斷專案狀態
  node task-pipe/tools/force-commands.cjs --action=diagnose --target=./my-project
`);
}

// ============================================
// Actions
// ============================================

/**
 * 強制跳到下一個迭代
 */
function actionNextIteration(options) {
  const { target, reason } = options;
  
  // 偵測當前活躍迭代
  const currentIter = stateManager.detectActiveIteration(target);
  const currentState = stateManager.readState(target, currentIter);
  
  if (!currentState) {
    log(`⚠️ 沒有找到活躍的迭代，將建立 iter-1`, 'yellow');
    const newState = stateManager.getCurrentState(target, 'iter-1');
    log(`✅ 已建立 iter-1`, 'green');
    return;
  }
  
  log(`\n📋 當前迭代: ${currentIter}`, 'cyan');
  log(`   狀態: ${currentState.status}`, 'dim');
  log(`   當前節點: ${currentState.flow?.currentNode || 'N/A'}`, 'dim');
  
  // 執行跳轉
  const result = stateManager.forceNextIteration(target, currentIter, {
    reason: reason || 'Force next iteration via CLI',
    entryPoint: 'POC-1'
  });
  
  log(`\n✅ 已跳轉到 ${result.newIteration}`, 'green');
  log(`   ${currentIter} 已標記為 ABANDONED`, 'dim');
  log(`\n下一步:`, 'cyan');
  log(`   node task-pipe/runner.cjs --phase=POC --step=1 --target=${target} --iteration=${result.newIteration}`, 'dim');
}

/**
 * 從指定節點開始
 */
function actionStartFrom(options) {
  const { target, node, iteration } = options;
  
  if (!node) {
    log(`❌ 缺少 --node 參數`, 'red');
    log(`   範例: --node=PLAN-1, --node=BUILD-4`, 'dim');
    process.exit(1);
  }
  
  // 驗證節點格式
  const { phase, step } = stateManager.parseNode(node);
  if (!phase) {
    log(`❌ 無效的節點格式: ${node}`, 'red');
    log(`   格式: PHASE-STEP (如 POC-1, PLAN-1, BUILD-4)`, 'dim');
    process.exit(1);
  }
  
  // 決定迭代
  const targetIter = iteration || stateManager.detectActiveIteration(target);
  
  log(`\n📋 設定入口點`, 'cyan');
  log(`   迭代: ${targetIter}`, 'dim');
  log(`   起始節點: ${node}`, 'dim');
  
  // 執行
  const state = stateManager.forceStartFrom(target, targetIter, node);
  
  log(`\n✅ 已設定 ${targetIter} 從 ${node} 開始`, 'green');
  log(`\n下一步:`, 'cyan');
  log(`   node task-pipe/runner.cjs --phase=${phase} --step=${step} --target=${target}`, 'dim');
}

/**
 * 標記迭代為 ABANDONED
 */
function actionAbandon(options) {
  const { target, iteration, reason } = options;
  
  if (!iteration) {
    log(`❌ 缺少 --iteration 參數`, 'red');
    process.exit(1);
  }
  
  const state = stateManager.readState(target, iteration);
  if (!state) {
    log(`❌ 找不到迭代: ${iteration}`, 'red');
    process.exit(1);
  }
  
  stateManager.abandonIteration(target, iteration, reason || 'Abandoned via CLI');
  
  log(`\n✅ ${iteration} 已標記為 ABANDONED`, 'green');
}

/**
 * 診斷專案狀態
 */
function actionDiagnose(options) {
  const { target } = options;
  
  log(`\n${'═'.repeat(50)}`, 'cyan');
  log(`📋 專案診斷: ${target}`, 'bold');
  log(`${'═'.repeat(50)}`, 'cyan');
  
  const iterationsDir = path.join(target, '.gems/iterations');
  
  if (!fs.existsSync(iterationsDir)) {
    log(`\n⚠️ 沒有找到 .gems/iterations 目錄`, 'yellow');
    log(`   這是一個新專案，請執行:`, 'dim');
    log(`   node task-pipe/runner.cjs --phase=POC --step=1 --target=${target}`, 'dim');
    return;
  }
  
  const iterDirs = fs.readdirSync(iterationsDir)
    .filter(d => d.match(/^iter-\d+$/))
    .sort((a, b) => {
      const numA = parseInt(a.replace('iter-', ''));
      const numB = parseInt(b.replace('iter-', ''));
      return numA - numB;
    });
  
  if (iterDirs.length === 0) {
    log(`\n⚠️ 沒有找到任何迭代`, 'yellow');
    return;
  }
  
  log(`\n📁 迭代列表:`, 'cyan');
  
  let activeIter = null;
  
  for (const iterDir of iterDirs) {
    const state = stateManager.readState(target, iterDir);
    
    let statusIcon = '❓';
    let statusColor = 'dim';
    
    if (state) {
      switch (state.status) {
        case 'active':
          statusIcon = '🟢';
          statusColor = 'green';
          activeIter = iterDir;
          break;
        case 'completed':
          statusIcon = '✅';
          statusColor = 'green';
          break;
        case 'abandoned':
          statusIcon = '🔴';
          statusColor = 'red';
          break;
      }
      
      log(`\n   ${statusIcon} ${iterDir}`, statusColor);
      log(`      狀態: ${state.status}`, 'dim');
      log(`      當前節點: ${state.flow?.currentNode || 'N/A'}`, 'dim');
      
      // 顯示重試資訊
      if (state.retries && Object.keys(state.retries).length > 0) {
        log(`      重試:`, 'yellow');
        for (const [key, retry] of Object.entries(state.retries)) {
          const humanIcon = retry.needsHuman ? '🚨' : '';
          log(`         ${key}: ${retry.count} 次 ${humanIcon}`, 'dim');
        }
      }
      
      // 顯示 Story 資訊
      if (state.stories && Object.keys(state.stories).length > 0) {
        log(`      Stories:`, 'cyan');
        for (const [storyId, story] of Object.entries(state.stories)) {
          const storyIcon = story.status === 'completed' ? '✅' : 
                           story.status === 'in-progress' ? '🔄' : '⏳';
          log(`         ${storyIcon} ${storyId}: ${story.status}`, 'dim');
        }
      }
    } else {
      // 沒有 state.json，檢查是否有其他檔案
      const iterPath = path.join(iterationsDir, iterDir);
      const hasFiles = fs.readdirSync(iterPath).length > 0;
      
      log(`\n   ❓ ${iterDir}`, 'yellow');
      log(`      狀態: 無 state.json`, 'dim');
      log(`      有檔案: ${hasFiles ? '是' : '否'}`, 'dim');
    }
  }
  
  log(`\n${'─'.repeat(50)}`, 'dim');
  
  if (activeIter) {
    log(`\n🎯 活躍迭代: ${activeIter}`, 'green');
    const state = stateManager.readState(target, activeIter);
    if (state?.flow?.currentNode) {
      const { phase, step } = stateManager.parseNode(state.flow.currentNode);
      log(`\n下一步:`, 'cyan');
      log(`   node task-pipe/runner.cjs --phase=${phase} --step=${step} --target=${target}`, 'dim');
    }
  } else {
    log(`\n⚠️ 沒有活躍的迭代`, 'yellow');
    const nextIter = `iter-${iterDirs.length + 1}`;
    log(`\n建議:`, 'cyan');
    log(`   node task-pipe/tools/force-commands.cjs --action=next-iteration --target=${target}`, 'dim');
  }
  
  log('');
}

/**
 * 列出所有迭代
 */
function actionList(options) {
  actionDiagnose(options);  // 複用診斷邏輯
}

// ============================================
// 主函式
// ============================================
function main() {
  const options = parseArgs();
  
  if (options.help || !options.action) {
    showHelp();
    process.exit(options.help ? 0 : 1);
  }
  
  switch (options.action) {
    case 'next-iteration':
      actionNextIteration(options);
      break;
    case 'start-from':
      actionStartFrom(options);
      break;
    case 'abandon':
      actionAbandon(options);
      break;
    case 'diagnose':
      actionDiagnose(options);
      break;
    case 'list':
      actionList(options);
      break;
    default:
      log(`❌ 未知的 action: ${options.action}`, 'red');
      showHelp();
      process.exit(1);
  }
}

// ============================================
// 執行
// ============================================
if (require.main === module) {
  main();
}

module.exports = {
  actionNextIteration,
  actionStartFrom,
  actionAbandon,
  actionDiagnose
};
