#!/usr/bin/env node

/**
 * 環境偵測工具
 * 
 * 功能：
 * 1. 偵測專案的執行環境（Node.js / Browser）
 * 2. 檢查開發工具鏈設定
 * 3. 驗證路由設定（如果有）
 * 4. 產生環境報告與建議
 * 
 * 使用方式：
 * node tools/detect-environment.cjs [project-dir]
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * 偵測專案類型
 */
function detectProjectType(projectDir) {
  const packageJsonPath = path.join(projectDir, 'package.json');
  const indexHtmlPath = path.join(projectDir, 'index.html');
  const viteConfigPath = path.join(projectDir, 'vite.config.ts');
  const webpackConfigPath = path.join(projectDir, 'webpack.config.js');
  
  const hasPackageJson = fs.existsSync(packageJsonPath);
  const hasIndexHtml = fs.existsSync(indexHtmlPath);
  const hasVite = fs.existsSync(viteConfigPath);
  const hasWebpack = fs.existsSync(webpackConfigPath);
  
  let packageJson = null;
  if (hasPackageJson) {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  }
  
  return {
    hasPackageJson,
    hasIndexHtml,
    hasVite,
    hasWebpack,
    packageJson
  };
}

/**
 * 分析開發指令
 */
function analyzeDevCommand(packageJson) {
  if (!packageJson || !packageJson.scripts) {
    return { hasDevCommand: false, devCommand: null, type: 'unknown' };
  }
  
  const devCommand = packageJson.scripts.dev || packageJson.scripts.start;
  
  if (!devCommand) {
    return { hasDevCommand: false, devCommand: null, type: 'unknown' };
  }
  
  // 分析指令類型
  let type = 'unknown';
  if (devCommand.includes('vite')) {
    type = 'vite';
  } else if (devCommand.includes('webpack')) {
    type = 'webpack';
  } else if (devCommand.includes('http-server') || devCommand.includes('serve')) {
    type = 'static-server';
  } else if (devCommand.includes('ts-node') || devCommand.includes('node')) {
    type = 'node';
  }
  
  return { hasDevCommand: true, devCommand, type };
}

/**
 * 檢查路由設定
 */
function checkRouting(projectDir) {
  const srcDir = path.join(projectDir, 'src');
  const routesDir = path.join(srcDir, 'routes');
  
  if (!fs.existsSync(routesDir)) {
    return { hasRoutes: false, routeFiles: [], isFakeRouting: false };
  }
  
  const routeFiles = fs.readdirSync(routesDir)
    .filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  
  // 檢查是否為假路由
  let isFakeRouting = false;
  for (const file of routeFiles) {
    const content = fs.readFileSync(path.join(routesDir, file), 'utf-8');
    
    // 假路由特徵：只有資料陣列，沒有路由邏輯
    const hasRouteArray = content.includes('routes') && content.includes('[');
    const hasRouteLogic = 
      content.includes('addEventListener') ||
      content.includes('pushState') ||
      content.includes('Router') ||
      content.includes('navigate');
    
    if (hasRouteArray && !hasRouteLogic) {
      isFakeRouting = true;
      break;
    }
  }
  
  return { hasRoutes: true, routeFiles, isFakeRouting };
}

/**
 * 檢查瀏覽器 API 使用
 */
function checkBrowserAPI(projectDir) {
  const srcDir = path.join(projectDir, 'src');
  
  if (!fs.existsSync(srcDir)) {
    return { usesBrowserAPI: false, files: [] };
  }
  
  const files = [];
  
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        // 檢查瀏覽器 API
        const browserAPIs = ['document', 'window', 'navigator', 'localStorage'];
        const usedAPIs = browserAPIs.filter(api => 
          new RegExp(`\\b${api}\\b`).test(content)
        );
        
        if (usedAPIs.length > 0) {
          files.push({
            file: path.relative(projectDir, fullPath),
            apis: usedAPIs
          });
        }
      }
    }
  }
  
  scanDir(srcDir);
  
  return { usesBrowserAPI: files.length > 0, files };
}

/**
 * 產生報告
 */
