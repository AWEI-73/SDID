#!/usr/bin/env node
// -*- coding: utf-8 -*-

/**
 * Plan Schema Validator v1.0
 * 
 * 驗證 implementation_plan 的必要欄位，確保雙引擎 (task-pipe + blueprint)
 * 產出的 Plan 格式一致。這是 SDID 的 ABI 保證。
 * 
 * De facto schema 來源:
 *   - todo-app (Blueprint flow, draft-to-plan 產出)
 *   - bookmark-app (Blueprint flow, draft-to-plan 產出)
 *   - recipe-manager (Task-Pipe flow, PLAN step 產出)
 * 
 * 用途:
 *   1. BUILD Phase 1 進入前驗證 plan
 *   2. 獨立 CLI 驗證: node plan-validator.cjs <plan.md>
 *   3. health-report 整合 (未來)
 */

const fs = require('fs');
const path = require('path');

// ============================================
// Schema Rules
// ============================================

const VALID_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const VALID_TYPES = ['FEATURE', 'CONST', 'LIB', 'FIX', 'REFACTOR', 'CONFIG', 'TEST'];

/**
 * 驗證 implementation_plan 檔案
 * 
 * @param {string} planPath - plan 檔案的完整路徑
 * @returns {{ valid: boolean, errors: Array<{rule: string, message: string, severity: string}>, warnings: Array<{rule: string, message: string}>, stats: object }}
 */
