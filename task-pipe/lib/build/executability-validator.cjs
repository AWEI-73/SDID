#!/usr/bin/env node
/**
 * Executability Validator v1.0
 * 
 * 確保專案在 BUILD 完成後可以實際執行
 * 目標：`npm install && npm run dev` 就能跑起來
 * 
 * 檢查清單：
 * 1. 入口點 (index.html + main.ts)
 * 2. package.json scripts (dev/start/build)
 * 3. 依賴安裝狀態 (node_modules)
 * 4. TypeScript 配置 (tsconfig.json)
 * 5. Bundler 配置 (vite.config/webpack.config)
 * 6. CSS 框架配置 (tailwind/postcss)
 * 7. 環境變數範本 (.env.example)
 * 8. Import 鏈完整性
 */

const fs = require('fs');
const path = require('path');

// v1.1: 引入技術棧分析器
const { analyzeTechStack } = require('./tech-stack-analyzer.cjs');

/**
 * 完整可執行性驗證
 * v1.1: 使用 POC/PLAN 技術棧 metadata 決定檢查策略
 * @param {string} projectRoot - 專案根目錄
 * @param {object} options - 選項
 * @param {string} options.iteration - 迭代名稱 (預設 'iter-1')
 * @returns {object} 驗證結果
 */
function validateExecutability(projectRoot, options = {}) {
  const { iteration = 'iter-1' } = options;

  const result = {
    valid: true,
    score: 0,
    maxScore: 0,
    checks: [],
    criticalIssues: [],
    warnings: [],
    suggestions: [],
    runCommand: null,
    techStack: null
  };

  const srcPath = path.join(projectRoot, 'src');

  // v1.1: 先分析技術棧
  const techStack = analyzeTechStack(projectRoot, iteration);
  result.techStack = techStack;

  // ========================================
  // 1. 入口點檢查 (CRITICAL)
  // ========================================
  const entryCheck = checkEntryPoint(projectRoot, srcPath, techStack);
  result.checks.push(entryCheck);
  result.maxScore += 20;
  if (entryCheck.pass) {
    result.score += 20;
  } else {
    result.valid = false;
    result.criticalIssues.push(entryCheck);
  }

  // ========================================
  // 2. package.json scripts 檢查 (CRITICAL)
  // ========================================
  const scriptsCheck = checkPackageScripts(projectRoot);
  result.checks.push(scriptsCheck);
  result.maxScore += 20;
  if (scriptsCheck.pass) {
    result.score += 20;
    result.runCommand = scriptsCheck.runCommand;
  } else if (scriptsCheck.severity === 'CRITICAL') {
    result.valid = false;
    result.criticalIssues.push(scriptsCheck);
  } else {
    result.warnings.push(scriptsCheck);
  }

  // ========================================
  // 3. 依賴安裝狀態 (WARNING - 可自動修復)
  // ========================================
  const depsCheck = checkDependencies(projectRoot);
  result.checks.push(depsCheck);
  result.maxScore += 10;
  if (depsCheck.pass) {
    result.score += 10;
  } else {
    result.warnings.push(depsCheck);
    result.suggestions.push({
      action: 'npm install',
      reason: '安裝依賴'
    });
  }

  // ========================================
  // 4. TypeScript 配置 (CRITICAL for TS projects)
  // ========================================
  const tsCheck = checkTypeScriptConfig(projectRoot, srcPath);
  result.checks.push(tsCheck);
  result.maxScore += 15;
  if (tsCheck.pass) {
    result.score += 15;
  } else if (tsCheck.severity === 'CRITICAL') {
    result.valid = false;
    result.criticalIssues.push(tsCheck);
  } else if (tsCheck.severity === 'WARNING') {
    result.warnings.push(tsCheck);
  }

  // ========================================
  // 5. Bundler 配置 (CRITICAL for frontend projects)
  // ========================================
  const bundlerCheck = checkBundlerConfig(projectRoot, techStack);
  result.checks.push(bundlerCheck);
  result.maxScore += 15;
  if (bundlerCheck.pass) {
    result.score += 15;
  } else if (bundlerCheck.severity === 'CRITICAL') {
    result.valid = false;
    result.criticalIssues.push(bundlerCheck);
  } else {
    result.warnings.push(bundlerCheck);
  }

  // ========================================
  // 6. CSS 框架配置 (WARNING)
  // ========================================
  const cssCheck = checkCSSFramework(projectRoot);
  result.checks.push(cssCheck);
  result.maxScore += 10;
  if (cssCheck.pass) {
    result.score += 10;
  } else if (cssCheck.severity === 'WARNING') {
    result.warnings.push(cssCheck);
  }

  // ========================================
  // 7. Import 鏈完整性 (CRITICAL)
  // ========================================
  const importCheck = checkImportChain(projectRoot, srcPath);
  result.checks.push(importCheck);
  result.maxScore += 10;
  if (importCheck.pass) {
    result.score += 10;
  } else if (importCheck.severity === 'CRITICAL') {
    result.valid = false;
    result.criticalIssues.push(importCheck);
  } else {
    result.warnings.push(importCheck);
  }

  // 計算百分比
  result.percentage = Math.round((result.score / result.maxScore) * 100);

  return result;
}

