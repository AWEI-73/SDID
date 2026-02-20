#!/usr/bin/env node
/**
 * Contract Generator v1.0
 * 
 * 產出 Semantic Contract Layer - 整合需求 → 程式碼的對應關係
 * 
 * 掃描來源：
 * - @GEMS-CONTRACT: 資料契約
 * - @GEMS-UI-BIND: UI 綁定
 * - GEMS: 函式標籤
 * - requirement_spec / implementation_plan
 * 
 * 產出：contract.json
 */
const fs = require('fs');
const path = require('path');

/**
 * 掃描 @GEMS-CONTRACT 標籤
 * @param {string} srcPath - 源碼目錄
 * @returns {Object} 資料契約
 */
function scanDataContracts(srcPath) {
  const contracts = {};
  
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
      } else if (file.isFile() && /\.(ts|tsx|js|jsx)$/.test(file.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // 匹配 @GEMS-CONTRACT: EntityName
        const contractPattern = /@GEMS-CONTRACT:\s*(\w+)/g;
        let match;
        
        while ((match = contractPattern.exec(content)) !== null) {
          const entityName = match[1];
          const relPath = path.relative(srcPath, fullPath);
          
          // 嘗試解析 interface 定義
          const interfacePattern = new RegExp(
            `(?:export\\s+)?interface\\s+${entityName}\\s*\\{([^}]+)\\}`,
            's'
          );
          const interfaceMatch = content.match(interfacePattern);
          
          const fields = [];
          if (interfaceMatch) {
            // 解析欄位
            const fieldPattern = /(\w+)(\?)?:\s*([^;]+);/g;
            let fieldMatch;
            while ((fieldMatch = fieldPattern.exec(interfaceMatch[1])) !== null) {
              fields.push({
                name: fieldMatch[1],
                optional: !!fieldMatch[2],
                type: fieldMatch[3].trim()
              });
            }
          }
          
          // 檢查是否有 @GEMS-TABLE 標籤
          const tablePattern = new RegExp(`@GEMS-TABLE:\\s*(\\w+)`, 'i');
          const tableMatch = content.match(tablePattern);
          
          contracts[entityName] = {
            source: relPath,
            table: tableMatch ? tableMatch[1] : null,
            fields
          };
        }
      }
    }
  }
  
  walk(srcPath);
  return contracts;
}

/**
 * 掃描 @GEMS-UI-BIND 標籤
 * @param {string} srcPath - 源碼目錄
 * @returns {Object} UI 綁定
 */
function scanUIBindings(srcPath) {
  const bindings = {};
  
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
      } else if (file.isFile() && /\.(ts|tsx|js|jsx)$/.test(file.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // 匹配 @GEMS-UI-BIND 區塊
        const blockPattern = /@GEMS-UI-BIND:\s*(\w+)\s*\n((?:\s*\*?\s*-\s*#[\w-]+.*\n?)+)/g;
        let match;
        
        while ((match = blockPattern.exec(content)) !== null) {
          const moduleName = match[1];
          const bindingsBlock = match[2];
          const relPath = path.relative(srcPath, fullPath);
          
          const items = [];
          
          // 解析每一行 binding
          const linePattern = /-\s*#([\w-]+)\s*\((\w+)\)\s*(?:→\s*(\w+):(\w+))?\s*(?:←\s*(\w+))?/g;
          let lineMatch;
          
          while ((lineMatch = linePattern.exec(bindingsBlock)) !== null) {
            items.push({
              selector: `#${lineMatch[1]}`,
              element: lineMatch[2],
              handler: lineMatch[3] || null,
              event: lineMatch[4] || null,
              init: lineMatch[5] || null
            });
          }
          
          bindings[moduleName] = {
            source: relPath,
            bindings: items
          };
        }
      }
    }
  }
  
  walk(srcPath);
  return bindings;
}

/**
 * 掃描 GEMS 函式標籤
 * @param {string} srcPath - 源碼目錄
 * @returns {Object} 函式清單 (按 Story 分組)
 */
