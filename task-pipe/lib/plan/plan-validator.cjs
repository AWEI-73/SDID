#!/usr/bin/env node
// -*- coding: utf-8 -*-

'use strict';

const fs = require('fs');
const path = require('path');

const VALID_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const TDD_IMPL_TYPES = new Set(['SVC', 'ACTION', 'HTTP', 'HOOK', 'LIB']);
const EXEMPT_IMPL_TYPES = new Set(['DB', 'CONST', 'CONFIG']);

const SECTION_3_TEMPLATE = [
  '請改成以下格式：',
  '',
  '## 3. 工作項目',
  '',
  '| Item | 名稱 | Type | Priority | 明確度 | 預估 |',
  '|------|------|------|----------|--------|------|',
  '| 1 | buildV5GanttGroups | LIB | P1 | Clear | S |',
].join('\n');

const SECTION_4_TEMPLATE = [
  '請改成以下格式：',
  '',
  '## 4. Item 詳細規格',
  '',
  '### Item 1: buildV5GanttGroups',
  '',
  'SLICE_PRESERVE:',
  '// @CONTRACT: buildV5GanttGroups | P1 | LIB | Story-11.0',
  '// @TEST: frontend/src/__tests__/gantt-layout.test.ts',
  '// @GEMS-FLOW: GROUP_CATEGORY(Clear)->DERIVE_STATUS(Clear)->RETURN(Clear)',
  '',
  '```typescript',
  '// @CONTRACT: buildV5GanttGroups | P1 | LIB | Story-11.0',
  '// @TEST: frontend/src/__tests__/gantt-layout.test.ts',
  '// @GEMS-FLOW: GROUP_CATEGORY(Clear)->DERIVE_STATUS(Clear)->RETURN(Clear)',
  '// @GEMS-FUNCTION: buildV5GanttGroups',
  '/**',
  ' * GEMS: buildV5GanttGroups | P1 | Story-11.0 | GROUP_CATEGORY(Clear)->DERIVE_STATUS(Clear)->RETURN(Clear) | deps:[]',
  ' */',
  'export function buildV5GanttGroups(/* TODO */): unknown {',
  "  throw new Error('not implemented');",
  '}',
  '```',
].join('\n');

function makeError(rule, message) {
  return { rule, message, severity: 'BLOCKER' };
}

function makeWarning(rule, message) {
  return { rule, message };
}