/**
 * 偵測是否為純後端專案（無前端 UI）
 */
function isBackendOnly(projectRoot, srcPath) {
  // 有 index.html → 前端專案
  if (fs.existsSync(path.join(projectRoot, 'index.html'))) return false;
  if (fs.existsSync(path.join(projectRoot, 'public', 'index.html'))) return false;
  // 有 .tsx/.jsx/.vue/.svelte → 前端專案
  const frontendExts = ['.tsx', '.jsx', '.vue', '.svelte'];
  const srcFiles = fs.existsSync(srcPath) ? findFiles(srcPath, /\.(tsx|jsx|vue|svelte)$/, 3) : [];
  if (srcFiles.length > 0) return false;
  // 有 App.tsx → 前端專案
  if (fs.existsSync(path.join(srcPath, 'App.tsx'))) return false;
  return true;
}

/**
 * 檢查入口點
 * v1.1: 使用 techStack profile 判斷前端/後端，不再靠檔案特徵猜測
 */
function checkEntryPoint(projectRoot, srcPath, techStack) {
  const check = {
    name: '入口點',
    pass: false,
    severity: 'CRITICAL',
    details: {}
  };

  // 使用 techStack 判斷，fallback 到檔案偵測
  const backendOnly = techStack?.projectType === 'backend' || isBackendOnly(projectRoot, srcPath);
  check.details.backendOnly = backendOnly;
  check.details.techStackSource = techStack?.source || 'file-detection';

  // index.html
  const indexHtmlPaths = [
    path.join(projectRoot, 'index.html'),
    path.join(projectRoot, 'public', 'index.html')
  ];
  const indexHtml = indexHtmlPaths.find(p => fs.existsSync(p));
  check.details.hasIndexHtml = !!indexHtml;

  // main.ts/tsx/js
  const mainPaths = [
    path.join(srcPath, 'main.ts'),
    path.join(srcPath, 'main.tsx'),
    path.join(srcPath, 'main.js'),
    path.join(srcPath, 'index.ts'),
    path.join(srcPath, 'index.tsx'),
    path.join(srcPath, 'index.js')
  ];
  const mainFile = mainPaths.find(p => fs.existsSync(p));
  check.details.hasMain = !!mainFile;
  check.details.mainPath = mainFile ? path.relative(projectRoot, mainFile) : null;

  // App.tsx
  const appPaths = [
    path.join(srcPath, 'App.tsx'),
    path.join(srcPath, 'App.ts'),
    path.join(srcPath, 'App.jsx'),
    path.join(srcPath, 'App.js')
  ];
  const appFile = appPaths.find(p => fs.existsSync(p));
  check.details.hasApp = !!appFile;

  // 純後端專案：只需要 main/index 入口
  if (backendOnly) {
    if (check.details.hasMain) {
      check.pass = true;
      check.message = `後端入口點: ${check.details.mainPath}`;
    } else {
      check.message = '缺少 src/index.ts 或 src/main.ts';
      check.suggestion = '建立 src/index.ts 作為應用入口';
    }
    return check;
  }

  // 前端專案：需要 index.html + main
  // 驗證 index.html 引用 main
  if (indexHtml && mainFile) {
    const htmlContent = fs.readFileSync(indexHtml, 'utf8');

    // 檢查各種可能的引用方式
    const hasScriptRef =
      htmlContent.includes('src="/src/main') ||
      htmlContent.includes('src="./src/main') ||
      htmlContent.includes('src="src/main') ||
      htmlContent.includes('type="module"');

    check.details.scriptConnected = hasScriptRef;

    if (!hasScriptRef) {
      check.message = 'index.html 未引用 main.ts';
      check.suggestion = `在 index.html 的 <body> 結尾添加:\n<script type="module" src="/src/main.ts"></script>`;
      return check;
    }
  }

  // 判斷通過條件
  if (check.details.hasIndexHtml && check.details.hasMain) {
    check.pass = true;
    check.message = `入口點完整: ${check.details.mainPath}`;
  } else if (!check.details.hasIndexHtml && !check.details.hasMain) {
    check.message = '缺少 index.html 和 main.ts';
    check.suggestion = '建立 index.html 和 src/main.ts';
  } else if (!check.details.hasIndexHtml) {
    check.message = '缺少 index.html';
    check.suggestion = '建立 index.html 作為 HTML 入口';
  } else {
    check.message = '缺少 main.ts/main.tsx';
    check.suggestion = '建立 src/main.ts 作為 JS 入口';
  }

  return check;
}

