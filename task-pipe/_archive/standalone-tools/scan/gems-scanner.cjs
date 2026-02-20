#!/usr/bin/env node

/**
 * GEMS Scanner v5.6 (Line Number Fix)
 * 
 * 功能：
 * 1. 驗證模式 (--mode validate): 檢查 GEMS 標籤合規性
 * 2. 規格書模式 (--mode spec): 產出 Full_Project_Spec.md
 * 3. 完整模式 (--mode full): 驗證 + 規格書
 * 
 * 使用方式：
 *   node gems-scanner.cjs src --mode validate
 *   node gems-scanner.cjs src --mode spec --output docs/Full_Project_Spec.md
 *   node gems-scanner.cjs src --mode full
 * 
 * 變更：
 *   v4.0 使用 TypeScript Compiler API (AST) 提取函式，提升準確度
 *   v4.1 新增品質檢查規則：
 *        - Vague Dependency 檢查 (籠統的 [Supabase] 標籤)
 *        - Type Noise 檢查 (純型別依賴)
 *        - Database 格式檢查 ([Database.tbl_name] 格式)
 *        - FLOW 步驟數檢查 (超過 7 個步驟警告)
 *   v5.0 L2 邏輯與完整性檢查：
 *        - [Critical] P0 強制合規：必須有 GEMS-ALGO、✓ E2E
 *        - [Fraud] 假實作偵測：標記 ✓✓ 但含 "not implemented"
 *        - [Dead Link] 測試檔案存在檢查
 *        - [Risk Mismatch] 依賴一致性檢查
 *   v5.1 全覆蓋驗證：
 *        - 驗證所有函式（不論有無 GEMS 標籤）
 *        - 無標籤函式標記為 "Unknown" 風險等級
 *        - 抓出漏網之魚，確保 100% 覆蓋率
 *   v5.2 POC 與 UI 標籤支援：
 *        - @GEMS-STORY / @GEMS-CONTRACT / @GEMS-DESC (POC 檔案級標籤)
 *        - GEMS-UI / GEMS-ZONE / GEMS-LAYOUT / GEMS-ATOM (UI 結構標籤)
 *   v5.3 GEMS Tag System v2.1 對齊：
 *        - [REMOVED] GEMS-ALGO 檢查（v2.1 已廢棄，改用 Scenario Table）
 *        - [UPDATED] GEMS-DEPS 格式：支援 [Type.Name (說明)] 折衷格式
 *        - [UPDATED] 跨模組依賴：[cross-module] → [Module.*]
 *        - [NEW] [STEP] 錨點驗證：P0/P1 的 GEMS-FLOW 必須與 [STEP] 對應
 *   v5.4 STEP 錨點驗證實作：
 *        - [IMPL] 驗證 // [STEP] StepName 錨點數量與 GEMS-FLOW 步驟數是否一致
 *        - [IMPL] 驗證 [STEP] 錨點名稱是否與 GEMS-FLOW 步驟名稱對應
 *   v5.5 Fraud Detection 誤報修正：
 *        - [FIX] TODO error 正則改為只匹配 Error("TODO...") 開頭
 *        - [FIX] TODO comment 正則確保有冒號，避免誤匹配 todoContent 等變數名
 *   v5.6 行號計算修正：
 *        - [FIX] 修正 export async function 行號偏移問題
 *        - [FIX] 使用註解結束位置計算實際函式宣告行號
 *        - [FIX] 正確處理 VariableDeclaration 的行號
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// ============================================
// 使用統一的 GEMS 標籤解析模組
// v5.7: 整合 gems-patterns.cjs 共用模組
// ============================================
let gemsPatterns;
try {
  // 優先從 task-pipe 載入共用模組
  gemsPatterns = require('../../task-pipe/lib/gems-patterns.cjs');
} catch (e) {
  // 如果找不到，使用內建的正則（向後相容）
  gemsPatterns = null;
}

// ============================================
// 顏色定義
// ============================================
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

/**
 * GEMS: log | P3 | ✓✓ | (message, color)→void | Story-Scanner | 彩色終端輸出工具
 * GEMS-DEPS: []
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ============================================
// GEMS 標籤正則表達式 (v5.7 使用共用模組)
// ============================================
const GEMS_PATTERNS = gemsPatterns ? {
  // 使用共用模組的寬鬆正則
  basic: gemsPatterns.GEMS_BASIC_PATTERN,
  flow: gemsPatterns.GEMS_EXTENDED_PATTERNS.flow,
  deps: gemsPatterns.GEMS_EXTENDED_PATTERNS.deps,
  depsRisk: gemsPatterns.GEMS_EXTENDED_PATTERNS.depsRisk,
  algo: gemsPatterns.GEMS_EXTENDED_PATTERNS.algo,
  test: gemsPatterns.GEMS_EXTENDED_PATTERNS.test,
  testFile: gemsPatterns.GEMS_EXTENDED_PATTERNS.testFile,
  ui: gemsPatterns.GEMS_EXTENDED_PATTERNS.ui,
  // 保留 Scanner 專用的標籤
  critical: /\/\/\s*GEMS-CRITICAL:\s*(.+)/g,
  layout: /GEMS-LAYOUT:\s*(.+)/,
  zone: /GEMS-ZONE:\s*\[([^\]]+)\]\s*\(([^)]+)\)/g,
  atom: /GEMS-ATOM:\s*\[([^\]]+)\]\s*\(([^)]+)\)/g
} : {
  // Fallback: 原有的正則（向後相容）
  basic: /\*\s*GEMS:\s*(\S+)\s*\|\s*(P[0-3])\s*\|\s*([✓○⚠]+)\s*\|\s*(.+?)\s*\|\s*(Story-[\d.]+)\s*\|\s*(.+)/,
  flow: /\*\s*GEMS-FLOW:\s*(.+)/,
  deps: /\*\s*GEMS-DEPS:\s*(.+)/,
  depsRisk: /\*\s*GEMS-DEPS-RISK:\s*(.+)/,
  algo: /\*\s*GEMS-ALGO:\s*(.+)/,
  test: /\*\s*GEMS-TEST:\s*(.+)/,
  testFile: /\*\s*GEMS-TEST-FILE:\s*(.+)/,
  critical: /\/\/\s*GEMS-CRITICAL:\s*(.+)/g,
  ui: /\*\s*GEMS-UI:\s*(.+)/,
  layout: /GEMS-LAYOUT:\s*(.+)/,
  zone: /GEMS-ZONE:\s*\[([^\]]+)\]\s*\(([^)]+)\)/g,
  atom: /GEMS-ATOM:\s*\[([^\]]+)\]\s*\(([^)]+)\)/g
};

// v5.2: POC 檔案級標籤 (使用共用模組或 fallback)
const POC_PATTERNS = gemsPatterns ? gemsPatterns.POC_PATTERNS : {
  story: /@GEMS-STORY:\s*([^\n]+)/,
  desc: /@GEMS-DESC:\s*([^\n]+)/,
  author: /@GEMS-AUTHOR:\s*([^\n]+)/,
  contract: /@GEMS-CONTRACT:\s*(\w+)/g,
  mock: /@GEMS-MOCK:\s*([^\n]+)/
};

// ============================================
// L2 檢查：假實作偵測模式
// ============================================
// v5.5 修正：避免誤報變數名稱（如 todoTemplatePath）
// - TODO error: 只匹配 Error 訊息以 "TODO" 開頭的情況（不含變數名）
// - TODO comment: 必須是 // TODO: 格式（有冒號）
const FRAUD_PATTERNS = [
  { pattern: /throw new Error\([^)]*not implemented[^)]*\)/gi, name: 'not implemented error' },
  // v5.5: 改為只匹配 Error("TODO...") 或 Error('TODO...') 開頭的情況
  { pattern: /throw new Error\(\s*['"`]TODO[^)]*\)/gi, name: 'TODO error' },
  // v5.5: 確保 TODO 後面有冒號，避免誤匹配 todoContent 等變數
  { pattern: /\/\/\s*TODO:/g, name: 'TODO comment' },
  { pattern: /\/\/\s*FIXME:/gi, name: 'FIXME comment' },
  { pattern: /return\s+null\s*;\s*\/\/\s*temp/gi, name: 'temp null return' },
  { pattern: /console\.log\([^)]*placeholder[^)]*\)/gi, name: 'placeholder log' },
];

// Supabase 呼叫模式（用於掃描資料庫使用情況）
const SUPABASE_PATTERNS = {
  from: /\.from\(['"\`](\w+)['"\`]\)/g,
  select: /\.select\(['"\`]([^'"\`]+)['"\`]\)/g,
  insert: /\.insert\(/g,
  update: /\.update\(/g,
  delete: /\.delete\(/g
};

// ============================================
// 檔案掃描
// ============================================
function scanDirectory(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;

  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!['node_modules', 'dist', 'coverage', '.git'].includes(file)) {
        scanDirectory(filePath, fileList);
      }
    } else if (file.match(/\.(ts|tsx|js|jsx)$/) && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// ============================================
// GEMS 標籤提取 (v5.2 新增 UI 標籤)
// ============================================
function extractGEMSTags(comment) {
  const tags = {
    basic: null,
    flow: null,
    deps: null,
    depsRisk: null,
    algo: null,
    test: null,
    testFile: null,
    // v5.2: UI 標籤
    ui: null
  };

  // Helper to clean strings and remove potential bad characters
  const cleanString = (str) => {
    if (!str) return null;

    // Replace arrow symbol with standard arrow to avoid encoding issues
    let cleaned = str.replace(/→/g, '->');

    // Remove control characters (0-31) except newline/tab
    // Also try to strip known bad sequences if possible, but basic control char removal helps
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    return cleaned.trim();
  };

  const lines = comment.split('\n');

  lines.forEach(line => {
    const basicMatch = line.match(GEMS_PATTERNS.basic);
    if (basicMatch) {
      tags.basic = {
        functionName: cleanString(basicMatch[1]),
        riskLevel: cleanString(basicMatch[2]),
        status: cleanString(basicMatch[3]),
        signature: cleanString(basicMatch[4]),
        storyId: cleanString(basicMatch[5]),
        description: cleanString(basicMatch[6])
      };
    }

    const flowMatch = line.match(GEMS_PATTERNS.flow);
    if (flowMatch) tags.flow = cleanString(flowMatch[1]);

    const depsMatch = line.match(GEMS_PATTERNS.deps);
    if (depsMatch) tags.deps = cleanString(depsMatch[1]);

    const depsRiskMatch = line.match(GEMS_PATTERNS.depsRisk);
    if (depsRiskMatch) tags.depsRisk = cleanString(depsRiskMatch[1]);

    const algoMatch = line.match(GEMS_PATTERNS.algo);
    if (algoMatch) tags.algo = cleanString(algoMatch[1]);

    const testMatch = line.match(GEMS_PATTERNS.test);
    if (testMatch) tags.test = cleanString(testMatch[1]);

    const testFileMatch = line.match(GEMS_PATTERNS.testFile);
    if (testFileMatch) tags.testFile = cleanString(testFileMatch[1]);

    // v5.2: UI 標籤
    const uiMatch = line.match(GEMS_PATTERNS.ui);
    if (uiMatch) tags.ui = cleanString(uiMatch[1]);
  });

  return tags;
}

// ============================================
// v5.2: 提取 POC 檔案級標籤
// ============================================
function extractPOCTags(content) {
  const pocTags = {
    story: null,
    desc: null,
    author: null,
    contracts: [],
    mock: null
  };

  const storyMatch = content.match(POC_PATTERNS.story);
  if (storyMatch) pocTags.story = storyMatch[1].trim();

  const descMatch = content.match(POC_PATTERNS.desc);
  if (descMatch) pocTags.desc = descMatch[1].trim();

  const authorMatch = content.match(POC_PATTERNS.author);
  if (authorMatch) pocTags.author = authorMatch[1].trim();

  const mockMatch = content.match(POC_PATTERNS.mock);
  if (mockMatch) pocTags.mock = mockMatch[1].trim();

  // 提取所有 CONTRACT
  POC_PATTERNS.contract.lastIndex = 0;
  let contractMatch;
  while ((contractMatch = POC_PATTERNS.contract.exec(content)) !== null) {
    pocTags.contracts.push(contractMatch[1]);
  }

  return pocTags;
}

// ============================================
// v5.2: 提取 UI Zone/Atom 標籤 (從檔案內容)
// ============================================
function extractUITags(content) {
  const uiTags = {
    zones: [],
    atoms: [],
    layouts: []
  };

  // 提取 GEMS-ZONE
  GEMS_PATTERNS.zone.lastIndex = 0;
  let zoneMatch;
  while ((zoneMatch = GEMS_PATTERNS.zone.exec(content)) !== null) {
    uiTags.zones.push({
      name: zoneMatch[1].trim(),
      description: zoneMatch[2].trim()
    });
  }

  // 提取 GEMS-ATOM
  GEMS_PATTERNS.atom.lastIndex = 0;
  let atomMatch;
  while ((atomMatch = GEMS_PATTERNS.atom.exec(content)) !== null) {
    uiTags.atoms.push({
      visual: atomMatch[1].trim(),
      styles: atomMatch[2].trim()
    });
  }

  // 提取 GEMS-LAYOUT
  const layoutPattern = /GEMS-LAYOUT:\s*([^\n]+)/g;
  let layoutMatch;
  while ((layoutMatch = layoutPattern.exec(content)) !== null) {
    uiTags.layouts.push(layoutMatch[1].trim());
  }

  return uiTags;
}

// ============================================
// 資料庫使用情況提取（保持不變）
// ============================================
function extractDatabaseUsage(content, filePath) {
  const usage = [];

  // 重置正則
  SUPABASE_PATTERNS.from.lastIndex = 0;

  let match;
  while ((match = SUPABASE_PATTERNS.from.exec(content)) !== null) {
    const table = match[1];
    const afterMatch = content.substring(match.index, match.index + 300);

    let operation = 'UNKNOWN';
    if (afterMatch.includes('.select(')) operation = 'SELECT';
    else if (afterMatch.includes('.insert(')) operation = 'INSERT';
    else if (afterMatch.includes('.update(')) operation = 'UPDATE';
    else if (afterMatch.includes('.delete(')) operation = 'DELETE';

    usage.push({
      table,
      operation,
      file: filePath
    });
  }

  return usage;
}

// ============================================
// AST 輔助函式
// ============================================

/**
 * 判斷節點是否為函式節點
 * v5.7: 支援 ObjectLiteralExpression ( Singleton 物件)
 */
