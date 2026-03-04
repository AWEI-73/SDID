#!/usr/bin/env node
/**
 * Blueprint Verify v1.0 - 藍圖↔源碼 雙向語意比對
 * 
 * 比較活藍圖的動作清單 vs SCAN 產出的 functions.json，
 * 輸出語意差異報告 (什麼該有但沒有、什麼有但不在藍圖中)。
 * 
 * 獨立工具，不 import task-pipe。
 * 
 * 用法:
 *   node sdid-tools/blueprint-verify.cjs --draft=<path> --functions=<path> [--iter=1] [--out=<dir>]
 *   node sdid-tools/blueprint-verify.cjs --draft=<path> --target=<project> [--iter=1]
 * 
 * 輸出 (寫入 .gems/docs/ 或 --out):
 *   blueprint-verify.json  — 結構化差異
 *   BLUEPRINT_VERIFY.md    — 人類可讀報告
 */

const fs = require('fs');
const path = require('path');
const parser = require('./lib/draft-parser-standalone.cjs');
const logOutput = require('../task-pipe/lib/shared/log-output.cjs');

// ============================================
// 參數解析
// ============================================
function parseArgs() {
  const args = {
    draft: null, functions: null, target: null,
    iter: null, out: null, dryRun: false, help: false
  };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--draft=')) args.draft = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--functions=')) args.functions = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--target=')) args.target = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iter=')) args.iter = parseInt(arg.split('=')[1]);
    else if (arg.startsWith('--out=')) args.out = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ============================================
