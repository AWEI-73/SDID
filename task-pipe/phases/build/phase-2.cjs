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
const { createErrorHandler, handlePhaseSuccess, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorOutput, anchorPass, anchorError, anchorErrorSpec, emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
const { resolveSrcPath } = require('../../lib/shared/src-path-resolver.cjs');
const { getNextCmd, getRetryCmd, getPassCmd } = require('../../lib/shared/next-command-helper.cjs');

// Evolution Blueprint v1.0: 支援 Lite 驗證器（寬鬆版）
// 環境變數 USE_STRICT_VALIDATOR=true 可切回嚴格模式
let scanGemsTags, validateP0P1Compliance;
const liteValidatorPath = path.join(__dirname, '../../lib/scan/gems-validator-lite.cjs');
const gemsScannerPath = path.join(__dirname, '../../lib/gems-scanner.cjs');
const gasScannerPath = path.join(__dirname, '../../lib/gems-scanner-gas.cjs');
// v2.6: AST 精確掃描路徑（統一入口）
const scannerV2Path = path.join(__dirname, '../../lib/scan/gems-scanner-unified.cjs');

// ─────────────────────────────────────────────────────────────────────────
// v2.6: AST 輔助函式
// ─────────────────────────────────────────────────────────────────────────

/**
 * 為未標籤函式生成 GEMS 標籤模板
 * @param {string} funcName  - 函式名稱
 * @param {number} startLine - 函式起始行號
 * @param {number} endLine   - 函式結束行號
 * @param {string} filePath  - 檔案路徑（用來推斷 Domain）
 * @param {string} story     - Story ID（如 Story-1.0）
 * @returns {{ newFmt: string, fullFmt: string }}
 */
function buildTagTemplate(funcName, startLine, endLine, filePath, story) {
  // 從檔案名推斷 Domain (storage.ts → Storage, main.ts → Main)
  const base = path.basename(filePath, path.extname(filePath));
  const domain = base.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
                     .replace(/^./, c => c.toUpperCase());
  const lineRef = (endLine && endLine > startLine) ? `L${startLine}-${endLine}` : `L${startLine}`;

  // 新格式 (單行 inline，P2 預設)
  const newFmt = `// @GEMS [P2] ${domain}.${funcName} | FLOW: Step1→Execute→Return | ${lineRef}`;

  // 完整格式 (P0/P1 用，JSDoc 多行)
  const fullFmt = [
    `/**`,
    ` * GEMS: ${funcName} | P0 | ○○ | (args)→Result | ${story || 'Story-X.Y'} | TODO: 描述`,
    ` * GEMS-FLOW: ValidateInput→Execute→Return`,
    ` * GEMS-DEPS: [Internal.Dependency (說明)]`,
    ` * GEMS-DEPS-RISK: LOW`,
    ` * GEMS-TEST: ✓ Unit | - Integration | - E2E`,
    ` * GEMS-TEST-FILE: {module}.test.ts`,
    ` */`,
  ].join('\n');

  return { newFmt, fullFmt };
}

/**
 * v2.6: gems-scanner-v2 AST 適配器
 * 將 scanV2() 輸出對應至 phase-2 期望格式，並附帶未標籤函式的精確位置
 */
function getScannerV2Adapter(projectRoot) {
  const { scanV2 } = require(scannerV2Path);
  return {
    isV2: true,
    scanGemsTags: (srcDir) => {
      const r = scanV2(srcDir, projectRoot);

      // 對應至 phase-2 原有格式（加 line = startLine 相容性欄位）
      const functions = r.functions.map(f => ({
        name:       f.name,
        file:       f.file,
        line:       f.startLine,    // phase-2 其他地方使用 f.line
        startLine:  f.startLine,
        endLine:    f.endLine,
        priority:   f.priority,
        flow:       f.flow,
        deps:       f.deps,
        depsRisk:   f.depsRisk,
        test:       f.test,
        testFile:   f.testFile,
        description: f.description,
        gemsId:     f.gemsId,
        dictBacked: f.dictBacked,
        phase2Mode: f.phase2Mode,
        fraudIssues: []
      }));

      return {
        functions,
        untagged: r.untagged,   // [{ name, file, line }] ← 精確 AST 位置！
        stats: {
          total:   r.stats.totalScanned,
          tagged:  r.stats.tagged,
          untagged: r.stats.untaggedCount,
          p0: r.stats.P0 || 0,
          p1: r.stats.P1 || 0,
          p2: r.stats.P2 || 0,
          p3: r.stats.P3 || 0,
        }
      };
    },
    validateP0P1Compliance: (functions) => {
      const issues = [];
      for (const fn of functions) {
        if (fn.priority !== 'P0' && fn.priority !== 'P1') continue;
        // 每個 issue 附帶 file + line 精確位置
        if (!fn.flow)    issues.push({ fn: fn.name, file: fn.file, line: fn.line, priority: fn.priority, issue: '缺少 GEMS-FLOW' });
        if (!fn.test)    issues.push({ fn: fn.name, file: fn.file, line: fn.line, priority: fn.priority, issue: '缺少 GEMS-TEST' });
        if (!fn.testFile)issues.push({ fn: fn.name, file: fn.file, line: fn.line, priority: fn.priority, issue: '缺少 GEMS-TEST-FILE' });
        if (fn.priority === 'P0' && !fn.depsRisk)
          issues.push({ fn: fn.name, file: fn.file, line: fn.line, priority: fn.priority, issue: '缺少 GEMS-DEPS-RISK' });
      }
      return issues;
    }
  };
}

// 動態選擇掃描器
function getScannerForProject(projectType, projectRoot) {
  // v2.6: AST-based scanner — 最優先（提供 file:line 精確定位）
  if (fs.existsSync(scannerV2Path)) {
    try {
      console.log('[Phase 2] 使用 gems-scanner-v2 (AST 精確掃描 + 未標籤定位)');
      return getScannerV2Adapter(projectRoot);
    } catch (e) {
      console.log(`[Phase 2] gems-scanner-v2 載入失敗，退回舊版掃描器: ${e.message}`);
    }
  }

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
    console.log(`修復後重跑: ${getRetryCmd('BUILD', '2', { story, target: relativeTarget, iteration })}`);
    
    return { 
      verdict: 'BLOCKER', 
      reason: 'encoding_validation_failed',
      encodingResult 
    };
  }
  
  console.log(`[INFO] 編碼驗證: ✓ ${encodingResult.scanned} 檔案全部通過`);

  // 動態選擇掃描器 (根據專案類型，傳入 target 讓 v2 能載入正確 TypeScript)
  const scanner = getScannerForProject(projectType, target);
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
      const fpLogPath = saveLog({
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

      console.log(`@LOG: ${fpLogPath}`);
      console.log(`@NEXT_COMMAND`);
      console.log(`  ${getRetryCmd('BUILD', '2', { story, target: relativeTarget, iteration })}`);
      console.log('');
      console.log('@FORBIDDEN 🚫 禁止自行決定路徑 | 🚫 禁止補標籤繞過檢查 | ✅ 移到 Plan 定義的正確路徑');
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
          taskLines.push(`    ❌ 問題: ${issue.stackedSteps.length} 個 [STEP] 錨點連續堆疊，沒有程式碼夾在中間`);
          taskLines.push(`    ❌ 堆疊的 STEP: ${issue.stackedSteps.map(s => `// [STEP] ${s}`).join('  ')}`);
          taskLines.push(`    `);
          taskLines.push(`    📋 修復步驟:`);
          taskLines.push(`      1. 打開 ${mm.functionName} 所在的檔案`);
          taskLines.push(`      2. 逐行檢視每個 // [STEP] 錨點下方是否有對應的程式碼`);
          taskLines.push(`      3. 如果多個 [STEP] 連在一起沒有程式碼，把每個 [STEP] 移到它對應的程式碼區塊正上方`);
          taskLines.push(`    `);
          taskLines.push(`    ❌ BEFORE (錯誤 — 堆疊):`);
          taskLines.push(`      // [STEP] ${issue.stackedSteps[0] || 'STEP_A'}`);
          taskLines.push(`      // [STEP] ${issue.stackedSteps[1] || 'STEP_B'}`);
          taskLines.push(`      // [STEP] ${issue.stackedSteps[2] || 'STEP_C'}`);
          taskLines.push(`      doStepA(); doStepB(); doStepC();  // 所有程式碼擠在最後`);
          taskLines.push(`    `);
          taskLines.push(`    ✅ AFTER (正確 — 分散):`);
          taskLines.push(`      // [STEP] ${issue.stackedSteps[0] || 'STEP_A'}`);
          taskLines.push(`      doStepA();`);
          taskLines.push(`      `);
          taskLines.push(`      // [STEP] ${issue.stackedSteps[1] || 'STEP_B'}`);
          taskLines.push(`      doStepB();`);
          taskLines.push(`      `);
          taskLines.push(`      // [STEP] ${issue.stackedSteps[2] || 'STEP_C'}`);
          taskLines.push(`      doStepC();`);
        }
      }
      taskLines.push('');
    }

    // 存 log
    const { saveLog: saveFlowLog } = require('../../lib/shared/log-output.cjs');
    const flowLogPath = saveFlowLog({
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
          console.log(`     [STEP] 錨點堆疊 (必須修復):`);
          console.log(`       ❌ ${issue.stackedSteps.length} 個 STEP 連續堆在一起，沒有程式碼夾在中間`);
          console.log(`       堆疊: ${issue.stackedSteps.map(s => `// [STEP] ${s}`).join('  ')}`);
          console.log(`       `);
          console.log(`       📋 修復: 打開該函式，逐行把每個 [STEP] 移到它對應程式碼的正上方`);
          console.log(`       ❌ BEFORE: // [STEP] A  // [STEP] B  doA(); doB();`);
          console.log(`       ✅ AFTER:  // [STEP] A  doA();  // [STEP] B  doB();`);
        }
      }
    }
    console.log('');

    // 印出修復 TASK
    console.log(taskLines.join('\n'));

    console.log(`@LOG: ${flowLogPath}`);
    console.log(`@NEXT_COMMAND`);
    console.log(`  ${getRetryCmd('BUILD', '2', { story, target: relativeTarget, iteration })}`);
    console.log('');
    console.log('@FORBIDDEN 🚫 禁止自行發明 FLOW 名稱 | 🚫 禁止省略/堆疊 [STEP] 錨點 | ✅ 直接複製 Plan 的 FLOW，每個 [STEP] 放在對應程式碼正上方');
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
  // v2.7: 骨架比對 — 契約函式標籤鎖死 + 新增函式 Priority 規則
  // 骨架由 draft-to-plan 預生成，標籤是機械生成的「規格」
  // 契約函式（骨架生成的）標籤不能被 AI 篡改
  // 新增函式（AI 自由新增的）必須有標籤，Priority 只能是 P3
  // ============================================
  const scaffoldDir = path.join(target, 'src');
  const scaffoldManifest = manifest.hasManifest ? manifest.functions : [];

  if (scaffoldManifest.length > 0) {
    const scaffoldIssues = { tampered: [], missingTag: [], wrongPriority: [] };

    for (const planned of scaffoldManifest) {
      const actualFn = scanResult.functions.find(
        f => f.name.toLowerCase() === planned.name.toLowerCase()
      );
      if (!actualFn) continue; // 缺失函式由覆蓋率檢查處理

      // 契約函式：Priority 不能被改
      if (planned.priority && actualFn.priority &&
          planned.priority !== actualFn.priority) {
        scaffoldIssues.tampered.push({
          name: planned.name,
          file: actualFn.file,
          line: actualFn.startLine || actualFn.line,
          expected: planned.priority,
          actual: actualFn.priority
        });
      }
    }

    // 新增函式（不在 manifest 中）：必須有標籤，Priority 只能是 P3
    const extraFunctions = scanResult.functions.filter(f =>
      !scaffoldManifest.find(p => p.name.toLowerCase() === f.name.toLowerCase())
    );

    for (const extra of extraFunctions) {
      if (!extra.priority) {
        scaffoldIssues.missingTag.push({
          name: extra.name,
          file: extra.file,
          line: extra.startLine || extra.line
        });
      } else if (extra.priority !== 'P3') {
        scaffoldIssues.wrongPriority.push({
          name: extra.name,
          file: extra.file,
          line: extra.startLine || extra.line,
          priority: extra.priority
        });
      }
    }

    // 契約函式標籤被篡改 → BLOCKER
    if (scaffoldIssues.tampered.length > 0) {
      const taskLines = scaffoldIssues.tampered.map((t, i) => [
        `@TASK-${i + 1}`,
        `  ACTION: RESTORE_PRIORITY`,
        `  FUNCTION: ${t.name}`,
        `  FILE: ${t.file}:${t.line}`,
        `  FIX: 將 GEMS 標籤的 Priority 從 ${t.actual} 改回 ${t.expected}`,
        `  REASON: 契約函式 Priority 由 draft-to-plan 鎖定，不能修改`,
        ''
      ].join('\n')).join('\n');

      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`@BLOCKER | 契約函式標籤被篡改 | ${scaffoldIssues.tampered.length} 個`);
      console.log(`@CONTEXT: Phase 2 | ${story} | 骨架比對`);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');
      console.log(taskLines);
      console.log(`@NEXT_COMMAND`);
      console.log(`  ${getRetryCmd('BUILD', '2', { story, target: relativeTarget, iteration })}`);
      console.log('');
      console.log('@FORBIDDEN 🚫 Priority 由 draft-to-plan 機械生成不能修改 | ✅ 需調整請回藍圖重跑 draft-to-plan');
      console.log('═══════════════════════════════════════════════════════════');

      return { verdict: 'BLOCKER', reason: 'scaffold_tampered', scaffoldIssues };
    }

    // 新增函式 Priority > P3 → WARNING（不阻擋，只提醒）
    if (scaffoldIssues.wrongPriority.length > 0) {
      console.log(`\n  ⚠ 骨架比對 WARNING: ${scaffoldIssues.wrongPriority.length} 個新增函式 Priority 高於 P3（建議回 Plan 補充）:`);
      scaffoldIssues.wrongPriority.forEach(w =>
        console.log(`    - ${w.name} (${w.priority}) → ${w.file}:${w.line}`)
      );
    }

    if (scaffoldManifest.length > 0) {
      const tamperedCount = scaffoldIssues.tampered.length;
      const extraCount = extraFunctions.length;
      console.log(`[INFO] 骨架比對: ✓ 契約函式 ${scaffoldManifest.length} 個${tamperedCount === 0 ? ' (標籤完整)' : ''} | 新增函式 ${extraCount} 個`);
    }
  }


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

    // ─── v2.6: AST 精確位置指引 ────────────────────────────────────────────
    // scanResult.untagged 由 gems-scanner-v2 提供，格式：[{ name, file, line }]
    const astUntagged = scanResult.untagged || [];

    // 為每個未標籤函式生成精確的「哪裡 → 寫什麼」指引
    const astGuideLines = astUntagged.slice(0, 10).map(fn => {
      const { newFmt, fullFmt } = buildTagTemplate(fn.name, fn.line, fn.line + 5, fn.file, story);
      return [
        `  ❌ ${fn.file}:${fn.line}  ${fn.name}`,
        `     └─ 在第 ${fn.line} 行「上方」加入:`,
        `        ${newFmt}`
      ].join('\n');
    });
    const astGuideText = astGuideLines.join('\n\n')
      + (astUntagged.length > 10 ? `\n\n  ...還有 ${astUntagged.length - 10} 個未標籤函式` : '');

    // Fallback（無 AST 時）：舊版 missingFns + gems-fixer 模板
    let tagExamples = '';
    let missingListText = '';
    if (astUntagged.length === 0) {
      const { generateGemsBlock, findFunctionSpec } = require('../../lib/auto-fixer/gems-fixer.cjs');
      const planDir = path.join(target, `.gems/iterations/${iteration}/plan`);
      tagExamples = missingFns.slice(0, 3).map(fn => {
        const spec = findFunctionSpec(fn.name, planDir);
        if (spec) return generateGemsBlock(spec);
        const priority = fn.priority || 'P2';
        const status = priority === 'P0' || priority === 'P1' ? '○○' : '○';
        return `/**\n * GEMS: ${fn.name} | ${priority} | ${status} | (args)→Result | ${story} | ${fn.description || 'TODO: 描述'}\n * GEMS-FLOW: Step1→Step2→Step3\n * GEMS-DEPS: [Type.Name (說明)]\n * GEMS-DEPS-RISK: LOW\n * GEMS-TEST: ✓ Unit | - Integration | - E2E\n * GEMS-TEST-FILE: {module}.test.ts (模組級，內含 describe('${fn.name}'))\n */`;
      }).join('\n\n');
      missingListText = missingFns.length > 0
        ? `缺失函式 (共 ${missingFns.length} 個):\n${missingFns.slice(0, 5).map(f => `- ${f.name} (${f.priority})${f.file ? ` → ${f.file}` : ''}`).join('\n')}${missingFns.length > 5 ? `\n...還有 ${missingFns.length - 5} 個` : ''}`
        : '';
    }

    // TACTICAL_FIX 機制：追蹤失敗次數
    const attempt = errorHandler.recordError('E6', `覆蓋率不足 (${coverage}%)`);

    // 檢查是否達到重試上限
    if (errorHandler.shouldBlock()) {
      emitBlock({
        scope: `BUILD Phase 2 | ${story}`,
        summary: `標籤覆蓋率需要進一步完善 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS}) | 覆蓋率: ${coverage}%`,
        nextCmd: '建議：架構師協作，確認 GEMS 標籤格式',
        details: `覆蓋率: ${coverage}% (需 >=80%)\n掃描目錄: ${srcPath}\n\n${astUntagged.length > 0 ? `未標籤函式 (${astUntagged.length} 個):\n${astGuideText}` : missingListText}`
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

    // 還有重試機會 — 輸出精確位置指引
    const recoveryLevel = errorHandler.getRecoveryLevel();

    // ─── 精確錯誤輸出（直接 console.log，不走 anchorOutput 的通用格式）──
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`@BLOCKER | 覆蓋率不足 (${coverage}%，需 >=80%) | 未標籤函式: ${astUntagged.length || missingFns.length} 個`);
    console.log(`@CONTEXT: Phase 2 | ${story} | 掃描: ${srcPath}`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    if (astUntagged.length > 0) {
      // v2.6: AST 精確定位 — 顯示每個函式的 file:line + 應補的標籤
      console.log('@UNTAGGED_FUNCTIONS (需在函式「上方一行」加入 @GEMS 標籤):');
      console.log('');
      console.log(astGuideText);
      console.log('');
      console.log('@FORMAT_GUIDE:');
      console.log('  新格式 (P2/P3):  // @GEMS [P2] Domain.FuncName | FLOW: Step1→Step2→Return | L{n}-{m}');
      console.log('  完整格式 (P0/P1): JSDoc /** ... */ 含 GEMS-FLOW, GEMS-DEPS, GEMS-TEST, GEMS-TEST-FILE');
      console.log('  P0 必填: GEMS-FLOW, GEMS-DEPS, GEMS-DEPS-RISK, GEMS-TEST, GEMS-TEST-FILE');
    } else {
      // Fallback: 舊版輸出
      if (missingListText) console.log(missingListText);
      if (tagExamples) {
        console.log('');
        console.log('@GEMS_TAG_TEMPLATE (直接複製貼上):');
        console.log(tagExamples);
      }
    }

    console.log('');
    console.log(`@ATTEMPT: ${attempt}/${MAX_ATTEMPTS}`);
    console.log(`@NEXT_COMMAND`);
    console.log(`  ${getRetryCmd('BUILD', '2', { story, target: relativeTarget, iteration })}`);
    console.log('═══════════════════════════════════════════════════════════════');

    // 同時存 log（用 anchorOutput）
    anchorOutput({
      context: `Phase 2 | ${story} | 標籤覆蓋率不足`,
      info: {
        '覆蓋率': `${coverage}% (需 >=80%)`,
        '掃描目錄': srcPath,
        '未標籤函式': astUntagged.length || missingFns.length
      },
      error: {
        type: 'TACTICAL_FIX',
        summary: astUntagged.length > 0
          ? `未標籤函式 (${astUntagged.length} 個):\n${astGuideText}`
          : missingListText || '覆蓋率不足',
        attempt,
        maxAttempts: MAX_ATTEMPTS
      },
      template: {
        title: `RECOVERY_ACTION (Level ${recoveryLevel})`,
        content: recoveryLevel === 1
          ? '直接在上方指定位置加入 @GEMS 標籤（複製上方模板，修改 Domain/FuncName）'
          : recoveryLevel === 2
            ? '讀取 implementation_plan 確認函式清單，對照 @UNTAGGED_FUNCTIONS 逐一補標籤'
            : '完整分析標籤格式問題，準備人類介入'
      },
      output: `NEXT: 為每個 @UNTAGGED_FUNCTIONS 函式在對應行號上方加入 @GEMS 標籤\nNEXT: ${getRetryCmd('BUILD', '2', { story, target: relativeTarget, iteration })}`
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
  // AC↔函式雙向綁定 — Plan 裡的 P0/P1 AC 必須被某個函式的 acIds 引用
  // WARN（不 BLOCKER），因為 AC 可能在測試檔案裡
  // ============================================
  if (passed) {
    try {
      const { extractPlanACs } = require('../../lib/plan/plan-spec-extractor.cjs');
      const planACs = typeof extractPlanACs === 'function' ? extractPlanACs(planPath) : [];
      if (planACs.length > 0) {
        const implementedACs = new Set();
        for (const fn of scanResult.functions) {
          for (const ac of (fn.acIds || [])) implementedACs.add(ac);
        }
        const unimplementedACs = planACs.filter(ac => !implementedACs.has(ac));
        if (unimplementedACs.length > 0) {
          console.log(`\n  ⚠ AC 綁定 WARNING: ${unimplementedACs.length} 個 Plan AC 未被任何函式標籤引用（可能在測試裡）:`);
          unimplementedACs.slice(0, 5).forEach(ac => console.log(`    - ${ac}`));
          if (unimplementedACs.length > 5) console.log(`    ...還有 ${unimplementedACs.length - 5} 個`);
        } else {
          console.log(`[INFO] AC 綁定: ✓ ${planACs.length} 個 AC 全部有函式引用`);
        }
      }
    } catch (e) { /* extractPlanACs 不存在時靜默跳過 */ }
  }

  // ============================================
  // STUB-001: 空骨架偵測 — 標籤通過但函式體為空
  // 使用 function-index.json 快篩（size ≤ 15），再讀原始碼確認
  // 分析 effectiveLines（去掉所有註解 + 函式簽名 + 右括號），避免 STEP 灌水逃脫
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
            if (size > 15) continue; // 超過 15 行不是 stub 嫌疑

            // 讀原始碼確認
            // function-index.json 可能是相對路徑（如 "ExamForge\src\..."）或絕對路徑
            const resolvedPath = path.isAbsolute(filePath)
              ? filePath
              : path.resolve(target, filePath.replace(/\\/g, '/'));

            if (!fs.existsSync(resolvedPath)) continue;

            const fileContent = fs.readFileSync(resolvedPath, 'utf8');
            const fileLines = fileContent.split('\n');
            const fnBody = fileLines.slice(Math.max(0, startLine - 1), endLine).join('\n');

            // effectiveLines: 去掉所有註解、函式簽名、右括號，只留真實邏輯行
            const effectiveLines = fnBody.split('\n').filter(l => {
              const t = l.trim();
              if (!t) return false;
              if (/^\s*\/\//.test(l)) return false;                     // 所有註解（含 STEP、TODO）
              if (/^\s*\/\*/.test(l) || /^\s*\*/.test(l)) return false; // block 註解
              if (/^\s*(export\s+)?(async\s+)?function\s/.test(l)) return false; // 函式簽名
              if (/^\s*\}\s*$/.test(l)) return false;                   // 右括號
              return true;
            });
            if (effectiveLines.length <= 2) {
              // 真實邏輯行極少，判定為 stub
              const isStub = STUB_PATTERNS.some(p => p.test(fnBody)) || effectiveLines.length <= 1;
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
            details: `P0 空骨架（必須修復）:\n${stubViolations.blockers.map(s => `  - ${s}`).join('\n')}${stubViolations.warns.length > 0 ? `\n\nP1 空骨架（建議修復）:\n${stubViolations.warns.map(s => `  - ${s}`).join('\n')}` : ''}\n\n偵測標準: size ≤ 15 行 且去掉註解/簽名後 effectiveLines ≤ 2 且含 return []/{}、// TODO 或 throw new Error('not implemented')`
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
    // 成功時重置 TACTICAL_FIX 計數 + strategy drift 節點
    handlePhaseSuccess('BUILD', 'phase-2', story, target);

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
      nextCmd: getNextCmd('BUILD', '2', { story, level, target: relativeTarget, iteration })
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

  // v2.6: 精確定位 — 每個 issue 附帶 file:line（由 getScannerV2Adapter 的 validateP0P1Compliance 提供）
  const issuesByFn = {};
  for (const i of complianceIssues) {
    const key = i.fn;
    if (!issuesByFn[key]) {
      const fn = scanResult.functions.find(f => f.name === i.fn);
      issuesByFn[key] = {
        fn: i.fn,
        file: i.file || (fn ? fn.file : '?'),
        line: i.line || (fn ? fn.line : '?'),
        priority: i.priority || (fn ? fn.priority : '?'),
        issues: []
      };
    }
    issuesByFn[key].issues.push(i.issue);
  }

  // 精確的「哪個函式 → 在哪行 → 缺什麼 → 補什麼」指引
  const complianceGuides = Object.values(issuesByFn).map(entry => {
    const { newFmt, fullFmt } = buildTagTemplate(entry.fn, entry.line, entry.line + 5, entry.file || '', story);
    const missingFields = entry.issues.map(iss => {
      if (iss === '缺少 GEMS-FLOW')      return ' * GEMS-FLOW: Step1→Step2→Return';
      if (iss === '缺少 GEMS-TEST')      return ' * GEMS-TEST: ✓ Unit | - Integration | - E2E';
      if (iss === '缺少 GEMS-TEST-FILE') return ' * GEMS-TEST-FILE: {module}.test.ts';
      if (iss === '缺少 GEMS-DEPS-RISK') return ' * GEMS-DEPS-RISK: LOW';
      return ` * ${iss}`;
    });
    return [
      `  ❌ ${entry.file}:${entry.line}  ${entry.fn} (${entry.priority})`,
      `     缺少: ${entry.issues.join(', ')}`,
      `     └─ 在 GEMS JSDoc 中補充:`,
      ...missingFields.map(l => `        ${l}`)
    ].join('\n');
  }).join('\n\n');

  // 需修正的檔案
  const filesToFix = [...new Set(Object.values(issuesByFn).map(i => i.file).filter(Boolean))];

  // TACTICAL_FIX 機制：追蹤失敗次數
  const attempt = errorHandler.recordError('E6', errors.join('; '));

  // 檢查是否達到重試上限
  if (errorHandler.shouldBlock()) {
    emitBlock({
      scope: `BUILD Phase 2 | ${story}`,
      summary: `標籤驗收需要進一步完善 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS}) | 覆蓋率: ${coverage}%`,
      nextCmd: '建議：架構師協作，檢查 GEMS 標籤正確性',
      details: `覆蓋率: ${coverage}% (${coverageMode})\n\n錯誤摘要:\n${errors.map(e => `- ${e}`).join('\n')}\n\n@COMPLIANCE_ISSUES (精確位置):\n${complianceGuides || '(無詳細資訊)'}\n\n需修正檔案:\n${filesToFix.slice(0, 5).map(f => `- ${f}`).join('\n')}`
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

  // 還有重試機會 — 精確輸出 compliance 問題
  const recoveryLevel = errorHandler.getRecoveryLevel();

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`@BLOCKER | P0/P1 標籤不完整 | ${complianceIssues.length} 個問題`);
  console.log(`@CONTEXT: Phase 2 | ${story} | 覆蓋率: ${coverage}% (${coverageMode})`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  if (complianceGuides) {
    console.log('@COMPLIANCE_ISSUES (需在對應函式的 GEMS JSDoc 中補充欄位):');
    console.log('');
    console.log(complianceGuides);
    console.log('');
  }

  if (comparison.missing.length > 0) {
    console.log('@MISSING_FUNCTIONS (Plan 定義但源碼未找到):');
    comparison.missing.slice(0, 5).forEach(m => console.log(`  ❌ ${m.name} (${m.priority})`));
    if (comparison.missing.length > 5) console.log(`  ...還有 ${comparison.missing.length - 5} 個`);
    console.log('');
  }

  console.log(`@ATTEMPT: ${attempt}/${MAX_ATTEMPTS}`);
  console.log(`@NEXT_COMMAND`);
  console.log(`  ${getRetryCmd('BUILD', '2', { story, target: relativeTarget, iteration })}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // 存 log
  anchorOutput({
    context: `Phase 2 | ${story} | 標籤驗收失敗`,
    info: {
      '覆蓋率': `${coverage}% (${coverageMode})`,
      '錯誤數': errors.length,
      '需修正檔案': filesToFix.length
    },
    error: {
      type: 'TACTICAL_FIX',
      summary: `${errors.join('\n')}\n\n@COMPLIANCE_ISSUES (精確位置):\n${complianceGuides}`,
      attempt,
      maxAttempts: MAX_ATTEMPTS
    },
    template: {
      title: `修正指引 (Level ${recoveryLevel})`,
      content: recoveryLevel === 1
        ? '直接在 @COMPLIANCE_ISSUES 指定的函式 GEMS JSDoc 中補充缺少的欄位'
        : recoveryLevel === 2
          ? '讀取 implementation_plan 確認 P0/P1 函式清單，對照源碼逐一補齊標籤'
          : '完整分析錯誤根本原因，考慮是否需要回到 PLAN 階段調整'
    },
    output: `NEXT: 補充 @COMPLIANCE_ISSUES 中每個函式缺少的 GEMS 標籤欄位\nNEXT: ${getRetryCmd('BUILD', '2', { story, target: relativeTarget, iteration })}`
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
