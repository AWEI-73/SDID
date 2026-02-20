#!/usr/bin/env node
/**
 * BUILD Phase 7: 整合檢查 v3.0
 * 輸入: 完成的程式碼 | 產物: 整合項目確認 + checkpoint
 * 
 * v3.0 變更：
 * - 關鍵問題（路由未整合）改為 BLOCKER，禁止 --pass 跳過
 * - 強化模組匯出檢查
 * 
 * 整合檢查清單 (integrationChecklist):
 * - packageJson: 新增工具腳本、第三方套件、npm scripts
 * - routes: 新增頁面元件、路由路徑
 * - moduleExports: 新增函式或類型、shared 模組
 * - dependencies: 新增第三方套件
 * 
 * 軍規 7: 完整執行 Phase 1-8，不可中途跳過
 */
const fs = require('fs');
const path = require('path');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { writeCheckpoint } = require('../../lib/checkpoint.cjs');
const { detectProjectType, getSrcDir } = require('../../lib/shared/project-type.cjs');
const { anchorOutput, anchorPass, anchorErrorSpec, emitPass, emitFix } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd } = require('../../lib/shared/next-command-helper.cjs');

// v4.1: UI Bind 驗證器 (Vanilla JS 專案)
const { validateUIBind, formatResult: formatUIBindResult } = require('../../lib/build/ui-bind-validator.cjs');