function parseSection(content, sectionNumber, titlePattern) {
  const source = content.match(new RegExp(`^##\\s+${sectionNumber}\\.\\s*${titlePattern}\\s*$`, 'm'));
  if (!source) return null;
  const start = source.index;
  const rest = content.slice(start);
  const next = rest.slice(source[0].length).search(/\n##\s+\d+\.\s+/);
  return next === -1 ? rest : rest.slice(0, source[0].length + next);
}

function parseWorkItems(section3) {
  if (!section3) return [];
  const lines = section3.split(/\r?\n/).filter(line => line.trim().startsWith('|'));
  if (lines.length < 3) return [];
  return lines
    .slice(2)
    .map(line => line.split('|').map(cell => cell.trim()).filter(Boolean))
    .filter(cols => cols.length >= 6)
    .map(cols => ({
      item: cols[0],
      name: cols[1],
      type: cols[2],
      priority: cols[3],
      clarity: cols[4],
      estimate: cols[5],
    }));
}

function parseItemBlocks(section4) {
  if (!section4) return [];
  const matches = [...section4.matchAll(/^###\s+Item\s+(\d+):\s*([^\n]+)\s*$/gm)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : section4.length;
    return {
      item: match[1],
      name: match[2].trim(),
      content: section4.slice(start, end),
    };
  });
}

function parseContractLine(block) {
  const match = block.match(/@CONTRACT:\s*([^|\n]+)\|\s*(P[0-3])\s*\|\s*([A-Z]+)\s*\|\s*(Story-\d+\.\d+)/);
  if (!match) return null;
  return {
    name: match[1].trim(),
    priority: match[2],
    type: match[3].toUpperCase(),
    story: match[4],
  };
}

function hasImplementationSkeleton(block) {
  const code = block.match(/```typescript\s*\n([\s\S]*?)```/);
  if (!code) return false;
  const body = code[1];
  return /@CONTRACT:/.test(body)
    && /@TEST:/.test(body)
    && /@GEMS-FLOW:/.test(body)
    && /@GEMS-FUNCTION:/.test(body)
    && (
      /\bexport\s+(?:async\s+)?function\s+\w+\s*\(/.test(body)
      || /\bexport\s+const\s+\w+\s*=\s*(?:async\s*)?\(/.test(body)
      || /\bexport\s+class\s+\w+/.test(body)
    );
}

function extractTargetFiles(content) {
  return [...content.matchAll(/^\s*Target File:\s*(.+)\s*$/gm)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function validatePlan(planPath) {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(planPath)) {
    return {
      valid: false,
      errors: [makeError('FILE_EXISTS', `Plan file does not exist: ${planPath}`)],
      warnings,
      stats: {},
    };
  }

  const content = fs.readFileSync(planPath, 'utf8');
  const filename = path.basename(planPath);

  const storyFromFilename = filename.match(/implementation_plan_(Story-\d+\.\d+)\.md/)?.[1] || null;
  const storyField = content.match(/\*\*Story ID\*\*:\s*(Story-\d+\.\d+)/)?.[1] || null;
  const h1Story = content.match(/^#\s+.*?(Story-\d+\.\d+)/m)?.[1] || null;
  if (!h1Story) errors.push(makeError('H1_STORY_ID', 'H1 must include Story-X.Y.'));
  if (!storyField) errors.push(makeError('STORY_ID_FIELD', 'Missing `**Story ID**: Story-X.Y`.'));
  if (storyFromFilename && storyField && storyFromFilename !== storyField) {
    errors.push(makeError('STORY_ID_MISMATCH', `Story ID mismatch: field=${storyField}, filename=${storyFromFilename}.`));
  }

  if (!/^##\s+1\.\s*Story\s*目標\s*$/m.test(content)) {
    warnings.push(makeWarning('SECTION_1', 'Missing recommended `## 1. Story 目標`.'));
  }

  const section3 = parseSection(content, 3, '工作項目');
  if (!section3) {
    errors.push(makeError('SECTION_3', `缺少 canonical Section 3。\n${SECTION_3_TEMPLATE}`));
  }

  const hasCanonicalTableHeader = section3
    ? /\|\s*Item\s*\|\s*名稱\s*\|\s*Type\s*\|\s*Priority\s*\|\s*明確度\s*\|\s*預估\s*\|/.test(section3)
    : false;
  if (section3 && !hasCanonicalTableHeader) {
    errors.push(makeError('TABLE_COLUMNS', `Section 3 table header must be exactly:\n| Item | 名稱 | Type | Priority | 明確度 | 預估 |`));
  }

  const workItems = parseWorkItems(section3);
  for (const row of workItems) {
    if (!/^\d+$/.test(row.item)) errors.push(makeError('ITEM_NUMBER', `Invalid Item number: ${row.item}.`));
    if (!row.name) errors.push(makeError('ITEM_NAME', `Item ${row.item} missing 名稱.`));
    if (!VALID_PRIORITIES.has(row.priority)) {
      errors.push(makeError('PRIORITY_VALUE', `Item ${row.item} has invalid Priority "${row.priority}". Use P0, P1, P2, or P3.`));
    }
  }

  const section4 = parseSection(content, 4, 'Item\\s*詳細規格');
  if (!section4) {
    errors.push(makeError('SECTION_4', `缺少 canonical Section 4。\n${SECTION_4_TEMPLATE}`));
  }

  const itemBlocks = parseItemBlocks(section4);
  if (section4 && itemBlocks.length === 0) {
    errors.push(makeError('ITEM_COUNT', `Section 4 must contain Item headings like:\n### Item 1: buildV5GanttGroups`));
  }

  if (section3 && section4 && workItems.length > 0 && itemBlocks.length > 0 && workItems.length !== itemBlocks.length) {
    errors.push(makeError('ITEM_COUNT_MATCH', `Section 3 has ${workItems.length} item(s), but Section 4 has ${itemBlocks.length} item block(s). They must be 1:1.`));
  }

  const hasPlanTrace = /@PLAN_TRACE\s*\|/.test(content);
  const hasSourceContract = /SOURCE_CONTRACT:\s*\S+/.test(content);
  const hasTargetPlan = /TARGET_PLAN:\s*\S+/.test(content);
  const sliceCount = content.match(/SLICE_COUNT:\s*(\d+)/)?.[1];
  const targetFiles = extractTargetFiles(content);
  if (!hasPlanTrace) errors.push(makeError('PLAN_TRACE', 'Missing `@PLAN_TRACE | Story-X.Y`.'));
  if (hasPlanTrace && !hasSourceContract) errors.push(makeError('PLAN_TRACE_SOURCE', 'Missing `SOURCE_CONTRACT:` under @PLAN_TRACE.'));
  if (hasPlanTrace && !hasTargetPlan) errors.push(makeError('PLAN_TRACE_TARGET', 'Missing `TARGET_PLAN:` under @PLAN_TRACE.'));
  if (hasPlanTrace && !sliceCount) errors.push(makeError('PLAN_TRACE_COUNT', 'Missing `SLICE_COUNT:` under @PLAN_TRACE.'));
  if (sliceCount && itemBlocks.length > 0 && Number(sliceCount) !== itemBlocks.length) {
    errors.push(makeError('PLAN_TRACE_MISMATCH', `SLICE_COUNT=${sliceCount}, but Section 4 has ${itemBlocks.length} Item block(s).`));
  }
  if (itemBlocks.length > 0 && targetFiles.length === 0) {
    errors.push(makeError('TARGET_FILE', 'Missing `Target File:` anchor. Phase 4 trace closure requires explicit source anchors in the plan.'));
  }

  for (const block of itemBlocks) {
    const contract = parseContractLine(block.content);
    const tableRow = workItems.find(row => row.item === block.item);
    if (!contract) {
      warnings.push(makeWarning('CONTRACT_LINE', `Item ${block.item} missing @CONTRACT line.`));
      continue;
    }
    if (tableRow && tableRow.name !== contract.name) {
      errors.push(makeError('ITEM_NAME_MISMATCH', `Item ${block.item} table name "${tableRow.name}" does not match @CONTRACT name "${contract.name}".`));
    }
    if (EXEMPT_IMPL_TYPES.has(contract.type)) continue;
    const needsSkeleton = contract.priority === 'P0' || TDD_IMPL_TYPES.has(contract.type);
    if (needsSkeleton && !hasImplementationSkeleton(block.content)) {
      errors.push(makeError(
        'IMPL_SKELETON',
        `Item ${block.item}: ${contract.name} (${contract.priority}/${contract.type}) must contain a typescript code block inside this ### Item block with @CONTRACT, @TEST, @GEMS-FLOW, @GEMS-FUNCTION, and an export function/class skeleton.`
      ));
    }
  }

  if (!/##\s+5\.\s*檔案清單\s*$/m.test(content) && !/\*\*檔案\*\*:/.test(content) && !/`(?:frontend|backend-gas|src)\//.test(content)) {
    warnings.push(makeWarning('FILE_REFS', 'Missing recommended `## 5. 檔案清單` or inline `**檔案**:` references.'));
  }

  if (!/##\s+8\.\s*架構審查\s*$/m.test(content)) {
    warnings.push(makeWarning('SECTION_8', 'Missing recommended `## 8. 架構審查`.'));
  }

  const priorities = workItems.map(row => row.priority).filter(priority => VALID_PRIORITIES.has(priority));
  const stats = {
    itemCount: itemBlocks.length,
    tableRowCount: workItems.length,
    priorities,
    p0Count: priorities.filter(priority => priority === 'P0').length,
    p1Count: priorities.filter(priority => priority === 'P1').length,
    hasPlanTrace,
    hasSourceContract,
    hasTargetPlan,
    hasSliceCount: Boolean(sliceCount),
    targetFileCount: targetFiles.length,
  };

  return { valid: errors.length === 0, errors, warnings, stats };
}

function formatResult(result, planPath) {
  const lines = [];
  lines.push(`\nPlan Schema Validation: ${path.basename(planPath)}`);
  lines.push('--------------------------------------------------');

  if (result.errors.length > 0) {
    lines.push(`\nERRORS (${result.errors.length}):`);
    for (const error of result.errors) {
      lines.push(`  [${error.rule}] ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push(`\nWARNINGS (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      lines.push(`  [${warning.rule}] ${warning.message}`);
    }
  }

  if (result.valid) {
    lines.push(`\nVALID | Items: ${result.stats.itemCount} | P0: ${result.stats.p0Count} | P1: ${result.stats.p1Count}`);
  } else {
    lines.push(`\nINVALID | ${result.errors.length} error(s) must be fixed before BUILD`);
  }

  lines.push('--------------------------------------------------');
  return lines.join('\n');
}

function validateAllPlans(projectRoot, iteration) {
  const planDir = path.join(projectRoot, '.gems', 'iterations', iteration, 'plan');
  if (!fs.existsSync(planDir)) return { results: [], allValid: false };

  const planFiles = fs.readdirSync(planDir)
    .filter(file => file.startsWith('implementation_plan_') && file.endsWith('.md'));
  const results = [];
  let allValid = true;

  for (const file of planFiles) {
    const fullPath = path.join(planDir, file);
    const story = file.match(/implementation_plan_(Story-\d+\.\d+)\.md/)?.[1] || file;
    const result = validatePlan(fullPath);
    if (!result.valid) allValid = false;
    results.push({ story, path: fullPath, result });
  }

  return { results, allValid };
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node plan-validator.cjs <plan.md>');
    console.log('  node plan-validator.cjs --all --target=<path> --iteration=iter-1');
    process.exit(0);
  }

  if (args.includes('--all')) {
    let target = '.';
    let iteration = 'iter-1';
    for (const arg of args) {
      if (arg.startsWith('--target=')) target = arg.split('=').slice(1).join('=');
      if (arg.startsWith('--iteration=')) iteration = arg.split('=').slice(1).join('=');
    }
    if (!path.isAbsolute(target)) target = path.resolve(process.cwd(), target);
    const { results, allValid } = validateAllPlans(target, iteration);
    if (results.length === 0) {
      console.log(`No plan files found in ${iteration}/plan/`);
      process.exit(1);
    }
    for (const item of results) console.log(formatResult(item.result, item.path));
    console.log(`\nTotal: ${results.length} plan(s) | ${allValid ? 'ALL VALID' : 'HAS ERRORS'}`);
    process.exit(allValid ? 0 : 1);
  }

  let planPath = args[0];
  if (!path.isAbsolute(planPath)) planPath = path.resolve(process.cwd(), planPath);
  const result = validatePlan(planPath);
  console.log(formatResult(result, planPath));
  process.exit(result.valid ? 0 : 1);
}

module.exports = { validatePlan, validateAllPlans, formatResult };
