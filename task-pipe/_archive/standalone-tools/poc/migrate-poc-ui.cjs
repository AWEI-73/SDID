#!/usr/bin/env node

/**
 * POC UI 移植工具
 * 
 * 功能：
 * 1. 解析 POC HTML 檔案
 * 2. 提取 HTML 結構、CSS 樣式、JS 邏輯
 * 3. 生成對應的專案檔案結構
 * 4. 產生移植報告
 * 
 * 使用方式：
 * node tools/migrate-poc-ui.cjs <poc-file> --output <project-root>
 */

const fs = require('fs');
const path = require('path');

// ANSI 顏色
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * 解析 POC HTML 檔案
 */
function parsePOC(pocPath) {
  log(`\n📖 解析 POC: ${pocPath}`, 'blue');
  
  if (!fs.existsSync(pocPath)) {
    throw new Error(`POC 檔案不存在: ${pocPath}`);
  }

  const content = fs.readFileSync(pocPath, 'utf-8');
  
  // 提取 HTML 結構
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const htmlStructure = bodyMatch ? bodyMatch[1].trim() : '';
  
  // 提取 CSS
  const styleMatches = content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  let cssContent = '';
  for (const match of styleMatches) {
    cssContent += match[1].trim() + '\n\n';
  }
  
  // 提取 JS
  const scriptMatches = content.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  let jsContent = '';
  for (const match of scriptMatches) {
    // 跳過外部引用
    if (!match[0].includes('src=')) {
      jsContent += match[1].trim() + '\n\n';
    }
  }
  
  // 提取設計說明
  const designBriefMatch = content.match(/<!--\s*@GEMS-DESIGN-BRIEF([\s\S]*?)-->/i);
  const designBrief = designBriefMatch ? designBriefMatch[1].trim() : '';
  
  log(`✅ HTML 結構: ${htmlStructure.length} 字元`, 'green');
  log(`✅ CSS 樣式: ${cssContent.length} 字元`, 'green');
  log(`✅ JS 邏輯: ${jsContent.length} 字元`, 'green');
  log(`✅ 設計說明: ${designBrief.length} 字元`, 'green');
  
  return {
    html: htmlStructure,
    css: cssContent,
    js: jsContent,
    designBrief
  };
}

/**
 * 生成專案檔案
 */
function generateProjectFiles(parsed, outputDir, mode = 'conservative') {
  log(`\n📝 生成專案檔案到: ${outputDir}`, 'blue');
  log(`   模式: ${mode === 'conservative' ? '保守模式（保留 inline）' : '現代化模式（完全拆分）'}`, 'cyan');
  
  // 確保輸出目錄存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const files = [];
  
  if (mode === 'conservative') {
    // 保守模式：保留 inline CSS 和 JS，確保功能不會壞
    const indexHtmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App</title>
  <style>
${parsed.css}
  </style>
</head>
<body>
  ${parsed.html}
  
  <script>
${parsed.js}
  </script>
  
  <!-- 可選：逐步遷移到模組化 -->
  <!-- <script type="module" src="src/main.ts"></script> -->
</body>
</html>`;
    
    const indexHtmlPath = path.join(outputDir, 'index.html');
    fs.writeFileSync(indexHtmlPath, indexHtmlContent, 'utf-8');
    files.push({ path: indexHtmlPath, type: 'HTML (保守模式)' });
    log(`✅ 已生成: index.html（保留 inline CSS/JS）`, 'green');
    
  } else {
    // 現代化模式：完全拆分（原有邏輯）
    const indexHtmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App</title>
  <link rel="stylesheet" href="styles/main.css">
</head>
<body>
  ${parsed.html}
  
  <script type="module" src="src/main.ts"></script>
</body>
</html>`;
    
    const indexHtmlPath = path.join(outputDir, 'index.html');
    fs.writeFileSync(indexHtmlPath, indexHtmlContent, 'utf-8');
    files.push({ path: indexHtmlPath, type: 'HTML (現代化)' });
    log(`✅ 已生成: index.html`, 'green');
    
    // 生成 CSS
    const stylesDir = path.join(outputDir, 'styles');
    if (!fs.existsSync(stylesDir)) {
      fs.mkdirSync(stylesDir, { recursive: true });
    }
    
    const cssPath = path.join(stylesDir, 'main.css');
    fs.writeFileSync(cssPath, parsed.css, 'utf-8');
    files.push({ path: cssPath, type: 'CSS' });
    log(`✅ 已生成: styles/main.css`, 'green');
  }
  
  // 3. 生成 UI 移植指引（兩種模式都需要）
  const migrationGuidePath = path.join(outputDir, 'UI_MIGRATION_GUIDE.md');
  const migrationGuideContent = `# UI 移植指引

## 📋 移植來源
- POC 檔案: ${path.basename(process.argv[2])}
- 移植時間: ${new Date().toISOString()}
- 移植模式: ${mode === 'conservative' ? '保守模式（保留 inline）' : '現代化模式（完全拆分）'}

## 🎨 設計說明
${parsed.designBrief || '（無設計說明）'}

## ✅ 已完成
${mode === 'conservative' ? `
- [x] HTML 結構移植到 \`index.html\`
- [x] CSS 樣式保留在 \`<style>\` 標籤中
- [x] JS 邏輯保留在 \`<script>\` 標籤中
- [x] 功能完整保留，可直接開啟使用

## 🎯 保守模式說明

目前使用**保守模式**，所有 CSS 和 JS 都保留在 HTML 中，確保：
- ✅ 功能不會壞
- ✅ 互動邏輯正常
- ✅ 樣式完全一致

## � 下一步（可選的現代化）

如果想要現代化重構，可以：
1. 將 CSS 移到 \`styles/main.css\`
2. 將 JS 轉換為 TypeScript 模組
3. 使用 \`<script type="module" src="src/main.ts"></script>\`

**注意**：重構時要小心處理事件綁定（如 \`onclick\`）
` : `
- [x] HTML 結構移植到 \`index.html\`
- [x] CSS 樣式移植到 \`styles/main.css\`

## 🚧 待完成
- [ ] 將 JS 邏輯轉換為 TypeScript 模組
- [ ] 處理事件綁定（onclick → addEventListener）
- [ ] 拆分 UI 元件（如有需要）
- [ ] 實作資料綁定邏輯
- [ ] 視覺回歸測試
`}

