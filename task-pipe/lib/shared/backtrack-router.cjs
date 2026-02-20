#!/usr/bin/env node
/**
 * Backtrack Router v1.0 - 遞迴回溯 (Recursive Backtracking)
 * 
 * 核心功能：
 * 1. 根據失敗類型決定回溯目標
 * 2. 注入失敗記憶到回溯步驟
 * 3. 支援精確回溯 (不需從頭來)
 * 
 * 失敗類型 → 回溯目標：
 * - 標籤缺失 → BUILD Phase 2
 * - 測試失敗 → BUILD Phase 3-5
 * - 整合失敗 → BUILD Phase 6-7
 * - 架構問題 → PLAN Step 2-3
 */

const fs = require('fs');
const path = require('path');

// ============================================
// 失敗類型定義
// ============================================

const FAILURE_TYPES = {
  // 標籤相關
  MISSING_TAGS: {
    code: 'F001',
    name: '缺少 GEMS 標籤',
    backtrackTo: { phase: 'BUILD', step: '2' },
    severity: 'HIGH',
    autoFix: true
  },
  MISSING_FLOW: {
    code: 'F002',
    name: '缺少 GEMS-FLOW (P0/P1)',
    backtrackTo: { phase: 'BUILD', step: '2' },
    severity: 'HIGH',
    autoFix: true
  },
  MISSING_STEP_ANCHOR: {
    code: 'F003',
    name: '缺少 [STEP] 錨點',
    backtrackTo: { phase: 'BUILD', step: '2' },
    severity: 'MEDIUM',
    autoFix: true
  },

  // 測試相關
  TEST_NOT_FOUND: {
    code: 'F010',
    name: '測試檔案不存在',
    backtrackTo: { phase: 'BUILD', step: '3' },
    severity: 'HIGH',
    autoFix: true
  },
  TEST_IMPORT_FAIL: {
    code: 'F011',
    name: '測試未 import 被測函式',
    backtrackTo: { phase: 'BUILD', step: '4' },
    severity: 'HIGH',
    autoFix: true
  },
  TEST_FAIL: {
    code: 'F012',
    name: '測試執行失敗',
    backtrackTo: { phase: 'BUILD', step: '5' },
    severity: 'HIGH',
    autoFix: false
  },

  // 整合相關
  BROKEN_IMPORT: {
    code: 'F020',
    name: '無效的 import',
    backtrackTo: { phase: 'BUILD', step: '6' },
    severity: 'HIGH',
    autoFix: true
  },
  INTEGRATION_FAIL: {
    code: 'F021',
    name: '整合測試失敗',
    backtrackTo: { phase: 'BUILD', step: '6' },
    severity: 'HIGH',
    autoFix: false
  },
  ROUTE_NOT_REGISTERED: {
    code: 'F022',
    name: '路由未註冊',
    backtrackTo: { phase: 'BUILD', step: '7' },
    severity: 'MEDIUM',
    autoFix: true
  },

  // 架構相關
  SPEC_MISMATCH: {
    code: 'F030',
    name: '實作與規格不符',
    backtrackTo: { phase: 'PLAN', step: '2' },
    severity: 'CRITICAL',
    autoFix: false
  },
  ARCHITECTURE_VIOLATION: {
    code: 'F031',
    name: '違反架構約束',
    backtrackTo: { phase: 'PLAN', step: '3' },
    severity: 'CRITICAL',
    autoFix: false
  },
  STORY_SCOPE_CREEP: {
    code: 'F032',
    name: 'Story 範圍蔓延',
    backtrackTo: { phase: 'PLAN', step: '1' },
    severity: 'CRITICAL',
    autoFix: false
  }
};

// ============================================
// 回溯路由
// ============================================

/**
 * 分析失敗並決定回溯目標
 * @param {Object[]} failures - 失敗列表
 * @returns {Object} 回溯建議
 */
function analyzeAndRoute(failures) {
  if (!failures || failures.length === 0) {
    return {
      needsBacktrack: false,
      message: '沒有失敗需要處理'
    };
  }

  // 分類失敗
  const categorized = {
    tags: [],
    tests: [],
    integration: [],
    architecture: []
  };

  for (const failure of failures) {
    const failureType = identifyFailureType(failure);
    if (!failureType) continue;

    const category = getFailureCategory(failureType.code);
    if (categorized[category]) {
      categorized[category].push({
        ...failure,
        type: failureType
      });
    }
  }

  // 決定回溯目標 (優先處理最嚴重的)
  const backtrackTarget = determineBacktrackTarget(categorized);

  return {
    needsBacktrack: true,
    target: backtrackTarget,
    categorized,
    summary: generateBacktrackSummary(categorized, backtrackTarget)
  };
}

