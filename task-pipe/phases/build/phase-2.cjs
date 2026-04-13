#!/usr/bin/env node
/**
 * BUILD Phase 2: TDD 驗收層 (v7.1)
 *
 * 定位：跑測試（TDD）或型別檢查（tsc）
 *
 * 驗收策略:
 *   @TEST 路徑 → vitest --run（驗 it()/test() 存在 + GREEN）
 *   無測試路徑 → tsc --noEmit（DB/UI/外部依賴層，只驗型別）
 *
 * TDD 原則:
 *   - 測試是規格，不能動測試檔
 *   - Phase 1 骨架是 RED 狀態（測試 failing）
 *   - Phase 2 修實作讓測試 GREEN
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { emitPass, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd } = require('../../lib/shared/next-command-helper.cjs');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');

// ── 找 contract 檔 ──
function findContractFile(target, iteration) {
  const iterDir = path.join(target, `.gems/iterations/${iteration}`);
  if (!fs.existsSync(iterDir)) return null;
  const files = fs.readdirSync(iterDir);
  const contract = files.find(f => f.startsWith('contract_') && f.endsWith('.ts'));
  return contract ? path.join(iterDir, contract) : null;
}

// 需要 TDD（vitest）的 contract 類型
const TDD_TYPES = new Set(['SVC', 'ACTION', 'HTTP', 'HOOK', 'LIB']);

// ── 從 contract 提取測試路徑（v4 schema: @TEST）──
// story 參數：若提供，只取屬於該 story 的 @CONTRACT block 下的 @TEST 路徑
// 回傳: { paths, isV4, matchedBlock, requiresTest }
//   matchedBlock:  該 story 在 contract 中有對應 @CONTRACT block
//   requiresTest:  matched block 中有 P0 或 TDD 型 contract → 必須有 @TEST
function extractTddPaths(contractContent, story = null) {
  if (story) {
    const paths = [];
    const matchedContracts = [];
    let matchedBlock = false;
    const contractRe = /\/\/\s*@CONTRACT:\s*(.+)/g;
    let m;
    while ((m = contractRe.exec(contractContent)) !== null) {
      const parts = m[1].trim().split('|').map(s => s.trim());
      if (parts[3] !== story) continue;
      matchedBlock = true;
      matchedContracts.push({ name: parts[0], priority: parts[1], type: (parts[2] || '').toUpperCase() });
      const after = m.index + m[0].length;
      const rest = contractContent.slice(after);
      const nextBound = rest.search(/\/\/\s*@CONTRACT:/);
      const block = nextBound >= 0 ? rest.slice(0, nextBound) : rest;
      for (const tm of [...block.matchAll(/\/\/\s*@TEST:\s*(.+)/g)]) {
        const p = tm[1].trim();
        if (p.match(/\.(test|spec)\.(ts|tsx)$/)) paths.push(p);
      }
    }
    if (matchedBlock) {
      // P0 或 TDD 型 contract → 應有 @TEST；DB/UI 等不要求 TDD
      const requiresTest = matchedContracts.some(c =>
        c.priority === 'P0' || TDD_TYPES.has(c.type)
      );
      return { paths, isV4: true, matchedBlock: true, requiresTest };
    }
  }
  // 無 story filter 或 story 無對應 block（legacy/unscoped）→ fallback 全取
  const matches = [...contractContent.matchAll(/\/\/\s*@TEST:\s*(.+)/g)];
  return {
    paths: matches.map(m => m[1].trim()).filter(p => p && p.match(/\.(test|spec)\.(ts|tsx)$/)),
    isV4: true, matchedBlock: false, requiresTest: false,
  };
}

// ── 驗 it()/test() 呼叫存在（v4 only）──
function verifyTestContent(target, testPaths) {
  const empty = [];
  for (const p of testPaths) {
    const abs = path.join(target, p);
    if (!fs.existsSync(abs)) continue;
    const content = fs.readFileSync(abs, 'utf8');
    const hasTestCall = /\bit\s*\(|\btest\s*\(/.test(content);
    if (!hasTestCall) empty.push(p);
  }
  return empty;
}

// ── 跑 vitest ──
function runVitest(target, tddPaths, options) {
  const { story, iteration, level, relativeTarget, iterNum } = options;

  // 過濾出存在的測試檔
  const existingPaths = tddPaths.filter(p => {
    const abs = path.join(target, p);
    return fs.existsSync(abs);
  });

  const missingPaths = tddPaths.filter(p => !existingPaths.includes(p));

  if (missingPaths.length > 0) {
    console.log(`\n⚠️  測試檔不存在（contract-gate @TEST 應已驗過）:`);
    missingPaths.forEach(p => console.log(`   ✗ ${p}`));
  }

  if (existingPaths.length === 0) {
    emitBlock({
      scope: `BUILD Phase 2 | ${story}`,
      summary: `@TEST 指定的測試檔均不存在，請確認 contract-gate CG-003 已通過`,
      targetFile: tddPaths[0],
      details: tddPaths.map(p => `  ✗ ${p}`).join('\n'),
      missing: tddPaths,
      tasks: tddPaths.map(p => ({
        action: 'CREATE_TEST_FILE',
        file: p,
        expected: '建立測試檔並加入 it()/test() 案例',
      })),
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=2 --story=${story} --target=${relativeTarget}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'BLOCKER' };
  }

  console.log(`\n🧪 TDD 驗收層 | ${story}`);
  existingPaths.forEach(p => console.log(`   ✓ ${p}`));
  console.log('');

  const testArgs = existingPaths.join(' ');
  const cmd = `npx vitest run ${testArgs}`;

  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: target
    });
    console.log(output);

    emitPass({
      scope: `BUILD Phase 2 | ${story}`,
      summary: `TDD PASS — ${existingPaths.length} 個測試檔全部通過`,
      nextCmd: getNextCmd('BUILD', '2', { story, level, target: relativeTarget, iteration })
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'PASS' };

  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    console.log(output);

    // 提取失敗測試摘要
    const failLines = output.split('\n')
      .filter(l => /✗|FAIL|×|AssertionError|Error/.test(l))
      .map(l => l.trim())
      .filter(Boolean)
      .slice(0, 20);

    emitBlock({
      scope: `BUILD Phase 2 | ${story}`,
      summary: `TDD FAIL — 測試未通過，修實作讓測試 GREEN（不能動測試檔）`,
      targetFile: existingPaths[0],
      details: failLines.join('\n') || output.split('\n').slice(-20).join('\n'),
      missing: failLines.slice(0, 5),
      tasks: existingPaths.map(p => ({
        action: 'FIX_SOURCE_TO_GREEN_TEST',
        file: p,
        expected: '修改對應實作檔（非測試檔本身），讓 vitest 通過',
        acSpec: '測試是規格，不能修改測試檔',
      })),
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=2 --story=${story} --target=${relativeTarget}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    console.log('💡 測試是規格，不能修改測試檔。修改實作讓測試通過後重跑。');
    return { verdict: 'BLOCKER' };
  }
}

// ── 跑 tsc --noEmit ──
function runTsc(target, options) {
  const { story, iteration, level, relativeTarget, iterNum } = options;

  console.log(`\n🔍 型別檢查 | ${story}`);
  console.log(`   （無 @TEST — DB/UI 層，只跑 tsc --noEmit）\n`);

  // 找 tsconfig：先查 root，再查深度 1 子目錄（支援 monorepo / 雙根目錄專案）
  // v7.1: 收集所有 tsconfig 一起跑（雙根目錄如 backend-gas/ + frontend/ 都要驗）
  const TSCONFIG_IGNORE = new Set(['node_modules', '.gems', '.git', 'dist', 'build', 'coverage']);
  const tsconfigPaths = [];
  const rootCandidate = path.join(target, 'tsconfig.json');
  if (fs.existsSync(rootCandidate)) {
    tsconfigPaths.push(rootCandidate);
  }
  // 深度 1 子目錄：找到全部不 break
  try {
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      if (!entry.isDirectory() || TSCONFIG_IGNORE.has(entry.name)) continue;
      const sub = path.join(target, entry.name, 'tsconfig.json');
      if (fs.existsSync(sub)) tsconfigPaths.push(sub);
    }
  } catch { /* ignore */ }

  if (tsconfigPaths.length === 0) {
    console.log(`⏭  跳過 tsc：tsconfig.json 不存在（root 及深度 1 子目錄均未找到）`);
    emitPass({
      scope: `BUILD Phase 2 | ${story}`,
      summary: 'SKIP — 無 tsconfig.json',
      nextCmd: getNextCmd('BUILD', '2', { story, level, target: relativeTarget, iteration })
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'PASS', skipped: true };
  }

  // 對每個 tsconfig 都跑 tsc --noEmit，任一失敗即 BLOCKER
  const allErrors = [];
  for (const tsconfigPath of tsconfigPaths) {
    const tsconfigDir = path.dirname(tsconfigPath);
    const tsconfigRel = path.relative(target, tsconfigPath);
    console.log(`   tsconfig: ${tsconfigRel}`);
    try {
      const output = execSync('npx tsc --noEmit', {
        encoding: 'utf8',
        stdio: 'pipe',
        cwd: tsconfigDir
      });
      if (output) console.log(output);
      console.log(`   ✅ ${tsconfigRel} — 無型別錯誤`);
    } catch (err) {
      const output = (err.stdout || '') + (err.stderr || '');
      console.log(output);
      const errorLines = output.split('\n').filter(l => /error TS/.test(l)).slice(0, 10).join('\n');
      allErrors.push(`[${tsconfigRel}]\n${errorLines || output.split('\n').slice(-10).join('\n')}`);
    }
  }

  if (allErrors.length > 0) {
    emitBlock({
      scope: `BUILD Phase 2 | ${story}`,
      summary: `tsc --noEmit FAIL — ${allErrors.length}/${tsconfigPaths.length} 個 tsconfig 有型別錯誤`,
      details: allErrors.join('\n\n'),
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=2 --story=${story} --target=${relativeTarget}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'BLOCKER' };
  }

  emitPass({
    scope: `BUILD Phase 2 | ${story}`,
    summary: `tsc --noEmit PASS — ${tsconfigPaths.length} 個 tsconfig 均無型別錯誤`,
    nextCmd: getNextCmd('BUILD', '2', { story, level, target: relativeTarget, iteration })
  }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
  return { verdict: 'PASS' };
}

/** GEMS: buildPhase2 | P1 | detectTddPaths(IO)→runVitest(IO)→runTsc(IO)→RETURN:PhaseResult | Story-4.0 */
function run(options) {
  const { target, iteration = 'iter-1', story, level = 'M' } = options;
  const relativeTarget = path.relative(process.cwd(), target) || '.';
  const iterNum = parseInt(iteration.replace('iter-', '')) || 1;

  console.log(getSimpleHeader('BUILD', 'Phase 2'));

  if (!story) {
    emitBlock({
      scope: 'BUILD Phase 2',
      summary: '缺少 --story 參數',
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-X.Y --target=${relativeTarget}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'BLOCKER' };
  }

  const contractFile = findContractFile(target, iteration);
  if (!contractFile) {
    const contractRelPath = `.gems/iterations/${iteration}/contract_iter-${iterNum}.ts`;
    emitBlock({
      scope: `BUILD Phase 2 | ${story}`,
      summary: `contract_iter-${iterNum}.ts 不存在，無法執行 Phase 2`,
      targetFile: contractRelPath,
      details: `contract 不存在，需先執行 CONTRACT 階段產生 contract 後再重跑 Phase 2`,
      missing: [`contract_iter-${iterNum}.ts`],
      tasks: [{
        action: 'RUN_CONTRACT_GATE',
        file: contractRelPath,
        expected: 'contract_iter-N.ts 存在且已通過 contract-gate',
      }],
      nextCmd: `node task-pipe/runner.cjs --phase=CONTRACT --story=${story} --target=${relativeTarget}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'BLOCKER' };
  }

  const contractContent = fs.readFileSync(contractFile, 'utf8');
  const { paths: tddPaths, isV4, matchedBlock, requiresTest } = extractTddPaths(contractContent, story);

  const sharedOptions = { story, iteration, level, relativeTarget, iterNum };
  const iterPath = `iter-${iterNum}`;

  if (tddPaths.length > 0) {
    // v4: 額外驗 it()/test() 呼叫存在
    if (isV4) {
      const emptyFiles = verifyTestContent(target, tddPaths);
      if (emptyFiles.length > 0) {
        emitBlock({
          scope: `BUILD Phase 2 | ${story}`,
          summary: `@TEST 檔案存在但無 it()/test() 呼叫（空殼測試）`,
          targetFile: emptyFiles[0],
          details: emptyFiles.map(p => `  ✗ ${p} — 缺少 it() 或 test() 呼叫`).join('\n'),
          missing: emptyFiles.map(p => `${p} 缺少 it() / test() 呼叫`),
          tasks: emptyFiles.map(p => ({
            action: 'FILL_TEST_CASE',
            file: p,
            expected: '至少一個 it() 或 test() 案例，覆蓋 @CONTRACT 指定的 behavior',
          })),
          nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=2 --story=${story} --target=${relativeTarget}`
        }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
        return { verdict: 'BLOCKER' };
      }
    }
    return runVitest(target, tddPaths, sharedOptions);
  } else if (matchedBlock && requiresTest) {
    // Story 有 P0/TDD 型 @CONTRACT block 但完全沒有 @TEST → 不可 fallback 到 tsc
    const contractRel = path.relative(process.cwd(), contractFile);
    emitBlock({
      scope: `BUILD Phase 2 | ${story}`,
      summary: `${story} 有 P0/TDD 型 @CONTRACT 但缺少 @TEST 路徑`,
      targetFile: contractRel,
      details: [
        `Contract: ${contractRel}`,
        `P0 或 SVC/ACTION/HTTP/HOOK/LIB 型 contract 必須在 contract 中填 @TEST 路徑`,
        `請先修 contract 補 @TEST，重跑 contract-gate，再重跑 BUILD`,
      ].join('\n'),
      missing: [`${story} 的 @CONTRACT block 缺少 @TEST 路徑`],
      tasks: [{
        action: 'ADD_TEST_TAG',
        file: contractRel,
        expected: `在 ${story} 的 @CONTRACT block 補 // @TEST: src/path/to/*.test.ts`,
      }],
      nextCmd: `node sdid-tools/blueprint/v5/contract-gate.cjs --contract=${contractRel} --target=${relativeTarget} --iter=${iterNum}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'BLOCKER' };
  } else {
    // matchedBlock=false（legacy/unscoped）或 requiresTest=false（DB/UI 型）→ tsc
    return runTsc(target, sharedOptions);
  }
}

module.exports = { run };
