#!/usr/bin/env node
/**
 * GEMS Validator v2.0 - 輕量版標籤驗證器
 * 使用統一的 gems-patterns 模組進行標籤解析
 * 用於 task-pipe BUILD Phase 4/5
 * 
 * v2.0 變更：
 * - 改用 gems-patterns.cjs 共用模組
 * - 統一 Scanner 和 Validator 的解析邏輯
 * - 寬鬆格式、嚴格內容
 */
const fs = require('fs');
const path = require('path');

// 使用統一的 GEMS 標籤解析模組
const gemsPatterns = require('./gems-patterns.cjs');
const {
  GEMS_BASIC_PATTERN,
  GEMS_EXTENDED_PATTERNS,
  extractGEMSTags: extractTagsFromPatterns,
  cleanString
} = gemsPatterns;

// 為向後相容，保留舊的 GEMS_PATTERNS 結構
const GEMS_PATTERNS = {
  basic: GEMS_BASIC_PATTERN,
  basicSingleLine: GEMS_BASIC_PATTERN,  // 統一正則已支援兩種格式
  flow: GEMS_EXTENDED_PATTERNS.flow,
  flowSingleLine: GEMS_EXTENDED_PATTERNS.flow,
  deps: GEMS_EXTENDED_PATTERNS.deps,
  depsSingleLine: GEMS_EXTENDED_PATTERNS.deps,
  depsRisk: GEMS_EXTENDED_PATTERNS.depsRisk,
  depsRiskSingleLine: GEMS_EXTENDED_PATTERNS.depsRisk,
  test: GEMS_EXTENDED_PATTERNS.test,
  testSingleLine: GEMS_EXTENDED_PATTERNS.test,
  testFile: GEMS_EXTENDED_PATTERNS.testFile,
  testFileSingleLine: GEMS_EXTENDED_PATTERNS.testFile
};

// 假實作偵測模式
const FRAUD_PATTERNS = [
  { pattern: /throw new Error\(\s*['"`]TODO[^)]*\)/gi, name: 'TODO error' },
  { pattern: /\/\/\s*TODO:/g, name: 'TODO comment' },
  { pattern: /throw new Error\([^)]*not implemented[^)]*\)/gi, name: 'not implemented' }
];

// v3.1: 無效 assertion 偵測模式 - 用於偵測假的 Integration/E2E 測試
const WEAK_ASSERTION_PATTERNS = [
  { pattern: /expect\([^)]+\)\.toBeDefined\(\)/g, name: 'toBeDefined() 不驗證實際行為' },
  { pattern: /expect\([^)]+\)\.not\.toBeUndefined\(\)/g, name: 'not.toBeUndefined() 不驗證實際行為' },
  { pattern: /expect\([^)]+\)\.toBeTruthy\(\)\s*;?\s*\}/g, name: '只有 toBeTruthy() 的弱驗證' },
];

// v3.1: 真實 Integration 測試必須包含的有效 assertion
const VALID_INTEGRATION_ASSERTIONS = [
  /expect\([^)]+\)\.toHaveBeenCalledWith\(/,     // 驗證被呼叫的參數
  /expect\([^)]+\)\.toBe\([^)]+\)/,              // 精確比對
  /expect\([^)]+\)\.toEqual\([^)]+\)/,           // 深度比對
  /expect\([^)]+\)\.toContain\(/,                // 包含檢查
  /expect\([^)]+\)\.toHaveLength\(/,             // 長度檢查
  /expect\([^)]+\)\.toMatchObject\(/,            // 物件匹配
  /expect\([^)]+\)\.toHaveBeenCalled\(\)/,       // 至少驗證有呼叫
  /expect\([^)]+\)\.toThrow\(/,                  // 錯誤處理
];

/**
 * 掃描源碼目錄，提取所有 GEMS 標籤
 * @param {string} srcDir - 源碼目錄
 * @returns {object} { functions: [], stats: {} }
 */