/**
 * 檢查 package.json scripts
 */
function checkPackageScripts(projectRoot) {
  const check = {
    name: 'package.json scripts',
    pass: false,
    severity: 'CRITICAL',
    details: {},
    runCommand: null
  };

  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    check.message = '缺少 package.json';
    check.suggestion = '執行 npm init -y';
    return check;
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (e) {
    check.message = 'package.json 格式錯誤';
    check.suggestion = '修正 JSON 語法';
    return check;
  }

  const scripts = pkg.scripts || {};
  check.details.scripts = Object.keys(scripts);

  // 檢查 dev/start 指令
  const devCommands = ['dev', 'start', 'serve'];
  const hasDevCommand = devCommands.some(cmd => scripts[cmd]);
  check.details.hasDevCommand = hasDevCommand;

  if (hasDevCommand) {
    const devCmd = devCommands.find(cmd => scripts[cmd]);
    check.runCommand = `npm run ${devCmd}`;
    check.details.devCommand = devCmd;
  }

  // 檢查 build 指令
  check.details.hasBuildCommand = !!scripts.build;

  // 檢查 test 指令
  const testScript = scripts.test || '';
  check.details.hasTestCommand = testScript && !testScript.includes('no test specified');

  // 判斷通過條件
  if (hasDevCommand) {
    check.pass = true;
    check.message = `可執行: npm run ${check.details.devCommand}`;
  } else if (check.details.hasBuildCommand || check.details.hasTestCommand) {
    // v1.2: 後端/library 專案不一定需要 dev/start，有 build 或 test 就夠
    check.pass = true;
    check.severity = 'WARNING';
    const available = [
      check.details.hasBuildCommand ? 'build' : null,
      check.details.hasTestCommand ? 'test' : null
    ].filter(Boolean).join(', ');
    check.message = `無 dev/start 指令，但有 ${available} (後端/library 可接受)`;
    check.runCommand = check.details.hasBuildCommand ? 'npm run build' : 'npm test';
  } else {
    check.message = '缺少 dev/start 指令';
    check.suggestion = `在 package.json scripts 中添加:\n"dev": "vite" 或 "start": "node src/index.js"`;
  }

  return check;
}

/**
 * 檢查依賴安裝狀態
 */
function checkDependencies(projectRoot) {
  const check = {
    name: '依賴安裝',
    pass: false,
    severity: 'WARNING',
    details: {}
  };

  const nodeModulesPath = path.join(projectRoot, 'node_modules');
  const pkgLockPath = path.join(projectRoot, 'package-lock.json');
  const yarnLockPath = path.join(projectRoot, 'yarn.lock');
  const pnpmLockPath = path.join(projectRoot, 'pnpm-lock.yaml');

  check.details.hasNodeModules = fs.existsSync(nodeModulesPath);
  check.details.hasLockFile = fs.existsSync(pkgLockPath) || fs.existsSync(yarnLockPath) || fs.existsSync(pnpmLockPath);

  if (check.details.hasNodeModules) {
    // 檢查 node_modules 是否有內容
    try {
      const modules = fs.readdirSync(nodeModulesPath);
      check.details.moduleCount = modules.length;
      check.pass = modules.length > 5; // 至少要有一些依賴
    } catch (e) {
      check.details.moduleCount = 0;
    }
  }

  if (check.pass) {
    check.message = `依賴已安裝 (${check.details.moduleCount} 個模組)`;
  } else if (!check.details.hasNodeModules) {
    check.message = '尚未安裝依賴';
    check.suggestion = '執行 npm install';
  } else {
    check.message = 'node_modules 可能不完整';
    check.suggestion = '執行 npm install 重新安裝';
  }

  return check;
}

