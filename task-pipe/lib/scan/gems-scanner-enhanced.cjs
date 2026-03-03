#!/usr/bin/env node
/**
 * GEMS Scanner Enhanced v1.0
 * 增強版掃描器 - 支援行號索引 (startLine, endLine)
 * 
 * 目標：
 * - 精確定位函式邊界 (startLine, endLine)
 * - 支援分片讀取 (AI 只讀需要的行)
 * - 保留 FLOW/DEPS 作為規格約束
 * 
 * 產出 functions.json 格式:
 * {
 *   name: "createTask",
 *   file: "src/KanbanService.ts",
 *   startLine: 45,
 *   endLine: 80,
 *   commentLine: 38,  // GEMS 標籤所在行
 *   flow: "Validate→Store→Emit",
 *   deps: "[DataStore, EventBus]",
 *   ...
 * }
 */

const fs = require('fs');
const path = require('path');

// 引入 Lite 版的標籤提取邏輯
const { extractSmartTags, validateSpecCompliance, isCompliant } = require('./gems-validator-lite.cjs');

// ==============================================
// 函式邊界偵測
// ==============================================

/**
 * 偵測函式結束行 (基於括號配對)
 * @param {string[]} lines - 檔案所有行
 * @param {number} startLine - 函式開始行 (1-based)
 * @returns {number} 函式結束行 (1-based)
 */
function detectFunctionEndLine(lines, startLine) {
  let braceCount = 0;
  let started = false;

  for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i];

    for (const char of line) {
      if (char === '{') {
        braceCount++;
        started = true;
      } else if (char === '}') {
        braceCount--;
      }
    }

    // 找到配對的結束括號
    if (started && braceCount === 0) {
      return i + 1;  // 轉回 1-based
    }
  }

  // 沒找到，返回開始行 +50 或檔案結尾
  return Math.min(startLine + 50, lines.length);
}

/**
 * 偵測箭頭函式結束行
 * @param {string[]} lines - 檔案所有行
 * @param {number} startLine - 函式開始行 (1-based)
 * @returns {number} 函式結束行 (1-based)
 */
function detectArrowFunctionEndLine(lines, startLine) {
  const startLineContent = lines[startLine - 1] || '';

  // 單行箭頭函式: const fn = () => expression;
  if (startLineContent.includes('=>') && !startLineContent.includes('{')) {
    // 找分號或下一個 const/function/export
    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.endsWith(';') || line.endsWith(',')) {
        return i + 1;
      }
      // 遇到下一個定義
      if (i > startLine - 1 && (line.startsWith('const ') || line.startsWith('function ') || line.startsWith('export '))) {
        return i;  // 前一行
      }
    }
  }

  // 多行箭頭函式: const fn = () => { ... }
  return detectFunctionEndLine(lines, startLine);
}

/**
 * 偵測 React 元件結束行 (JSX)
 * @param {string[]} lines - 檔案所有行
 * @param {number} startLine - 元件開始行 (1-based)
 * @returns {number} 元件結束行 (1-based)
 */
function detectComponentEndLine(lines, startLine) {
  // React 元件通常是箭頭函式或 function
  return detectArrowFunctionEndLine(lines, startLine);
}

// ==============================================
// 註解區塊偵測
// ==============================================

/**
 * 找函式前的 AC 行（// AC-X.Y 格式）
 * 位置：GEMS 標籤結束後、[STEP] 之前
 * @param {string[]} lines - 檔案所有行
 * @param {number} gemsEndLine - GEMS 標籤結束行 (1-based)
 * @param {number} funcLine - 函式開始行 (1-based)
 * @returns {string[]} AC ID 陣列，如 ["AC-1.1", "AC-1.2"]
 */
function findACLines(lines, gemsEndLine, funcLine) {
  const acIds = [];
  // 從 GEMS 標籤結束行的下一行開始，到函式開始行之前
  for (let i = gemsEndLine; i < funcLine - 1 && i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // 匹配 // AC-X.Y 或 // AC-X.Y (摘要)
    const acMatch = trimmed.match(/^\/\/\s*(AC-[\d.]+)(?:\s+\(.*\))?/);
    if (acMatch) {
      acIds.push(acMatch[1]);
    }
    // 遇到 [STEP] 就停止
    if (trimmed.startsWith('// [STEP]')) break;
    // 遇到非空非 AC 非 STEP 的行也停止（避免誤抓）
    if (trimmed && !trimmed.startsWith('//')) break;
  }
  return acIds;
}

