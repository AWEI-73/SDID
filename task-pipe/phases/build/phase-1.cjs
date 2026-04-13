#!/usr/bin/env node
/**
 * BUILD Phase 1: 開發腳本 (v3.0 - 標籤規格注入)
 * 輸入: implementation_plan | 產物: 功能程式碼骨架 + checkpoint
 * 
 * v2.0 新增：
 * - 從 POC 讀取前端規格標籤 (@GEMS-UI-BIND, @GEMS-CSS-LOCK 等)
 * - 注入到 AI prompt 中強化前端約束傳遞
 * 
 * v3.0 新增：
 * - 從 Plan 提取具體的 GEMS 標籤規格
 * - 直接在輸出中顯示每個函式需要的完整標籤
 * - AI 可以直接複製貼上，減少猜測
 */
const fs = require('fs');
const path = require('path');
const { writeCheckpoint } = require('../../lib/checkpoint.cjs');
const { detectProjectType, getGreenfieldGuide, getSrcDir, getSrcDirs } = require('../../lib/shared/project-type.cjs');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { createErrorHandler, handlePhaseSuccess, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorOutput, anchorPass, anchorError, anchorErrorSpec, anchorTemplatePending, emitTaskBlock, emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd, getPassCmd } = require('../../lib/shared/next-command-helper.cjs');
// v3.0: 引入 Plan 標籤規格提取函式
const { extractPlanSpec, extractFunctionManifest, getStoryContext } = require('../../lib/plan/plan-spec-extractor.cjs');
// P0.8: Plan Schema 驗證
const { validatePlan } = require('../../lib/plan/plan-validator.cjs');

const API_SURFACE_TYPES = new Set(['API', 'SVC', 'HTTP']);