function scanFunctions(srcPath) {
  const functions = {};
  const byStory = {};
  
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
        const relPath = path.relative(srcPath, fullPath);
        
        // 匹配 GEMS 標籤
        // GEMS: functionName | P[0-3] | status | signature | Story-X.X | description
        const gemsPattern = /GEMS:\s*(\w+)\s*\|\s*(P[0-3])\s*\|\s*([^\|]+)\s*\|\s*([^\|]+)\s*\|\s*(Story-[\d.]+)\s*\|\s*([^\n*]+)/g;
        let match;
        
        while ((match = gemsPattern.exec(content)) !== null) {
          const fnName = match[1];
          const priority = match[2];
          const status = match[3].trim();
          const signature = match[4].trim();
          const storyId = match[5].trim();
          const description = match[6].trim();
          
          // 解析擴展標籤 - 從當前 GEMS 標籤位置提取所屬的註解區塊
          // 找到當前 match 所在位置，然後往前找註解開頭、往後找註解結尾
          const matchPos = match.index;
          
          // 往前找註解區塊開頭 (/** 或連續的 // 行)
          const contentBefore = content.substring(0, matchPos);
          const jsDocStart = contentBefore.lastIndexOf('/**');
          const blockStart = jsDocStart !== -1 ? jsDocStart : Math.max(0, contentBefore.lastIndexOf('\n', matchPos - 200));
          
          // 往後找到下一個 GEMS: 標籤或函式定義（取較近的那個）
          const nextGemsMatch = content.indexOf('\nGEMS:', matchPos + match[0].length);
          const nextGemsStar = content.indexOf('* GEMS:', matchPos + match[0].length);
          const nextFuncExport = content.indexOf('\nexport ', matchPos + match[0].length);
          const nextFuncDef = content.indexOf('\nfunction ', matchPos + match[0].length);
          
          // 取所有可能的結尾中最近的那個，作為當前函式註解區塊的邊界
          const candidates = [nextGemsMatch, nextGemsStar, nextFuncExport, nextFuncDef].filter(i => i > -1);
          const blockEnd = candidates.length > 0 ? Math.min(...candidates) : matchPos + 500;
          
          // 從當前函式的註解區塊中搜尋擴展標籤
          const commentBlock = content.substring(blockStart, Math.min(blockEnd, content.length));
          
          const flowMatch = commentBlock.match(new RegExp(`GEMS-FLOW:\\s*([^\\n*]+)`, 'm'));
          const depsMatch = commentBlock.match(new RegExp(`GEMS-DEPS:\\s*([^\\n*]+)`, 'm'));
          const depsRiskMatch = commentBlock.match(new RegExp(`GEMS-DEPS-RISK:\\s*(\\w+)`, 'm'));
          const testMatch = commentBlock.match(new RegExp(`GEMS-TEST:\\s*([^\\n*]+)`, 'm'));
          
          const fnData = {
            name: fnName,
            priority,
            status,
            signature,
            story: storyId,
            description,
            source: relPath,
            flow: flowMatch ? flowMatch[1].trim() : null,
            deps: depsMatch ? depsMatch[1].trim() : null,
            depsRisk: depsRiskMatch ? depsRiskMatch[1].trim() : null,
            test: testMatch ? parseTestStatus(testMatch[1].trim()) : null
          };
          
          functions[fnName] = fnData;
          
          // 按 Story 分組
          if (!byStory[storyId]) {
            byStory[storyId] = [];
          }
          byStory[storyId].push(fnName);
        }
      }
    }
  }
  
  walk(srcPath);
  return { functions, byStory };
}

/**
 * 解析測試狀態
 */
function parseTestStatus(testStr) {
  const result = { unit: false, integration: false, e2e: false };
  
  if (testStr.includes('✓ Unit') || testStr.includes('✓Unit')) result.unit = true;
  if (testStr.includes('✓ Integration') || testStr.includes('✓Integration')) result.integration = true;
  if (testStr.includes('✓ E2E') || testStr.includes('✓E2E')) result.e2e = true;
  
  return result;
}

/**
 * 產生完整的 contract.json
 */
function generateContract(projectRoot, srcPath, iteration = 'iter-1') {
  const projectName = path.basename(projectRoot);
  
  // 掃描各種標籤
  const dataContracts = scanDataContracts(srcPath);
  const uiBindings = scanUIBindings(srcPath);
  const { functions, byStory } = scanFunctions(srcPath);
  
  // 組裝 contract
  const contract = {
    $schema: 'gems-contract-v1.0',
    project: projectName,
    iteration,
    generatedAt: new Date().toISOString(),
    
    // 統計摘要
    summary: {
      dataContracts: Object.keys(dataContracts).length,
      uiModules: Object.keys(uiBindings).length,
      functions: Object.keys(functions).length,
      stories: Object.keys(byStory).length,
      byPriority: {
        P0: Object.values(functions).filter(f => f.priority === 'P0').length,
        P1: Object.values(functions).filter(f => f.priority === 'P1').length,
        P2: Object.values(functions).filter(f => f.priority === 'P2').length,
        P3: Object.values(functions).filter(f => f.priority === 'P3').length
      }
    },
    
    // 資料契約
    data: dataContracts,
    
    // UI 綁定
    ui: uiBindings,
    
    // 函式清單
    functions,
    
    // Story → 函式對應
    stories: Object.entries(byStory).reduce((acc, [storyId, fnNames]) => {
      acc[storyId] = {
        functions: fnNames,
        dataContracts: findRelatedContracts(fnNames, functions, dataContracts),
        uiBindings: findRelatedUIBindings(fnNames, functions, uiBindings)
      };
      return acc;
    }, {})
  };
  
  return contract;
}

