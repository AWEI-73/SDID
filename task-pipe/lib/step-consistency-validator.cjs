#!/usr/bin/env node
/**
 * [STEP] 錨點一致性驗證器
 * 
 * 功能：驗證 BUILD 實作的 [STEP] 錨點是否與 PLAN 的 GEMS-FLOW 一致
 * 
 * 核心原則：PLAN 承諾的每個 FLOW 步驟 = BUILD 實作的每個 [STEP] 錨點
 */

const fs = require('fs');
const path = require('path');

/**
 * 從 PLAN 檔案提取 GEMS-FLOW 定義
 * @param {string} planPath - implementation_plan 路徑
 * @returns {Array<{functionName: string, flow: string[], priority: string}>}
 */
function extractFlowFromPlan(planPath) {
  if (!fs.existsSync(planPath)) {
    return [];
  }

  const content = fs.readFileSync(planPath, 'utf-8');
  const functions = [];

  // 匹配 GEMS 標籤區塊
  const gemsBlockRegex = /\/\*\*\s*\n\s*\*\s*GEMS:\s*(\w+)\s*\|\s*(P[0-3])\s*\|[^*]*\*\s*GEMS-FLOW:\s*([^\n]+)/g;
  
  let match;
  while ((match = gemsBlockRegex.exec(content)) !== null) {
    const functionName = match[1];
    const priority = match[2];
    const flowStr = match[3].trim();
    
    // 解析 FLOW 步驟 (Step1→Step2→Step3)
    const flowSteps = flowStr.split('→').map(s => s.trim()).filter(Boolean);
    
    functions.push({
      functionName,
      priority,
      flow: flowSteps,
      flowCount: flowSteps.length
    });
  }

  return functions;
}

/**
 * 從源碼檔案提取 [STEP] 錨點
 * 
 * 支援三種模式：
 * 1. function functionName() { ... } — 提取函式體內的 [STEP]
 * 2. class ClassName { ... } — 提取 class 體內的 [STEP]
 * 3. file-level GEMS tag — 當 GEMS 標籤在 file-level 且 [STEP] 在標籤與宣告之間時，
 *    提取從 GEMS 標籤到下一個 GEMS 標籤（或檔案結尾）之間的 [STEP]
 * 
 * @param {string} filePath - 源碼檔案路徑
 * @param {string} functionName - 函式/class/type 名稱
 * @returns {Array<string>} - [STEP] 錨點列表
 */