function isFunctionNode(node) {
  return ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    (ts.isVariableDeclaration(node) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer) ||
        ts.isObjectLiteralExpression(node.initializer)));
}

/**
 * 從節點提取函式名稱
 */
function getFunctionName(node, sourceFile) {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    return node.name ? node.name.getText(sourceFile) : null;
  }

  if (ts.isVariableDeclaration(node)) {
    return node.name.getText(sourceFile);
  }

  return null;
}

/**
 * 提取節點上方的註解
 * v5.4: 支援連續的單行註解 (// 格式)
 */
function getLeadingComment(node, sourceFile) {
  // [v5.5] 支援 VariableDeclaration 註解提取
  // 如果是變數宣告，註解通常在 VariableStatement 上
  let targetNode = node;
  if (ts.isVariableDeclaration(node)) {
    // VariableDeclaration -> VariableDeclarationList -> VariableStatement
    if (node.parent && node.parent.parent && ts.isVariableStatement(node.parent.parent)) {
      targetNode = node.parent.parent;
    }
  }

  const fullText = sourceFile.getFullText();
  const commentRanges = ts.getLeadingCommentRanges(fullText, targetNode.getFullStart());

  if (!commentRanges || commentRanges.length === 0) {
    return '';
  }

  // v5.4: 合併所有連續的註解（支援多行 // 格式）
  let allComments = '';
  for (const range of commentRanges) {
    const commentText = fullText.substring(range.pos, range.end);
    allComments += commentText + '\n';
  }

  // 只返回包含 GEMS 標籤的註解
  if (allComments.includes('GEMS:')) {
    return allComments;
  }

  return '';
}

