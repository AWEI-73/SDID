#!/usr/bin/env node
/**
 * Contract Gate v5.3 — Per-iter Contract 格式門控（HARNESS）
 *
 * 自動偵測格式版本：
 *   v4（有 @CONTRACT:）→ HARNESS 規則
 *   v3（無 @CONTRACT:）→ 舊規則（相容）
 *
 * v4 HARNESS 規則:
 *   CG-001 BLOCKER: @CONTRACT P0 必有 @TEST
 *   CG-002 BLOCKER: @TEST 路徑必須以 .test.ts/.spec.ts 結尾
 *   CG-003 BLOCKER: @TEST 路徑必須實際存在（RED 測試已寫）
 *   CG-005 WARNING: P0 Behavior: 缺少錯誤路徑
 *   CG-007 三層驗收（需 --blueprint）:
 *     Layer 1 BLOCKER: Blueprint needsTest 動作必有對應 @CONTRACT + @TEST 路徑
 *     Layer 2 BLOCKER: @TEST 路徑檔案必須存在
 *     Layer 3 WARNING: it() 案例數 >= Behavior: 條目數；Behavior 錯誤碼必出現在測試檔
 *
 * Auto-patch:
 *   - @GEMS-STORIES 區塊 → @GEMS-STORY: 單行格式（v3）
 *   - @CONTRACT-LOCK 不存在 → @PASS 後自動注入
 *
 * 用法:
 *   node sdid-tools/blueprint/v5/contract-gate.cjs --contract=<path> --target=<project> --iter=<N> [--blueprint=<path>]
 *
 * 輸出:
 *   @PASS     — 可進入 plan-generator → BUILD
 *   @BLOCKER  — 結構缺失或 @TEST 不存在
 */
'use strict';
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const a = { contract: null, target: null, iter: 1, blueprint: null, help: false };
  for (const x of process.argv.slice(2)) {
    if (x.startsWith('--contract=')) a.contract = path.resolve(x.split('=').slice(1).join('='));
    else if (x.startsWith('--target=')) a.target = path.resolve(x.split('=').slice(1).join('='));
    else if (x.startsWith('--iter=')) a.iter = parseInt(x.split('=')[1]) || 1;
    else if (x.startsWith('--blueprint=')) a.blueprint = path.resolve(x.split('=').slice(1).join('='));
    else if (x === '--help' || x === '-h') a.help = true;
  }
  return a;
}

