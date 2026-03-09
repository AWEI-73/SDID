#!/usr/bin/env node
/**
 * BUILD Phase 3: 測試腳本 v3.0
 * 輸入: 源碼檔案 + contract_iter-N.ts | 產物: 測試檔案 + checkpoint
 *
 * v3.0 變更：純 AC 驅動，廢棄 GEMS-TEST 分組邏輯
 * - 從 contract_iter-N.ts 讀取 @GEMS-AC，決定哪些函式需要 jest 測試
 * - 有 @GEMS-AC → 需要 it('AC-X.Y') jest 測試
 * - 無 @GEMS-AC → skip（由人工 POC 驗收 / Phase 5 直接跳過）
 * - contract 不存在 → 全部 SKIP，PASS（不強制 jest）
 * - GEMS-TEST 標籤保留為文件說明，不再驅動 Phase 3 分組
 *
 * 軍規 3: TDD 100% - 禁止在測試中重寫函式邏輯
 */
const fs = require('fs');
const path = require('path');
const { writeCheckpoint } = require('../../lib/checkpoint.cjs');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { anchorOutput, anchorPass, anchorErrorSpec } = require('../../lib/shared/log-output.cjs');

const { detectProjectType, getSrcDir } = require('../../lib/shared/project-type.cjs');
const { scanGemsTags } = require('../../lib/scan/gems-scanner-unified.cjs');
const { getNextCmd, getRetryCmd } = require('../../lib/shared/next-command-helper.cjs');

// ─────────────────────────────────────────────────────────────
// 讀取 contract AC specs
// ─────────────────────────────────────────────────────────────

/**
 * 嘗試載入 ac-runner 的 parseAcSpecs，讀取 contract_iter-N.ts
 * @returns {AcSpec[]|null} AC specs，或 null（contract 不存在）
 */
function loadAcSpecs(target, iterNum) {
  const contractPath = path.join(
    target, '.gems', 'iterations', `iter-${iterNum}`, 'poc', `contract_iter-${iterNum}.ts`
  );
  if (!fs.existsSync(contractPath)) return null;

  try {
    const acRunnerPath = path.resolve(__dirname, '..', '..', '..', 'sdid-tools', 'ac-runner.cjs');
    const { parseAcSpecs } = require(acRunnerPath);
    const content = fs.readFileSync(contractPath, 'utf8');
    return parseAcSpecs(content);
  } catch (e) {
    return null;
  }
}

/**
 * 產生 AC 驅動的測試指引（注入具體 I/O）
 * @param {object} fn - GEMS 函式資訊
 * @param {AcSpec[]} acSpecs - 所有 AC specs
 * @returns {string} 測試指引文字
 */
function buildAcTestGuide(fn, acSpecs) {
  const fnAcs = acSpecs ? acSpecs.filter(s => s.fn === fn.name) : [];

  if (fnAcs.length === 0) {
    // 無對應 AC：通用約束
    return [
      `函式: ${fn.name} (GEMS-TEST: ${fn.testStrategy || 'jest-unit'})`,
      `  此函式沒有 AC spec，請根據 implementation_plan 的 AC 區塊，`,
      `  用 it('AC-X.Y: [描述]') 格式，包含具體輸入和期望值`,
      `  禁止: toBeDefined() / toBeTruthy() / toBeFalsy() 作為唯一斷言`,
    ].join('\n');
  }

  const lines = [`函式: ${fn.name} (GEMS-TEST: ${fn.testStrategy || 'jest-unit'})`];
  lines.push(`  每個 AC 必須對應一個 it()：`);
  for (const ac of fnAcs) {
    const inputStr = ac.input !== null ? JSON.stringify(ac.input) : '(見 contract)';
    const expectStr = ac.expect !== null ? JSON.stringify(ac.expect) : '(見 contract)';
    lines.push(`  it('${ac.id}: ...', () => {`);
    lines.push(`    const result = ${fn.name}(...${inputStr});`);
    lines.push(`    expect(result).toEqual(${expectStr}); // 精確值，來自 contract`);
    lines.push(`  });`);
  }
  lines.push(`  禁止: toBeDefined() / toBeTruthy() / toBeFalsy() 作為唯一斷言`);
  lines.push(`  禁止: 在測試檔案內重新實作被測函式的邏輯`);
  return lines.join('\n');
}

