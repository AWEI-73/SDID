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
const { detectProjectType, getGreenfieldGuide, getSrcDir } = require('../../lib/shared/project-type.cjs');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { createErrorHandler, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorOutput, anchorPass, anchorError, anchorErrorSpec, anchorTemplatePending, emitTaskBlock, emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
// v2.0: 引入前端規格提取函式
const { extractFrontendSpecs } = require('../../tools/quality-check/poc-quality-checker.cjs');
const { getNextCmd, getRetryCmd, getPassCmd } = require('../../lib/shared/next-command-helper.cjs');
// v3.0: 引入 Plan 標籤規格提取函式
const { extractPlanSpec, extractFunctionManifest, getStoryContext } = require('../../lib/plan/plan-spec-extractor.cjs');
// P0.8: Plan Schema 驗證
const { validatePlan } = require('../../lib/plan/plan-validator.cjs');

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
    const errorSummary = planValidation.errors.map(e => `[${e.rule}] ${e.message}`).join('; ');
    emitBlock({
      scope: `BUILD Phase 1 | ${story}`,
      summary: `Plan Schema 驗證失敗 (${planValidation.errors.length} 個錯誤)`,
      detail: errorSummary,
      nextCmd: `修正 ${path.relative(process.cwd(), planFile)} 後重跑: node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story} --target=${relativeTarget}`
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
  }

  // 偵測專案類型
  const projectInfo = detectProjectType(target);
  const { type: projectType, config: typeConfig, isGreenfield } = projectInfo;
  const srcDir = getSrcDir(target, projectType);

  const content = fs.readFileSync(planFile, 'utf8');
  const items = extractItems(content);

  // v3.0: 從 Plan 提取標籤規格
  const planSpec = extractPlanSpec(planFile);
  const manifest = extractFunctionManifest(planFile);
  const storyContext = getStoryContext(planFile);
  const planSpecsBlock = generatePlanSpecsBlock(planSpec, manifest, story);

  // 判斷是 Story-1.0 還是後續模組
  const storyMatch = story.match(/Story-(\d+)\.(\d+)/);
  const storyX = storyMatch ? parseInt(storyMatch[1]) : 1;
  const storyY = storyMatch ? parseInt(storyMatch[2]) : 0;
  const isFoundation = storyX === 1 && storyY === 0;

  // ========================================
  // 🔍 VSC 垂直切片完整性檢查 (v1.0)
  // Task-Pipe 版本：從 Plan 函式清單掃描類型
  // Feature Story (X.Y, Y > 0) 必須有 ROUTE 類型
  // ========================================
  if (!isFoundation) {
    // 從 manifest 的函式清單中，取得所有動作類型
    const allTypes = new Set(
      (manifest || []).map(fn => (fn.type || fn.actionType || '').toUpperCase())
    );

    // 也從 Plan 內容掃描 GEMS-FLOW 或 type 欄位
    const planContent = fs.readFileSync(planFile, 'utf8');
    const typeMatches = planContent.match(/\|\s*(ROUTE|SVC|API|HOOK|UI|DATA|CONST)\s*\|/gi) || [];
    typeMatches.forEach(m => {
      const t = m.replace(/\|/g, '').trim().toUpperCase();
      allTypes.add(t);
    });

    const missingVSC = [];
    if (!allTypes.has('ROUTE')) {
      missingVSC.push('ROUTE (使用者進入點 — 路由路徑或頁面元件)');
    }
    if (!allTypes.has('SVC') && !allTypes.has('API')) {
      missingVSC.push('SVC 或 API (業務邏輯層)');
    }
    const hasFrontend = allTypes.has('UI') || allTypes.has('HOOK');
    if (hasFrontend && !allTypes.has('UI')) {
      missingVSC.push('UI (前端展示層)');
    }

    if (missingVSC.length > 0) {
      emitBlock({
        scope: `BUILD Phase 1 | ${story}`,
        summary: `垂直切片不完整 (VSC-002): 缺少 ${missingVSC.join(' | ')}`,
        detail: [
          '每個 Feature Story 必須包含完整的垂直切片，使用者才能實際看到並使用該功能。',
          '請在 implementation_plan 中補充缺少的層次動作：',
          ...missingVSC.map(m => `  - ${m}`),
          '',
          '範例：在動作表格加入 | 頁面路由 | ROUTE | TimerPage | P1 | LOAD→RENDER→BIND |'
        ].join('\n'),
        nextCmd: `修正 implementation_plan_${story}.md 後重跑: node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story} --target=${relativeTarget}`
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
  }
  // ========================================
  // VSC 檢查結束
  // ========================================

  // v2.0: 前端規格 block（提前宣告避免 TDZ）
  let frontendSpecsBlock = '';

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

        // 提取並產生 frontendSpecsBlock 用於報錯時提供更多上下文
        const pocContent = fs.readFileSync(pocPath, 'utf8');
        const frontendSpecs = extractFrontendSpecs(pocContent);
        if (frontendSpecs.hasFrontendSpecs) {
          frontendSpecsBlock = generateFrontendSpecsBlock(frontendSpecs);
        }

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

  // v2.0: 從 POC 提取前端規格（補充提取，若 Foundation 區塊未處理）
  if (!frontendSpecsBlock) {
    const pocDirV2 = path.join(target, `.gems/iterations/${iteration}/poc`);
    if (fs.existsSync(pocDirV2)) {
      const pocFilesV2 = fs.readdirSync(pocDirV2);
      const pocFileV2 = pocFilesV2.find(f => f.includes('POC') && (f.endsWith('.html') || f.endsWith('.tsx')));
      if (pocFileV2) {
        const pocContent = fs.readFileSync(path.join(pocDirV2, pocFileV2), 'utf8');
        const frontendSpecs = extractFrontendSpecs(pocContent);

        if (frontendSpecs.hasFrontendSpecs) {
          frontendSpecsBlock = generateFrontendSpecsBlock(frontendSpecs);
        }
      }
    }
  }


  // 綠地專案：顯示初始化指引
  if (isGreenfield) {
    const guide = getGreenfieldGuide(projectType);

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
        frontendSpecsBlock ? '🔒 遵守 POC 定義的前端規格 (見下方 FRONTEND_SPECS)' : null,
        planSpecsBlock ? '📝 參考 PLAN_SPECS 區塊，直接複製 GEMS 標籤到源碼' : null
      ].filter(Boolean),
      // v2.0: 前端規格區塊 (如果存在)
      frontendSpecs: frontendSpecsBlock || null,
      // v3.0: Plan 標籤規格區塊
      planSpecs: planSpecsBlock || null,
      task: [
        `讀取 ${planFile}（PLAN 階段已確定技術棧與檔案結構）`,
        isFoundation ? '初始化橫向分層結構（依 PLAN 定義）' : '建立模組垂直分片結構（依 PLAN 定義）',
        '依序實作每個 Item 的功能程式碼',
        '加入 GEMS 標籤（參考 PLAN_SPECS 區塊，直接複製貼上）',
        projectType !== 'gas' ? '執行 getDiagnostics() 確認 0 errors' : 'GAS 專案略過型別檢查',
        isFoundation ? '⚠️ 只建立 Plan 定義的檔案，禁止預建後續 Story 的模組目錄或檔案' : null,
        isFoundation ? '⚠️ src/modules/ 只建空目錄，不要在裡面建任何子模組' : null
      ].filter(Boolean),
      output: getNextCmd('BUILD', '1', { story, level })
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-1',
      story
    });

    return { verdict: 'PENDING', items, projectType, isGreenfield: true };
  }

  // 棕地專案：檢查現有源碼
  const srcFiles = findSourceFiles(srcDir, typeConfig.extensions);

  if (srcFiles.length > 0) {
    // Story-1.0 需要額外檢查橫向分層與環境設定
    const checks = isFoundation
      ? validateModule0Structure(target, srcDir, projectType)
      : validatePhase1(srcFiles);
    const failed = checks.filter(c => !c.pass);

    if (failed.length === 0) {
      // v3.1: Story-1.0 範圍檢查 - 偵測 Plan 外的多餘檔案
      if (isFoundation && manifest.hasManifest) {
        const extraFiles = detectExtraFiles(srcDir, manifest, typeConfig.extensions);
        if (extraFiles.length > 0) {
          const iterNum = parseInt(iteration.replace('iter-', ''));
          const retryCmd = getRetryCmd('BUILD', '1', { story });
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

      // v2.5: 前端規格對齊驗證 (CSS-LOCK + UI-BIND)
      const specAlignResult = validateFrontendSpecAlignment(target, iteration, srcDir);
      if (specAlignResult.length > 0) {
        const specFailed = specAlignResult.filter(c => !c.pass);
        if (specFailed.length > 0) {
          emitFix({
            scope: `BUILD Phase 1 | ${story}`,
            summary: '前端規格對齊失敗 (CSS-LOCK / UI-BIND)',
            targetFile: 'src/',
            missing: specFailed.map(c => c.name),
            nextCmd: '請根據 requirement_spec 中定義的前端規格修正以下問題'
          }, {
            projectRoot: target,
            iteration: parseInt(iteration.replace('iter-', '')),
            phase: 'build',
            step: 'phase-1',
            story
          });
          return { verdict: 'PENDING', reason: 'frontend_spec_mismatch', failed: specFailed };
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

      emitPass({
        scope: 'BUILD Phase 1',
        summary: `${srcFiles.length} 個源碼檔案 | ${projectType} | ${isFoundation ? 'Module 0' : 'Module N'}`,
        nextCmd: getNextCmd('BUILD', '1', { story, level })
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
      const retryCmd = getRetryCmd('BUILD', '1', { story });

      if (errorHandler.shouldBlock()) {
        // 達到重試上限 - 仍然用指令式輸出，但標記為 BLOCKER
        const tasks = failed.map(c => {
          const taskInfo = mapCheckToTask(c, target, srcDir, planFile, story);
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
        const taskInfo = mapCheckToTask(c, target, srcDir, planFile, story);
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
      frontendSpecsBlock ? '🔒 遵守 POC 定義的前端規格 (見下方 FRONTEND_SPECS)' : null,
      planSpecsBlock ? '📝 參考 PLAN_SPECS 區塊，直接複製 GEMS 標籤到源碼' : null
    ].filter(Boolean),
    // v2.0: 前端規格區塊 (如果存在)
    frontendSpecs: frontendSpecsBlock || null,
    // v3.0: Plan 標籤規格區塊
    planSpecs: planSpecsBlock || null,
    task: [
      `讀取 ${planFile}（參考 PLAN Step 2.5 架構審查結果與語言要求）`,
      '檢查並建立環境 (package.json, tsconfig.json) 若不存在',
      '依序實作每個 Item 的功能程式碼',
      '加入 GEMS 標籤（參考 PLAN_SPECS 區塊，直接複製貼上）',
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
    output: getNextCmd('BUILD', '1', { story, level })
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
      file: 'src/config/',
      expected: 'src/config/index.ts exporting app config',
      reference: `${relPlan} → Config Layer`
    };
  }
  if (name.includes('Shared')) {
    return {
      action: 'CREATE_DIR_WITH_SUBDIRS',
      file: 'src/shared/',
      expected: 'src/shared/index.ts + subdirs (types/, storage/, utils/)',
      reference: `${relPlan} → Shared Layer`
    };
  }
  if (name.includes('Modules')) {
    return {
      action: 'CREATE_DIR',
      file: 'src/modules/',
      expected: 'Empty modules container directory',
      reference: `${relPlan} → Modules Layer`
    };
  }
  if (name.includes('Assets')) {
    return {
      action: 'CREATE_DIR',
      file: 'src/assets/',
      expected: 'Static assets directory',
      reference: relPlan
    };
  }
  if (name.includes('Routes')) {
    return {
      action: 'CREATE_DIR_WITH_INDEX',
      file: 'src/routes/',
      expected: 'src/routes/index.ts with route definitions',
      reference: relPlan
    };
  }
  if (name.includes('Shared 子目錄')) {
    return {
      action: 'CREATE_SUBDIRS',
      file: 'src/shared/',
      expected: 'At least 1 subdirectory (types/ or storage/ or utils/)',
      reference: `${relPlan} → Shared Layer items`
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

  // 必要目錄（所有專案）
  const checks = [
    { name: '專案設定 (package.json)', pass: fs.existsSync(path.join(target, 'package.json')) },
    { name: 'Config Layer', pass: fs.existsSync(path.join(srcDir, 'config')) },
    { name: 'Shared Layer', pass: fs.existsSync(path.join(srcDir, 'shared')) },
    { name: 'Modules Layer', pass: fs.existsSync(path.join(srcDir, 'modules')) },
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
  const sharedDir = path.join(srcDir, 'shared');
  if (fs.existsSync(sharedDir)) {
    const sharedSubs = fs.readdirSync(sharedDir).filter(f => {
      const fullPath = path.join(sharedDir, f);
      return fs.statSync(fullPath).isDirectory();
    });
    checks.push({
      name: 'Shared 子目錄',
      pass: sharedSubs.length >= 1  // 至少有一個子目錄
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
function detectExtraFiles(srcDir, manifest, extensions) {
  const extraFiles = [];

  // 收集 Plan 定義的檔案路徑（正規化）
  const plannedPaths = new Set();
  for (const fn of manifest.functions) {
    if (fn.file) {
      // 正規化：移除開頭的 src/ 或 ./src/
      const norm = fn.file.replace(/^\.?\/?(src\/)?/, 'src/').replace(/\\/g, '/');
      plannedPaths.add(norm);
    }
  }

  // 如果 Plan 沒有定義任何檔案路徑，跳過檢查（避免誤判）
  if (plannedPaths.size === 0) return extraFiles;

  // 掃描 src/shared/ 和 src/config/ 下的檔案
  const checkDirs = ['shared', 'config'].map(d => path.join(srcDir, d));

  for (const dir of checkDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = findSourceFilesFlat(dir, extensions);

    for (const file of files) {
      // 取得相對於專案根目錄的路徑
      const projectRoot = path.dirname(srcDir);
      const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');

      // 跳過測試檔案
      if (relPath.includes('__tests__') || relPath.includes('.test.') || relPath.includes('.spec.')) continue;

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
 * v2.5: 前端規格對齊驗證
 * 從 requirement_spec 讀取 @GEMS-CSS-LOCK 和 @GEMS-UI-BIND
 * 然後去實際原始碼中比對，確認值有對齊
 */
function validateFrontendSpecAlignment(target, iteration, srcDir) {
  const results = [];

  // 1. 找 requirement_spec（先找當前迭代，沒有就往前迭代找）
  let specPath = path.join(target, `.gems/iterations/${iteration}/poc/requirement_spec_${iteration}.md`);
  if (!fs.existsSync(specPath)) {
    // Fallback：往前面的迭代找（POC spec 通常在 iter-1）
    const iterNum = parseInt(iteration.replace('iter-', ''));
    for (let i = iterNum - 1; i >= 1; i--) {
      const fallbackPath = path.join(target, `.gems/iterations/iter-${i}/poc/requirement_spec_iter-${i}.md`);
      if (fs.existsSync(fallbackPath)) {
        specPath = fallbackPath;
        break;
      }
    }
  }
  if (!fs.existsSync(specPath)) return results; // 沒有 spec 就跳過（不阻擋）

  const specContent = fs.readFileSync(specPath, 'utf8');

  // 2. 提取 CSS-LOCK 規格：格式為 `--variable: #value` 或 `--variable: value`
  const cssLockSection = specContent.match(/@GEMS-CSS-LOCK\)?[\s\S]*?(?=###|---|$)/i);
  const cssLocks = [];
  if (cssLockSection) {
    const varMatches = cssLockSection[0].matchAll(/`(--[\w-]+):\s*([^`]+)`/g);
    for (const m of varMatches) {
      cssLocks.push({ variable: m[1].trim(), value: m[2].trim() });
    }
    // 也擷取非反引號格式：圓角: `24px`
    const plainMatches = cssLockSection[0].matchAll(/[：:]\s*`([^`]+)`/g);
    for (const m of plainMatches) {
      const val = m[1].trim();
      if (!val.startsWith('--')) {
        cssLocks.push({ variable: null, value: val });
      }
    }
  }

  // 3. 提取 UI-BIND 規格：格式為 `bindName` -> `dataSource` ...
  const uiBindSection = specContent.match(/@GEMS-UI-BIND\)?[\s\S]*?(?=###|---|$)/i);
  const uiBinds = [];
  if (uiBindSection) {
    const bindMatches = uiBindSection[0].matchAll(/`(\w+)`\s*->\s*`([^`]+)`/g);
    for (const m of bindMatches) {
      uiBinds.push({ name: m[1].trim(), source: m[2].trim() });
    }
  }

  // 如果沒有前端規格，不驗
  if (cssLocks.length === 0 && uiBinds.length === 0) return results;

  // 4. 讀取所有 CSS 檔案內容
  let allCssContent = '';
  const cssFiles = findSourceFilesFlat(target, ['.css']);
  const srcCssFiles = findSourceFilesFlat(srcDir, ['.css']);
  const combinedCss = [...new Set([...cssFiles, ...srcCssFiles])];
  for (const f of combinedCss) {
    try { allCssContent += fs.readFileSync(f, 'utf8') + '\n'; } catch { }
  }

  // 5. 讀取所有 TS/JS 檔案內容
  let allTsContent = '';
  const tsFiles = findSourceFilesFlat(srcDir, ['.ts', '.tsx', '.js', '.jsx']);
  for (const f of tsFiles) {
    try { allTsContent += fs.readFileSync(f, 'utf8') + '\n'; } catch { }
  }

  // 6. 驗證 CSS-LOCK
  for (const lock of cssLocks) {
    if (lock.variable) {
      // 驗證 CSS 變數值：搜尋 --variable: value 或 --variable : value
      const escaped = lock.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`${lock.variable.replace(/[-]/g, '\\-')}\\s*:\\s*${escaped}`);
      const found = pattern.test(allCssContent);
      results.push({
        name: `CSS-LOCK ${lock.variable}`,
        pass: found,
        detail: found
          ? `${lock.variable}: ${lock.value} ✓`
          : `規格要求 ${lock.variable}: ${lock.value}，但 CSS 中未找到此值`
      });
    } else if (lock.value) {
      // 純值驗證（如 24px）
      const found = allCssContent.includes(lock.value);
      results.push({
        name: `CSS-LOCK 值 ${lock.value}`,
        pass: found,
        detail: found
          ? `值 ${lock.value} ✓`
          : `規格要求值 ${lock.value}，但 CSS 中未找到`
      });
    }
  }

  // 7. 驗證 UI-BIND
  const allContent = allTsContent + '\n' + allCssContent;
  for (const bind of uiBinds) {
    // 檢查 source 關鍵字是否出現在源碼中
    const sourceKey = bind.source.split(/\s+/)[0]; // 取第一個關鍵字，如 'flowers'
    const found = allContent.includes(sourceKey);
    results.push({
      name: `UI-BIND ${bind.name}`,
      pass: found,
      detail: found
        ? `${bind.name} -> ${bind.source} ✓`
        : `規格要求 ${bind.name} 綁定到 ${bind.source}，但源碼中未找到 "${sourceKey}"`
    });
  }

  return results;
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
 * v2.0: 生成前端規格區塊 (用於注入到 prompt)
 * 應用 Prompt Repetition 策略強化約束傳遞
 */
function generateFrontendSpecsBlock(frontendSpecs) {
  const lines = [];

  lines.push(`\n${'='.repeat(60)}`);
  lines.push(`🔒 前端規格約束 (BUILD 必須嚴格遵守)`);
  lines.push(`${'='.repeat(60)}\n`);

  // UI Bindings
  if (frontendSpecs.uiBindings.length > 0) {
    lines.push(`### @GEMS-UI-BIND (資料→UI 綁定)`);
    for (const bind of frontendSpecs.uiBindings) {
      lines.push(`- ${bind.property}:${bind.value} → ${bind.selector}${bind.styles ? ` (${bind.styles})` : ''}`);
    }
    lines.push('');
  }

  // CSS Locks
  if (frontendSpecs.cssLocks.length > 0) {
    lines.push(`### @GEMS-CSS-LOCK (鎖定 CSS)`);
    for (const lock of frontendSpecs.cssLocks) {
      lines.push(`- ${lock.component}: ${lock.classes.join(' ')}`);
    }
    lines.push('');
  }

  // Form Specs
  if (frontendSpecs.formSpecs.length > 0) {
    lines.push(`### @GEMS-FORM-SPEC (表單欄位)`);
    for (const spec of frontendSpecs.formSpecs) {
      const required = spec.required.join(', ') || '-';
      const optional = spec.optional.join(', ') || '-';
      lines.push(`- ${spec.module}: Required=[${required}], Optional=[${optional}]`);
    }
    lines.push('');
  }

  // Animations
  if (frontendSpecs.animations.length > 0) {
    lines.push(`### @GEMS-ANIMATION (動畫效果)`);
    for (const anim of frontendSpecs.animations) {
      lines.push(`- ${anim.name}: ${anim.timing}${anim.description ? ` (${anim.description})` : ''}`);
    }
    lines.push('');
  }

  // Prompt Repetition: 重複關鍵約束
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`[REPEAT] 讓我重複一遍關鍵約束：\n`);

  if (frontendSpecs.uiBindings.length > 0) {
    lines.push(`[UI-BIND 重點]`);
    frontendSpecs.uiBindings.slice(0, 3).forEach(bind => {
      lines.push(`  • ${bind.property}:${bind.value} → ${bind.selector}`);
    });
    lines.push('');
  }

  if (frontendSpecs.cssLocks.length > 0) {
    lines.push(`[CSS-LOCK 重點]`);
    frontendSpecs.cssLocks.slice(0, 3).forEach(lock => {
      lines.push(`  • ${lock.component}: ${lock.classes.slice(0, 5).join(' ')}...`);
    });
    lines.push('');
  }

  lines.push(`${'='.repeat(60)}\n`);

  return lines.join('\n');
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
      if (fn.test) {
        lines.push(` * GEMS-TEST: ${fn.test}`);
      } else {
        const testLine = fn.priority === 'P0' ? '✓ Unit | ✓ Integration | ✓ E2E' :
          fn.priority === 'P1' ? '✓ Unit | ✓ Integration | - E2E' :
            '✓ Unit | - Integration | - E2E';
        lines.push(` * GEMS-TEST: ${testLine}`);
      }
      lines.push(` * GEMS-TEST-FILE: ${fn.testFile || '{module}.test.ts'} (內含 describe('${fn.name}'))`);
      lines.push(` */`);
      lines.push('```');
      lines.push('');
    }
  }
  // 如果只有函式清單（表格或簡單 GEMS 標籤）
  else if (manifest.hasManifest && manifest.functions.length > 0) {
    lines.push(`### 📋 函式清單 (需為每個函式加入完整標籤)`);
    lines.push('');
    lines.push('| 函式名稱 | 優先級 | 測試要求 |');
    lines.push('|---------|--------|----------|');

    for (const fn of manifest.functions) {
      const testReq = fn.priority === 'P0' ? 'Unit + Integration + E2E' :
        fn.priority === 'P1' ? 'Unit + Integration' :
          'Unit';
      lines.push(`| \`${fn.name}\` | ${fn.priority} | ${testReq} |`);
    }
    lines.push('');

    // 提供模板範例
    lines.push(`### 📝 標籤模板 (複製並填入每個函式)`);
    lines.push('');
    lines.push('```typescript');
    lines.push(`/**`);
    lines.push(` * GEMS: {函式名稱} | {P0-P3} | ○○ | ({參數})→{回傳} | ${story} | {描述}`);
    lines.push(` * GEMS-FLOW: Step1→Step2→Step3`);
    lines.push(` * GEMS-DEPS: [Type.Name (說明)]`);
    lines.push(` * GEMS-DEPS-RISK: LOW | MEDIUM | HIGH`);
    lines.push(` * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E`);
    lines.push(` * GEMS-TEST-FILE: {module}.test.ts (模組級，內含 describe('函式名稱'))`);
    lines.push(` */`);
    lines.push('// [STEP] Step1 - 步驟描述');
    lines.push('// [STEP] Step2 - 步驟描述');
    lines.push('export function {函式名稱}(...) { ... }');
    lines.push('```');
    lines.push('');
  }

  // 統計資訊
  const fnCount = planSpec.functions.length || manifest.functions.length;
  const p0Count = planSpec.functions.filter(f => f.priority === 'P0').length ||
    manifest.stats?.p0 || 0;
  const p1Count = planSpec.functions.filter(f => f.priority === 'P1').length ||
    manifest.stats?.p1 || 0;

  lines.push(`${'─'.repeat(40)}`);
  lines.push(`[摘要] 共 ${fnCount} 個函式 | P0: ${p0Count} | P1: ${p1Count}`);
  lines.push(`[提醒] P0/P1 函式必須有 [STEP] 錨點對應 GEMS-FLOW`);
  lines.push(`${'='.repeat(60)}\n`);

  return lines.join('\n');
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