function extractStepsFromCode(filePath, functionName) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const steps = [];

  // Strategy 1: 傳統 function 匹配
  const functionRegex = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${functionName}\\s*\\([^)]*\\)`, 'g');
  const functionMatch = functionRegex.exec(content);
  
  if (functionMatch) {
    const functionStart = functionMatch.index;
    let braceCount = 0;
    let functionEnd = functionStart;
    let inFunction = false;
    
    for (let i = functionStart; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        inFunction = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (inFunction && braceCount === 0) {
          functionEnd = i;
          break;
        }
      }
    }

    const functionBody = content.substring(functionStart, functionEnd);
    const stepRegex = /\/\/\s*\[STEP\]\s*(\w+)/g;
    let match;
    while ((match = stepRegex.exec(functionBody)) !== null) {
      steps.push(match[1]);
    }
    if (steps.length > 0) return steps;
  }

  // Strategy 2: class 匹配
  const classRegex = new RegExp(`(?:export\\s+)?(?:abstract\\s+)?class\\s+${functionName}\\b`, 'g');
  const classMatch = classRegex.exec(content);
  
  if (classMatch) {
    const classStart = classMatch.index;
    let braceCount = 0;
    let classEnd = classStart;
    let inClass = false;
    
    for (let i = classStart; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        inClass = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (inClass && braceCount === 0) {
          classEnd = i;
          break;
        }
      }
    }

    const classBody = content.substring(classStart, classEnd);
    const stepRegex = /\/\/\s*\[STEP\]\s*(\w+)/g;
    let match;
    while ((match = stepRegex.exec(classBody)) !== null) {
      steps.push(match[1]);
    }
    if (steps.length > 0) return steps;
  }

  // Strategy 3: file-level GEMS tag 匹配
  // 找到 GEMS: functionName 標籤，提取從標籤到下一個 GEMS 標籤（或 EOF）之間的 [STEP]
  const gemsTagRegex = new RegExp(`GEMS:\\s*${functionName}\\b`);
  const gemsTagMatch = gemsTagRegex.exec(content);
  
  if (gemsTagMatch) {
    const tagStart = gemsTagMatch.index;
    
    // 找下一個 GEMS: 標籤（不同函式名）或 EOF
    const restContent = content.substring(tagStart + gemsTagMatch[0].length);
    const nextGemsMatch = /\bGEMS:\s*\w+\s*\|/.exec(restContent);
    const sectionEnd = nextGemsMatch 
      ? tagStart + gemsTagMatch[0].length + nextGemsMatch.index 
      : content.length;
    
    const section = content.substring(tagStart, sectionEnd);
    const stepRegex = /\/\/\s*\[STEP\]\s*(\w+)/g;
    let match;
    while ((match = stepRegex.exec(section)) !== null) {
      steps.push(match[1]);
    }
  }

  return steps;
}

/**
 * 掃描源碼目錄，找到所有函式的 [STEP] 錨點
 * @param {string} srcDir - 源碼目錄
 * @param {Array<string>} functionNames - 要檢查的函式名稱列表
 * @returns {Object} - {functionName: {file: string, steps: Array<string>}}
 */
function scanStepsInDirectory(srcDir, functionNames) {
  const result = {};
  
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // 跳過 node_modules, __tests__ 等
        if (!['node_modules', '__tests__', 'dist', 'build'].includes(entry.name)) {
          scanDir(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|js|tsx|jsx)$/.test(entry.name)) {
        // 掃描每個函式
        for (const fnName of functionNames) {
          if (!result[fnName]) {
            const steps = extractStepsFromCode(fullPath, fnName);
            if (steps.length > 0) {
              result[fnName] = {
                file: fullPath,
                steps,
                stepCount: steps.length
              };
            }
          }
        }
      }
    }
  }
  
  scanDir(srcDir);
  return result;
}

/**
 * 驗證 [STEP] 錨點一致性
 * @param {string} planPath - implementation_plan 路徑
 * @param {string} srcDir - 源碼目錄
 * @returns {Object} - 驗證結果
 */
function validateStepConsistency(planPath, srcDir) {
  // 1. 從 PLAN 提取 GEMS-FLOW
  const planFunctions = extractFlowFromPlan(planPath);
  
  if (planFunctions.length === 0) {
    return {
      valid: true,
      message: '無需驗證 (PLAN 中無 GEMS-FLOW 定義)',
      issues: []
    };
  }

  // 2. 只檢查 P0/P1 函式
  const p0p1Functions = planFunctions.filter(f => f.priority === 'P0' || f.priority === 'P1');
  
  if (p0p1Functions.length === 0) {
    return {
      valid: true,
      message: '無需驗證 (無 P0/P1 函式)',
      issues: []
    };
  }

  // 3. 掃描源碼中的 [STEP] 錨點
  const functionNames = p0p1Functions.map(f => f.functionName);
  const codeSteps = scanStepsInDirectory(srcDir, functionNames);

  // 4. 對比 FLOW 步驟數與 [STEP] 錨點數
  const issues = [];
  
  for (const planFn of p0p1Functions) {
    const codeFn = codeSteps[planFn.functionName];
    
    if (!codeFn) {
      issues.push({
        function: planFn.functionName,
        priority: planFn.priority,
        type: 'MISSING_FUNCTION',
        expected: planFn.flowCount,
        actual: 0,
        message: `函式未找到或無 [STEP] 錨點`
      });
      continue;
    }

    if (codeFn.stepCount !== planFn.flowCount) {
      issues.push({
        function: planFn.functionName,
        priority: planFn.priority,
        type: 'STEP_MISMATCH',
        expected: planFn.flowCount,
        actual: codeFn.stepCount,
        expectedSteps: planFn.flow,
        actualSteps: codeFn.steps,
        file: codeFn.file,
        message: `[STEP] 錨點數量不一致: PLAN 承諾 ${planFn.flowCount} 步，實作只有 ${codeFn.stepCount} 步`
      });
    }
  }

  // 5. 返回驗證結果
  const valid = issues.length === 0;
  const totalChecked = p0p1Functions.length;
  const totalPassed = totalChecked - issues.length;
  const passRate = Math.round((totalPassed / totalChecked) * 100);

  return {
    valid,
    passRate,
    totalChecked,
    totalPassed,
    totalFailed: issues.length,
    message: valid 
      ? `✅ [STEP] 錨點一致性驗證通過 (${totalChecked}/${totalChecked})`
      : `⚠️ [STEP] 錨點不一致 (${totalPassed}/${totalChecked} 通過，${issues.length} 個問題)`,
    issues
  };
}

/**
 * 格式化驗證結果為可讀文本
 * @param {Object} result - validateStepConsistency 的返回值
 * @returns {string}
 */
function formatValidationResult(result) {
  if (result.valid) {
    return `✅ [STEP] 錨點一致性驗證通過\n   檢查函式: ${result.totalChecked} 個\n   符合率: 100%`;
  }

  let output = `⚠️ [STEP] 錨點不一致\n`;
  output += `   檢查函式: ${result.totalChecked} 個\n`;
  output += `   通過: ${result.totalPassed} 個 | 失敗: ${result.totalFailed} 個\n`;
  output += `   符合率: ${result.passRate}%\n\n`;
  output += `問題清單:\n`;

  for (const issue of result.issues) {
    output += `\n- ${issue.function} (${issue.priority})\n`;
    output += `  ${issue.message}\n`;
    
    if (issue.type === 'STEP_MISMATCH') {
      output += `  PLAN 承諾: ${issue.expectedSteps.join(' → ')}\n`;
      output += `  實作錨點: ${issue.actualSteps.join(' → ')}\n`;
      output += `  檔案: ${issue.file}\n`;
    }
  }

  return output;
}

module.exports = {
  validateStepConsistency,
  formatValidationResult,
  extractFlowFromPlan,
  extractStepsFromCode,
  scanStepsInDirectory
};

// CLI 模式
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('用法: node step-consistency-validator.cjs <plan-file> <src-dir>');
    console.log('範例: node step-consistency-validator.cjs .gems/iterations/iter-1/plan/implementation_plan_Story-1.0.md src');
    process.exit(1);
  }

  const planPath = args[0];
  const srcDir = args[1];

  const result = validateStepConsistency(planPath, srcDir);
  console.log(formatValidationResult(result));

  process.exit(result.valid ? 0 : 1);
}