/**
 * 檢查 TypeScript 配置
 */
function checkTypeScriptConfig(projectRoot, srcPath) {
  const check = {
    name: 'TypeScript 配置',
    pass: false,
    severity: 'WARNING',
    details: {}
  };

  // 檢查是否是 TypeScript 專案
  const tsFiles = findFiles(srcPath, /\.tsx?$/, 3);
  check.details.hasTsFiles = tsFiles.length > 0;

  if (!check.details.hasTsFiles) {
    // 不是 TypeScript 專案，跳過
    check.pass = true;
    check.severity = 'SKIP';
    check.message = '非 TypeScript 專案';
    return check;
  }

  // 檢查 tsconfig.json
  const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
  check.details.hasTsconfig = fs.existsSync(tsconfigPath);

  if (!check.details.hasTsconfig) {
    check.severity = 'CRITICAL';
    check.message = 'TypeScript 專案缺少 tsconfig.json';
    check.suggestion = '執行 npx tsc --init 或建立 tsconfig.json';
    return check;
  }

  // 驗證 tsconfig.json 內容
  try {
    const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8');
    // 移除註解後解析
    // v1.4: 修正 - 單遍掃描，正確處理字串內的 /* 和 // 
    // 例如 "@/*": ["src/*"] 不會被誤判為區塊註解
    const cleanContent = (() => {
      const src = tsconfigContent;
      let result = '';
      let i = 0;
      while (i < src.length) {
        const ch = src[i];
        // 進入字串：原封不動複製到結束引號
        if (ch === '"') {
          let j = i + 1;
          while (j < src.length && src[j] !== '"') {
            if (src[j] === '\\') j++; // 跳過轉義
            j++;
          }
          result += src.slice(i, j + 1); // 包含結尾 "
          i = j + 1;
          continue;
        }
        // 區塊註解 /* ... */
        if (ch === '/' && src[i + 1] === '*') {
          const end = src.indexOf('*/', i + 2);
          i = end === -1 ? src.length : end + 2;
          continue;
        }
        // 行尾註解 //
        if (ch === '/' && src[i + 1] === '/') {
          const nl = src.indexOf('\n', i);
          i = nl === -1 ? src.length : nl; // 保留換行
          continue;
        }
        result += ch;
        i++;
      }
      return result.replace(/,(\s*[}\]])/g, '$1'); // 移除尾隨逗號
    })();

    const tsconfig = JSON.parse(cleanContent);
    check.details.compilerOptions = !!tsconfig.compilerOptions;
    check.details.include = tsconfig.include || [];

    // 檢查關鍵配置
    const co = tsconfig.compilerOptions || {};
    check.details.hasJsx = !!co.jsx;
    check.details.hasModuleResolution = !!co.moduleResolution;
    check.details.hasStrict = co.strict === true;

    check.pass = true;
    check.message = 'tsconfig.json 配置正確';
  } catch (e) {
    check.severity = 'CRITICAL';
    check.message = 'tsconfig.json 格式錯誤';
    check.suggestion = '修正 tsconfig.json 的 JSON 語法';
  }

  return check;
}

/**
 * 檢查 Bundler 配置
 * v1.1: 使用 techStack profile 判斷是否需要 bundler
 */
