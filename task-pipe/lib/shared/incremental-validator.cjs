#!/usr/bin/env node
/**
 * Incremental Validator v1.0 - 增量驗證器
 * 
 * 核心功能：
 * 1. 只驗證被修改的檔案 + 受影響範圍
 * 2. 根據當前 Phase 決定驗證深度
 * 3. 產生精確的修復指引
 * 
 * 驗證類型：
 * - tags: GEMS 標籤完整性
 * - tests: 相關測試是否通過
 * - integration: 整合點是否正常
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 引入染色分析 (同目錄)
const { buildDependencyGraph, analyzeImpact, generateValidationQueue } = require('./taint-analyzer.cjs');

// ============================================
// 驗證結果結構
// ============================================

function createValidationResult() {
  return {
    timestamp: new Date().toISOString(),
    status: 'PENDING',  // PASS | FAIL | PARTIAL
    tags: { status: 'PENDING', issues: [] },
    tests: { status: 'PENDING', issues: [] },
    integration: { status: 'PENDING', issues: [] },
    summary: {
      totalChecks: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    },
    actionRequired: []
  };
}

// ============================================
// 標籤驗證
// ============================================

/**
 * 驗證單一檔案的 GEMS 標籤
 */
function validateFileTags(filePath) {
  const issues = [];

  if (!fs.existsSync(filePath)) {
    return { status: 'SKIP', issues: [`檔案不存在: ${filePath}`] };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // 找所有函式
  const funcPattern = /(?:export\s+)?(?:async\s+)?(?:function|const)\s+(\w+)/g;
  let match;

  while ((match = funcPattern.exec(content)) !== null) {
    const funcName = match[1];
    const funcLine = content.substring(0, match.index).split('\n').length;

    // 往上找 GEMS 標籤
    let hasGems = false;
    let hasPriority = false;
    let hasFlow = false;

    for (let i = funcLine - 2; i >= Math.max(0, funcLine - 20); i--) {
      const line = lines[i] || '';
      if (line.includes('GEMS:')) hasGems = true;
      if (line.match(/P[0-3]/)) hasPriority = true;
      if (line.includes('GEMS-FLOW:')) hasFlow = true;
      
      // 遇到非註解行停止
      if (!line.trim().startsWith('*') && !line.trim().startsWith('//') && !line.trim().startsWith('/*') && line.trim() !== '') {
        break;
      }
    }

    // P0/P1 必須有 FLOW
    if (hasGems && hasPriority) {
      const priorityMatch = content.substring(Math.max(0, match.index - 500), match.index).match(/P([0-3])/);
      if (priorityMatch && ['0', '1'].includes(priorityMatch[1]) && !hasFlow) {
        issues.push({
          type: 'MISSING_FLOW',
          func: funcName,
          line: funcLine,
          message: `${funcName} (P${priorityMatch[1]}) 缺少 GEMS-FLOW`
        });
      }
    }

    // 檢查是否完全沒有標籤 (只警告，不阻擋)
    if (!hasGems && funcName[0] === funcName[0].toUpperCase()) {
      // 可能是 React 元件，跳過
    } else if (!hasGems && !funcName.startsWith('_')) {
      // 非私有函式沒有標籤
      issues.push({
        type: 'NO_TAGS',
        func: funcName,
        line: funcLine,
        message: `${funcName} 沒有 GEMS 標籤`,
        severity: 'WARN'
      });
    }
  }

  const errors = issues.filter(i => i.severity !== 'WARN');
  return {
    status: errors.length > 0 ? 'FAIL' : 'PASS',
    issues
  };
}

/**
 * 批量驗證標籤
 */
function validateTags(files) {
  const result = { status: 'PASS', issues: [], details: {} };

  for (const file of files) {
    const fileResult = validateFileTags(file);
    result.details[file] = fileResult;

    if (fileResult.status === 'FAIL') {
      result.status = 'FAIL';
    }

    result.issues.push(...fileResult.issues.map(i => ({
      ...i,
      file
    })));
  }

  return result;
}

// ============================================
// 測試驗證
// ============================================

/**
 * 找檔案對應的測試檔
 */
function findTestFile(sourceFile) {
  const dir = path.dirname(sourceFile);
  const base = path.basename(sourceFile, path.extname(sourceFile));
  const ext = path.extname(sourceFile);

  const candidates = [
    path.join(dir, '__tests__', `${base}.test${ext}`),
    path.join(dir, '__tests__', `${base}.spec${ext}`),
    path.join(dir, `${base}.test${ext}`),
    path.join(dir, `${base}.spec${ext}`)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * 執行相關測試
 */
function runRelatedTests(files, projectRoot) {
  const result = { status: 'PASS', issues: [], testFiles: [] };

  // 找所有測試檔
  const testFiles = new Set();
  for (const file of files) {
    const testFile = findTestFile(path.join(projectRoot, file));
    if (testFile) {
      testFiles.add(path.relative(projectRoot, testFile));
    }
  }

  result.testFiles = Array.from(testFiles);

  if (testFiles.size === 0) {
    result.status = 'SKIP';
    result.issues.push({ type: 'NO_TESTS', message: '沒有找到相關測試檔' });
    return result;
  }

  // 執行測試
  try {
    const testPattern = Array.from(testFiles).join(' ');
    const cmd = `npm test -- --passWithNoTests ${testPattern}`;
    
    execSync(cmd, {
      cwd: projectRoot,
      stdio: 'pipe',
      timeout: 60000
    });

    result.status = 'PASS';
  } catch (error) {
    result.status = 'FAIL';
    result.issues.push({
      type: 'TEST_FAIL',
      message: error.message,
      output: error.stdout?.toString() || error.stderr?.toString()
    });
  }

  return result;
}

// ============================================
// 整合驗證
// ============================================

/**
 * 驗證整合點
 */
function validateIntegration(files, projectRoot) {
  const result = { status: 'PASS', issues: [] };

  for (const file of files) {
    const fullPath = path.join(projectRoot, file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');

    // 檢查 import 是否有效
    const importPattern = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importPattern.exec(content)) !== null) {
      const importPath = match[1];
      
      // 跳過 node_modules
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        continue;
      }

      // 解析相對路徑
      const resolvedPath = path.resolve(path.dirname(fullPath), importPath);
      const candidates = [
        resolvedPath,
        `${resolvedPath}.ts`,
        `${resolvedPath}.tsx`,
        `${resolvedPath}.js`,
        `${resolvedPath}/index.ts`,
        `${resolvedPath}/index.js`
      ];

      const exists = candidates.some(c => fs.existsSync(c));
      if (!exists) {
        result.status = 'FAIL';
        result.issues.push({
          type: 'BROKEN_IMPORT',
          file,
          import: importPath,
          message: `無效的 import: ${importPath}`
        });
      }
    }
  }

  return result;
}

// ============================================
// 主驗證函式
// ============================================

/**
 * 執行增量驗證
 * @param {string[]} changedFiles - 被修改的檔案
 * @param {Object} options - 選項
 */
function validateChanges(changedFiles, options = {}) {
  const {
    projectRoot = process.cwd(),
    currentPhase = 8,  // BUILD phase 編號
    functionsJson = null,
    skipTests = false,
    skipIntegration = false
  } = options;

  const result = createValidationResult();

  // 1. 如果有 functions.json，使用染色分析擴展範圍
  let filesToValidate = [...changedFiles];

  if (functionsJson && fs.existsSync(functionsJson)) {
    const graph = buildDependencyGraph(functionsJson);
    const impact = analyzeImpact(graph, changedFiles, { maxDepth: 2 });
    filesToValidate = impact.affectedFiles;
    // validationQueue 可用於更精細的控制，目前先不使用
    // const validationQueue = generateValidationQueue(impact);
  }

  // 2. 標籤驗證 (永遠做)
  result.tags = validateTags(filesToValidate.map(f => path.join(projectRoot, f)));
  result.summary.totalChecks++;
  if (result.tags.status === 'PASS') result.summary.passed++;
  else if (result.tags.status === 'FAIL') result.summary.failed++;
  else result.summary.skipped++;

  // 3. 測試驗證 (Phase 5+)
  if (currentPhase >= 5 && !skipTests) {
    result.tests = runRelatedTests(filesToValidate, projectRoot);
    result.summary.totalChecks++;
    if (result.tests.status === 'PASS') result.summary.passed++;
    else if (result.tests.status === 'FAIL') result.summary.failed++;
    else result.summary.skipped++;
  } else {
    result.tests.status = 'SKIP';
    result.tests.issues.push({ type: 'SKIPPED', message: `Phase ${currentPhase} < 5，跳過測試` });
  }

  // 4. 整合驗證 (Phase 7+)
  if (currentPhase >= 7 && !skipIntegration) {
    result.integration = validateIntegration(filesToValidate, projectRoot);
    result.summary.totalChecks++;
    if (result.integration.status === 'PASS') result.summary.passed++;
    else if (result.integration.status === 'FAIL') result.summary.failed++;
    else result.summary.skipped++;
  } else {
    result.integration.status = 'SKIP';
    result.integration.issues.push({ type: 'SKIPPED', message: `Phase ${currentPhase} < 7，跳過整合` });
  }

  // 5. 彙整狀態
  if (result.summary.failed > 0) {
    result.status = 'FAIL';
  } else if (result.summary.passed === result.summary.totalChecks) {
    result.status = 'PASS';
  } else {
    result.status = 'PARTIAL';
  }

  // 6. 產生行動建議
  result.actionRequired = generateActionRequired(result);

  return result;
}

/**
 * 產生行動建議
 */
function generateActionRequired(result) {
  const actions = [];

  // 標籤問題
  const tagErrors = result.tags.issues.filter(i => i.severity !== 'WARN');
  if (tagErrors.length > 0) {
    actions.push({
      type: 'FIX_TAGS',
      priority: 'HIGH',
      scope: 'Phase 2',
      items: tagErrors.map(i => `${i.file}:${i.line} - ${i.message}`)
    });
  }

  // 測試問題
  if (result.tests.status === 'FAIL') {
    actions.push({
      type: 'FIX_TESTS',
      priority: 'HIGH',
      scope: 'Phase 5',
      items: result.tests.issues.map(i => i.message)
    });
  }

  // 整合問題
  if (result.integration.status === 'FAIL') {
    actions.push({
      type: 'FIX_INTEGRATION',
      priority: 'MEDIUM',
      scope: 'Phase 7',
      items: result.integration.issues.map(i => i.message)
    });
  }

  return actions;
}

/**
 * 產生 AI 可讀的驗證報告
 */
function generateValidationReport(result) {
  const statusEmoji = {
    PASS: '✓',
    FAIL: '✗',
    PARTIAL: '⚠',
    SKIP: '-',
    PENDING: '?'
  };

  let report = `@INCREMENTAL_CHECK
### 增量驗證結果

**整體狀態**: ${statusEmoji[result.status]} ${result.status}

**驗證項目**:
├── Tags: ${statusEmoji[result.tags.status]} ${result.tags.status}
├── Tests: ${statusEmoji[result.tests.status]} ${result.tests.status}
└── Integration: ${statusEmoji[result.integration.status]} ${result.integration.status}

**統計**: ${result.summary.passed}/${result.summary.totalChecks} 通過
`;

  if (result.actionRequired.length > 0) {
    report += `
**@ACTION_REQUIRED**:
`;
    for (const action of result.actionRequired) {
      report += `\n[${action.priority}] ${action.type} (回溯: ${action.scope})\n`;
      action.items.slice(0, 5).forEach(item => {
        report += `  - ${item}\n`;
      });
      if (action.items.length > 5) {
        report += `  ... 還有 ${action.items.length - 5} 項\n`;
      }
    }
  }

  return report;
}

// ============================================
// CLI
// ============================================

if (require.main === module) {
  const args = process.argv.slice(2);

  let changedFiles = [];
  let projectRoot = process.cwd();
  let currentPhase = 8;
  let functionsJson = null;

  for (const arg of args) {
    if (arg.startsWith('--changed=')) {
      changedFiles = arg.split('=')[1].split(',');
    } else if (arg.startsWith('--project=')) {
      projectRoot = arg.split('=')[1];
    } else if (arg.startsWith('--phase=')) {
      currentPhase = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--functions=')) {
      functionsJson = arg.split('=')[1];
    }
  }

  if (changedFiles.length === 0) {
    console.log(`
🔍 Incremental Validator v1.0 - 增量驗證器

用法:
  node incremental-validator.cjs --changed=<files> [options]

參數:
  --changed=<files>     被修改的檔案 (逗號分隔)
  --project=<path>      專案根目錄 (預設: cwd)
  --phase=<N>           當前 BUILD phase (預設: 8)
  --functions=<path>    functions.json 路徑 (啟用染色分析)

範例:
  node incremental-validator.cjs --changed=src/auth.ts,src/user.ts --phase=5
`);
    process.exit(0);
  }

  console.log(`\n🔍 Incremental Validator v1.0`);
  console.log(`   Changed: ${changedFiles.join(', ')}`);
  console.log(`   Phase: ${currentPhase}`);

  const result = validateChanges(changedFiles, {
    projectRoot,
    currentPhase,
    functionsJson
  });

  console.log(generateValidationReport(result));

  // 輸出 JSON (供其他工具使用)
  if (args.includes('--json')) {
    console.log('\n--- JSON Output ---');
    console.log(JSON.stringify(result, null, 2));
  }

  process.exit(result.status === 'PASS' ? 0 : 1);
}

module.exports = {
  validateChanges,
  validateFileTags,
  validateTags,
  runRelatedTests,
  validateIntegration,
  generateValidationReport,
  createValidationResult
};