// 載入 functions.json
// ============================================
function loadFunctions(functionsPath) {
  if (!fs.existsSync(functionsPath)) {
    throw new Error(`functions.json not found: ${functionsPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(functionsPath, 'utf8'));
  // 支援兩種格式: { functions: [...] } 或直接陣列
  const list = raw.functions || raw;
  if (!Array.isArray(list)) {
    throw new Error('functions.json 格式錯誤: 預期 functions 陣列');
  }
  return list;
}

// ============================================
// 從藍圖提取動作清單 (已完成 + 當前 iter)
// ============================================
function extractBlueprintActions(draft, targetIter) {
  const actions = [];
  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.fillLevel === 'stub') continue; // 跳過 Stub
    // 收集所有 iter <= targetIter 的非 stub 動作
    if (mod.iter > targetIter) continue;
    for (const item of (mod.items || [])) {
      actions.push({
        techName: item.techName,
        module: modName,
        iter: mod.iter,
        priority: item.priority,
        flow: item.flow,
        deps: item.deps,
        status: item.status,
        type: item.type,
        semantic: item.semantic,
        evolution: item.evolution || 'BASE',
      });
    }
  }
  return actions;
}

// ============================================
// 名稱正規化 (模糊比對用)
// ============================================
function normalize(name) {
  if (!name) return '';
  return name
    .replace(/[-_]/g, '')
    .toLowerCase()
    .trim();
}

// ============================================
// 雙向比對
// ============================================
function compareActions(blueprintActions, codeFunctions) {
  const result = {
    matched: [],      // 藍圖有、程式碼也有
    missing: [],      // 藍圖有、程式碼沒有
    extra: [],        // 程式碼有、藍圖沒有
    mismatches: [],   // 都有但屬性不一致
  };

  // 建立程式碼函式索引 (正規化名稱 → 函式)
  const codeIndex = new Map();
  const codeUsed = new Set();
  for (const fn of codeFunctions) {
    const key = normalize(fn.name);
    if (!codeIndex.has(key)) codeIndex.set(key, []);
    codeIndex.get(key).push(fn);
  }

  // 1. 藍圖 → 程式碼 (找 missing)
  for (const bp of blueprintActions) {
    const key = normalize(bp.techName);
    const candidates = codeIndex.get(key);

    if (!candidates || candidates.length === 0) {
      result.missing.push({
        techName: bp.techName,
        module: bp.module,
        iter: bp.iter,
        priority: bp.priority,
        reason: '藍圖定義但程式碼中找不到對應函式',
      });
      continue;
    }

    // 找到了，檢查屬性一致性
    const codeFn = candidates[0];
    codeUsed.add(normalize(codeFn.name));

    const mismatches = [];

    // 優先級比對
    if (bp.priority && codeFn.priority && bp.priority !== codeFn.priority) {
      // risk 欄位可能是 priority 的別名
      const codePriority = codeFn.priority || codeFn.risk;
      if (bp.priority !== codePriority) {
        mismatches.push({
          field: 'priority',
          blueprint: bp.priority,
          code: codePriority,
        });
      }
    }

    // Flow 比對 (只比較步驟數，不比較具體名稱)
    if (bp.flow && codeFn.flow) {
      const bpSteps = bp.flow.split('→').length;
      const codeSteps = codeFn.flow.split('→').length;
      if (Math.abs(bpSteps - codeSteps) > 2) {
        mismatches.push({
          field: 'flow',
          blueprint: `${bpSteps} 步 (${bp.flow})`,
          code: `${codeSteps} 步 (${codeFn.flow})`,
        });
      }
    }

    // Story 比對
    if (bp.iter && codeFn.storyId) {
      const expectedStoryPrefix = `Story-${bp.iter}.`;
      if (!codeFn.storyId.startsWith(expectedStoryPrefix)) {
        mismatches.push({
          field: 'storyId',
          blueprint: `iter-${bp.iter} (預期 ${expectedStoryPrefix}*)`,
          code: codeFn.storyId,
        });
      }
    }

    if (mismatches.length > 0) {
      result.mismatches.push({
        techName: bp.techName,
        module: bp.module,
        file: codeFn.file,
        issues: mismatches,
      });
    }

    result.matched.push({
      techName: bp.techName,
      module: bp.module,
      file: codeFn.file,
      priority: bp.priority,
      startLine: codeFn.startLine,
      endLine: codeFn.endLine,
    });
  }

  // 2. 程式碼 → 藍圖 (找 extra)
  for (const fn of codeFunctions) {
    const key = normalize(fn.name);
    if (!codeUsed.has(key)) {
      result.extra.push({
        name: fn.name,
        file: fn.file,
        priority: fn.priority || fn.risk,
        storyId: fn.storyId,
        reason: '程式碼中存在但藍圖未定義',
      });
    }
  }

  return result;
}

// ============================================
// AC 覆蓋比對
// ============================================
/**
 * 比對 plan 中定義的 AC ID vs 源碼函式已標記的 AC ID
 * @param {string[]} planAcIds - 從 plan 文件提取的 AC ID 清單
 * @param {Array} codeFunctions - scanner 掃出的函式（含 acIds 欄位）
 * @returns {{ tagged: string[], untagged: string[], total: number }}
 */
function checkACCoverage(planAcIds, codeFunctions) {
  // 收集源碼中已標記的 AC ID
  const taggedAcIds = new Set();
  for (const fn of codeFunctions) {
    if (fn.acIds && fn.acIds.length > 0) {
      for (const id of fn.acIds) taggedAcIds.add(id);
    }
  }

  const tagged = [];
  const untagged = [];
  for (const acId of planAcIds) {
    if (taggedAcIds.has(acId)) {
      tagged.push(acId);
    } else {
      untagged.push(acId);
    }
  }

  return { tagged, untagged, total: planAcIds.length };
}

/**
 * 從 plan 目錄提取所有 AC ID（格式: AC-X.Y 或 AC-X.Y.Z）
 * @param {string} planDir - plan 目錄路徑
 * @returns {string[]}
 */
function extractPlanAcIds(planDir) {
  if (!fs.existsSync(planDir)) return [];
  const acIds = new Set();
  const planFiles = fs.readdirSync(planDir).filter(f => f.startsWith('implementation_plan_'));
  for (const planFile of planFiles) {
    const content = fs.readFileSync(path.join(planDir, planFile), 'utf8');
    const pattern = /\bAC-([\d]+\.[\d.]+)\b/g;
    let m;
    while ((m = pattern.exec(content)) !== null) {
      acIds.add(`AC-${m[1]}`);
    }
  }
  return [...acIds];
}

// ============================================
// 報告生成: JSON
// ============================================
function generateVerifyJson(draft, comparison, args, acCoverage) {
  const stats = parser.calculateStats(draft);
  return {
    $schema: 'blueprint-verify-v1.0',
    generatedAt: new Date().toISOString(),
    blueprint: path.basename(args.draft),
    targetIter: args.iter,
    summary: {
      blueprintActions: comparison.matched.length + comparison.missing.length,
      codeFunctions: comparison.matched.length + comparison.extra.length,
      matched: comparison.matched.length,
      missing: comparison.missing.length,
      extra: comparison.extra.length,
      mismatches: comparison.mismatches.length,
      coverage: comparison.matched.length > 0
        ? Math.round(comparison.matched.length / (comparison.matched.length + comparison.missing.length) * 100)
        : 0,
      acTotal: acCoverage ? acCoverage.total : 0,
      acTagged: acCoverage ? acCoverage.tagged.length : 0,
      acUntagged: acCoverage ? acCoverage.untagged.length : 0,
    },
    matched: comparison.matched,
    missing: comparison.missing,
    extra: comparison.extra,
    mismatches: comparison.mismatches,
    acCoverage: acCoverage || null,
  };
}

// ============================================
// 報告生成: Markdown
// ============================================
function generateVerifyMarkdown(verifyJson) {
  const s = verifyJson.summary;
  const lines = [
    `# 📐 Blueprint Verify Report`,
    ``,
    `> 藍圖: ${verifyJson.blueprint}`,
    `> 目標迭代: iter-${verifyJson.targetIter}`,
    `> 產出時間: ${verifyJson.generatedAt}`,
    ``,
    `## 摘要`,
    ``,
    `| 指標 | 數量 |`,
    `|------|------|`,
    `| 藍圖動作數 | ${s.blueprintActions} |`,
    `| 程式碼函式數 | ${s.codeFunctions} |`,
    `| ✅ 匹配 | ${s.matched} |`,
    `| ❌ 缺失 (藍圖有、碼沒有) | ${s.missing} |`,
    `| ⚠️ 多餘 (碼有、藍圖沒有) | ${s.extra} |`,
    `| 🔄 屬性不一致 | ${s.mismatches} |`,
    `| 覆蓋率 | ${s.coverage}% |`,
    `| AC 總數 | ${s.acTotal} |`,
    `| AC 已標記 | ${s.acTagged} |`,
    `| AC 未標記 | ${s.acUntagged} |`,
    ``,
  ];

  // AC 未標記
  if (verifyJson.acCoverage && verifyJson.acCoverage.untagged.length > 0) {
    lines.push(`## ⚠️ AC 未標記（源碼函式缺少 // AC-X.Y 行）`);
    lines.push(``);
    for (const acId of verifyJson.acCoverage.untagged) {
      lines.push(`- ${acId}`);
    }
    lines.push(``);
  }

  // Missing
  if (verifyJson.missing.length > 0) {
    lines.push(`## ❌ 缺失函式 (藍圖有、程式碼沒有)`);
    lines.push(``);
    lines.push(`| 技術名稱 | 模組 | 優先級 | 迭代 |`);
    lines.push(`|---------|------|--------|------|`);
    for (const m of verifyJson.missing) {
      lines.push(`| ${m.techName} | ${m.module} | ${m.priority} | iter-${m.iter} |`);
    }
    lines.push(``);
  }

  // Extra
  if (verifyJson.extra.length > 0) {
    lines.push(`## ⚠️ 多餘函式 (程式碼有、藍圖沒有)`);
    lines.push(``);
    lines.push(`| 函式名 | 檔案 | 優先級 | Story |`);
    lines.push(`|--------|------|--------|-------|`);
    for (const e of verifyJson.extra) {
      lines.push(`| ${e.name} | ${e.file} | ${e.priority || '?'} | ${e.storyId || '?'} |`);
    }
    lines.push(``);
  }

  // Mismatches
  if (verifyJson.mismatches.length > 0) {
    lines.push(`## 🔄 屬性不一致`);
    lines.push(``);
    for (const mm of verifyJson.mismatches) {
      lines.push(`### ${mm.techName} (${mm.module})`);
      lines.push(`檔案: \`${mm.file}\``);
      lines.push(``);
      lines.push(`| 欄位 | 藍圖 | 程式碼 |`);
      lines.push(`|------|------|--------|`);
      for (const issue of mm.issues) {
        lines.push(`| ${issue.field} | ${issue.blueprint} | ${issue.code} |`);
      }
      lines.push(``);
    }
  }

  // Matched
  if (verifyJson.matched.length > 0) {
    lines.push(`## ✅ 匹配函式`);
    lines.push(``);
    lines.push(`| 技術名稱 | 模組 | 檔案 | 行號 |`);
    lines.push(`|---------|------|------|------|`);
    for (const m of verifyJson.matched) {
      const lineInfo = m.startLine ? `L${m.startLine}-${m.endLine}` : '-';
      lines.push(`| ${m.techName} | ${m.module} | ${m.file} | ${lineInfo} |`);
    }
    lines.push(``);
  }

  return lines.join('\n');
}

// ============================================
// 主程式
// ============================================
function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
Blueprint Verify v1.0 - 藍圖↔源碼 雙向語意比對

用法:
  node sdid-tools/blueprint-verify.cjs --draft=<path> --functions=<path> [--iter=1]
  node sdid-tools/blueprint-verify.cjs --draft=<path> --target=<project> [--iter=1]

選項:
  --draft=<path>       活藍圖路徑 (必填)
  --functions=<path>   functions.json 路徑 (與 --target 二選一)
  --target=<path>      專案根目錄 (自動找 .gems/docs/functions.json)
  --iter=<N>           目標迭代 (預設: 自動偵測 [CURRENT])
  --out=<dir>          輸出目錄 (預設: .gems/docs/)
  --dry-run            預覽模式
  --help               顯示此訊息

輸出:
  blueprint-verify.json  — 結構化差異
  BLUEPRINT_VERIFY.md    — 人類可讀報告
`);
    process.exit(0);
  }

  if (!args.draft) {
    console.error('❌ 請指定 --draft=<path>');
    process.exit(1);
  }

  // 解析藍圖
  const rawContent = fs.readFileSync(args.draft, 'utf8');
  const draft = parser.parse(rawContent);

  // 自動偵測 iter
  if (!args.iter) {
    args.iter = parser.getCurrentIter(draft);
  }

  // 載入 functions.json
  let functionsPath = args.functions;
  if (!functionsPath && args.target) {
    functionsPath = path.join(args.target, '.gems', 'docs', 'functions.json');
  }
  if (!functionsPath) {
    console.error('❌ 請指定 --functions=<path> 或 --target=<project>');
    process.exit(1);
  }

  if (!fs.existsSync(functionsPath)) {
    // Wave 3.1: Auto-scan if functions.json missing (Blueprint Flow doesn't require SCAN)
    const scannerV2Path = path.resolve(__dirname, 'gems-scanner-v2.cjs');
    if (args.target && fs.existsSync(scannerV2Path)) {
      try {
        const { scanV2 } = require(scannerV2Path);
        const srcDir = path.join(args.target, 'src');
        if (fs.existsSync(srcDir)) {
          console.log('   ℹ️  functions.json 不存在，自動掃描源碼...');
          const scanResult = scanV2(srcDir, args.target);
          const docsDir = path.dirname(functionsPath);
          if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
          const output = {
            functions: scanResult.functions.map(f => ({
              name: f.name, file: f.file, startLine: f.startLine, endLine: f.endLine,
              priority: f.priority, flow: f.flow, deps: f.deps, depsRisk: f.depsRisk,
              test: f.test, testFile: f.testFile, description: f.description,
              gemsId: f.gemsId || null, storyId: null,
            })),
            stats: scanResult.stats,
            generatedBy: 'blueprint-verify auto-scan',
            generatedAt: new Date().toISOString(),
          };
          fs.writeFileSync(functionsPath, JSON.stringify(output, null, 2), 'utf8');
          console.log(`   ✅ 自動產出: ${functionsPath} (${scanResult.functions.length} 函式)`);
        }
      } catch (e) {
        console.log(`   ⚠️ 自動掃描失敗: ${e.message}`);
      }
    }
  }

  if (!fs.existsSync(functionsPath)) {
    const logProjectRoot = args.target || null;
    const logOptions = logProjectRoot ? {
      projectRoot: logProjectRoot,
      iteration: args.iter,
      phase: 'gate',
      step: 'verify',
    } : {};
    const errMsg = `functions.json 不存在: ${functionsPath}`;
    const fixCmd = args.target
      ? `先執行 SCAN 產出 functions.json: node task-pipe/runner.cjs --phase=SCAN --target=${args.target}`
      : `請先執行 SCAN 階段或用 --functions= 指定 functions.json 路徑`;
    if (logProjectRoot) {
      logOutput.anchorError('ARCHITECTURE_REVIEW', errMsg, fixCmd, logOptions);
    } else {
      console.error(`@BLOCKER | ${errMsg}`);
      console.error(`修復: ${fixCmd}`);
    }
    process.exit(1);
  }

  const codeFunctions = loadFunctions(functionsPath);

  // 提取藍圖動作
  let blueprintActions = extractBlueprintActions(draft, args.iter);

  // v1.1: Fallback — 如果藍圖動作為空（SHRINK 後動作被收縮為摘要），
  // 從 implementation_plan 提取動作清單
  if (blueprintActions.length === 0 && args.target) {
    const planDir = path.join(args.target, '.gems', 'iterations', `iter-${args.iter}`, 'plan');
    if (fs.existsSync(planDir)) {
      const planFiles = fs.readdirSync(planDir).filter(f => f.startsWith('implementation_plan_'));
      for (const planFile of planFiles) {
        const planContent = fs.readFileSync(path.join(planDir, planFile), 'utf8');
        // 從 plan 提取 GEMS 標籤中的函式名稱和 priority
        const storyMatch = planFile.match(/Story-(\d+\.\d+)/);
        const storyId = storyMatch ? `Story-${storyMatch[1]}` : null;
        // 找 @GEMS-FUNCTION 或 GEMS: funcName | P0 格式
        const gemsPattern = /(?:@GEMS-FUNCTION:\s*(\w+)|GEMS:\s*(\w+)\s*\|\s*(P[0-3]))/g;
        let m;
        while ((m = gemsPattern.exec(planContent)) !== null) {
          const techName = m[1] || m[2];
          const priority = m[3] || 'P1';
          // 從 plan 內容提取 flow
          const flowPattern = new RegExp(`GEMS-FLOW:\\s*([^\\n]+)`, 'g');
          // 找最近的 FLOW（在此 GEMS 標籤之後）
          const afterMatch = planContent.substring(m.index);
          const flowMatch = afterMatch.match(/GEMS-FLOW:\s*([^\n]+)/);
          const flow = flowMatch ? flowMatch[1].trim() : '';
          // 找模組名稱
          const moduleMatch = planContent.match(/\*\*目標模組\*\*:\s*(\S+)/);
          const moduleName = moduleMatch ? moduleMatch[1] : 'unknown';
          
          // 避免重複
          if (!blueprintActions.some(a => a.techName === techName)) {
            blueprintActions.push({
              techName,
              module: moduleName,
              iter: args.iter,
              priority,
              flow,
              deps: null,
              status: 'DONE',
              type: 'FEATURE',
              semantic: null,
              evolution: 'BASE',
            });
          }
        }
      }
      if (blueprintActions.length > 0) {
        console.log(`   ℹ️  藍圖已收縮，改從 ${planFiles.length} 個 plan 提取 ${blueprintActions.length} 個動作`);
      }
    }
  }

  console.log(`\n📐 Blueprint Verify v1.0`);
  console.log(`   藍圖: ${path.basename(args.draft)} (iter-${args.iter})`);
  console.log(`   函式: ${path.basename(functionsPath)} (${codeFunctions.length} 個)`);
  console.log(`   藍圖動作: ${blueprintActions.length} 個`);
  console.log('');

  // 比對
  const comparison = compareActions(blueprintActions, codeFunctions);

  // AC 覆蓋比對
  let acCoverage = null;
  if (args.target) {
    const planDir = path.join(args.target, '.gems', 'iterations', `iter-${args.iter}`, 'plan');
    const planAcIds = extractPlanAcIds(planDir);
    if (planAcIds.length > 0) {
      acCoverage = checkACCoverage(planAcIds, codeFunctions);
      console.log(`   AC 覆蓋: ${acCoverage.tagged.length}/${acCoverage.total} 已標記${acCoverage.untagged.length > 0 ? ` (未標記: ${acCoverage.untagged.join(', ')})` : ' ✅'}`);
    }
  }

  // 生成報告
  const verifyJson = generateVerifyJson(draft, comparison, args, acCoverage);
  const verifyMd = generateVerifyMarkdown(verifyJson);

  // 輸出
  const outDir = args.out || (args.target ? path.join(args.target, '.gems', 'docs') : null);

  if (outDir && !args.dryRun) {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'blueprint-verify.json'), JSON.stringify(verifyJson, null, 2), 'utf8');
    fs.writeFileSync(path.join(outDir, 'BLUEPRINT_VERIFY.md'), verifyMd, 'utf8');
    console.log(`   ✅ 輸出: ${path.relative(process.cwd(), outDir)}/blueprint-verify.json`);
    console.log(`   ✅ 輸出: ${path.relative(process.cwd(), outDir)}/BLUEPRINT_VERIFY.md`);
  } else if (args.dryRun) {
    console.log(`[dry-run] 不寫入檔案`);
  }

  // 摘要
  const s = verifyJson.summary;
  console.log(`\n📊 結果: ${s.matched} 匹配 | ${s.missing} 缺失 | ${s.extra} 多餘 | ${s.mismatches} 不一致`);
  console.log(`   覆蓋率: ${s.coverage}%`);
  if (s.acTotal > 0) {
    console.log(`   AC 標記: ${s.acTagged}/${s.acTotal}${s.acUntagged > 0 ? ` ⚠️ ${s.acUntagged} 個未標記` : ' ✅'}`);
  }

  // log 存檔
  const logProjectRoot = args.target || null;
  const logOptions = logProjectRoot ? {
    projectRoot: logProjectRoot,
    iteration: args.iter,
    phase: 'gate',
    step: 'verify',
  } : {};

  const details = [
    `藍圖: ${path.basename(args.draft)} (iter-${args.iter})`,
    `函式: ${path.basename(functionsPath)} (${codeFunctions.length} 個)`,
    `藍圖動作: ${blueprintActions.length} 個`,
    '',
    `匹配: ${s.matched} | 缺失: ${s.missing} | 多餘: ${s.extra} | 不一致: ${s.mismatches}`,
    `覆蓋率: ${s.coverage}%`,
  ].join('\n');

  const acAllTagged = !acCoverage || acCoverage.untagged.length === 0;

  if (s.missing === 0 && s.mismatches === 0 && acAllTagged) {
    const nextCmd = '藍圖與程式碼完全一致，可進入下一個 iter';
    if (logProjectRoot) {
      logOutput.anchorPass('gate', 'verify', `Blueprint Verify — 覆蓋率 ${s.coverage}%`, nextCmd, logOptions);
    } else {
      console.log(`\n@PASS | Blueprint Verify — 藍圖與程式碼完全一致`);
    }
  } else if (s.missing === 0 && s.mismatches === 0 && !acAllTagged) {
    const summary = `Blueprint Verify — 結構一致但 ${acCoverage.untagged.length} 個 AC 未標記 (${acCoverage.untagged.join(', ')})`;
    if (logProjectRoot) {
      logOutput.anchorError('TACTICAL_FIX', summary,
        `補齊 AC 標記後重跑: node sdid-tools/blueprint-verify.cjs --draft=${args.draft} --target=${args.target}`,
        { ...logOptions, details });
    } else {
      console.log(`\n@WARN | ${summary}`);
    }
  } else if (s.missing > 0) {
    const summary = `Blueprint Verify — ${s.missing} 個藍圖動作尚未實作 (覆蓋率 ${s.coverage}%)`;
    if (logProjectRoot) {
      logOutput.anchorError('TACTICAL_FIX', summary,
        `補齊缺失函式後重跑: node sdid-tools/blueprint-verify.cjs --draft=${args.draft} --target=${args.target}`,
        { ...logOptions, details });
    } else {
      console.log(`\n@WARN | ${summary}`);
    }
  }
  if (s.extra > 0) {
    console.log(`   💡 ${s.extra} 個程式碼函式不在藍圖中 (可能是輔助函式或需要補入藍圖)`);
  }
}

// ============================================
// 導出
// ============================================
module.exports = {
  loadFunctions,
  extractBlueprintActions,
  compareActions,
  checkACCoverage,
  extractPlanAcIds,
  generateVerifyJson,
  generateVerifyMarkdown,
  normalize,
};

if (require.main === module) {
  main();
}
