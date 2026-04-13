#!/usr/bin/env node
/**
 * BUILD Phase 3: Integration Surface Gate (v8.0)
 *
 * 定位：integration/API surface gate
 *   - @INTEGRATION-TEST hard gate（P0/SVC/API/HTTP/HOOK 或 P1+HOOK 無標記 → BLOCKER）
 *   - API surface agreement（backend export ↔ contract 宣告）
 *   - Frontend page route registration（frontend root）
 *   - Barrel export（all roots）
 *   - GEMS-DEPS import agreement（multi-root）
 *   - P0 SVC/API non-mock check
 *
 * 不跑：Phase 2 的 story-scoped unit @TEST（phase-2 負責）
 * multi-root 支援：getSrcDirs(target) → classifyRoots → frontendRoot / backendRoot
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd } = require('../../lib/shared/next-command-helper.cjs');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { writeCheckpoint } = require('../../lib/checkpoint.cjs');
const { detectProjectType, getSrcDirs } = require('../../lib/shared/project-type.cjs');

// UI Bind 驗證器（可選）
let validateUIBind = null;
let formatUIBindResult = null;
try {
  const uiBindMod = require('../../lib/build/ui-bind-validator.cjs');
  validateUIBind = uiBindMod.validateUIBind;
  formatUIBindResult = uiBindMod.formatResult;
} catch { /* 可選 */ }

// @CONTRACT type 需要整合測試的集合
const INTEGRATION_SURFACE_TYPES = new Set(['SVC', 'API', 'HTTP', 'HOOK']);

// ============================================================
// Main
// ============================================================

