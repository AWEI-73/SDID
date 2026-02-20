#!/usr/bin/env node

/**
 * HTML POC 一鍵處理工具
 * 自動解析、生成規格、提取契約
 * 
 * 使用方式：
 *   node tools/process-html-poc.cjs <html-file>
 */

const fs = require('fs');
const path = require('path');
const { parseHtmlPoc, generateSummary } = require('./html-poc-parser.cjs');
const { generateSpecMarkdown } = require('./html-poc-to-spec.cjs');

function processHtmlPoc(htmlFile, options = {}) {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           HTML POC 一鍵處理工具                                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // 判斷輸出目錄：優先使用 .gems/iterations/，否則使用 HTML 所在目錄
  const htmlDir = path.dirname(htmlFile);
  const outputDir = options.outputDir || htmlDir;
  
  // Step 1: 解析 HTML
  console.log('📍 Step 1: 解析 HTML POC...');
  const parsed = parseHtmlPoc(htmlFile);
  console.log(`   ✓ 檔案: ${parsed.file}`);
  console.log(`   ✓ 總行數: ${parsed.stats.totalLines} 行`);
  console.log(`   ✓ 輸出目錄: ${outputDir}\n`);

  // Step 2: 判斷是否需要生成精簡規格
  const needsSpec = parsed.stats.totalLines > 150;
  
  if (needsSpec) {
    console.log('📍 Step 2: 生成精簡規格（檔案超過 150 行）...');
    const htmlBasename = path.basename(htmlFile, '.html');
    const specFile = path.join(outputDir, `${htmlBasename}-spec.md`);
    const specContent = generateSpecMarkdown(parsed);
    fs.writeFileSync(specFile, specContent, 'utf-8');
    console.log(`   ✓ 規格檔案: ${specFile}`);
    console.log(`   ✓ 規格行數: ${specContent.split('\n').length} 行`);
    console.log(`   ✓ 壓縮比: ${((1 - specContent.split('\n').length / parsed.stats.totalLines) * 100).toFixed(1)}%\n`);
  } else {
    console.log('📍 Step 2: 跳過精簡規格生成（檔案 < 150 行）\n');
  }

  // Step 3: 檢查契約檔案
  console.log('📍 Step 3: 檢查契約檔案...');
  
  if (parsed.contractRef) {
    const contractPath = path.join(outputDir, parsed.contractRef);
    if (fs.existsSync(contractPath)) {
      console.log(`   ✓ 契約檔案已存在: ${parsed.contractRef}\n`);
    } else {
      console.log(`   ⚠️  契約檔案不存在: ${parsed.contractRef}`);
      console.log(`   💡 請手動建立契約檔案\n`);
    }
  } else if (parsed.contract) {
    console.log('   ⚠️  契約內嵌於 HTML 中');
    console.log('   💡 建議提取為獨立 .ts 檔案\n');
    
    // 自動生成契約檔案
    const htmlBasename = path.basename(htmlFile, '.html');
    const contractFile = path.join(outputDir, `${htmlBasename}Contract.ts`);
    const contractContent = `// @GEMS-STORY: ${parsed.story || 'N/A'}
// @GEMS-CONTRACT: ${parsed.contract.name}
// @GEMS-TABLE: tbl_${parsed.contract.name.toLowerCase()}s

${parsed.contract.definition}

${parsed.mockData && typeof parsed.mockData !== 'string' ? `
// @GEMS-MOCK
export const MOCK_DATA = ${JSON.stringify(parsed.mockData, null, 2)};
` : ''}
`;
    fs.writeFileSync(contractFile, contractContent, 'utf-8');
    console.log(`   ✓ 已自動生成: ${contractFile}\n`);
  } else {
    console.log('   ❌ 未找到契約定義\n');
  }

  // Step 4: 生成摘要報告
  console.log('📍 Step 4: 生成摘要報告...\n');
  console.log('─────────────────────────────────────────────────────────────');
  generateSummary(parsed);
  console.log('─────────────────────────────────────────────────────────────\n');

  // Step 5: 給出建議
  console.log('📍 Step 5: 處理建議\n');
  
  const recommendations = [];
  
  if (parsed.stats.totalLines > 300) {
    recommendations.push('⚠️  檔案超過 300 行，建議拆分為多個 POC');
  }
  
  if (!parsed.story) {
    recommendations.push('⚠️  缺少 @GEMS-STORY 標籤');
  }
  
  if (!parsed.contract && !parsed.contractRef) {
    recommendations.push('❌ 缺少 @GEMS-CONTRACT 定義');
  }
  
  if (parsed.zones.length === 0) {
    recommendations.push('💡 建議加入 GEMS-ZONE 標籤標記 UI 區塊');
  }
  
  if (recommendations.length === 0) {
    console.log('   ✅ POC 結構完整，無需調整\n');
  } else {
    recommendations.forEach(rec => console.log(`   ${rec}`));
    console.log('');
  }

  // 產出清單
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                     產出檔案清單                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📄 HTML POC: ${htmlFile} (${parsed.stats.totalLines} 行)`);
  
  if (needsSpec) {
    const htmlBasename = path.basename(htmlFile, '.html');
    const specFile = path.join(outputDir, `${htmlBasename}-spec.md`);
    console.log(`📄 精簡規格: ${specFile} (給 PLAN/BUILD Agent 讀)`);
  }
  
  if (parsed.contractRef) {
    console.log(`📄 契約檔案: ${parsed.contractRef}`);
  } else if (parsed.contract) {
    const htmlBasename = path.basename(htmlFile, '.html');
    const contractFile = path.join(outputDir, `${htmlBasename}Contract.ts`);
    console.log(`📄 契約檔案: ${contractFile} (自動生成)`);
  }
  
  console.log('\n✅ 處理完成！\n');
  
  return {
    success: true,
    outputDir,
    files: {
      html: htmlFile,
      spec: needsSpec ? path.join(outputDir, `${path.basename(htmlFile, '.html')}-spec.md`) : null,
      contract: parsed.contract ? path.join(outputDir, `${path.basename(htmlFile, '.html')}Contract.ts`) : null
    }
  };
}

// Main
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('使用方式: node tools/process-html-poc.cjs <html-file> [--output-dir <dir>]');
    console.log('');
    console.log('範例:');
    console.log('  node tools/process-html-poc.cjs iterations/iter-6/POC-iter-6.html');
    console.log('  node tools/process-html-poc.cjs POC.html --output-dir .gems/iterations/iter-6');
    console.log('');
    console.log('功能:');
    console.log('  1. 解析 HTML POC 結構');
    console.log('  2. 自動生成精簡規格（如果超過 150 行）');
    console.log('  3. 提取或生成契約檔案');
    console.log('  4. 顯示摘要報告和建議');
    console.log('');
    console.log('選項:');
    console.log('  --output-dir <dir>  指定產物輸出目錄（預設為 HTML 所在目錄）');
    process.exit(1);
  }

  const htmlFile = args[0];
  const options = {};
  
  // 解析選項
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--output-dir' && args[i + 1]) {
      options.outputDir = args[i + 1];
      i++;
    }
  }
  
  processHtmlPoc(htmlFile, options);
}

module.exports = { processHtmlPoc };
