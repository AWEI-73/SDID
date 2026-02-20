#!/usr/bin/env node
/**
 * UI Bind 驗證器 v1.0
 * 
 * 驗證 @GEMS-UI-BIND 標籤與實際 HTML/JS 的一致性
 * 
 * 標籤格式：
 * @GEMS-UI-BIND: ModuleName
 * - #selector (type) → handler:event
 * - #selector (type) ← initFunction
 * - #selector (type) → handler:event ← initFunction
 * 
 * 驗證規則：
 * 1. HTML 必須存在對應的 selector
 * 2. JS 必須存在對應的 handler/init 函式
 * 3. 同一個 selector 不能重複定義
 */
const fs = require('fs');
const path = require('path');

/**
 * 解析 @GEMS-UI-BIND 標籤
 * @param {string} content - 檔案內容
 * @returns {Array<{module: string, bindings: Array}>}
 */
function parseUIBindTags(content) {
  const results = [];
  
  // 匹配 @GEMS-UI-BIND 區塊
  const blockPattern = /@GEMS-UI-BIND:\s*(\w+)\s*\n((?:\s*\*?\s*-\s*#[\w-]+.*\n?)+)/g;
  let match;
  
  while ((match = blockPattern.exec(content)) !== null) {
    const moduleName = match[1];
    const bindingsBlock = match[2];
    const bindings = [];
    
    // 解析每一行 binding
    // 格式: - #selector (type) → handler:event ← initFunction
    const linePattern = /-\s*#([\w-]+)\s*\((\w+)\)\s*(?:→\s*(\w+):(\w+))?\s*(?:←\s*(\w+))?/g;
    let lineMatch;
    
    while ((lineMatch = linePattern.exec(bindingsBlock)) !== null) {
      bindings.push({
        selector: `#${lineMatch[1]}`,
        type: lineMatch[2],
        handler: lineMatch[3] || null,
        event: lineMatch[4] || null,
        init: lineMatch[5] || null
      });
    }
    
    results.push({ module: moduleName, bindings });
  }
  
  return results;
}

/**
 * 從 HTML 檔案提取所有 ID
 * @param {string} htmlPath - HTML 檔案路徑
 * @returns {Set<string>} ID 集合
 */
function extractHtmlIds(htmlPath) {
  const ids = new Set();
  
  if (!fs.existsSync(htmlPath)) {
    return ids;
  }
  
  const content = fs.readFileSync(htmlPath, 'utf8');
  
  // 匹配 id="xxx" 或 id='xxx'
  const idPattern = /id=["']([^"']+)["']/g;
  let match;
  
  while ((match = idPattern.exec(content)) !== null) {
    ids.add(`#${match[1]}`);
  }
  
  return ids;
}

/**
 * 從 JS/TS 檔案提取所有函式名稱
 * @param {string} srcPath - 源碼目錄
 * @returns {Set<string>} 函式名稱集合
 */
function extractJsFunctions(srcPath) {
  const functions = new Set();
  
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        if (!file.name.startsWith('.') && 
            file.name !== 'node_modules' && 
            file.name !== 'dist' &&
            file.name !== '__tests__') {
          walk(fullPath);
        }
      } else if (file.isFile() && /\.(ts|tsx|js|jsx)$/.test(file.name) && !file.name.includes('.test.')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // 匹配函式宣告
        // function xxx() | const xxx = | export function xxx | export const xxx =
        const fnPatterns = [
          /function\s+(\w+)\s*\(/g,
          /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g,
          /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?function/g,
          /export\s+(?:async\s+)?function\s+(\w+)/g,
          /export\s+(?:const|let)\s+(\w+)\s*=/g,
          /(\w+)\s*:\s*(?:async\s*)?\([^)]*\)\s*(?:=>|{)/g  // 物件方法
        ];
        
        for (const pattern of fnPatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            functions.add(match[1]);
          }
        }
      }
    }
  }
  
  walk(srcPath);
  return functions;
}

/**
 * 驗證 UI Bind 一致性
 * @param {string} projectRoot - 專案根目錄
 * @param {string} srcPath - 源碼目錄
 * @param {string} htmlPath - HTML 檔案路徑
 * @returns {Object} 驗證結果
 */