/**
 * 找函式前的 GEMS 註解區塊
 * @param {string[]} lines - 檔案所有行
 * @param {number} funcLine - 函式開始行 (1-based)
 * @returns {{ comment: string, startLine: number, endLine: number } | null}
 */
function findGEMSComment(lines, funcLine) {
  // 往上找，最多 100 行
  let commentEndLine = funcLine - 1;
  let commentStartLine = null;
  let inMultiLineComment = false;

  for (let i = funcLine - 2; i >= Math.max(0, funcLine - 100); i--) {
    const line = lines[i];
    const trimmed = line.trim();

    // 多行註解結束 */
    if (trimmed.endsWith('*/')) {
      inMultiLineComment = true;
      commentEndLine = i + 1;
    }

    // 多行註解開始 /**
    if (trimmed.startsWith('/**') || trimmed.startsWith('/*')) {
      if (inMultiLineComment) {
        commentStartLine = i + 1;
        break;
      }
    }

    // 單行註解 //
    if (trimmed.startsWith('//')) {
      if (!commentStartLine) {
        commentStartLine = i + 1;
      }
      continue;
    }

    // 空行允許
    if (trimmed === '') {
      continue;
    }

    // v1.1.1: 跳過 import/const/let/var/type/interface/export 語句，繼續往上找 GEMS 標籤
    // 這處理 GEMS 標籤在檔案頂部、中間隔著很多 export const 的情況
    if (!inMultiLineComment && /^(?:import\s|(?:export\s+)?(?:type\s|interface\s|const\s|let\s|var\s|default\s|enum\s|class\s|function\s)|export\s(?:\{|\*))/.test(trimmed)) {
      continue;
    }

    // 遇到非註解非空行，且不是被跳過的語句，停止
    if (!inMultiLineComment) {
      break;
    }
  }

  if (!commentStartLine) {
    return null;
  }

  const comment = lines.slice(commentStartLine - 1, commentEndLine).join('\n');

  // 檢查是否包含 GEMS 關鍵字
  if (!comment.includes('GEMS') && !comment.match(/\bP[0-3]\b/i)) {
    return null;
  }

  return {
    comment,
    startLine: commentStartLine,
    endLine: commentEndLine
  };
}

// ==============================================
// 主掃描函式
// ==============================================

/**
 * 掃描源碼目錄，提取所有 GEMS 標籤 (含行號)
 * @param {string} srcDir - 源碼目錄
 * @returns {Object} { functions: [], stats: {}, version: '7.0' }
 */
function scanGemsTagsEnhanced(srcDir) {
  const result = {
    version: '7.0',  // 新版本號，表示有行號
    generatedAt: new Date().toISOString(),
    functions: [],
    untagged: [],
    stats: {
      total: 0,
      tagged: 0,
      p0: 0,
      p1: 0,
      p2: 0,
      p3: 0,
      compliant: 0,
      issues: 0,
      avgFunctionLines: 0
    }
  };

  const files = findSourceFiles(srcDir);
  let totalLines = 0;
  let functionCount = 0;

  for (const file of files) {
    console.log(`Scanning: ${path.basename(file)}`);
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(process.cwd(), file);
    const lines = content.split('\n');

    // 找函式/類別/介面 (支援多種格式)
    // v1.1: 新增 class, interface, enum, type alias 偵測 (對齊 gems-validator-lite v1.4)
    const patterns = [
      // export function name() / async function name()
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g,
      // export const/var/let name = () => / const name = function()
      /(?:export\s+)?(?:const|var|let)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*\w+(?:<[^>]+>)?)?\s*=>/g,
      /(?:export\s+)?(?:const|var|let)\s+(\w+)\s*=\s*(?:async\s*)?function/g,
      // React: const Component = (props) => / function Component(props)
      /(?:export\s+)?(?:const|function)\s+([A-Z]\w+)\s*(?:=\s*)?(?:\([^)]*\)|<[^>]+>)/g,
      // class (including abstract class)
      /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g,
      // interface
      /(?:export\s+)?interface\s+(\w+)/g,
      // enum
      /(?:export\s+)?enum\s+(\w+)/g,
      // type alias: type Foo = ...
      /(?:export\s+)?type\s+(\w+)\s*=/g,
    ];

    const foundFunctions = new Map();  // 避免重複

    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0;  // 重置 regex

      while ((match = pattern.exec(content)) !== null) {
        const funcName = match[1];
        if (foundFunctions.has(funcName)) continue;

        result.stats.total++;

        // 計算函式所在行號 (1-based)
        const funcStartLine = content.substring(0, match.index).split('\n').length;

        // 找 GEMS 註解
        const commentInfo = findGEMSComment(lines, funcStartLine);
        let isTagged = false;

        if (commentInfo) {
          const tags = extractSmartTags(commentInfo.comment);

          // 只要有 Priority 就算有標籤
          if (tags.priority) {
            isTagged = true;
            // v1.1: 如果 GEMS 標籤有明確的 functionName，且與程式碼宣告名不同，
            // 優先使用 GEMS 標籤的名稱（模組級標籤，如 CoreTypes 覆蓋整個檔案）
            const reportName = tags.functionName || funcName;

            // v1.2 FIX: 如果 regex 匹配的是 interface/type/enum，
            // 但 GEMS 標籤的 functionName 跟匹配的名字不同，
            // 代表這個 interface 只是剛好在 GEMS 標籤下面，不是真正的函式。
            // 跳過它，讓後面真正的 function/class/const 來認領。
            const matchedLine = lines[funcStartLine - 1] || '';
            const isTypeDeclaration = /^\s*(?:export\s+)?(?:interface|type|enum)\s/.test(matchedLine);
            if (isTypeDeclaration && reportName !== funcName) {
              continue;  // 讓真正的 function 去認領這個 GEMS 標籤
            }

            // 避免同一個 GEMS 標籤被重複計算（檔案級標籤只算一次）
            const alreadyReported = tags.functionName &&
              result.functions.some(f => f.name === tags.functionName && f.file === relativePath);

            if (alreadyReported) {
              continue;  // 跳過：這個 GEMS 標籤已經被前一個宣告報告過了
            }

            // 也檢查 foundFunctions（同檔案同名不重複）
            if (foundFunctions.has(reportName)) continue;

            result.stats.tagged++;
            const priority = tags.priority.toLowerCase();
            if (result.stats[priority] !== undefined) {
              result.stats[priority]++;
            }

            // 偵測函式結束行
            const isArrowFunc = content.substring(match.index, match.index + 200).includes('=>');
            const funcEndLine = isArrowFunc
              ? detectArrowFunctionEndLine(lines, funcStartLine)
              : detectFunctionEndLine(lines, funcStartLine);

            // 驗證合規性
            const issues = validateSpecCompliance(tags);
            const compliant = isCompliant(issues);

            if (compliant) {
              result.stats.compliant++;
            } else {
              result.stats.issues++;
            }

            // 統計行數
            const funcLines = funcEndLine - funcStartLine + 1;
            totalLines += funcLines;
            functionCount++;

            foundFunctions.set(reportName, true);

            // 收集 AC 行（// AC-X.Y 格式，位於 GEMS 標籤 */ 後、[STEP] 前）
            const acIds = findACLines(lines, commentInfo.endLine, funcStartLine);

            result.functions.push({
              name: reportName,
              file: relativePath,
              // 新增: 精確行號
              startLine: funcStartLine,
              endLine: funcEndLine,
              commentLine: commentInfo.startLine,
              lines: funcLines,
              // 原有欄位
              priority: tags.priority,
              description: tags.description,
              signature: tags.signature || `()→Result`,
              flow: tags.flow,
              deps: tags.deps,
              depsRisk: tags.depsRisk,
              test: tags.test,
              testFile: tags.testFile,
              storyId: tags.storyId,
              issues: issues.filter(i => i.severity === 'ERROR').map(i => i.msg),
              compliant,
              // v1.1: AC 追蹤
              acIds: acIds.length > 0 ? acIds : undefined
            });
          }
        }

        if (!isTagged) {
          // 過濾掉單純的 interface/type/enum
          const matchedLine = lines[funcStartLine - 1] || '';
          const isTypeDeclaration = /^\s*(?:export\s+)?(?:interface|type|enum)\s/.test(matchedLine);

          if (!isTypeDeclaration) {
            if (!foundFunctions.has(funcName)) {
              foundFunctions.set(funcName, true);
              result.untagged.push({
                name: funcName,
                file: relativePath,
                line: funcStartLine
              });
            }
          }
        }
      }
    }
  }

  // 計算平均行數
  result.stats.avgFunctionLines = functionCount > 0
    ? Math.round(totalLines / functionCount)
    : 0;

  return result;
}