/**
 * 識別失敗類型
 */
function identifyFailureType(failure) {
  const message = (failure.message || failure.msg || '').toLowerCase();
  const type = failure.type || '';

  // 標籤相關
  if (message.includes('missing') && message.includes('gems')) {
    return FAILURE_TYPES.MISSING_TAGS;
  }
  if (message.includes('gems-flow') || (message.includes('flow') && message.includes('p0'))) {
    return FAILURE_TYPES.MISSING_FLOW;
  }
  if (message.includes('[step]') || message.includes('step anchor')) {
    return FAILURE_TYPES.MISSING_STEP_ANCHOR;
  }

  // 測試相關
  if (message.includes('test') && message.includes('not found')) {
    return FAILURE_TYPES.TEST_NOT_FOUND;
  }
  if (message.includes('import') && message.includes('test')) {
    return FAILURE_TYPES.TEST_IMPORT_FAIL;
  }
  if (type === 'TEST_FAIL' || message.includes('test fail')) {
    return FAILURE_TYPES.TEST_FAIL;
  }

  // 整合相關
  if (message.includes('import') && (message.includes('invalid') || message.includes('broken'))) {
    return FAILURE_TYPES.BROKEN_IMPORT;
  }
  if (message.includes('integration') && message.includes('fail')) {
    return FAILURE_TYPES.INTEGRATION_FAIL;
  }
  if (message.includes('route') && message.includes('not')) {
    return FAILURE_TYPES.ROUTE_NOT_REGISTERED;
  }

  // 架構相關
  if (message.includes('spec') && message.includes('mismatch')) {
    return FAILURE_TYPES.SPEC_MISMATCH;
  }
  if (message.includes('architecture') || message.includes('violation')) {
    return FAILURE_TYPES.ARCHITECTURE_VIOLATION;
  }
  if (message.includes('scope') && message.includes('creep')) {
    return FAILURE_TYPES.STORY_SCOPE_CREEP;
  }

  // 預設
  return null;
}

/**
 * 取得失敗類別
 */
function getFailureCategory(code) {
  if (code.startsWith('F00')) return 'tags';
  if (code.startsWith('F01')) return 'tests';
  if (code.startsWith('F02')) return 'integration';
  if (code.startsWith('F03')) return 'architecture';
  return 'unknown';
}

/**
 * 決定回溯目標
 */
function determineBacktrackTarget(categorized) {
  // 優先級: architecture > integration > tests > tags
  if (categorized.architecture.length > 0) {
    return findEarliestBacktrack(categorized.architecture);
  }
  if (categorized.integration.length > 0) {
    return findEarliestBacktrack(categorized.integration);
  }
  if (categorized.tests.length > 0) {
    return findEarliestBacktrack(categorized.tests);
  }
  if (categorized.tags.length > 0) {
    return findEarliestBacktrack(categorized.tags);
  }
  return null;
}

/**
 * 找最早的回溯點
 */
function findEarliestBacktrack(failures) {
  const phaseOrder = { POC: 0, PLAN: 1, BUILD: 2, SCAN: 3 };
  
  let earliest = null;
  let earliestScore = Infinity;

  for (const failure of failures) {
    const target = failure.type.backtrackTo;
    const score = phaseOrder[target.phase] * 100 + parseInt(target.step);
    
    if (score < earliestScore) {
      earliestScore = score;
      earliest = {
        phase: target.phase,
        step: target.step,
        reason: failure.type.name,
        failures: [failure]
      };
    } else if (score === earliestScore) {
      earliest.failures.push(failure);
    }
  }

  return earliest;
}

// ============================================
// 記憶注入
// ============================================

/**
 * 產生回溯時的記憶注入
 */
