#!/usr/bin/env node
/**
 * 編碼驗證器 v1.0
 * 檢查原始碼檔案是否為有效 UTF-8 (無 BOM、無亂碼)
 * 
 * 用途：在 BUILD Phase 2 執行，確保檔案編碼正確後再掃描 GEMS 標籤
 */
const fs = require('fs');
const path = require('path');

/**
 * 檢查單一檔案是否為有效 UTF-8
 * @param {string} filePath - 檔案路徑
 * @returns {{ valid: boolean, hasBom: boolean, hasCorruption: boolean, corruptionType?: string }}
 */
function validateUtf8(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    
    // 檢查 BOM (UTF-8 BOM = EF BB BF)
    const hasBom = buffer.length >= 3 && 
                   buffer[0] === 0xEF && 
                   buffer[1] === 0xBB && 
                   buffer[2] === 0xBF;
    
    // 轉換為字串檢查亂碼
    const content = buffer.toString('utf8');
    
    // 常見亂碼特徵
    const corruptionChecks = [
      { pattern: /\uFFFD/, type: 'Unicode replacement character (�)' },
      { pattern: /\?{3,}/, type: 'Multiple question marks (???)' },
      { pattern: /[\x00-\x08\x0B\x0C\x0E-\x1F]/, type: 'Invalid control characters' },
      { pattern: /\?\?\?[^\s]/, type: 'Mojibake pattern' },
    ];
    
    for (const check of corruptionChecks) {
      if (check.pattern.test(content)) {
        return {
          valid: false,
          hasBom,
          hasCorruption: true,
          corruptionType: check.type,
          filePath
        };
      }
    }
    
    return {
      valid: !hasBom,
      hasBom,
      hasCorruption: false,
      filePath
    };
  } catch (e) {
    return {
      valid: false,
      hasBom: false,
      hasCorruption: true,
      corruptionType: `Read error: ${e.message}`,
      filePath
    };
  }
}

/**
 * 掃描目錄下所有原始碼檔案的編碼
 * @param {string} srcPath - 原始碼目錄
 * @param {string[]} extensions - 要檢查的副檔名
 * @returns {{ issues: Array, scanned: number, passed: number }}
 */
function scanEncoding(srcPath, extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md']) {
  const issues = [];
  let scanned = 0;
  let passed = 0;
  
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      
      // 跳過隱藏目錄和 node_modules
      if (file.isDirectory()) {
        if (!file.name.startsWith('.') && file.name !== 'node_modules' && file.name !== 'dist') {
          walk(fullPath);
        }
      } else if (file.isFile() && extensions.some(ext => file.name.endsWith(ext))) {
        scanned++;
        const result = validateUtf8(fullPath);
        if (!result.valid) {
          issues.push(result);
        } else {
          passed++;
        }
      }
    }
  }
  
  walk(srcPath);
  return { issues, scanned, passed };
}

/**
 * 格式化檢查結果為 log 輸出
 */
function formatResult(result, projectRoot) {
  const lines = [
    '═══════════════════════════════════════════════════════════════',
    '  ENCODING VALIDATION REPORT',
    '═══════════════════════════════════════════════════════════════',
    '',
    `📁 Scanned: ${result.scanned} files`,
    `✅ Passed: ${result.passed} files`,
    `❌ Issues: ${result.issues.length} files`,
    ''
  ];
  
  if (result.issues.length > 0) {
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push('  ENCODING ISSUES FOUND');
    lines.push('─────────────────────────────────────────────────────────────────');
    
    for (const issue of result.issues) {
      const relPath = path.relative(projectRoot, issue.filePath);
      lines.push(`  ❌ ${relPath}`);
      if (issue.hasBom) lines.push(`     └─ Has UTF-8 BOM (should be removed)`);
      if (issue.hasCorruption) lines.push(`     └─ ${issue.corruptionType}`);
    }
    
    lines.push('');
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push('  FIX INSTRUCTIONS');
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push('  1. 使用 node task-pipe/tools/safe-replace.cjs 重寫檔案');
    lines.push('  2. 或在編輯器中另存為 UTF-8 (無 BOM)');
    lines.push('  3. 禁止使用 PowerShell Get-Content/Set-Content 批量替換');
    lines.push('');
  }
  
  lines.push('═══════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

module.exports = { validateUtf8, scanEncoding, formatResult };

// CLI 執行
if (require.main === module) {
  const args = process.argv.slice(2);
  const srcPath = args[0] || 'src';
  
  console.log(`Scanning encoding in: ${srcPath}`);
  const result = scanEncoding(srcPath);
  console.log(formatResult(result, process.cwd()));
  
  process.exit(result.issues.length > 0 ? 1 : 0);
}
