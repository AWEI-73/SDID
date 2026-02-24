#!/usr/bin/env node
/**
 * BUILD Phase 2: 標籤驗收
 * 輸入: 源碼檔案 + implementation plan | 產物: GEMS 標籤合規 + checkpoint
 * 
 * 職責：
 * - [v2.3 新增] 編碼驗證 - 確保檔案為有效 UTF-8 (無 BOM、無亂碼)
 * - 檢查 GEMS 標籤是否存在、格式正確
 * - P0/P1 是否有擴展標籤 (FLOW, DEPS, TEST, TEST-FILE)
 * - 對比 implementation plan 的標籤規格
 * 
 * v2.2 更新：基於函式清單計算覆蓋率（只計算 PLAN 定義的函式）
 * v2.3 更新：加入編碼驗證 gate，避免 PowerShell 編碼災難
 * 
 * 注意：測試檔案是否存在是 Phase 4 的職責
 */
const fs = require('fs');
const path = require('path');

// v2.3: 編碼驗證器
const { scanEncoding, formatResult: formatEncodingResult } = require('../../lib/build/encoding-validator.cjs');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { writeCheckpoint } = require('../../lib/checkpoint.cjs');
const { extractPlanSpec, compareSpecs, getStoryContext, formatStoryContext, extractFunctionManifest, extractFileManifest, compareFilePaths, compareFlowSteps } = require('../../lib/plan/plan-spec-extractor.cjs');
const { detectProjectType, getSrcDir } = require('../../lib/shared/project-type.cjs');
const { createErrorHandler, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorOutput, anchorPass, anchorError, anchorErrorSpec, emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
const { resolveSrcPath } = require('../../lib/shared/src-path-resolver.cjs');
const { getNextCmd, getRetryCmd, getPassCmd } = require('../../lib/shared/next-command-helper.cjs');

// Evolution Blueprint v1.0: 支援 Lite 驗證器（寬鬆版）
// 環境變數 USE_STRICT_VALIDATOR=true 可切回嚴格模式
let scanGemsTags, validateP0P1Compliance;
const liteValidatorPath = path.join(__dirname, '../../lib/scan/gems-validator-lite.cjs');
const gemsScannerPath = path.join(__dirname, '../../lib/gems-scanner.cjs');
const gasScannerPath = path.join(__dirname, '../../lib/gems-scanner-gas.cjs');

// 動態選擇掃描器
function getScannerForProject(projectType) {
  // GAS 專案使用專用掃描器
  if (projectType === 'gas' && fs.existsSync(gasScannerPath)) {
    const gasScanner = require(gasScannerPath);
    console.log('[Phase 4] 使用 gems-scanner-gas (GAS 專用)');
    return {
      scanGemsTags: gasScanner.scanGemsTags,
      validateP0P1Compliance: gasScanner.validateP0P1Compliance
    };
  }

  // Evolution Blueprint: 預設使用寬鬆驗證器
  const useStrict = process.env.USE_STRICT_VALIDATOR === 'true';
  if (!useStrict && fs.existsSync(liteValidatorPath)) {
    const liteValidator = require(liteValidatorPath);
    console.log('[Phase 4] 使用 gems-validator-lite (寬鬆版 - Evolution Blueprint)');
    return {
      scanGemsTags: liteValidator.scanGemsTagsLite,
      validateP0P1Compliance: (functions) => {
        // 使用 Lite 版的合規性檢查
        const issues = [];
        for (const fn of functions) {
          if (!fn.compliant && fn.issues) {
            for (const issue of fn.issues) {
              if (issue.severity === 'ERROR') {
                issues.push({
                  fn: fn.name,
                  priority: fn.priority,
                  issue: issue.msg,
                  severity: issue.severity
                });
              }
            }
          }
        }
        return issues;
      }
    };
  }

  if (false && fs.existsSync(gemsScannerPath)) {
    const gemsScanner = require(gemsScannerPath);
    console.log('[Phase 4] 使用 gems-scanner (AST 版本)');

    return {
      scanGemsTags: (srcDir) => {
        const files = gemsScanner.scanDirectory(srcDir);
        const result = {
          functions: [],
          stats: { total: 0, tagged: 0, p0: 0, p1: 0, p2: 0, p3: 0 }
        };

        for (const file of files) {
          const parsed = gemsScanner.parseFile(file);
          for (const fn of parsed.functions) {
            result.stats.total++;
            if (fn.hasGEMSTag && fn.gemsTags.basic) {
              result.stats.tagged++;
              const priority = fn.gemsTags.basic.riskLevel?.toLowerCase() || 'p3';
              result.stats[priority]++;

              result.functions.push({
                name: fn.name,
                file: parsed.file,
                line: fn.lineNumber,
                priority: fn.gemsTags.basic.riskLevel,
                status: fn.gemsTags.basic.status,
                signature: fn.gemsTags.basic.signature,
                storyId: fn.gemsTags.basic.storyId,
                description: fn.gemsTags.basic.description,
                flow: fn.gemsTags.flow,
                deps: fn.gemsTags.deps,
                depsRisk: fn.gemsTags.depsRisk,
                test: fn.gemsTags.test,
                testFile: fn.gemsTags.testFile,
                fraudIssues: []
              });
            }
          }
        }
        return result;
      },
      validateP0P1Compliance: (functions) => {
        const issues = [];
        for (const fn of functions) {
          if (fn.priority === 'P0' || fn.priority === 'P1') {
            if (!fn.flow) issues.push({ fn: fn.name, priority: fn.priority, issue: '缺少 GEMS-FLOW' });
            if (!fn.test) issues.push({ fn: fn.name, priority: fn.priority, issue: '缺少 GEMS-TEST' });
            if (!fn.testFile) issues.push({ fn: fn.name, priority: fn.priority, issue: '缺少 GEMS-TEST-FILE' });
            if (fn.priority === 'P0' && !fn.depsRisk) {
              issues.push({ fn: fn.name, priority: fn.priority, issue: '缺少 GEMS-DEPS-RISK' });
            }
          }
        }
        return issues;
      }
    };
  }

  // Fallback 到 gems-validator（Regex 版本）
  const validator = require('../../lib/scan/gems-validator.cjs');
  console.log('[Phase 4] 使用 gems-validator (Regex 版本)');
  return {
    scanGemsTags: validator.scanGemsTags,
    validateP0P1Compliance: validator.validateP0P1Compliance
  };
}

function run(options) {

  console.log(getSimpleHeader('BUILD', 'Phase 2'));

  const { target, iteration = 'iter-1', story, level = 'M' } = options;
  // 計算相對路徑（用於輸出指令，避免絕對路徑問題）
  const relativeTarget = path.relative(process.cwd(), target) || '.';


  // 初始化錯誤處理器
  const errorHandler = createErrorHandler('BUILD', 'phase-2', story);

  // 門控規格 - 告訴 AI 這個 phase 會檢查什麼
  const gateSpec = {
    checks: [
      { name: '標籤覆蓋率', pattern: '>=80%', desc: '至少 80% 函式有 GEMS 標籤' },
      { name: 'P0/P1 擴展標籤', pattern: 'GEMS-FLOW, GEMS-DEPS, GEMS-TEST', desc: 'P0/P1 必須有完整標籤' },
      { name: 'GEMS-TEST-FILE', pattern: '{module}.test.ts', desc: '測試檔案路徑' },
      { name: 'Plan 函式清單', pattern: 'implementation_plan 定義的函式', desc: '與 Plan 一致' },
      { name: 'STUB-001 空骨架偵測', pattern: 'P0 函式體非空', desc: 'P0 函式不得為空骨架（return []/{}、// TODO、throw not implemented）' }
    ]
  };

  if (!story) {
    emitFix({
      scope: 'BUILD Phase 2',
      summary: '缺少 --story 參數',
      targetFile: 'CLI 參數',
      missing: ['--story 參數'],
      example: `node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-1.0 --target=${relativeTarget}`,
      nextCmd: 'node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-X.Y',
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      phase: 'build',
      step: 'phase-2',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  const { type: projectType } = detectProjectType(target);
  const srcPath = resolveSrcPath(target, projectType);

  if (!fs.existsSync(srcPath)) {
    emitFix({
      scope: `BUILD Phase 2 | ${story}`,
      summary: '源碼目錄不存在',
      targetFile: srcPath,
      missing: ['源碼目錄'],
      example: `# 請先完成 Phase 1 建立源碼骨架
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story} --target=${relativeTarget}

# 或手動建立目錄:
mkdir -p src/modules src/shared src/config`,
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story}`,
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-2',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  // ============================================
  // v2.3: 編碼驗證 Gate - 在掃描標籤前先確保檔案編碼正確
  // 避免 PowerShell Get-Content/Set-Content 造成的編碼災難
  // ============================================
  const encodingResult = scanEncoding(srcPath);
  
  if (encodingResult.issues.length > 0) {
    // 編碼問題 = BLOCKER，必須先修復
    const encodingReport = formatEncodingResult(encodingResult, target);
    
    // 存檔到 logs
    const { saveLog } = require('../../lib/shared/log-output.cjs');
    const logPath = saveLog({
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-2',
      story,
      type: 'encoding-error',
      content: encodingReport
    });
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ❌ ENCODING VALIDATION FAILED');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  掃描: ${encodingResult.scanned} 檔案 | 問題: ${encodingResult.issues.length} 檔案`);
    console.log('');
    encodingResult.issues.slice(0, 5).forEach(issue => {
      const relPath = path.relative(target, issue.filePath);
      console.log(`  ❌ ${relPath}`);
      if (issue.hasBom) console.log(`     └─ UTF-8 BOM (需移除)`);
      if (issue.hasCorruption) console.log(`     └─ ${issue.corruptionType}`);
    });
    if (encodingResult.issues.length > 5) {
      console.log(`  ...還有 ${encodingResult.issues.length - 5} 個檔案有問題`);
    }
    console.log('');
    console.log('  📋 修復方式:');
    console.log('     1. node task-pipe/tools/safe-replace.cjs <file> <content>');
    console.log('     2. 在編輯器中另存為 UTF-8 (無 BOM)');
    console.log('');
    console.log('  🚫 禁止使用:');
    console.log('     - PowerShell Get-Content / Set-Content');
    console.log('     - 任何可能改變編碼的批量替換');
    console.log('');
    console.log(`  詳情: ${logPath}`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`修復後重跑: ${getRetryCmd('BUILD', '2', { story })}`);
    
    return { 
      verdict: 'BLOCKER', 
      reason: 'encoding_validation_failed',
      encodingResult 
    };
  }
  
  console.log(`[INFO] 編碼驗證: ✓ ${encodingResult.scanned} 檔案全部通過`);

  // 動態選擇掃描器 (根據專案類型)
  const scanner = getScannerForProject(projectType);
  scanGemsTags = scanner.scanGemsTags;
  validateP0P1Compliance = scanner.validateP0P1Compliance;

  // 掃描標籤
  const scanResult = scanGemsTags(srcPath);
  const planPath = path.join(target, `.gems/iterations/${iteration}/plan/implementation_plan_${story}.md`);
  const planSpec = extractPlanSpec(planPath);
  const storyContext = getStoryContext(planPath);

  // v2.2: 提取函式清單
  const manifest = extractFunctionManifest(planPath);

  // 對比規格
  const codeSpec = { functions: scanResult.functions };
  const comparison = compareSpecs(planSpec, codeSpec);

  // P0/P1 合規性檢查
  const complianceIssues = validateP0P1Compliance(scanResult.functions)
    .filter(issue => !issue.issue.includes('測試檔案'));

  // ============================================
  // v2.4: 檔案路徑比對 (File Path Validation)
  // 從 Plan 提取預期檔案路徑，與實際掃描結果交叉比對
  // 路徑不對 = BLOCKER，引導 AI 移動到正確位置
  // ============================================
  const fileManifest = extractFileManifest(planPath);
  let filePathIssues = { matched: [], misplaced: [], missing: [] };

  if (fileManifest.hasManifest) {
    filePathIssues = compareFilePaths(fileManifest, scanResult, target);

    if (filePathIssues.misplaced.length > 0 || filePathIssues.missing.length > 0) {
      const totalIssues = filePathIssues.misplaced.length + filePathIssues.missing.length;

      // 產生修復指引
      const taskLines = [];
      let taskNum = 0;

      for (const mp of filePathIssues.misplaced) {
        taskNum++;
        taskLines.push(`@TASK-${taskNum}`);
        taskLines.push(`  ACTION: MOVE_FILE`);
        taskLines.push(`  FROM: ${mp.actualPath}`);
        taskLines.push(`  TO: ${mp.expectedPath}`);
        taskLines.push(`  FUNCTION: ${mp.functionName}`);
        taskLines.push(`  EXPECTED: 將檔案移動到 Plan 定義的正確路徑`);
        taskLines.push('');
      }

      for (const ms of filePathIssues.missing) {
        taskNum++;
        taskLines.push(`@TASK-${taskNum}`);
        taskLines.push(`  ACTION: CREATE_FILE`);
        taskLines.push(`  FILE: ${ms.expectedPath}`);
        taskLines.push(`  FUNCTION: ${ms.functionName}`);
        taskLines.push(`  REASON: ${ms.reason}`);
        taskLines.push('');
      }

      // 存 log
      const { saveLog } = require('../../lib/shared/log-output.cjs');
      saveLog({
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'build',
        step: 'phase-2',
        story,
        type: 'filepath-error',
        content: [
          '@CONTEXT',
          `Phase 2 | ${story} | 檔案路徑不符 Plan 定義`,
          '',
          `@FILE_PATH_MISMATCH`,
          `  Plan 定義: ${fileManifest.files.length} 個檔案`,
          `  路徑正確: ${filePathIssues.matched.length}`,
          `  路徑錯誤: ${filePathIssues.misplaced.length}`,
          `  檔案缺失: ${filePathIssues.missing.length}`,
          '',
          ...taskLines
        ].join('\n')
      });

      // 輸出 BLOCKER
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`@BLOCKER | ${totalIssues} file path issue(s)`);
      console.log(`@CONTEXT: Phase 2 | ${story} | 檔案路徑不符 Plan 定義`);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');

      if (filePathIssues.misplaced.length > 0) {
        console.log('@FILE_PATH_MISMATCH (路徑錯誤)');
        for (const mp of filePathIssues.misplaced) {
          console.log(`  ❌ ${mp.functionName}`);
          console.log(`     Plan 定義: ${mp.expectedPath}`);
          console.log(`     實際位置: ${mp.actualPath}`);
        }
        console.log('');
      }

      if (filePathIssues.missing.length > 0) {
        console.log('@FILE_MISSING (檔案缺失)');
        for (const ms of filePathIssues.missing) {
          console.log(`  ❌ ${ms.functionName}`);
          console.log(`     Plan 定義: ${ms.expectedPath}`);
          console.log(`     原因: ${ms.reason}`);
        }
        console.log('');
      }

      // 印出修復 TASK
      console.log(taskLines.join('\n'));

      console.log(`@NEXT_COMMAND`);
      console.log(`  ${getRetryCmd('BUILD', '2', { story })}`);
      console.log('');
      console.log('@FORBIDDEN');
      console.log('  🚫 禁止自行決定檔案路徑，必須使用 Plan 定義的路徑');
      console.log('  🚫 禁止在錯誤路徑上補標籤來繞過檢查');
      console.log('  ✅ 移動檔案到 Plan 定義的正確路徑');
      console.log('  ✅ 如果檔案不存在，在正確路徑建立');
      console.log('═══════════════════════════════════════════════════════════');

      return {
        verdict: 'BLOCKER',
        reason: 'file_path_mismatch',
        filePathIssues,
        fileManifest
      };
    }

    // 路徑全部正確，印出確認
    console.log(`[INFO] 檔案路徑比對: ✓ ${filePathIssues.matched.length} 個檔案路徑正確`);
  }

  // ============================================
  // v2.5: FLOW↔STEP 一致性檢查
  // Plan 定義的 GEMS-FLOW 和 [STEP] 錨點必須與實際程式碼一致
  // 不一致 = BLOCKER，引導 AI 複製 Plan 的正確標籤
  // ============================================
  const flowStepResult = compareFlowSteps(planPath, scanResult);

  if (flowStepResult.mismatched.length > 0) {
    const totalIssues = flowStepResult.mismatched.length;

    // 產生修復指引
    const taskLines = [];
    let taskNum = 0;

    for (const mm of flowStepResult.mismatched) {
      taskNum++;
      taskLines.push(`@TASK-${taskNum}`);
      taskLines.push(`  ACTION: FIX_FLOW_STEP`);
      taskLines.push(`  FUNCTION: ${mm.functionName}`);

      for (const issue of mm.issues) {
        if (issue.type === 'FLOW_MISMATCH') {
          taskLines.push(`  FIX_GEMS_FLOW:`);
          taskLines.push(`    ❌ 目前: GEMS-FLOW: ${issue.actual}`);
          taskLines.push(`    ✅ 正確: GEMS-FLOW: ${issue.plan}`);
        }
        if (issue.type === 'STEP_MISMATCH' || issue.type === 'STEP_MISSING') {
          taskLines.push(`  FIX_STEP_ANCHORS:`);
          if (issue.actual.length > 0) {
            taskLines.push(`    ❌ 目前: ${issue.actual.map(s => `// [STEP] ${s}`).join(', ')}`);
          }
          taskLines.push(`    ✅ 正確:`);
          for (const step of issue.plan) {
            taskLines.push(`      // [STEP] ${step}`);
          }
        }
        if (issue.type === 'STEP_STACKED') {
          taskLines.push(`  FIX_STEP_PLACEMENT:`);
          taskLines.push(`    ❌ 問題: ${issue.stackedSteps.length} 個 [STEP] 錨點堆疊在一起 (連續 ${issue.maxConsecutive} 個)`);
          taskLines.push(`    ❌ 堆疊的 STEP: ${issue.stackedSteps.join(', ')}`);
          taskLines.push(`    ✅ 正確做法: 每個 // [STEP] 錨點必須放在對應程式碼區塊的上方`);
          taskLines.push(`    ✅ 範例:`);
          taskLines.push(`      // [STEP] INIT_MAP`);
          taskLines.push(`      private data = new Map();`);
          taskLines.push(`      `);
          taskLines.push(`      // [STEP] GET_ALL`);
          taskLines.push(`      getAll() { ... }`);
          taskLines.push(`      `);
          taskLines.push(`      // [STEP] CREATE`);
          taskLines.push(`      create(item) { ... }`);
        }
      }
      taskLines.push('');
    }

    // 存 log
    const { saveLog: saveFlowLog } = require('../../lib/shared/log-output.cjs');
    saveFlowLog({
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-2',
      story,
      type: 'flow-step-error',
      content: [
        '@CONTEXT',
        `Phase 2 | ${story} | FLOW↔STEP 不符 Plan 定義`,
        '',
        `@FLOW_STEP_MISMATCH`,
        `  Plan 定義: ${flowStepResult.matched.length + flowStepResult.mismatched.length} 個函式有 FLOW`,
        `  FLOW 正確: ${flowStepResult.matched.length}`,
        `  FLOW 不符: ${flowStepResult.mismatched.length}`,
        '',
        ...taskLines
      ].join('\n')
    });

    // 輸出 BLOCKER
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`@BLOCKER | ${totalIssues} FLOW/STEP mismatch(es)`);
    console.log(`@CONTEXT: Phase 2 | ${story} | FLOW↔STEP 不符 Plan 定義`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    for (const mm of flowStepResult.mismatched) {
      console.log(`  ❌ ${mm.functionName}`);
      for (const issue of mm.issues) {
        if (issue.type === 'FLOW_MISMATCH') {
          console.log(`     GEMS-FLOW 不符:`);
          console.log(`       Plan: ${issue.plan}`);
          console.log(`       實際: ${issue.actual}`);
        }
        if (issue.type === 'STEP_MISMATCH' || issue.type === 'STEP_MISSING') {
          console.log(`     [STEP] 錨點不符:`);
          console.log(`       Plan: ${issue.plan.join(', ')}`);
          console.log(`       實際: ${issue.actual.length > 0 ? issue.actual.join(', ') : '(無)'}`);
        }
        if (issue.type === 'STEP_STACKED') {
          console.log(`     [STEP] 錨點堆疊:`);
          console.log(`       ${issue.stackedSteps.length} 個 STEP 連續堆在一起，沒有散佈到程式碼旁`);
          console.log(`       堆疊: ${issue.stackedSteps.join(', ')}`);
          console.log(`       ✅ 每個 [STEP] 應放在對應程式碼區塊的正上方`);
        }
      }
    }
    console.log('');

    // 印出修復 TASK
    console.log(taskLines.join('\n'));

    console.log(`@NEXT_COMMAND`);
    console.log(`  ${getRetryCmd('BUILD', '2', { story })}`);
    console.log('');
    console.log('@FORBIDDEN');
    console.log('  🚫 禁止自行發明 FLOW 步驟名稱，必須使用 Plan 定義的 FLOW');
    console.log('  🚫 禁止省略 [STEP] 錨點，每個 FLOW 步驟都要有對應的 [STEP]');
    console.log('  🚫 禁止把 [STEP] 錨點堆在一起，每個 [STEP] 必須放在對應程式碼旁');
    console.log('  ✅ 直接複製 Plan 的 GEMS-FLOW 和 [STEP] 錨點到程式碼');
    console.log('  ✅ 每個 // [STEP] XXX 放在該步驟實際程式碼的正上方');
    console.log('═══════════════════════════════════════════════════════════');

    return {
      verdict: 'BLOCKER',
      reason: 'flow_step_mismatch',
      flowStepResult
    };
  }

  if (flowStepResult.matched.length > 0) {
    console.log(`[INFO] FLOW↔STEP 比對: ✓ ${flowStepResult.matched.length} 個函式 FLOW/STEP 正確`);
  }

  // ============================================
  // v2.2: 基於函式清單計算覆蓋率
  // ============================================
  let coverage, coverageMode, plannedFunctions, taggedPlannedFns, extraFunctions;

  if (manifest.hasManifest && manifest.functions.length > 0) {
    // 模式 1: 基於函式清單計算
    coverageMode = 'manifest';
    plannedFunctions = manifest.functions.map(f => f.name.toLowerCase());

    // 找出已標籤的計劃函式
    taggedPlannedFns = scanResult.functions.filter(f =>
      plannedFunctions.includes(f.name.toLowerCase())
    );

    // 找出額外的 helper 函式（不計入覆蓋率）
    extraFunctions = scanResult.functions.filter(f =>
      !plannedFunctions.includes(f.name.toLowerCase())
    );

    // 計算覆蓋率（只看計劃中的函式）
    coverage = manifest.functions.length > 0
      ? Math.round((taggedPlannedFns.length / manifest.functions.length) * 100)
      : 100;

    console.log(`[INFO] 覆蓋率模式: 基於函式清單 (${manifest.source})`);
    console.log(`   計劃函式: ${manifest.functions.length} 個 | 已實作: ${taggedPlannedFns.length} 個`);
    if (extraFunctions.length > 0) {
      console.log(`   額外函式: ${extraFunctions.length} 個 (helper/utility，不計入覆蓋率)`);
    }
  } else {
    // 模式 2: Fallback 到原有邏輯（向後相容）
    coverageMode = 'total';
    coverage = scanResult.stats.total > 0
      ? Math.round((scanResult.stats.tagged / scanResult.stats.total) * 100)
      : 0;

    console.log(`[INFO] 覆蓋率模式: 全部函式 (無函式清單)`);
    console.log(`   總函式: ${scanResult.stats.total} 個 | 已標籤: ${scanResult.stats.tagged} 個`);
  }

  const passed = coverage >= 80 && complianceIssues.length === 0 && comparison.missing.length === 0;

  // 覆蓋率過低 = 使用 TACTICAL_FIX 機制（標籤格式容易錯，給 3 次機會）
  if (coverage < 80) {
    const missingFns = coverageMode === 'manifest'
      ? manifest.functions.filter(pf =>
        !scanResult.functions.find(cf => cf.name.toLowerCase() === pf.name.toLowerCase())
      )
      : [];

    // 產生可直接複製的標籤範例 (Evolution Blueprint: 使用 gems-fixer 生成精確內容)
    const { generateGemsBlock, findFunctionSpec } = require('../../lib/auto-fixer/gems-fixer.cjs');

    // 尋找 Plan 目錄
    const planDir = path.join(target, `.gems/iterations/${iteration}/plan`);

    const tagExamples = missingFns.slice(0, 3).map(fn => {
      // 1. 嘗試從 Plan 找精確規格
      const spec = findFunctionSpec(fn.name, planDir);

      if (spec) {
        // 2. 如果找到，生成精確的 GEMS 區塊
        return generateGemsBlock(spec);
      } else {
        // 3. 沒找到 (Fallback)，使用通用模板
        const priority = fn.priority || 'P2';
        const status = priority === 'P0' || priority === 'P1' ? '○○' : '○';
        return `/**
 * GEMS: ${fn.name} | ${priority} | ${status} | (args)→Result | ${story} | ${fn.description || 'TODO: 描述'}
 * GEMS-FLOW: Step1→Step2→Step3
 * GEMS-DEPS: [Type.Name (說明)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: {module}.test.ts (模組級，內含 describe('${fn.name}'))
 */`;
      }
    }).join('\n\n');

    const missingListText = missingFns.length > 0
      ? `缺失函式 (共 ${missingFns.length} 個):\n${missingFns.slice(0, 5).map(f => `- ${f.name} (${f.priority})${f.file ? ` → ${f.file}` : ''}`).join('\n')}${missingFns.length > 5 ? `\n...還有 ${missingFns.length - 5} 個` : ''}`
      : '';

    // TACTICAL_FIX 機制：追蹤失敗次數
    const attempt = errorHandler.recordError('E6', `覆蓋率不足 (${coverage}%)`);

    // 檢查是否達到重試上限
    if (errorHandler.shouldBlock()) {
      emitBlock({
        scope: `BUILD Phase 2 | ${story}`,
        summary: `標籤覆蓋率需要進一步完善 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS}) | 覆蓋率: ${coverage}%`,
        nextCmd: '建議：架構師協作，確認 GEMS 標籤格式',
        details: `覆蓋率: ${coverage}% (需 >=80%)\n掃描目錄: ${srcPath}\n\n${missingListText}`
      }, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'build',
        step: 'phase-2',
        story
      });
      return {
        verdict: 'BLOCKER',
        reason: 'tactical_fix_limit',
        attempts: MAX_ATTEMPTS,
        coverage,
        coverageMode,
        manifest,
        stats: scanResult.stats
      };
    }

    // 還有重試機會
    const recoveryLevel = errorHandler.getRecoveryLevel();

    anchorOutput({
      context: `Phase 2 | ${story} | 標籤覆蓋率不足`,
      info: {
        '覆蓋率': `${coverage}% (需 >=80%)`,
        '掃描目錄': srcPath,
        '缺失函式': missingFns.length
      },
      error: {
        type: 'TACTICAL_FIX',
        summary: missingListText,
        attempt,
        maxAttempts: MAX_ATTEMPTS
      },
      template: {
        title: 'GEMS_TAG_TEMPLATE (直接複製貼上，勿自行修改格式)',
        content: tagExamples || `/**
 * GEMS: functionName | P2 | ○ | (args)→Result | ${story} | 描述
 * GEMS-FLOW: Step1→Step2→Step3
 * GEMS-DEPS: [Type.Name (說明)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | - Integration | - E2E
 * GEMS-TEST-FILE: {module}.test.ts (模組級，內含 describe('functionName'))
 */`
      },
      guide: {
        title: 'PRIORITY_GUIDE',
        content: `- P0: 核心邏輯，必須有完整標籤 (FLOW, DEPS, TEST, TEST-FILE)
- P1: 重要功能，必須有基本標籤
- P2/P3: 輔助功能，僅需 GEMS 基本標籤`
      },
      template: {
        title: `RECOVERY_ACTION (Level ${recoveryLevel})`,
        content: recoveryLevel === 1
          ? '直接複製上方模板，貼到對應函式上方'
          : recoveryLevel === 2
            ? '讀取 implementation_plan 確認函式清單，逐一補標籤'
            : '完整分析標籤格式問題，準備人類介入'
      },
      output: `NEXT: 為每個缺失函式加上 GEMS 標籤（直接複製上方模板）\nNEXT: ${getRetryCmd('BUILD', '2', { story })}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-2',
      story
    });

    return {
      verdict: 'PENDING',
      attempt,
      coverage,
      coverageMode,
      manifest,
      stats: scanResult.stats
    };
  }

  // ============================================
  // STUB-001: 空骨架偵測 — 標籤通過但函式體為空
  // 使用 function-index.json 快篩（size ≤ 5），再讀原始碼確認
  // P0 → BLOCKER，P1 → WARN（不阻擋）
  // ============================================
  if (passed) {
    const functionIndexPath = path.join(target, '.gems', 'docs', 'function-index.json');
    if (fs.existsSync(functionIndexPath)) {
      try {
        const fnIndex = JSON.parse(fs.readFileSync(functionIndexPath, 'utf8'));
        const stubViolations = { blockers: [], warns: [] };
        const STUB_PATTERNS = [
          /^\s*return\s*\[\s*\]\s*[;,]?\s*$/m,
          /^\s*return\s*\{\s*\}\s*[;,]?\s*$/m,
          /^\s*return\s*null\s*[;,]?\s*$/m,
          /^\s*return\s*undefined\s*[;,]?\s*$/m,
          /^\s*\/\/\s*TODO/mi,
          /throw\s+new\s+Error\s*\(\s*['"`]not\s+implemented/mi,
          /throw\s+new\s+Error\s*\(\s*['"`]stub/mi,
        ];

        for (const [filePath, functions] of Object.entries(fnIndex.byFile || {})) {
          for (const fn of functions) {
            const lines = fn.lines || '';
            if (!lines) continue;
            const [startLine, endLine] = lines.split('-').map(Number);
            const size = endLine - startLine;
            if (size > 5) continue; // 超過 5 行不是 stub 嫌疑

            // 讀原始碼確認
            const absPath = path.isAbsolute(filePath)
              ? filePath
              : path.join(target, filePath.replace(/^[A-Za-z]:\\.*?\\src\\/, 'src/').replace(/\\/g, '/'));
            const resolvedPath = fs.existsSync(absPath) ? absPath : path.join(target, 'src', path.basename(filePath));

            if (!fs.existsSync(resolvedPath)) continue;

            const fileContent = fs.readFileSync(resolvedPath, 'utf8');
            const fileLines = fileContent.split('\n');
            const fnBody = fileLines.slice(Math.max(0, startLine - 1), endLine).join('\n');

            // 排除純 GEMS 標籤行（// [STEP:N]）
            const nonTagLines = fnBody.split('\n').filter(l =>
              l.trim() && !/^\s*\/\/\s*\[STEP/.test(l) && !/^\s*\/\*/.test(l) && !/^\s*\*/.test(l)
            );
            if (nonTagLines.length <= 2) {
              // 幾乎只有標籤，判定為 stub
              const isStub = STUB_PATTERNS.some(p => p.test(fnBody)) || nonTagLines.length <= 1;
              if (!isStub) continue;

              const priority = fn.priority || 'P2';
              const entry = `${fn.name} (${priority}, ${size} 行, ${path.basename(filePath)})`;
              if (priority === 'P0') stubViolations.blockers.push(entry);
              else if (priority === 'P1') stubViolations.warns.push(entry);
            }
          }
        }

        if (stubViolations.blockers.length > 0) {
          const attempt = errorHandler.recordError('STUB-001', `P0 空骨架: ${stubViolations.blockers.join(', ')}`);
          emitBlock({
            scope: `BUILD Phase 2 | ${story}`,
            summary: `STUB-001: ${stubViolations.blockers.length} 個 P0 函式為空骨架，標籤通過但無實作`,
            nextCmd: '補充 P0 函式的商業邏輯實作',
            details: `P0 空骨架（必須修復）:\n${stubViolations.blockers.map(s => `  - ${s}`).join('\n')}${stubViolations.warns.length > 0 ? `\n\nP1 空骨架（建議修復）:\n${stubViolations.warns.map(s => `  - ${s}`).join('\n')}` : ''}\n\n偵測標準: size ≤ 5 行 且含 return []/{}、// TODO 或 throw new Error('not implemented')`
          }, {
            projectRoot: target,
            iteration: parseInt(iteration.replace('iter-', '')),
            phase: 'build',
            step: 'phase-2',
            story
          });
          return { verdict: 'BLOCKER', reason: 'STUB-001', stubViolations };
        }

        if (stubViolations.warns.length > 0) {
          console.log(`\n  ⚠ STUB-001 WARNING: ${stubViolations.warns.length} 個 P1 函式疑似空骨架（不阻擋）:`);
          stubViolations.warns.forEach(w => console.log(`    - ${w}`));
        }
      } catch (e) {
        // function-index.json 解析失敗，跳過 STUB 檢查（向後相容）
        console.log(`  [STUB-001] function-index.json 讀取失敗，跳過空骨架偵測: ${e.message}`);
      }
    }
  }

  // 通過
  if (passed) {
    // 成功時重置 TACTICAL_FIX 計數
    errorHandler.resetAttempts();

    writeCheckpoint(target, iteration, story, '2', {
      verdict: 'PASS',
      coverage,
      coverageMode,
      manifestStats: manifest.hasManifest ? manifest.stats : null,
      stats: scanResult.stats
    });

    const manifestInfo = manifest.hasManifest
      ? ` | 函式清單: ${manifest.stats.total} (P0:${manifest.stats.p0} P1:${manifest.stats.p1})`
      : '';

    emitPass({
      scope: 'BUILD Phase 2',
      summary: `覆蓋率: ${coverage}% (${coverageMode}) | P0: ${scanResult.stats.p0} | P1: ${scanResult.stats.p1}${manifestInfo}`,
      nextCmd: getNextCmd('BUILD', '2', { story, level })
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-2',
      story
    });
    return { verdict: 'PASS', coverage, coverageMode, manifest };
  }

  // 錯誤摘要
  const errors = [];
  if (complianceIssues.length > 0) {
    const grouped = {};
    complianceIssues.forEach(i => { grouped[i.issue] = (grouped[i.issue] || 0) + 1; });
    Object.entries(grouped).forEach(([issue, count]) => errors.push(`${issue}: ${count}個`));
  }
  if (comparison.missing.length > 0) {
    errors.push(`未實作: ${comparison.missing.map(m => m.name).slice(0, 3).join(', ')}${comparison.missing.length > 3 ? '...' : ''}`);
  }

  // 需修正的檔案
  const filesToFix = [...new Set(complianceIssues.map(i => {
    const fn = scanResult.functions.find(f => f.name === i.fn);
    return fn ? fn.file : null;
  }).filter(Boolean))];

  // TACTICAL_FIX 機制：追蹤失敗次數
  const attempt = errorHandler.recordError('E6', errors.join('; '));

  // 檢查是否達到重試上限
  if (errorHandler.shouldBlock()) {
    emitBlock({
      scope: `BUILD Phase 2 | ${story}`,
      summary: `標籤驗收需要進一步完善 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS}) | 覆蓋率: ${coverage}%`,
      nextCmd: '建議：架構師協作，檢查 GEMS 標籤正確性',
      details: `覆蓋率: ${coverage}% (${coverageMode})\n\n錯誤摘要:\n${errors.map(e => `- ${e}`).join('\n')}\n\n需修正檔案:\n${filesToFix.slice(0, 5).map(f => `- ${f}`).join('\n')}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-2',
      story
    });
    return {
      verdict: 'BLOCKER',
      reason: 'tactical_fix_limit',
      attempts: MAX_ATTEMPTS,
      scanResult,
      comparison,
      complianceIssues,
      coverage,
      coverageMode,
      manifest
    };
  }

  // 還有重試機會
  const recoveryLevel = errorHandler.getRecoveryLevel();

  const fixGuide = recoveryLevel === 1
    ? '參考 GEMS 標籤模板，為每個函式加上標籤'
    : recoveryLevel === 2
      ? '讀取 implementation_plan 確認函式清單\n對照源碼逐一檢查標籤'
      : '完整分析錯誤根本原因\n考慮是否需要回到 PLAN 階段調整';

  anchorOutput({
    context: `Phase 2 | ${story} | 標籤驗收失敗`,
    info: {
      '覆蓋率': `${coverage}% (${coverageMode})`,
      '錯誤數': errors.length,
      '需修正檔案': filesToFix.length
    },
    error: {
      type: 'TACTICAL_FIX',
      summary: errors.join('\n'),
      attempt,
      maxAttempts: MAX_ATTEMPTS
    },
    template: {
      title: `修正指引 (Level ${recoveryLevel})`,
      content: fixGuide
    },
    output: `NEXT: 補充缺失的 GEMS 標籤\nNEXT: ${getRetryCmd('BUILD', '2', { story })}`
  }, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'build',
    step: 'phase-2',
    story
  });

  return { verdict: 'PENDING', attempt, scanResult, comparison, complianceIssues, coverage, coverageMode, manifest };
}

module.exports = { run };