function checkBundlerConfig(projectRoot, techStack) {
  const check = {
    name: 'Bundler 配置',
    pass: false,
    severity: 'WARNING',
    details: {}
  };

  const srcPath = path.join(projectRoot, 'src');
  const backendOnly = (techStack?.projectType === 'backend') || isBackendOnly(projectRoot, srcPath);

  // 純後端專案不需要 bundler
  if (backendOnly) {
    check.pass = true;
    check.severity = 'SKIP';
    check.message = `純後端專案，不需要 bundler (來源: ${techStack?.source || 'file-detection'})`;
    return check;
  }

  // 檢查各種 bundler 配置
  const bundlerConfigs = {
    vite: ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'],
    webpack: ['webpack.config.js', 'webpack.config.ts'],
    rollup: ['rollup.config.js', 'rollup.config.mjs'],
    parcel: ['.parcelrc'],
    esbuild: ['esbuild.config.js']
  };

  for (const [bundler, configs] of Object.entries(bundlerConfigs)) {
    for (const config of configs) {
      if (fs.existsSync(path.join(projectRoot, config))) {
        check.details.bundler = bundler;
        check.details.configFile = config;
        check.pass = true;
        check.message = `使用 ${bundler} (${config})`;
        return check;
      }
    }
  }

  // 檢查 package.json 中的 bundler 依賴
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (allDeps.vite) {
        check.details.bundler = 'vite';
        check.details.inDeps = true;
        // Vite 可以零配置運行
        check.pass = true;
        check.message = 'Vite 已安裝 (零配置模式)';
        return check;
      }

      if (allDeps['react-scripts']) {
        check.details.bundler = 'create-react-app';
        check.pass = true;
        check.message = '使用 Create React App';
        return check;
      }

      if (allDeps.next) {
        check.details.bundler = 'next';
        check.pass = true;
        check.message = '使用 Next.js';
        return check;
      }
    } catch (e) {
      // 忽略解析錯誤
    }
  }

  // 檢查是否是純 HTML 專案（不需要 bundler）
  const indexHtml = path.join(projectRoot, 'index.html');
  if (fs.existsSync(indexHtml)) {
    const htmlContent = fs.readFileSync(indexHtml, 'utf8');
    // 如果 HTML 直接引用 .js 檔案（非 .ts），可能不需要 bundler
    if (!htmlContent.includes('.ts"') && !htmlContent.includes(".ts'")) {
      check.pass = true;
      check.severity = 'SKIP';
      check.message = '純 HTML/JS 專案，不需要 bundler';
      return check;
    }
  }

  // v1.2: 如果 build script 是 tsc，視為純 TypeScript 編譯專案，不需要 bundler
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const buildScript = pkg.scripts?.build || '';
      if (buildScript.includes('tsc') || buildScript.includes('ts-node')) {
        check.pass = true;
        check.severity = 'SKIP';
        check.message = '純 TypeScript 編譯專案 (tsc)，不需要 bundler';
        return check;
      }
    } catch (e) { /* 忽略 */ }
  }

  check.message = '缺少 bundler 配置';
  check.suggestion = '安裝 Vite: npm install vite --save-dev\n建立 vite.config.ts';
  check.severity = 'CRITICAL';

  return check;
}

/**
 * 檢查 CSS 框架配置
 */
function checkCSSFramework(projectRoot) {
  const check = {
    name: 'CSS 框架',
    pass: true, // 預設通過（CSS 框架是可選的）
    severity: 'INFO',
    details: {}
  };

  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return check;
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    // 檢查 Tailwind
    if (allDeps.tailwindcss) {
      check.details.framework = 'tailwindcss';

      // 檢查 tailwind.config.js
      const tailwindConfig = ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs']
        .find(f => fs.existsSync(path.join(projectRoot, f)));

      if (!tailwindConfig) {
        check.pass = false;
        check.severity = 'WARNING';
        check.message = 'Tailwind 已安裝但缺少配置';
        check.suggestion = '執行 npx tailwindcss init';
        return check;
      }

      // 檢查 postcss.config.js
      const postcssConfig = ['postcss.config.js', 'postcss.config.cjs']
        .find(f => fs.existsSync(path.join(projectRoot, f)));

      if (!postcssConfig) {
        check.pass = false;
        check.severity = 'WARNING';
        check.message = 'Tailwind 缺少 PostCSS 配置';
        check.suggestion = '建立 postcss.config.js';
        return check;
      }

      check.message = 'Tailwind CSS 配置完整';
      return check;
    }

    // 其他 CSS 框架
    if (allDeps['styled-components']) {
      check.details.framework = 'styled-components';
      check.message = '使用 styled-components';
    } else if (allDeps['@emotion/react']) {
      check.details.framework = 'emotion';
      check.message = '使用 Emotion';
    } else if (allDeps.sass || allDeps['node-sass']) {
      check.details.framework = 'sass';
      check.message = '使用 Sass';
    } else {
      check.message = '使用原生 CSS';
    }

  } catch (e) {
    // 忽略解析錯誤
  }

  return check;
}

/**
 * 檢查 Import 鏈完整性
 */