/** GEMS: buildPhase3 | P1 | classifyRoots(Pure)→checkIntegrationGate(IO)→checkApiSurface(IO)→RETURN:PhaseResult | Story-4.0 */
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

  // ── Multi-root 初始化 ──
  const roots = getSrcDirs(target);
  const { frontendRoot, backendRoot } = classifyRoots(roots);

  console.log(`\n🔗 整合層 | ${story}`);
  if (roots.length > 1) {
    console.log(`   📂 Frontend root: ${path.relative(target, frontendRoot)}`);
    console.log(`   📂 Backend root:  ${path.relative(target, backendRoot)}`);
  }

  // ============================================================
  // 0a. @INTEGRATION-TEST hard gate
  //     P0/SVC/API/HTTP/HOOK 或 P1+HOOK → 無 @INTEGRATION-TEST → BLOCKER
  // ============================================================
  const integResult = checkIntegrationTestGate(target, iteration, story);
  if (integResult.verdict === 'BLOCKER') {
    if (integResult.missingTag) {
      const contractRelPath = `.gems/iterations/${iteration}/contract_iter-${iterNum}.ts`;
      const detailLines = [integResult.summary];
      if (integResult.hint) detailLines.push(`💡 ${integResult.hint}`);
      detailLines.push(`修正方式：在 contract_iter-${iterNum}.ts 相關 @CONTRACT block 加：\n  // @INTEGRATION-TEST: src/__tests__/integration.test.ts`);
      emitBlock({
        scope: `BUILD Phase 3 | ${story}`,
        summary: integResult.summary,
        targetFile: contractRelPath,
        details: detailLines.join('\n'),
        missing: [`${story} @CONTRACT block 缺少 @INTEGRATION-TEST 標記`],
        tasks: [{
          action: 'ADD_INTEGRATION_TEST_TAG',
          file: contractRelPath,
          expected: `在 ${story} 的 P0/SVC/API/HTTP/HOOK @CONTRACT block 補：// @INTEGRATION-TEST: path/to/integration.test.ts`,
        }],
        nextCmd: getRetryCmd('BUILD', '3', { story, target: relativeTarget, iteration })
      }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });
    } else {
      emitFix({
        scope: `BUILD Phase 3 | ${story}`,
        summary: integResult.summary,
        targetFile: integResult.testFile || 'src/',
        missing: [integResult.summary],
        nextCmd: getRetryCmd('BUILD', '3', { story, target: relativeTarget, iteration }),
        tasks: [{ action: 'FIX_INTEGRATION_TEST', file: integResult.testFile, expected: integResult.summary }]
      }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });
    }
    return { verdict: 'BLOCKER', reason: 'integration_test_gate' };
  }
  if (integResult.verdict === 'PASS') {
    console.log(`   ✅ 整合測試: ${integResult.summary}`);
  } else {
    console.log(`   ⏭️  整合測試: ${integResult.summary}`);
  }

  // ============================================================
  // 0b. P0 SVC/API 整合測試非 Mock 驗證（M28-4）
  // ============================================================
  const p0MockIssues = checkP0SvcApiNonMock(target, iteration, story);
  if (p0MockIssues.blockers.length > 0) {
    emitFix({
      scope: `BUILD Phase 3 | ${story}`,
      summary: `P0 SVC/API 整合測試包含本地 mock（${p0MockIssues.blockers.length} 個）`,
      targetFile: p0MockIssues.blockers[0]?.testPath || 'src/',
      missing: p0MockIssues.blockers.map(i => i.message),
      nextCmd: getRetryCmd('BUILD', '3', { story, target: relativeTarget, iteration }),
      tasks: p0MockIssues.blockers.map(issue => ({
        action: 'FIX_INTEGRATION_TEST',
        file: issue.testPath,
        expected: issue.message,
        acSpec: 'P0 SVC/API 整合測試禁止 mock 本地依賴'
      }))
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });
    return { verdict: 'BLOCKER', reason: 'p0_svc_api_local_mock' };
  }
  if (p0MockIssues.checked > 0) {
    console.log(`   ✅ P0 SVC/API 整合測試: ${p0MockIssues.checked} 個已驗（無本地 mock）`);
  }

  // ============================================================
  // 1. 路由整合檢查（frontend root）
  // ============================================================
  const allPages = findNewPages(frontendRoot);
  const unregisteredPages = findUnregisteredPages(target, frontendRoot, allPages);

  if (unregisteredPages.length > 0) {
    emitFix({
      scope: `BUILD Phase 3 | ${story}`,
      summary: `${unregisteredPages.length} 個 Page 未整合到路由`,
      targetFile: `${path.relative(target, frontendRoot)}/routes/ 或 App.tsx`,
      missing: unregisteredPages,
      nextCmd: getRetryCmd('BUILD', '3', { story, target: relativeTarget, iteration }),
      tasks: unregisteredPages.map(p => ({
        action: 'REGISTER_ROUTE',
        file: `${path.relative(target, frontendRoot)}/App.tsx 或 routes/index.ts`,
        expected: `import ${p} 並加入 Route 定義`,
        acSpec: '路由整合是使用者可見功能的前提'
      }))
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });
    return { verdict: 'BLOCKER', reason: 'unregistered_pages' };
  }

  // ============================================================
  // 2. Barrel export 檢查（all roots）
  // ============================================================
  const exportIssues = findExportIssues(roots, target, iteration, story);

  if (exportIssues.critical.length > 0) {
    emitFix({
      scope: `BUILD Phase 3 | ${story}`,
      summary: `${exportIssues.critical.length} 個函式未從 barrel export 匯出`,
      targetFile: 'modules/*/index.ts',
      missing: exportIssues.critical.map(i => i.fnName),
      nextCmd: getRetryCmd('BUILD', '3', { story, target: relativeTarget, iteration }),
      tasks: exportIssues.critical.map(issue => ({
        action: 'ADD_EXPORT',
        file: issue.indexFile,
        expected: `export { ${issue.fnName} } from '${issue.relPath}'`,
        acSpec: '函式未匯出等於對外不可見'
      }))
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });
    return { verdict: 'BLOCKER', reason: 'unexported_functions' };
  }

  // ============================================================
  // 3. UI Bind 驗證（Vanilla JS 專案，frontend root）
  // ============================================================
  let uiBindNote = '';
  if (validateUIBind && !hasReactOrVue(target, frontendRoot)) {
    const htmlPath = path.join(target, 'index.html');
    const uiBindResult = validateUIBind(target, frontendRoot, htmlPath);
    if (!uiBindResult.skipped && !uiBindResult.valid) {
      emitFix({
        scope: `BUILD Phase 3 | ${story}`,
        summary: `UI Bind 不一致 (${uiBindResult.stats.failed} 個問題)`,
        targetFile: 'src/',
        missing: uiBindResult.issues.map(i => i.message),
        nextCmd: getRetryCmd('BUILD', '3', { story, target: relativeTarget, iteration }),
        tasks: uiBindResult.issues.map(i => ({
          action: 'FIX_UI_BIND',
          file: i.binding?.file || 'src/',
          expected: i.message,
          acSpec: `UI Bind: ${i.binding?.selector || ''}`
        }))
      }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });
      return { verdict: 'BLOCKER', reason: 'ui_bind_mismatch' };
    }
    if (!uiBindResult.skipped) {
      uiBindNote = ` | UI Bind: ${uiBindResult.stats.passed}/${uiBindResult.stats.total}`;
    }
  }

  // ============================================================
  // 2b. GEMS-DEPS import 驗證（multi-root，已在函式內用 getSrcDirs）
  // ============================================================
  const depImportResult = checkGemsDepImports(target, iteration, story);
  if (depImportResult.verdict === 'BLOCKER') {
    emitFix({
      scope: `BUILD Phase 3 | ${story}`,
      summary: `GEMS-DEPS 驗證失敗 (${depImportResult.violations.length} 個問題)`,
      targetFile: depImportResult.violations[0]?.file || 'src/',
      missing: depImportResult.violations.map(v => v.message),
      nextCmd: getRetryCmd('BUILD', '3', { story, target: relativeTarget, iteration }),
      tasks: depImportResult.violations.map(v => ({
        action: v.type === 'missing_gems_tag' ? 'UPDATE_GEMS_TAG' : 'FIX_IMPORT',
        file: v.file || 'src/',
        expected: v.message,
        acSpec: 'GEMS-DEPS 宣告的依賴必須出現在 import 中；contract @CONTRACT 必須有對應 GEMS tag'
      }))
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });
    return { verdict: 'BLOCKER', reason: 'gems_dep_import_mismatch' };
  }
  if (depImportResult.verdict === 'PASS') {
    console.log(`   ✅ GEMS-DEPS: ${depImportResult.checked} 個 tag 驗證通過`);
  }

  // ============================================================
  // 4. API Surface Agreement（contract ↔ backend export）[NEW v8]
  // ============================================================
  const apiSurfaceResult = checkApiSurfaceAgreement(target, iteration, story, frontendRoot, backendRoot);
  if (apiSurfaceResult.verdict === 'BLOCKER') {
    const backendRel = path.relative(target, backendRoot || target);
    const apiTasks = apiSurfaceResult.violations.map(v => {
      const cName = v.contractName || v.message.split(' ')[0];
      const stem = cName
        .replace(/(?:Service|Api|Handler|Controller|Repo(?:sitory)?|Manager)$/i, '')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase();
      if (v.type === 'missing_gems_trace') {
        return {
          action: 'ADD_GEMS_TAG_OR_IMPL',
          file: `${backendRel}/${stem}.service.ts`,
          expected: `在 ${cName} 實作檔加 GEMS tag（/** GEMS: fnName | P0 | ${story} | ... */）或 export`,
          acSpec: 'module-style contract 需要 GEMS story trace 或 direct export；若檔名不同，請找同 stem 的 service/api/handler 檔',
        };
      } else if (v.type === 'backend_missing_export') {
        return {
          action: 'EXPORT_FROM_BACKEND',
          file: `${backendRel}/index.ts`,
          expected: `export function/class ${cName}(...) 並確認 barrel index.ts 有轉出`,
          acSpec: 'function-style contract 需要 direct export；也可從相關 barrel 轉出',
        };
      } else if (v.type === 'ambiguous_surface_match') {
        return {
          action: 'FILL_CALLABLE_SURFACE',
          file: v.ambiguousFile ? `${backendRel}/${v.ambiguousFile}` : `${backendRel}/`,
          expected: `在 ${v.ambiguousFile || cName} 補齊 export 或 GEMS tag（不能只是 placeholder）`,
          acSpec: 'file_match evidence 需要檔案有 callable surface',
        };
      } else if (v.type === 'gas_run_missing_backend') {
        return {
          action: 'ADD_GAS_BACKEND_EXPORT',
          file: `${backendRel}/`,
          expected: `新增 function ${v.runName || cName}() 並確保 GAS 可呼叫`,
          acSpec: 'GAS google.script.run.X 必須有對應 backend export',
        };
      } else {
        return {
          action: 'FIX_API_SURFACE',
          file: `${backendRel}/`,
          expected: v.message,
          acSpec: 'contract 宣告的 API/SVC/HTTP/HOOK 必須在 backend 有對應 surface evidence',
        };
      }
    });
    const firstViolation = apiSurfaceResult.violations[0];
    const firstTargetFile = firstViolation?.type === 'ambiguous_surface_match' && firstViolation.ambiguousFile
      ? `${backendRel}/${firstViolation.ambiguousFile}`
      : backendRel;
    emitFix({
      scope: `BUILD Phase 3 | ${story}`,
      summary: `API Surface Agreement 失敗（${apiSurfaceResult.violations.length} 個問題）`,
      targetFile: firstTargetFile,
      missing: apiSurfaceResult.violations.map(v => v.message),
      nextCmd: getRetryCmd('BUILD', '3', { story, target: relativeTarget, iteration }),
      tasks: apiTasks
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });
    return { verdict: 'BLOCKER', reason: 'api_surface_mismatch' };
  }
  if (apiSurfaceResult.verdict === 'PASS') {
    console.log(`   ✅ API Surface: ${apiSurfaceResult.checked} 個 contract 對齊`);
  }

  // ============================================================
  // 全部通過
  // ============================================================
  writeCheckpoint(target, iteration, story, '3', {
    verdict: 'PASS',
    pages: allPages.length,
    exportIssues: exportIssues.warnings.length,
    uiBind: uiBindNote ? 'checked' : 'skipped',
    apiSurface: apiSurfaceResult.checked,
  });

  const summary = [
    `路由: ${allPages.length > 0 ? `${allPages.length} 頁面已整合` : '無頁面'}`,
    `匯出: ${exportIssues.warnings.length > 0 ? `${exportIssues.warnings.length} 警告` : 'OK'}`,
    apiSurfaceResult.verdict === 'PASS' ? `API Surface: ${apiSurfaceResult.checked} 對齊` : null,
    uiBindNote || null,
  ].filter(Boolean).join(' | ');

  emitPass({
    scope: `BUILD Phase 3 | ${story}`,
    summary,
    nextCmd: getNextCmd('BUILD', '3', { story, level, target: relativeTarget, iteration })
  }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story });

  return { verdict: 'PASS' };
}

