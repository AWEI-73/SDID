#!/usr/bin/env node
/**
 * 安全檔案替換工具 v1.0
 * 強制使用 UTF-8 無 BOM 編碼，避免 PowerShell 編碼問題
 * 
 * 用法:
 *   node task-pipe/tools/safe-replace.cjs <file> <search> <replace>
 *   node task-pipe/tools/safe-replace.cjs --batch <dir> <search> <replace> [--ext=.ts,.tsx]
 */
const fs = require('fs');
const path = require('path');

/**
 * 安全讀取檔案 (移除 BOM)
 */
function safeRead(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 移除 BOM
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  return content;
}

/**
 * 安全寫入檔案 (UTF-8 無 BOM)
 */
function safeWrite(filePath, content) {
  // 確保目錄存在
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // 寫入時強制 UTF-8 無 BOM
  fs.writeFileSync(filePath, content, { encoding: 'utf8' });
}

/**
 * 安全替換單一檔案
 */
function safeReplace(filePath, searchPattern, replacement) {
  const content = safeRead(filePath);
  
  // 支援字串或正則
  const pattern = searchPattern instanceof RegExp 
    ? searchPattern 
    : new RegExp(escapeRegex(searchPattern), 'g');
  
  const newContent = content.replace(pattern, replacement);
  
  if (content !== newContent) {
    safeWrite(filePath, newContent);
    return { changed: true, filePath };
  }
  
  return { changed: false, filePath };
}

/**
 * 批量替換目錄下的檔案
 */
function batchReplace(dir, searchPattern, replacement, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const results = [];
  
  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    
    const files = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(currentDir, file.name);
      
      if (file.isDirectory()) {
        if (!file.name.startsWith('.') && file.name !== 'node_modules' && file.name !== 'dist') {
          walk(fullPath);
        }
      } else if (file.isFile() && extensions.some(ext => file.name.endsWith(ext))) {
        const result = safeReplace(fullPath, searchPattern, replacement);
        results.push(result);
      }
    }
  }
  
  walk(dir);
  return results;
}

/**
 * 強制重寫檔案為 UTF-8 無 BOM (不做替換，只修正編碼)
 */
function fixEncoding(filePath) {
  const content = safeRead(filePath);
  safeWrite(filePath, content);
  return { fixed: true, filePath };
}

/**
 * 批量修正編碼
 */
function batchFixEncoding(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const results = [];
  
  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    
    const files = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(currentDir, file.name);
      
      if (file.isDirectory()) {
        if (!file.name.startsWith('.') && file.name !== 'node_modules' && file.name !== 'dist') {
          walk(fullPath);
        }
      } else if (file.isFile() && extensions.some(ext => file.name.endsWith(ext))) {
        const result = fixEncoding(fullPath);
        results.push(result);
      }
    }
  }
  
  walk(dir);
  return results;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { safeRead, safeWrite, safeReplace, batchReplace, fixEncoding, batchFixEncoding };

// CLI 執行
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === '--fix-encoding') {
    // 修正編碼模式
    const dir = args[1] || 'src';
    console.log(`Fixing encoding in: ${dir}`);
    const results = batchFixEncoding(dir);
    console.log(`Fixed ${results.length} files`);
  } else if (args[0] === '--batch') {
    // 批量替換模式
    const dir = args[1];
    const search = args[2];
    const replace = args[3];
    const extArg = args.find(a => a.startsWith('--ext='));
    const extensions = extArg ? extArg.split('=')[1].split(',') : ['.ts', '.tsx', '.js', '.jsx'];
    
    if (!dir || !search) {
      console.log('Usage: node safe-replace.cjs --batch <dir> <search> <replace> [--ext=.ts,.tsx]');
      process.exit(1);
    }
    
    console.log(`Batch replacing in: ${dir}`);
    const results = batchReplace(dir, search, replace || '', extensions);
    const changed = results.filter(r => r.changed);
    console.log(`Changed ${changed.length}/${results.length} files`);
  } else {
    // 單檔替換模式
    const file = args[0];
    const search = args[1];
    const replace = args[2];
    
    if (!file || !search) {
      console.log('Usage: node safe-replace.cjs <file> <search> <replace>');
      console.log('       node safe-replace.cjs --batch <dir> <search> <replace>');
      console.log('       node safe-replace.cjs --fix-encoding <dir>');
      process.exit(1);
    }
    
    const result = safeReplace(file, search, replace || '');
    console.log(result.changed ? `Changed: ${file}` : `No change: ${file}`);
  }
}