function validatePlan(planPath) {
  const errors = [];   // BLOCKER 級
  const warnings = []; // WARNING 級 (不阻擋)

  if (!fs.existsSync(planPath)) {
    return {
      valid: false,
      errors: [{ rule: 'FILE_EXISTS', message: `Plan 檔案不存在: ${planPath}`, severity: 'BLOCKER' }],
      warnings: [],
      stats: {}
    };
  }

  const content = fs.readFileSync(planPath, 'utf8');
  const filename = path.basename(planPath);

  // ── Rule 1: H1 包含 Story ID ──
  const h1Match = content.match(/^#\s+(.+)/m);
  const storyIdInH1 = h1Match ? h1Match[1].match(/Story-(\d+)\.(\d+)/) : null;
  if (!storyIdInH1) {
    errors.push({ rule: 'H1_STORY_ID', message: 'H1 標題必須包含 Story-X.Y 格式', severity: 'BLOCKER' });
  }

  // ── Rule 2: Story ID 欄位存在且與檔名一致 ──
  const storyFieldMatch = content.match(/\*\*Story ID\*\*:\s*(Story-[\d.]+)/);
  const storyFromFilename = filename.match(/implementation_plan_(Story-[\d.]+)\.md/);
  
  if (!storyFieldMatch) {
    errors.push({ rule: 'STORY_ID_FIELD', message: '缺少 **Story ID**: Story-X.Y 欄位', severity: 'BLOCKER' });
  } else if (storyFromFilename && storyFieldMatch[1] !== storyFromFilename[1]) {
    errors.push({ 
      rule: 'STORY_ID_MISMATCH', 
      message: `Story ID 不一致: 欄位=${storyFieldMatch[1]}, 檔名=${storyFromFilename[1]}`, 
      severity: 'BLOCKER' 
    });
  }

  // ── Rule 3: §1 Story 目標 ──
  const hasSection1 = /##\s+1\.\s*Story\s*目標/i.test(content);
  if (!hasSection1) {
    warnings.push({ rule: 'SECTION_1', message: '缺少 §1 Story 目標 (建議有)' });
  }

  // ── Rule 4: §3 工作項目 table ──
  const hasSection3 = /##\s+3\.\s*工作項目/.test(content);
  if (!hasSection3) {
    errors.push({ rule: 'SECTION_3', message: '缺少 §3 工作項目 表格', severity: 'BLOCKER' });
  }

  // 驗證 table 欄位
  const tableHeaderMatch = content.match(/\|\s*Item\s*\|.*名稱.*\|.*Type.*\|.*Priority.*\|/i);
  if (hasSection3 && !tableHeaderMatch) {
    errors.push({ rule: 'TABLE_COLUMNS', message: '§3 工作項目表格缺少必要欄位 (Item, 名稱, Type, Priority)', severity: 'BLOCKER' });
  }

  // 提取 table rows 驗證 Priority 值
  const tableRows = content.match(/\|\s*\d+\s*\|[^|]+\|[^|]+\|\s*(P\d)\s*\|/g) || [];
  const priorities = [];
  for (const row of tableRows) {
    const pMatch = row.match(/\|\s*(P\d)\s*\|/);
    if (pMatch) {
      priorities.push(pMatch[1]);
      if (!VALID_PRIORITIES.includes(pMatch[1])) {
        errors.push({ rule: 'PRIORITY_VALUE', message: `無效的 Priority: ${pMatch[1]} (允許: P0-P3)`, severity: 'BLOCKER' });
      }
    }
  }

  // ── Rule 5: §4 Item 詳細規格 + GEMS 標籤 ──
  const hasSection4 = /##\s+4\.\s*Item\s*詳細規格/.test(content);
  if (!hasSection4) {
    errors.push({ rule: 'SECTION_4', message: '缺少 §4 Item 詳細規格', severity: 'BLOCKER' });
  }

  // 計算 Item 數量
  const itemHeaders = content.match(/###\s+Item\s+\d+/g) || [];
  if (hasSection4 && itemHeaders.length === 0) {
    errors.push({ rule: 'ITEM_COUNT', message: '§4 中沒有任何 Item 定義 (### Item N:)', severity: 'BLOCKER' });
  }

  // 檢查 GEMS 標籤 (至少一個 Item 要有)
  const hasGemsTag = /GEMS:\s*\S+\s*\|\s*P[0-3]/.test(content);
  const hasGemsFunction = /@GEMS-FUNCTION:/.test(content);
  const hasGemsContract = /@GEMS-CONTRACT:/.test(content);
  
  if (!hasGemsTag && !hasGemsFunction && !hasGemsContract) {
    errors.push({ rule: 'GEMS_TAG', message: '§4 中沒有任何 GEMS 標籤 (GEMS: 或 @GEMS-FUNCTION 或 @GEMS-CONTRACT)', severity: 'BLOCKER' });
  }

  // ── Rule 6: 檔案路徑參考 ──
  // 兩種格式: §5 檔案清單 table 或 inline **檔案**: 
  const hasSection5 = /##\s+5\.\s*(檔案清單|Integration)/.test(content);
  const hasInlineFiles = /\*\*檔案\*\*/.test(content);
  const hasFileTable = /\|\s*`?src\//.test(content);
  
  if (!hasSection5 && !hasInlineFiles && !hasFileTable) {
    warnings.push({ rule: 'FILE_REFS', message: '沒有找到檔案路徑參考 (§5 檔案清單 或 inline **檔案**)' });
  }

  // ── Rule 7: §8 架構審查 ──
  const hasSection8 = /##\s+8\.\s*架構審查/.test(content);
  if (!hasSection8) {
    warnings.push({ rule: 'SECTION_8', message: '缺少 §8 架構審查 (建議有)' });
  }

  // ── Rule 8: P0 函式必須有 GEMS-FLOW ──
  // 找所有 P0 的 GEMS 標籤，檢查是否有對應的 GEMS-FLOW
  const gemsBlocks = content.match(/GEMS:\s*\S+\s*\|\s*P0[^]*?(?=GEMS:\s*\S+|###|##|$)/g) || [];
  for (const block of gemsBlocks) {
    const fnName = block.match(/GEMS:\s*(\S+)/)?.[1];
    if (fnName && !block.includes('GEMS-FLOW:')) {
      warnings.push({ rule: 'P0_FLOW', message: `P0 函式 ${fnName} 缺少 GEMS-FLOW` });
    }
  }

  // ── Rule 10: AC_FIELD — P0/P1 函式建議有 AC 行 ──
  // AC 格式: // AC-X.Y (摘要)，放在 GEMS 標籤 */ 之後、[STEP] 之前
  // 找所有 P0/P1 的 Item 區塊，檢查是否有 AC 行
  const itemBlocks = content.split(/(?=###\s+Item\s+\d+)/);
  for (const block of itemBlocks) {
    if (!/###\s+Item\s+\d+/.test(block)) continue;
    // 只檢查 P0/P1
    const isP0P1 = /GEMS:\s*\S+\s*\|\s*P[01]/.test(block) ||
                   /\|\s*P[01]\s*\|/.test(block);
    if (!isP0P1) continue;
    // 跳過 Modify 類型（不生成骨架，AC 不強制）
    if (/\|\s*Modify\s*\|/i.test(block)) continue;
    // 檢查是否有 AC 行
    const hasAC = /\/\/\s*AC-[\d.]+/.test(block);
    if (!hasAC) {
      const fnName = block.match(/GEMS:\s*(\S+)/)?.[1] ||
                     block.match(/###\s+Item\s+(\d+)/)?.[1];
      warnings.push({ rule: 'AC_FIELD', message: `P0/P1 函式 ${fnName} 缺少 AC 行 (// AC-X.Y 摘要)` });
    }
  }

  // ── Rule 11: PLAN_TRACE — @PLAN_TRACE 轉換標記完整性（v4 plan 可追蹤性）──
  // 需要 SOURCE_CONTRACT + TARGET_PLAN + SLICE_COUNT 三個欄位
  const hasPlanTrace = /@PLAN_TRACE\s*\|/.test(content);
  const hasSourceContract = /SOURCE_CONTRACT:\s*\S+/.test(content);
  const hasSliceCount = /SLICE_COUNT:\s*\d+/.test(content);
  if (!hasPlanTrace) {
    errors.push({ rule: 'PLAN_TRACE', message: '缺少 @PLAN_TRACE 標記（Contract → Plan 轉換來源可追蹤性）— Plan 必須由 spec-to-plan 從 contract 產出並包含此標記', severity: 'BLOCKER' });
  } else {
    if (!hasSourceContract) {
      errors.push({ rule: 'PLAN_TRACE_SOURCE', message: '@PLAN_TRACE 缺少 SOURCE_CONTRACT 欄位（Plan 必須可追溯至來源 contract）', severity: 'BLOCKER' });
    }
    if (!hasSliceCount) {
      errors.push({ rule: 'PLAN_TRACE_COUNT', message: '@PLAN_TRACE 缺少 SLICE_COUNT 欄位（slice 數量必須顯式宣告，與 §4 Item 對齊）', severity: 'BLOCKER' });
    }
    // 若 SLICE_COUNT 存在，與 §4 Item 數量交叉驗證
    const sliceCountMatch = content.match(/SLICE_COUNT:\s*(\d+)/);
    if (sliceCountMatch && itemHeaders.length > 0) {
      const tracedCount = parseInt(sliceCountMatch[1], 10);
      if (tracedCount !== itemHeaders.length) {
        errors.push({
          rule: 'PLAN_TRACE_MISMATCH',
          message: `@PLAN_TRACE SLICE_COUNT=${tracedCount} ≠ §4 Item 數量 ${itemHeaders.length}（plan 與 contract 分片不一致）`,
          severity: 'BLOCKER'
        });
      }
    }
  }

  // ── Rule 12: ITEM_COUNT_MATCH — §3 table rows 數量 == §4 Item headers 數量 ──
  // 確保 contract block = slice = plan task 的 1:1 對應
  if (hasSection3 && hasSection4 && tableRows.length > 0 && itemHeaders.length > 0) {
    if (tableRows.length !== itemHeaders.length) {
      errors.push({
        rule: 'ITEM_COUNT_MATCH',
        message: `§3 工作項目 ${tableRows.length} 列 ≠ §4 Item 數量 ${itemHeaders.length}（contract slice 與 plan task 必須 1:1 對應）`,
        severity: 'BLOCKER'
      });
    }
  }

  // ── Rule 13: SLICE_TEST_PATH — v4 plan 每個 slice 必須有 @TEST 路徑（若有 SLICE_PRESERVE 區塊）──
  // 只針對 v4 plan（含 @PLAN_TRACE + SLICE_PRESERVE 標記）
  if (hasPlanTrace) {
    const sliceBlocks = content.split(/(?=###\s+Item\s+\d+)/);
    for (const block of sliceBlocks) {
      if (!/###\s+Item\s+\d+/.test(block)) continue;
      const itemTitle = block.match(/###\s+Item\s+\d+:\s*(\S+)/)?.[1] || '?';
      // 有 SLICE_PRESERVE 但沒有 @TEST 行 → WARNING（DB/UI 類型可合法省略）
      const hasPreserve = /SLICE_PRESERVE/.test(block);
      if (hasPreserve) {
        const hasTestRef = /@TEST:\s*\S+/.test(block);
        if (!hasTestRef) {
          warnings.push({ rule: 'SLICE_TEST_PATH', message: `Item ${itemTitle} 的 SLICE_PRESERVE 缺少 @TEST 路徑（純 DB/UI slice 可忽略）` });
        }
      }
    }
  }

  // ── Rule 9 (P8): Plan 檔案路徑驗證 ──
  // 掃描 plan 中所有 FILE 欄位引用的路徑，驗證是否存在
  if (planPath) {
    const planDir = path.dirname(planPath);
    // 嘗試推斷專案根目錄 (plan 在 .gems/iterations/iter-X/plan/ 下)
    const projectRoot = path.resolve(planDir, '..', '..', '..', '..');
    
    // 提取 **檔案**: `path/to/file.ts` 或 table 中的 `src/...` 路徑
    const fileRefs = [];
    const inlineFilePattern = /\*\*檔案\*\*:\s*`([^`]+)`/g;
    const tableFilePattern = /`(src\/[^`]+)`/g;
    
    let fileMatch;
    while ((fileMatch = inlineFilePattern.exec(content)) !== null) {
      fileRefs.push(fileMatch[1]);
    }
    while ((fileMatch = tableFilePattern.exec(content)) !== null) {
      fileRefs.push(fileMatch[1]);
    }
    
    // 去重
    const uniqueRefs = [...new Set(fileRefs)];
    const missingPaths = [];
    
    for (const ref of uniqueRefs) {
      const fullPath = path.join(projectRoot, ref);
      if (!fs.existsSync(fullPath)) {
        // 檢查是否在「新建檔案」清單中（plan 中標記為 [NEW] 或 (新建)）
        const isPlannedNew = content.includes(`${ref}`) && 
          (content.includes('[NEW]') || content.includes('(新建)') || content.includes('新增'));
        if (!isPlannedNew) {
          missingPaths.push(ref);
        }
      }
    }
    
    if (missingPaths.length > 0) {
      for (const mp of missingPaths) {
        warnings.push({ rule: 'FILE_PATH_MISSING', message: `Plan 引用的路徑不存在: ${mp} (可能是 AI 幻覺)` });
      }
    }
  }

  // ── Stats ──
  const stats = {
    itemCount: itemHeaders.length,
    tableRowCount: tableRows.length,
    priorities: priorities,
    p0Count: priorities.filter(p => p === 'P0').length,
    p1Count: priorities.filter(p => p === 'P1').length,
    hasGemsTag,
    hasGemsFunction,
    hasGemsContract,
    hasFileRefs: hasSection5 || hasInlineFiles || hasFileTable,
    hasArchReview: hasSection8,
    hasPlanTrace,
    hasSourceContract,
    hasSliceCount,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats
  };
}


/**
 * 格式化驗證結果為終端輸出
 * 
 * @param {{ valid: boolean, errors: Array, warnings: Array, stats: object }} result
 * @param {string} planPath
 * @returns {string}
 */
function formatResult(result, planPath) {
  const lines = [];
  const filename = path.basename(planPath);

  lines.push(`\n📋 Plan Schema Validation: ${filename}`);
  lines.push('─'.repeat(50));

  if (result.errors.length > 0) {
    lines.push(`\n🔴 ERRORS (${result.errors.length}):`);
    for (const e of result.errors) {
      lines.push(`  ✗ [${e.rule}] ${e.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push(`\n🟡 WARNINGS (${result.warnings.length}):`);
    for (const w of result.warnings) {
      lines.push(`  ⚠ [${w.rule}] ${w.message}`);
    }
  }

  if (result.valid) {
    lines.push(`\n✅ VALID | Items: ${result.stats.itemCount} | P0: ${result.stats.p0Count} | P1: ${result.stats.p1Count}`);
  } else {
    lines.push(`\n❌ INVALID | ${result.errors.length} error(s) must be fixed before BUILD`);
  }

  lines.push('─'.repeat(50));
  return lines.join('\n');
}

/**
 * 批量驗證一個 iteration 下所有 plan 檔案
 * 
 * @param {string} projectRoot - 專案根目錄
 * @param {string} iteration - iter-X
 * @returns {{ results: Array<{story: string, path: string, result: object}>, allValid: boolean }}
 */
function validateAllPlans(projectRoot, iteration) {
  const planDir = path.join(projectRoot, '.gems', 'iterations', iteration, 'plan');
  
  if (!fs.existsSync(planDir)) {
    return { results: [], allValid: false };
  }

  const planFiles = fs.readdirSync(planDir)
    .filter(f => f.startsWith('implementation_plan_') && f.endsWith('.md'));

  const results = [];
  let allValid = true;

  for (const file of planFiles) {
    const fullPath = path.join(planDir, file);
    const storyMatch = file.match(/implementation_plan_(Story-[\d.]+)\.md/);
    const story = storyMatch ? storyMatch[1] : file;
    
    const result = validatePlan(fullPath);
    results.push({ story, path: fullPath, result });
    
    if (!result.valid) allValid = false;
  }

  return { results, allValid };
}

// ============================================
// CLI
// ============================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node plan-validator.cjs <plan.md>           # 驗證單一 plan');
    console.log('  node plan-validator.cjs --all --target=<path> --iteration=iter-1  # 驗證全部');
    process.exit(0);
  }

  // --all mode
  if (args.includes('--all')) {
    let target = '.';
    let iteration = 'iter-1';
    for (const arg of args) {
      if (arg.startsWith('--target=')) target = arg.split('=')[1];
      if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
    }
    if (!path.isAbsolute(target)) target = path.resolve(process.cwd(), target);

    const { results, allValid } = validateAllPlans(target, iteration);
    
    if (results.length === 0) {
      console.log(`\n⚠️  No plan files found in ${iteration}/plan/`);
      process.exit(1);
    }

    for (const r of results) {
      console.log(formatResult(r.result, r.path));
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`Total: ${results.length} plan(s) | ${allValid ? '✅ ALL VALID' : '❌ HAS ERRORS'}`);
    process.exit(allValid ? 0 : 1);
  }

  // Single file mode
  let planPath = args[0];
  if (!path.isAbsolute(planPath)) planPath = path.resolve(process.cwd(), planPath);

  const result = validatePlan(planPath);
  console.log(formatResult(result, planPath));
  process.exit(result.valid ? 0 : 1);
}

// ============================================
// Exports
// ============================================
module.exports = { validatePlan, validateAllPlans, formatResult };