function generateMemoryInjection(backtrackResult, originalContext = {}) {
  if (!backtrackResult.needsBacktrack || !backtrackResult.target) {
    return null;
  }

  const target = backtrackResult.target;
  const failures = target.failures || [];

  return {
    type: 'BACKTRACK_MEMORY',
    generatedAt: new Date().toISOString(),
    source: {
      phase: originalContext.phase || 'BUILD',
      step: originalContext.step || '8',
      storyId: originalContext.storyId
    },
    target: {
      phase: target.phase,
      step: target.step
    },
    failureSummary: {
      reason: target.reason,
      count: failures.length,
      details: failures.map(f => ({
        file: f.file,
        line: f.line,
        message: f.message || f.msg,
        type: f.type?.code
      }))
    },
    fixGuidance: generateFixGuidance(target, failures),
    priorityItems: failures.slice(0, 5).map(f => ({
      file: f.file,
      action: f.type?.autoFix ? 'AUTO_FIX' : 'MANUAL_FIX',
      hint: getFixHint(f.type)
    }))
  };
}

/**
 * 產生修復指引
 */
function generateFixGuidance(target, failures) {
  const guidance = { phase: target.phase, step: target.step, focus: [], avoid: [] };

  switch (`${target.phase}-${target.step}`) {
    case 'BUILD-2':
      guidance.focus = ['檢查所有函式是否有 GEMS 標籤', 'P0/P1 函式必須有 GEMS-FLOW', '確保 [STEP] 錨點與 FLOW 對應'];
      guidance.avoid = ['不要跳過標籤驗證', '不要使用不完整的標籤'];
      break;
    case 'BUILD-3':
    case 'BUILD-4':
    case 'BUILD-5':
      guidance.focus = ['確保測試檔案存在', '測試必須 import 被測函式', '測試案例要覆蓋主要路徑'];
      guidance.avoid = ['不要寫空的測試', '不要跳過失敗的測試'];
      break;
    case 'BUILD-6':
    case 'BUILD-7':
      guidance.focus = ['檢查所有 import 路徑', '確保模組正確匯出', '驗證路由註冊'];
      guidance.avoid = ['不要使用相對路徑錯誤', '不要遺漏 export'];
      break;
    case 'PLAN-2':
    case 'PLAN-3':
      guidance.focus = ['重新審視 Story 規格', '檢查依賴關係是否正確', '確認技術選型合適'];
      guidance.avoid = ['不要在錯誤的基礎上繼續', '不要忽略架構約束'];
      break;
  }

  return guidance;
}

/**
 * 取得修復提示
 */
function getFixHint(failureType) {
  if (!failureType) return '檢查並修復問題';
  const hints = {
    F001: '為函式添加 GEMS 標籤', F002: '為 P0/P1 函式添加 GEMS-FLOW', F003: '添加 [STEP] 錨點對應 FLOW',
    F010: '建立測試檔案', F011: '在測試中 import 被測函式', F012: '修復失敗的測試案例',
    F020: '修正 import 路徑', F021: '修復整合測試', F022: '註冊路由',
    F030: '調整實作以符合規格', F031: '修正架構違規', F032: '縮小 Story 範圍'
  };
  return hints[failureType.code] || '檢查並修復問題';
}

// ============================================
// 回溯執行
// ============================================

function generateBacktrackCommand(backtrackResult, options = {}) {
  if (!backtrackResult.needsBacktrack || !backtrackResult.target) return null;

  const { projectRoot = '.', iteration = 'iter-1', storyId = null } = options;
  const target = backtrackResult.target;

  let command = `node task-pipe/runner.cjs --phase=${target.phase} --step=${target.step} --target=${projectRoot}`;
  if (iteration) command += ` --iteration=${iteration}`;
  if (storyId) command += ` --story=${storyId}`;
  command += ` --focus="${target.reason}"`;

  return { command, phase: target.phase, step: target.step, reason: target.reason };
}

function saveBacktrackMemory(projectRoot, iteration, memory) {
  const memoryDir = path.join(projectRoot, '.gems/iterations', iteration, 'logs');
  const memoryFile = path.join(memoryDir, `backtrack-memory-${Date.now()}.json`);

  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }

  fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2), 'utf8');
  return memoryFile;
}

function loadLatestBacktrackMemory(projectRoot, iteration) {
  const memoryDir = path.join(projectRoot, '.gems/iterations', iteration, 'logs');
  if (!fs.existsSync(memoryDir)) return null;

  const files = fs.readdirSync(memoryDir).filter(f => f.startsWith('backtrack-memory-')).sort().reverse();
  if (files.length === 0) return null;

  return JSON.parse(fs.readFileSync(path.join(memoryDir, files[0]), 'utf8'));
}

// ============================================
// 報告產生
// ============================================

