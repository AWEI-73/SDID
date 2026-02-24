#!/usr/bin/env node
// -*- coding: utf-8 -*-

/**
 * Task-Pipe Runner v1.2
 * 
 * 設定編碼以支援中文字元輸出 (針對 Windows 終端)
 */
if (process.platform === 'win32') {
  try {
    require('child_process').execSync('chcp 65001', { stdio: 'ignore' });
  } catch (e) {
    // 忽略錯誤
  }

  // 檢測是否為管道輸出（非 TTY）
  const isPiped = !process.stdout.isTTY;

  if (isPiped) {
    // 只在管道模式下強制 UTF-8 輸出（修復重定向亂碼）
    console.log = function (...args) {
      const message = args.map(arg =>
        typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)
      ).join(' ');

      // 使用 Buffer 確保 UTF-8 編碼
      process.stdout.write(Buffer.from(message + '\n', 'utf8'));
    };

    console.error = function (...args) {
      const message = args.map(arg =>
        typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)
      ).join(' ');

      process.stderr.write(Buffer.from(message + '\n', 'utf8'));
    };
  }
  // 直接終端輸出時，保持原生 console.log（chcp 65001 已處理編碼）
}

/**
 * 用法:
 *   node task-pipe/runner.cjs --phase=POC --step=1
 *   node task-pipe/runner.cjs --phase=PLAN --step=1
 *   node task-pipe/runner.cjs --phase=BUILD --step=1
 *   node task-pipe/runner.cjs --phase=SCAN
 * 
 * 選項:
 *   --phase=<POC|PLAN|BUILD|SCAN>  階段
 *   --step=<N>                      步驟編號
 *   --level=<S|M|L>                 檢查深度 (預設: M)
 *   --target=<path>                 目標路徑
 *   --config=<path>                 配置檔案 (預設: task-pipe/config.json)
 *   --dry-run                       預覽模式，不實際執行
 *   --plain                         純文字模式 (無 ANSI 顏色，適合 AI/重定向)
 *   --ai                            AI 模式 (自動啟用 --plain，並優化輸出格式)
 *   --help                          顯示幫助
 */

const fs = require('fs');
const path = require('path');
const { shouldExecutePhase, getLevelDescription, getNextPhase } = require('./lib/level-gate.cjs');
const { ensureScaffold } = require('./lib/scaffold/index.cjs');

// v3.1: Project Memory
let projectMemory = null;
try {
  projectMemory = require('./lib/shared/project-memory.cjs');
} catch (e) {
  // project-memory 可選
}

// v3.0: 使用新的 state manager
let stateManagerV3 = null;
let stateManagerV2 = null;
try {
  stateManagerV3 = require('./lib/shared/state-manager-v3.cjs');
} catch (e) {
  // Fallback to v2
}
try {
  stateManagerV2 = require('./lib/shared/state-manager.cjs');
} catch (e) {
  // No fallback available
}

// 統一的 state API
function getCurrentState(target, iteration, story) {
  if (stateManagerV3) {
    const state = stateManagerV3.getCurrentState(target, iteration);
    // 轉換為舊格式以保持相容
    const { phase, step } = stateManagerV3.parseNode(state.flow?.currentNode || 'POC-1');
    return {
      phase: phase || 'POC',
      step: step || '0',
      story: story || Object.keys(state.stories || {})[0] || null,
      source: state.source
    };
  }
  if (stateManagerV2) {
    return stateManagerV2.getCurrentState(target, iteration, story);
  }
  return { phase: 'POC', step: '0', source: 'fallback' };
}

function advanceState(target, iteration, phase, step, story) {
  if (stateManagerV3) {
    return stateManagerV3.advanceState(target, iteration, phase, step, story);
  }
  if (stateManagerV2) {
    return stateManagerV2.advanceState(target, iteration, phase, step, story);
  }
  return null;
}

function recordRetry(target, iteration, phase, step, error) {
  if (stateManagerV3) {
    return stateManagerV3.recordRetry(target, iteration, phase, step, error);
  }
  return { count: 0, needsHuman: false };
}

// v2.0: 引入 Phase Registry Loader
let registryLoader = null;
try {
  registryLoader = require('./lib/shared/phase-registry-loader.cjs');
} catch (e) {
  // Fallback: 使用舊的硬編碼
}

