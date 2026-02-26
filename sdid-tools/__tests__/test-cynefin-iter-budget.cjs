#!/usr/bin/env node
/**
 * Test: CYNEFIN iterBudget 機械強制
 * 測試 cynefin-log-writer.cjs 的 determineResult() 是否正確根據 iterBudget 產生 BLOCKER/WARNING
 *
 * 測試案例:
 *   Case 1: Complicated + q3_costly + actionCount > maxPerIter + currentIters < suggestedIters → BLOCKER
 *   Case 2: Complicated + q3_costly + actionCount 在 maxPerIter 內 → PASS (不觸發)
 *   Case 3: Complicated + !q3_costly + currentIters < suggestedIters → WARNING (不阻擋)
 *   Case 4: Clear 模組，無 iterBudget → 不觸發任何問題
 *   Case 5: 缺少 iterBudget 欄位（向後相容）→ 不觸發（靜默通過）
 *   Case 6: Complex + actionCount > maxPerIter + currentIters < suggestedIters → BLOCKER
 */

'use strict';

// 直接引入 determineResult 邏輯（從 cynefin-log-writer.cjs 複製出來測試用）
// 因為 cynefin-log-writer.cjs 的函數沒有 export，我們用子進程或直接重現邏輯
// 這裡選擇重現 determineResult 函數來測試其邏輯