function scanGemsTags(srcDir) {
  const result = {
    functions: [],
    stats: { total: 0, tagged: 0, p0: 0, p1: 0, p2: 0, p3: 0 }
  };

  const files = findSourceFiles(srcDir);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(process.cwd(), file);
    const lines = content.split('\n');

    // 提取函式（簡化版，用 regex）
    const funcPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
    let match;

    while ((match = funcPattern.exec(content)) !== null) {
      const funcName = match[1] || match[2];
      result.stats.total++;

      // 計算函式所在行號
      const funcLineNum = content.substring(0, match.index).split('\n').length;

      // 找函式前的註解區塊（v2.0: 增加搜索範圍到 2000 字元）
      const beforeFunc = content.substring(Math.max(0, match.index - 2000), match.index);

      // 嘗試多行註解 /** */
      let commentMatch = beforeFunc.match(/\/\*\*[\s\S]*?\*\/\s*$/);
      let comment = commentMatch ? commentMatch[0] : '';

      // 如果沒有多行註解，嘗試連續單行註解 //
      if (!comment) {
        // 從函式行往上找連續的 // 註解
        const singleLineComments = [];
        for (let i = funcLineNum - 2; i >= Math.max(0, funcLineNum - 20); i--) {
          const line = lines[i]?.trim() || '';
          if (line.startsWith('//')) {
            singleLineComments.unshift(line);
          } else if (line === '') {
            // 允許空行
            continue;
          } else {
            // 遇到非註解非空行，停止
            break;
          }
        }
        if (singleLineComments.length > 0) {
          comment = singleLineComments.join('\n');
        }
      }

      if (comment) {
        const tags = extractTags(comment);

        if (tags.basic) {
          result.stats.tagged++;
          result.stats[tags.basic.priority.toLowerCase()]++;

          // 檢查假實作
          const funcBody = extractFunctionBody(content, match.index);
          const fraudIssues = detectFraud(tags, funcBody);

          result.functions.push({
            name: funcName,
            file: relativePath,
            priority: tags.basic.priority,
            status: tags.basic.status,
            signature: tags.basic.signature,
            storyId: tags.basic.storyId,
            description: tags.basic.description,
            flow: tags.flow,
            deps: tags.deps,
            depsRisk: tags.depsRisk,
            test: tags.test,
            testFile: tags.testFile,
            fraudIssues
          });
        }
      }
    }
  }

  return result;
}

/**
 * 提取 GEMS 標籤（使用共用模組，向後相容）
 * v2.0: 委派給 gems-patterns.cjs 處理
 */
function extractTags(comment) {
  const result = extractTagsFromPatterns(comment);

  // 轉換為舊格式以保持向後相容
  const tags = {};

  if (result.basic) {
    tags.basic = {
      functionName: result.basic.functionName,
      priority: result.basic.priority,
      status: result.basic.status,
      signature: result.basic.signature,
      storyId: result.basic.storyId,
      description: result.basic.description
    };
  }

  if (result.flow) tags.flow = result.flow;
  if (result.deps) tags.deps = result.deps;
  if (result.depsRisk) tags.depsRisk = result.depsRisk;
  if (result.test) tags.test = result.test;
  if (result.testFile) tags.testFile = result.testFile;

  return tags;
}

/**
 * 提取函式內容（簡化版）
 */
function extractFunctionBody(content, startIndex) {
  let braceCount = 0;
  let started = false;
  let bodyStart = startIndex;

  for (let i = startIndex; i < content.length && i < startIndex + 5000; i++) {
    if (content[i] === '{') {
      if (!started) bodyStart = i;
      started = true;
      braceCount++;
    } else if (content[i] === '}') {
      braceCount--;
      if (started && braceCount === 0) {
        return content.substring(bodyStart, i + 1);
      }
    }
  }

  return '';
}

/**
 * 假實作偵測
 */
function detectFraud(tags, funcBody) {
  const issues = [];

  if (!tags.basic || tags.basic.status !== '✓✓') return issues;
  if (!funcBody) return issues;

  for (const { pattern, name } of FRAUD_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(funcBody)) {
      issues.push(`標記為 ✓✓ 但包含 ${name}`);
    }
  }

  return issues;
}

/**
 * 驗證 P0/P1 標籤合規性（只檢查標籤存在，不檢查測試檔案）
 * 測試檔案存在檢查由 validateTestFiles 負責
 */