function checkImportChain(projectRoot, srcPath) {
  const check = {
    name: 'Import 鏈',
    pass: true,
    severity: 'WARNING',
    details: {
      brokenImports: []
    }
  };

  if (!fs.existsSync(srcPath)) {
    return check;
  }

  // 找出所有 TS/JS 檔案
  const sourceFiles = findFiles(srcPath, /\.(ts|tsx|js|jsx)$/, 5);

  for (const file of sourceFiles.slice(0, 20)) { // 限制檢查數量
    try {
      const content = fs.readFileSync(file, 'utf8');

      // 提取 import 語句
      const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];

        // 跳過 node_modules 依賴
        if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
          continue;
        }

        // 解析相對路徑
        const fileDir = path.dirname(file);
        let resolvedPath;

        if (importPath.startsWith('@/')) {
          // 假設 @ 指向 src
          resolvedPath = path.join(srcPath, importPath.slice(2));
        } else {
          resolvedPath = path.join(fileDir, importPath);
        }

        // 嘗試各種副檔名
        const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
        let exists = extensions.some(ext => fs.existsSync(resolvedPath + ext));

        // v1.2: TypeScript moduleResolution "bundler" 支援
        // import './foo.js' 實際對應 './foo.ts'，需要把 .js → .ts 嘗試
        if (!exists && importPath.endsWith('.js')) {
          const tsPath = resolvedPath.replace(/\.js$/, '.ts');
          const tsxPath = resolvedPath.replace(/\.js$/, '.tsx');
          exists = fs.existsSync(tsPath) || fs.existsSync(tsxPath);
        }

        if (!exists) {
          check.details.brokenImports.push({
            file: path.relative(projectRoot, file),
            import: importPath,
            resolved: path.relative(projectRoot, resolvedPath)
          });
        }
      }
    } catch (e) {
      // 忽略讀取錯誤
    }
  }

  if (check.details.brokenImports.length > 0) {
    check.pass = false;
    check.severity = 'CRITICAL';
    check.message = `發現 ${check.details.brokenImports.length} 個斷裂的 import`;
    check.suggestion = '修正以下 import 路徑:\n' +
      check.details.brokenImports.slice(0, 5)
        .map(b => `  ${b.file}: import "${b.import}"`)
        .join('\n');
  } else {
    check.message = 'Import 鏈完整';
  }

  return check;
}

/**
 * 遞迴找檔案
 */
function findFiles(dir, pattern, maxDepth = 3, currentDepth = 0, files = []) {
  if (!fs.existsSync(dir) || currentDepth > maxDepth) return files;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        findFiles(fullPath, pattern, maxDepth, currentDepth + 1, files);
      } else if (pattern.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // 忽略權限錯誤
  }

  return files;
}

/**
 * 格式化驗證結果
 */
function formatResult(result) {
  const lines = [];

  lines.push('═'.repeat(60));
  lines.push(`可執行性驗證 | ${result.valid ? '✅ PASS' : '❌ FAIL'} | ${result.percentage}%`);
  lines.push('═'.repeat(60));
  lines.push('');

  // 檢查清單
  lines.push('檢查項目:');
  for (const check of result.checks) {
    const icon = check.pass ? '✅' : check.severity === 'CRITICAL' ? '❌' : '⚠️';
    lines.push(`  ${icon} ${check.name}: ${check.message || ''}`);
  }
  lines.push('');

  // 關鍵問題
  if (result.criticalIssues.length > 0) {
    lines.push('❌ 關鍵問題 (必須修復):');
    for (const issue of result.criticalIssues) {
      lines.push(`  - ${issue.name}: ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`    建議: ${issue.suggestion.split('\n')[0]}`);
      }
    }
    lines.push('');
  }

  // 警告
  if (result.warnings.length > 0) {
    lines.push('⚠️ 警告:');
    for (const warn of result.warnings) {
      lines.push(`  - ${warn.name}: ${warn.message}`);
    }
    lines.push('');
  }

  // 執行指令
  if (result.runCommand) {
    lines.push(`🚀 執行指令: ${result.runCommand}`);
  }

  lines.push('═'.repeat(60));

  return lines.join('\n');
}

module.exports = {
  validateExecutability,
  formatResult,
  isBackendOnly,
  // 匯出個別檢查函式供測試
  checkEntryPoint,
  checkPackageScripts,
  checkDependencies,
  checkTypeScriptConfig,
  checkBundlerConfig,
  checkCSSFramework,
  checkImportChain
};

// CLI 執行
if (require.main === module) {
  const target = process.argv[2] || process.cwd();
  const result = validateExecutability(target);
  console.log(formatResult(result));
  process.exit(result.valid ? 0 : 1);
}