// ============================================
// 顏色輸出 (支援 --plain 模式)
// ============================================
let plainMode = false;

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function c(text, color) {
  if (plainMode) return text;
  return `${colors[color] || ''}${text}${colors.reset}`;
}

function log(message, color = 'reset') {
  console.log(c(message, color));
}

// Plain mode 專用分隔線 (使用 ASCII 字元)
function separator(char = '-', length = 60) {
  if (plainMode) {
    return char.repeat(length);
  }
  return '═'.repeat(length);
}

// Fallback actions (當 registry 載入失敗時使用)
function getFallbackActions(phase, step) {
  const fallbacks = {
    BUILD: {
      '1': ['Read implementation plan', 'Generate dev script', 'Write checkpoint'],
      '2': ['Scan GEMS tags', 'Compare with Plan spec', 'Check P0/P1 compliance'],
      '3': ['Detect project type', 'Check scaffold files', 'Output missing files list'],
      '4': ['Verify GEMS-TEST-FILE', 'Check test file exists', 'Verify import of tested function'],
      '5': ['Search test files', 'Run npm test', 'Verify 100% pass'],
      '6': ['Run integration tests', 'Verify cross-module interaction'],
      '7': ['Check Phase 1-6 checkpoints', 'Verify integration completeness'],
      '8': ['Scan source to generate Fillback', 'Generate Suggestions JSON', 'Clear checkpoints'],
    },
    POC: {
      '1': ['Check requirement ambiguity', 'Mark [NEEDS CLARIFICATION]'],
      '2': ['Evaluate project scale', 'Check Story count limits'],
      '3': ['Design data contract', 'Generate @GEMS-CONTRACT'],
      '4': ['Create UI prototype', 'Generate xxxPOC.html'],
      '5': ['Generate requirement spec', 'Verify independent testability'],
    },
    PLAN: {
      '1': ['Requirement confirmation', 'Ambiguity elimination'],
      '2': ['Spec injection', 'Read POC output'],
      '3': ['Architecture audit', 'Constitution Audit'],
      '4': ['Tag spec design', 'GEMS v2.1'],
      '5': ['Generate implementation plan'],
    }
  };
  return fallbacks[phase]?.[step] || ['Execute phase script'];
}

// ============================================
// 解析命令列參數
// ============================================
function parseArgs() {
  const args = process.argv.slice(2);

  const isAiMode = args.includes('--ai');
  const isPlain = args.includes('--plain') || isAiMode;

  return {
    phase: args.find(a => a.startsWith('--phase='))?.split('=')[1]?.toUpperCase() || null,
    step: args.find(a => a.startsWith('--step='))?.split('=')[1] || null,
    level: args.find(a => a.startsWith('--level='))?.split('=')[1]?.toUpperCase() || 'M',
    target: args.find(a => a.startsWith('--target='))?.split('=')[1] || process.cwd(),
    iteration: args.find(a => a.startsWith('--iteration='))?.split('=')[1] || null,  // v3: 自動偵測
    story: args.find(a => a.startsWith('--story='))?.split('=')[1] || null,
    config: args.find(a => a.startsWith('--config='))?.split('=')[1] || path.join(__dirname, 'config.json'),
    stressTest: args.find(a => a.startsWith('--stress-test='))?.split('=')[1] || null,
    dryRun: args.includes('--dry-run'),
    plain: isPlain,
    ai: isAiMode,
    help: args.includes('--help') || args.includes('-h'),
    // v3.0: 強制指令
    forceNextIteration: args.includes('--force-next-iteration'),
    forceStartFrom: args.find(a => a.startsWith('--force-start='))?.split('=')[1] || null,
    forceAbandon: args.includes('--force-abandon'),
    diagnose: args.includes('--diagnose'),
    // P5: Quick Mode
    quick: args.includes('--quick'),
  };
}