## 📦 原始 JS 邏輯

\`\`\`javascript
${parsed.js}
\`\`\`

${mode === 'modern' ? `
## ⚠️ 重要提醒：事件綁定問題

POC 中可能有這樣的程式碼：
\`\`\`html
<button onclick="addTodo()">新增</button>
\`\`\`

現代化模式下，需要改為：
\`\`\`typescript
// src/main.ts
function addTodo() { ... }

// 綁定事件
document.querySelector('button').addEventListener('click', addTodo);
\`\`\`

或者保留 onclick，但要將函式掛到 window：
\`\`\`typescript
// src/main.ts
function addTodo() { ... }
(window as any).addTodo = addTodo;  // 掛到全域
\`\`\`
` : ''}

## 🔄 下一步

1. 執行 \`npm run dev\` 檢查畫面是否正常
${mode === 'conservative' ? `2. 確認所有功能正常運作
3. （可選）逐步重構為模組化程式碼` : `2. 將上述 JS 邏輯轉換為 TypeScript
3. 處理事件綁定問題
4. 實作 GEMS 標籤中定義的函式
5. 進行視覺比對測試`}
`;
  
  fs.writeFileSync(migrationGuidePath, migrationGuideContent, 'utf-8');
  files.push({ path: migrationGuidePath, type: 'GUIDE' });
  log(`✅ 已生成: UI_MIGRATION_GUIDE.md`, 'green');
  
  return files;
}

/**
 * 主程式
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log(`
使用方式:
  node tools/migrate-poc-ui.cjs <poc-file> [--output <project-root>] [--mode <conservative|modern>]

參數:
  <poc-file>           POC HTML 檔案路徑
  --output <dir>       輸出目錄（預設：.）
  --mode <mode>        移植模式（預設：conservative）
                       - conservative: 保守模式，保留 inline CSS/JS
                       - modern: 現代化模式，完全拆分

範例:
  # 保守模式（預設）- 確保功能不會壞
  node tools/migrate-poc-ui.cjs .gems/iterations/iter-1/poc/TodoListPOC.html --output .
  
  # 現代化模式 - 完全拆分（需要手動處理事件綁定）
  node tools/migrate-poc-ui.cjs .gems/iterations/iter-1/poc/TodoListPOC.html --output . --mode modern
    `);
    process.exit(1);
  }
  
  const pocPath = args[0];
  const outputIndex = args.indexOf('--output');
  const outputDir = outputIndex !== -1 ? args[outputIndex + 1] : '.';
  const modeIndex = args.indexOf('--mode');
  const mode = modeIndex !== -1 ? args[modeIndex + 1] : 'conservative';
  
  if (!['conservative', 'modern'].includes(mode)) {
    log('❌ 錯誤: mode 必須是 conservative 或 modern', 'red');
    process.exit(1);
  }
  
  try {
    log('🚀 POC UI 移植工具', 'cyan');
    log('='.repeat(50), 'cyan');
    
    // 解析 POC
    const parsed = parsePOC(pocPath);
    
    // 生成檔案
    const files = generateProjectFiles(parsed, outputDir, mode);
    
    // 產生報告
    log('\n📊 移植報告', 'cyan');
    log('='.repeat(50), 'cyan');
    files.forEach(file => {
      log(`${file.type.padEnd(20)} ${file.path}`, 'yellow');
    });
    
    log('\n✅ UI 移植完成！', 'green');
    log(`\n下一步：`, 'blue');
    log(`1. cd ${outputDir}`, 'yellow');
    
    if (mode === 'conservative') {
      log(`2. 直接開啟 index.html 或執行 npm run dev`, 'yellow');
      log(`3. 確認所有功能正常`, 'yellow');
      log(`4. （可選）閱讀 UI_MIGRATION_GUIDE.md 進行現代化重構`, 'yellow');
    } else {
      log(`2. npm run dev`, 'yellow');
      log(`3. 檢查畫面是否與 POC 一致`, 'yellow');
      log(`4. 閱讀 UI_MIGRATION_GUIDE.md 完成 JS 邏輯轉換`, 'yellow');
      log(`5. 處理事件綁定問題（onclick → addEventListener）`, 'yellow');
    }
    
  } catch (error) {
    log(`\n❌ 錯誤: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