function validateUIBind(projectRoot, srcPath, htmlPath) {
  const result = {
    valid: true,
    bindings: [],
    issues: [],
    stats: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };
  
  // 1. 從源碼提取 @GEMS-UI-BIND 標籤
  const allBindings = [];
  
  function walkSrc(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        if (!file.name.startsWith('.') && 
            file.name !== 'node_modules' && 
            file.name !== 'dist') {
          walkSrc(fullPath);
        }
      } else if (file.isFile() && /\.(ts|tsx|js|jsx)$/.test(file.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const parsed = parseUIBindTags(content);
        
        for (const block of parsed) {
          for (const binding of block.bindings) {
            allBindings.push({
              ...binding,
              module: block.module,
              file: path.relative(projectRoot, fullPath)
            });
          }
        }
      }
    }
  }
  
  walkSrc(srcPath);
  
  // 如果沒有 UI Bind 標籤，跳過驗證
  if (allBindings.length === 0) {
    result.skipped = true;
    result.reason = '無 @GEMS-UI-BIND 標籤';
    return result;
  }
  
  // 2. 提取 HTML IDs
  const htmlIds = extractHtmlIds(htmlPath);
  
  // 3. 提取 JS 函式
  const jsFunctions = extractJsFunctions(srcPath);
  
  // 4. 驗證每個 binding
  const seenSelectors = new Set();
  
  for (const binding of allBindings) {
    result.stats.total++;
    const bindingIssues = [];
    
    // 檢查重複 selector
    if (seenSelectors.has(binding.selector)) {
      bindingIssues.push({
        type: 'DUPLICATE_SELECTOR',
        message: `重複的 selector: ${binding.selector}`
      });
    }
    seenSelectors.add(binding.selector);
    
    // 檢查 HTML ID 存在
    if (!htmlIds.has(binding.selector)) {
      bindingIssues.push({
        type: 'MISSING_HTML_ID',
        message: `HTML 缺少 ID: ${binding.selector}`,
        suggestion: `在 HTML 中加入 <${binding.type} id="${binding.selector.slice(1)}">`
      });
    }
    
    // 檢查 handler 函式存在
    if (binding.handler && !jsFunctions.has(binding.handler)) {
      bindingIssues.push({
        type: 'MISSING_HANDLER',
        message: `JS 缺少 handler: ${binding.handler}`,
        suggestion: `實作函式 function ${binding.handler}(event) { ... }`
      });
    }
    
    // 檢查 init 函式存在
    if (binding.init && !jsFunctions.has(binding.init)) {
      bindingIssues.push({
        type: 'MISSING_INIT',
        message: `JS 缺少 init 函式: ${binding.init}`,
        suggestion: `實作函式 function ${binding.init}() { ... }`
      });
    }
    
    if (bindingIssues.length > 0) {
      result.stats.failed++;
      result.issues.push(...bindingIssues.map(i => ({
        ...i,
        binding,
        file: binding.file
      })));
    } else {
      result.stats.passed++;
    }
    
    result.bindings.push({
      ...binding,
      valid: bindingIssues.length === 0,
      issues: bindingIssues
    });
  }
  
  result.valid = result.stats.failed === 0;
  return result;
}

/**
 * 格式化驗證結果
 * @param {Object} result - 驗證結果
 * @returns {string} 格式化的報告
 */
function formatResult(result) {
  const lines = [
    '═══════════════════════════════════════════════════════════════',
    '  UI BIND VALIDATION REPORT',
    '═══════════════════════════════════════════════════════════════',
    ''
  ];
  
  if (result.skipped) {
    lines.push(`⏭️ 跳過: ${result.reason}`);
    lines.push('═══════════════════════════════════════════════════════════════');
    return lines.join('\n');
  }
  
  lines.push(`📊 統計: ${result.stats.total} 個 binding | ✅ ${result.stats.passed} | ❌ ${result.stats.failed}`);
  lines.push('');
  
  if (result.issues.length > 0) {
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push('  ISSUES');
    lines.push('─────────────────────────────────────────────────────────────────');
    
    for (const issue of result.issues) {
      lines.push(`  ❌ ${issue.message}`);
      lines.push(`     檔案: ${issue.file}`);
      if (issue.suggestion) {
        lines.push(`     建議: ${issue.suggestion}`);
      }
      lines.push('');
    }
  }
  
  lines.push('═══════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

module.exports = { 
  parseUIBindTags, 
  extractHtmlIds, 
  extractJsFunctions, 
  validateUIBind, 
  formatResult 
};

// CLI 執行
if (require.main === module) {
  const args = process.argv.slice(2);
  const projectRoot = args[0] || '.';
  const srcPath = path.join(projectRoot, 'src');
  const htmlPath = path.join(projectRoot, 'index.html');
  
  console.log(`Validating UI Bind in: ${projectRoot}`);
  const result = validateUIBind(projectRoot, srcPath, htmlPath);
  console.log(formatResult(result));
  
  process.exit(result.valid || result.skipped ? 0 : 1);
}