// ============================================
// 顯示幫助
// ============================================
function showHelp() {
  console.log(`
${c('Task-Pipe Runner v2.0', 'bold')} - GEMS 流程自動化工具

${c('用法:', 'cyan')}
  node task-pipe/runner.cjs --phase=<PHASE> [options]

${c('階段 (Phase):', 'cyan')}
  POC    - 概念驗證 (Step 1-5)
  PLAN   - 規劃階段 (Step 1-5)
  BUILD  - 開發階段 (Phase 1-8)
  SCAN   - 掃描階段

${c('選項:', 'cyan')}
  --phase=<POC|PLAN|BUILD|SCAN>  指定階段 (必填)
  --step=<N>                      指定步驟編號 (POC/PLAN 需要)
  --level=<S|M|L>                 檢查深度 (預設: M)
  --target=<path>                 目標路徑 (預設: 當前目錄)
  --iteration=<iter-X>            指定迭代 (預設: 自動偵測)
  --config=<path>                 配置檔案路徑
  --dry-run                       預覽模式
  --plain                         純文字模式 (無 ANSI 顏色)
  --ai                            AI 模式 (自動啟用 --plain)
  -h, --help                      顯示此幫助

${c('強制指令 (v2.0):', 'yellow')}
  --force-next-iteration          強制跳到下一個迭代（標記當前為 ABANDONED）
  --force-start=<PHASE-STEP>      強制從指定節點開始（如 PLAN-1, BUILD-4）
  --force-abandon                 標記當前迭代為 ABANDONED
  --diagnose                      診斷專案狀態
  --quick                         Quick Mode: BUILD 只跑 Phase [1,2,5,7]

${c('範例:', 'cyan')}
  # 自動偵測下一步
  node task-pipe/runner.cjs --target=./my-project

  # POC Step 1: 模糊消除
  node task-pipe/runner.cjs --phase=POC --step=1

  # iter-1 爛尾，跳到 iter-2
  node task-pipe/runner.cjs --force-next-iteration --target=./my-project

  # 從 PLAN Step 1 開始（跳過 POC）
  node task-pipe/runner.cjs --force-start=PLAN-1 --target=./my-project

  # 診斷專案狀態
  node task-pipe/runner.cjs --diagnose --target=./my-project
`);
}

// ============================================
// 載入配置
// ============================================
function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    log(`⚠ Config not found: ${configPath}`, 'yellow');
    log(`  Using defaults`, 'dim');
    return getDefaultConfig();
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    log(`✗ Config parse failed: ${err.message}`, 'red');
    process.exit(1);
  }
}

function getDefaultConfig() {
  return {
    // v2.4: task-pipe 獨立運作，不再依賴外部 control-tower
    hubPath: null,
    levels: {
      S: { phases: [1, 4, 7], strict: false },
      M: { phases: [1, 2, 3, 4, 5, 7], strict: false },
      L: { phases: [1, 2, 3, 4, 5, 6, 7], strict: true },
    },
  };
}

