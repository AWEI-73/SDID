#!/usr/bin/env node
/**
 * Cynefin Log Writer v1.0
 * 接收 AI 產出的 cynefin review report，格式化存成 log 檔
 *
 * 用法:
 *   node sdid-tools/cynefin-log-writer.cjs --report=<json-string> --target=<project> --iter=<N>
 *   node sdid-tools/cynefin-log-writer.cjs --report-file=<path> --target=<project> --iter=<N>
 *
 * 輸出:
 *   @PASS        — 無 BLOCKER，log 存檔完成
 *   @NEEDS-FIX   — 有 BLOCKER，log 存檔完成，AI 需要修改文件後重跑
 *
 * Log 命名:
 *   cynefin-check-pass-<timestamp>.log
 *   cynefin-check-fail-<timestamp>.log
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ============================================
// 參數解析
// ============================================
function parseArgs() {
  const args = { report: null, reportFile: null, target: null, iter: 1, help: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--report=')) {
      args.report = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--report-file=')) {
      args.reportFile = path.resolve(arg.split('=').slice(1).join('='));
    } else if (arg.startsWith('--target=')) {
      args.target = path.resolve(arg.split('=').slice(1).join('='));
    } else if (arg.startsWith('--iter=')) {
      args.iter = parseInt(arg.split('=')[1]) || 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  return args;
}

// ============================================
// Log 基礎設施
// ============================================
function getLogsDir(projectRoot, iterNum) {
  return path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ============================================
// Report 解析與驗證
// ============================================

/**
 * 解析 AI 產出的 report JSON
 * 支援兩種格式：
 *   1. JSON string (--report='{...}')
 *   2. JSON file (--report-file=path)
 */