// ============================================================
// Multi-root helpers
// ============================================================

/**
 * 從 getSrcDirs 結果識別 frontend / backend root
 * 辨識規則（路徑片段比對）：
 *   - 含 gas / backend / server / api → backendRoot
 *   - 含 frontend / client / ui / web → frontendRoot
 *   - 單一 root → 兩者共用
 */
function classifyRoots(roots) {
  const BACKEND_SIGNALS = /(?:gas|backend|server|api)/i;
  const FRONTEND_SIGNALS = /(?:frontend|client|ui|web)/i;

  let frontendRoot = null;
  let backendRoot = null;

  for (const root of roots) {
    const segments = root.replace(/\\/g, '/');
    if (!backendRoot && BACKEND_SIGNALS.test(segments)) backendRoot = root;
    else if (!frontendRoot && FRONTEND_SIGNALS.test(segments)) frontendRoot = root;
  }

  const fallback = roots[0] || null;
  if (!frontendRoot && !backendRoot) { frontendRoot = backendRoot = fallback; }
  else if (frontendRoot && !backendRoot) { backendRoot = roots.find(r => r !== frontendRoot) || frontendRoot; }
  else if (!frontendRoot && backendRoot) { frontendRoot = roots.find(r => r !== backendRoot) || backendRoot; }

  return { frontendRoot, backendRoot };
}

// ============================================================
// @INTEGRATION-TEST hard gate（替換 runDepsRiskIntegrationTests）
// ============================================================

/**
 * @INTEGRATION-TEST hard gate
 *
 * 規則：
 *   - 本 story 有 P0+SURFACE(SVC/API/HTTP/HOOK) 或 P1+HOOK → needsIntegration
 *   - needsIntegration && 無 @INTEGRATION-TEST → BLOCKER（不接受 __tests__ fallback）
 *   - needsIntegration && 有 @INTEGRATION-TEST → run vitest → PASS 或 BLOCKER
 *   - !needsIntegration → SKIP
 *
 * @returns {{ verdict, summary, missingTag?, hint?, testFile? }}
 */
function checkIntegrationTestGate(target, iteration, story) {
  const iterNum = iteration.replace('iter-', '');
  const contractPath = path.join(target, `.gems/iterations/${iteration}/contract_iter-${iterNum}.ts`);
  if (!fs.existsSync(contractPath)) return { verdict: 'SKIP', summary: 'contract 不存在，跳過整合測試 gate' };

  let content;
  try { content = fs.readFileSync(contractPath, 'utf8'); } catch {
    return { verdict: 'SKIP', summary: 'contract 讀取失敗' };
  }

  // 判斷本 story 是否需要整合測試
  const needsIntegration = storyNeedsIntegration(content, story);

  // 找 @INTEGRATION-TEST 標記（story-scoped @CONTRACT block 內，或全域）
  const taggedPaths = extractIntegrationTestTags(content, story);
  const existingTagged = taggedPaths
    .map(f => path.isAbsolute(f) ? f : path.join(target, f))
    .filter(f => fs.existsSync(f));

  if (existingTagged.length === 0) {
    if (!needsIntegration) return { verdict: 'SKIP', summary: '本 story 無需整合測試' };
    // BLOCKER：不用 src/__tests__/ 作為 coverage 替代
    const hint = discoverIntegrationTestHint(target);
    return {
      verdict: 'BLOCKER',
      summary: `${story} 有 P0/SVC/API/HTTP/HOOK 或 P1+HOOK 型 @CONTRACT，缺少明確 @INTEGRATION-TEST 標記`,
      missingTag: true,
      hint,
    };
  }

  // 有標記的測試檔 → 跑 vitest
  const vitestCwd = resolveVitestCwd(target);
  if (!vitestCwd) return { verdict: 'SKIP', summary: 'vitest 未安裝，跳過整合測試' };

  const relPaths = existingTagged.map(f => path.relative(vitestCwd, f)).join(' ');
  console.log(`   🧪 整合測試 (@INTEGRATION-TEST): ${existingTagged.length} 個測試檔`);
  try {
    execSync(`npx vitest run ${relPaths}`, { cwd: vitestCwd, stdio: 'pipe', timeout: 60000 });
    return { verdict: 'PASS', summary: `${existingTagged.length} 個整合測試全部通過`, testFile: relPaths };
  } catch (e) {
    const output = (e.stdout || '').toString() + (e.stderr || '').toString();
    const failMatch = output.match(/Tests\s+(\d+)\s+failed/);
    return {
      verdict: 'BLOCKER',
      summary: `整合測試失敗（${failMatch?.[1] || '?'} 個）— 修實作讓測試通過`,
      testFile: relPaths,
      output: output.slice(-500),
    };
  }
}