// ============================================
// 執行階段腳本
// ============================================
function runPhase(phase, step, options, config) {
  const phaseLower = phase.toLowerCase();

  // P5: Quick Mode — 只跑 Phase [1,2,5,7] 子集
  const QUICK_MODE_PHASES = ['1', '2', '5', '7'];
  if (phase === 'BUILD' && step && options.quick) {
    if (!QUICK_MODE_PHASES.includes(String(step))) {
      const nextQuickPhase = QUICK_MODE_PHASES.find(p => parseInt(p) > parseInt(step));
      log('');
      log(`⊘ SKIP phase ${step} (Quick Mode: only [${QUICK_MODE_PHASES.join(',')}])`, 'yellow');
      if (nextQuickPhase) {
        log(`  → node task-pipe/runner.cjs --phase=BUILD --step=${nextQuickPhase} --story=${options.story} --quick`, 'dim');
      }
      log('');

      if (projectMemory) {
        try {
          projectMemory.recordEntry(options.target, {
            phase, step, story: options.story,
            iteration: options.iteration,
            verdict: 'PASS', signal: '@SKIP',
            summary: `Skipped phase ${step} (Quick Mode)`
          });
        } catch (e) { }
      }
      advanceState(options.target, options.iteration, phase, step, options.story);

      process.exit(0);
    }
  }

  // BUILD: 檢查 level gate
  if (phase === 'BUILD' && step) {
    if (!shouldExecutePhase(options.level, step, options.config)) {
      const nextPhase = getNextPhase(options.level, step, options.config);
      log('');
      log(`⊘ SKIP phase ${step} (Level ${options.level})`, 'yellow');
      if (nextPhase) {
        log(`  → node task-pipe/runner.cjs --phase=BUILD --step=${nextPhase} --story=${options.story}`, 'dim');
      }
      log('');

      if (projectMemory) {
        try {
          projectMemory.recordEntry(options.target, {
            phase, step, story: options.story,
            iteration: options.iteration,
            verdict: 'PASS', signal: '@SKIP',
            summary: `Skipped phase ${step} (Level ${options.level})`
          });
        } catch (e) { }
      }
      advanceState(options.target, options.iteration, phase, step, options.story);

      process.exit(0);
    }
  }

  // BUILD 用 phase-X.cjs，其他用 step-X.cjs
  const prefix = phase === 'BUILD' ? 'phase' : 'step';
  const stepFile = `${prefix}-${step}.cjs`;

  const scriptPath = step
    ? path.join(__dirname, 'phases', phaseLower, stepFile)
    : path.join(__dirname, 'phases', phaseLower, `${phaseLower}.cjs`);

  if (!fs.existsSync(scriptPath)) {
    log(`✗ Script not found: ${scriptPath}`, 'red');
    log(`  Check phase and step values`, 'yellow');
    process.exit(1);
  }

  // Dry-run 模式：預覽不執行
  if (options.dryRun) {
    runDryRun(phase, step, options, scriptPath);
    return;
  }

  // v3.1: 啟動時印出 @MEMORY（斷點續傳）
  if (projectMemory) {
    try {
      const resumeText = projectMemory.getResumeContext(options.target);
      if (resumeText) {
        log('');
        log(resumeText, 'dim');
        log('');
      }
    } catch (e) { /* 忽略 */ }
  }

  log('');
  log(`RUN ${phase}${step ? ` step ${step}` : ''}`, 'cyan');
  if (plainMode) {
    log(`  Level: ${options.level}`, 'dim');
  } else {
    log(`  Level: ${options.level} - ${getLevelDescription(options.level, options.config)}`, 'dim');
  }
  log(`  Target: ${options.target}`, 'dim');
  log('');

  // ============================================
  // 骨架產生器：在驗證前確保骨架存在
  // ============================================
  const scaffoldSteps = {
    'POC-1': true,   // requirement_draft
    'POC-3': true,   // contract  
    'POC-4': true,   // poc_html
    'POC-5': true,   // requirement_spec
    'PLAN-2': true,  // implementation_plan
    'PLAN-3': true,  // implementation_plan (驗證)
    // BUILD-7 移除：改由 phase-7.cjs 動態產生（含正確統計）
  };

  const scaffoldKey = `${phase}-${step}`;
  if (scaffoldSteps[scaffoldKey]) {
    log(`  [scaffold] ${scaffoldKey}...`, 'dim');

    const scaffoldResult = ensureScaffold(phase, step, {
      target: options.target,
      iteration: options.iteration,
      story: options.story,
      level: options.level
    });

    if (scaffoldResult.generated) {
      log(`  ✓ Generated: ${path.basename(scaffoldResult.path)}`, 'green');
    } else if (scaffoldResult.skipped && scaffoldResult.reason === 'File exists') {
      log(`  ⊘ Skipped (exists)`, 'dim');
    }

    log('');
  }

  try {
    const script = require(scriptPath);

    if (typeof script.run !== 'function') {
      log(`✗ Script missing run() function: ${scriptPath}`, 'red');
      process.exit(1);
    }

    // Token estimation: find latest log file
    function findLatestLog() {
      try {
        const logsDir = path.join(options.target, '.gems', 'iterations', options.iteration || 'iter-1', 'logs');
        if (!fs.existsSync(logsDir)) return null;
        const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log')).sort().reverse();
        return files.length > 0 ? path.join(logsDir, files[0]) : null;
      } catch (e) { return null; }
    }

    const result = script.run({
      phase,
      step,
      level: options.level,
      target: options.target,
      iteration: options.iteration,
      story: options.story,
      config,
    });

    log('');

    if (result.verdict === 'PASS') {
      log('✓ PASS', 'green');

      // v3.1: 記錄成功到 project-memory
      if (projectMemory) {
        try {
          projectMemory.recordEntry(options.target, {
            phase, step, story: options.story,
            iteration: options.iteration,
            verdict: 'PASS', signal: '@PASS',
            summary: `${phase} ${step} passed`,
            estimatedTokens: projectMemory.estimateTokens({ terminalChars: 200, logPath: findLatestLog(), projectRoot: options.target })
          });
        } catch (e) { /* 忽略 */ }
      }

      // 更新狀態並顯示下一步
      const next = advanceState(options.target, options.iteration, phase, step, options.story);
      if (next) {
        log('');
        log(`→ Next: ${next.phase} step ${next.step}`, 'cyan');
        const storyArg = options.story ? ` --story=${options.story}` : '';
        log(`  node task-pipe/runner.cjs --phase=${next.phase} --step=${next.step}${storyArg}`, 'dim');
      }
    } else if (result.verdict === 'BLOCKER' || result.verdict === 'PENDING' || result.verdict === 'READY_TO_PASS') {
      // v3.1: 記錄非 PASS 到 project-memory
      if (projectMemory) {
        try {
          projectMemory.recordEntry(options.target, {
            phase, step, story: options.story,
            iteration: options.iteration,
            verdict: result.verdict, signal: `@${result.verdict}`,
            summary: result.reason || `${phase} ${step} ${result.verdict}`,
            estimatedTokens: projectMemory.estimateTokens({ terminalChars: 500, logPath: findLatestLog(), projectRoot: options.target })
          });
        } catch (e) { /* 忽略 */ }
      }

      if (result.verdict === 'BLOCKER') {
        log('[ARCHITECTURE_REVIEW] 需要架構層級的審閱', 'yellow');
      } else if (result.verdict === 'PENDING') {
        log('[ITERATION_ADVICE] 完善中...', 'cyan');
      } else {
        log('[READY] 準備就緒，請確認後繼續', 'cyan');
      }

      // ============================================
      // [NEW] 建築模式引導注入 (Architectural Guidance)
      // ============================================
      const outputStr = result.output || '';
      const hasArchitecturalProposal = outputStr.includes('📐') || outputStr.includes('🏗️') || outputStr.includes('藍圖');

      if (hasArchitecturalProposal && options.ai) {
        log('');
        log('[ARCHITECTURAL PROPOSAL] 這是一份建築工法提案', 'magenta');
        log('  -> 請閱讀 Draft 中的族群與模組拆解', 'white');
        log('  -> 補充模組依賴與路由規劃', 'white');
        log('  -> 確認後將狀態改為 PASS', 'white');
      }
    } else {
      log('⚠ WARN', 'yellow');
    }

    log('');

    // Plain mode: 輸出結構化 JSON 供 IDE/AI 解析
    if (plainMode) {
      console.log('--- Final Verdict ---');
      console.log(JSON.stringify({
        verdict: result.verdict,
        phase,
        step,
        architectural: (result.output || '').includes('📐')
      }, null, 2));
    }

    // [NEW] 針對「啟動模式」或「準備就緒」的 PENDING 給予優雅退出
    const isSuccessVerdict = result.verdict === 'PASS' ||
      (result.verdict === 'PENDING' && result.reason === 'initial_startup') ||
      (result.verdict === 'PENDING' && (result.output || '').includes('🚀'));

    if (isSuccessVerdict) {
      log('✨ 流程交接就緒', 'green');
    }

    process.exit(isSuccessVerdict ? 0 : 1);
  } catch (err) {
    log('');
    log('✗ ERROR', 'red');
    log(`  ${err.message}`, 'red');

    // v3.1: 記錄 crash 到 project-memory
    if (projectMemory) {
      try {
        projectMemory.recordEntry(options.target, {
          phase, step, story: options.story,
          iteration: options.iteration,
          verdict: 'ERROR', signal: '@ERROR',
          summary: err.message.substring(0, 100),
          estimatedTokens: projectMemory.estimateTokens({ terminalChars: 300, logPath: findLatestLog(), projectRoot: options.target })
        });
      } catch (e) { /* 忽略 */ }
    }

    // v3.0: 記錄重試
    const retryInfo = recordRetry(options.target, options.iteration, phase, step, err.message);
    if (retryInfo.needsHuman) {
      log(`  🚨 已重試 ${retryInfo.count} 次，標記需要人工介入`, 'yellow');
    } else if (retryInfo.count > 0) {
      log(`  🔄 重試次數: ${retryInfo.count}/3`, 'yellow');
    }

    if (err.stack && !plainMode) {
      log('');
      log(err.stack, 'dim');
    }
    log('');
    process.exit(1);
  }
}

