#!/usr/bin/env node
/**
 * Security Checker - 安全檢查封裝
 * 
 * 提供統一的安全檢查接口
 * 可選啟用，不會阻塞主流程
 */
const fs = require('fs');
const path = require('path');
const { runSecurityCheck, runBasicSecurityCheck } = require('./bluemouse-adapter.cjs');

/**
 * 檢查是否啟用安全檢查
 */
function isSecurityCheckEnabled() {
  // 1. 檢查環境變數
  if (process.env.ENABLE_SECURITY_CHECK === 'true') {
    return true;
  }

  // 2. 檢查 config.json
  try {
    const configPath = path.join(__dirname, '..', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.bluemouse?.securityCheck?.enabled) {
        return true;
      }
    }
  } catch (err) {
    // 忽略配置讀取錯誤
  }

  // 預設不啟用
  return false;
}

/**
 * 執行安全檢查
 * 
 * @param {string} filePath - 檔案路徑
 * @param {object} options - 選項
 * @returns {object} 檢查結果
 */
function checkSecurity(filePath, options = {}) {
  const {
    failOnCritical = false,  // 是否在發現嚴重問題時失敗
    verbose = false          // 是否輸出詳細資訊
  } = options;

  // 檢查是否啟用
  if (!isSecurityCheckEnabled()) {
    if (verbose) {
      console.log('[Security] 安全檢查未啟用，跳過');
    }
    return {
      skipped: true,
      reason: 'disabled'
    };
  }

  // 檢查檔案是否存在
  if (!fs.existsSync(filePath)) {
    return {
      skipped: true,
      reason: 'file_not_found'
    };
  }

  // 讀取檔案內容
  const code = fs.readFileSync(filePath, 'utf-8');

  // 嘗試使用 BlueMouse 的完整檢查
  let result = runSecurityCheck(filePath);

  // 如果 BlueMouse 不可用，使用內建檢查
  if (result.skipped) {
    if (verbose) {
      console.log('[Security] 使用內建安全檢查');
    }
    result = runBasicSecurityCheck(code);
  }

  // 分析結果
  const hasCritical = result.issues?.some(i => i.severity === 'critical');
  const hasHigh = result.issues?.some(i => i.severity === 'high');

  // 輸出結果
  if (verbose || result.issues?.length > 0) {
    console.log('\n=== 安全檢查結果 ===');
    console.log(`檔案: ${path.basename(filePath)}`);
    
    if (result.issues && result.issues.length > 0) {
      console.log(`\n發現 ${result.issues.length} 個問題:\n`);
      result.issues.forEach((issue, idx) => {
        const icon = issue.severity === 'critical' ? '🔴' : 
                     issue.severity === 'high' ? '🟠' : '🟡';
        console.log(`${icon} [${issue.severity.toUpperCase()}] ${issue.message}`);
      });
    } else {
      console.log('✅ 未發現安全問題');
    }
    
    if (result.note) {
      console.log(`\n💡 ${result.note}`);
    }
    console.log('===================\n');
  }

  // 決定是否失敗
  const shouldFail = failOnCritical && hasCritical;

  return {
    ...result,
    passed: !shouldFail && (result.passed !== false),
    hasCritical,
    hasHigh,
    shouldFail
  };
}

/**
 * 批量檢查多個檔案
 * 
 * @param {string[]} filePaths - 檔案路徑列表
 * @param {object} options - 選項
 * @returns {object} 彙總結果
 */
function checkSecurityBatch(filePaths, options = {}) {
  const results = [];
  let totalIssues = 0;
  let criticalCount = 0;
  let highCount = 0;

  for (const filePath of filePaths) {
    const result = checkSecurity(filePath, { ...options, verbose: false });
    
    if (!result.skipped) {
      results.push({
        file: path.basename(filePath),
        ...result
      });

      if (result.issues) {
        totalIssues += result.issues.length;
        criticalCount += result.issues.filter(i => i.severity === 'critical').length;
        highCount += result.issues.filter(i => i.severity === 'high').length;
      }
    }
  }

  // 輸出彙總
  console.log('\n=== 安全檢查彙總 ===');
  console.log(`檢查檔案: ${results.length}`);
  console.log(`總問題數: ${totalIssues}`);
  console.log(`  🔴 嚴重: ${criticalCount}`);
  console.log(`  🟠 高風險: ${highCount}`);
  console.log(`  🟡 中低風險: ${totalIssues - criticalCount - highCount}`);
  console.log('===================\n');

  return {
    results,
    summary: {
      totalFiles: results.length,
      totalIssues,
      criticalCount,
      highCount
    }
  };
}

// 自我測試
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'test-security') {
    // 創建測試檔案
    const testFile = path.join(__dirname, 'test-security-sample.js');
    fs.writeFileSync(testFile, `
// 測試檔案 - 包含安全問題
const apiKey = "sk-1234567890abcdef";
const password = "hardcoded123";

function processUserInput(input) {
  return eval(input);  // 危險！
}

const query = \`SELECT * FROM users WHERE id = \${userId}\`;  // SQL 注入風險
`);

    console.log('測試安全檢查...\n');
    const result = checkSecurity(testFile, { verbose: true, failOnCritical: false });
    
    // 清理測試檔案
    fs.unlinkSync(testFile);
    
    console.log('\n測試完成！');
    console.log(`結果: ${result.passed ? '通過' : '失敗'}`);
    console.log(`發現問題: ${result.issues?.length || 0}`);
  } else {
    console.log('用法:');
    console.log('  node security-checker.cjs test-security');
  }
}

module.exports = {
  isSecurityCheckEnabled,
  checkSecurity,
  checkSecurityBatch
};