/**
 * 判斷本 story 是否需要整合測試
 * 規則：P0 + SURFACE type，或 P1 + HOOK
 *
 * 注意：使用 m[0] 第一行解析 header（m[1] 在 gs/dotAll 模式下會跨行捕獲後續 @TEST/@INTEGRATION-TEST 行）
 */
function storyNeedsIntegration(contractContent, story) {
  const blockRegex = /\/\/\s*@CONTRACT:\s*(.+?)(?=\n\/\/\s*@CONTRACT:|\nexport\s+(?:interface|declare|type|class|function)|$)/gs;
  for (const m of contractContent.matchAll(blockRegex)) {
    // 只取第一行作為 header（避免 dotAll 捕獲多行內容）
    const headerLine = m[0].split('\n')[0].replace(/\/\/\s*@CONTRACT:\s*/, '');
    const parts = headerLine.trim().split('|').map(s => s.trim());
    const priority = parts[1];
    const type = (parts[2] || '').toUpperCase();
    const storyId = parts[3];
    if (storyId && storyId !== story) continue;
    if (priority === 'P0' && INTEGRATION_SURFACE_TYPES.has(type)) return true;
    if (priority === 'P1' && type === 'HOOK') return true;
  }
  return false;
}

/**
 * 從 contract 提取 @INTEGRATION-TEST 標記的路徑
 * 支援：story-scoped @CONTRACT block 內，或全域出現
 */
function extractIntegrationTestTags(contractContent, story) {
  const paths = [];
  // story-scoped：block 屬於本 story
  const blockRegex = /\/\/\s*@CONTRACT:\s*(.+?)(?=\n\/\/\s*@CONTRACT:|\nexport\s+(?:interface|declare|type|class|function)|$)/gs;
  for (const m of contractContent.matchAll(blockRegex)) {
    const headerLine = m[0].split('\n')[0].replace(/\/\/\s*@CONTRACT:\s*/, '');
    const storyId = headerLine.trim().split('|')[3]?.trim();
    if (storyId && storyId !== story) continue;
    for (const tm of [...m[0].matchAll(/\/\/\s*@INTEGRATION-TEST:\s*(.+\.(?:test|spec)\.tsx?)/g)]) {
      const p = tm[1].trim();
      if (!paths.includes(p)) paths.push(p);
    }
  }
  // 全域（不在任何 block 內）
  if (paths.length === 0) {
    for (const m of contractContent.matchAll(/\/\/\s*@INTEGRATION-TEST:\s*(.+\.(?:test|spec)\.tsx?)/g)) {
      const p = m[1].trim();
      if (!paths.includes(p)) paths.push(p);
    }
  }
  return paths;
}

/**
 * Discovery hint：掃 __tests__/ 提示可能存在的測試（只作 hint，不影響 gate verdict）
 */
function discoverIntegrationTestHint(target) {
  const testDirs = [
    path.join(target, 'src', '__tests__'),
    path.join(target, '__tests__'),
  ];
  const found = [];
  for (const dir of testDirs) {
    if (!fs.existsSync(dir)) continue;
    fs.readdirSync(dir)
      .filter(f => /\.test\.(ts|tsx|js)$/.test(f))
      .forEach(f => found.push(path.relative(target, path.join(dir, f))));
  }
  return found.length > 0
    ? `找到潛在整合測試（需加 @INTEGRATION-TEST 標記才會被納入）: ${found.join(', ')}`
    : null;
}

/**
 * 解析 vitest 的執行目錄（優先找含 vitest 的 package.json）
 */
function resolveVitestCwd(target) {
  const candidates = [path.join(target, 'frontend'), target];
  for (const cwd of candidates) {
    const pkgPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.devDependencies?.vitest || pkg.dependencies?.vitest) return cwd;
    } catch { /* skip */ }
  }
  return null;
}

// ============================================================
// API Surface Agreement [NEW v8]
// ============================================================

/**
 * 確認 contract 宣告的 SVC/API/HTTP/HOOK 在 backend 有對應 surface evidence。
 * GAS 模式下額外確認 frontend google.script.run.X → backend 有對應 export。
 *
 * v8.1：multi-evidence matching（不要求 contract 名稱與 export 名稱完全一致）
 *   Evidence 1 – direct: backendExports 有 name / implName（exact / case-insensitive）
 *   Evidence 2 – gems_trace: module-style 名稱 + backend 有相關 stem 的 GEMS tag（同 story）
 *     e.g., CategoryService → stem=category → GEMS "createCategory" 含 "category" → 有實作證據
 *   Evidence 3 – file_match (weak): category.service.ts / category.api.ts 存在於 backend
 *     且檔案內有 callable surface（export / GEMS tag / top-level function）
 *     若只是 placeholder → ambiguous_surface_match BLOCKER
 *
 * 只有完全找不到任何 evidence 時才 BLOCKER（missing_gems_trace / backend_missing_export）。
 * Evidence 3 ambiguous（有檔名無 callable surface）→ ambiguous_surface_match BLOCKER。
 *
 * 覆蓋範圍：TS/JS export + GAS google.script.run。
 * TODO（Phase 3 v9）REST route path matching（fetch('/api/...') ↔ express router）
 *   false positive 率高、需要 AST 或 route table，本版只記 warning，不做 BLOCKER。
 */
