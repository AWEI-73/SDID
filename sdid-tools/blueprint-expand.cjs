#!/usr/bin/env node
/**
 * Blueprint Expand v1.0 - Stub 展開器
 * 
 * 進入新 iter 時，將 Stub 展開為 Full 動作清單。
 * 展開來源：Fillback suggestions + 公開 API + 模組定義。
 * 
 * 獨立工具，不 import task-pipe。
 * 
 * 用法:
 *   node sdid-tools/blueprint-expand.cjs --draft=<path> --iter=2 --target=<project>
 *   node sdid-tools/blueprint-expand.cjs --draft=<path> --iter=2 --target=<project> --dry-run
 * 
 * 輸出:
 *   更新後的活藍圖 (Stub → Full 動作清單骨架)
 */

const fs = require('fs');
const path = require('path');
const parser = require('./lib/draft-parser-standalone.cjs');
const logOutput = require('./lib/log-output.cjs');

// ============================================
// 參數解析
// ============================================
function parseArgs() {
  const args = { draft: null, iter: 2, target: null, out: null, dryRun: false, help: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--draft=')) args.draft = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iter=')) args.iter = parseInt(arg.split('=')[1]);
    else if (arg.startsWith('--target=')) args.target = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--out=')) args.out = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ============================================
// Fillback Suggestions 讀取
// ============================================

/**
 * 從前一個 iter 的 Fillback 讀取建議
 */
function loadPreviousFillback(projectRoot, currentIter) {
  const prevIter = currentIter - 1;
  if (prevIter < 1) return [];

  const buildDir = path.join(projectRoot, '.gems', 'iterations', `iter-${prevIter}`, 'build');
  if (!fs.existsSync(buildDir)) return [];

  const files = fs.readdirSync(buildDir)
    .filter(f => f.startsWith('iteration_suggestions_') && f.endsWith('.json'));

  const allSuggestions = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(buildDir, file), 'utf8');
      const data = JSON.parse(content);
      if (Array.isArray(data)) allSuggestions.push(...data);
      else if (data.suggestions) allSuggestions.push(...data.suggestions);
      else if (data.items) allSuggestions.push(...data.items);
    } catch (e) { /* ignore */ }
  }

  return allSuggestions;
}

// ============================================
// 動作清單推導
// ============================================

/**
 * 從公開 API 推導動作清單項目
 */
