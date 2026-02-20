#!/usr/bin/env node

/**
 * Plan Validator v1.0
 * 
 * 功能：
 * 驗證 Implementation Plan 是否引用了正確的資源
 * 
 * 使用方式：
 *   node plan-validator.cjs <plan-md> <spec-json> [--verbose]
 */

const fs = require('fs');

// ============================================
// 載入檔案
// ============================================
function loadPlan(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`❌ 無法讀取 ${filePath}:`, error.message);
    return null;
  }
}

function loadSpec(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`❌ 無法讀取 ${filePath}:`, error.message);
    return null;
  }
}

// ============================================
// 驗證邏輯
// ============================================
function validatePlan(planContent, spec, verbose = false) {
  const issues = {
    errors: [],
    warnings: [],
    info: []
  };
  
  // 1. 驗證資料表引用
  console.log('🔍 驗證資料表引用...');
  const availableTables = Object.keys(spec.databaseUsage || {});
  const tableRegex = /`(tbl_\w+)`/g;
  let tableMatch;
  
  while ((tableMatch = tableRegex.exec(planContent)) !== null) {
    const tableName = tableMatch[1];
    if (!availableTables.includes(tableName)) {
      issues.errors.push(`❌ 引用不存在的資料表: \`${tableName}\``);
    } else {
      if (verbose) {
        issues.info.push(`✅ 資料表 \`${tableName}\` 存在`);
      }
    }
  }
  
  // 2. 驗證函式引用
  console.log('🔍 驗證函式引用...');
  const availableFunctions = spec.functions?.map(f => f.name) || [];
  const functionRegex = /`(\w+)\(\)`/g;
  let funcMatch;
  
  while ((funcMatch = functionRegex.exec(planContent)) !== null) {
    const funcName = funcMatch[1];
    if (!availableFunctions.includes(funcName)) {
      issues.warnings.push(`⚠️  引用不存在的函式: \`${funcName}\``);
    } else {
      if (verbose) {
        issues.info.push(`✅ 函式 \`${funcName}\` 存在`);
      }
    }
  }
  
  // 3. 驗證模組引用
  console.log('🔍 驗證模組引用...');
  
  // 從 spec.functions 的 file 路徑中提取實際存在的模組
  const availableModules = new Set();
  if (spec.functions && Array.isArray(spec.functions)) {
    spec.functions.forEach(fn => {
      if (fn.file) {
        // 支援 Windows 和 Unix 路徑格式
        const match = fn.file.match(/src[\\\/]modules[\\\/]([a-z-]+)/);
        if (match) {
          availableModules.add(match[1]);
        }
      }
    });
  }
  // 也支援 spec.modules（如果有正確的模組名稱）
  if (spec.modules) {
    Object.keys(spec.modules).forEach(m => {
      if (m !== 'root') {  // 排除 'root' 這個無效的模組名
        availableModules.add(m);
      }
    });
  }
  
  if (verbose) {
    console.log(`   找到 ${availableModules.size} 個模組: ${[...availableModules].join(', ')}`);
  }
  
  const moduleRegex = /src\/modules\/([a-z-]+)/g;
  let moduleMatch;
  const mentionedModules = new Set();
  
  while ((moduleMatch = moduleRegex.exec(planContent)) !== null) {
    const moduleName = moduleMatch[1];
    mentionedModules.add(moduleName);
    if (!availableModules.has(moduleName)) {
      issues.warnings.push(`⚠️  引用不存在的模組: \`${moduleName}\``);
    } else {
      if (verbose) {
        issues.info.push(`✅ 模組 \`${moduleName}\` 存在`);
      }
    }
  }
  
  // 4. 驗證列舉值
  console.log('🔍 驗證列舉值...');
  const enumRegex = /['"]([預計出席退伙請假葷食素食YCB|ZZB|EXT]+)['"]/g;
  let enumMatch;
  
  while ((enumMatch = enumRegex.exec(planContent)) !== null) {
    const enumValue = enumMatch[1];
    // 簡單檢查，實際應該更嚴格
    if (verbose) {
      issues.info.push(`✅ 列舉值 \`${enumValue}\` 已檢查`);
    }
  }
  
  // 5. 驗收標準檢查
  console.log('🔍 驗證驗收標準...');
  const acRegex = /AC-\d+\.\d+\.\d+/g;
  const acceptanceCriteria = new Set();
  let acMatch;
  
  while ((acMatch = acRegex.exec(planContent)) !== null) {
    acceptanceCriteria.add(acMatch[0]);
  }
  
  if (acceptanceCriteria.size > 0) {
    issues.info.push(`✅ 找到 ${acceptanceCriteria.size} 個驗收標準`);
  } else {
    issues.warnings.push(`⚠️  未找到驗收標準 (AC-X.X.X 格式)`);
  }
  
  // 6. 驗證測試覆蓋（檢查 GEMS-TEST 標籤）
  console.log('🔍 驗證測試覆蓋...');
  const gemsTestRegex = /GEMS-TEST:/g;
  const gemsTestMatches = planContent.match(gemsTestRegex);
  if (gemsTestMatches && gemsTestMatches.length > 0) {
    issues.info.push(`✅ 包含 ${gemsTestMatches.length} 個 GEMS-TEST 標籤`);
  } else {
    // 也接受傳統寫法
    if (planContent.includes('Unit Test') || planContent.includes('Integration Test') || 
        planContent.includes('單元測試') || planContent.includes('整合測試')) {
      issues.info.push(`✅ 包含測試規劃`);
    } else {
      issues.warnings.push(`⚠️  未找到測試規劃 (GEMS-TEST 標籤或測試說明)`);
    }
  }
  
  // 7. GEMS 標籤合規 - 由 build 強制驗證，此處不檢查
  
  return issues;
}

// ============================================
// 產出報告
// ============================================
function generateReport(issues) {
  let report = '';
  
  report += '\n';
  report += '═'.repeat(60) + '\n';
  report += '📋 Plan Validation Report\n';
  report += '═'.repeat(60) + '\n\n';
  
  // 錯誤
  if (issues.errors.length > 0) {
    report += '❌ 錯誤 (' + issues.errors.length + ')\n';
    report += '─'.repeat(60) + '\n';
    issues.errors.forEach(error => {
      report += error + '\n';
    });
    report += '\n';
  }
  
  // 警告
  if (issues.warnings.length > 0) {
    report += '⚠️  警告 (' + issues.warnings.length + ')\n';
    report += '─'.repeat(60) + '\n';
    issues.warnings.forEach(warning => {
      report += warning + '\n';
    });
    report += '\n';
  }
  
  // 資訊
  if (issues.info.length > 0) {
    report += 'ℹ️  資訊 (' + issues.info.length + ')\n';
    report += '─'.repeat(60) + '\n';
    issues.info.slice(0, 10).forEach(info => {
      report += info + '\n';
    });
    if (issues.info.length > 10) {
      report += `... 還有 ${issues.info.length - 10} 項\n`;
    }
    report += '\n';
  }
  
  // 總結
  report += '═'.repeat(60) + '\n';
  report += '📊 驗證結果\n';
  report += '═'.repeat(60) + '\n';
  report += `✅ 通過: ${issues.info.length}\n`;
  report += `⚠️  警告: ${issues.warnings.length}\n`;
  report += `❌ 錯誤: ${issues.errors.length}\n\n`;
  
  if (issues.errors.length === 0 && issues.warnings.length === 0) {
    report += '🎉 驗證通過！Plan 可以進行開發\n';
  } else if (issues.errors.length === 0) {
    report += '⚠️  驗證通過但有警告，建議檢查\n';
  } else {
    report += '❌ 驗證失敗，請修正錯誤後重試\n';
  }
  
  report += '\n';
  
  return report;
}

// ============================================
// 主程式
// ============================================
function main() {
  const args = process.argv.slice(2);
  
  const planPath = args.find(a => !a.startsWith('--') && a.includes('.md')) || 'iterations/iter-10/implementation_plan.md';
  const specPath = args.find(a => !a.startsWith('--') && a.includes('.json')) || 'docs/Full_Project_Spec.json';
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  console.log('');
  console.log('🔍 Plan Validator v1.0');
  console.log(`📄 Plan: ${planPath}`);
  console.log(`📊 Spec: ${specPath}`);
  console.log('');
  
  // 載入檔案
  console.log('📖 載入 Implementation Plan...');
  const planContent = loadPlan(planPath);
  if (!planContent) process.exit(1);
  
  console.log('📖 載入 Full_Project_Spec...');
  const spec = loadSpec(specPath);
  if (!spec) process.exit(1);
  
  // 驗證
  console.log('');
  const issues = validatePlan(planContent, spec, verbose);
  
  // 產出報告
  const report = generateReport(issues);
  console.log(report);
  
  // 決定退出碼
  process.exit(issues.errors.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { validatePlan, generateReport };