/**
 * 提取函式內容 (Function Body)
 */
function getFunctionBody(node, sourceFile) {
  try {
    // 對於 VariableDeclaration (arrow function / object literal)
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
        const body = node.initializer.body;
        if (body) {
          return body.getText(sourceFile);
        }
      }
      // v5.7: 支援 ObjectLiteralExpression
      if (ts.isObjectLiteralExpression(node.initializer)) {
        return node.initializer.getText(sourceFile);
      }
    }

    // 對於 FunctionDeclaration 或 MethodDeclaration
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.body) {
      return node.body.getText(sourceFile);
    }

    return '';
  } catch (e) {
    return '';
  }
}

// ============================================
// AST 解析單個檔案 (v5.2 新增 POC 與 UI 標籤)
// ============================================
function parseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);

  const result = {
    file: relativePath,
    functions: [],
    databaseUsage: [],
    gemsCriticals: [],
    // v5.2: 新增檔案級標籤
    pocTags: null,
    uiTags: null
  };

  // 提取資料庫使用情況（保持不變）
  result.databaseUsage = extractDatabaseUsage(content, relativePath);

  // 提取 GEMS-CRITICAL 註解（保持不變）
  GEMS_PATTERNS.critical.lastIndex = 0;
  let criticalMatch;
  while ((criticalMatch = GEMS_PATTERNS.critical.exec(content)) !== null) {
    result.gemsCriticals.push(criticalMatch[1].trim());
  }

  // v5.2: 提取 POC 檔案級標籤
  result.pocTags = extractPOCTags(content);

  // v5.2: 提取 UI 標籤 (Zones, Atoms, Layouts)
  result.uiTags = extractUITags(content);

  // === 使用 AST 提取函式 ===
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true // setParentNodes
  );

  function visit(node) {
    if (isFunctionNode(node)) {
      const functionName = getFunctionName(node, sourceFile);

      if (functionName) {
        // [FIX v5.6] 修正行號計算：使用實際函式宣告位置
        // 對於 export function，需要從 export 關鍵字開始計算
        let targetNode = node;

        // 如果是 VariableDeclaration，取得 VariableStatement
        if (ts.isVariableDeclaration(node) && node.parent && node.parent.parent) {
          targetNode = node.parent.parent;
        }

        // 使用 getFullStart() 取得包含修飾符（export, async 等）的起始位置
        // 但要跳過前導註解，所以先取得註解結束位置
        const commentRanges = ts.getLeadingCommentRanges(sourceFile.getFullText(), targetNode.getFullStart());
        let startPos = targetNode.getFullStart();

        if (commentRanges && commentRanges.length > 0) {
          // 從最後一個註解之後開始（跳過註解和空白）
          const lastComment = commentRanges[commentRanges.length - 1];
          startPos = lastComment.end;

          // 跳過註解後的空白字元，找到實際的 export 或 function 關鍵字
          const fullText = sourceFile.getFullText();
          while (startPos < fullText.length && /\s/.test(fullText[startPos])) {
            startPos++;
          }
        }

        const lineNumber = sourceFile.getLineAndCharacterOfPosition(startPos).line + 1;
        const commentBlock = getLeadingComment(node, sourceFile);
        const gemsTags = extractGEMSTags(commentBlock);
        const functionBody = getFunctionBody(node, sourceFile);

        result.functions.push({
          name: functionName,
          lineNumber,
          hasComment: commentBlock.length > 0,
          hasGEMSTag: gemsTags.basic !== null,
          gemsTags: gemsTags,
          functionBody: functionBody  // v5.0: 用於假實作偵測
        });
      }
    }

    ts.forEachChild(node, visit);
  }


  visit(sourceFile);

  return result;
}