/** GEMS: buildPhase1 | P1 | loadPlan(IO)→generateScaffold(IO)→runTsc(IO)→RETURN:PhaseResult | Story-4.0 */
function run(options) {
  const { target, iteration = 'iter-1', story, level = 'M' } = options;
  // 計算相對路徑（用於輸出指令，避免絕對路徑問題）
  const relativeTarget = path.relative(process.cwd(), target) || '.';

  const planPath = `.gems/iterations/${iteration}/plan`;

  console.log(getSimpleHeader('BUILD', 'Phase 1'));

  // 門控規格 - 根據專案特徵動態決定必要目錄
  // 必要: package.json, config, shared, modules（所有專案都需要）
  // 可選: assets（有前端時）, lib（有第三方封裝時）, routes（有路由時）
  const gateSpec = {
    checks: [
      { name: 'package.json', pattern: '專案設定檔存在', desc: '必須有 package.json', required: true },
      { name: 'Config Layer', pattern: 'src/config/', desc: '全域配置目錄', required: true },
      { name: 'Shared Layer', pattern: 'src/shared/', desc: '跨模組共用邏輯', required: true },
      { name: 'Modules Layer', pattern: 'src/modules/', desc: '業務模組容器', required: true },
      { name: 'Assets Layer', pattern: 'src/assets/', desc: '靜態資源目錄（前端專案）', required: false },
      { name: 'Lib Layer', pattern: 'src/lib/', desc: '第三方庫封裝（視需求）', required: false },
      { name: 'Routes Layer', pattern: 'src/routes/', desc: '路由定義（有路由時）', required: false }
    ]
  };

  if (!story) {
    emitFix({
      scope: 'BUILD Phase 1',
      summary: '缺少 --story 參數',
      targetFile: 'CLI 參數',
      missing: ['--story 參數'],
      example: `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.0 --target=${relativeTarget}`,
      nextCmd: 'node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.Y',
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      phase: 'build',
      step: 'phase-1',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  // 初始化錯誤處理器
  const errorHandler = createErrorHandler('BUILD', 'phase-1', story);

  const planFile = path.join(target, planPath, `implementation_plan_${story}.md`);

  if (!fs.existsSync(planFile)) {
    emitFix({
      scope: `BUILD Phase 1 | ${story}`,
      summary: 'implementation_plan 檔案不存在',
      targetFile: planFile,
      missing: ['implementation_plan 檔案'],
      example: `# 請先完成 PLAN 階段
node task-pipe/runner.cjs --phase=PLAN --step=2 --story=${story} --target=${relativeTarget}

# 或手動建立 Plan 檔案:
mkdir -p ${planPath}
# 然後建立 implementation_plan_${story}.md`,
      nextCmd: `node task-pipe/runner.cjs --phase=PLAN --step=2 --story=${story}`,
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-1',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  // P0.8: Plan Schema 驗證 — 確保 plan 格式正確再進 BUILD
  const planValidation = validatePlan(planFile);
  if (!planValidation.valid) {
    const planRelPath = path.relative(process.cwd(), planFile);
    emitBlock({
      scope: `BUILD Phase 1 | ${story}`,
      summary: `Plan Schema 驗證失敗 (${planValidation.errors.length} 個錯誤)`,
      targetFile: planRelPath,
      details: planValidation.errors.map(e => `[${e.rule}] ${e.message}`).join('\n'),
      missing: planValidation.errors.map(e => `[${e.rule}] ${e.message}`),
      tasks: planValidation.errors.map(e => ({
        action: e.rule === 'IMPL_SKELETON' ? 'FIX_IMPL_SKELETON'
              : e.rule === 'PLAN_TRACE'    ? 'FIX_PLAN_TRACE'
              : 'FIX_PLAN_SCHEMA',
        file: planRelPath,
        expected: e.message,
      })),
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story} --target=${relativeTarget}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-1',
      story
    });
    return { verdict: 'BLOCKER', reason: 'plan_schema_invalid', errors: planValidation.errors };
  }
  if (planValidation.warnings.length > 0) {
    console.log(`⚠️  Plan Schema: ${planValidation.warnings.length} warning(s) — ${planValidation.warnings.map(w => w.rule).join(', ')}`);
    if (planValidation.warnings.some(w => w.rule === 'AC_FIELD')) {
      console.log(`   ℹ️  AC_FIELD warning: plan-generator 的 AC 欄位為機械佔位符（○○），可忽略。`);
    }
  }

  // 偵測專案類型
  const projectInfo = detectProjectType(target);
  const { type: projectType, config: typeConfig, isGreenfield } = projectInfo;
  const srcDir = getSrcDir(target, projectType);
  // multi-root: 取得所有 srcDirs（blueprint.md 的 **源碼路徑** 欄位或 auto-glob）
  const srcDirs = getSrcDirs(target);

  const content = fs.readFileSync(planFile, 'utf8');
  const items = extractItems(content);

  // v3.0: 從 Plan 提取標籤規格
  const planSpec = extractPlanSpec(planFile);
  const manifest = extractFunctionManifest(planFile);
  const storyContext = getStoryContext(planFile);
  const planSpecsBlock = generatePlanSpecsBlock(planSpec, manifest, story);

  const apiReadiness = checkApiContractReadiness(target, iteration, story, manifest, content);
  if (apiReadiness.verdict === 'BLOCKER') {
    emitBlock({
      scope: `BUILD Phase 1 | ${story}`,
      summary: apiReadiness.summary,
      targetFile: apiReadiness.targetFile,
      details: apiReadiness.details,
      missing: apiReadiness.missing,
      tasks: apiReadiness.tasks,
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story} --target=${relativeTarget}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-1',
      story
    });
    return { verdict: 'BLOCKER', reason: 'api_contract_incomplete', missing: apiReadiness.missing };
  }

  // 判斷是否為 Foundation。不要用 Story-X.0 推斷，因為後續 iter 也可能有 12.0 這種非基礎建設 Story。
  const storyMatch = story.match(/Story-(\d+)\.(\d+)/);
  const storyX = storyMatch ? parseInt(storyMatch[1]) : 1;
  const storyY = storyMatch ? parseInt(storyMatch[2]) : 0;
  const isFoundation = /@FOUNDATION-STORY/i.test(content) || (storyX === 1 && storyY === 0);
  const isVscRefactorExempt = /@VSC-EXEMPT:\s*REFACTOR_ONLY/i.test(content);
  const existingApiMarker = content.match(/@VSC-EXISTING-API:\s*(.+)/i);

  // ========================================
  // 🔍 VSC 垂直切片完整性檢查 (v1.0)
  // Task-Pipe 版本：從 Plan 函式清單掃描類型
  // Feature Story (X.Y, Y > 0) 必須有 ROUTE 類型
  // ========================================
  if (!isFoundation && !isVscRefactorExempt) {
    // 從 manifest 的函式清單中，取得所有動作類型
    const allTypes = new Set(
      (manifest?.functions || []).map(fn => (fn.type || fn.actionType || '').toUpperCase())
    );

    // 也從 Plan 內容掃描 GEMS-FLOW 或 type 欄位
    const planContent = fs.readFileSync(planFile, 'utf8');
    const typeMatches = planContent.match(/\|\s*(ROUTE|SVC|API|HOOK|UI|DATA|CONST)\s*\|/gi) || [];
    typeMatches.forEach(m => {
      const t = m.replace(/\|/g, '').trim().toUpperCase();
      allTypes.add(t);
    });
    if (existingApiMarker) {
      allTypes.add('API');
    }

    const missingVSC = [];
    // UI 類型也算前端展示層，有 UI 或 ROUTE 都滿足前端進入點需求
    if (!allTypes.has('ROUTE') && !allTypes.has('UI')) {
      missingVSC.push('ROUTE (使用者進入點 — 路由路徑或頁面元件)');
    }
    if (!allTypes.has('SVC') && !allTypes.has('API')) {
      missingVSC.push('SVC 或 API (業務邏輯層)');
    }
    // ROUTE 本身就是前端展示層，有 ROUTE 就不需要額外要求 UI
    const hasFrontend = allTypes.has('UI') || allTypes.has('HOOK') || allTypes.has('ROUTE');
    if (hasFrontend && !allTypes.has('UI') && !allTypes.has('ROUTE')) {
      missingVSC.push('UI (前端展示層)');
    }

    if (missingVSC.length > 0) {
      const planRelPath = path.relative(process.cwd(), planFile);
      emitBlock({
        scope: `BUILD Phase 1 | ${story}`,
        summary: `垂直切片不完整 (VSC-002): 缺少 ${missingVSC.join(' | ')}`,
        targetFile: planRelPath,
        details: [
          '每個 Feature Story 必須包含完整的垂直切片，使用者才能實際看到並使用該功能。',
          '請在 implementation_plan 中補充缺少的層次動作：',
          ...missingVSC.map(m => `  - ${m}`),
          '',
          '範例：在動作表格加入 | 頁面路由 | ROUTE | TimerPage | P1 | LOAD→RENDER→BIND |'
        ].join('\n'),
        missing: missingVSC,
        tasks: missingVSC.map(m => ({
          action: 'FIX_PLAN_SCHEMA',
          file: planRelPath,
          expected: `補充 ${m} 層的 Item（格式：| 說明 | TYPE | Name | P1 | STEP1→STEP2→ |）`,
        })),
        nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story} --target=${relativeTarget}`
      }, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'build',
        step: 'phase-1',
        story
      });
      return { verdict: 'BLOCKER', reason: 'vsc_incomplete', missing: missingVSC };
    }
    console.log('✅ VSC 垂直切片完整性通過');
  } else if (isVscRefactorExempt) {
    console.log('⏭️  VSC 垂直切片檢查跳過：@VSC-EXEMPT: REFACTOR_ONLY');
  }
  // ========================================
  // VSC 檢查結束
  // ========================================

  // ========================================
  // 🔍 前端專案檢查（Story-1.0 專用）
  // ========================================
  if (isFoundation) {
    const { execSync } = require('child_process');

    // 1. UI 移植檢查（優先執行，因為它會建立 index.html）
    const hasIndexHtml = fs.existsSync(path.join(target, 'index.html'));
    const pocDir = path.join(target, `.gems/iterations/${iteration}/poc`);
    let pocFile = null;

    if (fs.existsSync(pocDir)) {
      const pocFiles = fs.readdirSync(pocDir);
      pocFile = pocFiles.find(f => f.includes('POC') && (f.endsWith('.html') || f.endsWith('.tsx')));
    }

    if (pocFile && !hasIndexHtml) {
      console.log('\n🎨 偵測到 POC 但尚未移植 UI，自動執行移植...');
      try {
        const pocPath = path.join(pocDir, pocFile);

        // 檢查移植工具是否存在
        const migrateTool = path.resolve(__dirname, '../../tools/poc/migrate-poc-ui.cjs');
        if (fs.existsSync(migrateTool)) {
          execSync(`node "${migrateTool}" "${pocPath}" --output "${target}"`, {
            stdio: 'inherit',
            cwd: path.resolve(__dirname, '../../..')
          });
          console.log('✅ UI 移植完成！');
        } else {
          console.log('⏭️  UI 移植工具尚未建立，跳過自動移植（migrate-poc-ui.cjs）');
        }
      } catch (error) {
        emitFix({
          scope: `BUILD Phase 1 | ${story}`,
          summary: 'UI 移植需要調整',
          targetFile: path.join(pocDir, pocFile),
          missing: ['UI 移植'],
          nextCmd: `node task-pipe/tools/poc/migrate-poc-ui.cjs ${path.join(pocDir, pocFile)} --output ${target}`
        }, {
          projectRoot: target,
          iteration: parseInt(iteration.replace('iter-', '')),
          phase: 'build',
          step: 'phase-1',
          story
        });
        return { verdict: 'BLOCKER', reason: 'ui_migration_failed' };
      }
    }

    // 2. 環境一致性檢查 (僅在非綠地或已有 package.json 時執行)
    if (!isGreenfield || fs.existsSync(path.join(target, 'package.json'))) {
      console.log('\n🔍 執行環境一致性檢查...');
      const envChecker = path.resolve(__dirname, '../../tools/build/env-checker.cjs');
      if (fs.existsSync(envChecker)) {
        try {
          execSync(`node "${envChecker}" ${target}`, {
            stdio: 'inherit',
            cwd: path.resolve(__dirname, '../../..')
          });
        } catch (error) {
          // 環境檢查失敗（exit code 1）
          emitFix({
            scope: `BUILD Phase 1 | ${story}`,
            summary: '環境設定需要調整',
            targetFile: 'package.json / tsconfig.json',
            missing: ['環境一致性'],
            nextCmd: 'node task-pipe/tools/build/env-checker.cjs'
          }, {
            projectRoot: target,
            iteration: parseInt(iteration.replace('iter-', '')),
            phase: 'build',
            step: 'phase-1',
            story
          });
          return { verdict: 'BLOCKER', reason: 'environment_mismatch' };
        }
      } else {
        console.log('⏭️  環境檢查工具尚未建立，跳過（env-checker.cjs）');
      }
    }

    // 3. 假路由檢查（如果有 routes 目錄）
    const routesDir = path.join(target, 'src', 'routes');
    if (fs.existsSync(routesDir)) {
      console.log('\n🗺️  檢查路由設定...');
      const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

      for (const file of routeFiles) {
        const content = fs.readFileSync(path.join(routesDir, file), 'utf-8');
        const hasRouteArray = content.includes('routes') && content.includes('[');
        const hasRouteLogic =
          content.includes('addEventListener') ||
          content.includes('pushState') ||
          content.includes('class') && content.includes('Router') ||
          content.includes('navigate');

        if (hasRouteArray && !hasRouteLogic) {
          emitFix({
            scope: `BUILD Phase 1 | ${story}`,
            summary: '路由設定需要完善',
            targetFile: path.join(routesDir, file),
            missing: ['路由邏輯'],
            nextCmd: `node task-pipe/tools/build/route-fixer.cjs ${routesDir} --type=hash`
          }, {
            projectRoot: target,
            iteration: parseInt(iteration.replace('iter-', '')),
            phase: 'build',
            step: 'phase-1',
            story
          });
          return { verdict: 'BLOCKER', reason: 'fake_routing_detected' };
        }
      }
      console.log('✅ 路由設定正常');
    }
  }
  // ========================================
  // 前端檢查結束
  // ========================================

  // 綠地專案：顯示初始化指引
  if (isGreenfield) {
    const guide = getGreenfieldGuide(projectType);

    // Foundation Story 綠地：自動建立標準目錄骨架（每個 srcDir root 各自建立）
    if (isFoundation) {
      for (const sd of srcDirs) {
        const scaffoldResult = autoScaffoldFoundation(target, sd, projectType, manifest);
        if (scaffoldResult.created.length > 0) {
          const relRoot = path.relative(target, sd).replace(/\\/g, '/');
          console.log(`\n🏗️  Auto-scaffold [${relRoot}]: 建立 ${scaffoldResult.created.length} 個標準目錄`);
          scaffoldResult.created.forEach(d => console.log(`   ✅ ${d}`));
        }
      }
    }

    anchorOutput({
      context: `Phase 1 | ${story} | 綠地專案`,
      info: {
        projectType,
        srcDir: typeConfig.srcDir || 'src',
        testCommand: typeConfig.testCommand || '無',
        defaultLevel: typeConfig.defaultLevel,
        items: items.length,
        storyType: isFoundation ? 'Foundation (X.0)' : 'Module (X.1+)'
      },
      guide: {
        title: 'GREENFIELD 專案初始化',
        content: guide
      },
      template: {
        title: 'MODULAR_STRUCTURE (強制 - 語言無關概念)',
        content: isFoundation ? `
⚠️ Story-1.0 強制檢查清單 (Module 0 基礎建設)

**核心原則**: 沒有搭建好基礎建設，後面都是死路。

**範圍限制**: 只建立 Plan 定義的檔案。src/modules/ 只建空目錄，禁止預建後續 Story 的子模組。
不要建立 Plan 沒提到的 barrel export (index.ts) 或 utility 檔案。
${manifest.hasManifest ? `\n**Plan 定義的檔案清單** (只建這些):\n${manifest.functions.map(f => '- ' + (f.file || f.name)).join('\n')}` : ''}

**必要分層** (所有專案):
- [ ] Config Layer - 全域配置，無依賴
- [ ] Shared Layer - 跨模組共用邏輯（types, utils, storage 等）
- [ ] Modules Layer - 業務模組容器

**可選分層** (根據專案特徵自動偵測):
- [ ] Assets Layer - 靜態資源（前端專案需要）
- [ ] Lib Layer - 第三方庫封裝（有外部依賴時）
- [ ] Routes Layer - 路由定義（有路由框架時）

**驗收標準**:
- ✅ 應用程式可啟動（即使功能未完成）
- ✅ 後續模組可直接在 modules/ 下新增
- ✅ 依賴方向正確: Config ← Shared ← Modules

**請依照 PLAN 中確定的技術棧調整**:
- 檔案副檔名（${typeConfig.extensions.join(', ')}）
- 目錄結構（參考 implementation_plan）
- 語法細節（interface/class, export/public 等）
` : `
[Module] Story X.1+ = 業務模組 (垂直分片 - 概念通用)

modules/[module-name]/
├── index.*          # Facade (唯一公開 API) *必須
├── constants.*      # 模組內常數
├── types/           # 資料模型與 DTO
├── api/             # 後端 API 呼叫
├── store/           # 模組狀態（如需要）
├── services/        # 純業務邏輯/資料轉換
├── components/      # 模組專用元件/視圖
└── pages/           # 路由頁面入口

**模組化衝刺原則**:
- 一次只做一個模組，做完鎖死
- 禁止跳躍: 沒完成 Module N，不准開始 Module N+1
- 標籤檢查: 確認 GEMS-DEPS 沒有偷連別的模組

**請依照 PLAN 中確定的技術棧調整**:
- 檔案副檔名（${typeConfig.extensions.join(', ')}）
- 命名慣例（components/views, services/usecases 等）
`
      },
      rules: [
        '一個 Agent 一個 Story（Context 管理）',
        '每個函式加入 GEMS 標籤（註解格式，任何語言都能用）',
        '模組不能直接引用另一模組內部檔案',
        isFoundation ? 'Story-1.0 必須完成所有橫向分層才能進 Phase 2' : 'Module N 必須透過 index.* Facade 暴露 API',
        planSpecsBlock ? '📝 參考 PLAN_SPECS 區塊，直接複製 GEMS 標籤到源碼' : null
      ].filter(Boolean),
      // v3.0: Plan 標籤規格區塊
      planSpecs: planSpecsBlock || null,
      task: [
        `讀取 ${planFile}（PLAN 階段已確定技術棧與檔案結構）`,
        isFoundation ? '初始化橫向分層結構（依 PLAN 定義）' : '建立模組垂直分片結構（依 PLAN 定義）',
        '依序實作每個 Item 的功能程式碼',
        '加入 GEMS 標籤（P0-P3 全部覆蓋，參考 PLAN_SPECS 區塊）',
        projectType !== 'gas' ? '執行 getDiagnostics() 確認 0 errors' : 'GAS 專案略過型別檢查',
        isFoundation ? '⚠️ 只建立 Plan 定義的檔案，禁止預建後續 Story 的模組目錄或檔案' : null,
        isFoundation ? '⚠️ src/modules/ 只建空目錄，不要在裡面建任何子模組' : null
      ].filter(Boolean),
      output: getNextCmd('BUILD', '1', { story, level, target: relativeTarget, iteration })
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-1',
      story
    });

    return { verdict: 'PENDING', items, projectType, isGreenfield: true };
  }

  // 棕地專案：從所有 srcDirs 收集源碼（multi-root 支援）
  const srcFiles = srcDirs.flatMap(sd => findSourceFiles(sd, typeConfig.extensions));

  // Foundation Story 棕地：對每個 srcDir root 各自 auto-scaffold（補缺少的標準目錄）
  if (isFoundation) {
    for (const sd of srcDirs) {
      const scaffoldResult = autoScaffoldFoundation(target, sd, projectType, manifest);
      if (scaffoldResult.created.length > 0) {
        const relRoot = path.relative(target, sd).replace(/\\/g, '/');
        console.log(`\n🏗️  Auto-scaffold [${relRoot}]: 建立 ${scaffoldResult.created.length} 個標準目錄`);
        scaffoldResult.created.forEach(d => console.log(`   ✅ ${d}`));
      }
    }
  }

  if (srcFiles.length > 0) {    // Story-1.0 需要額外檢查橫向分層與環境設定
    // multi-root: 對每個 srcDir 各自執行 validateModule0Structure，check 帶 srcDir 標記
    const checks = isFoundation
      ? srcDirs.flatMap(sd => {
          const rootChecks = validateModule0Structure(target, sd, projectType);
          const relRoot = path.relative(target, sd).replace(/\\/g, '/');
          return srcDirs.length > 1
            ? rootChecks.map(c => ({ ...c, name: `[${relRoot}] ${c.name}`, srcDir: sd }))
            : rootChecks.map(c => ({ ...c, srcDir: sd }));
        })
      : validatePhase1(srcFiles);
    const failed = checks.filter(c => !c.pass);

    if (failed.length === 0) {
      // 骨架偵測 — 如果骨架已預生成，直接提示進 Phase 2
      if (!isFoundation && manifest.hasManifest && manifest.functions.length > 0) {
        const scaffoldFiles = manifest.functions
          .filter(fn => fn.file)
          .map(fn => path.join(target, fn.file));
        const existingScaffolds = scaffoldFiles.filter(f => fs.existsSync(f));

        if (existingScaffolds.length > 0 && existingScaffolds.length === scaffoldFiles.length) {
          // 所有骨架檔案都已存在
          console.log(`\n🦴 骨架偵測: ${existingScaffolds.length}/${scaffoldFiles.length} 個骨架檔案已存在`);

          // 組出需要 AI 實作的 @TASK 清單
          const relPlanFile = path.relative(target, planFile);
          const scaffoldTasks = manifest.functions
            .filter(fn => fn.file)
            .map((fn, idx) => {
              const isModify = (fn.evolution || '').toUpperCase() === 'EVOLVE' ||
                               (fn.techName || fn.name || '').includes('[Modify]');
              const action = isModify ? 'MODIFY' : 'IMPLEMENT';
              return {
                action,
                file: fn.file,
                expected: `依 ${relPlanFile} Item ${idx + 1} 實作（禁止留 throw new Error）`
              };
            });

          writeCheckpoint(target, iteration, story, '1', {
            verdict: 'PASS',
            projectType,
            srcFiles: srcFiles.length,
            checks: checks.map(c => c.name),
            isFoundation,
            scaffoldMode: true,
            scaffoldCount: existingScaffolds.length
          });

          handlePhaseSuccess('BUILD', 'phase-1', story, target);

          emitPass({
            scope: 'BUILD Phase 1',
            summary: `骨架模式: ${existingScaffolds.length} 個骨架檔案已存在 | ${projectType}`,
            nextCmd: getNextCmd('BUILD', '1', { story, level, target: relativeTarget, iteration }),
            tasks: scaffoldTasks
          }, {
            projectRoot: target,
            iteration: parseInt(iteration.replace('iter-', '')),
            phase: 'build',
            step: 'phase-1',
            story
          });
          return { verdict: 'PASS', scaffoldMode: true };
        } else if (existingScaffolds.length > 0) {
          // 部分骨架存在
          console.log(`\n🦴 骨架偵測: ${existingScaffolds.length}/${scaffoldFiles.length} 個骨架檔案已存在（部分）`);
        }
      }
      // v3.1: 範圍檢查 - 偵測 Plan 外的多餘檔案（Story-1.0 及後續 Story 都檢查）
      if (manifest.hasManifest) {
        const iterNum = parseInt(iteration.replace('iter-', ''));
        const extraFiles = detectExtraFiles(srcDir, manifest, typeConfig.extensions, iterNum, target, iteration, story);
        if (extraFiles.length > 0) {
          const retryCmd = getRetryCmd('BUILD', '1', { story, target: relativeTarget, iteration });
          const tasks = extraFiles.map(f => ({
            action: 'DELETE_FILE',
            file: path.relative(target, f),
            expected: 'Plan 未定義此檔案，請刪除或確認是否需要',
            reference: path.relative(target, planFile)
          }));
          emitTaskBlock({
            verdict: 'TACTICAL_FIX',
            context: `Phase 1 | ${story} | 偵測到 Plan 外的多餘檔案 (${extraFiles.length} 個)`,
            strategyDrift: { level: 1, name: 'SCOPE_CLEANUP', hint: '刪除 Plan 未定義的檔案，保持骨架精簡' },
            tasks,
            nextCommand: retryCmd
          }, {
            projectRoot: target,
            iteration: iterNum,
            phase: 'build',
            step: 'phase-1',
            story
          });
          return { verdict: 'PENDING', reason: 'extra_files_detected', extraFiles };
        }
      }

      // 寫入 checkpoint
      writeCheckpoint(target, iteration, story, '1', {
        verdict: 'PASS',
        projectType,
        srcFiles: srcFiles.length,
        checks: checks.map(c => c.name),
        isFoundation
      });

      handlePhaseSuccess('BUILD', 'phase-1', story, target);

      emitPass({
        scope: 'BUILD Phase 1',
        summary: `${srcFiles.length} 個源碼檔案 | ${projectType} | ${isFoundation ? 'Module 0' : 'Module N'}`,
        nextCmd: getNextCmd('BUILD', '1', { story, level, target: relativeTarget, iteration })
      }, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'build',
        step: 'phase-1',
        story
      });
      return { verdict: 'PASS' };
    } else if (isFoundation) {
      // Story-1.0 缺少必要分層/設定 - 使用指令式任務區塊
      const attempt = errorHandler.recordError('E5', `缺少: ${failed.map(c => c.name).join(', ')}`);

      const iterNum = parseInt(iteration.replace('iter-', ''));
      const retryCmd = getRetryCmd('BUILD', '1', { story, target: relativeTarget, iteration });

      if (errorHandler.shouldBlock()) {
        // 達到重試上限 - 仍然用指令式輸出，但標記為 BLOCKER
        const tasks = failed.map(c => {
          const taskInfo = mapCheckToTask(c, target, c.srcDir || srcDir, planFile, story);
          return taskInfo;
        });

        emitTaskBlock({
          verdict: 'BLOCKER',
          context: `Phase 1 | ${story} | 重試上限 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS})`,
          strategyDrift: { level: 3, name: 'PLAN_ROLLBACK', hint: '多次修復失敗，建議回退檢查 PLAN 架構定義' },
          tasks,
          nextCommand: retryCmd
        }, {
          projectRoot: target,
          iteration: iterNum,
          phase: 'build',
          step: 'phase-1',
          story
        });
        return { verdict: 'BLOCKER', reason: 'tactical_fix_limit' };
      }

      // 正常重試 - 指令式任務清單
      const tasks = failed.map(c => {
        const taskInfo = mapCheckToTask(c, target, c.srcDir || srcDir, planFile, story);
        return taskInfo;
      });

      const recoveryLevel = errorHandler.getRecoveryLevel();
      const strategyDrift = attempt > 3 ? {
        level: 2,
        name: 'STRATEGY_SHIFT',
        hint: `前 ${attempt - 1} 次修復未成功，考慮刪除現有檔案重新生成`
      } : attempt > 1 ? {
        level: 1,
        name: 'TACTICAL_FIX',
        hint: '局部修補，在原檔案修復'
      } : null;

      emitTaskBlock({
        verdict: 'TACTICAL_FIX',
        context: `Phase 1 | ${story} | 基礎建設不完整 (${attempt}/${MAX_ATTEMPTS})`,
        strategyDrift,
        tasks,
        nextCommand: retryCmd
      }, {
        projectRoot: target,
        iteration: iterNum,
        phase: 'build',
        step: 'phase-1',
        story
      });
      return { verdict: 'PENDING', attempt, failed };
    }
  }

  // 棕地但需要新增程式碼
  anchorOutput({
    context: `Phase 1 | ${story} | 棕地專案`,
    info: {
      projectType,
      planFile,
      items: items.length,
      existingSrcFiles: srcFiles.length,
      storyType: isFoundation ? 'Foundation (X.0)' : 'Module (X.1+)'
    },
    template: {
      title: 'MODULAR_STRUCTURE (強制)',
      content: isFoundation ? `
⚠️ Story-1.0 強制檢查清單 (Module 0 基礎建設)

**範圍限制**: 只建立 Plan 定義的檔案。src/modules/ 只建空目錄，禁止預建後續 Story 的子模組。
不要建立 Plan 沒提到的 barrel export (index.ts) 或 utility 檔案。
${manifest.hasManifest ? `\n**Plan 定義的檔案清單** (只建這些):\n${manifest.functions.map(f => '- ' + (f.file || f.name)).join('\n')}` : ''}

**1. 環境設定 (Environment)**:
- [ ] package.json (必須存在，且 type="module")
- [ ] ${projectType === 'typescript' ? 'tsconfig.json (必須存在)' : 'jsconfig.json (可選)'}

**2. 橫向分層 (Layers)**:
必要:
- [ ] Config Layer (src/config/) - 全域配置
- [ ] Shared Layer (src/shared/) - 跨模組共用邏輯（types, utils, storage 等）
- [ ] Modules Layer (src/modules/) - 業務模組容器

可選 (根據專案特徵):
- [ ] Assets Layer (src/assets/) - 靜態資源（前端專案）
- [ ] Lib Layer (src/lib/) - 第三方庫封裝
- [ ] Routes Layer (src/routes/) - 路由定義

**驗收標準**:
- ✅ 專案可執行 (npm install 由此開始)
- ✅ 語言一致性 (Type=${projectType} 必須產出對應附檔名，Plan 說 TS 就必須是 TS)
- ✅ 依賴方向正確: Config ← Shared ← Modules
` : `
[Module] Story X.1+ = 業務模組 (垂直分片)

src/modules/[module-name]/
├── index.ts         # Facade (唯一公開 API) *必須
├── constants.ts     # 模組內常數
├── types/           # Domain Models & DTOs
├── api/             # 純後端 API 呼叫
├── store/           # 模組狀態 (如需要)
├── hooks/           # 業務邏輯 Hooks
├── services/        # 純業務邏輯/資料轉換
├── components/      # 模組專用元件
└── pages/           # 路由頁面入口

**模組化衝刺原則**:
- 一次只做一個模組，做完鎖死
- 標籤檢查: 確認 GEMS-DEPS 沒有偷連別的模組
`
    },
    rules: [
      `嚴格遵守 Plan 定義的語言 (${projectType})。如果 Plan 用 TypeScript，禁止產出 JavaScript。`,
      '每個函式加入 GEMS 標籤（v2.1 格式）',
      '模組不能直接 import 另一模組內部檔案',
      isFoundation ? 'Story-1.0 必須完成 package.json 與所有橫向分層才能進 Phase 2' : 'Module N 必須透過 index.ts Facade 暴露 API',
      projectType !== 'gas' ? '型別檢查 0 errors 才進 Phase 2' : 'GAS 專案略過型別檢查',
      planSpecsBlock ? '📝 參考 PLAN_SPECS 區塊，直接複製 GEMS 標籤到源碼' : null
    ].filter(Boolean),
    // v3.0: Plan 標籤規格區塊
    planSpecs: planSpecsBlock || null,
    task: [
      `讀取 ${planFile}（參考 PLAN Step 2.5 架構審查結果與語言要求）`,
      '檢查並建立環境 (package.json, tsconfig.json) 若不存在',
      '依序實作每個 Item 的功能程式碼',
      '加入 GEMS 標籤（P0-P3 全部覆蓋，參考 PLAN_SPECS 區塊）',
      projectType !== 'gas' ? '執行 getDiagnostics() 確認 0 errors' : '確認程式碼完成',
      isFoundation ? '⚠️ 只建立 Plan 定義的檔案，禁止預建後續 Story 的模組目錄或檔案' : null,
      isFoundation ? '⚠️ src/modules/ 只建空目錄，不要在裡面建任何子模組' : null
    ].filter(Boolean),
    gemsTemplate: planSpecsBlock ? null : (projectType === 'python' ? '# ... (Python Template)' : `/**
 * GEMS: functionName | P[0-3] | ○○ | (args)→Result | ${story} | 描述
 * GEMS-FLOW: Step1→Step2→Step3
 * GEMS-DEPS: [Type.Name (說明)], [Type.Name (說明)]
 * ...
 */`),
    output: getNextCmd('BUILD', '1', { story, level, target: relativeTarget, iteration })
  }, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'build',
    step: 'phase-1',
    story
  });

  return { verdict: 'PENDING', items, projectType };
}

/**
 * 將失敗的檢查項目轉換為指令式任務
 * @param {object} check - 失敗的檢查 {name, pass}
 * @param {string} target - 專案根目錄
 * @param {string} srcDir - src 目錄路徑
 * @param {string} planFile - plan 檔案路徑
 * @param {string} story - Story ID
 * @returns {object} 任務物件 {action, file, expected, reference}
 */
function mapCheckToTask(check, target, srcDir, planFile, story) {
  const name = check.name;
  const relPlan = path.relative(target, planFile);
  // v7.1: 使用實際 srcDir 相對路徑，避免 hardcode src/（支援多根目錄如 backend-gas/src）
  const relSrcDir = path.relative(target, srcDir).replace(/\\/g, '/') || 'src';

  if (name.includes('package.json')) {
    return {
      action: 'VERIFY_OR_CREATE',
      file: 'package.json',
      expected: 'type="module", name, version, scripts.test, scripts.build',
      reference: relPlan
    };
  }
  if (name.includes('tsconfig')) {
    return {
      action: 'VERIFY_OR_CREATE',
      file: 'tsconfig.json',
      expected: 'compilerOptions with strict, module, target, outDir',
      reference: relPlan
    };
  }
  if (name.includes('Config')) {
    return {
      action: 'CREATE_DIR_WITH_INDEX',
      file: `${relSrcDir}/config/`,
      expected: `${relSrcDir}/config/index.ts exporting app config`,
      reference: `${relPlan} → Config Layer`
    };
  }
  if (name.includes('Shared 子目錄')) {
    return {
      action: 'CREATE_SUBDIRS',
      file: `${relSrcDir}/shared/`,
      expected: `At least 1 file or subdirectory in ${relSrcDir}/shared/ (types.ts, or types/, storage/, utils/)`,
      reference: `${relPlan} → Shared Layer items`
    };
  }
  if (name.includes('Shared')) {
    return {
      action: 'CREATE_DIR_WITH_SUBDIRS',
      file: `${relSrcDir}/shared/`,
      expected: `${relSrcDir}/shared/index.ts + subdirs (types/, storage/, utils/)`,
      reference: `${relPlan} → Shared Layer`
    };
  }
  if (name.includes('Modules')) {
    return {
      action: 'CREATE_DIR',
      file: `${relSrcDir}/modules/`,
      expected: 'Empty modules container directory',
      reference: `${relPlan} → Modules Layer`
    };
  }
  if (name.includes('Assets')) {
    return {
      action: 'CREATE_DIR',
      file: `${relSrcDir}/assets/`,
      expected: 'Static assets directory',
      reference: relPlan
    };
  }
  if (name.includes('Routes')) {
    return {
      action: 'CREATE_DIR_WITH_INDEX',
      file: `${relSrcDir}/routes/`,
      expected: `${relSrcDir}/routes/index.ts with route definitions`,
      reference: relPlan
    };
  }
  // Fallback
  return {
    action: 'FIX',
    file: `src/ (${name})`,
    expected: name,
    reference: relPlan
  };
}

function extractItems(content) {
  const matches = content.match(/### Item \d+:/g) || [];
  return matches.map((m, i) => ({ id: i + 1, name: m }));
}

function findSourceFiles(dir, extensions = ['.ts', '.tsx'], files = []) {
  if (!fs.existsSync(dir)) return files;

  const extPattern = new RegExp(`(${extensions.map(e => e.replace('.', '\\.')).join('|')})$`);

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.includes('__tests__') && !entry.name.includes('tests') && entry.name !== 'node_modules') {
      findSourceFiles(fullPath, extensions, files);
    } else if (entry.isFile() && extPattern.test(entry.name) && !entry.name.includes('.test.') && !entry.name.includes('_test.')) {
      files.push(fullPath);
    }
  }
  return files;
}

function validatePhase1(srcFiles) {
  return [
    { name: '源碼檔案', pass: srcFiles.length > 0 }
  ];
}

/**
 * Story-1.0 (Module 0) 專用驗證
 * 檢查是否完成橫向分層結構與基礎環境設定
 * v2.5: 根據專案特徵動態決定必要/可選目錄
 *   必要: package.json, config, shared, modules
 *   可選: assets（有前端）, lib（有第三方封裝）, routes（有路由）
 */
function validateModule0Structure(target, srcDir, projectType) {
  // 偵測專案特徵：是否有前端、是否有路由
  const hasFrontend = detectHasFrontend(target, srcDir);
  const hasRouting = detectHasRouting(target, srcDir);

  // 從 Architecture Contract 讀取必要 layers（單一真相源）
  const contract = require('../../lib/shared/architecture-contract-proxy.cjs');
  const requiredLayers = contract.getRequiredLayers();

  // 必要目錄（所有專案）
  const checks = [
    { name: '專案設定 (package.json)', pass: fs.existsSync(path.join(target, 'package.json')) },
    ...requiredLayers.map(layer => ({
      name: `${layer.name.charAt(0).toUpperCase() + layer.name.slice(1)} Layer`,
      pass: fs.existsSync(path.join(srcDir, layer.name)),
    })),
  ];

  // 可選目錄（根據專案特徵）
  if (hasFrontend) {
    checks.push({ name: 'Assets Layer (前端)', pass: fs.existsSync(path.join(srcDir, 'assets')) });
  }
  if (hasRouting) {
    checks.push({ name: 'Routes Layer (路由)', pass: fs.existsSync(path.join(srcDir, 'routes')) });
  }
  // Lib 目錄：存在就檢查，不存在不強制
  if (fs.existsSync(path.join(srcDir, 'lib'))) {
    checks.push({ name: 'Lib Layer', pass: true });
  }

  if (projectType === 'typescript') {
    checks.push({ name: 'TypeScript 設定 (tsconfig.json)', pass: fs.existsSync(path.join(target, 'tsconfig.json')) });
  }

  // Shared 子目錄：前端需要 components/layouts，後端需要 types/storage 等
  // v7.1: 接受平坦檔案（如 GAS backend 的 types.ts）或子目錄，只要 shared/ 有內容即可
  const sharedDir = path.join(srcDir, 'shared');
  if (fs.existsSync(sharedDir)) {
    const sharedEntries = fs.readdirSync(sharedDir);
    const sharedSubs = sharedEntries.filter(f => {
      const fullPath = path.join(sharedDir, f);
      return fs.statSync(fullPath).isDirectory();
    });
    checks.push({
      name: 'Shared 子目錄',
      pass: sharedEntries.length >= 1  // 至少有一個檔案或子目錄（接受平坦檔案如 types.ts）
    });
  }

  return checks;
}

/**
 * v3.1: 偵測 Plan 外的多餘檔案
 * 比對 src/ 下的實際檔案 vs Plan manifest 定義的檔案
 * 只檢查 src/shared/ 和 src/config/ 下的 .ts/.js 檔案（不含測試）
 * src/modules/ 下的檔案不檢查（後續 Story 會建立）
 * 
 * @param {string} srcDir - src 目錄路徑
 * @param {object} manifest - extractFunctionManifest 的結果
 * @param {string[]} extensions - 副檔名列表
 * @returns {string[]} 多餘檔案的完整路徑列表
 */
function detectExtraFiles(srcDir, manifest, extensions, iterNum = 1, target = null, iteration = null, story = null) {
  const extraFiles = [];

  // 收集 Plan 定義的檔案路徑（正規化）
  const plannedPaths = new Set();

  function addManifestPaths(m) {
    for (const fn of m.functions) {
      if (fn.file) {
        // v7.1: 保留完整相對路徑（支援多根目錄如 frontend/src/foo.ts）
        // 只正規化反斜線與前導 ./ — 不強制加 src/ 前綴
        const norm = fn.file.replace(/\\/g, '/').replace(/^\.\//, '');
        plannedPaths.add(norm);
      }
    }
  }

  addManifestPaths(manifest);

  // v3.2: 讀取同 iter 前面 Story 的 plan，把它們定義的 shared 檔案也納入合法路徑
  // 這樣後續 Story 不需要重複聲明前面 Story 已建立的 shared 檔案
  if (target && iteration && story) {
    const { extractFunctionManifest: extractFM } = require('../../lib/plan/plan-spec-extractor.cjs');
    const planDir = path.join(target, '.gems', 'iterations', iteration, 'plan');
    const storyMatch = story.match(/Story-(\d+)\.(\d+)/);
    if (storyMatch && fs.existsSync(planDir)) {
      const storyX = parseInt(storyMatch[1]);
      const storyY = parseInt(storyMatch[2]);
      // 讀取同 iter 所有比當前 Story 早的 plan（跨 Story-X 也納入）
      const planFiles = fs.readdirSync(planDir).filter(f => f.startsWith('implementation_plan_Story-') && f.endsWith('.md'));
      for (const planFile of planFiles) {
        const m = planFile.match(/Story-(\d+)\.(\d+)/);
        if (!m) continue;
        const px = parseInt(m[1]);
        const py = parseInt(m[2]);
        // 比當前 Story 早：X 更小，或 X 相同但 Y 更小
        if (px < storyX || (px === storyX && py < storyY)) {
          const prevPlan = path.join(planDir, planFile);
          try {
            const prevManifest = extractFM(prevPlan);
            addManifestPaths(prevManifest);
          } catch (e) { /* 忽略解析錯誤 */ }
        }
      }
    }
  }

  // 如果 Plan 沒有定義任何檔案路徑，跳過檢查（避免誤判）
  if (plannedPaths.size === 0) return extraFiles;

  // 掃描所有 src 根目錄下的 shared/ 和 config/（multi-root 支援）
  // iter > 1 時跳過 shared/（跨 iter 共用，不應刪除前一個 iter 的產物）
  const checkDirNames = iterNum > 1 ? ['config'] : ['shared', 'config'];
  const projectRoot = target || path.dirname(srcDir);
  const { getSrcDirs } = require('../../lib/shared/project-type.cjs');
  const allSrcDirs = target ? getSrcDirs(target) : [srcDir];
  const allSrcRoots = allSrcDirs.map(p => path.relative(projectRoot, p).replace(/\\/g, '/'));
  const checkDirs = allSrcDirs.flatMap(d => checkDirNames.map(n => path.join(d, n)));

  for (const dir of checkDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = findSourceFilesFlat(dir, extensions);

    for (const file of files) {
      // 取得相對於專案根目錄的路徑
      const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');

      // 跳過測試檔案
      if (relPath.includes('__tests__') || relPath.includes('.test.') || relPath.includes('.spec.')) continue;

      // 跳過 Architecture Contract 認定的基礎建設檔案（如 src/config/* 或 backend-gas/src/config/*）
      // 即使 Plan 沒明列，這些路徑也是合法的
      const contract = require('../../lib/shared/architecture-contract-proxy.cjs');
      if (contract.isInfraFile(relPath, allSrcRoots)) continue;

      // 檢查是否在 Plan 定義中
      if (!plannedPaths.has(relPath)) {
        // 額外容忍：如果是目錄的 index.ts 且該目錄有 Plan 定義的檔案，允許
        const dirOfFile = path.dirname(relPath);
        const isBarrelExport = path.basename(file).match(/^index\.(ts|js|tsx|jsx)$/);
        const dirHasPlannedFiles = [...plannedPaths].some(p => p.startsWith(dirOfFile + '/'));

        if (isBarrelExport && dirHasPlannedFiles) continue; // 允許 barrel export

        extraFiles.push(file);
      }
    }
  }

  return extraFiles;
}

/**
 * 偵測專案是否有前端（HTML/CSS/React/Vue 等）
 */
function detectHasFrontend(target, srcDir) {
  // 檢查 index.html、.tsx/.jsx 檔案、或 POC HTML
  if (fs.existsSync(path.join(target, 'index.html'))) return true;
  if (fs.existsSync(path.join(target, 'public', 'index.html'))) return true;

  // 檢查 src 下是否有 .tsx/.jsx
  if (fs.existsSync(srcDir)) {
    try {
      const walk = (dir) => {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.vue') || f.endsWith('.svelte')) return true;
          const full = path.join(dir, f);
          if (fs.statSync(full).isDirectory() && !f.startsWith('.') && f !== 'node_modules') {
            if (walk(full)) return true;
          }
        }
        return false;
      };
      return walk(srcDir);
    } catch { return false; }
  }
  return false;
}

/**
 * 偵測專案是否有路由需求
 */
function detectHasRouting(target, srcDir) {
  // 如果已有 routes 目錄，顯然需要
  if (fs.existsSync(path.join(srcDir, 'routes'))) return true;
  // 如果有 Express/Koa/Fastify 等後端框架
  const pkgPath = path.join(target, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const routingLibs = ['express', 'koa', 'fastify', 'hono', 'react-router', 'vue-router', 'next', 'nuxt'];
      return routingLibs.some(lib => deps[lib]);
    } catch { return false; }
  }
  return false;
}

/**
 * 扁平搜尋指定目錄下的所有檔案（不遞迴到 node_modules、__tests__）
 */
function findSourceFilesFlat(dir, extensions, files = []) {
  if (!fs.existsSync(dir)) return files;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !['node_modules', '__tests__', '.gems', 'dist', 'build'].includes(entry.name) && !entry.name.startsWith('.')) {
        findSourceFilesFlat(fullPath, extensions, files);
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch { }
  return files;
}

/**
 * v3.0: 生成 Plan 標籤規格區塊 (用於注入到 prompt)
 * 從 Plan 提取具體的 GEMS 標籤，讓 AI 可以直接複製貼上
 */
function generatePlanSpecsBlock(planSpec, manifest, story) {
  // 如果沒有標籤規格，返回指導性模板
  if (!planSpec.functions.length && !manifest.hasManifest) {
    return null;
  }

  const lines = [];

  lines.push(`\n${'='.repeat(60)}`);
  lines.push(`📋 PLAN 標籤規格 (必須複製到源碼的 GEMS 標籤)`);
  lines.push(`${'='.repeat(60)}\n`);

  // 如果有從 Plan 提取到的完整標籤規格
  if (planSpec.functions.length > 0) {
    lines.push(`### 📦 已定義函式標籤 (直接複製到對應函式上方)`);
    lines.push('');

    for (const fn of planSpec.functions) {
      lines.push('```typescript');
      lines.push(`/**`);
      lines.push(` * GEMS: ${fn.name} | ${fn.priority} | ○○ | ${fn.signature || '(...)→Result'} | ${fn.storyId || story} | ${fn.description || 'TODO'}`);
      if (fn.flow) {
        lines.push(` * GEMS-FLOW: ${fn.flow}`);
      } else {
        lines.push(` * GEMS-FLOW: Validate→Process→Return`);
      }
      if (fn.deps) {
        lines.push(` * GEMS-DEPS: ${fn.deps}`);
      } else {
        lines.push(` * GEMS-DEPS: [TODO.deps (待填寫)]`);
      }
      lines.push(` * GEMS-DEPS-RISK: ${fn.depsRisk || 'LOW'}`);
      lines.push(` */`);
      lines.push('```');
      lines.push('');
    }
  }
  // 如果只有函式清單（表格或簡單 GEMS 標籤）
  else if (manifest.hasManifest && manifest.functions.length > 0) {
    lines.push(`### 📋 API 簽名對齊表 (骨架映射層必須對齊)`);
    lines.push('');

    // M16: 輸出完整 API 簽名，讓 AI 直接對齊，不需要猜
    for (const fn of manifest.functions) {
      const sig = fn.signature || `(...)→void`;
      const file = fn.file ? ` → \`${fn.file}\`` : '';
      lines.push('```typescript');
      lines.push(`/**`);
      lines.push(` * GEMS: ${fn.name} | ${fn.priority} | ○○ | ${sig} | ${story} | ${fn.description || 'TODO'}`);
      lines.push(` * GEMS-FLOW: TODO→Process→Return`);
      lines.push(` * GEMS-DEPS: [TODO.deps]`);
      lines.push(` * GEMS-DEPS-RISK: LOW`);
      lines.push(` */`);
      // 從 signature 推導函式骨架
      const sigClean = sig.replace(/`/g, '');
      const argsMatch = sigClean.match(/\(([^)]*)\)/);
      const retMatch = sigClean.match(/→\s*(.+)$/);
      const args = argsMatch ? argsMatch[1] : '';
      const ret = retMatch ? retMatch[1].trim() : 'void';
      lines.push(`export function ${fn.name}(${args}): ${ret} { throw new Error('not implemented'); }`);
      lines.push('```');
      if (file) lines.push(`📁 檔案${file}`);
      lines.push('');
    }
  }

  // 統計資訊
  const fnCount = planSpec.functions.length || manifest.functions.length;
  const p0Count = planSpec.functions.filter(f => f.priority === 'P0').length ||
    manifest.stats?.p0 || 0;
  const p1Count = planSpec.functions.filter(f => f.priority === 'P1').length ||
    manifest.stats?.p1 || 0;

  lines.push(`${'─'.repeat(40)}`);
  lines.push(`[摘要] 共 ${fnCount} 個函式 | P0: ${p0Count} | P1: ${p1Count}`);
  lines.push(`${'='.repeat(60)}\n`);

  return lines.join('\n');
}

function checkApiContractReadiness(target, iteration, story, manifest, planContent = '') {
  const apiFns = (manifest?.functions || []).filter(fn =>
    API_SURFACE_TYPES.has(String(fn.type || fn.actionType || '').toUpperCase())
  );

  if (apiFns.length === 0 && planContent) {
    const fallbackFns = [];
    const lines = String(planContent).split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
      if (cells.length < 4) continue;
      const maybeType = String(cells[2] || '').toUpperCase();
      const maybePriority = String(cells[3] || '').toUpperCase();
      const maybeName = String(cells[1] || '').replace(/`/g, '').trim();
      if (!API_SURFACE_TYPES.has(maybeType)) continue;
      if (!/^P[0-3]$/.test(maybePriority)) continue;
      if (!/^\w+$/.test(maybeName)) continue;
      fallbackFns.push({
        name: maybeName,
        priority: maybePriority,
        type: maybeType,
        signature: ''
      });
    }
    if (fallbackFns.length > 0) {
      apiFns.push(...fallbackFns);
    }
  }

  if (apiFns.length === 0) {
    return { verdict: 'SKIP', summary: 'no API surface in story manifest' };
  }

  const planPath = path.join(target, `.gems/iterations/${iteration}/plan/implementation_plan_${story}.md`);
  const sigMissing = apiFns
    .filter(fn => !fn.signature || !String(fn.signature).trim())
    .map(fn => fn.name);

  if (sigMissing.length > 0) {
    return {
      verdict: 'BLOCKER',
      summary: `API surface 缺少簽名 (${sigMissing.length})`,
      targetFile: planPath,
      details: [
        'Phase 1 只做輕量 API readiness gate。',
        'API/SVC/HTTP 類型的 story 必須在 plan manifest 提供 signature，讓後續 SCAN/VERIFY 可收斂。'
      ].join('\n'),
      missing: sigMissing.map(name => `${name} 缺少 signature`),
      tasks: sigMissing.map(name => ({
        action: 'ADD_API_SIGNATURE',
        file: planPath,
        expected: `${name} 補上 signature，例如 functionName(param: Type): ReturnType`
      }))
    };
  }

  const contractPath = path.join(target, `.gems/iterations/${iteration}/contract_${iteration}.ts`);
  if (!fs.existsSync(contractPath)) {
    return {
      verdict: 'BLOCKER',
      summary: 'API story 缺少 contract file',
      targetFile: contractPath,
      details: 'API/SVC/HTTP story 在 Phase 1 必須有 story-scoped contract surface，否則後續整合檢查只能後置補救。',
      missing: [`${story} 缺少 contract_${iteration}.ts`],
      tasks: [{
        action: 'ADD_CONTRACT_FILE',
        file: contractPath,
        expected: `至少加入 ${story} 的 // @CONTRACT: Xxx | P0/P1 | API/SVC/HTTP | ${story}`
      }]
    };
  }

  const contractContent = fs.readFileSync(contractPath, 'utf8');
  const hasFrontendOnlyMarker = /No GAS API changes|frontend-only|frontend only/i.test(contractContent);
  const storyScopedContracts = [...contractContent.matchAll(
    /\/\/\s*@CONTRACT:\s*([^|]+)\|\s*P[0-3]\s*\|\s*([^|]+)\|\s*(Story-[\d.]+)/g
  )]
    .map(m => ({ name: m[1].trim(), type: m[2].trim().toUpperCase(), storyId: m[3].trim() }))
    .filter(m => m.storyId === story && API_SURFACE_TYPES.has(m.type));

  if (hasFrontendOnlyMarker && storyScopedContracts.length === 0) {
    return {
      verdict: 'BLOCKER',
      summary: 'API story 被標成 frontend-only / no API changes',
      targetFile: contractPath,
      details: '目前 story manifest 含 API/SVC/HTTP 類型，但 contract 宣告為 frontend-only 或 no API changes，規格不一致。',
      missing: [`${story} contract 宣告與 plan manifest 不一致`],
      tasks: [{
        action: 'ALIGN_CONTRACT_SURFACE',
        file: contractPath,
        expected: `移除 frontend-only/no API changes，並加入 ${story} 的 API/SVC/HTTP @CONTRACT block`
      }]
    };
  }

  if (storyScopedContracts.length === 0) {
    return {
      verdict: 'BLOCKER',
      summary: 'API story 缺少 story-scoped API contract surface',
      targetFile: contractPath,
      details: [
        'Phase 1 只要求存在性，不要求完整 integration。',
        `但 ${story} 的 plan manifest 已含 API/SVC/HTTP 類型，contract 至少要有對應的 @CONTRACT block。`
      ].join('\n'),
      missing: apiFns.map(fn => `${fn.name} 需要 story-scoped API/SVC/HTTP contract`),
      tasks: apiFns.map(fn => ({
        action: 'ADD_API_CONTRACT',
        file: contractPath,
        expected: `加入 // @CONTRACT: ${fn.name} | ${fn.priority || 'P1'} | ${String(fn.type || fn.actionType || 'API').toUpperCase()} | ${story}`
      }))
    };
  }

  return { verdict: 'PASS', summary: `${storyScopedContracts.length} API contract surfaces found` };
}

/**
 * Foundation Story auto-scaffold
 * 自動建立標準目錄骨架，避免 Phase 1 因缺目錄而 BLOCK
 * 只建立空目錄（不建檔案），不覆蓋已存在的目錄
 */
function autoScaffoldFoundation(target, srcDir, projectType, manifest) {
  const created = [];

  // v7.1: display 用相對於 target 的路徑，而非 hardcode src/
  const relSrc = path.relative(target, srcDir).replace(/\\/g, '/') || 'src';

  // 必要分層（所有專案）
  const requiredDirs = ['config', 'shared', 'modules'];
  for (const dir of requiredDirs) {
    const fullPath = path.join(srcDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      created.push(`${relSrc}/${dir}/`);
    }
  }

  // 偵測前端：有 .tsx/.jsx 或 index.html → 建 assets
  const hasFrontend = detectHasFrontend(target, srcDir);
  if (hasFrontend) {
    const assetsPath = path.join(srcDir, 'assets');
    if (!fs.existsSync(assetsPath)) {
      fs.mkdirSync(assetsPath, { recursive: true });
      created.push(`${relSrc}/assets/`);
    }
  }

  // 偵測路由需求 → 建 routes
  const hasRouting = detectHasRouting(target, srcDir);
  if (hasRouting) {
    const routesPath = path.join(srcDir, 'routes');
    if (!fs.existsSync(routesPath)) {
      fs.mkdirSync(routesPath, { recursive: true });
      created.push(`${relSrc}/routes/`);
    }
  }

  // 從 manifest 推導需要的模組目錄（只建空目錄）
  if (manifest && manifest.hasManifest) {
    for (const fn of manifest.functions) {
      if (fn.file) {
        const dir = path.dirname(path.join(target, fn.file));
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          created.push(path.relative(target, dir) + '/');
        }
      }
    }
  }

  return { created };
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

module.exports = { run, checkApiContractReadiness };