function checkApiSurfaceAgreement(target, iteration, story, frontendRoot, backendRoot) {
  const iterNum = iteration.replace('iter-', '');
  const contractPath = path.join(target, `.gems/iterations/${iteration}/contract_iter-${iterNum}.ts`);
  if (!fs.existsSync(contractPath)) return { verdict: 'SKIP', violations: [], checked: 0 };

  let content;
  try { content = fs.readFileSync(contractPath, 'utf8'); } catch {
    return { verdict: 'SKIP', violations: [], checked: 0 };
  }

  // 提取本 story 的 SVC/API/HTTP/HOOK @CONTRACT
  const surfaceContracts = [];
  const blockRegex = /\/\/\s*@CONTRACT:\s*(.+?)(?=\n\/\/\s*@CONTRACT:|\nexport\s+(?:interface|declare|type|class|function)|$)/gs;
  for (const m of content.matchAll(blockRegex)) {
    const headerLine = m[0].split('\n')[0].replace(/\/\/\s*@CONTRACT:\s*/, '');
    const parts = headerLine.trim().split('|').map(s => s.trim());
    const name = parts[0];
    const priority = parts[1];
    const type = (parts[2] || '').toUpperCase();
    const storyId = parts[3];
    if (storyId !== story) continue;
    if (!INTEGRATION_SURFACE_TYPES.has(type)) continue;
    surfaceContracts.push({ name, priority, type });
  }
  if (surfaceContracts.length === 0) return { verdict: 'SKIP', violations: [], checked: 0 };

  const effectiveBackend = backendRoot || frontendRoot;
  const backendExports = collectBackendExports(effectiveBackend);
  const backendGems   = collectBackendGems(effectiveBackend, story);
  const backendFiles  = collectAllBackendFiles(effectiveBackend);
  const isGas = isGasProject(target);
  const isSeparateRoots = frontendRoot && backendRoot && frontendRoot !== backendRoot;
  const frontendCalls = isSeparateRoots
    ? collectFrontendCalls(frontendRoot)
    : { gasRuns: new Set(), importedNames: new Set() };

  const violations = [];

  for (const contract of surfaceContracts) {
    const surface = resolveBackendSurface(contract.name, backendExports, backendGems, backendFiles);

    if (!surface.found) {
      if (surface.ambiguous) {
        // 檔名符合但無 callable surface — placeholder 未補齊
        violations.push({
          type: 'ambiguous_surface_match',
          contractName: contract.name,
          ambiguousFile: surface.ambiguousFile,
          message: `${contract.name} (${contract.priority}/${contract.type}): 找到 ${surface.ambiguousFile} 但無 callable surface（export / GEMS tag / top-level function）— 可能是 placeholder，請補齊實作`,
        });
      } else {
        // 完全無 evidence：module-style 期望 GEMS trace；function-style 期望 direct export
        violations.push({
          type: isModuleStyleName(contract.name) ? 'missing_gems_trace' : 'backend_missing_export',
          contractName: contract.name,
          message: `${contract.name} (${contract.priority}/${contract.type}): backend 找不到對應 surface evidence（direct export / GEMS story trace / 相關檔案）— 實作未建立`,
        });
      }
    }

    // GAS: frontend google.script.run.X → backend 必須有對應 export
    if (isGas && isSeparateRoots) {
      const name = contract.name;
      const implName = /^I[A-Z]/.test(name) ? name.slice(1) : name;
      for (const runName of frontendCalls.gasRuns) {
        if (
          (runName.toLowerCase().includes(name.toLowerCase()) ||
            runName.toLowerCase().includes(implName.toLowerCase())) &&
          !backendExports.has(runName)
        ) {
          if (!violations.some(v => v.message.includes(`google.script.run.${runName}`))) {
            violations.push({
              type: 'gas_run_missing_backend',
              contractName: name,
              runName,
              message: `frontend google.script.run.${runName} 呼叫找不到對應 backend export（${name} ${contract.priority}/${contract.type}）`,
            });
          }
        }
      }
    }
  }

  return {
    verdict: violations.length > 0 ? 'BLOCKER' : 'PASS',
    violations,
    checked: surfaceContracts.length,
  };
}

// ─── API Surface helpers ─────────────────────────────────────

/**
 * 判斷 contract 名稱是否為 service/module 命名風格
 * e.g., CategoryService, ICategoryService, UserApi, UserHandler
 */
function isModuleStyleName(name) {
  return /(?:Service|Api|Handler|Controller|Repository|Repo|Manager)$/i.test(name) ||
    /^I[A-Z]/.test(name); // TypeScript interface convention
}

/**
 * Multi-evidence backend surface resolution
 *
 * Evidence 1 (direct): backendExports 含 name/implName
 * Evidence 2 (gems_trace): module-style → 相關 GEMS tag for same story 存在
 *   stem 比對：CategoryService → stem=category → "createCategory" 包含 "category"
 * Evidence 3 (file_match, weak): module-style → category.service.ts 等檔案存在
 *   但必須驗證檔案內有 callable surface（export / GEMS tag / top-level function）
 *   若只是 placeholder / 空檔 → ambiguous_surface_match，NOT 視為 PASS
 *
 * @returns {{ found: boolean, evidences: string[], matchType: string, ambiguous: boolean, ambiguousFile: string|null }}
 */
