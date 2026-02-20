#!/usr/bin/env node

/**
 * HTML POC Parser
 * 從 HTML POC 檔案中提取 GEMS 標籤和資料契約
 * 
 * 使用方式：
 *   node tools/html-poc-parser.cjs <html-file>
 *   node tools/html-poc-parser.cjs ItemManagementPOC.html
 */

const fs = require('fs');
const path = require('path');

function parseHtmlPoc(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 檔案不存在: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const result = {
    file: path.basename(filePath),
    story: null,
    description: null,
    author: null,
    contractRef: null,
    contract: null,
    zones: [],
    functions: [],
    mockData: null,
    stats: {
      totalLines: content.split('\n').length,
      htmlLines: 0,
      cssLines: 0,
      jsLines: 0
    }
  };

  // 提取 GEMS 標籤
  const storyMatch = content.match(/@GEMS-STORY:\s*(.+)/);
  const descMatch = content.match(/@GEMS-DESC:\s*(.+)/);
  const authorMatch = content.match(/@GEMS-AUTHOR:\s*(.+)/);
  const contractRefMatch = content.match(/@GEMS-CONTRACT-REF:\s*(.+)/);

  if (storyMatch) result.story = storyMatch[1].trim();
  if (descMatch) result.description = descMatch[1].trim();
  if (authorMatch) result.author = authorMatch[1].trim();
  if (contractRefMatch) result.contractRef = contractRefMatch[1].trim();

  // 提取 @GEMS-CONTRACT 區塊（從註解中）
  const contractBlockRegex = /@GEMS-CONTRACT:\s*(\w+)[\s\S]*?(?:資料結構|TypeScript Definition)[:\s]*\n([\s\S]*?)(?:={5,}|\/\/\s*@GEMS-MOCK)/;
  const contractMatch = content.match(contractBlockRegex);
  
  if (contractMatch) {
    result.contract = {
      name: contractMatch[1],
      definition: contractMatch[2].trim()
    };
  }

  // 提取 GEMS-ZONE 標籤
  const zoneRegex = /<!--\s*GEMS-ZONE:\s*\[(.+?)\]\s*-->/g;
  let zoneMatch;
  while ((zoneMatch = zoneRegex.exec(content)) !== null) {
    result.zones.push(zoneMatch[1]);
  }

  // 提取主要函式（簡單版，抓 function 關鍵字）
  const functionRegex = /function\s+(\w+)\s*\(/g;
  let funcMatch;
  while ((funcMatch = functionRegex.exec(content)) !== null) {
    result.functions.push(funcMatch[1]);
  }

  // 提取 MOCK_DATA
  const mockDataRegex = /(?:const|let|var)\s+MOCK_DATA\s*=\s*(\[[\s\S]*?\]);/;
  const mockMatch = content.match(mockDataRegex);
  if (mockMatch) {
    try {
      // 嘗試解析 JSON（簡化版）
      const mockStr = mockMatch[1].replace(/'/g, '"');
      result.mockData = JSON.parse(mockStr);
    } catch (e) {
      result.mockData = '(無法解析，請手動檢視)';
    }
  }

  // 統計行數
  const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);
  const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
  
  if (styleMatch) {
    result.stats.cssLines = styleMatch[1].split('\n').length;
  }
  if (scriptMatch) {
    result.stats.jsLines = scriptMatch[1].split('\n').length;
  }
  result.stats.htmlLines = result.stats.totalLines - result.stats.cssLines - result.stats.jsLines;

  return result;
}

function generateSummary(parsed) {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║              HTML POC 解析報告                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`📄 檔案: ${parsed.file}`);
  console.log(`📊 總行數: ${parsed.stats.totalLines} 行`);
  console.log(`   ├─ HTML: ${parsed.stats.htmlLines} 行`);
  console.log(`   ├─ CSS:  ${parsed.stats.cssLines} 行`);
  console.log(`   └─ JS:   ${parsed.stats.jsLines} 行\n`);

  if (parsed.story) {
    console.log(`🎯 Story: ${parsed.story}`);
  }
  if (parsed.description) {
    console.log(`📝 描述: ${parsed.description}`);
  }
  if (parsed.author) {
    console.log(`👤 作者: ${parsed.author}`);
  }
  console.log('');

  if (parsed.contractRef) {
    console.log(`📋 契約參考: ${parsed.contractRef}`);
  }

  if (parsed.contract) {
    console.log(`\n📦 資料契約: ${parsed.contract.name}`);
    console.log('─────────────────────────────────────────────────────────────');
    console.log(parsed.contract.definition);
    console.log('─────────────────────────────────────────────────────────────');
  }

  if (parsed.zones.length > 0) {
    console.log(`\n🎨 UI 區塊 (${parsed.zones.length}):`);
    parsed.zones.forEach(zone => console.log(`   • ${zone}`));
  }

  if (parsed.functions.length > 0) {
    console.log(`\n⚙️  主要函式 (${parsed.functions.length}):`);
    parsed.functions.forEach(func => console.log(`   • ${func}()`));
  }

  if (parsed.mockData) {
    console.log(`\n🗂️  Mock 資料:`);
    if (typeof parsed.mockData === 'string') {
      console.log(`   ${parsed.mockData}`);
    } else {
      console.log(`   ${parsed.mockData.length} 筆資料`);
      if (parsed.mockData.length > 0) {
        console.log(`   範例: ${JSON.stringify(parsed.mockData[0], null, 2).split('\n').join('\n   ')}`);
      }
    }
  }

  console.log('\n✅ 解析完成\n');
}

function generateContractFile(parsed, outputPath) {
  if (!parsed.contract) {
    console.log('⚠️  未找到 @GEMS-CONTRACT，跳過契約檔案生成');
    return;
  }

  const contractContent = `// @GEMS-STORY: ${parsed.story || 'N/A'}
// @GEMS-CONTRACT: ${parsed.contract.name}
// @GEMS-TABLE: tbl_${parsed.contract.name.toLowerCase()}s
// 
// 此檔案由 html-poc-parser.cjs 自動生成
// 來源: ${parsed.file}

${parsed.contract.definition}

${parsed.mockData && typeof parsed.mockData !== 'string' ? `
// @GEMS-MOCK
export const MOCK_DATA = ${JSON.stringify(parsed.mockData, null, 2)};
` : ''}
`;

  fs.writeFileSync(outputPath, contractContent, 'utf-8');
  console.log(`\n📝 已生成契約檔案: ${outputPath}`);
}

// Main
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('使用方式: node tools/html-poc-parser.cjs <html-file> [--export-contract]');
    console.log('');
    console.log('範例:');
    console.log('  node tools/html-poc-parser.cjs ItemManagementPOC.html');
    console.log('  node tools/html-poc-parser.cjs ItemManagementPOC.html --export-contract');
    process.exit(1);
  }

  const htmlFile = args[0];
  const exportContract = args.includes('--export-contract');

  const parsed = parseHtmlPoc(htmlFile);
  generateSummary(parsed);

  if (exportContract) {
    const contractFile = htmlFile.replace('.html', 'Contract.ts');
    generateContractFile(parsed, contractFile);
  }
}

module.exports = { parseHtmlPoc, generateSummary, generateContractFile };
