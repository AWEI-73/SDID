#!/usr/bin/env node
/**
 * BUILD Phase 3: 整合層 (v7.1)
 * 合併原 Phase 6+7 的跨模組整合檢查
 *
 * 職責:
 * - P0 SVC/API 整合測試非 Mock 驗證（M28-4）
 * - 路由整合（Page 組件已掛載）
 * - 模組匯出（barrel export 完整）
 * - UI Bind 驗證（Vanilla JS 專案）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd } = require('../../lib/shared/next-command-helper.cjs');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { writeCheckpoint } = require('../../lib/checkpoint.cjs');
const { detectProjectType, getSrcDir } = require('../../lib/shared/project-type.cjs');

// UI Bind 驗證器（可選）
let validateUIBind = null;
let formatUIBindResult = null;
try {
  const uiBindMod = require('../../lib/build/ui-bind-validator.cjs');
  validateUIBind = uiBindMod.validateUIBind;
  formatUIBindResult = uiBindMod.formatResult;
} catch { /* 可選 */ }

/** GEMS: buildPhase3 | P1 | loadAcTests(IO)→runIntegration(IO)→validateBehavior(Pure)→RETURN:PhaseResult | Story-4.0 */
function run(options) {
  const { target, iteration = 'iter-1', story, level = 'M' } = options;
  const relativeTarget = path.relative(process.cwd(), target) || '.';
  const iterNum = parseInt(iteration.replace('iter-', '')) || 1;

  console.log(getSimpleHeader('BUILD', 'Phase 3'));

  if (!story) {
    emitBlock({
      scope: 'BUILD Phase 3',
      summary: '缺少 --story 參數',
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-X.Y --target=${relativeTarget}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });
    return { verdict: 'BLOCKER' };
  }

  const { type: projectType } = detectProjectType(target);
  const srcPath = getSrcDir(target, projectType);

  console.log(`\n🔗 整合層 | ${story}`);

  // ============================================
  // 0. P0 SVC/API 整合測試非 Mock 驗證（M28-4）
  // ============================================
  const p0MockIssues = checkP0SvcApiNonMock(target, iteration, story);
  if (p0MockIssues.blockers.length > 0) {
    const tasks = p0MockIssues.blockers.map(issue => ({
      action: 'FIX_INTEGRATION_TEST',
      file: issue.testPath,
      expected: issue.message,
      acSpec: `P0 SVC/API 整合測試禁止 mock 本地依賴`
    }));
    emitFix({
      scope: `BUILD Phase 3 | ${story}`,
      summary: `P0 SVC/API 整合測試包含本地 mock（${p0MockIssues.blockers.length} 個）`,
      targetFile: p0MockIssues.blockers[0]?.testPath || 'src/',
      missing: p0MockIssues.blockers.map(i => i.message),
      nextCmd: getRetryCmd('BUILD', '3', { story, target: relativeTarget, iteration }),
      tasks
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });
    return { verdict: 'BLOCKER', reason: 'p0_svc_api_local_mock' };
  }
  if (p0MockIssues.checked > 0) {
    console.log(`   ✅ P0 SVC/API 整合測試: ${p0MockIssues.checked} 個已驗（無本地 mock）`);
  }

  // ============================================
  // 1. 路由整合檢查
  // ============================================
  const allPages = findNewPages(srcPath);
  const unregisteredPages = findUnregisteredPages(target, srcPath, allPages);

  if (unregisteredPages.length > 0) {
    const tasks = unregisteredPages.map(p => ({
      action: 'REGISTER_ROUTE',
      file: 'src/App.tsx 或 src/routes/index.ts',
      expected: `import ${p} 並加入 Route 定義`,
      acSpec: '路由整合是使用者可見功能的前提'
    }));
    emitFix({
      scope: `BUILD Phase 3 | ${story}`,
      summary: `${unregisteredPages.length} 個 Page 未整合到路由`,
      targetFile: 'src/routes/ 或 src/App.tsx',
      missing: unregisteredPages,
      nextCmd: getRetryCmd('BUILD', '3', { story, target: relativeTarget, iteration }),
      tasks
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });
    return { verdict: 'BLOCKER', reason: 'unregistered_pages' };
  }

  // ============================================
  // 2. 模組匯出檢查（barrel export）
  // ============================================
  const exportIssues = findExportIssues(srcPath, target, iteration, story);

  if (exportIssues.critical.length > 0) {
    const tasks = exportIssues.critical.map(issue => ({
      action: 'ADD_EXPORT',
      file: issue.indexFile,
      expected: `export { ${issue.fnName} } from '${issue.relPath}'`,
      acSpec: '函式未匯出等於對外不可見'
    }));
    emitFix({
      scope: `BUILD Phase 3 | ${story}`,
      summary: `${exportIssues.critical.length} 個函式未從 barrel export 匯出`,
      targetFile: 'modules/*/index.ts',
      missing: exportIssues.critical.map(i => i.fnName),
      nextCmd: getRetryCmd('BUILD', '3', { story, target: relativeTarget, iteration }),
      tasks
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });
    return { verdict: 'BLOCKER', reason: 'unexported_functions' };
  }

  // ============================================
  // 3. UI Bind 驗證（Vanilla JS 專案）
  // ============================================
  let uiBindNote = '';
  if (validateUIBind && !hasReactOrVue(target, srcPath)) {
    const htmlPath = path.join(target, 'index.html');
    const uiBindResult = validateUIBind(target, srcPath, htmlPath);
    if (!uiBindResult.skipped && !uiBindResult.valid) {
      const tasks = uiBindResult.issues.map(i => ({
        action: 'FIX_UI_BIND',
        file: i.binding?.file || 'src/',
        expected: i.message,
        acSpec: `UI Bind: ${i.binding?.selector || ''}`
      }));
      emitFix({
        scope: `BUILD Phase 3 | ${story}`,
        summary: `UI Bind 不一致 (${uiBindResult.stats.failed} 個問題)`,
        targetFile: 'src/',
        missing: uiBindResult.issues.map(i => i.message),
        nextCmd: getRetryCmd('BUILD', '3', { story, target: relativeTarget, iteration }),
        tasks
      }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });
      return { verdict: 'BLOCKER', reason: 'ui_bind_mismatch' };
    }
    if (!uiBindResult.skipped) {
      uiBindNote = ` | UI Bind: ${uiBindResult.stats.passed}/${uiBindResult.stats.total}`;
    }
  }

  // ============================================
  // 全部通過
  // ============================================
  writeCheckpoint(target, iteration, story, '3', {
    verdict: 'PASS',
    pages: allPages.length,
    exportIssues: exportIssues.warnings.length,
    uiBind: uiBindNote ? 'checked' : 'skipped'
  });

  const summary = [
    `路由: ${allPages.length > 0 ? `${allPages.length} 頁面已整合` : '無頁面'}`,
    `匯出: ${exportIssues.warnings.length > 0 ? `${exportIssues.warnings.length} 警告` : 'OK'}`,
    uiBindNote,
  ].filter(Boolean).join(' | ');

  emitPass({
    scope: `BUILD Phase 3 | ${story}`,
    summary,
    nextCmd: getNextCmd('BUILD', '3', { story, level, target: relativeTarget, iteration })
  }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });

  return { verdict: 'PASS' };
}