function run(options) {

  console.log(getSimpleHeader('BUILD', 'Phase 3'));

  const { target, iteration = 'iter-1', story, level = 'M' } = options;
  // 計算相對路徑（用於輸出指令，避免絕對路徑問題）
  const relativeTarget = path.relative(process.cwd(), target) || '.';
  const iterNum = parseInt(iteration.replace('iter-', ''));

  // 門控規格 v3.0 - 告訴 AI 這個 phase 會檢查什麼
  const gateSpec = {
    checks: [
      { name: '有 @GEMS-AC → 需要測試檔', pattern: '*.test.ts', desc: 'contract 有 @GEMS-AC 的函式必須有對應 jest 測試' },
      { name: 'AC 覆蓋', pattern: "it('AC-X.Y')", desc: '每個 @GEMS-AC 必須對應一個 it()' },
      { name: '測試 import', pattern: 'import { fn } from', desc: '測試必須 import 被測函式' },
      { name: '無 @GEMS-AC → SKIP', pattern: 'contract 不存在 → 全部 SKIP', desc: '無 AC spec 的函式不需要 jest，由人工 POC 驗收' }
    ]
  };

  if (!story) {
    anchorErrorSpec({
      targetFile: 'CLI 參數',
      missing: ['--story 參數'],
      example: `node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-1.0 --target=${relativeTarget}`,
      nextCmd: 'node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-X.Y',
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      phase: 'build',
      step: 'phase-3',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  // 偵測專案類型並取得源碼目錄
  const projectInfo = detectProjectType(target);
  const srcPath = getSrcDir(target, projectInfo.type);

  if (!fs.existsSync(srcPath)) {
    anchorErrorSpec({
      targetFile: srcPath,
      missing: ['源碼目錄'],
      example: `# 請先完成 Phase 1 建立源碼骨架
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story} --target=${relativeTarget}`,
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story}`,
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-3',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  // 掃描 GEMS 標籤
  const scanResult = scanGemsTags(srcPath);
  const testFiles = findTestFiles(srcPath);

  // 讀取 AC specs（Task-Pipe contract，Blueprint/POC-FIX 不存在時為 null）
  const acSpecs = loadAcSpecs(target, iterNum);
  if (acSpecs === null) {
    // v3.0: contract 不存在 → 沒有 AC 規格 → 不強制 jest，直接 PASS
    console.log(`[INFO] contract_iter-${iterNum}.ts 不存在，無 AC specs → 跳過 jest 測試指引（all SKIP）`);
    writeCheckpoint(target, iteration, story, '3', {
      verdict: 'PASS',
      reason: 'no-contract-no-ac',
      acSpecs: 0
    });
    anchorPass('BUILD', 'Phase 3',
      `無 contract → 無 @GEMS-AC → 跳過 jest 測試（Phase 5 ac-runner 也會 SKIP）`,
      getNextCmd('BUILD', '3', { story, level, target: relativeTarget, iteration }),
      { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-3', story }
    );
    return { verdict: 'PASS' };
  } else {
    console.log(`[AC] 讀取 contract_iter-${iterNum}.ts，找到 ${acSpecs.length} 個 AC specs`);
  }

  // v3.0: AC 驅動分組 — 以 contract @GEMS-AC 決定哪些函式需要 jest
  // 有 @GEMS-AC → 需要 it('AC-X.Y') 測試；無 @GEMS-AC → skip（人工 POC）
  const acFnNames = acSpecs ? new Set(acSpecs.map(ac => ac.fn)) : new Set();
  const targetFns = acSpecs
    ? scanResult.functions.filter(f => acFnNames.has(f.name))   // 有 AC 規格
    : [];                                                        // 無 contract → 不強制
  const skipFns = scanResult.functions.filter(f => !acFnNames.has(f.name));

  // 統計（for display only，不再驅動 BLOCKER）
  const jestFns = targetFns; // alias，讓下方 anchorOutput 的 info 欄位語意保持

  // 統計
  const p0Fns = scanResult.functions.filter(f => f.priority === 'P0');
  const p1Fns = scanResult.functions.filter(f => f.priority === 'P1');
  const p2Fns = scanResult.functions.filter(f => f.priority === 'P2');

  // 已有測試檔案：檢查覆蓋
  if (testFiles.length > 0) {
    const fnsNeedingTests = targetFns;
    const fnsWithTests = fnsNeedingTests.filter(f => f.testFile);
    const allCovered = fnsNeedingTests.length === 0 || fnsWithTests.length === fnsNeedingTests.length;

    if (allCovered) {
      writeCheckpoint(target, iteration, story, '3', {
        verdict: 'PASS',
        testFiles: testFiles.length,
        jestFns: jestFns.length,
        skipFns: skipFns.length,
        acSpecs: acSpecs ? acSpecs.length : 0
      });

      anchorPass('BUILD', 'Phase 3',
        `測試檔案: ${testFiles.length} | 有 AC 的函式: ${targetFns.length} | 無 AC (skip): ${skipFns.length}`,
        getNextCmd('BUILD', '3', { story, level, target: relativeTarget, iteration }),
        {
          projectRoot: target,
          iteration: iterNum,
          phase: 'build',
          step: 'phase-3',
          story
        });
      return { verdict: 'PASS' };
    }

    const missingFns = fnsNeedingTests.filter(f => !f.testFile);
    anchorOutput({
      context: `Phase 3 | ${story} | 測試不完整`,
      error: {
        type: 'TACTICAL_FIX',
        summary: `${missingFns.length} 個有 @GEMS-AC 的函式缺少測試檔案`
      },
      task: missingFns.slice(0, 5).map(f => `補充 ${f.name} 的測試檔案（contract 有 @GEMS-AC，需對應 it('AC-X.Y')）`),
      output: `NEXT: ${getRetryCmd('BUILD', '3', { story, target: relativeTarget, iteration })}`
    }, {
      projectRoot: target,
      iteration: iterNum,
      phase: 'build',
      step: 'phase-3',
      story
    });
    return { verdict: 'PENDING' };
  }

  // 首次執行：顯示 AC 驅動的測試指引
  const acGuideLines = [];
  acGuideLines.push(`測試檔案位置規則：放在源碼旁邊的 __tests__/ 資料夾`);
  acGuideLines.push(`────────────────────────────────────────────────`);
  acGuideLines.push(`src/lib/storage.ts     → src/lib/__tests__/storage.test.ts`);
  acGuideLines.push(`src/modules/user.ts    → src/modules/__tests__/user.test.ts`);
  acGuideLines.push(``);

  if (skipFns.length > 0) {
    acGuideLines.push(`[SKIP] 以下函式在 contract 無 @GEMS-AC，不需要 jest 測試（人工 POC 驗收）：`);
    skipFns.forEach(f => acGuideLines.push(`  - ${f.name}`));
    acGuideLines.push(``);
  }

  if (targetFns.length > 0) {
    acGuideLines.push(`[JEST] 以下函式在 contract 有 @GEMS-AC，需要撰寫測試（每個 AC 必須對應一個 it()）：`);
    acGuideLines.push(``);
    for (const fn of targetFns) {
      acGuideLines.push(buildAcTestGuide(fn, acSpecs));
      acGuideLines.push(``);
    }
  }

  acGuideLines.push(`────────────────────────────────────────────────`);
  acGuideLines.push(`禁止規則：`);
  acGuideLines.push(`  - 禁止 toBeDefined() / toBeTruthy() / toBeFalsy() 作為唯一斷言`);
  acGuideLines.push(`  - 禁止在測試檔案內重新實作被測函式的邏輯`);
  if (acSpecs && acSpecs.length > 0) {
    acGuideLines.push(`  - expect 值必須與 contract @GEMS-AC-EXPECT 一致`);
  }

  anchorOutput({
    context: `Phase 3 | ${story} | AC 驅動測試指引`,
    info: {
      '有 @GEMS-AC 的函式（需 jest）': targetFns.length,
      '無 @GEMS-AC（skip）': skipFns.length,
      'AC specs 總數': acSpecs ? acSpecs.length : 0
    },
    task: [
      '在源碼旁邊建立 __tests__/ 資料夾',
      '按下方 AC 指引撰寫測試（每個 AC 一個 it()）',
      'getDiagnostics() = 0 errors'
    ],
    template: {
      title: 'AC 驅動測試指引',
      content: acGuideLines.join('\n')
    },
    output: getNextCmd('BUILD', '3', { story, level, target: relativeTarget, iteration })
  }, {
    projectRoot: target,
    iteration: iterNum,
    phase: 'build',
    step: 'phase-3',
    story
  });

  return { verdict: 'PENDING' };
}

function findTestFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      findTestFiles(fullPath, files);
    } else if (entry.isFile() && /\.test\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
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