function resolveBackendSurface(contractName, backendExports, backendGems, backendFiles) {
  const name = contractName;
  const implName = /^I[A-Z]/.test(name) ? name.slice(1) : name;
  const lowerName = name.toLowerCase();
  const lowerImplName = implName.toLowerCase();
  const evidences = [];
  let ambiguous = false;
  let ambiguousFile = null;

  // Evidence 1: Direct export
  if (backendExports.has(name) || backendExports.has(implName) ||
      [...backendExports].some(e => e.toLowerCase() === lowerName || e.toLowerCase() === lowerImplName)) {
    evidences.push(`direct_export:${name}`);
  }

  // Evidence 2: GEMS story trace（module-style only）
  if (evidences.length === 0 && isModuleStyleName(name)) {
    const stem = implName
      .replace(/(?:Service|Api|Handler|Controller|Repository|Repo|Manager)$/i, '')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/-/g, ''); // normalize: user-category → usercategory
    const relatedGems = backendGems.filter(g => {
      const gn = g.name.toLowerCase().replace(/[-_]/g, '');
      // GEMS tag 名稱包含 stem，或去掉 CRUD 動詞後與 stem 相關
      const gnStem = gn.replace(/^(create|update|delete|get|find|list|add|remove|fetch|set)/i, '');
      return gn.includes(stem) || gnStem.includes(stem) || stem.includes(gnStem);
    });
    if (relatedGems.length > 0) {
      evidences.push(`gems_story_trace:${relatedGems.slice(0, 3).map(g => g.name).join(',')}`);
    }
  }

  // Evidence 3: File name heuristic（module-style only）— weak evidence
  // 必須驗證檔案內有 callable surface；placeholder / 空檔不算
  if (evidences.length === 0 && isModuleStyleName(name)) {
    const stem = implName
      .replace(/(?:Service|Api|Handler|Controller|Repository|Repo|Manager)$/i, '')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();
    const filePatterns = new Set([
      `${stem}.service.ts`, `${stem}.service.js`,
      `${stem}.api.ts`,     `${stem}.api.js`,
      `${stem}.handler.ts`, `${stem}-service.ts`,
      `${stem}-api.ts`,     `${stem}.ts`,
    ]);
    const matched = backendFiles.find(f => filePatterns.has(path.basename(f).toLowerCase()));
    if (matched) {
      // 驗證檔案內有 callable surface（export / GEMS tag / GAS top-level function）
      let hasCallableSurface = false;
      try {
        if (fs.existsSync(matched)) {
          const fc = fs.readFileSync(matched, 'utf8');
          hasCallableSurface =
            /\bexport\s+/.test(fc) ||         // ES module export
            /\bmodule\.exports\b/.test(fc) ||  // CJS export
            /^function\s+\w+/m.test(fc) ||    // GAS top-level function
            /GEMS:/.test(fc);                  // GEMS tag（任何 story）
        }
      } catch { /* skip */ }
      if (hasCallableSurface) {
        evidences.push(`file_match:${path.basename(matched)}`);
      } else {
        // 檔名符合但無 callable surface — placeholder，標記為 ambiguous
        ambiguous = true;
        ambiguousFile = path.basename(matched);
      }
    }
  }

  const matchType = evidences.length === 0 ? 'none'
    : evidences[0].startsWith('direct_export')    ? 'direct'
    : evidences[0].startsWith('gems_story_trace') ? 'gems_trace'
    : 'heuristic';

  return { found: evidences.length > 0, evidences, matchType, ambiguous, ambiguousFile };
}

/**
 * 收集 backend root 中屬於 story 的 GEMS tag
 * 支援 block GEMS tag 和 line GEMS tag 格式
 */
function collectBackendGems(root, story) {
  const gems = [];
  if (!root || !fs.existsSync(root)) return gems;
  const SKIP_DIRS = new Set(['node_modules', '.git', '__tests__', 'dist', 'build', 'coverage']);

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else if (/\.(ts|tsx|js)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        try {
          const c = fs.readFileSync(full, 'utf8');
          for (const m of c.matchAll(/GEMS:\s*([^\s|*]+)\s*\|[^|*\n]*\|\s*(Story-[\d.]+)/g)) {
            if (m[2].trim() === story) gems.push({ name: m[1].trim(), file: full });
          }
        } catch { /* skip */ }
      }
    }
  }
  walk(root);
  return gems;
}

/**
 * 收集 backend root 所有非測試原始檔路徑（供 file name heuristic）
 */
function collectAllBackendFiles(root) {
  const files = [];
  if (!root || !fs.existsSync(root)) return files;
  const SKIP_DIRS = new Set(['node_modules', '.git', '__tests__', 'dist', 'build', 'coverage']);
  const SKIP_EXT  = /\.(d\.ts|test\.ts|spec\.ts|test\.tsx|spec\.tsx)$/;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else if (/\.(ts|tsx|js|gs)$/.test(entry.name) && !SKIP_EXT.test(entry.name)) {
        files.push(full);
      }
    }
  }
  walk(root);
  return files;
}

/**
 * 收集 backend root 所有已匯出的函式/類別名稱（heuristic）
 * 支援：ES module export, CJS module.exports, GAS top-level function
 */
function collectBackendExports(root) {
  const exports = new Set();
  if (!root || !fs.existsSync(root)) return exports;

  const SKIP_DIRS = new Set(['node_modules', '.git', '__tests__', 'dist', 'build', 'coverage']);
  const SKIP_EXT = /\.(d\.ts|test\.ts|spec\.ts|test\.tsx|spec\.tsx)$/;

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
      } else if (/\.(ts|tsx|js|gs)$/.test(entry.name) && !SKIP_EXT.test(entry.name)) {
        try {
          const c = fs.readFileSync(path.join(dir, entry.name), 'utf8');
          // ES module
          for (const m of c.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)) exports.add(m[1]);
          for (const m of c.matchAll(/^export\s+(?:default\s+)?class\s+(\w+)/gm)) exports.add(m[1]);
          for (const m of c.matchAll(/^export\s+const\s+(\w+)/gm)) exports.add(m[1]);
          for (const m of c.matchAll(/^export\s*\{([^}]+)\}/gm)) {
            m[1].split(',').forEach(s => {
              const n = s.trim().split(/\s+as\s+/)[0].trim();
              if (n) exports.add(n);
            });
          }
          // CJS
          for (const m of c.matchAll(/(?:module\.exports|exports)\.(\w+)\s*=/gm)) exports.add(m[1]);
          // GAS top-level function（全域匯出）
          for (const m of c.matchAll(/^function\s+(\w+)\s*\(/gm)) exports.add(m[1]);
        } catch { /* skip */ }
      }
    }
  }

  walk(root);
  return exports;
}

/**
 * 收集 frontend root 的 API 呼叫點（heuristic）
 * @returns {{ gasRuns: Set<string>, importedNames: Set<string> }}
 */
