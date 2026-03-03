#!/usr/bin/env node
/**
 * Draft-to-Plan v1.1 - 藍圖→執行計畫 機械轉換器 + 骨架預生成
 * 
 * 從活藍圖的動作清單，確定性轉換為 implementation_plan per Story。
 * v1.1: 同時生成 .ts/.tsx 骨架檔（帶完整 GEMS 標籤 + AC + STEP 錨點）
 * 零 AI 推導，純格式轉換。
 * 
 * 用法:
 *   node sdid-tools/draft-to-plan.cjs --draft=<path> --iter=1 --target=<project>
 *   node sdid-tools/draft-to-plan.cjs --draft=<path> --iter=1 --target=<project> --dry-run
 * 
 * 輸出:
 *   .gems/iterations/iter-N/plan/implementation_plan_Story-N.Y.md (per Story)
 */

const fs = require('fs');
const path = require('path');
const parser = require('./lib/draft-parser-standalone.cjs');
const logOutput = require('../task-pipe/lib/shared/log-output.cjs');
const { validatePlan, formatResult } = require('../task-pipe/lib/plan/plan-validator.cjs');

// ============================================
// 參數解析
// ============================================
function parseArgs() {
  const args = { draft: null, iter: 1, target: null, dryRun: false, help: false, scaffold: true };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--draft=')) args.draft = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iter=')) args.iter = parseInt(arg.split('=')[1]);
    else if (arg.startsWith('--target=')) args.target = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--no-scaffold') args.scaffold = false;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ============================================
// GEMS 標籤自動推導
// ============================================

/**
 * 解析 action 的 deps 字串
 * 如果 action 本身沒有 deps（'無'），從模組級 deps 推導
 * 模組 deps 格式: ['shared/types', 'shared/storage'] → '[Module.shared/types], [Module.shared/storage]'
 */
function resolveDeps(actionDeps, moduleDeps) {
  if (actionDeps && actionDeps !== '無') return actionDeps;
  if (!moduleDeps || moduleDeps.length === 0) return '無';
  // 過濾掉空字串，轉成 [Module.xxx] 格式
  const formatted = moduleDeps
    .filter(d => d && d !== '無')
    .map(d => `[Module.${d}]`);
  return formatted.length > 0 ? formatted.join(', ') : '無';
}

