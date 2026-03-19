#!/usr/bin/env node
/**
 * Code Validator - 核心 8 層驗證
 * 
 * 整合 BlueMouse 最有價值的 8 層驗證：
 * L1: 基本語法檢查
 * L2: AST 結構檢查
 * L5: 參數檢查
 * L6: 返回值檢查
 * L7: 類型提示檢查
 * L12: 循環依賴檢查
 * L15: 錯誤處理檢查
 * L16: 安全性檢查
 * 
 * + 3 層 GEMS 專用驗證：
 * L4-GEMS: GEMS 標籤檢查
 * L8-GEMS: GEMS 標籤完整性
 * L14-GEMS: GEMS-FLOW 完整性
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 執行完整驗證
 * 
 * @param {string} filePath - 檔案路徑
 * @param {object} options - 選項
 * @returns {object} 驗證結果
 */
function validateCode(filePath, options = {}) {
  const {
    enableGems = true,      // 是否啟用 GEMS 專用驗證
    enableSecurity = true,  // 是否啟用安全檢查
    verbose = false         // 是否輸出詳細資訊
  } = options;

  // 讀取檔案內容
  if (!fs.existsSync(filePath)) {
    return {
      passed: false,
      error: 'File not found'
    };
  }

  const code = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath);

  // 只支援 JS/TS 檔案
  if (!['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
    return {
      skipped: true,
      reason: 'Unsupported file type'
    };
  }

  const results = [];

  // === 核心 8 層驗證 ===
  
  // L1: 基本語法檢查
  results.push(validate_l1_syntax(code, ext));
  
  // L2: AST 結構檢查
  results.push(validate_l2_ast(code, ext));
  
  // L5: 參數檢查
  results.push(validate_l5_parameters(code, ext));
  
  // L6: 返回值檢查
  results.push(validate_l6_return(code, ext));
  
  // L7: 類型提示檢查
  if (['.ts', '.tsx'].includes(ext)) {
    results.push(validate_l7_types(code));
  }
  
  // L12: 循環依賴檢查
  results.push(validate_l12_circular_deps(code));
  
  // L15: 錯誤處理檢查
  if (enableSecurity) {
    results.push(validate_l15_error_handling(code));
  }
  
  // L16: 安全性檢查
  if (enableSecurity) {
    results.push(validate_l16_security(code));
  }

  // === GEMS 專用驗證 ===
  
  if (enableGems) {
    // L4-GEMS: GEMS 標籤檢查
    results.push(validate_l4_gems_naming(code));
    
    // L8-GEMS: GEMS 標籤完整性
    results.push(validate_l8_gems_completeness(code));
    
    // L14-GEMS: GEMS-FLOW 完整性
    results.push(validate_l14_gems_flow(code));
  }

  // 計算總體結果
  const passed = results.every(r => r.passed);
  const criticalIssues = results.filter(r => !r.passed && r.severity === 'critical');
  const warnings = results.filter(r => !r.passed && r.severity !== 'critical');

  return {
    passed,
    file: path.basename(filePath),
    layers: results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      critical: criticalIssues.length,
      warnings: warnings.length
    },
    criticalIssues: criticalIssues.map(r => r.message),
    warnings: warnings.map(r => r.message)
  };
}

// ============================================================================
// 核心 8 層驗證
// ============================================================================

/**
 * L1: 基本語法檢查
 */
function validate_l1_syntax(code, ext) {
  try {
    // 使用 Node.js 內建的語法檢查
    if (ext === '.js' || ext === '.jsx') {
      new Function(code);
    } else {
      // TypeScript 需要 tsc，這裡簡化為正則檢查
      // 檢查常見語法錯誤
      const syntaxErrors = [];
      
      // 檢查未閉合的括號
      const openBrackets = (code.match(/\{/g) || []).length;
      const closeBrackets = (code.match(/\}/g) || []).length;
      if (openBrackets !== closeBrackets) {
        syntaxErrors.push('未閉合的大括號');
      }
      
      // 檢查未閉合的小括號
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        syntaxErrors.push('未閉合的小括號');
      }
      
      if (syntaxErrors.length > 0) {
        throw new Error(syntaxErrors.join(', '));
      }
    }
    
    return {
      layer: 1,
      name: '基本語法檢查',
      passed: true,
      message: '語法正確'
    };
  } catch (err) {
    return {
      layer: 1,
      name: '基本語法檢查',
      passed: false,
      severity: 'critical',
      message: `語法錯誤: ${err.message}`
    };
  }
}