// ============================================
// 品質檢查規則 (v4.1 新增)
// ============================================

/**
 * 檢查 Vague Dependency (籠統依賴標籤)
 * 例如：[Supabase]、[Database] 這種沒有指定具體表名的標籤
 */
const VAGUE_DEPS_PATTERNS = [
  /\[Supabase\]/i,
  /\[Database\](?!\.\w)/i,  // [Database] 但後面沒有 .tbl_xxx
  /\[DB\]/i,
  /\[Api\](?!\.\w)/i,       // [Api] 但後面沒有具體 endpoint
];

/**
 * 檢查 Type Noise (純型別依賴)
 * 純型別在編譯後消失，不應列入 GEMS-DEPS
 */
const TYPE_NOISE_PATTERNS = [
  /\[types\.\w+\]/i,
  /\[interface\.\w+\]/i,
  /\[type\.\w+\]/i,
];

/**
 * 正確的 Database 依賴格式
 * 應該是 [Database.tbl_xxx] 格式
 */
const VALID_DATABASE_PATTERN = /\[Database\.tbl_\w+\]/;

/**
 * 驗證 GEMS-DEPS 品質
 */
function validateDepsQuality(deps) {
  const issues = [];

  if (!deps) return issues;

  // 檢查 Vague Dependency
  VAGUE_DEPS_PATTERNS.forEach(pattern => {
    if (pattern.test(deps)) {
      const match = deps.match(pattern);
      issues.push({
        level: 'warning',
        message: `Vague Dependency: "${match[0]}" 太籠統，請精確到表名或模組 (例如 [Database.tbl_meal_log])`
      });
    }
  });

  // 檢查 Type Noise
  TYPE_NOISE_PATTERNS.forEach(pattern => {
    if (pattern.test(deps)) {
      const match = deps.match(pattern);
      issues.push({
        level: 'warning',
        message: `Type Noise: "${match[0]}" 是純型別，編譯後消失，不應列入 GEMS-DEPS`
      });
    }
  });

  // 檢查是否有 Database 依賴但格式不正確
  if (/database/i.test(deps) && !VALID_DATABASE_PATTERN.test(deps)) {
    // 只有當提到 database 但沒有正確格式時才警告
    if (!/\[Database\.tbl_\w+\]/.test(deps)) {
      // 已經在 Vague Dependency 檢查過了，這裡不重複
    }
  }

  return issues;
}