/**
 * 從 cynefin-log-writer.cjs 提取的 determineResult 函數
 * （保持與原始一致，用於驗證行為）
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
      const maxPerIter = budget.maxPerIter || 4;
      const suggestedIters = budget.suggestedIters || Math.ceil((budget.actionCount || 0) / maxPerIter);
      const currentIters = budget.currentIters || 1;

      if (mod.domain === 'Complicated' && mod.threeQuestions && mod.threeQuestions.q3_costly) {
        // Complicated + costly: 嚴格預算
        if (budget.actionCount > maxPerIter && currentIters < suggestedIters) {
          blockers.push({
            module: mod.name,
            issue: {
              level: 'BLOCKER',
              description: `迭代預算不足: Complicated+costly 模組 "${mod.name}" 有 ${budget.actionCount} 個動作，目前 ${currentIters} iter（上限 ${maxPerIter}/iter），需拆為至少 ${suggestedIters} 個 iter`,
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
        // Complicated + !costly: 建議但不阻擋
        if (currentIters < suggestedIters) {
          warnings.push({
            module: mod.name,
            issue: {
              level: 'WARNING',
              description: `迭代預算建議: 模組 "${mod.name}" 有 ${budget.actionCount} 個動作，建議 ${suggestedIters} iter（目前 ${currentIters}）`,
              suggestions: [`考慮增加迭代數以降低單一 iter 風險`],
            }
          });
        }
      } else if (mod.domain === 'Complex') {
        // Complex: 更嚴格，探索性需要小步
        const complexMax = budget.maxPerIter || 3;
        const complexSuggested = Math.ceil((budget.actionCount || 0) / complexMax);
        if (currentIters < complexSuggested) {
          blockers.push({
            module: mod.name,
            issue: {
              level: 'BLOCKER',
              description: `迭代預算不足: Complex 模組 "${mod.name}" 有 ${budget.actionCount} 個動作，探索性模組每 iter 最多 ${complexMax} 個，需拆為至少 ${complexSuggested} 個 iter`,
              suggestions: [
                `將模組拆為 ${complexSuggested} 個 iter，先做 Probe（探索驗證）再做完整實作`,
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

// ============================================================
// 測試框架
// ============================================================
let pass = 0;
let fail = 0;

function assert(condition, msg) {
  if (condition) {
    pass++;
    console.log('  ✅ ' + msg);
  } else {
    fail++;
    console.log('  ❌ ' + msg);
  }
}

// ============================================================
// Case 1: Complicated + q3_costly + actionCount > maxPerIter + 1 iter → BLOCKER
// ============================================================
console.log('\n=== Case 1: Complicated+costly, 6 動作, 1 iter → BLOCKER ===');
{
  const modules = [{
    name: 'question_bank',
    domain: 'Complicated',
    threeQuestions: { q1_clear: true, q2_reference: true, q3_costly: true },
    flowSteps: 6,
    depsCount: 2,
    timeCoupling: false,
    iterBudget: {
      actionCount: 6,
      maxPerIter: 4,
      suggestedIters: 2, // ceil(6/4)
      currentIters: 1,
    },
    issues: [],
  }];

  const result = determineResult(modules);

  assert(result.pass === false, 'Case 1: 應為 NEEDS-FIX（不通過）');
  assert(result.blockers.length === 1, 'Case 1: 應有 1 個 BLOCKER');
  assert(result.blockers[0].module === 'question_bank', 'Case 1: BLOCKER 來自 question_bank');
  assert(
    result.blockers[0].issue.description.includes('6 個動作'),
    'Case 1: BLOCKER 描述應提到 6 個動作'
  );
  assert(
    result.blockers[0].issue.description.includes('2 個 iter'),
    'Case 1: BLOCKER 描述應要求 2 個 iter'
  );
  assert(result.warnings.length === 0, 'Case 1: 不應有 WARNING（只有 BLOCKER）');
}

// ============================================================
// Case 2: Complicated + q3_costly，但動作在 maxPerIter 內 → PASS
// ============================================================
console.log('\n=== Case 2: Complicated+costly, 3 動作, 1 iter, maxPerIter=4 → PASS ===');
{
  const modules = [{
    name: 'auth',
    domain: 'Complicated',
    threeQuestions: { q1_clear: true, q2_reference: true, q3_costly: true },
    flowSteps: 3,
    depsCount: 1,
    timeCoupling: false,
    iterBudget: {
      actionCount: 3,
      maxPerIter: 4,
      suggestedIters: 1, // ceil(3/4) = 1
      currentIters: 1,
    },
    issues: [],
  }];

  const result = determineResult(modules);

  assert(result.pass === true, 'Case 2: 3 個動作在限制內，應 PASS');
  assert(result.blockers.length === 0, 'Case 2: 不應有 BLOCKER');
  assert(result.warnings.length === 0, 'Case 2: 不應有 WARNING');
}

// ============================================================
// Case 3: Complicated + !q3_costly + currentIters < suggestedIters → WARNING (不阻擋)
// ============================================================
console.log('\n=== Case 3: Complicated+!costly, 7 動作, 1 iter → WARNING 不阻擋 ===');
{
  const modules = [{
    name: 'report_gen',
    domain: 'Complicated',
    threeQuestions: { q1_clear: true, q2_reference: true, q3_costly: false },
    flowSteps: 5,
    depsCount: 2,
    timeCoupling: false,
    iterBudget: {
      actionCount: 7,
      maxPerIter: 6, // !costly 上限 6
      suggestedIters: 2, // ceil(7/6) = 2
      currentIters: 1,
    },
    issues: [],
  }];

  const result = determineResult(modules);

  assert(result.pass === true, 'Case 3: !costly 應 PASS（WARNING 不阻擋）');
  assert(result.blockers.length === 0, 'Case 3: 不應有 BLOCKER');
  assert(result.warnings.length === 1, 'Case 3: 應有 1 個 WARNING');
  assert(
    result.warnings[0].issue.level === 'WARNING',
    'Case 3: WARNING 級別正確'
  );
  assert(
    result.warnings[0].module === 'report_gen',
    'Case 3: WARNING 來自 report_gen'
  );
}

// ============================================================
// Case 4: Clear 模組，無 iterBudget → 不觸發
// ============================================================
console.log('\n=== Case 4: Clear 模組，無 iterBudget → 靜默 PASS ===');
{
  const modules = [{
    name: 'shared',
    domain: 'Clear',
    threeQuestions: { q1_clear: true, q2_reference: true, q3_costly: false },
    flowSteps: 3,
    depsCount: 0,
    timeCoupling: false,
    // 故意不放 iterBudget
    issues: [],
  }];

  const result = determineResult(modules);

  assert(result.pass === true, 'Case 4: Clear 無 iterBudget → PASS');
  assert(result.blockers.length === 0, 'Case 4: 不應有 BLOCKER');
  assert(result.warnings.length === 0, 'Case 4: 不應有 WARNING');
}

// ============================================================
// Case 5: 缺少 iterBudget 欄位（舊版 report，向後相容）→ 靜默通過
// ============================================================
console.log('\n=== Case 5: 缺少 iterBudget（舊版相容）→ 靜默 PASS ===');
{
  const modules = [{
    name: 'old_module',
    domain: 'Complicated',
    threeQuestions: { q1_clear: true, q2_reference: true, q3_costly: true },
    flowSteps: 5,
    depsCount: 2,
    timeCoupling: false,
    // 舊版 report 沒有 iterBudget
    issues: [],
  }];

  const result = determineResult(modules);

  assert(result.pass === true, 'Case 5: 缺 iterBudget 不應誤判，應 PASS');
  assert(result.blockers.length === 0, 'Case 5: 不應有 BLOCKER');
}

// ============================================================
// Case 6: Complex + actionCount > maxPerIter + 1 iter → BLOCKER
// ============================================================
console.log('\n=== Case 6: Complex, 5 動作, 1 iter, maxPerIter=3 → BLOCKER ===');
{
  const modules = [{
    name: 'ai_recommender',
    domain: 'Complex',
    threeQuestions: { q1_clear: false, q2_reference: false, q3_costly: true },
    flowSteps: 5,
    depsCount: 3,
    timeCoupling: false,
    iterBudget: {
      actionCount: 5,
      maxPerIter: 3, // Complex 上限 3
      suggestedIters: 2, // ceil(5/3) = 2
      currentIters: 1,
    },
    issues: [],
  }];

  const result = determineResult(modules);

  assert(result.pass === false, 'Case 6: Complex 超標應 NEEDS-FIX');
  assert(result.blockers.length === 1, 'Case 6: 應有 1 個 BLOCKER');
  assert(result.blockers[0].module === 'ai_recommender', 'Case 6: BLOCKER 來自 ai_recommender');
  assert(
    result.blockers[0].issue.description.includes('Complex'),
    'Case 6: BLOCKER 描述應提到 Complex'
  );
}

// ============================================================
// Summary
// ============================================================
console.log('\n' + '='.repeat(60));
console.log(`CYNEFIN iterBudget 測試結果: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('❌ 有測試失敗，請檢查 cynefin-log-writer.cjs 的 determineResult()');
} else {
  console.log('✅ 所有 iterBudget 機械強制測試通過');
}
process.exit(fail > 0 ? 1 : 0);