/**
 * L2: AST 結構檢查
 */
function validate_l2_ast(code, ext) {
  // 簡化版：檢查是否有函數或類定義
  const hasFunctionDef = /function\s+\w+|const\s+\w+\s*=\s*\(|export\s+(function|const|class)/.test(code);
  const hasClassDef = /class\s+\w+/.test(code);
  
  if (hasFunctionDef || hasClassDef) {
    return {
      layer: 2,
      name: 'AST 結構檢查',
      passed: true,
      message: 'AST 結構完整'
    };
  } else {
    return {
      layer: 2,
      name: 'AST 結構檢查',
      passed: false,
      severity: 'warning',
      message: '缺少函數或類定義'
    };
  }
}

/**
 * L5: 參數檢查
 */
function validate_l5_parameters(code, ext) {
  // 檢查函數是否有參數定義
  const functions = code.match(/function\s+\w+\s*\([^)]*\)|const\s+\w+\s*=\s*\([^)]*\)\s*=>/g) || [];
  
  if (functions.length === 0) {
    return {
      layer: 5,
      name: '參數檢查',
      passed: true,
      message: '無函數需檢查'
    };
  }
  
  // 檢查是否有空參數列表的函數（可能是遺漏）
  const emptyParams = functions.filter(f => /\(\s*\)/.test(f));
  
  return {
    layer: 5,
    name: '參數檢查',
    passed: true,
    message: `檢查 ${functions.length} 個函數，${emptyParams.length} 個無參數`
  };
}

/**
 * L6: 返回值檢查
 */
function validate_l6_return(code, ext) {
  // 檢查函數是否有返回值
  const functions = code.match(/function\s+\w+[^{]*\{[^}]*\}/gs) || [];
  
  if (functions.length === 0) {
    return {
      layer: 6,
      name: '返回值檢查',
      passed: true,
      message: '無函數需檢查'
    };
  }
  
  const noReturn = functions.filter(f => !/return\s/.test(f));
  
  if (noReturn.length > 0 && noReturn.length === functions.length) {
    return {
      layer: 6,
      name: '返回值檢查',
      passed: false,
      severity: 'warning',
      message: `${noReturn.length} 個函數缺少返回值`
    };
  }
  
  return {
    layer: 6,
    name: '返回值檢查',
    passed: true,
    message: `${functions.length - noReturn.length}/${functions.length} 個函數有返回值`
  };
}

/**
 * L7: 類型提示檢查 (TypeScript)
 */
function validate_l7_types(code) {
  // 檢查函數參數和返回值是否有類型註解
  const functions = code.match(/function\s+\w+[^{]*|const\s+\w+\s*=\s*\([^)]*\)\s*:\s*\w+\s*=>/g) || [];
  
  if (functions.length === 0) {
    return {
      layer: 7,
      name: '類型提示檢查',
      passed: true,
      message: '無函數需檢查'
    };
  }
  
  // 檢查是否有類型註解
  const withTypes = functions.filter(f => /:\s*\w+/.test(f));
  const coverage = withTypes.length / functions.length;
  
  if (coverage < 0.5) {
    return {
      layer: 7,
      name: '類型提示檢查',
      passed: false,
      severity: 'warning',
      message: `類型提示覆蓋率過低: ${Math.round(coverage * 100)}%`
    };
  }
  
  return {
    layer: 7,
    name: '類型提示檢查',
    passed: true,
    message: `類型提示覆蓋率: ${Math.round(coverage * 100)}%`
  };
}

/**
 * L12: 循環依賴檢查
 */