/**
 * 驗證 GEMS-FLOW 品質
 */
function validateFlowQuality(flow, riskLevel) {
  const issues = [];

  if (!flow) return issues;

  // 計算步驟數（數箭頭數量 + 1）
  // [FIX v5.6.1] 支援全形與半形箭頭
  const arrowCount = (flow.match(/→|->/g) || []).length;
  const stepCount = arrowCount + 1;

  // 超過 7 個步驟警告
  if (stepCount > 7) {
    issues.push({
      level: 'warning',
      message: `FLOW 步驟過多 (${stepCount} 步)，建議 3-5 步，最多 7 步。考慮抽象化或重構代碼`
    });
  }

  // P0/P1 函式如果只有 2 步以下，可能隱藏了邏輯
  if ((riskLevel === 'P0' || riskLevel === 'P1') && stepCount <= 2) {
    issues.push({
      level: 'info',
      message: `FLOW 步驟較少 (${stepCount} 步)，請確認是否有隱藏的 Mapper/Transform 邏輯`
    });
  }

  return issues;
}

/**
 * [v5.4] 驗證 [STEP] 錨點與 GEMS-FLOW 的一致性
 * 
 * 規則：
 * 1. P0/P1 函式的 [STEP] 錨點數量必須等於 GEMS-FLOW 步驟數
 * 2. [STEP] 錨點名稱應與 FLOW 步驟名稱對應（警告級別）
 * 
 * @param {string} flow - GEMS-FLOW 字串 (e.g., "Validate→Insert→Return")
 * @param {string} functionBody - 函式內容
 * @param {string} riskLevel - 風險等級 (P0/P1/P2/P3)
 * @returns {Array} 問題陣列
 */
function validateStepAnchors(flow, functionBody, riskLevel) {
  const issues = [];

  // 只對 P0/P1 函式進行 STEP 驗證
  if (!flow || (riskLevel !== 'P0' && riskLevel !== 'P1')) {
    return issues;
  }

  if (!functionBody) {
    return issues;
  }

  // 解析 GEMS-FLOW 步驟
  // [FIX v5.6.1] 支援全形與半形箭頭
  const flowSteps = flow.split(/→|->/).map(s => s.trim());
  const flowStepCount = flowSteps.length;

  // 解析 [STEP] 錨點
  // 支援格式：// [STEP] StepName 或 // [STEP-1] StepName
  const stepPattern = /\/\/\s*\[STEP(?:-\d+)?\]\s*(\w+)/g;
  const stepMatches = [];
  let match;
  while ((match = stepPattern.exec(functionBody)) !== null) {
    stepMatches.push(match[1]);
  }
  const stepCount = stepMatches.length;

  // 檢查數量是否一致
  if (stepCount === 0) {
    // 沒有 [STEP] 錨點，給出提示（非強制）
    issues.push({
      level: 'info',
      message: `[STEP] ${riskLevel} 函式建議添加 [STEP] 錨點標記流程位置 (FLOW 有 ${flowStepCount} 步)`
    });
  } else if (stepCount !== flowStepCount) {
    // 數量不一致，報錯
    issues.push({
      level: 'error',
      message: `[STEP Mismatch] [STEP] 錨點數量 (${stepCount}) 與 GEMS-FLOW 步驟數 (${flowStepCount}) 不一致`
    });
  } else {
    // 數量一致，檢查名稱是否對應
    const mismatches = [];
    for (let i = 0; i < flowStepCount; i++) {
      const flowStep = flowSteps[i];
      const stepAnchor = stepMatches[i];

      // 名稱不一致時警告
      if (flowStep.toLowerCase() !== stepAnchor.toLowerCase()) {
        mismatches.push(`[${i + 1}] FLOW:"${flowStep}" ≠ STEP:"${stepAnchor}"`);
      }
    }

    if (mismatches.length > 0) {
      issues.push({
        level: 'warning',
        message: `[STEP Name Mismatch] 錨點名稱與 FLOW 不一致: ${mismatches.join(', ')}`
      });
    }
  }

  return issues;
}

// ============================================
// L2 邏輯檢查規則 (v5.0 新增)
// ============================================

/**
 * [Critical] P0 強制合規檢測 (v5.3: 移除 GEMS-ALGO 檢查)
 * P0 函式必須有：✓ E2E、GEMS-DEPS-RISK
 * 
 * v2.1 變更：GEMS-ALGO 已廢棄，改用 Requirement Spec 的 Scenario Table
 */
function validateP0Compliance(gemsTags) {
  const issues = [];
  const { basic, algo, test, depsRisk } = gemsTags;

  if (!basic || basic.riskLevel !== 'P0') return issues;

  // v5.3: GEMS-ALGO 已廢棄，如果存在則顯示棄用警告
  if (algo) {
    issues.push({
      level: 'info',
      message: `[Deprecated] GEMS-ALGO 已在 v2.1 廢棄，請將演算法說明移至 Requirement Spec 的 Scenario Table`
    });
  }

  // P0 必須有 ✓ E2E 測試
  if (test) {
    const hasE2E = /✓\s*E2E/i.test(test);
    const skipE2E = /-\s*E2E/i.test(test) || /○\s*E2E/i.test(test);

    if (!hasE2E && skipE2E) {
      issues.push({
        level: 'critical',
        message: `[Critical] P0 函式必須有 E2E 測試 (✓ E2E)，目前標記為跳過`
      });
    }
  }

  // P0 必須有 GEMS-DEPS-RISK
  if (!depsRisk) {
    issues.push({
      level: 'critical',
      message: `[Critical] P0 函式缺少 GEMS-DEPS-RISK 標籤（依賴風險評估）`
    });
  }

  return issues;
}