/**
 * 找出 Story 相關的資料契約
 */
function findRelatedContracts(fnNames, functions, dataContracts) {
  const related = new Set();
  
  for (const fnName of fnNames) {
    const fn = functions[fnName];
    if (fn && fn.deps) {
      // 從 deps 中找出型別引用
      for (const contractName of Object.keys(dataContracts)) {
        if (fn.deps.includes(contractName)) {
          related.add(contractName);
        }
      }
    }
  }
  
  return Array.from(related);
}

/**
 * 找出 Story 相關的 UI 綁定
 */
function findRelatedUIBindings(fnNames, functions, uiBindings) {
  const related = new Set();
  
  for (const [moduleName, binding] of Object.entries(uiBindings)) {
    for (const item of binding.bindings) {
      if (item.handler && fnNames.includes(item.handler)) {
        related.add(moduleName);
      }
      if (item.init && fnNames.includes(item.init)) {
        related.add(moduleName);
      }
    }
  }
  
  return Array.from(related);
}

/**
 * 格式化 contract 為可讀的 Markdown
 */
function formatContractMarkdown(contract) {
  const lines = [
    `# Semantic Contract: ${contract.project}`,
    `> Generated: ${contract.generatedAt}`,
    `> Iteration: ${contract.iteration}`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Data Contracts | ${contract.summary.dataContracts} |`,
    `| UI Modules | ${contract.summary.uiModules} |`,
    `| Functions | ${contract.summary.functions} |`,
    `| Stories | ${contract.summary.stories} |`,
    `| P0 (Critical) | ${contract.summary.byPriority.P0} |`,
    `| P1 (Important) | ${contract.summary.byPriority.P1} |`,
    '',
    '## Stories → Implementation',
    ''
  ];
  
  // Story 對應表
  for (const [storyId, data] of Object.entries(contract.stories)) {
    lines.push(`### ${storyId}`);
    lines.push('');
    lines.push('**Functions:**');
    for (const fnName of data.functions) {
      const fn = contract.functions[fnName];
      lines.push(`- \`${fnName}\` (${fn.priority}) - ${fn.description}`);
    }
    if (data.dataContracts.length > 0) {
      lines.push('');
      lines.push('**Data Contracts:** ' + data.dataContracts.join(', '));
    }
    if (data.uiBindings.length > 0) {
      lines.push('');
      lines.push('**UI Modules:** ' + data.uiBindings.join(', '));
    }
    lines.push('');
  }
  
  // Data Contracts
  if (Object.keys(contract.data).length > 0) {
    lines.push('## Data Contracts');
    lines.push('');
    for (const [name, data] of Object.entries(contract.data)) {
      lines.push(`### ${name}`);
      lines.push(`Source: \`${data.source}\``);
      if (data.table) lines.push(`Table: \`${data.table}\``);
      lines.push('');
      if (data.fields.length > 0) {
        lines.push('| Field | Type | Optional |');
        lines.push('|-------|------|----------|');
        for (const field of data.fields) {
          lines.push(`| ${field.name} | \`${field.type}\` | ${field.optional ? 'Yes' : 'No'} |`);
        }
      }
      lines.push('');
    }
  }
  
  // UI Bindings
  if (Object.keys(contract.ui).length > 0) {
    lines.push('## UI Bindings');
    lines.push('');
    for (const [name, data] of Object.entries(contract.ui)) {
      lines.push(`### ${name}`);
      lines.push(`Source: \`${data.source}\``);
      lines.push('');
      lines.push('| Selector | Element | Handler | Event | Init |');
      lines.push('|----------|---------|---------|-------|------|');
      for (const b of data.bindings) {
        lines.push(`| ${b.selector} | ${b.element} | ${b.handler || '-'} | ${b.event || '-'} | ${b.init || '-'} |`);
      }
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

module.exports = {
  scanDataContracts,
  scanUIBindings,
  scanFunctions,
  generateContract,
  formatContractMarkdown
};

// CLI 執行
if (require.main === module) {
  const args = process.argv.slice(2);
  const projectRoot = args[0] || '.';
  const srcPath = path.join(projectRoot, 'src');
  const iteration = args[1] || 'iter-1';
  
  console.log(`Generating contract for: ${projectRoot}`);
  const contract = generateContract(projectRoot, srcPath, iteration);
  
  // 輸出 JSON
  const outputDir = path.join(projectRoot, '.gems', 'docs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'contract.json'),
    JSON.stringify(contract, null, 2)
  );
  
  // 輸出 Markdown
  fs.writeFileSync(
    path.join(outputDir, 'CONTRACT.md'),
    formatContractMarkdown(contract)
  );
  
  console.log(`Contract generated: ${outputDir}/contract.json`);
  console.log(`Markdown: ${outputDir}/CONTRACT.md`);
}