/** 根據 deps 中 Module/Internal 的數量推導風險 */
function inferDepsRisk(depsStr) {  if (!depsStr || depsStr === '無') return 'LOW';
  const deps = depsStr.split(',').map(d => d.trim());
  const moduleDeps = deps.filter(d => /\[(?:Module|Internal|External)\./i.test(d));
  if (moduleDeps.length >= 3) return 'HIGH';
  if (moduleDeps.length >= 1) return 'MEDIUM';
  return 'LOW';
}

/** 根據 priority 推導測試策略 */
function inferTestStrategy(priority) {
  switch (priority) {
    case 'P0': return '✓ Unit | ✓ Integration | ✓ E2E';
    case 'P1': return '✓ Unit | ✓ Integration | - E2E';
    case 'P2': return '✓ Unit | - Integration | - E2E';
    case 'P3': return '✓ Unit | - Integration | - E2E';
    default: return '✓ Unit | - Integration | - E2E';
  }
}

/** 根據 type 推導測試檔案名 */
function inferTestFile(techName, type) {
  const kebab = techName
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
  switch (type) {
    case 'SVC': return `${kebab}.test.ts`;
    case 'API': return `${kebab}.test.ts`;
    case 'HOOK': return `${kebab}.test.ts`;
    case 'UI': return `${kebab}.test.tsx`;
    default: return `${kebab}.test.ts`;
  }
}

/** 根據 type 推導檔案路徑（委派給 Architecture Contract） */
function inferFilePath(techName, type, moduleName) {
  const kebab = techName
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

  // 使用 Architecture Contract 統一路徑規則，確保與 phase-1 一致
  const contract = require('../sdid-core/architecture-contract.cjs');
  return contract.inferFilePath(type, moduleName, kebab);
}

/** 從 flow 字串生成 [STEP] 錨點 */
function generateStepAnchors(flow) {
  if (!flow) return '';
  const steps = flow.split('→').map(s => s.trim()).filter(Boolean);
  return steps.map(s => `// [STEP] ${s}`).join('\n');
}

// ============================================
// 生成 implementation_plan Markdown
// ============================================
function generatePlan(draft, iterNum, storyIndex, moduleName, actions, options = {}) {
  const { projectTitle = draft.title } = options;
  const storyId = `Story-${iterNum}.${storyIndex}`;
  const today = new Date().toISOString().split('T')[0];
  const iterEntry = draft.iterationPlan.find(e => e.iter === iterNum && e.module === moduleName);
  const moduleInfo = draft.modules[moduleName] || {};
  const isStory0 = storyIndex === 0;

  // 工作項目表 (v2.1: 支援 Modify 類型)
  const workItems = actions.map((a, i) => {
    const isModify = (a.techName || '').includes('[Modify]');
    const actionType = isModify ? 'MODIFY' : 'FEATURE';
    const cleanName = (a.techName || '').replace(/\s*\[Modify\]/i, '').trim();
    return `| ${i + 1} | ${cleanName} | ${actionType} | ${a.priority} | ✅ 明確 | - |`;
  }).join('\n');

  // Item 詳細規格
  const itemSpecs = actions.map((a, i) => {
    const isModify = (a.techName || '').includes('[Modify]');
    const cleanName = (a.techName || '').replace(/\s*\[Modify\]/i, '').trim();
    const actionType = isModify ? 'MODIFY' : 'FEATURE';
    const fileAction = isModify ? 'Modify' : 'New';
    const evolution = a.evolution || a['演化'] || 'BASE';

    const testStrategy = inferTestStrategy(a.priority);
    const testFile = inferTestFile(cleanName, a.type);
    const depsStr = resolveDeps(a.deps, moduleInfo.deps);
    const depsRisk = inferDepsRisk(depsStr);
    const stepAnchors = generateStepAnchors(a.flow);
    const filePath = inferFilePath(cleanName, a.type, moduleName);
    const acRef = (a.ac || a['AC'] || '').trim();
    const acBlock = acRef && acRef !== '-'
      ? `\n**驗收條件**: ${acRef}`
      : '';

    return `### Item ${i + 1}: ${cleanName}

**Type**: ${actionType} | **Priority**: ${a.priority}${evolution !== 'BASE' ? ` | **Evolution**: ${evolution}` : ''}${acBlock}

\`\`\`typescript
// @GEMS-FUNCTION: ${cleanName}
/**
 * GEMS: ${cleanName} | ${a.priority} | ○○ | (args)→Result | ${storyId} | ${a.semantic}
 * GEMS-FLOW: ${a.flow || 'TODO'}
 * GEMS-DEPS: ${depsStr}
 * GEMS-DEPS-RISK: ${depsRisk}
 * GEMS-TEST: ${testStrategy}
 * GEMS-TEST-FILE: ${testFile}
 */
${acRef && acRef !== '-' ? acRef.split(/[,;]\s*/).map(ac => `// ${ac.trim()}`).join('\n') + '\n' : ''}${stepAnchors}
\`\`\`

**檔案**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| \`${filePath}\` | ${fileAction} | ${a.semantic} |`;
  }).join('\n\n---\n\n');

  // Integration 規範
  const p0p1Actions = actions.filter(a => a.priority === 'P0' || a.priority === 'P1');
  const integrationSpec = p0p1Actions.length > 0
    ? p0p1Actions.map(a => {
        const cleanName = (a.techName || '').replace(/\s*\[Modify\]/i, '').trim();
        return `- ${cleanName}: 禁止 mock 依賴，使用真實實例`;
      }).join('\n')
    : '- 本 Story 無 P0/P1 函式，無需 Integration 測試';

  // 範圍清單 (清除 [Modify] 標記)
  const scopeNames = actions.map(a => (a.techName || '').replace(/\s*\[Modify\]/i, '').trim()).join(', ');

  return `# Implementation Plan - ${storyId}

**迭代**: iter-${iterNum}
**Story ID**: ${storyId}
**日期**: ${today}
**目標模組**: ${moduleName}
**來源**: 活藍圖自動生成 (draft-to-plan v1.0)

> Status: READY FOR BUILD

---

## 1. Story 目標

**一句話目標**: ${iterEntry ? iterEntry.goal : `實作 ${moduleName} 模組`}

**範圍**:
- ✅ 包含: ${scopeNames}
- ❌ 不包含: 非本 Story 的功能

---

## 2. 模組資訊

- **Story 類型**: ${isStory0 ? '[x] Story-X.0' : '[ ] Story-X.0'} | ${isStory0 ? '[ ] 功能模組' : '[x] 功能模組'}
- **模組名稱**: ${moduleName}
- **模組類型**: ${isStory0 ? 'infrastructure' : 'feature'}
- **是否新模組**: ✅ 是

---

## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
${workItems}

---

## 4. Item 詳細規格

${itemSpecs}

---

## 5. Integration 非 Mock 規範

${integrationSpec}

---

## 8. 架構審查

| 檢查項目 | 結果 |
|----------|------|
| 模組化結構 | ✅ |
| 依賴方向 | ✅ ${moduleName} → ${(iterEntry?.deps || []).join(', ') || 'shared'} |
| 複雜度 | ✅ ${actions.length} 個動作 |

---

**產出日期**: ${today}
**生成方式**: draft-to-plan.cjs (機械轉換，零 AI 推導)
`;
}

// ============================================
// 骨架預生成 (v1.1)
// ============================================

/**
 * 為一個 Story 的所有動作生成 .ts/.tsx 骨架檔
 * 骨架包含：完整 GEMS 標籤 + AC 行 + [STEP] 錨點 + export 簽名
 * 
 * @param {string} targetDir - 專案根目錄
 * @param {number} iterNum - 迭代編號
 * @param {number} storyIndex - Story 索引
 * @param {string} moduleName - 模組名稱
 * @param {Array} actions - 動作清單
 * @param {object} options - { dryRun }
 * @returns {{ generated: string[], skipped: string[] }}
 */
function generateScaffold(targetDir, iterNum, storyIndex, moduleName, actions, options = {}) {
  const storyId = `Story-${iterNum}.${storyIndex}`;
  const result = { generated: [], skipped: [] };
  const moduleDeps = options.moduleDeps || [];

  for (const a of actions) {
    const isModify = (a.techName || '').includes('[Modify]');
    if (isModify) {
      const cleanName = (a.techName || '').replace(/\s*\[Modify\]/i, '').trim();
      result.skipped.push(`${cleanName} (Modify)`);
      continue;
    }

    const cleanName = (a.techName || '').replace(/\s*\[Modify\]/i, '').trim();
    const kebab = cleanName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();

    const filePath = inferFilePath(cleanName, a.type, moduleName);
    const fullPath = path.join(targetDir, filePath);

    // 如果檔案已存在，跳過（不覆蓋）
    if (fs.existsSync(fullPath)) {
      result.skipped.push(`${cleanName} (exists)`);
      continue;
    }

    const isTsx = filePath.endsWith('.tsx');
    const depsStr = resolveDeps(a.deps, moduleDeps);
    const depsRisk = inferDepsRisk(depsStr);
    const testStrategy = inferTestStrategy(a.priority);
    const testFile = inferTestFile(cleanName, a.type);

    // AC 行
    const acRef = (a.ac || a['AC'] || '').trim();
    const acLines = [];
    if (acRef && acRef !== '-') {
      // 支援多個 AC（逗號分隔）
      const acIds = acRef.split(/[,;]\s*/);
      for (const acId of acIds) {
        const trimmed = acId.trim();
        if (trimmed) {
          acLines.push(`// ${trimmed}`);
        }
      }
    }

    // FLOW → [STEP] 錨點
    const flow = a.flow || 'TODO';
    const steps = flow.split('→').map(s => s.trim()).filter(Boolean);
    const stepLines = steps.map(s => `// [STEP] ${s}`);

    // 組裝骨架內容
    const lines = [
      `// ${filePath} (由 draft-to-plan 自動生成)`,
      '',
      '/**',
      ` * GEMS: ${cleanName} | ${a.priority} | ○○ | (args)→Result | ${storyId} | ${a.semantic || cleanName}`,
      ` * GEMS-FLOW: ${flow}`,
      ` * GEMS-DEPS: ${depsStr}`,
      ` * GEMS-DEPS-RISK: ${depsRisk}`,
      ` * GEMS-TEST: ${testStrategy}`,
      ` * GEMS-TEST-FILE: ${testFile}`,
      ' */',
      ...acLines,
      ...stepLines,
    ];

    // export 簽名
    if (isTsx) {
      lines.push(`export default function ${cleanName}() {`);
      lines.push(`  throw new Error('Not implemented — ${storyId}');`);
      lines.push('}');
    } else {
      lines.push(`export function ${cleanName}(/* TODO */) {`);
      lines.push(`  throw new Error('Not implemented — ${storyId}');`);
      lines.push('}');
    }
    lines.push('');

    if (options.dryRun) {
      result.generated.push(`${cleanName} → ${filePath} (dry-run)`);
    } else {
      // 確保目錄存在
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
      result.generated.push(`${cleanName} → ${filePath}`);
    }
  }

  return result;
}

// ============================================
// 主程式
// ============================================
function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
Draft-to-Plan v1.1 - 藍圖→執行計畫 機械轉換器

用法:
  node sdid-tools/draft-to-plan.cjs --draft=<path> --iter=1 --target=<project>

選項:
  --draft=<path>    活藍圖路徑 (必填)
  --iter=<N>        迭代編號 (預設: 1)
  --target=<path>   專案根目錄 (必填)
  --dry-run         預覽模式，不寫入檔案
  --no-scaffold     不生成 .ts 骨架檔
  --help            顯示此訊息
`);
    process.exit(0);
  }

  // 門控規格 - 告訴 AI 這步會檢查什麼
  const gateSpec = {
    checks: [
      { name: '--draft 參數', pattern: '活藍圖路徑', desc: '必須指定 --draft=<path>' },
      { name: '--target 參數', pattern: '專案根目錄', desc: '必須指定 --target=<project>' },
      { name: '藍圖可解析', pattern: 'parser.load()', desc: '藍圖格式必須正確 (通過 Gate)' },
      { name: 'iter 有模組', pattern: 'moduleActions[iter-N]', desc: '目標 iter 必須有 Full 動作清單' },
      { name: '動作清單非空', pattern: 'items.length > 0', desc: '每個模組至少有一個動作' },
    ]
  };

  if (!args.draft || !args.target) {
    logOutput.anchorErrorSpec({
      targetFile: 'CLI 參數',
      missing: !args.draft && !args.target ? ['--draft', '--target'] : !args.draft ? ['--draft'] : ['--target'],
      example: `node sdid-tools/draft-to-plan.cjs --draft=<project>/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md --iter=1 --target=<project>`,
      nextCmd: 'node sdid-tools/draft-to-plan.cjs --draft=<path> --iter=N --target=<project>',
      gateSpec
    });
    process.exit(1);
  }

  // 解析藍圖
  let draft, stats, modules;
  try {
    draft = parser.load(args.draft);
    stats = parser.calculateStats(draft);
    modules = parser.getModulesByIter(draft, args.iter);
  } catch (err) {
    logOutput.anchorError('BLOCKER',
      `藍圖解析失敗: ${err.message}`,
      `先通過 Gate: node sdid-tools/blueprint-gate.cjs --draft=${args.draft} --target=${args.target}`,
      {
        projectRoot: args.target,
        iteration: args.iter,
        phase: 'gate',
        step: 'plan',
        details: `解析錯誤: ${err.message}\n\n可能原因:\n1. 藍圖格式不正確\n2. 尚未通過 Gate 門控\n3. 檔案編碼問題`,
      }
    );
    process.exit(1);
  }

  console.log(`\n📐 Draft-to-Plan v1.1`);
  console.log(`   藍圖: ${path.basename(args.draft)}`);
  console.log(`   Level: ${stats.level || '?'} | 迭代: iter-${args.iter}`);
  console.log(`   模組: ${modules.map(m => m.id).join(', ')}`);
  console.log(`   骨架: ${args.scaffold ? '✅ 開啟' : '❌ 關閉'}`);
  console.log('');

  if (modules.length === 0) {
    logOutput.anchorError('BLOCKER',
      `iter-${args.iter} 沒有模組 — 藍圖中該 iter 可能全是 [STUB] 或 [DONE]`,
      `確認藍圖中 iter-${args.iter} 有 [CURRENT] 標記的模組，或換一個 iter: --iter=${args.iter + 1}`,
      {
        projectRoot: args.target,
        iteration: args.iter,
        phase: 'gate',
        step: 'plan',
        details: `藍圖: ${path.basename(args.draft)}\nLevel: ${stats.level || '?'}\n\n目標 iter-${args.iter} 沒有可展開的模組。\n\n可能原因:\n1. 所有模組都是 [STUB] (尚未展開)\n2. 所有模組都是 [DONE] (已完成)\n3. iter 編號錯誤`,
      }
    );
    process.exit(1);
  }

  // 確保 plan 目錄存在
  const planDir = path.join(args.target, '.gems', 'iterations', `iter-${args.iter}`, 'plan');
  if (!args.dryRun) {
    fs.mkdirSync(planDir, { recursive: true });
  }

  // log 選項
  const logOptions = {
    projectRoot: args.target,
    iteration: args.iter,
    phase: 'gate',
    step: 'plan',
  };

  // 為每個模組生成 implementation_plan
  let storyIndex = 0;
  const generated = [];

  for (const mod of modules) {
    if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') {
      console.log(`   ⏭️ ${mod.id} (${mod.fillLevel}) — 跳過`);
      continue;
    }

    if (mod.actions.length === 0) {
      console.log(`   ⚠️ ${mod.id} 沒有動作清單 — 跳過`);
      continue;
    }

    const storyId = `Story-${args.iter}.${storyIndex}`;
    const planContent = generatePlan(draft, args.iter, storyIndex, mod.id, mod.actions);
    const planFile = path.join(planDir, `implementation_plan_${storyId}.md`);

    if (args.dryRun) {
      console.log(`   [dry-run] ${storyId} → ${mod.id} (${mod.actions.length} 動作)`);
    } else {
      fs.writeFileSync(planFile, planContent, 'utf8');
      console.log(`   ✅ ${storyId} → ${path.relative(args.target, planFile)}`);

      // Plan Protocol: 出口驗證 (WARNING 級，不阻擋)
      const valResult = validatePlan(planFile);
      if (!valResult.valid) {
        console.log(`   ⚠️  Plan Schema WARNING (${storyId}):`);
        for (const e of valResult.errors) {
          console.log(`      [${e.rule}] ${e.message}`);
        }
      }
      if (valResult.warnings.length > 0) {
        for (const w of valResult.warnings) {
          console.log(`      [${w.rule}] ${w.message}`);
        }
      }
    }

    generated.push({ storyId, module: mod.id, actions: mod.actions.length, file: planFile });
    storyIndex++;
  }

  // ============================================
  // 骨架預生成
  // ============================================
  if (args.scaffold && !args.dryRun && generated.length > 0) {
    console.log(`\n🦴 骨架預生成:`);
    let totalScaffold = 0;
    let totalSkipped = 0;

    // 重新遍歷 modules（跟上面同樣的邏輯）
    let scaffoldIdx = 0;
    for (const mod of modules) {
      if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;
      if (mod.actions.length === 0) continue;

      const scaffoldResult = generateScaffold(
        args.target, args.iter, scaffoldIdx, mod.id, mod.actions,
        { dryRun: args.dryRun, moduleDeps: mod.deps }
      );

      for (const g of scaffoldResult.generated) {
        console.log(`   🦴 ${g}`);
      }
      for (const s of scaffoldResult.skipped) {
        console.log(`   ⏭️ ${s}`);
      }

      totalScaffold += scaffoldResult.generated.length;
      totalSkipped += scaffoldResult.skipped.length;
      scaffoldIdx++;
    }

    console.log(`   📊 骨架: ${totalScaffold} 生成, ${totalSkipped} 跳過`);
  } else if (args.dryRun && args.scaffold) {
    console.log(`\n🦴 骨架預生成 (dry-run):`);
    let scaffoldIdx = 0;
    for (const mod of modules) {
      if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;
      if (mod.actions.length === 0) continue;

      const scaffoldResult = generateScaffold(
        args.target, args.iter, scaffoldIdx, mod.id, mod.actions,
        { dryRun: true, moduleDeps: mod.deps }
      );

      for (const g of scaffoldResult.generated) {
        console.log(`   [dry-run] 🦴 ${g}`);
      }
      scaffoldIdx++;
    }
  }

  console.log(`\n📊 結果: ${generated.length} 個 implementation_plan 生成`);

  if (generated.length === 0) {
    logOutput.anchorError('BLOCKER',
      `iter-${args.iter} 所有模組都被跳過 — 沒有產出任何 plan`,
      `確認藍圖中 iter-${args.iter} 有 Full 動作清單 (非 stub/done)`,
      {
        projectRoot: args.target,
        iteration: args.iter,
        phase: 'gate',
        step: 'plan',
        details: `藍圖: ${path.basename(args.draft)}\n模組: ${modules.map(m => `${m.id} (${m.fillLevel})`).join(', ')}\n\n所有模組都是 stub 或 done，沒有可轉換的動作清單。`,
      }
    );
    process.exit(1);
  }

  if (!args.dryRun) {
    const nextCmd = `node task-pipe/runner.cjs --phase=BUILD --step=1 --target=${args.target} --iteration=iter-${args.iter} --story=${generated[0].storyId}`;
    const summary = `draft-to-plan 完成 — ${generated.length} 個 Story plan 產出`;
    const details = generated.map(g => `${g.storyId} → ${g.module} (${g.actions} 動作)`).join('\n');

    logOutput.anchorPass('gate', 'plan', summary, nextCmd, {
      ...logOptions,
      details,
    });
  }
}

// ============================================
// 導出
// ============================================
module.exports = { generatePlan, generateScaffold, inferDepsRisk, inferTestStrategy, inferTestFile, inferFilePath };

if (require.main === module) {
  main();
}