function parseReport(args) {
  let raw;
  if (args.reportFile) {
    if (!fs.existsSync(args.reportFile)) {
      throw new Error(`Report file not found: ${args.reportFile}`);
    }
    raw = fs.readFileSync(args.reportFile, 'utf8');
  } else if (args.report) {
    raw = args.report;
  } else {
    throw new Error('需要 --report 或 --report-file 參數');
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Report JSON 解析失敗: ${e.message}`);
  }
}

/**
 * 驗證 report 結構
 * 必要欄位: route, inputFile, modules[]
 * 每個 module: name, domain, flowSteps, depsCount, issues[]
 * 選填欄位: actions[]（v1.1 新增，action 層級分析）
 */
function validateReport(report) {
  const errors = [];
  if (!report.route) errors.push('缺少 route (Blueprint|TaskPipe)');
  if (!report.inputFile) errors.push('缺少 inputFile');
  if (!Array.isArray(report.modules)) errors.push('缺少 modules 陣列');
  if (errors.length > 0) throw new Error(`Report 格式錯誤: ${errors.join(', ')}`);
}

/**
 * 強制升級為 Complicated 的 hiddenStep 關鍵字。
 * 任一 hiddenStep 包含以下關鍵字 → domain 強制 Complicated，needsTest 強制 true。
 * 對應 cynefin-check.md「強制升級為 Complicated 的 Action 特徵」章節。
 */
const FORCE_COMPLICATED_KEYWORDS = [
  'FK', '繼承', 'taskId', 'parentId', 'orderId', 'subtaskId',      // FK 繼承
  'Tree', 'Flat', '打平', '巢狀', 'flatten', 'nested',              // Tree→Flat 映射
  '跨實體', 'cross-entity', 'ID 補充', 'ID 注入',                   // 跨實體 ID 注入
  '多目標', 'multi-target', '批次寫入', 'batch write',              // 多目標寫入
  'IS_MOCK', 'mock/real', 'USE_REAL_API', '整合邊界',               // 整合邊界切換
  'quota', 'rate-limit', 'GAS quota', '外部服務',                   // 外部服務呼叫
];

/**
 * 檢查 action 是否命中強制 Complicated 特徵（機械規則）。
 * 回傳命中的關鍵字列表，空陣列表示未命中。
 */
function detectForceComplicatedKeywords(action) {
  const steps = Array.isArray(action.hiddenSteps) ? action.hiddenSteps : [];
  const allText = steps.join(' ');
  return FORCE_COMPLICATED_KEYWORDS.filter(kw =>
    allText.toLowerCase().includes(kw.toLowerCase())
  );
}

/**
 * needsTest 判斷規則（action 層級）
 * - domain === 'Complicated' || domain === 'Complex' → true
 * - hiddenSteps.length >= 2 → true
 * - hiddenSteps 包含強制 Complicated 關鍵字 → true（即使 AI 標 Clear）
 * - 其他 → false
 */
function computeNeedsTest(action) {
  if (action.domain === 'Complicated' || action.domain === 'Complex') return true;
  if (Array.isArray(action.hiddenSteps) && action.hiddenSteps.length >= 2) return true;
  if (detectForceComplicatedKeywords(action).length > 0) return true;
  return false;
}

/**
 * 從 report.actions[] 中補上 needsTest 欄位（如果 AI 已填入 actions[]）
 * 同時做強制 Complicated 升級（機械規則，覆蓋 AI 的 Clear 標記）。
 * 如果 report 沒有 actions[]，回傳空陣列
 */
function enrichActions(report) {
  if (!Array.isArray(report.actions)) return [];
  return report.actions.map(action => {
    const forcedKeywords = detectForceComplicatedKeywords(action);
    const forcedComplicated = forcedKeywords.length > 0 && action.domain === 'Clear';
    const effectiveDomain = forcedComplicated ? 'Complicated' : action.domain;
    const needsTest = action.needsTest !== undefined
      ? action.needsTest
      : computeNeedsTest({ ...action, domain: effectiveDomain });
    return {
      ...action,
      domain: effectiveDomain,
      needsTest,
      ...(forcedComplicated ? { _domainUpgraded: `Clear→Complicated (keywords: ${forcedKeywords.join(', ')})` } : {}),
    };
  });
}

// ============================================
// 分級判斷
// ============================================

/**
 * 從 modules 的 issues 判斷整體結果
 * BLOCKER → @NEEDS-FIX
 * 只有 WARNING/INFO → @PASS (帶警告)
 *
 * v1.1: 新增 iterBudget 機械判定 — 腳本自動產生 BLOCKER，不依賴 AI 手動報
 */
function determineResult(modules) {
  const blockers = [];
  const warnings = [];

  for (const mod of modules) {
    // --- 既有: 掃描 AI 回報的 issues ---
    if (mod.issues && mod.issues.length > 0) {
      for (const issue of mod.issues) {
        if (issue.level === 'BLOCKER') {
          blockers.push({ module: mod.name, issue });
        } else if (issue.level === 'WARNING') {
          warnings.push({ module: mod.name, issue });
        }
      }
    }

    // --- 新增: iterBudget 機械強制 ---
    if (mod.iterBudget) {
      const budget = mod.iterBudget;
      // maxPerIter 根據 domain 語意決定，不依賴 AI 填值
      const domainMax = {
        Simple: Infinity,
        Complicated: 6,
        Complex: 3,
        Chaotic: 2,
      };
      const maxPerIter = domainMax[mod.domain] ?? (budget.maxPerIter || 4);
      const actionCount = budget.actionCount || 0;
      const suggestedIters = maxPerIter === Infinity ? 1 : Math.ceil(actionCount / maxPerIter);
      const currentIters = budget.currentIters || 1;

      if (mod.domain === 'Complicated' && mod.threeQuestions && mod.threeQuestions.q3_costly) {
        // Complicated + costly: 嚴格預算
        if (actionCount > maxPerIter && currentIters < suggestedIters) {
          blockers.push({
            module: mod.name,
            issue: {
              level: 'BLOCKER',
              description: `迭代預算不足: Complicated+costly 模組 "${mod.name}" 有 ${actionCount} 個動作，目前 ${currentIters} iter（上限 ${maxPerIter}/iter），需拆為至少 ${suggestedIters} 個 iter`,
              suggestions: [
                `將模組拆分為 ${suggestedIters} 個 iter，每個 iter 最多 ${maxPerIter} 個動作`,
                `P0 動作優先進第一個 iter，P1/P2 動作排入後續 iter`,
                `每個 iter 必須有 SVC+ROUTE+UI（前後端一套）`,
              ],
              fixTarget: '迭代規劃表 + 模組動作清單',
            }
          });
        }
      } else if (mod.domain === 'Complicated') {
        // Complicated + !costly: 同樣擋住，AI 不理 WARNING
        if (currentIters < suggestedIters) {
          blockers.push({
            module: mod.name,
            issue: {
              level: 'BLOCKER',
              description: `迭代預算不足: Complicated 模組 "${mod.name}" 有 ${actionCount} 個動作，建議拆為 ${suggestedIters} iter（目前 ${currentIters}）`,
              suggestions: [
                `將模組拆分為 ${suggestedIters} 個 iter，每個 iter 最多 ${maxPerIter} 個動作`,
                `P0 動作優先進第一個 iter，P1/P2 動作排入後續 iter`,
              ],
              fixTarget: '迭代規劃表 + 模組動作清單',
            }
          });
        }
      } else if (mod.domain === 'Complex') {
        // Complex: 更嚴格，探索性需要小步
        if (currentIters < suggestedIters) {
          blockers.push({
            module: mod.name,
            issue: {
              level: 'BLOCKER',
              description: `迭代預算不足: Complex 模組 "${mod.name}" 有 ${actionCount} 個動作，探索性模組每 iter 最多 ${maxPerIter} 個，需拆為至少 ${suggestedIters} 個 iter`,
              suggestions: [
                `將模組拆為 ${suggestedIters} 個 iter，先做 Probe（探索驗證）再做完整實作`,
              ],
              fixTarget: '迭代規劃表 + 模組動作清單',
            }
          });
        }
      } else if (mod.domain === 'Chaotic') {
        // Chaotic: 最嚴格，每 iter 最多 2 個動作
        if (actionCount > maxPerIter && currentIters < suggestedIters) {
          blockers.push({
            module: mod.name,
            issue: {
              level: 'BLOCKER',
              description: `迭代預算不足: Chaotic 模組 "${mod.name}" 有 ${actionCount} 個動作，每 iter 最多 ${maxPerIter} 個，需拆為至少 ${suggestedIters} 個 iter`,
              suggestions: [
                `Chaotic 域需要最小步驟探索，每 iter 只做 ${maxPerIter} 個動作`,
                `先穩定問題域再增加動作數`,
              ],
              fixTarget: '迭代規劃表 + 模組動作清單',
            }
          });
        }
      }
    }
  }

  return { pass: blockers.length === 0, blockers, warnings };
}

// ============================================
// Log 內容產生
// ============================================
function buildLogContent(report, result, iterNum, enrichedActions) {
  const ts = new Date().toISOString();
  const lines = [];

  lines.push('=== CYNEFIN CHECK LOG ===');
  lines.push(`時間: ${ts}`);
  lines.push(`路線: ${report.route}`);
  lines.push(`迭代: iter-${iterNum}`);
  lines.push(`輸入文件: ${report.inputFile}`);
  lines.push(`結果: ${result.pass ? 'PASS' : 'NEEDS-FIX'}`);
  lines.push('');
  lines.push('--- 模組分析 ---');
  lines.push('');

  for (const mod of report.modules) {
    lines.push(`模組: ${mod.name}`);
    lines.push(`  域: ${mod.domain}`);

    // 三問
    if (mod.threeQuestions) {
      lines.push('  三問域識別:');
      lines.push(`    Q1 做法清楚？ → ${mod.threeQuestions.q1_clear ? '是' : '否'}`);
      lines.push(`    Q2 有參考？   → ${mod.threeQuestions.q2_reference ? '是' : '否'}`);
      lines.push(`    Q3 代價大？   → ${mod.threeQuestions.q3_costly ? '是' : '否'}`);
    }

    // 指標
    const flowOk = !mod.flowSteps || mod.flowSteps <= 7;
    const depsOk = !mod.depsCount || mod.depsCount <= 5;
    lines.push(`  FLOW 步驟: ${mod.flowSteps ?? 'N/A'}  ${flowOk ? '✓' : '⚠ 超標(閾值7)'}`);
    lines.push(`  deps 數量: ${mod.depsCount ?? 'N/A'}  ${depsOk ? '✓' : '⚠ 超標(閾值5)'}`);
    lines.push(`  時間耦合: ${mod.timeCoupling ? '⚠ Clear 等待 Complex' : '無'}`);

    // 迭代預算
    if (mod.iterBudget) {
      const b = mod.iterBudget;
      const budgetOk = !b.suggestedIters || (b.currentIters || 1) >= b.suggestedIters;
      lines.push(`  迭代預算: ${b.actionCount || '?'} 動作, 上限 ${b.maxPerIter || '?'}/iter → 建議 ${b.suggestedIters || '?'} iter (目前 ${b.currentIters || '?'})  ${budgetOk ? '✓' : '⚠ 不足'}`);
    }

    // Issues
    if (mod.issues && mod.issues.length > 0) {
      lines.push('');
      for (const issue of mod.issues) {
        lines.push(`  [${issue.level}] ${issue.description}`);
        if (issue.suggestions && issue.suggestions.length > 0) {
          lines.push('  建議:');
          for (const s of issue.suggestions) {
            lines.push(`    - ${s}`);
          }
        }
        if (issue.fixTarget) {
          lines.push(`  需修改: ${issue.fixTarget}`);
        }
      }
    }
    lines.push('');
  }

  lines.push('--- 總結 ---');
  const passCount = report.modules.filter(m => !m.issues || m.issues.every(i => i.level !== 'BLOCKER')).length;
  const failCount = report.modules.length - passCount;
  lines.push(`通過模組: ${passCount}`);
  lines.push(`問題模組: ${failCount}`);

  if (result.blockers.length > 0) {
    lines.push('');
    lines.push('BLOCKER 清單:');
    for (const b of result.blockers) {
      lines.push(`  [${b.module}] ${b.issue.description}`);
    }
    lines.push('');
    lines.push('下一步: 根據上方建議修改文件，然後重跑 CYNEFIN-CHECK');
  } else {
    lines.push('');
    lines.push('下一步: 進入 PLAN');
  }

  // Action 層級分析（v1.1）
  if (enrichedActions && enrichedActions.length > 0) {
    lines.push('');
    lines.push('--- Action 層級分析 ---');
    lines.push('');
    const needsTestActions = enrichedActions.filter(a => a.needsTest);
    lines.push(`needsTest:true  — ${needsTestActions.length} 個 action（vitest 驗收）`);
    lines.push(`needsTest:false — ${enrichedActions.length - needsTestActions.length} 個 action（直接執行或 SKIP）`);
    lines.push('');
    const upgradedActions = enrichedActions.filter(a => a._domainUpgraded);
    if (upgradedActions.length > 0) {
      lines.push(`⚠ 機械規則升級 ${upgradedActions.length} 個 action 的 domain（Clear→Complicated）:`);
      for (const a of upgradedActions) {
        lines.push(`    [UPGRADED] ${a.name}: ${a._domainUpgraded}`);
      }
      lines.push('');
    }
    for (const a of enrichedActions) {
      const marker = a.needsTest ? '[TEST]' : '[SKIP]';
      const upgraded = a._domainUpgraded ? ' ⚠UPGRADED' : '';
      const steps = Array.isArray(a.hiddenSteps) && a.hiddenSteps.length > 0
        ? ` hidden:[${a.hiddenSteps.join(', ')}]`
        : '';
      lines.push(`  ${marker} ${a.name} (${a.domain})${upgraded} story:${a.story || '?'}${steps}`);
    }
  }

  lines.push('=========================');
  return lines.join('\n');
}

// ============================================
// 主程式
// ============================================
/** GEMS: writeCynefinLog | P1 | parseReport(Clear)→validateReport(Clear)→determineResult(Complicated)→buildLogContent(Clear)→writeLog(Clear)→RETURN:CynefinResult | Story-2.0 */
function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
Cynefin Log Writer v1.0

用法:
  node sdid-tools/cynefin-log-writer.cjs --report='<json>' --target=<project> [--iter=N]
  node sdid-tools/cynefin-log-writer.cjs --report-file=<path> --target=<project> [--iter=N]

Report JSON 格式:
  {
    "route": "Blueprint|TaskPipe",
    "inputFile": "path/to/draft.md",
    "modules": [
      {
        "name": "模組名",
        "domain": "Clear|Complicated|Complex",
        "threeQuestions": { "q1_clear": true, "q2_reference": false, "q3_costly": true },
        "flowSteps": 4,
        "depsCount": 2,
        "timeCoupling": false,
        "iterBudget": {
          "actionCount": 6,
          "maxPerIter": 4,
          "suggestedIters": 2,
          "currentIters": 1
        },
        "issues": [
          {
            "level": "BLOCKER|WARNING|INFO",
            "description": "問題描述",
            "suggestions": ["建議1", "建議2"],
            "fixTarget": "需修改的文件路徑"
          }
        ]
      }
    ],
    "actions": [
      {
        "name": "functionName",
        "story": "Story-1.0",
        "domain": "Clear|Complicated|Complex",
        "hiddenSteps": [],
        "needsTest": false
      },
      {
        "name": "getTransactions",
        "story": "Story-1.0",
        "domain": "Complicated",
        "hiddenSteps": ["月份過濾邊界", "日期降序排列"],
        "needsTest": true
      }
    ]
  }

needsTest 判斷規則（腳本自動計算，AI 也可手動填入）:
  - domain === 'Complicated' || domain === 'Complex' → true
  - hiddenSteps.length >= 2 → true
  - 其他 → false
`);
    process.exit(0);
  }

  if (!args.target) {
    console.error('錯誤: 需要 --target 參數');
    process.exit(1);
  }

  // 解析 report
  let report;
  try {
    report = parseReport(args);
    validateReport(report);
  } catch (e) {
    console.error(`@ERROR | cynefin-log-writer | ${e.message}`);
    console.error('');
    console.error('📋 Minimal Schema 範本（複製後填入實際值）:');
    console.error(JSON.stringify({
      route: 'Blueprint',
      inputFile: 'path/to/draft_iter-N.md',
      modules: [
        {
          name: '模組名稱',
          domain: 'Simple',
          threeQuestions: { q1_clear: true, q2_reference: true, q3_costly: false },
          flowSteps: 3,
          depsCount: 1,
          timeCoupling: false,
          iterBudget: {
            actionCount: 4,
            maxPerIter: 6,
            suggestedIters: 1,
            currentIters: 1
          },
          issues: []
        }
      ]
    }, null, 2));
    console.error('');
    console.error('domain 合法值: Simple | Complicated | Complex | Chaotic');
    process.exit(1);
  }

  // 判斷結果
  const result = determineResult(report.modules);

  // 補上 actions[] needsTest（v1.1）
  const enrichedActions = enrichActions(report);

  // 存 log
  const logsDir = getLogsDir(args.target, args.iter);
  ensureDir(logsDir);

  const ts = getTimestamp();
  const logType = result.pass ? 'pass' : 'fail';
  const logFileName = `cynefin-check-${logType}-${ts}.log`;
  const logPath = path.join(logsDir, logFileName);
  const logContent = buildLogContent(report, result, args.iter, enrichedActions);

  fs.writeFileSync(logPath, logContent, 'utf8');

  // 存 cynefin-report.json（供 contract-gate CG-004 等下游工具讀取）
  // 最小化輸出：只保留下游實際消費的欄位（domain/needsTest/totalActions/issues）
  // 完整 narrative 分析保留在 .log 檔供人工除錯
  const reportJsonPath = path.join(logsDir, `cynefin-report-${ts}.json`);
  const minimalReport = {
    iteration: `iter-${args.iter}`,
    generatedAt: new Date().toISOString(),
    verdict: result.pass ? 'PASS' : 'NEEDS-FIX',
    totalActions: enrichedActions.length,
    issues: result.blockers.map(b => ({
      module: b.module,
      description: b.issue.description,
    })),
    actions: enrichedActions.map(a => ({
      name: a.name,
      domain: a.domain,
      needsTest: a.needsTest,
    })),
  };
  fs.writeFileSync(reportJsonPath, JSON.stringify(minimalReport, null, 2), 'utf8');

  const relPath = path.relative(args.target, logPath);

  // 終端輸出
  if (result.pass) {
    // v2.1: 只在 state.currentNode 確實是 CYNEFIN_CHECK 時才推進
    // 若 state 已是 BUILD-1（由 SPEC_TO_PLAN 設定），不覆蓋
    try {
      const stateManager = require('../task-pipe/lib/shared/state-manager-v3.cjs');
      const currentState = stateManager.readState(args.target, `iter-${args.iter}`);
      const currentNode = currentState && currentState.flow && currentState.flow.currentNode;
      if (currentNode && currentNode.startsWith('CYNEFIN_CHECK')) {
        stateManager.advanceState(args.target, `iter-${args.iter}`, 'CYNEFIN_CHECK', 'run');
      }
      // 否則 state 已在正確位置（如 BUILD-1），不動
    } catch (e) {
      console.log(`[Warn] 無法推進 state.json: ${e.message}`);
    }

    console.log(`@PASS | cynefin-check | ${report.modules.length} 個模組全部通過`);
    if (result.warnings.length > 0) {
      console.log(`  ⚠ ${result.warnings.length} 個 WARNING（不阻擋流程）`);
      for (const w of result.warnings) {
        console.log(`    [${w.module}] ${w.issue.description}`);
      }
    }
    console.log(`  Log: ${relPath}`);
    console.log(``);
    console.log(`@NEXT_STEPS`);
    console.log(`  1. 觸發 flow-review skill — 審查 STORY-ITEM 的 FLOW 語意 + CYNEFIN 域標記`);
    console.log(`     觸發詞: 「REVIEW FLOW」或「驗證 FLOW」，輸入: draft_iter-${args.iter}.md 的動作清單`);
    console.log(`  2. flow-review @PASS 後 → TDD Contract Subagent 寫測試檔（needsTest:true 的 action）`);
    console.log(`     參考: .agent/skills/sdid/references/tdd-contract-prompt.md`);
    console.log(`  3. 測試檔 RED 驗證完成後 → 寫 contract_iter-${args.iter}.ts → contract-gate`);
    console.log(`NEXT: 執行 flow-review skill（觸發詞: REVIEW FLOW）`);
    process.exit(0);
  } else {
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`@NEEDS-FIX | cynefin-check | 發現 ${result.blockers.length} 個 BLOCKER`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    for (const b of result.blockers) {
      console.log(`  ❌ [${b.module}] ${b.issue.description}`);
      if (b.issue.suggestions) {
        for (const s of b.issue.suggestions) {
          console.log(`     → ${s}`);
        }
      }
      if (b.issue.fixTarget) {
        console.log(`     修改: ${b.issue.fixTarget}`);
      }
      console.log('');
    }
    console.log(`  Log: ${relPath}`);
    console.log('');
    console.log('修復後重跑:');
    const targetArg = `--target=${path.relative(process.cwd(), args.target) || '.'}`;
    console.log(`  node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> ${targetArg} --iter=${args.iter}`);
    console.log('═══════════════════════════════════════════════════════════');
    process.exit(1);
  }
}

main();