function validate_l12_circular_deps(code) {
  // 檢查是否有相對導入（可能導致循環依賴）
  const relativeImports = code.match(/from\s+['"]\.\.?\//g) || [];
  
  if (relativeImports.length > 5) {
    return {
      layer: 12,
      name: '循環依賴檢查',
      passed: false,
      severity: 'warning',
      message: `檢測到 ${relativeImports.length} 個相對導入，可能存在循環依賴風險`
    };
  }
  
  return {
    layer: 12,
    name: '循環依賴檢查',
    passed: true,
    message: `相對導入數量正常 (${relativeImports.length})`
  };
}

/**
 * L15: 錯誤處理檢查
 */
function validate_l15_error_handling(code) {
  // 檢查 try-catch 塊
  const tryBlocks = code.match(/try\s*\{[^}]*\}\s*catch/gs) || [];
  
  if (tryBlocks.length === 0) {
    return {
      layer: 15,
      name: '錯誤處理檢查',
      passed: true,
      message: '無 try-catch 塊'
    };
  }
  
  // 檢查是否有空的 catch 塊或只有 console.log
  const emptyCatch = tryBlocks.filter(block => {
    const catchPart = block.match(/catch[^{]*\{([^}]*)\}/s);
    if (!catchPart) return false;
    const catchBody = catchPart[1].trim();
    return catchBody === '' || /^console\.(log|error)/.test(catchBody);
  });
  
  if (emptyCatch.length > 0) {
    return {
      layer: 15,
      name: '錯誤處理檢查',
      passed: false,
      severity: 'warning',
      message: `發現 ${emptyCatch.length} 個空的或只有 console.log 的 catch 塊`
    };
  }
  
  return {
    layer: 15,
    name: '錯誤處理檢查',
    passed: true,
    message: `檢測到 ${tryBlocks.length} 個有效的錯誤處理塊`
  };
}

/**
 * L16: 安全性檢查
 */
function validate_l16_security(code) {
  const issues = [];
  
  // 檢查危險函數
  if (/\beval\s*\(/.test(code)) {
    issues.push('使用了 eval() 函數，存在代碼注入風險');
  }
  
  if (/\bexec\s*\(/.test(code)) {
    issues.push('使用了 exec() 函數，存在命令注入風險');
  }
  
  // 檢查寫死的密鑰
  const secretPatterns = [
    /api[_-]?key\s*=\s*['"][^'"]{10,}['"]/i,
    /password\s*=\s*['"][^'"]{8,}['"]/i,
    /secret\s*=\s*['"][^'"]{10,}['"]/i,
    /token\s*=\s*['"][^'"]{20,}['"]/i
  ];
  
  for (const pattern of secretPatterns) {
    if (pattern.test(code)) {
      issues.push('檢測到可能的寫死密鑰或密碼');
      break;
    }
  }
  
  // 檢查 SQL 注入風險
  if (/\$\{.*\}/.test(code) && /SELECT|INSERT|UPDATE|DELETE/i.test(code)) {
    issues.push('檢測到可能的 SQL 注入風險（使用字串插值）');
  }
  
  if (issues.length > 0) {
    return {
      layer: 16,
      name: '安全性檢查',
      passed: false,
      severity: 'critical',
      message: `發現 ${issues.length} 個安全問題`,
      issues
    };
  }
  
  return {
    layer: 16,
    name: '安全性檢查',
    passed: true,
    message: '未發現明顯安全問題'
  };
}

// ============================================================================
// GEMS 專用驗證
// ============================================================================

/**
 * L4-GEMS: GEMS 標籤檢查
 */
function validate_l4_gems_naming(code) {
  // 提取所有函數名
  const functions = [];
  const funcMatches = code.matchAll(/(?:function|const)\s+(\w+)/g);
  for (const match of funcMatches) {
    functions.push(match[1]);
  }
  
  if (functions.length === 0) {
    return {
      layer: '4-GEMS',
      name: 'GEMS 標籤檢查',
      passed: true,
      message: '無函數需檢查'
    };
  }
  
  // 檢查是否有 GEMS 標籤
  const hasGemsTags = /\/\*\*[\s\S]*?GEMS:/.test(code);
  
  if (!hasGemsTags) {
    return {
      layer: '4-GEMS',
      name: 'GEMS 標籤檢查',
      passed: false,
      severity: 'warning',
      message: '未找到 GEMS 標籤'
    };
  }
  
  return {
    layer: '4-GEMS',
    name: 'GEMS 標籤檢查',
    passed: true,
    message: `檢測到 GEMS 標籤`
  };
}

/**
 * L8-GEMS: GEMS 標籤完整性
 */
function validate_l8_gems_completeness(code) {
  // 提取 GEMS 標籤
  const gemsBlocks = code.match(/\/\*\*[\s\S]*?\*\//g) || [];
  const gemsTags = gemsBlocks.filter(block => /GEMS:/.test(block));
  
  if (gemsTags.length === 0) {
    return {
      layer: '8-GEMS',
      name: 'GEMS 標籤完整性',
      passed: true,
      message: '無 GEMS 標籤需檢查'
    };
  }
  
  const issues = [];
  
  for (const tag of gemsTags) {
    // 檢查必要欄位
    if (!/GEMS:/.test(tag)) issues.push('缺少 GEMS 主標籤');
    if (!/GEMS-FLOW:/.test(tag)) issues.push('缺少 GEMS-FLOW');
    
    // 檢查 P0/P1 是否有 STEP 錨點
    const priorityMatch = tag.match(/\|\s*P([0-3])\s*\|/);
    if (priorityMatch && ['0', '1'].includes(priorityMatch[1])) {
      const hasSteps = code.includes('// [STEP]');
      if (!hasSteps) {
        issues.push(`P${priorityMatch[1]} 函式缺少 [STEP] 錨點`);
      }
    }
  }
  
  if (issues.length > 0) {
    return {
      layer: '8-GEMS',
      name: 'GEMS 標籤完整性',
      passed: false,
      severity: 'warning',
      message: `發現 ${issues.length} 個問題`,
      issues
    };
  }
  
  return {
    layer: '8-GEMS',
    name: 'GEMS 標籤完整性',
    passed: true,
    message: `${gemsTags.length} 個 GEMS 標籤完整`
  };
}

/**
 * L14-GEMS: GEMS-FLOW 完整性
 */
function validate_l14_gems_flow(code) {
  // 提取 GEMS-FLOW
  const flowMatches = code.matchAll(/GEMS-FLOW:\s*([^\n*]+)/g);
  const flows = [];
  for (const match of flowMatches) {
    flows.push(match[1].trim());
  }
  
  if (flows.length === 0) {
    return {
      layer: '14-GEMS',
      name: 'GEMS-FLOW 完整性',
      passed: true,
      message: '無 GEMS-FLOW 需檢查'
    };
  }
  
  const issues = [];
  
  for (const flow of flows) {
    // 解析 GEMS-FLOW: Step1→Step2→Step3
    const steps = flow.split('→').map(s => s.trim());
    
    // 檢查每個步驟是否有對應的 [STEP] 錨點
    for (const step of steps) {
      const hasStep = code.includes(`// [STEP] ${step}`);
      if (!hasStep) {
        issues.push(`GEMS-FLOW 中 ${step} 缺少對應的 [STEP] 錨點`);
      }
    }
  }
  
  if (issues.length > 0) {
    return {
      layer: '14-GEMS',
      name: 'GEMS-FLOW 完整性',
      passed: false,
      severity: 'warning',
      message: `發現 ${issues.length} 個問題`,
      issues
    };
  }
  
  return {
    layer: '14-GEMS',
    name: 'GEMS-FLOW 完整性',
    passed: true,
    message: `${flows.length} 個 GEMS-FLOW 完整`
  };
}

// ============================================================================
// 批量驗證
// ============================================================================

/**
 * 批量驗證多個檔案
 */
function validateBatch(filePaths, options = {}) {
  const results = [];
  let totalIssues = 0;
  let criticalCount = 0;
  
  for (const filePath of filePaths) {
    const result = validateCode(filePath, options);
    
    if (!result.skipped) {
      results.push(result);
      totalIssues += result.summary.failed;
      criticalCount += result.summary.critical;
    }
  }
  
  return {
    results,
    summary: {
      totalFiles: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      totalIssues,
      criticalCount
    }
  };
}

// 自我測試
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('用法: node code-validator.cjs <file-path>');
    process.exit(1);
  }
  
  const filePath = args[0];
  const result = validateCode(filePath, { verbose: true });
  
  console.log('\n=== 代碼驗證結果 ===');
  console.log(`檔案: ${result.file}`);
  console.log(`總體: ${result.passed ? '✅ 通過' : '❌ 失敗'}`);
  console.log(`\n檢查層級: ${result.summary.passed}/${result.summary.total} 通過`);
  
  if (result.criticalIssues.length > 0) {
    console.log(`\n🔴 嚴重問題 (${result.criticalIssues.length}):`);
    result.criticalIssues.forEach(issue => console.log(`  - ${issue}`));
  }
  
  if (result.warnings.length > 0) {
    console.log(`\n🟡 警告 (${result.warnings.length}):`);
    result.warnings.forEach(warning => console.log(`  - ${warning}`));
  }
  
  console.log('\n===================\n');
}

module.exports = {
  validateCode,
  validateBatch
};