function inferActionsFromAPI(publicAPI, moduleName, deps) {
  const actions = [];
  const depsStr = deps.length > 0
    ? deps.map(d => `[Internal.${d}]`).join(', ')
    : '無';

  for (const api of publicAPI) {
    // 解析 API 簽名: functionName(args): ReturnType
    const match = api.match(/^(\w+)\s*\(/);
    if (!match) continue;

    const funcName = match[1];
    const isQuery = /get|find|search|list|fetch|query/i.test(funcName);
    const isMutation = /create|add|update|delete|remove|set/i.test(funcName);

    // 推導優先級
    let priority = 'P1';
    if (isMutation) priority = 'P0';
    else if (isQuery) priority = 'P1';

    // 推導流向
    let flow;
    if (isMutation) {
      flow = 'VALIDATE→PROCESS→PERSIST→RETURN';
    } else if (isQuery) {
      flow = 'VALIDATE→QUERY→TRANSFORM→RETURN';
    } else {
      flow = 'INIT→PROCESS→RETURN';
    }

    // 推導類型
    const type = 'SVC';

    actions.push({
      semantic: `${funcName} 功能`,
      type,
      techName: funcName,
      priority,
      flow,
      deps: depsStr,
      status: '○○',
    });
  }

  return actions;
}

/**
 * 從 Fillback suggestions 推導額外動作
 */
function inferActionsFromFillback(suggestions, moduleName) {
  const actions = [];

  for (const s of suggestions) {
    const text = s.description || s.title || s.suggestion || '';
    if (!text) continue;

    // 嘗試提取函式名
    const funcMatch = text.match(/(\w+(?:Service|Handler|Manager|Controller|Validator|Helper))/);
    const funcName = funcMatch ? funcMatch[1] : null;

    if (funcName) {
      actions.push({
        semantic: text.slice(0, 60),
        type: 'SVC',
        techName: funcName,
        priority: s.priority || 'P2',
        flow: 'TODO',
        deps: '待確認',
        status: '○○',
        source: 'fillback',
      });
    }
  }

  return actions;
}

/**
 * 為模組生成基礎設施動作 (types)
 */
function generateInfraActions(moduleName, deps) {
  const depsStr = deps.length > 0
    ? deps.map(d => `[Internal.${d}]`).join(', ')
    : '無';

  return [{
    semantic: `${moduleName} 模組型別定義`,
    type: 'CONST',
    techName: `${capitalize(moduleName)}Types`,
    priority: 'P0',
    flow: 'DEFINE→VALIDATE→FREEZE→EXPORT',
    deps: depsStr,
    status: '○○',
  }];
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================
// 藍圖展開邏輯
// ============================================

/**
 * 生成展開後的動作清單 Markdown
 */
function generateExpandedActionTable(moduleName, iterNum, actions) {
  const lines = [];
  lines.push(`### Iter ${iterNum}: ${moduleName} [CURRENT]`);
  lines.push('');
  lines.push('| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | 狀態 |');
  lines.push('|---------|------|---------|---|------|------|------|');

  for (const a of actions) {
    const sourceTag = a.source === 'fillback' ? ' ⚡' : '';
    lines.push(`| ${a.semantic}${sourceTag} | ${a.type} | ${a.techName} | ${a.priority} | ${a.flow} | ${a.deps} | ${a.status} |`);
  }

  lines.push('');
  lines.push(`> ⚠️ 此動作清單由 blueprint-expand 自動生成，請用 Gem chatbot 確認並補充 flow 細節`);
  if (actions.some(a => a.source === 'fillback')) {
    lines.push(`> ⚡ 標記項目來自前一迭代的 Fillback suggestions`);
  }

  return lines.join('\n');
}

/**
 * 在原始 Markdown 中執行展開
 */
function expandBlueprint(rawContent, draft, iterNum, projectRoot) {
  const changes = [];
  let result = rawContent;

  // 取得目標 iter 的模組
  const targetModules = draft.iterationPlan.filter(e => e.iter === iterNum);

  if (targetModules.length === 0) {
    return { content: result, changes: [{ module: '(none)', status: 'SKIP', reason: `iter-${iterNum} 不在迭代規劃表中` }] };
  }

  // 讀取 Fillback
  const fillbackSuggestions = projectRoot ? loadPreviousFillback(projectRoot, iterNum) : [];

  for (const entry of targetModules) {
    const modName = entry.module;
    const actionData = draft.moduleActions[modName];

    // 只展開 Stub
    if (actionData && actionData.fillLevel !== 'stub') {
      changes.push({ module: modName, status: 'SKIP', reason: `已是 ${actionData.fillLevel}，不需展開` });
      continue;
    }

    // 收集展開來源
    const moduleInfo = draft.modules[modName] || {};
    const deps = entry.deps || moduleInfo.deps || [];
    const publicAPI = moduleInfo.publicAPI || [];

    // 推導動作清單
    let actions = [];

    // 1. 基礎設施動作 (types)
    actions.push(...generateInfraActions(modName, deps));

    // 2. 從公開 API 推導
    if (publicAPI.length > 0) {
      actions.push(...inferActionsFromAPI(publicAPI, modName, deps));
    }

    // 3. 從 Fillback 推導
    const modSuggestions = fillbackSuggestions.filter(s => {
      const text = JSON.stringify(s).toLowerCase();
      return text.includes(modName.toLowerCase());
    });
    if (modSuggestions.length > 0) {
      const fillbackActions = inferActionsFromFillback(modSuggestions, modName);
      // 去重 (techName)
      const existingNames = new Set(actions.map(a => a.techName));
      for (const fa of fillbackActions) {
        if (!existingNames.has(fa.techName)) {
          actions.push(fa);
          existingNames.add(fa.techName);
        }
      }
    }

    // 4. 如果沒有任何來源，生成最小骨架
    if (actions.length <= 1 && publicAPI.length === 0) {
      actions.push({
        semantic: `${modName} 核心服務`,
        type: 'SVC',
        techName: `${modName}Service`,
        priority: 'P1',
        flow: 'TODO',
        deps: deps.length > 0 ? deps.map(d => `[Internal.${d}]`).join(', ') : '無',
        status: '○○',
      });
    }

    // 生成展開後的 Markdown
    const expandedTable = generateExpandedActionTable(modName, iterNum, actions);

    // 找到原始 Stub 區塊並替換
    const lines = result.split('\n');
    const stubPatterns = [
      new RegExp(`### Iter ${iterNum}:\\s*${escapeRegex(modName)}\\s*\\[STUB\\]`, 'i'),
      new RegExp(`### Iter ${iterNum}:\\s*${escapeRegex(modName)}\\s*\\[CURRENT\\]`, 'i'),
      new RegExp(`### Iter ${iterNum}:\\s*${escapeRegex(modName)}(?:\\s|$)`, 'i'),
    ];

    let headerIdx = -1;
    for (const pattern of stubPatterns) {
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx >= 0) break;
    }

    if (headerIdx < 0) {
      changes.push({ module: modName, status: 'SKIP', reason: '找不到 Stub 區塊' });
      continue;
    }

    // 找到區塊結束位置
    let endIdx = lines.length;
    for (let i = headerIdx + 1; i < lines.length; i++) {
      if (/^###\s/.test(lines[i]) || /^---$/.test(lines[i].trim()) || /^##\s/.test(lines[i])) {
        endIdx = i;
        break;
      }
    }

    // 替換
    const newLines = [...lines.slice(0, headerIdx), expandedTable, '', ...lines.slice(endIdx)];
    result = newLines.join('\n');

    changes.push({
      module: modName,
      status: 'EXPANDED',
      actionCount: actions.length,
      sources: {
        infra: 1,
        api: publicAPI.length > 0 ? actions.filter(a => !a.source && a.type !== 'CONST').length : 0,
        fillback: actions.filter(a => a.source === 'fillback').length,
      },
    });
  }

  // 更新迭代規劃表: 第一個 [STUB] 改為 [CURRENT]
  const planLines = result.split('\n');
  let promoted = false;
  for (let i = 0; i < planLines.length; i++) {
    if (planLines[i].includes('[STUB]') && planLines[i].includes(`| ${iterNum} `) && !promoted) {
      planLines[i] = planLines[i].replace('[STUB]', '[CURRENT]');
      promoted = true;
    }
  }
  result = planLines.join('\n');

  return { content: result, changes };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// 主程式
// ============================================
function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
Blueprint Expand v1.0 - Stub 展開器

用法:
  node sdid-tools/blueprint-expand.cjs --draft=<path> --iter=2 --target=<project>

選項:
  --draft=<path>    活藍圖路徑 (必填)
  --iter=<N>        要展開的迭代編號 (必填)
  --target=<path>   專案根目錄 (用於讀取 Fillback suggestions)
  --out=<path>      輸出路徑 (預設: 覆寫原檔)
  --dry-run         預覽模式，不寫入檔案
  --help            顯示此訊息

展開來源:
  1. 公開 API (模組定義中的 API 簽名)
  2. Fillback suggestions (前一迭代的建議)
  3. 模組依賴推導 (自動生成 types 動作)

注意:
  展開後的動作清單是骨架，建議用 Gem chatbot 確認並補充 flow 細節。
`);
    process.exit(0);
  }

  if (!args.draft) {
    logOutput.anchorErrorSpec({
      targetFile: 'CLI 參數',
      missing: ['--draft'],
      example: `node sdid-tools/blueprint-expand.cjs --draft=<project>/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md --iter=2 --target=<project>`,
      nextCmd: 'node sdid-tools/blueprint-expand.cjs --draft=<path> --iter=N --target=<project>',
      gateSpec: {
        checks: [
          { name: '--draft 參數', pattern: '活藍圖路徑', desc: '必須指定 --draft=<path>' },
          { name: '藍圖可解析', pattern: 'parser.parse()', desc: '藍圖格式必須正確' },
          { name: 'iter 有 Stub', pattern: 'fillLevel === stub', desc: '目標 iter 必須有 [STUB] 模組可展開' },
          { name: '前一 iter 已收縮', pattern: 'gate-shrink-pass', desc: '前一 iter 的 Shrink 已完成' },
        ]
      }
    });
    process.exit(1);
  }

  let rawContent, draft;
  try {
    rawContent = fs.readFileSync(args.draft, 'utf8');
    draft = parser.parse(rawContent);
  } catch (err) {
    logOutput.anchorError('BLOCKER',
      `藍圖讀取/解析失敗: ${err.message}`,
      `確認藍圖路徑正確且格式有效: ${args.draft}`,
      {
        projectRoot: args.target || null,
        iteration: args.iter,
        phase: 'gate',
        step: 'expand',
        details: `解析錯誤: ${err.message}`,
      }
    );
    process.exit(1);
  }

  console.log(`\n📐 Blueprint Expand v1.0`);
  console.log(`   藍圖: ${path.basename(args.draft)}`);
  console.log(`   展開 iter: ${args.iter}`);
  if (args.target) console.log(`   專案: ${path.basename(args.target)}`);
  console.log('');

  // 執行展開
  const { content, changes } = expandBlueprint(rawContent, draft, args.iter, args.target);

  // 報告
  const expandedCount = changes.filter(c => c.status === 'EXPANDED').length;
  const skipCount = changes.filter(c => c.status === 'SKIP').length;

  for (const change of changes) {
    if (change.status === 'EXPANDED') {
      const src = change.sources;
      console.log(`   ✅ ${change.module} → ${change.actionCount} 個動作 (infra:${src.infra}, api:${src.api}, fillback:${src.fillback})`);
    } else if (change.status === 'SKIP') {
      console.log(`   ⏭️ ${change.module} — ${change.reason}`);
    }
  }

  console.log(`\n📊 結果: ${expandedCount} 模組展開, ${skipCount} 跳過`);

  if (expandedCount === 0) {
    const logProjectRoot = args.target || null;
    if (logProjectRoot) {
      logOutput.anchorError('TACTICAL_FIX',
        `iter-${args.iter} 沒有模組被展開 — 可能沒有 [STUB] 或已展開`,
        `確認藍圖中 iter-${args.iter} 有 [STUB] 標記的模組`,
        {
          projectRoot: logProjectRoot,
          iteration: args.iter,
          phase: 'gate',
          step: 'expand',
          details: `展開結果:\n${changes.map(c => `${c.module}: ${c.status} — ${c.reason || ''}`).join('\n')}\n\n可能原因:\n1. 目標 iter 沒有 [STUB] 模組\n2. 所有模組已展開為 [CURRENT] 或 [DONE]\n3. iter 編號錯誤\n4. 迭代規劃表中沒有 iter-${args.iter} 的條目`,
        }
      );
    } else {
      console.log(`\n⚠️ 沒有模組被展開 — iter-${args.iter} 可能沒有 Stub 或已展開`);
    }
    process.exit(0);
  }

  // 寫入
  const outPath = args.out || args.draft;
  if (args.dryRun) {
    console.log(`\n[dry-run] 不寫入檔案`);
    console.log(`[dry-run] 展開後藍圖預覽 (前 50 行):`);
    content.split('\n').slice(0, 50).forEach(l => console.log(`  ${l}`));
  } else {
    fs.writeFileSync(outPath, content, 'utf8');
    console.log(`\n✅ 藍圖已更新: ${path.relative(process.cwd(), outPath)}`);
  }

  // log 存檔
  const logProjectRoot = args.target || null;
  if (logProjectRoot) {
    const details = changes.map(c => {
      if (c.status === 'EXPANDED') {
        const src = c.sources;
        return `✅ ${c.module} → ${c.actionCount} 個動作 (infra:${src.infra}, api:${src.api}, fillback:${src.fillback})`;
      }
      return `⏭️ ${c.module} — ${c.reason}`;
    }).join('\n');

    const nextCmd = `node sdid-tools/blueprint-gate.cjs --draft=${args.draft} --iter=${args.iter}`;
    logOutput.anchorPass('gate', 'expand',
      `Blueprint Expand 完成 — iter-${args.iter} 已展開 (${expandedCount} 模組)`,
      nextCmd,
      { projectRoot: logProjectRoot, iteration: args.iter, phase: 'gate', step: 'expand', details });
  } else {
    console.log(`\n@PASS | Blueprint Expand 完成 — iter-${args.iter} 已展開`);
    console.log(`下一步: node sdid-tools/blueprint-gate.cjs --draft=${args.draft} --iter=${args.iter}`);
    console.log(`        (驗證展開後的藍圖品質，然後用 Gem chatbot 補充 flow 細節)`);
  }
}

// ============================================
// 導出
// ============================================
module.exports = {
  expandBlueprint,
  loadPreviousFillback,
  inferActionsFromAPI,
  inferActionsFromFillback,
  generateInfraActions,
  generateExpandedActionTable,
};

if (require.main === module) {
  main();
}