/**
 * Dry-run 模式：預覽將執行的動作
 */
function runDryRun(phase, step, options) {
  const { detectProjectType, getSrcDir } = require('./lib/project-type.cjs');

  log('', 'reset');
  log(separator(), 'magenta');
  log(`[DRY-RUN] Preview Mode`, 'bold');
  log(separator(), 'magenta');
  log(`   Phase: ${phase}${step ? ` Step ${step}` : ''}`, 'dim');
  log(`   Level: ${options.level} (${getLevelDescription(options.level, options.config)})`, 'dim');
  log(`   Target: ${options.target}`, 'dim');
  log(`   Story: ${options.story || '(not specified)'}`, 'dim');
  log(separator(), 'magenta');
  log('', 'reset');

  // 偵測專案資訊
  const { type: projectType, isGreenfield } = detectProjectType(options.target);
  const srcPath = getSrcDir(options.target, projectType);

  log(c('[INFO] Project Info:', 'cyan'));
  log(`   Type: ${projectType}`);
  log(`   Source: ${srcPath}`);
  log(`   Greenfield: ${isGreenfield ? 'Yes' : 'No'}`);
  log('', 'reset');

  // 根據 phase/step 顯示預期動作
  log(c('[INFO] Expected Actions:', 'cyan'));

  // v2.0: 從 registry 動態讀取 actions
  let actions = ['Execute phase script'];
  if (registryLoader) {
    try {
      actions = registryLoader.getStepActions(phase, step);
      const def = registryLoader.getStepDefinition(phase, step);
      if (def?.deprecated) {
        log(c(`   [DEPRECATED] ${def.deprecatedReason}`, 'yellow'));
      }
    } catch (e) {
      // Fallback 到舊的硬編碼
      actions = getFallbackActions(phase, step);
    }
  } else {
    actions = getFallbackActions(phase, step);
  }
  actions.forEach((action, i) => log(`   ${i + 1}. ${action}`));

  log('', 'reset');

  // 檢查可能的問題
  log(c('[WARN] Potential Issues:', 'yellow'));
  const issues = [];

  if (!fs.existsSync(srcPath)) {
    issues.push(`Source directory not found: ${srcPath}`);
  }

  if (phase === 'BUILD' && !options.story) {
    issues.push('Missing --story parameter');
  }

  if (phase === 'BUILD' && options.story) {
    const planFile = path.join(options.target, `.gems/iterations/${options.iteration}/plan/implementation_plan_${options.story}.md`);
    if (!fs.existsSync(planFile)) {
      issues.push(`Implementation plan not found: ${planFile}`);
    }
  }

  if (issues.length === 0) {
    log('   No obvious issues', 'green');
  } else {
    issues.forEach(issue => log(`   - ${issue}`, 'yellow'));
  }

  log('', 'reset');
  log(separator(), 'magenta');
  log(`[TIP] Remove --dry-run to execute: node task-pipe/runner.cjs --phase=${phase} --step=${step}${options.story ? ` --story=${options.story}` : ''}`, 'dim');
  log(separator(), 'magenta');
  log('', 'reset');

  process.exit(0);
}