function generateBacktrackSummary(categorized, target) {
  const counts = {
    tags: categorized.tags.length,
    tests: categorized.tests.length,
    integration: categorized.integration.length,
    architecture: categorized.architecture.length
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    totalFailures: total,
    byCategory: counts,
    backtrackTo: target ? `${target.phase}-${target.step}` : null,
    reason: target?.reason || null
  };
}

function generateBacktrackReport(backtrackResult, memory = null) {
  if (!backtrackResult.needsBacktrack) {
    return `@BACKTRACK_CHECK\n### ✓ 不需要回溯\n所有檢查通過，可以繼續下一步。\n`;
  }

  const target = backtrackResult.target;
  const summary = backtrackResult.summary;

  let report = `@BACKTRACK_REQUIRED
### ⏪ 需要回溯到 ${target.phase} Phase ${target.step}

**原因**: ${target.reason}
**失敗統計**: ${summary.totalFailures} 個問題
- 標籤: ${summary.byCategory.tags}
- 測試: ${summary.byCategory.tests}
- 整合: ${summary.byCategory.integration}
- 架構: ${summary.byCategory.architecture}

**回溯目標**: ${target.phase}-${target.step}
`;

  if (memory) {
    report += `
**記憶注入**:
- 來源: ${memory.source.phase}-${memory.source.step}
- 失敗數: ${memory.failureSummary.count}

**修復指引**:
${memory.fixGuidance.focus.map(f => `- ${f}`).join('\n')}

**優先處理**:
${memory.priorityItems.slice(0, 3).map(i => `- [${i.action}] ${i.file}: ${i.hint}`).join('\n')}
`;
  }

  report += `
**執行指令**:
\`\`\`bash
RE_RUN --phase=${target.phase} --step=${target.step} --focus="${target.reason}"
\`\`\`
`;

  return report;
}

// ============================================
// CLI
// ============================================

if (require.main === module) {
  const args = process.argv.slice(2);
  let projectRoot = process.cwd();
  let iteration = 'iter-1';
  let failuresJson = null;
  let action = 'analyze';

  for (const arg of args) {
    if (arg.startsWith('--project=')) projectRoot = arg.split('=')[1];
    else if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
    else if (arg.startsWith('--failures=')) failuresJson = arg.split('=')[1];
    else if (arg.startsWith('--action=')) action = arg.split('=')[1];
  }

  console.log(`\n⏪ Backtrack Router v1.0`);
  console.log(`   Action: ${action}`);

  switch (action) {
    case 'analyze':
      if (!failuresJson) {
        const demoFailures = [
          { message: 'Missing GEMS-FLOW for P0 function', file: 'src/auth.ts', line: 42 },
          { message: 'Test file not found', file: 'src/user.ts' }
        ];
        const result = analyzeAndRoute(demoFailures);
        const memory = generateMemoryInjection(result, { phase: 'BUILD', step: '8' });
        console.log(generateBacktrackReport(result, memory));
      } else {
        const failures = JSON.parse(fs.readFileSync(failuresJson, 'utf8'));
        const result = analyzeAndRoute(failures);
        const memory = generateMemoryInjection(result);
        console.log(generateBacktrackReport(result, memory));
      }
      break;
    case 'load':
      const loaded = loadLatestBacktrackMemory(projectRoot, iteration);
      if (loaded) {
        console.log(`\n📖 載入回溯記憶:`);
        console.log(`   來源: ${loaded.source.phase}-${loaded.source.step}`);
        console.log(`   目標: ${loaded.target.phase}-${loaded.target.step}`);
        console.log(`   原因: ${loaded.failureSummary.reason}`);
      } else {
        console.log(`\n沒有找到回溯記憶`);
      }
      break;
  }

  console.log(`
用法:
  node backtrack-router.cjs [options]

參數:
  --project=<path>      專案根目錄 (預設: cwd)
  --iteration=<iter>    迭代編號 (預設: iter-1)
  --failures=<json>     失敗列表 JSON 檔案
  --action=<action>     動作: analyze | load

範例:
  node backtrack-router.cjs --failures=failures.json
  node backtrack-router.cjs --action=load --iteration=iter-2
`);
}

module.exports = {
  FAILURE_TYPES,
  analyzeAndRoute,
  identifyFailureType,
  generateMemoryInjection,
  generateBacktrackCommand,
  saveBacktrackMemory,
  loadLatestBacktrackMemory,
  generateBacktrackReport
};