function collectFrontendCalls(root) {
  const gasRuns = new Set();
  const importedNames = new Set();
  if (!root || !fs.existsSync(root)) return { gasRuns, importedNames };

  const SKIP_DIRS = new Set(['node_modules', '.git', '__tests__', 'dist', 'build', 'coverage']);
  const SKIP_EXT = /\.(d\.ts|test\.ts|spec\.ts|test\.tsx|spec\.tsx)$/;

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !SKIP_EXT.test(entry.name)) {
        try {
          const c = fs.readFileSync(path.join(dir, entry.name), 'utf8');
          // GAS: google.script.run.functionName
          for (const m of c.matchAll(/google\.script\.run\.(\w+)\s*\(/g)) gasRuns.add(m[1]);
          // Named imports
          for (const m of c.matchAll(/import\s+\{([^}]+)\}\s+from/g)) {
            m[1].split(',').forEach(s => {
              const n = s.trim().split(/\s+as\s+/)[0].trim();
              if (n) importedNames.add(n);
            });
          }
          // Default imports
          for (const m of c.matchAll(/import\s+(\w+)\s+from/g)) importedNames.add(m[1]);
        } catch { /* skip */ }
      }
    }
  }

  walk(root);
  return { gasRuns, importedNames };
}

/**
 * 判斷是否為 GAS 專案（appsscript.json 或 .clasp.json）
 */
function isGasProject(target) {
  return fs.existsSync(path.join(target, 'appsscript.json')) ||
    fs.existsSync(path.join(target, '.clasp.json'));
}

// ============================================================
// P0 SVC/API Non-Mock（unchanged）
// ============================================================

/**
 * M28-4: P0 SVC/API 整合測試非 Mock 驗證
 * 從 contract 找 P0 SVC/API @TEST 路徑，確認不 mock 本地依賴
 */