/**
 * [Fraud] 假實作偵測
 * 標記為 ✓✓ (已實作+已測試) 但代碼中含有未完成的標記
 */
function detectFraudImplementation(gemsTags, functionBody) {
  const issues = [];

  if (!gemsTags.basic) return issues;

  const { status } = gemsTags.basic;

  // 只檢查標記為 ✓✓ 的函式
  if (status !== '✓✓') return issues;

  if (!functionBody) return issues;

  // 檢查假實作模式
  FRAUD_PATTERNS.forEach(({ pattern, name }) => {
    // 重置正則
    pattern.lastIndex = 0;

    if (pattern.test(functionBody)) {
      issues.push({
        level: 'fraud',
        message: `[Fraud] 函式標記為 '✓✓' (已完成) 但包含 '${name}'`
      });
    }
  });

  return issues;
}

/**
 * [Dead Link] 測試檔案存在檢查
 */
function validateTestFileExists(gemsTags, sourceFilePath) {
  const issues = [];

  if (!gemsTags.testFile) return issues;

  const testFileName = gemsTags.testFile.trim();

  // 計算測試檔案可能的路徑
  const sourceDir = path.dirname(sourceFilePath);
  const possiblePaths = [
    path.join(sourceDir, '__tests__', testFileName),
    path.join(sourceDir, testFileName),
    path.join(sourceDir, '..', '__tests__', testFileName),
    path.join(sourceDir, '..', '..', '__tests__', testFileName),
  ];

  const exists = possiblePaths.some(p => fs.existsSync(p));

  if (!exists) {
    issues.push({
      level: 'deadlink',
      message: `[Dead Link] 測試檔案 '${testFileName}' 不存在於預期路徑`
    });
  }

  return issues;
}

/**
 * [Risk Mismatch] 依賴一致性檢查 (v5.3 更新)
 * 檢查 GEMS-DEPS 中的跨模組依賴數量與 GEMS-DEPS-RISK 是否一致
 * 
 * v2.1 變更：跨模組依賴格式從 [cross-module] 改為 [Module.Name]
 * 相容性：同時支援舊格式 [cross-module] 和新格式 [Module.*]
 */