/**
 * 找源碼檔案
 */
function findSourceFiles(dir, files = []) {
  console.log(`Searching: ${dir}`);
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // 排除目錄
      if (['__tests__', 'node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) {
        continue;
      }
      findSourceFiles(fullPath, files);
    } else if (entry.isFile()) {
      // 只掃描源碼檔案
      if (/\.(ts|tsx|js|jsx|gs)$/.test(entry.name) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

// ==============================================
// 輔助函式: 產生分片讀取指令
// ==============================================

/**
 * 產生 AI 可用的分片讀取指令
 * @param {Object} func - functions.json 中的函式物件
 * @returns {string} readFile 指令
 */
function generateReadCommand(func) {
  return `readFile("${func.file}", start_line=${func.startLine}, end_line=${func.endLine})`;
}

/**
 * 產生函式索引摘要 (給 AI 快速查詢)
 * @param {Object[]} functions - functions 陣列
 * @returns {Object} 索引物件
 */
function generateFunctionIndex(functions) {
  const index = {
    byFile: {},
    byPriority: { P0: [], P1: [], P2: [], P3: [] },
    byStory: {}
  };

  for (const func of functions) {
    // By File
    if (!index.byFile[func.file]) {
      index.byFile[func.file] = [];
    }
    index.byFile[func.file].push({
      name: func.name,
      lines: `${func.startLine}-${func.endLine}`,
      priority: func.priority
    });

    // By Priority
    if (index.byPriority[func.priority]) {
      index.byPriority[func.priority].push(func.name);
    }

    // By Story
    if (func.storyId) {
      if (!index.byStory[func.storyId]) {
        index.byStory[func.storyId] = [];
      }
      index.byStory[func.storyId].push(func.name);
    }
  }

  return index;
}

// ==============================================
// CLI
// ==============================================

if (require.main === module) {
  const args = process.argv.slice(2);
  let srcDir = args[0] || 'src';
  let outputDir = null;

  args.forEach(arg => {
    if (arg.startsWith('--output=')) {
      outputDir = arg.split('=')[1];
    }
  });

  console.log(`\n🔍 GEMS Scanner Enhanced v1.0`);
  console.log(`   掃描目錄: ${srcDir}`);

  const result = scanGemsTagsEnhanced(srcDir);

  console.log(`\n📊 掃描結果:`);
  console.log(`   總函式: ${result.stats.total}`);
  console.log(`   已標籤: ${result.stats.tagged}`);
  console.log(`   P0: ${result.stats.p0} | P1: ${result.stats.p1} | P2: ${result.stats.p2}`);
  console.log(`   平均行數: ${result.stats.avgFunctionLines}`);

  if (outputDir) {
    // 輸出 functions.json
    const functionsPath = path.join(outputDir, 'functions.json');
    fs.writeFileSync(functionsPath, JSON.stringify(result, null, 2));
    console.log(`\n✅ 已輸出: ${functionsPath}`);

    // 輸出索引檔
    const index = generateFunctionIndex(result.functions);
    const indexPath = path.join(outputDir, 'function-index.json');
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    console.log(`✅ 已輸出: ${indexPath}`);
  } else {
    // 顯示範例
    console.log(`\n📝 範例函式 (前 3 個):`);
    result.functions.slice(0, 3).forEach(f => {
      console.log(`   ${f.name} (${f.priority})`);
      console.log(`     檔案: ${f.file}`);
      console.log(`     行號: ${f.startLine}-${f.endLine} (${f.lines} 行)`);
      console.log(`     FLOW: ${f.flow || '(無)'}`);
      console.log(`     讀取: ${generateReadCommand(f)}`);
    });
  }
}

module.exports = {
  scanGemsTagsEnhanced,
  findSourceFiles,
  detectFunctionEndLine,
  detectArrowFunctionEndLine,
  findGEMSComment,
  findACLines,
  generateReadCommand,
  generateFunctionIndex
};