/**
 * 找出未被路由整合的 Page 組件
 */
function findUnregisteredPages(target, srcPath, pages) {
  if (pages.length === 0) return [];

  const routeFiles = [
    path.join(srcPath, 'App.tsx'), path.join(srcPath, 'App.jsx'),
    path.join(srcPath, 'routes', 'index.tsx'), path.join(srcPath, 'routes', 'index.ts'),
    path.join(srcPath, 'routes', 'routes.config.ts'),
    path.join(srcPath, 'shared', 'pages', 'app-router.tsx'),
    path.join(srcPath, 'main.tsx'), path.join(srcPath, 'index.tsx'),
  ];

  let routeContent = '';
  for (const rf of routeFiles) {
    if (fs.existsSync(rf)) routeContent += fs.readFileSync(rf, 'utf8') + '\n';
  }
  if (!routeContent && pages.length > 0) return pages.map(p => `${p} (無路由配置)`);

  return pages.filter(page => {
    const pageName = page.replace(/\.(tsx|jsx)$/, '').split('/').pop();
    const pascal = pageName.replace(/-./g, x => x[1].toUpperCase()).replace(/^./, x => x.toUpperCase());
    const imported = [
      new RegExp(`import\\s+.*${pageName}.*from`, 'i'),
      new RegExp(`import\\s+.*${pascal}.*from`, 'i'),
      new RegExp(`React\\.lazy.*${pageName}`, 'i'),
    ].some(p => p.test(routeContent));
    const routed = [
      new RegExp(`<${pascal}[\\s/>]`),
      new RegExp(`element:\\s*<${pascal}`),
      new RegExp(`component:\\s*${pascal}[,\\s}]`, 'i'),
    ].some(p => p.test(routeContent));
    return !imported && !routed;
  });
}