// ============================================
// 主函式
// ============================================
function main() {
  const options = parseArgs();

  // 啟用 plain mode (必須在任何輸出之前設定)
  if (options.plain || options.ai) {
    plainMode = true;
  }

  // AI 模式：強制 UTF-8 輸出（避免重定向亂碼）
  if (options.ai && process.platform === 'win32') {
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    const originalStderrWrite = process.stderr.write.bind(process.stderr);

    process.stdout.write = function (chunk, encoding, callback) {
      if (typeof chunk === 'string') {
        chunk = Buffer.from(chunk, 'utf8');
      }
      return originalStdoutWrite(chunk, encoding, callback);
    };

    process.stderr.write = function (chunk, encoding, callback) {
      if (typeof chunk === 'string') {
        chunk = Buffer.from(chunk, 'utf8');
      }
      return originalStderrWrite(chunk, encoding, callback);
    };
  }

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // v3.0: 強制指令處理
  if (options.forceNextIteration || options.forceStartFrom || options.forceAbandon || options.diagnose) {
    handleForceCommands(options);
    return;
  }

  // 壓力測試模式
  if (options.stressTest) {
    const { runStressTest } = require('./lib/stress-test-runner.cjs');
    const result = runStressTest(options.stressTest, { target: options.target });
    process.exit(result.verdict === 'PASS' ? 0 : 1);
  }

  // v3.0: 自動偵測迭代
  let iteration = options.iteration;
  if (!iteration && stateManagerV3) {
    iteration = stateManagerV3.detectActiveIteration(options.target);
    log(`  Auto-detected iteration: ${iteration}`, 'dim');
  }
  iteration = iteration || 'iter-1';
  options.iteration = iteration;

  if (!options.phase) {
    // 🆕 自動偵測專案狀態
    const state = getCurrentState(options.target, iteration, options.story);

    log('');
    log(`DETECT project state`, 'cyan');
    log(`  Target: ${options.target}`, 'dim');
    log(`  Iteration: ${iteration}`, 'dim');
    log(`  Source: ${state.source === 'state_file' ? 'saved' : 'auto'}`, 'dim');
    log('');

    if (state.phase === 'COMPLETE' || state.phase === null) {
      log('✓ All phases complete', 'green');
      log(`  → node task-pipe/runner.cjs --phase=SCAN --target=${options.target}`, 'dim');
    } else {
      log(`→ Next: ${state.phase} step ${state.step}`, 'cyan');
      if (state.reason) {
        log(`  ${state.reason}`, 'dim');
      }
      log('');

      const storyArg = state.story ? ` --story=${state.story}` : '';
      log(`  node task-pipe/runner.cjs --phase=${state.phase} --step=${state.step}${storyArg}`, 'green');
    }

    log('');
    process.exit(0);
  }

  const validPhases = ['POC', 'PLAN', 'BUILD', 'SCAN'];
  if (!validPhases.includes(options.phase)) {
    log(`✗ Invalid phase: ${options.phase}`, 'red');
    log(`  Valid: ${validPhases.join(', ')}`, 'yellow');
    process.exit(1);
  }

  if (['POC', 'PLAN', 'BUILD'].includes(options.phase) && !options.step) {
    log(`✗ ${options.phase} requires --step parameter`, 'red');
    process.exit(1);
  }

  const config = loadConfig(options.config);
  runPhase(options.phase, options.step, options, config);
}