function run(options) {

  console.log(getSimpleHeader('BUILD', 'Phase 7'));

  const { target, iteration = 'iter-1', story, level = 'M' } = options;
  // 計算相對路徑（用於輸出指令，避免絕對路徑問題）
  const relativeTarget = path.relative(process.cwd(), target) || '.';


  // 門控規格 - 告訴 AI 這個 phase 會檢查什麼
  // v4.0: Phase 7 是路由整合的主要檢查點 (BLOCKER)
  // v4.1: 新增 UI Bind 驗證 (Vanilla JS 專案)
  const gateSpec = {
    checks: [
      { name: '路由整合', pattern: 'Page 組件已 import + Route 定義', desc: '所有 Page 組件都在路由中 (BLOCKER)' },
      { name: '模組匯出', pattern: 'index.ts export', desc: '模組有 Facade 匯出' },
      { name: '函式匯出驗證', pattern: 'Story 新增函式已從 barrel export 匯出', desc: '新函式可被外部 import (BLOCKER)' },
      { name: 'package.json', pattern: 'scripts/deps 更新', desc: '新增套件已加入' },
      { name: '依賴更新', pattern: 'npm install', desc: '第三方套件已安裝' },
      { name: 'UI Bind', pattern: '@GEMS-UI-BIND 標籤', desc: 'Vanilla JS: DOM ID ↔ JS 函式一致性' }
    ],
    note: '路由未整合 / 函式未匯出 = BLOCKER，禁止 --pass 跳過'
  };

  if (!story) {
    emitFix({
      scope: 'BUILD Phase 7',
      summary: '缺少 --story 參數',
      targetFile: 'CLI 參數',
      missing: ['--story 參數'],
      example: `node task-pipe/runner.cjs --phase=BUILD --step=7 --story=Story-1.0 --target=${relativeTarget}`,
      nextCmd: 'node task-pipe/runner.cjs --phase=BUILD --step=7 --story=Story-X.Y',
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      phase: 'build',
      step: 'phase-7',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  // 偵測專案類型
  const { type: projectType } = detectProjectType(target);
  const srcPath = getSrcDir(target, projectType);

  // ============================================
  // v4.1: UI Bind 驗證 (非 React/Vue 專案)
  // 檢查 @GEMS-UI-BIND 標籤與 HTML/JS 的一致性
  // ============================================
  const isFrameworkProject = hasReactOrVue(target, srcPath);
  let uiBindResult = null;
  
  if (!isFrameworkProject) {
    const htmlPath = path.join(target, 'index.html');
    uiBindResult = validateUIBind(target, srcPath, htmlPath);
    
    if (!uiBindResult.skipped) {
      console.log(`[INFO] UI Bind 驗證: ${uiBindResult.stats.total} 個 binding | ✅ ${uiBindResult.stats.passed} | ❌ ${uiBindResult.stats.failed}`);
      
      // 如果有 UI Bind 問題，輸出詳細報告
      if (!uiBindResult.valid) {
        const uiBindReport = formatUIBindResult(uiBindResult);
        
        // 存檔到 logs
        const { saveLog } = require('../../lib/shared/log-output.cjs');
        saveLog({
          projectRoot: target,
          iteration: parseInt(iteration.replace('iter-', '')),
          phase: 'build',
          step: 'phase-7',
          story,
          type: 'ui-bind-error',
          content: uiBindReport
        });
        
        console.log('');
        console.log(uiBindReport);
      }
    } else {
      console.log(`[INFO] UI Bind 驗證: 跳過 (${uiBindResult.reason})`);
    }
  } else {
    console.log(`[INFO] UI Bind 驗證: 跳過 (React/Vue 專案使用路由檢查)`);
  }

  // 檢查整合項目
  const checks = checkIntegrations(target, srcPath, iteration, story);
  
  // v4.1: 加入 UI Bind 檢查結果
  if (uiBindResult && !uiBindResult.skipped && !uiBindResult.valid) {
    checks.push({
      name: 'UI Bind 一致性',
      when: ['@GEMS-UI-BIND 標籤定義'],
      check: ['HTML ID', 'JS handler/init 函式'],
      needsCheck: true,
      items: uiBindResult.issues.map(i => `${i.binding.selector}: ${i.message}`),
      critical: false  // UI Bind 問題不是 BLOCKER，但需要修正
    });
  }
  
  const needsAction = checks.filter(c => c.needsCheck && c.items.length > 0);
  const criticalIssues = checks.filter(c => c.critical && c.items.length > 0);

  // v3.0: 如果有關鍵問題（未註冊的頁面 or 未匯出的函式），改為 BLOCKER，禁止跳過
  if (criticalIssues.length > 0) {
    const criticalItems = criticalIssues.map(c => `- ⚠️ ${c.name}: ${formatItems(c.items)}`).join('\n');

    // v5.0: 根據問題類型給出不同的修復指引
    const hasRouteIssues = criticalIssues.some(c => c.name === '路由設定');
    const hasExportIssues = criticalIssues.some(c => c.name === '模組匯出');

    const taskItems = [];
    if (hasRouteIssues) {
      taskItems.push('路由整合:');
      taskItems.push('1. 在 App.tsx 或 routes/index.tsx 中 import 這些頁面');
      taskItems.push('2. 新增對應的 Route 定義');
    }
    if (hasExportIssues) {
      taskItems.push('模組匯出:');
      taskItems.push('1. 在對應模組的 index.ts 中加入 export 語句');
      taskItems.push('2. 確保新增函式可被外部模組 import');
    }
    taskItems.push('');
    taskItems.push('⚠️ 此問題無法使用 --pass 跳過');

    anchorOutput({
      context: `Phase 7 | ${story} | 整合問題`,
      error: {
        type: 'BLOCKER',  // v3.0: 改為 BLOCKER
        summary: '發現未整合的組件或未匯出的函式，禁止跳過'
      },
      template: {
        title: 'CRITICAL_ISSUES (禁止 --pass)',
        content: criticalItems
      },
      task: taskItems,
      output: `NEXT: ${getRetryCmd('BUILD', '7', { story })}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-7',
      story
    });

    // v3.0: 改為 BLOCKER，強制修復
    return { verdict: 'BLOCKER', reason: '整合問題，禁止跳過', criticalIssues };
  }

  // 如果有 --pass 參數或沒有需要檢查的項目（非關鍵問題才允許 --pass）
  if (process.argv.includes('--pass') || needsAction.length === 0) {
    // v4.0: 可執行性預檢 - 提前警告 Phase 8 可能的問題
    const execWarnings = preflightExecutabilityCheck(target);
    
    writeCheckpoint(target, iteration, story, '7', {
      verdict: 'PASS',
      checks: checks.map(c => ({ name: c.name, checked: c.needsCheck })),
      execWarnings: execWarnings,
      uiBind: uiBindResult ? {
        validated: !uiBindResult.skipped,
        stats: uiBindResult.stats,
        valid: uiBindResult.valid
      } : null
    });

    const checkSummary = checks.map(c => `${c.name}: ${c.needsCheck ? 'OK' : '跳過'}`).join(' | ');
    const execNote = execWarnings.length > 0 
      ? `\n⚠️ Phase 8 預警: ${execWarnings.join('; ')}`
      : '';
    const uiBindNote = uiBindResult && !uiBindResult.skipped
      ? ` | UI Bind: ${uiBindResult.valid ? '✓' : `${uiBindResult.stats.failed} 問題`}`
      : '';

    emitPass({
      scope: 'BUILD Phase 7',
      summary: checkSummary + uiBindNote + execNote,
      nextCmd: getNextCmd('BUILD', '7', { story, level })
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-7',
      story
    });
    return { verdict: 'PASS', execWarnings, uiBind: uiBindResult };
  }

  const checklistItems = needsAction.map(c => `- [ ] ${c.name}: ${formatItems(c.items)}`).join('\n');

  anchorOutput({
    context: `Phase 7 | ${story} | 整合檢查`,
    info: {
      '需檢查項目': needsAction.length
    },
    template: {
      title: 'CHECKLIST',
      content: checklistItems
    },
    output: `NEXT: ${getRetryCmd('BUILD', '7', { story })} --pass`
  }, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'build',
    step: 'phase-7',
    story
  });

  return { verdict: 'PENDING', checks: needsAction };
}

function checkIntegrations(target, srcPath, iteration, story) {
  // 找出所有 Page 組件
  const allPages = findNewPages(srcPath);
  // 驗證哪些 Page 沒有被註冊到路由
  const unregisteredPages = findUnregisteredPages(target, srcPath, allPages);

  // v5.0: 深度匯出驗證 — 合併 index.ts 存在性 + 函式匯出檢查
  const structuralExportIssues = findNewExports(srcPath);
  const unexportedFunctions = (iteration && story)
    ? findUnexportedFunctions(target, srcPath, iteration, story)
    : [];
  const allExportIssues = [...structuralExportIssues, ...unexportedFunctions];

  const checks = [
    {
      name: 'package.json',
      when: ['新增工具腳本', '新增第三方套件', '新增 npm scripts'],
      check: ['scripts', 'dependencies', 'devDependencies'],
      needsCheck: fs.existsSync(path.join(target, 'package.json')),
      items: []
    },
    {
      name: '路由設定',
      when: ['新增頁面元件', '新增路由路徑'],
      check: ['routes/routes.config.ts', 'App.tsx'],
      needsCheck: allPages.length > 0,
      items: unregisteredPages,
      // 如果有未註冊的頁面，這是關鍵問題
      critical: unregisteredPages.length > 0
    },
    {
      name: '模組匯出',
      when: ['新增函式或類型', '新增 shared 模組'],
      check: ['modules/[module]/index.ts', 'shared/index.ts'],
      needsCheck: fs.existsSync(path.join(srcPath, 'modules')) || fs.existsSync(path.join(srcPath, 'shared')),
      items: allExportIssues,
      // v5.0: 未匯出的函式也是關鍵問題 — 寫了但外部用不到等於沒寫
      critical: unexportedFunctions.length > 0
    },
    {
      name: '依賴更新',
      when: ['新增第三方套件'],
      check: ['package.json', 'package-lock.json'],
      needsCheck: fs.existsSync(path.join(target, 'package.json')),
      items: []
    }
  ];

  return checks;
}

/**
 * 找出未被註冊的 Page 組件
 * 檢查 App.tsx, routes/index.tsx, routes.config.ts 等位置
 * v4.0: 強化路由整合驗證
 */
function findUnregisteredPages(target, srcPath, pages) {
  if (pages.length === 0) return [];

  // 讀取可能包含路由配置的文件
  const routeFiles = [
    path.join(srcPath, 'App.tsx'),
    path.join(srcPath, 'App.jsx'),
    path.join(srcPath, 'routes', 'index.tsx'),
    path.join(srcPath, 'routes', 'index.jsx'),
    path.join(srcPath, 'routes', 'routes.config.ts'),
    path.join(srcPath, 'routes', 'routes.config.tsx'),
    path.join(srcPath, 'router', 'index.tsx'),
    path.join(srcPath, 'router', 'index.ts'),
    path.join(srcPath, 'main.tsx'),
    path.join(srcPath, 'index.tsx')
  ];

  // 收集所有路由配置內容
  let routeContent = '';
  const foundRouteFiles = [];
  for (const rf of routeFiles) {
    if (fs.existsSync(rf)) {
      routeContent += fs.readFileSync(rf, 'utf8') + '\n';
      foundRouteFiles.push(path.relative(srcPath, rf));
    }
  }

  // v4.0: 如果沒有找到任何路由配置檔案，這本身就是問題
  if (foundRouteFiles.length === 0 && pages.length > 0) {
    return pages.map(p => `${p} (無路由配置檔案)`);
  }

  // 檢查每個 Page 是否被引用
  const unregistered = [];
  for (const page of pages) {
    // 從 "moduleName/PageName.tsx" 提取 "PageName"
    const pageName = page.replace(/\.(tsx|jsx)$/, '').split('/').pop();

    // v4.0: 更嚴格的檢查 - 必須同時有 import 和 Route 定義
    const importCheck = isPageImported(pageName, routeContent);
    const routeCheck = isPageInRoute(pageName, routeContent);

    if (!importCheck && !routeCheck) {
      unregistered.push(`${page} (未 import 且未註冊路由)`);
    } else if (!importCheck) {
      unregistered.push(`${page} (有路由但缺少 import)`);
    } else if (!routeCheck) {
      unregistered.push(`${page} (有 import 但未註冊路由)`);
    }
  }

  return unregistered;
}

/**
 * v4.0: 檢查 Page 是否被 import
 */
function isPageImported(pageName, routeContent) {
  const importPatterns = [
    new RegExp(`import\\s+.*${pageName}.*from`, 'i'),           // import PageName from
    new RegExp(`import\\s*\\{[^}]*${pageName}[^}]*\\}`, 'i'),   // import { PageName } from
    new RegExp(`React\\.lazy.*${pageName}`, 'i'),               // React.lazy(() => import('...PageName'))
    new RegExp(`lazy\\s*\\(.*${pageName}`, 'i'),                // lazy(() => import('...PageName'))
  ];
  return importPatterns.some(p => p.test(routeContent));
}

/**
 * v4.0: 檢查 Page 是否在路由定義中
 */
function isPageInRoute(pageName, routeContent) {
  const routePatterns = [
    new RegExp(`<${pageName}[\\s/>]`, 'i'),                      // <PageName /> or <PageName ...>
    new RegExp(`component:\\s*${pageName}[,\\s}]`, 'i'),         // component: PageName
    new RegExp(`element:\\s*<${pageName}`, 'i'),                 // element: <PageName
    new RegExp(`element:\\s*\\{.*<${pageName}`, 'i'),            // element: {<PageName...}
    new RegExp(`Component:\\s*${pageName}[,\\s}]`, 'i'),         // Component: PageName (大寫)
  ];
  return routePatterns.some(p => p.test(routeContent));
}

function findNewPages(srcPath) {
  const pages = [];
  const pagesDir = path.join(srcPath, 'pages');
  const modulesDir = path.join(srcPath, 'modules');

  // 檢查 pages 目錄
  if (fs.existsSync(pagesDir)) {
    const files = fs.readdirSync(pagesDir);
    files.filter(f => /Page\.(tsx|jsx)$/.test(f)).forEach(f => pages.push(f));
  }

  // 檢查 modules/*/pages 目錄
  if (fs.existsSync(modulesDir)) {
    const modules = fs.readdirSync(modulesDir, { withFileTypes: true });
    for (const mod of modules) {
      if (mod.isDirectory()) {
        const modPagesDir = path.join(modulesDir, mod.name, 'pages');
        if (fs.existsSync(modPagesDir)) {
          const files = fs.readdirSync(modPagesDir);
          files.filter(f => /Page\.(tsx|jsx)$/.test(f)).forEach(f => pages.push(`${mod.name}/${f}`));
        }
      }
    }
  }

  return pages;
}

function findNewExports(srcPath) {
  const exports = [];
  const modulesDir = path.join(srcPath, 'modules');
  const sharedDir = path.join(srcPath, 'shared');

  // 檢查 modules 目錄
  if (fs.existsSync(modulesDir)) {
    const modules = fs.readdirSync(modulesDir, { withFileTypes: true });
    for (const mod of modules) {
      if (mod.isDirectory()) {
        const indexPath = path.join(modulesDir, mod.name, 'index.ts');
        if (!fs.existsSync(indexPath)) {
          exports.push(`modules/${mod.name}/index.ts (缺少)`);
        }
      }
    }
  }

  // 檢查 shared 目錄
  if (fs.existsSync(sharedDir)) {
    const indexPath = path.join(sharedDir, 'index.ts');
    if (!fs.existsSync(indexPath)) {
      exports.push('shared/index.ts (缺少)');
    }
  }

  return exports;
}

/**
 * v5.0: 深度匯出驗證 — 檢查 Story 新增的函式是否從 barrel export 匯出
 * 
 * 問題背景：Phase 7 原本只檢查 index.ts 是否存在，不檢查內容。
 * 導致新函式（如 searchRecipes）寫好了、測試也過了，但沒有從模組 index.ts 匯出，
 * 外部模組 import 不到。
 * 
 * @param {string} target - 專案根目錄
 * @param {string} srcPath - src 目錄路徑
 * @param {string} iteration - 迭代 ID (e.g. 'iter-2')
 * @param {string} story - Story ID (e.g. 'Story-2.1')
 * @returns {string[]} 未匯出的函式清單
 */
function findUnexportedFunctions(target, srcPath, iteration, story) {
  const issues = [];

  // 1. 讀取 implementation plan 取得函式清單
  const planPath = path.join(target, `.gems/iterations/${iteration}/plan/implementation_plan_${story}.md`);
  if (!fs.existsSync(planPath)) return issues;

  const { extractFunctionManifest } = require('../../lib/plan/plan-spec-extractor.cjs');
  const manifest = extractFunctionManifest(planPath);
  if (!manifest.hasManifest || manifest.functions.length === 0) return issues;

  // 2. 掃描 src 取得已標籤的函式及其檔案位置
  const liteValidatorPath = path.join(__dirname, '../../lib/scan/gems-validator-lite.cjs');
  let scanGemsTags;
  if (fs.existsSync(liteValidatorPath)) {
    scanGemsTags = require(liteValidatorPath).scanGemsTagsLite;
  } else {
    scanGemsTags = require('../../lib/scan/gems-validator.cjs').scanGemsTags;
  }

  const scanResult = scanGemsTags(srcPath);
  const storyFunctions = scanResult.functions.filter(f => f.storyId === story);

  if (storyFunctions.length === 0) return issues;

  // 3. 對每個 Story 函式，找到它所屬的模組，檢查 barrel export
  const modulesDir = path.join(srcPath, 'modules');
  if (!fs.existsSync(modulesDir)) return issues;

  for (const fn of storyFunctions) {
    if (!fn.file) continue;

    // 判斷函式屬於哪個模組 (e.g. "modules/recipe-core/services/search-service.ts" → "recipe-core")
    const relToSrc = path.relative(srcPath, path.resolve(fn.file)).split(path.sep).join('/');
    const moduleMatch = relToSrc.match(/^modules\/([^/]+)\//);
    if (!moduleMatch) continue;

    const moduleName = moduleMatch[1];
    const indexPath = path.join(modulesDir, moduleName, 'index.ts');

    // 如果 index.ts 不存在，findNewExports 已經會報了，這裡跳過
    if (!fs.existsSync(indexPath)) continue;

    // 讀取 index.ts 內容，檢查函式名是否出現在 export 語句中
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const fnName = fn.name;

    // 匹配各種 export 形式:
    // export { fnName } from '...'
    // export { fnName as alias } from '...'
    // export { ..., fnName, ... } from '...'
    // export * from '...' (這種無法精確判斷，先跳過)
    const hasNamedExport = new RegExp(
      `export\\s*\\{[^}]*\\b${escapeRegex(fnName)}\\b[^}]*\\}`, 'i'
    ).test(indexContent);

    const hasReExportAll = /export\s*\*\s*from/.test(indexContent);

    // 如果有 export * 就不報（可能已經涵蓋）
    if (!hasNamedExport && !hasReExportAll) {
      issues.push(`${fnName} → modules/${moduleName}/index.ts 未匯出 (來自 ${relToSrc})`);
    }
  }

  return issues;
}

/**
 * 轉義 regex 特殊字元
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatItems(items, limit = 5) {
  if (!items || items.length === 0) return '檢查是否需要更新';
  if (items.length <= limit) return items.join(', ');
  return `${items.slice(0, limit).join(', ')} ... (+${items.length - limit} files)`;
}

/**
 * v4.1: 檢查是否為 React/Vue 框架專案
 * 框架專案使用路由檢查，非框架專案使用 UI Bind 檢查
 */
function hasReactOrVue(target, srcPath) {
  // 1. 檢查 package.json 依賴
  const pkgPath = path.join(target, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      // React 或 Vue 相關套件
      const frameworkPackages = ['react', 'react-dom', 'vue', '@vue/cli', 'next', 'nuxt'];
      if (frameworkPackages.some(p => allDeps[p])) {
        return true;
      }
    } catch (e) {
      // 忽略 JSON 解析錯誤
    }
  }
  
  // 2. 檢查是否有 JSX/TSX 檔案（React 特徵）
  if (fs.existsSync(srcPath)) {
    const files = fs.readdirSync(srcPath, { recursive: true });
    if (files.some(f => /\.(jsx|tsx)$/.test(f))) {
      return true;
    }
  }
  
  // 3. 檢查 App.tsx/App.jsx 是否存在
  const appFiles = ['App.tsx', 'App.jsx', 'App.vue'];
  if (appFiles.some(f => fs.existsSync(path.join(srcPath, f)))) {
    return true;
  }
  
  return false;
}

/**
 * v4.0: 可執行性預檢
 * 輕量級檢查，提前警告 Phase 8 可能遇到的問題
 * @param {string} target - 專案根目錄
 * @returns {string[]} 警告訊息陣列
 */
function preflightExecutabilityCheck(target) {
  const warnings = [];
  const srcPath = path.join(target, 'src');

  // 1. 檢查入口點
  const hasIndexHtml = fs.existsSync(path.join(target, 'index.html')) || 
                       fs.existsSync(path.join(target, 'public', 'index.html'));
  const hasMain = ['main.ts', 'main.tsx', 'main.js', 'index.ts', 'index.tsx', 'index.js']
    .some(f => fs.existsSync(path.join(srcPath, f)));

  if (!hasIndexHtml && !hasMain) {
    warnings.push('缺少入口點 (index.html 或 main.ts)');
  }

  // 2. 檢查 package.json scripts
  const pkgPath = path.join(target, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const scripts = pkg.scripts || {};
      const hasDevScript = ['dev', 'start', 'serve'].some(s => scripts[s]);
      if (!hasDevScript) {
        warnings.push('package.json 缺少 dev/start script');
      }
    } catch (e) {
      warnings.push('package.json 格式錯誤');
    }
  } else {
    warnings.push('缺少 package.json');
  }

  // 3. 檢查 bundler
  const hasBundler = ['vite.config.ts', 'vite.config.js', 'webpack.config.js']
    .some(f => fs.existsSync(path.join(target, f)));
  
  // 如果有 TS 檔案但沒有 bundler，警告
  if (!hasBundler && fs.existsSync(srcPath)) {
    const hasTsFiles = fs.readdirSync(srcPath).some(f => /\.tsx?$/.test(f));
    if (hasTsFiles) {
      warnings.push('TypeScript 專案缺少 bundler 配置');
    }
  }

  return warnings;
}

// 自我執行判斷
if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let iteration = 'iter-1';
  let story = null;
  let level = 'M';

  // 簡單參數解析
  args.forEach(arg => {
    if (arg.startsWith('--target=')) target = arg.split('=')[1];
    if (arg.startsWith('--project-path=')) target = arg.split('=')[1];
    if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
    if (arg.startsWith('--story=')) story = arg.split('=')[1];
    if (arg.startsWith('--level=')) level = arg.split('=')[1];
  });

  // 確保 target 是絕對路徑
  if (!path.isAbsolute(target)) {
    target = path.resolve(process.cwd(), target);
  }

  run({ target, iteration, story, level });
}

module.exports = { run };