function checkP0SvcApiNonMock(target, iteration, story) {
  const result = { checked: 0, blockers: [] };
  const iterNum = iteration.replace('iter-', '');
  const contractPath = path.join(target, `.gems/iterations/${iteration}/contract_iter-${iterNum}.ts`);
  if (!fs.existsSync(contractPath)) return result;

  let content;
  try { content = fs.readFileSync(contractPath, 'utf8'); } catch { return result; }

  if (!/\/\/\s*@CONTRACT:\s*\w+/.test(content)) return result; // v3 skip

  const blockRegex = /\/\/\s*@CONTRACT:\s*(.+?)(?=\n\/\/\s*@CONTRACT:|\nexport\s+(?:interface|declare|type|class|function)|$)/gs;
  for (const m of content.matchAll(blockRegex)) {
    const block = m[0];
    const headerLine = block.split('\n')[0].replace(/\/\/\s*@CONTRACT:\s*/, '');
    const parts = headerLine.trim().split('|').map(s => s.trim());
    const priority = parts[1];
    const type = parts[2];
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

    const localMockPattern = /(?:vi|jest)\.mock\s*\(\s*['"](?:\.{1,2}\/|src\/)[^'"]+['"]/g;
    const localMocks = [...testContent.matchAll(localMockPattern)].map(m2 => m2[0].slice(0, 60));
    if (localMocks.length > 0) {
      result.blockers.push({
        testPath,
        message: `${parts[0]} (P0 ${type}): ${testPath} 包含本地 mock — ${localMocks[0]}...`
      });
    }
  }
  return result;
}

// ============================================================
// Route / Page（frontend root）
// ============================================================

/**
 * 掃 frontendRoot 找 Page 組件
 */
function findNewPages(frontendRoot) {
  const pages = [];
  if (!frontendRoot) return pages;

  const dirs = [
    { dir: path.join(frontendRoot, 'pages'), prefix: '' },
    { dir: path.join(frontendRoot, 'shared', 'pages'), prefix: 'shared/pages/' },
  ];
  const modulesDir = path.join(frontendRoot, 'modules');
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

/**
 * 找未被路由整合的 Page 組件（frontend root）
 */
function findUnregisteredPages(target, frontendRoot, pages) {
  if (!frontendRoot || pages.length === 0) return [];

  const routeFiles = [
    path.join(frontendRoot, 'App.tsx'), path.join(frontendRoot, 'App.jsx'),
    path.join(frontendRoot, 'routes', 'index.tsx'), path.join(frontendRoot, 'routes', 'index.ts'),
    path.join(frontendRoot, 'routes', 'routes.config.ts'),
    path.join(frontendRoot, 'shared', 'pages', 'app-router.tsx'),
    path.join(frontendRoot, 'main.tsx'), path.join(frontendRoot, 'index.tsx'),
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

// ============================================================
// Barrel export（multi-root）
// ============================================================

/**
 * Barrel export 問題檢查（掃所有 roots）
 * @param {string[]} roots - getSrcDirs 的結果
 */
function findExportIssues(roots, target, iteration, story) {
  const critical = [];
  const warnings = [];
  const seenFn = new Set();

  for (const srcPath of (Array.isArray(roots) ? roots : [roots])) {
    const modulesDir = path.join(srcPath, 'modules');
    if (fs.existsSync(modulesDir)) {
      for (const mod of fs.readdirSync(modulesDir, { withFileTypes: true })) {
        if (!mod.isDirectory()) continue;
        const indexPath = path.join(modulesDir, mod.name, 'index.ts');
        if (!fs.existsSync(indexPath)) {
          warnings.push({ type: 'missing_index', module: mod.name });
        }
      }
    }

    // Story 函式 barrel export 深度驗證
    if (story && iteration) {
      const planPath = path.join(target, `.gems/iterations/${iteration}/plan/implementation_plan_${story}.md`);
      if (fs.existsSync(planPath)) {
        try {
          const { scanGemsTags } = require('../../lib/scan/gems-scanner-unified.cjs');
          const scanResult = scanGemsTags(srcPath);
          const storyFunctions = scanResult.functions.filter(f => f.storyId === story);
          for (const fn of storyFunctions) {
            if (!fn.file || seenFn.has(fn.name)) continue;
            const relToSrc = path.relative(srcPath, path.resolve(fn.file)).split(path.sep).join('/');
            const moduleMatch = relToSrc.match(/^modules\/([^/]+)\//);
            if (!moduleMatch) continue;
            const indexPath = path.join(modulesDir || path.join(srcPath, 'modules'), moduleMatch[1], 'index.ts');
            if (!fs.existsSync(indexPath)) continue;
            const indexContent = fs.readFileSync(indexPath, 'utf8');
            const hasExport = new RegExp(`export\\s*\\{[^}]*\\b${fn.name}\\b[^}]*\\}`).test(indexContent)
              || /export\s*\*\s*from/.test(indexContent);
            if (!hasExport) {
              critical.push({ fnName: fn.name, indexFile: path.relative(target, indexPath), relPath: relToSrc });
              seenFn.add(fn.name);
            }
          }
        } catch { /* 掃描失敗不阻擋 */ }
      }
    }
  }

  return { critical, warnings };
}

// ============================================================
// GEMS-DEPS import 驗證（multi-root，srcPath 參數移除）
// ============================================================

/**
 * GEMS-DEPS import 驗證
 * Check A：contract @CONTRACT → src 必須有對應 GEMS tag
 * Check B：GEMS deps:[X] → import 必須出現
 * 掃描路徑：getSrcDirs(target)（不接受 srcPath 參數，已 multi-root 化）
 */
function checkGemsDepImports(target, iteration, story) {
  const GAS_GLOBALS = new Set([
    'CacheService', 'SpreadsheetApp', 'DriveApp', 'PropertiesService',
    'UrlFetchApp', 'HtmlService', 'ContentService', 'MailApp',
    'LockService', 'Utilities', 'Session', 'ScriptApp', 'Logger',
  ]);

  const iterNum = iteration.replace('iter-', '');
  const contractPath = path.join(target, `.gems/iterations/${iteration}/contract_iter-${iterNum}.ts`);
  if (!fs.existsSync(contractPath)) return { verdict: 'SKIP', violations: [], checked: 0 };

  let contractContent;
  try { contractContent = fs.readFileSync(contractPath, 'utf8'); } catch {
    return { verdict: 'SKIP', violations: [], checked: 0 };
  }

  const contractNames = [];
  const contractEntryRe = /\/\/\s*@CONTRACT:\s*(\w+)[^|]*\|[^|]*\|[^|]*\|\s*(Story-[\d.]+)/g;
  for (const m of contractContent.matchAll(contractEntryRe)) {
    if (m[2].trim() === story) contractNames.push(m[1].trim());
  }
  if (contractNames.length === 0) return { verdict: 'SKIP', violations: [], checked: 0 };

  const gemsForStory = [];

  function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', '__tests__'].includes(entry.name)) walkDir(full);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        parseGems(full);
      }
    }
  }

  function parseGems(filePath) {
    let content;
    try { content = fs.readFileSync(filePath, 'utf8'); } catch { return; }
    const re = /\/\*\*\s*GEMS:\s*([^\s|*]+)\s*\|[^|*\n]*\|[^|*\n]*\|\s*(Story-[\d.]+)\s*\|[^*]*?deps:\[([^\]]*)\]\s*\*\//g;
    for (const m of content.matchAll(re)) {
      if (m[2].trim() !== story) continue;
      const deps = m[3].split(',').map(d => d.trim()).filter(Boolean);
      const importLines = content.split('\n').filter(l => /^import\s/.test(l.trim()));
      const localSymbols = new Set();
      for (const fn of content.matchAll(/^(?:export\s+)?function\s+(\w+)\s*\(/gm)) localSymbols.add(fn[1]);
      for (const fn of content.matchAll(/^(?:export\s+)?const\s+(\w+)\s*=/gm)) localSymbols.add(fn[1]);
      for (const fn of content.matchAll(/^(?:export\s+)?class\s+(\w+)/gm)) localSymbols.add(fn[1]);
      gemsForStory.push({ file: filePath, name: m[1].trim(), deps, importLines, localSymbols });
    }
  }

  for (const root of getSrcDirs(target)) walkDir(root);

  const violations = [];

  // Check A：每個 @CONTRACT → 必須有 GEMS tag
  for (const contractName of contractNames) {
    const cn = contractName.toLowerCase();
    const found = gemsForStory.some(t => {
      const gn = t.name.toLowerCase();
      const normalize = s => s.replace(/(fromstore|context|provider|manager|service|hook)$/i, '');
      return normalize(cn) === normalize(gn) || cn.includes(gn) || gn.includes(cn);
    });
    if (!found) {
      violations.push({
        type: 'missing_gems_tag',
        file: 'src/',
        message: `@CONTRACT: ${contractName} (${story}) — src 找不到對應 GEMS tag，實作未更新或缺少 GEMS 標籤`,
      });
    }
  }

  // Check B：GEMS deps:[X] → 必須出現在 import
  for (const tag of gemsForStory) {
    for (const dep of tag.deps) {
      if (!dep || GAS_GLOBALS.has(dep)) continue;
      if (!tag.localSymbols.has(dep) && !tag.importLines.some(l => l.includes(dep))) {
        violations.push({
          type: 'missing_import',
          file: path.relative(target, tag.file),
          message: `${tag.name}: GEMS deps:[${dep}] 宣告但 import 中找不到 — 實作可能仍直接呼叫舊 API`,
        });
      }
    }
  }

  return {
    verdict: violations.length > 0 ? 'BLOCKER' : 'PASS',
    violations,
    checked: gemsForStory.length,
  };
}

// ============================================================
// Helpers
// ============================================================

function hasReactOrVue(target, srcPath) {
  const pkgPath = path.join(target, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (['react', 'react-dom', 'vue', 'next', 'nuxt'].some(p => deps[p])) return true;
    } catch { }
  }
  if (srcPath && fs.existsSync(srcPath)) {
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

// ============================================================
// CLI
// ============================================================

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

module.exports = {
  run,
  classifyRoots,
  checkIntegrationTestGate,
  storyNeedsIntegration,
  extractIntegrationTestTags,
  checkApiSurfaceAgreement,
  collectBackendExports,
  collectBackendGems,
  collectAllBackendFiles,
  collectFrontendCalls,
  resolveBackendSurface,
  isModuleStyleName,
};