function validateDepsRiskConsistency(gemsTags) {
  const issues = [];

  const { deps, depsRisk } = gemsTags;

  if (!deps) return issues;

  // v5.3: 同時計算舊格式 [cross-module] 和新格式 [Module.*] 的數量
  const oldFormatMatches = deps.match(/\[cross-module\]/gi) || [];
  const newFormatMatches = deps.match(/\[Module\.\w+/gi) || [];
  const crossModuleCount = oldFormatMatches.length + newFormatMatches.length;

  // 如果使用舊格式，顯示遷移建議
  if (oldFormatMatches.length > 0) {
    issues.push({
      level: 'info',
      message: `[Migration] 建議將 [cross-module] 改為 [Module.Name] 格式 (v2.1 標準)`
    });
  }

  // 如果沒有 depsRisk 標籤但有跨模組依賴
  if (crossModuleCount > 0 && !depsRisk) {
    issues.push({
      level: 'warning',
      message: `[Risk Missing] 有 ${crossModuleCount} 個跨模組依賴但缺少 GEMS-DEPS-RISK 標籤`
    });
    return issues;
  }

  if (!depsRisk) return issues;

  // 解析風險等級
  const riskLevel = depsRisk.toUpperCase();
  const isLow = riskLevel.includes('LOW');
  const isMedium = riskLevel.includes('MEDIUM');
  const isHigh = riskLevel.includes('HIGH');

  // 檢查一致性
  if (crossModuleCount === 0 && !isLow) {
    issues.push({
      level: 'warning',
      message: `[Risk Mismatch] 無跨模組依賴但風險標記為 ${depsRisk}，應為 LOW`
    });
  }

  if (crossModuleCount >= 1 && crossModuleCount <= 2 && isLow) {
    issues.push({
      level: 'warning',
      message: `[Risk Mismatch] 有 ${crossModuleCount} 個跨模組依賴，風險應為 MEDIUM，目前標記為 LOW`
    });
  }

  if (crossModuleCount >= 3 && !isHigh) {
    issues.push({
      level: 'error',
      message: `[Risk Mismatch] 有 ${crossModuleCount} 個跨模組依賴，風險應為 HIGH，目前標記為 ${depsRisk}`
    });
  }

  return issues;
}

// ============================================
// 驗證 GEMS 標籤合規性
// ============================================
function validateGEMSTags(functionData, sourceFilePath) {
  const issues = [];
  const { name, gemsTags, hasComment, functionBody } = functionData;

  if (!hasComment) {
    issues.push({ level: 'warning', message: '缺少函式註解' });
    // v5.1: 如果連註解都沒有，通常也沒有 GEMS 標籤，直接報錯
    issues.push({ level: 'error', message: '缺少基礎 GEMS 標籤' });
    return issues;
  }

  if (!gemsTags.basic) {
    issues.push({ level: 'error', message: '缺少基礎 GEMS 標籤' });
    return issues;
  }

  const { functionName, riskLevel, status } = gemsTags.basic;

  // 驗證函式名稱一致性
  if (functionName !== name) {
    issues.push({
      level: 'warning',
      message: `GEMS 標籤中的函式名 "${functionName}" 與實際函式名 "${name}" 不一致`
    });
  }

  // 驗證風險等級格式
  if (!['P0', 'P1', 'P2', 'P3'].includes(riskLevel)) {
    issues.push({
      level: 'error',
      message: `無效的風險等級 "${riskLevel}"`
    });
  }

  // 驗證狀態符號
  const validStatuses = ['✓✓', '✓○', '○○', '✓⚠'];
  if (!validStatuses.includes(status)) {
    issues.push({
      level: 'error',
      message: `無效的狀態符號 "${status}"`
    });
  }

  // P0/P1 必須有擴展標籤
  if (riskLevel === 'P0' || riskLevel === 'P1') {
    if (!gemsTags.flow) {
      issues.push({
        level: 'error',
        message: `${riskLevel} 函式缺少 GEMS-FLOW 標籤`
      });
    }

    if (!gemsTags.test) {
      issues.push({
        level: 'error',
        message: `${riskLevel} 函式缺少 GEMS-TEST 標籤`
      });
    }

    if (!gemsTags.testFile) {
      issues.push({
        level: 'error',
        message: `${riskLevel} 函式缺少 GEMS-TEST-FILE 標籤`
      });
    }
  }

  // === v4.1：品質檢查 ===

  // 檢查 DEPS 品質
  const depsIssues = validateDepsQuality(gemsTags.deps);
  issues.push(...depsIssues);

  // 檢查 FLOW 品質
  const flowIssues = validateFlowQuality(gemsTags.flow, riskLevel);
  issues.push(...flowIssues);

  // [v5.4] 檢查 [STEP] 錨點一致性
  const stepIssues = validateStepAnchors(gemsTags.flow, functionBody, riskLevel);
  issues.push(...stepIssues);

  // === v5.0：L2 邏輯檢查 ===

  // [Critical] P0 強制合規
  const p0Issues = validateP0Compliance(gemsTags);
  issues.push(...p0Issues);

  // [Fraud] 假實作偵測
  const fraudIssues = detectFraudImplementation(gemsTags, functionBody);
  issues.push(...fraudIssues);

  // [Dead Link] 測試檔案存在檢查
  const deadLinkIssues = validateTestFileExists(gemsTags, sourceFilePath);
  issues.push(...deadLinkIssues);

  // [Risk Mismatch] 依賴一致性檢查
  const riskMismatchIssues = validateDepsRiskConsistency(gemsTags);
  issues.push(...riskMismatchIssues);

  return issues;
}

// ============================================
// 驗證模式
// ============================================
function runValidation(files) {
  log('\n🔍 GEMS Scanner v5.6 (Line Number Fix)', 'cyan');
  log(`📂 掃描目錄: ${process.argv[2] || 'src'}`, 'cyan');
  log(`📝 找到 ${files.length} 個 TypeScript 檔案\n`, 'cyan');

  const results = files.map(file => parseFile(file));

  let totalFunctions = 0;
  let functionsWithGEMS = 0;

  // v5.0: 分類統計問題
  const issueStats = {
    critical: 0,
    fraud: 0,
    deadlink: 0,
    error: 0,
    warning: 0,
    info: 0
  };

  const issuesByFile = [];

  results.forEach(result => {
    totalFunctions += result.functions.length;

    const fileIssues = [];

    result.functions.forEach(func => {
      // v5.1: 即使沒有 GEMS 標籤也要檢查，以便抓出漏網之魚
      if (func.hasGEMSTag) functionsWithGEMS++;

      const issues = validateGEMSTags(func, result.file);

      if (issues.length > 0) {
        issues.forEach(issue => {
          issueStats[issue.level] = (issueStats[issue.level] || 0) + 1;
        });
        fileIssues.push({
          function: func.name,
          line: func.lineNumber,
          priority: func.gemsTags.basic?.riskLevel || 'Unknown', // 沒標籤時顯示 Unknown
          issues
        });
      }
    });

    if (fileIssues.length > 0) {
      issuesByFile.push({
        file: result.file,
        issues: fileIssues
      });
    }
  });

  const totalIssues = Object.values(issueStats).reduce((a, b) => a + b, 0);

  // 顯示統計
  log('📊 掃描結果:', 'bright');
  log(`   總函式數: ${totalFunctions}`, 'reset');
  log(`   已標記 GEMS: ${functionsWithGEMS}`, 'reset');
  log(`   標記率: ${((functionsWithGEMS / totalFunctions) * 100).toFixed(1)}%\n`, 'reset');

  // v5.0: 顯示問題分類統計
  if (totalIssues > 0) {
    log('🏥 健康診斷報告:', 'bright');
    if (issueStats.critical > 0) log(`   🚨 Critical (P0 違規): ${issueStats.critical}`, 'red');
    if (issueStats.fraud > 0) log(`   🎭 Fraud (假實作): ${issueStats.fraud}`, 'red');
    if (issueStats.deadlink > 0) log(`   💀 Dead Link (檔案不存在): ${issueStats.deadlink}`, 'yellow');
    if (issueStats.error > 0) log(`   ❌ Error (格式錯誤): ${issueStats.error}`, 'red');
    if (issueStats.warning > 0) log(`   ⚠️  Warning (品質警告): ${issueStats.warning}`, 'yellow');
    if (issueStats.info > 0) log(`   ℹ️  Info (建議): ${issueStats.info}`, 'cyan');
    log('', 'reset');

    log(`📋 詳細問題列表 (${totalIssues} 個):\n`, 'yellow');

    issuesByFile.forEach(({ file, issues }) => {
      log(`📄 ${file}`, 'yellow');
      issues.forEach(({ function: funcName, line, priority, issues: funcIssues }) => {
        log(`   • ${funcName} [${priority}] (行 ${line})`, 'reset');
        funcIssues.forEach(issue => {
          const icon = getIssueIcon(issue.level);
          const color = getIssueColor(issue.level);
          log(`     ${icon} ${issue.message}`, color);
        });
      });
      log('', 'reset');
    });

    // v5.0: 嚴重問題阻斷
    const blockingIssues = issueStats.critical + issueStats.fraud;
    if (blockingIssues > 0) {
      log(`\n🚫 發現 ${blockingIssues} 個阻斷性問題 (Critical/Fraud)，請優先修復！`, 'red');
    }
  } else {
    log('✅ 所有 GEMS 標籤合規\n', 'green');
  }

  // 只有 critical 和 fraud 會導致失敗
  const hasBlockingIssues = issueStats.critical > 0 || issueStats.fraud > 0;
  return !hasBlockingIssues;
}

/**
 * 取得問題等級對應的圖示
 */
function getIssueIcon(level) {
  const icons = {
    critical: '🚨',
    fraud: '🎭',
    deadlink: '💀',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  return icons[level] || '•';
}

/**
 * 取得問題等級對應的顏色
 */
function getIssueColor(level) {
  const colors = {
    critical: 'red',
    fraud: 'red',
    deadlink: 'yellow',
    error: 'red',
    warning: 'yellow',
    info: 'cyan'
  };
  return colors[level] || 'reset';
}

// ============================================
// 規格書模式
// ============================================
function generateProjectSpec(files, outputPath) {
  log('\n📋 GEMS Scanner v5.6 (Fixed Specification Output)', 'cyan');
  log(`📂 掃描目錄: ${process.argv[2] || 'src'}`, 'cyan');
  log(`📝 找到 ${files.length} 個 TypeScript 檔案\n`, 'cyan');

  log('📄 生成規格書...', 'cyan');

  // 解析所有檔案
  const results = files.map(file => parseFile(file));

  // 建立規格書資料結構
  const spec = {
    generatedAt: new Date().toISOString(),
    functions: []
  };

  results.forEach(result => {
    result.functions.forEach(func => {
      // 確保只輸出有標籤的函式到規格書
      if (func.hasGEMSTag && func.gemsTags.basic) {
        const { basic, flow, deps, test, testFile, ui } = func.gemsTags;

        // 統一規格書物件結構
        spec.functions.push({
          name: basic.functionName || func.name,
          file: result.file,
          line: func.lineNumber,
          risk: basic.riskLevel,
          status: basic.status,
          signature: basic.signature,
          story: basic.storyId,
          description: basic.description,
          flow: flow || null,
          deps: deps || null,
          test: test || null,
          testFile: testFile || null,
          ui: ui || null
        });
      }
    });
  });

  // 確保輸出目錄存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 根據副檔名決定輸出格式
  if (outputPath.endsWith('.json')) {
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
    log(`✅ 已生成規格書 (JSON): ${outputPath}\n`, 'green');
  } else {
    // 生成 Markdown
    let markdown = '# Full Project Specification\n\n';
    markdown += `> Generated at: ${spec.generatedAt}\n\n`;

    spec.functions.forEach(func => {
      markdown += `### ${func.name}\n\n`;
      markdown += `- **File**: \`${func.file}\` (Line ${func.line})\n`;
      markdown += `- **Risk**: ${func.risk} [${func.status}]\n`;
      markdown += `- **Story**: ${func.story}\n`;
      markdown += `- **Signature**: \`${func.signature}\` \n`;
      markdown += `- **Description**: ${func.description}\n`;

      if (func.flow) markdown += `- **Flow**: ${func.flow}\n`;
      if (func.deps) markdown += `- **Dependencies**: ${func.deps}\n`;
      if (func.testFile) markdown += `- **Test File**: \`${func.testFile}\`\n`;
      if (func.ui) markdown += `- **UI Component**: ${func.ui}\n`;

      markdown += '\n---\n\n';
    });

    fs.writeFileSync(outputPath, markdown);
    log(`✅ 已生成規格書 (Markdown): ${outputPath}\n`, 'green');
  }
}
// ============================================
// 主程式
// ============================================
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    log('使用方式: node gems-scanner.cjs <directory> [options]', 'yellow');
    log('選項:', 'yellow');
    log('  --mode validate  驗證 GEMS 標籤', 'reset');
    log('  --mode spec      產出規格書', 'reset');
    log('  --mode full      驗證 + 規格書', 'reset');
    log('  --output <path>  規格書輸出路徑', 'reset');
    process.exit(1);
  }

  const directory = args[0];
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'validate';
  const output = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || 'docs/Full_Project_Spec.md';

  // 掃描檔案
  const files = scanDirectory(directory);

  if (files.length === 0) {
    log('❌ 找不到 TypeScript 檔案', 'red');
    process.exit(1);
  }

  // 執行對應模式
  if (mode === 'validate') {
    const success = runValidation(files);
    process.exit(success ? 0 : 1);
  } else if (mode === 'spec') {
    generateProjectSpec(files, output);
  } else if (mode === 'full') {
    const success = runValidation(files);
    generateProjectSpec(files, output);
    process.exit(success ? 0 : 1);
  } else {
    log(`❌ 未知模式: ${mode}`, 'red');
    process.exit(1);
  }
}

// 執行
if (require.main === module) {
  main();
}

// 匯出函式供其他工具使用
module.exports = {
  parseFile,
  validateGEMSTags,
  extractGEMSTags,
  extractPOCTags,
  extractUITags,
  generateProjectSpec,
  scanDirectory,
  GEMS_PATTERNS,
  POC_PATTERNS
};