// ── Parse Blueprint needsTest actions for given iter ──
function parseBlueprintNeedsTest(blueprintPath, iterNum) {
  if (!blueprintPath || !fs.existsSync(blueprintPath)) return null;
  const content = fs.readFileSync(blueprintPath, 'utf8');

  // Find ### 複雜度標註 section
  const sectionMatch = content.match(/###\s*複雜度標註[^\n]*\n([\s\S]*?)(?=\n##|\n---|\s*$)/);
  if (!sectionMatch) return null;

  const sectionText = sectionMatch[1];
  // Parse table rows: | Iter | Domain | needsTest 動作 | 風險備注 |
  // Skip header (|---) and rows where iter doesn't match
  const actions = [];
  for (const line of sectionText.split('\n')) {
    if (!/^\|/.test(line) || /^\|\s*[-:]+/.test(line)) continue; // skip separator
    const cols = line.split('|').map(s => s.trim()).filter((_, i) => i > 0); // drop leading ''
    if (cols.length < 3) continue;
    const rowIter = parseInt(cols[0]);
    if (isNaN(rowIter) || rowIter !== iterNum) continue;

    const needsTestCol = cols[2] || '';
    if (!needsTestCol || /^(無|-|—|\{)/.test(needsTestCol)) continue;

    const names = needsTestCol.split(/[,，]/).map(s => s.trim()).filter(s =>
      s && s !== '無' && !s.startsWith('{')
    );
    actions.push(...names);
  }
  return actions; // [] = no needsTest this iter, null = section missing
}

// ── Auto-patch: @GEMS-STORIES 區塊 → @GEMS-STORY: 單行格式 ──
// 舊格式:
//   // @GEMS-STORIES
//   // Story-1.0 | shared | 基礎建設 | INFRA
// 新格式:
//   // @GEMS-STORY: Story-1.0 | shared | 基礎建設 | INFRA
function autoPatchContract(content) {
  const patches = [];
  let patched = content;

  // 1. @GEMS-STORIES 區塊（舊格式）→ @GEMS-STORY: 單行格式
  const storiesBlockMatch = patched.match(/\/\/\s*@GEMS-STORIES\s*\n((?:\/\/[^\n]*\n?)+)/);
  if (storiesBlockMatch) {
    const blockLines = storiesBlockMatch[1].split('\n').filter(l => l.trim().startsWith('//'));
    const storyLines = blockLines
      .map(l => l.replace(/^\/\/\s*/, '').trim())
      .filter(l => /^Story[-\s]\d+\.\d+/.test(l));
    if (storyLines.length > 0) {
      // 同時修正 Story 空格 → 連字號
      const newLines = storyLines.map(l => {
        const normalized = l.replace(/^Story\s+(\d+\.\d+)/, 'Story-$1');
        return `// @GEMS-STORY: ${normalized}`;
      }).join('\n');
      patched = patched.replace(storiesBlockMatch[0], newLines + '\n');
      patches.push(`@GEMS-STORIES 區塊 → ${storyLines.length} 個 @GEMS-STORY: 單行格式`);
    }
  }

  // 2. @GEMS-ENTITY 別名 → @GEMS-CONTRACT
  //    有些 AI 會寫 @GEMS-ENTITY: 或 @GEMS-TYPE:
  patched = patched.replace(/\/\/\s*@GEMS-ENTITY:\s*/g, '// @GEMS-CONTRACT: ');
  if (patched !== content && !patches.some(p => p.includes('ENTITY'))) {
    patches.push('@GEMS-ENTITY → @GEMS-CONTRACT');
  }
  patched = patched.replace(/\/\/\s*@GEMS-TYPE:\s*/g, '// @GEMS-CONTRACT: ');
  if (patched !== content && !patches.some(p => p.includes('TYPE'))) {
    patches.push('@GEMS-TYPE → @GEMS-CONTRACT');
  }

  // 3. @GEMS-STORY 格式容錯：Story 1.0（空格）→ Story-1.0（連字號）
  patched = patched.replace(/(\/\/\s*@GEMS-STORY:\s*Story)\s+(\d+\.\d+)/g, (_, prefix, ver) => {
    patches.push(`@GEMS-STORY Story ${ver} → Story-${ver}`);
    return `${prefix}-${ver}`;
  });

  // 4. interface 缺少 @GEMS-CONTRACT 標頭 → 自動補（只補第一個 interface）
  //    條件：有 interface 但完全沒有 @GEMS-CONTRACT
  const hasContract = /\/\/\s*@GEMS-CONTRACT:?\s*\w+/.test(patched);
  if (!hasContract) {
    const interfaceMatch = patched.match(/^(export\s+)?interface\s+(\w+)/m);
    if (interfaceMatch) {
      const entityName = interfaceMatch[2];
      patched = patched.replace(
        interfaceMatch[0],
        `// @GEMS-CONTRACT: ${entityName}\n${interfaceMatch[0]}`
      );
      patches.push(`自動補 @GEMS-CONTRACT: ${entityName}（第一個 interface）`);
    }
  }

  return { patched, patches };
}

// ── Gate checks ──
/** GEMS: checkContract | P0 | DETECT_FORMAT(Clear)→CHECK_V4(Complicated)→CHECK_V3(Clear)→RETURN(Clear) | Story-2.0 */
function checkContract(content, iterNum, target = null, blueprintPath = null) {
  const blockers = [];
  const guided = [];
  const warnings = [];
  const B = (code, msg) => blockers.push({ code, msg });
  const G = (code, msg) => guided.push({ code, msg });
  const W = (code, msg) => warnings.push({ code, msg });

  // ── 格式偵測：有 @CONTRACT: → v4，否則 → v3（舊格式相容）
  const isV4 = /\/\/\s*@CONTRACT:\s*\w+/.test(content);

  if (isV4) {
    // ════════════════════════════════════════════════
    // v4 HARNESS 驗證規則
    // ════════════════════════════════════════════════

    // 收集所有 @CONTRACT 宣告
    const contractMatches = [...content.matchAll(/\/\/\s*@CONTRACT:\s*(.+)/g)];
    const contracts = contractMatches.map(m => {
      const parts = m[1].trim().split('|').map(s => s.trim());
      return {
        raw: m[1].trim(),
        name: parts[0] || '',
        priority: parts[1] || '',
        type: parts[2] || '',
        storyId: parts[3] || '',
        lineIdx: m.index,
      };
    });

    if (contracts.length === 0)
      B('CG-001', '有 @CONTRACT: 標籤但格式不符，應為: // @CONTRACT: Name | P0|P1 | SVC|ACTION|HTTP|HOOK|LIB | Story-X.Y');

    // CG-001: 每個 P0 @CONTRACT 必須在自己的 block 中有 @TEST
    // （不是檔案層級有 @TEST 就算，逐一檢查每個 P0 contract block）
    const testMatches = [...content.matchAll(/\/\/\s*@TEST:\s*(.+)/g)];
    const testPaths = testMatches.map(m => m[1].trim()).filter(Boolean);

    const p0Contracts = contracts.filter(c => c.priority === 'P0');
    const p0WithoutTest = p0Contracts.filter(c => {
      // 截取該 @CONTRACT 到下一個 @CONTRACT 或 export 之間的 block
      const afterIdx = (c.lineIdx || 0) + (c.raw.length || 0);
      const rest = content.slice(afterIdx);
      const nextBoundary = rest.search(/\/\/\s*@CONTRACT:|^export\s/m);
      const block = nextBoundary >= 0 ? rest.slice(0, nextBoundary) : rest;
      return !/\/\/\s*@TEST:\s*\S+/.test(block);
    });
    if (p0WithoutTest.length > 0)
      B('CG-001', `P0 @CONTRACT 缺少 @TEST（逐 contract 檢查）: ${p0WithoutTest.map(c => c.name).join(', ')}。P0 必填: // @TEST: src/modules/.../{name}.test.ts`);

    // CG-002: @TEST 路徑格式（.test.ts / .spec.ts）
    const badTestPaths = testPaths.filter(p => !p.match(/\.(test|spec)\.(ts|tsx)$/));
    if (badTestPaths.length > 0)
      B('CG-002', `@TEST 路徑格式錯誤，必須以 .test.ts / .spec.ts / .test.tsx / .spec.tsx 結尾: ${badTestPaths.join(', ')}`);

    // CG-003: @TEST 路徑必須實際存在（RED 測試已寫）
    if (target) {
      const missingTests = testPaths.filter(p => {
        const abs = path.isAbsolute(p) ? p : path.join(target, p);
        return !fs.existsSync(abs);
      });
      if (missingTests.length > 0)
        B('CG-003', `@TEST 路徑不存在（RED 測試尚未寫入）: ${missingTests.join(', ')}`);
    }

    // CG-007: Blueprint needsTest 動作三層驗收（需 --blueprint）
    if (blueprintPath) {
      const needsTestActions = parseBlueprintNeedsTest(blueprintPath, iterNum);
      if (needsTestActions === null) {
        W('CG-007', 'Blueprint 缺少「### 複雜度標註」section，無法做 needsTest 交叉驗證（請先通過 BP-013）');
      } else {
        for (const actionName of needsTestActions) {
          // Layer 1: contract 中必有對應 @CONTRACT block 且含 @TEST
          // 兩步比對：①精確比對 @CONTRACT Name ②Behavior: 行中含 techName（draft 粒度 fallback）
          let contractMatch = contracts.find(c =>
            c.name.toLowerCase() === actionName.toLowerCase()
          );
          if (!contractMatch) {
            // fallback: 在各 contract block 的 Behavior: 行裡找 techName
            contractMatch = contracts.find(c => {
              const aIdx = (c.lineIdx || 0) + (c.raw.length || 0);
              const r = content.slice(aIdx);
              const nb = r.search(/\/\/\s*@CONTRACT:|^export\s/m);
              const blk = nb >= 0 ? r.slice(0, nb) : r;
              return blk.toLowerCase().includes(actionName.toLowerCase());
            });
          }
          if (!contractMatch) {
            B('CG-007', `[L1-路徑] Blueprint needsTest 動作 "${actionName}" 在 contract 中找不到對應 @CONTRACT block（直接填 @CONTRACT Name 如 CategoryService，或確認 Behavior: 行含此名稱）`);
            continue;
          }
          const afterIdx = (contractMatch.lineIdx || 0) + (contractMatch.raw.length || 0);
          const rest = content.slice(afterIdx);
          const nextBoundary = rest.search(/\/\/\s*@CONTRACT:|^export\s/m);
          const block = nextBoundary >= 0 ? rest.slice(0, nextBoundary) : rest;

          const testPathMatch = block.match(/\/\/\s*@TEST:\s*(.+)/);
          if (!testPathMatch) {
            B('CG-007', `[L1-路徑] Blueprint needsTest 動作 "${actionName}" 的 @CONTRACT block 缺少 @TEST 路徑`);
            continue;
          }
          const testPath = testPathMatch[1].trim();

          // Layer 2: @TEST 檔案必須存在
          if (target) {
            const absPath = path.isAbsolute(testPath) ? testPath : path.join(target, testPath);
            if (!fs.existsSync(absPath)) {
              B('CG-007', `[L2-存在性] Blueprint needsTest 動作 "${actionName}" 的 @TEST 檔案不存在: ${testPath}`);
              continue;
            }

            // Layer 3: 行為一致性（WARNING）
            const testContent = fs.readFileSync(absPath, 'utf8');
            const itCount = (testContent.match(/\bit\s*\(|\btest\s*\(/g) || []).length;
            const behaviorLines = [...block.matchAll(/\/\/\s*-\s*(.+)/g)].map(m => m[1].trim());

            if (behaviorLines.length > 0 && itCount < behaviorLines.length) {
              W('CG-007', `[L3-行為] "${actionName}" 測試案例數 (${itCount}) 少於 Behavior 條目數 (${behaviorLines.length})，可能覆蓋不足`);
            }

            // 錯誤碼一致性：Behavior 中的 Error("Code") 必須出現在測試檔
            const errorCodes = [];
            for (const bl of behaviorLines) {
              for (const m of bl.matchAll(/Error\(["']([^"']+)["']\)/g)) errorCodes.push(m[1]);
            }
            const missingCodes = errorCodes.filter(code => !testContent.includes(code));
            if (missingCodes.length > 0) {
              W('CG-007', `[L3-行為] "${actionName}" 測試檔未涵蓋 Behavior 錯誤碼: ${missingCodes.join(', ')}`);
            }
          }
        }
      }
    }

    // CG-005（WARNING）: P0 Behavior: 必須有錯誤路徑（含 Error/拋出）
    const behaviorLines = [...content.matchAll(/\/\/\s*-\s*.+/g)].map(m => m[0]);
    const p0HasBehavior = /\/\/\s*Behavior[（(]/.test(content) || /\/\/\s*Behavior:/.test(content);
    if (p0Contracts.length > 0 && p0HasBehavior) {
      const hasErrorPath = behaviorLines.some(l =>
        /Error|拋|throw|錯誤|失敗|不存在|重複|NotFound|Duplicate|Invalid|Exceed/.test(l)
      );
      if (!hasErrorPath)
        W('CG-005', 'P0 Behavior: 缺少錯誤路徑（應有 Error/拋/throw/NotFound 等）');
    }

    // @GUIDED: any/unknown
    if (/:\s*any\b|:\s*unknown\b/.test(content))
      G('CG-G01', '發現 any/unknown 型別，建議替換為具體型別');

    // @GUIDED: 偵測舊 @GEMS-TDD 標籤（v3 遺留）
    if (/\/\/\s*@GEMS-TDD:/.test(content))
      G('CG-G02', '@GEMS-TDD 為 v3 標籤，v4 請改用 @TEST: 路徑');

  } else {
    // ════════════════════════════════════════════════
    // v3 驗證規則（相容舊格式，保留不動）
    // ════════════════════════════════════════════════

    // 大項 1: @GEMS-STORY: 至少一個
    const hasStory = /\/\/\s*@GEMS-STORY:\s*Story-\d+\.\d+/.test(content);
    if (!hasStory)
      B('CG-001', '缺少 @GEMS-STORY: Story-X.Y（至少一個），格式: // @GEMS-STORY: Story-1.0 | module | 描述 | TYPE');

    // 大項 2: @GEMS-CONTRACT: 至少一個
    const hasContract = /\/\/\s*@GEMS-CONTRACT:?\s*\w+/.test(content);
    if (!hasContract)
      B('CG-002', '缺少 @GEMS-CONTRACT: EntityName（至少一個 Entity 定義）');

    // CG-003: @GEMS-TDD 路徑格式
    const tddMatches = [...content.matchAll(/\/\/\s*@GEMS-TDD:\s*(.+)/g)];
    const tddPaths = tddMatches.map(m => m[1].trim()).filter(Boolean);
    const badTddPaths = tddPaths.filter(p => !p.match(/\.(test|spec)\.(ts|tsx)$/));
    if (badTddPaths.length > 0)
      B('CG-003', `@GEMS-TDD 路徑格式錯誤，必須以 .test.ts / .spec.ts 結尾: ${badTddPaths.join(', ')}`);

    // @GUIDED
    if (/:\s*any\b|:\s*unknown\b/.test(content))
      G('CG-G02', '發現 any/unknown 型別，建議替換為具體型別');
    if (/\/\/\s*@GEMS-AC:/.test(content))
      G('CG-G04', '@GEMS-AC 標籤已 deprecated（v7.0），請改用 @GEMS-TDD 指向測試檔路徑');
  }

  return { blockers, guided, warnings, isV4 };
}

// ── Main ──
function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(`
Contract Gate v5.3 — Per-iter Contract 格式門控（HARNESS）

用法:
  node sdid-tools/blueprint/v5/contract-gate.cjs --contract=<path> --target=<project> --iter=<N> [--blueprint=<path>]

v4 格式（@CONTRACT:）→ CG-001~005 + CG-007 HARNESS 規則
v3 格式（@GEMS-STORY:）→ 舊規則相容
--blueprint: 可選，提供後啟用 CG-007（Blueprint needsTest 三層驗收）
@PASS 後自動注入 @CONTRACT-LOCK

輸出: @PASS 或 @BLOCKER
`);
    process.exit(0);
  }

  if (!args.contract || !args.target) {
    console.log('@BLOCKER | contract-gate v5.1 | 需要 --contract 和 --target 參數');
    process.exit(1);
  }
  if (!fs.existsSync(args.contract)) {
    console.log(`@BLOCKER | contract-gate v5.1 | 檔案不存在: ${args.contract}`);
    process.exit(1);
  }

  let content = fs.readFileSync(args.contract, 'utf8');

  // Auto-patch
  const { patched, patches } = autoPatchContract(content);
  if (patches.length > 0) {
    fs.writeFileSync(args.contract, patched, 'utf8');
    content = patched;
  }

  const { blockers, guided, warnings, isV4 } = checkContract(content, args.iter, args.target, args.blueprint);
  const passed = blockers.length === 0;

  // @CONTRACT-LOCK 注入（@PASS 時）
  if (passed && !content.includes('@CONTRACT-LOCK')) {
    const today = new Date().toISOString().slice(0, 10);
    const lockHeader = [
      `// @CONTRACT-LOCK: ${today} | Gate: iter-${args.iter}`,
      `// @SPEC-CHANGES: (none)`,
      `//`,
      `// ─── 以下契約已通過 Gate，修改需加 [SPEC-FIX] 標記 ──────────────────────────`,
      ``,
    ].join('\n');
    fs.writeFileSync(args.contract, lockHeader + content, 'utf8');
    patches.push('@CONTRACT-LOCK 標頭已注入');
  }

  // Log 存檔
  const logsDir = path.join(args.target, '.gems', 'iterations', `iter-${args.iter}`, 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const status = passed ? 'pass' : 'error';
  const logFile = path.join(logsDir, `contract-gate-${status}-${ts}.log`);
  const gateVer = isV4 ? 'v4-HARNESS' : 'v3-legacy';
  const logLines = [
    `=== Contract Gate v5.3 (${gateVer}) ===`,
    `Contract: ${path.basename(args.contract)}`,
    `Iter: ${args.iter}`,
    `Format: ${isV4 ? 'v4 (@CONTRACT/@TEST/Behavior:)' : 'v3 (@GEMS-STORY/@GEMS-TDD)'}`,
    `Result: ${passed ? 'PASS' : 'BLOCKER'}`,
    '',
  ];
  if (patches.length > 0) {
    logLines.push('=== AUTO-PATCH ===');
    patches.forEach(p => logLines.push(`  ✅ ${p}`));
    logLines.push('');
  }
  if (blockers.length > 0) {
    logLines.push('=== BLOCKERS ===');
    blockers.forEach(b => logLines.push(`[${b.code}] ${b.msg}`));
    logLines.push('');
  }
  if (warnings.length > 0) {
    logLines.push('=== WARNINGS ===');
    warnings.forEach(w => logLines.push(`@WARNING [${w.code}] ${w.msg}`));
    logLines.push('');
  }
  if (guided.length > 0) {
    logLines.push('=== GUIDED ===');
    guided.forEach(g => logLines.push(`@GUIDED [${g.code}] ${g.msg}`));
    logLines.push('');
  }
  fs.writeFileSync(logFile, logLines.join('\n'), 'utf8');

  const relContract = path.relative(process.cwd(), args.contract);
  const relTarget = path.relative(process.cwd(), args.target) || '.';
  const relLog = path.relative(args.target, logFile);
  const bpFlag = args.blueprint ? ` --blueprint=${path.relative(process.cwd(), args.blueprint)}` : '';
  const retryCmd = `node sdid-tools/blueprint/v5/contract-gate.cjs --contract=${relContract} --target=${relTarget} --iter=${args.iter}${bpFlag}`;

  // 終端輸出
  console.log('');
  if (passed) {
    console.log(`@PASS | contract-gate v5.3 (${gateVer}) | iter-${args.iter}`);
    if (patches.length > 0) patches.forEach(p => console.log(`  ✅ auto-patch: ${p}`));
    if (warnings.length > 0) {
      console.log('');
      warnings.forEach(w => console.log(`  @WARNING [${w.code}] ${w.msg}`));
    }
    if (guided.length > 0) {
      console.log('');
      guided.forEach(g => console.log(`  @GUIDED [${g.code}] ${g.msg}`));
    }
    console.log(`  Log: ${relLog}`);
    console.log('');
    console.log(`@CONTEXT_SCOPE`);
    console.log(`  Contract: ${relContract}`);
    console.log(`  BUILD_READ: ${relContract}, implementation_plan_Story-X.Y.md`);
    console.log(`  BUILD_SKIP: draft_iter-${args.iter}.md, blueprint.md, 其他 iter contract`);
    if (isV4) {
      console.log('');
      console.log(`  @TEST 路徑已驗證存在（RED 狀態）`);
      console.log('');
      console.log(`@REQUIRED_NEXT_ACTION`);
      console.log(`  ⚠️  STOP — 先寫 Plan，再進 BUILD`);
      console.log(`  ACTION: WRITE_PLAN`);
      console.log(`  OUTPUT: .gems/iterations/iter-${args.iter}/plan/implementation_plan_Story-X.Y.md`);
      console.log(`  REFERENCE: .agent/skills/sdid/references/plan-writer.md`);
      console.log(`  RULE: Plan 不存在時 BUILD Phase 1 會 BLOCKER，不可直接寫程式碼`);
      console.log('');
      console.log(`  AFTER_PLAN:`);
      console.log(`    node task-pipe/runner.cjs --phase=BUILD --step=1 --story=<Story-X.Y> --target=<project> --iteration=iter-${args.iter}`);
    } else {
      console.log('');
      console.log(`@REQUIRED_NEXT_ACTION`);
      console.log(`  ACTION: WRITE_PLAN → 呼叫 sdid-loop 繼續流程（contract → plan-generator → BUILD）`);
    }
  } else {
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`@BLOCKER | contract-gate v5.3 (${gateVer}) | ${blockers.length} item(s) to fix`);
    console.log(`@CONTEXT: Contract iter-${args.iter} | ${relContract}`);
    if (patches.length > 0) patches.forEach(p => console.log(`  ✅ auto-patch: ${p}`));
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log('');
    blockers.forEach((b, i) => {
      console.log(`@TASK-${i+1}`);
      console.log(`  ACTION: FIX_CONTRACT`);
      console.log(`  FILE: ${relContract}`);
      console.log(`  EXPECTED: [${b.code}] ${b.msg}`);
      console.log('');
    });
    if (guided.length > 0) {
      guided.forEach(g => console.log(`  @GUIDED [${g.code}] ${g.msg}`));
      console.log('');
    }
    console.log(`@NEXT_COMMAND`);
    console.log(`  ${retryCmd}`);
    console.log('');
    console.log(`@REMINDER`);
    blockers.forEach(b => console.log(`  - FIX [${b.code}] ${relContract}`));
    console.log(`  NEXT: ${retryCmd}`);
    console.log('');
    console.log(`@READ: ${relLog}`);
    console.log(`@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ ${relContract}`);
    console.log(`═══════════════════════════════════════════════════════════`);
  }

  // --- Decision Log ---
  const { writeDecisionLog } = require('../../lib/decision-log.cjs');
  writeDecisionLog(args.target, {
    gate: 'contract-gate',
    status: passed ? 'PASS' : 'BLOCKER',
    iter: args.iter,
    errors: blockers.map(b => b.code)
  });
  console.log(`[LOG-REQUIRED] gate=contract-gate status=${passed ? 'PASS' : 'BLOCKER'} iter=${args.iter}`);
  console.log(`  → 補上 why${passed ? '' : ' + resolution'} 到 .gems/decision-log.jsonl 再繼續`);
  console.log('');

  process.exit(passed ? 0 : 1);
}

module.exports = { autoPatchContract, checkContract };
if (require.main === module) main();