function validateP0P1Compliance(functions) {
  const issues = [];

  for (const fn of functions) {
    if (fn.priority === 'P0' || fn.priority === 'P1') {
      // 檢查擴展標籤是否存在
      if (!fn.flow) {
        issues.push({ fn: fn.name, priority: fn.priority, issue: '缺少 GEMS-FLOW' });
      }
      if (!fn.test) {
        issues.push({ fn: fn.name, priority: fn.priority, issue: '缺少 GEMS-TEST' });
      }
      if (!fn.testFile) {
        issues.push({ fn: fn.name, priority: fn.priority, issue: '缺少 GEMS-TEST-FILE' });
      }
      // P0 額外檢查
      if (fn.priority === 'P0' && !fn.depsRisk) {
        issues.push({ fn: fn.name, priority: fn.priority, issue: '缺少 GEMS-DEPS-RISK' });
      }
    }
  }

  return issues;
}

/**
 * 驗證測試檔案存在（Phase 5 專用）
 * 只檢查 P0/P1 且有 GEMS-TEST-FILE 標籤的函式
 */
function validateTestFiles(functions, srcDir, projectRoot) {
  const missing = [];

  for (const fn of functions) {
    // 只檢查有 testFile 標籤的 P0/P1 函式
    if (!fn.testFile) continue;
    if (fn.priority !== 'P0' && fn.priority !== 'P1') continue;

    const testFileName = fn.testFile.trim();

    // fn.file 是相對於 cwd 的完整路徑，需要取得其目錄
    const fnFullDir = fn.file ? path.dirname(fn.file) : '';

    // 可能的測試檔案路徑
    const possiblePaths = [
      // 1. 源碼同目錄的 __tests__
      path.join(fnFullDir, '__tests__', testFileName),
      // 2. 源碼同目錄
      path.join(fnFullDir, testFileName),
      // 3. srcDir 下的 __tests__
      path.join(srcDir, '__tests__', testFileName),
      // 4. srcDir 同層
      path.join(srcDir, testFileName),
      // 5. 上層 __tests__
      path.join(fnFullDir, '..', '__tests__', testFileName),
      // 6. 專案根目錄 __tests__ (v3.2)
      projectRoot ? path.join(projectRoot, '__tests__', testFileName) : null
    ].filter(Boolean);

    const exists = possiblePaths.some(p => fs.existsSync(p));

    if (!exists) {
      missing.push({
        fn: fn.name,
        priority: fn.priority,
        testFile: testFileName,
        searchedPaths: possiblePaths.map(p => path.relative(process.cwd(), p))
      });
    }
  }

  return missing;
}

/**
 * 找源碼檔案
 */
function findSourceFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.includes('__tests__') && entry.name !== 'node_modules') {
      findSourceFiles(fullPath, files);
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * 產出驗證報告
 */
function generateValidationReport(scanResult, complianceIssues, missingTests) {
  const lines = [];
  const { stats, functions } = scanResult;

  lines.push(`## GEMS 標籤驗證報告\n`);
  lines.push(`### 統計`);
  lines.push(`- 總函式: ${stats.total}`);
  lines.push(`- 已標籤: ${stats.tagged} (${Math.round(stats.tagged / stats.total * 100)}%)`);
  lines.push(`- P0: ${stats.p0}, P1: ${stats.p1}, P2: ${stats.p2}, P3: ${stats.p3}\n`);

  if (complianceIssues.length > 0) {
    lines.push(`### [X] P0/P1 合規問題 (${complianceIssues.length})`);
    for (const issue of complianceIssues) {
      lines.push(`- **${issue.fn}** (${issue.priority}): ${issue.issue}`);
    }
    lines.push('');
  }

  if (missingTests.length > 0) {
    lines.push(`### [WARN] 測試檔案缺失 (${missingTests.length})`);
    for (const m of missingTests) {
      lines.push(`- **${m.fn}** (${m.priority}): ${m.testFile}`);
    }
    lines.push('');
  }

  // 假實作警告
  const fraudFns = functions.filter(f => f.fraudIssues && f.fraudIssues.length > 0);
  if (fraudFns.length > 0) {
    lines.push(`### 🎭 假實作警告 (${fraudFns.length})`);
    for (const fn of fraudFns) {
      lines.push(`- **${fn.name}**: ${fn.fraudIssues.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// Test Type Gate v3.0 - 測試類型驗證
// ============================================================

/**
 * 驗證測試類型是否符合 Priority 定義
 * P0: 必須有 Unit + Integration + E2E
 * P1: 必須有 Unit + Integration
 * P2: 建議有 Unit
 * 
 * @param {Array} functions - scanGemsTags 回傳的函式清單
 * @param {string} srcPath - 專案源碼目錄
 * @param {string} projectRoot - 專案根目錄
 * @returns {Object} { issues: [], stats: {} }
 */
function validateTestTypes(functions, srcPath, projectRoot) {
  const result = {
    issues: [],
    stats: {
      p0Total: 0, p0WithE2E: 0, p0WithIntegration: 0,
      p1Total: 0, p1WithIntegration: 0,
      fakeIntegrationCount: 0
    }
  };

  // 找出所有 E2E 和 Integration 測試檔案
  const testTypeFiles = findTestTypeFiles(srcPath, projectRoot);

  for (const fn of functions) {
    const fnName = fn.name;
    const priority = fn.priority;

    // P0 檢查：必須有 E2E
    if (priority === 'P0') {
      result.stats.p0Total++;

      // 檢查 E2E - v3.1: 同時驗證是否為假 E2E
      let hasValidE2E = false;
      let e2eIssue = null;

      for (const file of testTypeFiles.e2e) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes(fnName) || content.toLowerCase().includes(fn.storyId?.toLowerCase() || '')) {
          const fakeCheck = isFakeIntegrationTest(content, true); // E2E 更嚴格
          if (fakeCheck.isFake) {
            e2eIssue = {
              fn: fnName,
              priority: 'P0',
              issue: `E2E 測試無效: ${fakeCheck.reasons.slice(0, 2).join('; ')}`,
              severity: 'CRITICAL',
              suggestion: 'E2E 測試必須有真實的 DOM 操作或 API 呼叫，且不能只用 toBeDefined()'
            };
          } else {
            hasValidE2E = true;
          }
          break;
        }
      }

      if (hasValidE2E) {
        result.stats.p0WithE2E++;
      } else if (e2eIssue) {
        result.issues.push(e2eIssue);
      } else {
        result.issues.push({
          fn: fnName,
          priority: 'P0',
          issue: '缺少 E2E 測試 (*.e2e.test.ts 或 cypress/e2e/*.cy.ts)',
          severity: 'CRITICAL',
          suggestion: `請建立 E2E 測試覆蓋 ${fnName} 的完整使用者流程`
        });
      }

      // P0 也必須有 Integration - v3.1: 假 Integration 改為 CRITICAL
      const hasIntegration = checkHasIntegration(fn, testTypeFiles.integration);
      if (hasIntegration.found) {
        if (hasIntegration.isFake) {
          result.stats.fakeIntegrationCount++;
          result.issues.push({
            fn: fnName,
            priority: 'P0',
            issue: `Integration 測試無效: ${hasIntegration.reasons.slice(0, 2).join('; ')}`,
            severity: 'CRITICAL',  // v3.1: 改為 CRITICAL
            suggestion: 'Integration 測試禁止使用 jest.mock()，且必須有有效的 assertion（toBe, toEqual 等）'
          });
        } else {
          result.stats.p0WithIntegration++;
        }
      } else {
        result.issues.push({
          fn: fnName,
          priority: 'P0',
          issue: '缺少 Integration 測試 (*.integration.test.ts)',
          severity: 'CRITICAL',
          suggestion: `請建立 ${fnName}.integration.test.ts`
        });
      }
    }

    // P1 檢查：必須有 Integration - v3.1: 假 Integration 改為 CRITICAL
    if (priority === 'P1') {
      result.stats.p1Total++;

      const hasIntegration = checkHasIntegration(fn, testTypeFiles.integration);
      if (hasIntegration.found) {
        if (hasIntegration.isFake) {
          result.stats.fakeIntegrationCount++;
          result.issues.push({
            fn: fnName,
            priority: 'P1',
            issue: `Integration 測試無效: ${hasIntegration.reasons.slice(0, 2).join('; ')}`,
            severity: 'CRITICAL',  // v3.1: P1 假 Integration 也是 CRITICAL
            suggestion: 'Integration 測試禁止使用 jest.mock()，且必須有有效的 assertion'
          });
        } else {
          result.stats.p1WithIntegration++;
        }
      } else {
        result.issues.push({
          fn: fnName,
          priority: 'P1',
          issue: '缺少 Integration 測試',
          severity: 'WARNING',
          suggestion: `請建立包含 ${fnName} 的整合測試`
        });
      }
    }
  }

  return result;
}

/**
 * 檢查函式是否有 Integration 測試
 * @param {Object} fn - 函式資訊
 * @param {Array} integrationFiles - Integration 測試檔案清單
 * @returns {Object} { found: boolean, isFake: boolean, mockRatio: number }
 */
function checkHasIntegration(fn, integrationFiles) {
  for (const file of integrationFiles) {
    const content = fs.readFileSync(file, 'utf8');

    // 檢查是否包含此函式
    if (content.includes(fn.name)) {
      const fakeCheck = isFakeIntegrationTest(content, false);
      return {
        found: true,
        isFake: fakeCheck.isFake,
        mockRatio: fakeCheck.mockRatio,
        reasons: fakeCheck.reasons || [],
        file: file
      };
    }
  }
  return { found: false, isFake: false, mockRatio: 0, reasons: [] };
}

/**
 * 判斷 Integration 測試是否為「假整合測試」v3.1
 * 
 * 假整合測試的定義（任一條件成立即為假）：
 * 1. 使用 jest.mock() - Integration 測試禁止 mock
 * 2. 只使用無效 assertion（toBeDefined, toBeTruthy 等）
 * 3. 沒有任何有效的 assertion（toEqual, toBe, toHaveBeenCalledWith 等）
 * 
 * @param {string} content - 測試檔案內容
 * @param {boolean} isE2E - 是否為 E2E 測試（E2E 更嚴格）
 * @returns {Object} { isFake: boolean, reasons: [], mockRatio: number }
 */
function isFakeIntegrationTest(content, isE2E = false) {
  const reasons = [];

  // 檢查 1: jest.mock() 存在（Integration 測試禁止）
  const mockMatches = content.match(/jest\.mock\s*\(/g) || [];
  const mockCount = mockMatches.length;

  if (mockCount > 0) {
    reasons.push(`使用了 jest.mock() ${mockCount} 次 - Integration 測試禁止 mock`);
  }

  // 檢查 2: 無效 assertion 偵測
  const weakAssertions = [];
  for (const { pattern, name } of WEAK_ASSERTION_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = content.match(pattern) || [];
    if (matches.length > 0) {
      weakAssertions.push({ name, count: matches.length });
    }
  }

  // 檢查 3: 有效 assertion 偵測
  const hasValidAssertion = VALID_INTEGRATION_ASSERTIONS.some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(content);
  });

  // 如果只有無效 assertion，沒有有效 assertion = 假測試
  if (weakAssertions.length > 0 && !hasValidAssertion) {
    reasons.push(`只有無效 assertion: ${weakAssertions.map(w => w.name).join(', ')}`);
  }

  // 如果完全沒有 assertion = 假測試
  const hasAnyExpect = /expect\s*\(/.test(content);
  if (!hasAnyExpect) {
    reasons.push('沒有任何 expect() assertion');
  }

  // 檢查 4: 計算 Mock 比例（向後相容）
  const importMatches = content.match(/^import\s+.*?from\s+['"][^'"]+['"];?$/gm) || [];
  const importCount = importMatches.filter(imp =>
    !imp.includes('@jest') &&
    !imp.includes('jest') &&
    !imp.includes('@testing-library')
  ).length;

  const mockRatio = importCount > 0 ? Math.round((mockCount / importCount) * 100) : 0;

  // E2E 測試更嚴格：必須有真實的 DOM 操作或 API 呼叫
  if (isE2E) {
    const hasRealInteraction = (
      /localStorage\./g.test(content) ||
      /document\./g.test(content) ||
      /fetch\s*\(/g.test(content) ||
      /cy\./g.test(content) ||  // Cypress
      /page\./g.test(content)   // Playwright
    );

    // 服務層 E2E: 跨模組 import ≥ 2 個不同服務檔案也算真實互動
    const crossModuleImports = (content.match(/^import\s+.*from\s+['"]\.\.\/[^'"]+['"]/gm) || []);
    const uniqueServiceFiles = new Set(crossModuleImports.map(m => m.match(/from\s+['"]([^'"]+)['"]/)?.[1]).filter(Boolean));
    const hasCrossModuleImport = uniqueServiceFiles.size >= 2;

    if (!hasRealInteraction && !hasCrossModuleImport) {
      reasons.push('E2E 測試缺少真實互動（localStorage/document/fetch/cy/page/跨模組整合）');
    }
  }

  const isFake = reasons.length > 0;

  return { isFake, reasons, mockRatio, weakAssertions, hasValidAssertion };
}

/**
 * 找出專案中的 E2E 和 Integration 測試檔案
 * 
 * @param {string} srcPath - 源碼目錄
 * @param {string} projectRoot - 專案根目錄
 * @returns {Object} { e2e: [], integration: [] }
 */
function findTestTypeFiles(srcPath, projectRoot) {
  const result = {
    e2e: [],
    integration: []
  };

  // E2E 檔案位置：
  // - cypress/e2e/*.cy.ts
  // - e2e/*.e2e.test.ts
  // - __e2e__/*.ts
  // - __tests__/*.e2e.test.ts (專案根目錄)
  // - *.e2e.test.ts (任意位置)
  const e2ePatterns = [
    path.join(projectRoot, 'cypress', 'e2e'),
    path.join(projectRoot, 'e2e'),
    path.join(srcPath, '__e2e__'),
    path.join(projectRoot, '__tests__')  // v3.2: 新增專案根目錄 __tests__
  ];

  for (const dir of e2ePatterns) {
    if (fs.existsSync(dir)) {
      const files = findFilesRecursive(dir, /\.(cy|e2e\.test)\.(ts|tsx|js|jsx)$/);
      result.e2e.push(...files);
    }
  }

  // 也搜尋 srcPath 底下所有 .e2e.test.ts
  const e2eInSrc = findFilesRecursive(srcPath, /\.e2e\.test\.(ts|tsx|js|jsx)$/);
  result.e2e.push(...e2eInSrc);

  // Integration 檔案位置：
  // - *.integration.test.ts
  // - __integration__/*.ts
  // - __tests__/*.integration.test.ts (專案根目錄)
  const integrationDirs = [
    path.join(srcPath, '__integration__'),
    path.join(projectRoot, '__tests__')  // v3.2: 新增專案根目錄 __tests__
  ];

  for (const dir of integrationDirs) {
    if (fs.existsSync(dir)) {
      const files = findFilesRecursive(dir, /\.integration\.test\.(ts|tsx|js|jsx)$/);
      result.integration.push(...files);
    }
  }

  // 搜尋所有 .integration.test.ts
  const integrationInSrc = findFilesRecursive(srcPath, /\.integration\.test\.(ts|tsx|js|jsx)$/);
  result.integration.push(...integrationInSrc);

  // 去重
  result.e2e = [...new Set(result.e2e)];
  result.integration = [...new Set(result.integration)];

  return result;
}

/**
 * 遞迴搜尋符合 pattern 的檔案
 */
function findFilesRecursive(dir, pattern, files = []) {
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      findFilesRecursive(fullPath, pattern, files);
    } else if (entry.isFile() && pattern.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

module.exports = {
  scanGemsTags,
  validateP0P1Compliance,
  validateTestFiles,
  generateValidationReport,
  findSourceFiles,
  GEMS_PATTERNS,
  extractTags,
  // v3.0: Test Type Gate
  validateTestTypes,
  isFakeIntegrationTest,
  findTestTypeFiles
};