/**
 * 找出 barrel export 問題
 */
function findExportIssues(srcPath, target, iteration, story) {
  const critical = [];
  const warnings = [];

  // 檢查 modules/*/index.ts 是否存在
  const modulesDir = path.join(srcPath, 'modules');
  if (fs.existsSync(modulesDir)) {
    const modules = fs.readdirSync(modulesDir, { withFileTypes: true });
    for (const mod of modules) {
      if (!mod.isDirectory()) continue;
      const indexPath = path.join(modulesDir, mod.name, 'index.ts');
      if (!fs.existsSync(indexPath)) {
        warnings.push({ type: 'missing_index', module: mod.name });
        continue;
      }
    }
  }

  // 深度匯出驗證：Story 函式是否從 barrel export 匯出
  if (story && iteration) {
    const planPath = path.join(target, `.gems/iterations/${iteration}/plan/implementation_plan_${story}.md`);
    if (fs.existsSync(planPath)) {
      try {
        const { scanGemsTags } = require('../../lib/scan/gems-scanner-unified.cjs');
        const scanResult = scanGemsTags(srcPath);
        const storyFunctions = scanResult.functions.filter(f => f.storyId === story);

        for (const fn of storyFunctions) {
          if (!fn.file) continue;
          const relToSrc = path.relative(srcPath, path.resolve(fn.file)).split(path.sep).join('/');
          const moduleMatch = relToSrc.match(/^modules\/([^/]+)\//);
          if (!moduleMatch) continue;

          const moduleName = moduleMatch[1];
          const indexPath = path.join(modulesDir, moduleName, 'index.ts');
          if (!fs.existsSync(indexPath)) continue;

          const indexContent = fs.readFileSync(indexPath, 'utf8');
          const hasExport = new RegExp(`export\\s*\\{[^}]*\\b${fn.name}\\b[^}]*\\}`).test(indexContent)
            || /export\s*\*\s*from/.test(indexContent);

          if (!hasExport) {
            critical.push({
              fnName: fn.name,
              indexFile: path.relative(target, indexPath),
              relPath: relToSrc
            });
          }
        }
      } catch { /* 掃描失敗不阻擋 */ }
    }
  }

  return { critical, warnings };
}

/**
 * M28-4: P0 SVC/API 整合測試非 Mock 驗證
 * 從 contract 找 P0 SVC/API @TEST 路徑，確認測試檔不 mock 本地依賴（src/）
 * @returns {{ checked: number, blockers: [{testPath, message}] }}
 */
function checkP0SvcApiNonMock(target, iteration, story) {
  const result = { checked: 0, blockers: [] };

  const iterNum = iteration.replace('iter-', '');
  const contractPath = path.join(target, `.gems/iterations/${iteration}/contract_iter-${iterNum}.ts`);
  if (!fs.existsSync(contractPath)) return result;

  let content;
  try { content = fs.readFileSync(contractPath, 'utf8'); } catch { return result; }

  const isV4 = /\/\/\s*@CONTRACT:\s*\w+/.test(content);
  if (!isV4) return result; // v3 不做此檢查

  // 從 @CONTRACT: 區塊找 P0 SVC/API 的 @TEST 路徑
  const blockRegex = /\/\/\s*@CONTRACT:\s*(.+?)(?=\n\/\/\s*@CONTRACT:|\nexport\s+(?:interface|declare|type|class|function)|$)/gs;
  for (const m of content.matchAll(blockRegex)) {
    const block = m[0];
    const headerParts = m[1].trim().split('|').map(s => s.trim());
    const priority = headerParts[1] || '';
    const type = headerParts[2] || '';
    if (priority !== 'P0') continue;
    if (!/^(SVC|API)$/.test(type)) continue;

    const testMatch = block.match(/\/\/\s*@TEST:\s*(.+\.(?:test|spec)\.tsx?)/);
    if (!testMatch) continue;
    const testPath = testMatch[1].trim();
    const testAbs = path.join(target, testPath);
    if (!fs.existsSync(testAbs)) continue;

    let testContent;
    try { testContent = fs.readFileSync(testAbs, 'utf8'); } catch { continue; }

    result.checked++;

    // 找 vi.mock() 或 jest.mock() 呼叫本地路徑（相對路徑 './' / '../' 或含 'src/'）
    const localMockPattern = /(?:vi|jest)\.mock\s*\(\s*['"](?:\.{1,2}\/|src\/)[^'"]+['"]/g;
    const localMocks = [...testContent.matchAll(localMockPattern)].map(m2 => m2[0].slice(0, 60));

    if (localMocks.length > 0) {
      const name = headerParts[0] || 'Unknown';
      result.blockers.push({
        testPath,
        message: `${name} (P0 ${type}): ${testPath} 包含本地 mock — ${localMocks[0]}...`
      });
    }
  }

  return result;
}

function findNewPages(srcPath) {
  const pages = [];
  const dirs = [
    { dir: path.join(srcPath, 'pages'), prefix: '' },
    { dir: path.join(srcPath, 'shared', 'pages'), prefix: 'shared/pages/' },
  ];

  const modulesDir = path.join(srcPath, 'modules');
  if (fs.existsSync(modulesDir)) {
    fs.readdirSync(modulesDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .forEach(mod => dirs.push({
        dir: path.join(modulesDir, mod.name, 'pages'),
        prefix: `${mod.name}/`
      }));
  }

  for (const { dir, prefix } of dirs) {
    if (!fs.existsSync(dir)) continue;
    fs.readdirSync(dir)
      .filter(f => /\.(tsx|jsx)$/.test(f) && !/router|root/i.test(f))
      .forEach(f => pages.push(`${prefix}${f}`));
  }
  return pages;
}

function hasReactOrVue(target, srcPath) {
  const pkgPath = path.join(target, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (['react', 'react-dom', 'vue', 'next', 'nuxt'].some(p => deps[p])) return true;
    } catch { }
  }
  if (fs.existsSync(srcPath)) {
    try {
      const walk = (dir) => {
        for (const f of fs.readdirSync(dir)) {
          if (/\.(jsx|tsx)$/.test(f)) return true;
          const full = path.join(dir, f);
          if (fs.statSync(full).isDirectory() && f !== 'node_modules') {
            if (walk(full)) return true;
          }
        }
        return false;
      };
      return walk(srcPath);
    } catch { }
  }
  return false;
}

// 自我執行
if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let iteration = 'iter-1';
  let story = null;
  let level = 'M';
  args.forEach(arg => {
    if (arg.startsWith('--target=')) target = arg.split('=')[1];
    if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
    if (arg.startsWith('--story=')) story = arg.split('=')[1];
    if (arg.startsWith('--level=')) level = arg.split('=')[1];
  });
  if (!path.isAbsolute(target)) target = path.resolve(process.cwd(), target);
  run({ target, iteration, story, level });
}

module.exports = { run };