function generateReport(projectDir, projectInfo, devInfo, routingInfo, browserAPIInfo) {
  log('\n' + '='.repeat(60), 'cyan');
  log('🔍 環境偵測報告', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // 1. 專案類型
  log('\n📦 專案類型', 'blue');
  log('-'.repeat(60));
  
  if (projectInfo.hasIndexHtml && (projectInfo.hasVite || projectInfo.hasWebpack)) {
    log('✅ Browser App (有打包工具)', 'green');
  } else if (projectInfo.hasIndexHtml) {
    log('✅ Browser App (純 HTML)', 'green');
  } else if (projectInfo.hasPackageJson && !projectInfo.hasIndexHtml) {
    log('✅ Node.js Library', 'green');
  } else {
    log('⚠️  無法判斷專案類型', 'yellow');
  }
  
  // 2. 開發指令
  log('\n🛠️  開發指令', 'blue');
  log('-'.repeat(60));
  
  if (devInfo.hasDevCommand) {
    log(`✅ npm run dev: ${devInfo.devCommand}`, 'green');
    log(`   類型: ${devInfo.type}`, 'cyan');
  } else {
    log('❌ 缺少 dev 指令', 'red');
  }
  
  // 3. 環境一致性檢查
  log('\n🔄 環境一致性', 'blue');
  log('-'.repeat(60));
  
  const isBrowserApp = projectInfo.hasIndexHtml;
  const devCommandIsBrowser = ['vite', 'webpack', 'static-server'].includes(devInfo.type);
  const usesBrowserAPI = browserAPIInfo.usesBrowserAPI;
  
  if (isBrowserApp && devCommandIsBrowser && usesBrowserAPI) {
    log('✅ 環境設定一致（Browser App）', 'green');
  } else if (!isBrowserApp && devInfo.type === 'node' && !usesBrowserAPI) {
    log('✅ 環境設定一致（Node.js Library）', 'green');
  } else {
    log('❌ 環境設定不一致！', 'red');
    
    if (usesBrowserAPI && devInfo.type === 'node') {
      log('   ⚠️  程式碼使用瀏覽器 API，但 dev 指令是 Node.js', 'yellow');
      log('   建議：改用 Vite 或 Webpack', 'yellow');
    }
    
    if (!isBrowserApp && usesBrowserAPI) {
      log('   ⚠️  程式碼使用瀏覽器 API，但缺少 index.html', 'yellow');
      log('   建議：建立 index.html 或移除瀏覽器 API', 'yellow');
    }
  }
  
  // 4. 瀏覽器 API 使用
  if (browserAPIInfo.usesBrowserAPI) {
    log('\n🌐 瀏覽器 API 使用', 'blue');
    log('-'.repeat(60));
    
    browserAPIInfo.files.slice(0, 5).forEach(({ file, apis }) => {
      log(`📄 ${file}`, 'cyan');
      log(`   使用: ${apis.join(', ')}`, 'yellow');
    });
    
    if (browserAPIInfo.files.length > 5) {
      log(`   ... 還有 ${browserAPIInfo.files.length - 5} 個檔案`, 'yellow');
    }
  }
  
  // 5. 路由檢查
  log('\n🗺️  路由設定', 'blue');
  log('-'.repeat(60));
  
  if (!routingInfo.hasRoutes) {
    log('ℹ️  無路由設定（單頁應用）', 'cyan');
  } else if (routingInfo.isFakeRouting) {
    log('❌ 偵測到假路由！', 'red');
    log('   檔案: ' + routingInfo.routeFiles.join(', '), 'yellow');
    log('   問題: 只有資料陣列，沒有實際路由邏輯', 'yellow');
    log('   建議: 實作路由引擎或移除路由檔案', 'yellow');
  } else {
    log('✅ 路由設定正常', 'green');
    log('   檔案: ' + routingInfo.routeFiles.join(', '), 'cyan');
  }
  
  // 6. 建議
  log('\n💡 建議', 'blue');
  log('-'.repeat(60));
  
  const issues = [];
  
  if (!devInfo.hasDevCommand) {
    issues.push('缺少 dev 指令');
  }
  
  if (usesBrowserAPI && devInfo.type === 'node') {
    issues.push('環境不一致（程式碼是 Browser，指令是 Node.js）');
  }
  
  if (routingInfo.isFakeRouting) {
    issues.push('假路由需要修正');
  }
  
  if (issues.length === 0) {
    log('✅ 環境設定正確，無需修正', 'green');
  } else {
    log('⚠️  發現以下問題：', 'yellow');
    issues.forEach((issue, i) => {
      log(`   ${i + 1}. ${issue}`, 'yellow');
    });
  }
  
  log('\n' + '='.repeat(60), 'cyan');
  
  return issues.length === 0;
}

/**
 * 主程式
 */
function main() {
  const projectDir = process.argv[2] || '.';
  
  log('🚀 環境偵測工具', 'cyan');
  log(`專案目錄: ${projectDir}\n`, 'cyan');
  
  try {
    const projectInfo = detectProjectType(projectDir);
    const devInfo = analyzeDevCommand(projectInfo.packageJson);
    const routingInfo = checkRouting(projectDir);
    const browserAPIInfo = checkBrowserAPI(projectDir);
    
    const isOk = generateReport(projectDir, projectInfo, devInfo, routingInfo, browserAPIInfo);
    
    process.exit(isOk ? 0 : 1);
    
  } catch (error) {
    log(`\n❌ 錯誤: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
