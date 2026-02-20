#!/usr/bin/env node
/**
 * BlueMouse Adapter V2 - 純 JavaScript 版本
 * 
 * 簡化版，只保留核心功能：
 * 1. 蘇格拉底問題生成
 * 2. 安全性檢查
 * 
 * 不需要 Python，不需要外部依賴
 */
const { generateSocraticQuestions, formatQuestionsForCLI } = require('./socratic-generator.cjs');
const { runBasicSecurityCheck } = require('./security-checker.cjs');

/**
 * 生成蘇格拉底問題（統一接口）
 */
function generateQuestions(requirement, language = 'zh-TW') {
  return generateSocraticQuestions(requirement, language);
}

/**
 * 執行安全檢查（統一接口）
 */
function checkSecurity(code) {
  return runBasicSecurityCheck(code);
}

// 自我測試
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'test-socratic') {
    console.log('=== 測試蘇格拉底問題生成 ===\n');
    const result = generateQuestions('建立一個電商平台，有購物車和結帳功能', 'zh-TW');
    console.log(formatQuestionsForCLI(result));
  } else if (args[0] === 'test-security') {
    console.log('=== 測試安全檢查 ===\n');
    const testCode = `
const password = "hardcoded123";
const result = eval(userInput);
`;
    const result = checkSecurity(testCode);
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('用法:');
    console.log('  node bluemouse-adapter-v2.cjs test-socratic');
    console.log('  node bluemouse-adapter-v2.cjs test-security');
  }
}

module.exports = {
  generateQuestions,
  generateSocraticQuestions,
  checkSecurity,
  formatQuestionsForCLI
};