/**
 * v3.0: 處理強制指令
 */
function handleForceCommands(options) {
  if (!stateManagerV3) {
    log('❌ State Manager v3 not available', 'red');
    process.exit(1);
  }

  const target = options.target;

  if (options.diagnose) {
    // 診斷模式
    const forceCommands = require('./tools/force-commands.cjs');
    forceCommands.actionDiagnose({ target });
    return;
  }

  if (options.forceNextIteration) {
    const currentIter = stateManagerV3.detectActiveIteration(target);
    log(`\n🔄 強制跳到下一個迭代`, 'cyan');
    log(`   當前: ${currentIter}`, 'dim');

    const result = stateManagerV3.forceNextIteration(target, currentIter, {
      reason: 'Force via CLI --force-next-iteration'
    });

    log(`   ✅ 已跳轉到 ${result.newIteration}`, 'green');
    log(`   ${currentIter} 已標記為 ABANDONED`, 'dim');
    log(`\n下一步:`, 'cyan');
    log(`   node task-pipe/runner.cjs --phase=POC --step=1 --target=${target}`, 'dim');
    return;
  }

  if (options.forceStartFrom) {
    const iteration = options.iteration || stateManagerV3.detectActiveIteration(target);
    const startNode = options.forceStartFrom.toUpperCase();

    log(`\n🔄 強制從 ${startNode} 開始`, 'cyan');
    log(`   迭代: ${iteration}`, 'dim');

    stateManagerV3.forceStartFrom(target, iteration, startNode);

    const { phase, step } = stateManagerV3.parseNode(startNode);
    log(`   ✅ 已設定入口點`, 'green');
    log(`\n下一步:`, 'cyan');
    log(`   node task-pipe/runner.cjs --phase=${phase} --step=${step} --target=${target}`, 'dim');
    return;
  }

  if (options.forceAbandon) {
    const iteration = options.iteration || stateManagerV3.detectActiveIteration(target);

    log(`\n🔄 標記 ${iteration} 為 ABANDONED`, 'cyan');

    stateManagerV3.abandonIteration(target, iteration, 'Force via CLI --force-abandon');

    log(`   ✅ 已標記`, 'green');
    return;
  }
}

// ============================================
// 執行
// ============================================
if (require.main === module) {
  main();
}

module.exports = { parseArgs, loadConfig, runPhase };
