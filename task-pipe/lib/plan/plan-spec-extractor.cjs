#!/usr/bin/env node
/**
 * Plan Spec Extractor - 從 Implementation Plan 提取標籤規格
 * 用於 BUILD Phase 4/5 的規格對比驗證
 */
const fs = require('fs');
const path = require('path');

/**
 * 從 implementation plan 提取 GEMS 標籤規格
 * @param {string} planPath - implementation plan 檔案路徑
 * @returns {object} { functions: [], contracts: [], flows: [] }
 */
function extractPlanSpec(planPath) {
  if (!fs.existsSync(planPath)) {
    return { functions: [], contracts: [], flows: [], error: 'Plan not found' };
  }

  const content = fs.readFileSync(planPath, 'utf8');
  const spec = {
    functions: [],
    contracts: [],
    flows: [],
    testFiles: []
  };

  // 提取 GEMS 標籤規格（從 code block 中）
  const codeBlocks = content.match(/```typescript[\s\S]*?```/g) || [];

  for (const block of codeBlocks) {
    // 提取函式標籤
    const gemsMatch = block.match(/\* GEMS:\s*(\w+)\s*\|\s*(P[0-3])\s*\|\s*([✓○⚠]+)\s*\|\s*([^|]+)\s*\|\s*(Story-[\d.]+)\s*\|\s*([^\n]+)/);
    if (gemsMatch) {
      const fn = {
        name: gemsMatch[1].trim(),
        priority: gemsMatch[2],
        status: gemsMatch[3],
        signature: gemsMatch[4].trim(),
        storyId: gemsMatch[5],
        description: gemsMatch[6].trim()
      };

      // 提取 FLOW
      const flowMatch = block.match(/\* GEMS-FLOW:\s*([^\n]+)/);
      if (flowMatch) fn.flow = flowMatch[1].trim();

      // 提取 DEPS
      const depsMatch = block.match(/\* GEMS-DEPS:\s*([^\n]+)/);
      if (depsMatch) fn.deps = depsMatch[1].trim();

      // 提取 DEPS-RISK
      const riskMatch = block.match(/\* GEMS-DEPS-RISK:\s*([^\n]+)/);
      if (riskMatch) fn.depsRisk = riskMatch[1].trim();

      // 提取 TEST
      const testMatch = block.match(/\* GEMS-TEST:\s*([^\n]+)/);
      if (testMatch) fn.test = testMatch[1].trim();

      // 提取 TEST-FILE
      const testFileMatch = block.match(/\* GEMS-TEST-FILE:\s*([^\n]+)/);
      if (testFileMatch) {
        fn.testFile = testFileMatch[1].trim();
        if (!spec.testFiles.includes(fn.testFile)) {
          spec.testFiles.push(fn.testFile);
        }
      }

      spec.functions.push(fn);
    }

    // 提取 CONTRACT
    const contractMatch = block.match(/@GEMS-CONTRACT:\s*(\w+)/);
    if (contractMatch) {
      spec.contracts.push(contractMatch[1]);
    }
  }

  // 提取業務流程
  const flowMatch = content.match(/GEMS-FLOW:\s*([^\n]+)/g);
  if (flowMatch) {
    spec.flows = flowMatch.map(f => f.replace('GEMS-FLOW:', '').trim());
  }

  return spec;
}

/**
 * 對比實際程式碼與規格
 * @param {object} planSpec - 從 plan 提取的規格
 * @param {object} codeSpec - 從程式碼掃描的結果
 * @returns {object} { matches: [], mismatches: [], missing: [] }
 */
function compareSpecs(planSpec, codeSpec) {
  const result = {
    matches: [],
    mismatches: [],
    missing: [],
    extra: []
  };

  const planFnNames = planSpec.functions.map(f => f.name);
  const codeFnNames = codeSpec.functions.map(f => f.name);

  // 檢查 plan 中的函式是否都有實作
  for (const planFn of planSpec.functions) {
    const codeFn = codeSpec.functions.find(f => f.name === planFn.name);

    if (!codeFn) {
      result.missing.push({
        name: planFn.name,
        priority: planFn.priority,
        reason: '規格中定義但未實作'
      });
      continue;
    }

    // 對比標籤
    const issues = [];

    if (codeFn.priority !== planFn.priority) {
      issues.push(`優先級不符: 規格=${planFn.priority}, 實際=${codeFn.priority}`);
    }

    if (planFn.flow && !codeFn.flow) {
      issues.push('缺少 GEMS-FLOW');
    }

    if (planFn.testFile && !codeFn.testFile) {
      issues.push('缺少 GEMS-TEST-FILE');
    }

    if (issues.length > 0) {
      result.mismatches.push({
        name: planFn.name,
        priority: planFn.priority,
        issues
      });
    } else {
      result.matches.push({
        name: planFn.name,
        priority: planFn.priority
      });
    }
  }

  // 檢查程式碼中有但規格沒有的函式
  for (const codeFn of codeSpec.functions) {
    if (!planFnNames.includes(codeFn.name)) {
      result.extra.push({
        name: codeFn.name,
        priority: codeFn.priority || 'Unknown',
        reason: '實作但未在規格中定義'
      });
    }
  }

  return result;
}

/**
 * 產出規格對比報告
 */
function generateComparisonReport(comparison, storyId) {
  const lines = [];
  lines.push(`## 規格對比報告 - ${storyId}\n`);

  const total = comparison.matches.length + comparison.mismatches.length + comparison.missing.length;
  const matchRate = total > 0 ? Math.round((comparison.matches.length / total) * 100) : 0;

  lines.push(`### 摘要`);
  lines.push(`- 符合規格: ${comparison.matches.length}`);
  lines.push(`- 標籤不符: ${comparison.mismatches.length}`);
  lines.push(`- 未實作: ${comparison.missing.length}`);
  lines.push(`- 額外函式: ${comparison.extra.length}`);
  lines.push(`- 符合率: ${matchRate}%\n`);

  if (comparison.mismatches.length > 0) {
    lines.push(`### [X] 標籤不符`);
    for (const m of comparison.mismatches) {
      lines.push(`- **${m.name}** (${m.priority})`);
      for (const issue of m.issues) {
        lines.push(`  - ${issue}`);
      }
    }
    lines.push('');
  }

  if (comparison.missing.length > 0) {
    lines.push(`### [WARN] 未實作`);
    for (const m of comparison.missing) {
      lines.push(`- **${m.name}** (${m.priority}): ${m.reason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 取得 Story Context（當前 Story 的聚焦資訊）
 * @param {string} planPath - implementation plan 檔案路徑
 * @returns {object} { storyId, storyName, items: [], summary }
 */
function getStoryContext(planPath) {
  if (!fs.existsSync(planPath)) {
    return { storyId: null, storyName: null, items: [], summary: '找不到 Plan' };
  }

  const content = fs.readFileSync(planPath, 'utf8');
  const context = {
    storyId: null,
    storyName: null,
    items: [],
    p0Count: 0,
    p1Count: 0,
    summary: ''
  };

  // 提取 Story ID（從檔名或內容）
  const storyMatch = planPath.match(/implementation_plan_(Story-[\d.]+)\.md/);
  if (storyMatch) {
    context.storyId = storyMatch[1];
  }

  // 提取 Story 名稱（從標題）
  const titleMatch = content.match(/^#\s*(.+)/m);
  if (titleMatch) {
    context.storyName = titleMatch[1].trim();
  }

  // 提取 Items（從 ## Item 區塊）
  const itemPattern = /##\s*Item\s*(\d+)[:\s]*([^\n]+)?/gi;
  let match;
  while ((match = itemPattern.exec(content)) !== null) {
    const itemNum = match[1];
    const itemName = match[2] ? match[2].trim() : `Item ${itemNum}`;

    // 找這個 Item 下的函式
    const itemSection = extractItemSection(content, match.index);
    const functions = extractFunctionsFromSection(itemSection);

    context.items.push({
      id: `Item ${itemNum}`,
      name: itemName,
      functions: functions.map(f => ({ name: f.name, priority: f.priority }))
    });

    // 統計 P0/P1
    functions.forEach(f => {
      if (f.priority === 'P0') context.p0Count++;
      if (f.priority === 'P1') context.p1Count++;
    });
  }

  // 產出摘要
  const fnCount = context.items.reduce((sum, item) => sum + item.functions.length, 0);
  context.summary = `${context.storyId}: ${context.items.length} Items, ${fnCount} 函式 (P0:${context.p0Count} P1:${context.p1Count})`;

  return context;
}

/**
 * 提取 Item 區塊內容
 */
function extractItemSection(content, startIndex) {
  const remaining = content.slice(startIndex);
  const nextItemMatch = remaining.slice(1).search(/\n##\s*Item\s*\d+/i);
  if (nextItemMatch === -1) {
    return remaining;
  }
  return remaining.slice(0, nextItemMatch + 1);
}

/**
 * 從區塊中提取函式資訊
 */
function extractFunctionsFromSection(section) {
  const functions = [];
  const gemsPattern = /GEMS:\s*(\w+)\s*\|\s*(P[0-3])/g;
  let match;
  while ((match = gemsPattern.exec(section)) !== null) {
    functions.push({
      name: match[1],
      priority: match[2]
    });
  }
  return functions;
}

/**
 * 格式化 Story Context 輸出
 */
function formatStoryContext(context) {
  if (!context.storyId) return '找不到 Story Context';

  const lines = [`[INFO] ${context.summary}`];

  // 只列出 Item 名稱和函式數量（精簡版）
  if (context.items.length > 0) {
    const itemSummary = context.items
      .map(item => `${item.id}: ${item.functions.length}fn`)
      .join(' | ');
    lines.push(`   ${itemSummary}`);
  }

  return lines.join('\n');
}

// ============================================
// 函式清單 (Function Manifest) 提取器
// ============================================

/**
 * 從「函式清單」Markdown 表格提取函式
 * 
 * 表格格式:
 * | 函式名稱 | 優先級 | 簽名 | 說明 | 檔案 |
 * |---------|--------|------|------|------|
 * | `funcName` | P0 | `(args)→Result` | 描述 | `path/to/file.ts` |
 * 
 * @param {string} planPath - implementation plan 檔案路徑
 * @returns {object} { functions: [], stats: {}, hasManifest: boolean }
 */
function extractFunctionManifest(planPath) {
  const result = {
    functions: [],
    stats: { p0: 0, p1: 0, p2: 0, p3: 0, total: 0 },
    hasManifest: false,
    source: 'none'
  };

  if (!fs.existsSync(planPath)) {
    result.error = 'Plan not found';
    return result;
  }

  const content = fs.readFileSync(planPath, 'utf8');

  // 方法 1: 嘗試從「函式清單」表格提取
  const tableResult = extractFromTable(content);

  // 過濾掉 work-item 來源的結果（名稱可能不是函式名）
  const nonWorkItemFns = tableResult.functions.filter(f => f.source !== 'work-item');

  if (nonWorkItemFns.length > 0) {
    result.functions = nonWorkItemFns;
    result.hasManifest = true;
    result.source = 'table';
  } else {
    // 方法 2: Fallback 到從 GEMS 標籤區塊提取（向後相容）
    const tagResult = extractFromGemsTags(content);
    if (tagResult.functions.length > 0) {
      result.functions = tagResult.functions;
      result.hasManifest = true;
      result.source = 'gems-tags';
    } else if (tableResult.functions.length > 0) {
      // 方法 3: 如果 GEMS 標籤也沒有，才用 work-item 表格
      result.functions = tableResult.functions;
      result.hasManifest = true;
      result.source = 'table';
    }
  }

  // 計算統計
  for (const fn of result.functions) {
    result.stats.total++;
    const priority = fn.priority?.toLowerCase() || 'p3';
    if (result.stats[priority] !== undefined) {
      result.stats[priority]++;
    }
  }

  return result;
}

/**
 * 從 Markdown 表格提取函式
 * @param {string} content - plan 檔案內容
 * @returns {object} { functions: [] }
 */
function extractFromTable(content) {
  const functions = [];

  // 標準化換行符 (Windows CRLF → LF)
  content = content.replace(/\r\n/g, '\n');

  // 匹配「函式清單」表格
  // 支援多種標題格式: **函式清單**, **Function Manifest**, ## 函式清單
  const tablePatterns = [
    // **函式清單**: 後接表格
    /\*\*函式清單\*\*[:\s]*\n\|[^\n]+\|\n\|[-\s|]+\|\n((?:\|[^\n]+\|\n?)+)/gi,
    // **Function Manifest**: 後接表格
    /\*\*Function Manifest\*\*[:\s]*\n\|[^\n]+\|\n\|[-\s|]+\|\n((?:\|[^\n]+\|\n?)+)/gi,
    // 簡單表格（有函式名稱、優先級欄位）
    /\|[^\n]*函式名稱[^\n]*\|\n\|[-\s|]+\|\n((?:\|[^\n]+\|\n?)+)/gi
  ];

  for (const pattern of tablePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const tableBody = match[1];
      const rows = tableBody.trim().split('\n');

      for (const row of rows) {
        const parsed = parseTableRow(row);
        if (parsed) {
          functions.push(parsed);
        }
      }
    }

    // 如果找到表格就停止
    if (functions.length > 0) break;
  }

  // v3.0: 如果還沒找到，嘗試從「工作項目」表格提取
  // 格式: | Item | 名稱 | Type | Priority | ... |
  if (functions.length === 0) {
    const workItemPattern = /##\s*\d*\.?\s*工作項目\s*\n\n?\|[^\n]+\|\n\|[-\s|]+\|\n((?:\|[^\n]+\|\n?)+)/gi;
    let match;
    while ((match = workItemPattern.exec(content)) !== null) {
      const tableBody = match[1];
      const rows = tableBody.trim().split('\n');

      for (const row of rows) {
        const parsed = parseWorkItemRow(row);
        if (parsed) {
          functions.push(parsed);
        }
      }
    }
  }

  return { functions };
}

/**
 * 解析表格行
 * @param {string} row - 表格行
 * @returns {object|null} { name, priority, signature, description, file }
 */
function parseTableRow(row) {
  // 移除前後的 |
  const trimmed = row.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;

  // 分割欄位
  const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
  if (cells.length < 3) return null;

  // 提取函式名稱（移除反引號）
  const nameMatch = cells[0].match(/`?(\w+)`?/);
  if (!nameMatch) return null;

  // 提取優先級
  const priorityMatch = cells[1].match(/P([0-3])/i);
  if (!priorityMatch) return null;

  const fn = {
    name: nameMatch[1],
    priority: `P${priorityMatch[1]}`,
    signature: cells[2] ? cells[2].replace(/`/g, '').trim() : '',
    description: cells[3] ? cells[3].trim() : '',
    file: cells[4] ? cells[4].replace(/`/g, '').trim() : ''
  };

  return fn;
}

/**
 * v3.0: 解析「工作項目」表格行
 * 格式: | Item | 名稱 | Type | Priority | 明確度 | 預估 |
 * @param {string} row - 表格行
 * @returns {object|null} { name, priority, type, description }
 */
function parseWorkItemRow(row) {
  // 移除前後的 |
  const trimmed = row.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;

  // 分割欄位
  const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
  if (cells.length < 4) return null;

  // 欄位索引: | Item(0) | 名稱(1) | Type(2) | Priority(3) | 明確度(4) | 預估(5) |
  const itemId = cells[0];
  const name = cells[1];
  const type = cells[2];
  const priority = cells[3];

  // 驗證必要欄位
  if (!name || name.toLowerCase() === '名稱') return null; // 跳過標題行
  if (!priority) return null;

  // 提取優先級
  const priorityMatch = priority.match(/P([0-3])/i);
  if (!priorityMatch) return null;

  // 提取函式名稱（可能有反引號）
  const nameClean = name.replace(/`/g, '').trim();
  if (!nameClean || !/^\w+$/.test(nameClean)) return null;

  return {
    name: nameClean,
    priority: `P${priorityMatch[1]}`,
    type: type || 'FEATURE',
    description: cells[4] ? cells[4].trim() : '',
    estimate: cells[5] ? cells[5].trim() : '',
    source: 'work-item'
  };
}

/**
 * 從 GEMS 標籤區塊提取函式（向後相容）
 * v3.1: 同時從 Item 區塊提取檔案路徑
 * @param {string} content - plan 檔案內容
 * @returns {object} { functions: [] }
 */
function extractFromGemsTags(content) {
  const functions = [];

  // 匹配 GEMS: funcName | P0 | ... 格式
  const pattern = /GEMS:\s*(\w+)\s*\|\s*(P[0-3])\s*\|\s*[✓○-]+\s*\|\s*([^|]+)\s*\|\s*(Story-[\d.]+)\s*\|\s*([^\n]+)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const funcName = match[1].trim();

    // 從 Item 區塊的檔案表格提取路徑
    const filePath = findFilePathForFunction(content, funcName);

    functions.push({
      name: funcName,
      priority: match[2],
      signature: match[3].trim(),
      storyId: match[4],
      description: match[5].trim(),
      file: filePath,
      source: 'gems-tag'
    });
  }

  return { functions };
}

/**
 * 從 Plan 的 Item 區塊找函式對應的檔案路徑
 * 支援兩種 Plan 格式：
 *   - Blueprint 格式: ### Item 1: funcName + **檔案**: 表格
 *   - POC/PLAN 格式: ### Item 1: 中文名稱 + **檔案**: `src/path` 單行
 * 
 * 策略：找包含該函式 GEMS 標籤的 Item 區塊，再從區塊提取檔案路徑
 * 
 * @param {string} content - plan 檔案內容
 * @param {string} funcName - 函式名稱
 * @returns {string} 檔案路徑，找不到回傳空字串
 */
function findFilePathForFunction(content, funcName) {
  const marker = '### Item ';
  let pos = 0;

  while (true) {
    const idx = content.indexOf(marker, pos);
    if (idx === -1) break;

    // 取得這個 Item 區塊（到下一個 ### Item 或 ## 為止）
    const nextItem = content.indexOf(marker, idx + marker.length);
    const nextSection = content.indexOf('\n## ', idx + 1);
    let blockEnd = content.length;
    if (nextItem !== -1) blockEnd = Math.min(blockEnd, nextItem);
    if (nextSection !== -1) blockEnd = Math.min(blockEnd, nextSection);
    const block = content.substring(idx, blockEnd);

    // 檢查這個區塊是否包含該函式（header 或 GEMS 標籤）
    const headerLine = block.substring(0, block.indexOf('\n') || block.length);
    const hasInHeader = headerLine.includes(funcName);
    const hasInGems = block.includes(`GEMS: ${funcName} `) || block.includes(`GEMS: ${funcName}|`);

    if (hasInHeader || hasInGems) {
      // 在這個區塊中找檔案表格
      const fileTablePattern = /\*\*檔案\*\*[:\s]*\n\|[^\n]+\|\n\|[-\s|]+\|\n\|[ ]*`?([^`|\s]+)`?/i;
      const match = fileTablePattern.exec(block);
      if (match && match[1] && match[1] !== '檔案') {
        return match[1];
      }

      // 如果沒有檔案表格，嘗試找單行的 **檔案**: `path`
      const singleLinePattern = /\*\*檔案\*\*[:\s]*`([^`]+)`/i;
      const singleMatch = singleLinePattern.exec(block);
      if (singleMatch && singleMatch[1]) {
        return singleMatch[1];
      }
      break;
    }

    pos = idx + marker.length;
  }

  // 如果 Item 區塊找不到，嘗試在全域搜尋 **檔案**: `path`
  // 這是一般針對整個模組只有一個主要檔案的寫法
  const globalFilePattern = /\*\*檔案\*\*[:\s]*\n\|[^\n]+\|\n\|[-\s|]+\|\n\|[ ]*`?([^`|\s]+)`?/i;
  const globalMatch = globalFilePattern.exec(content);
  if (globalMatch && globalMatch[1] && globalMatch[1] !== '檔案') {
    return globalMatch[1];
  }

  return '';
}
function validateFunctionManifest(manifest) {
  const issues = [];

  if (!manifest.hasManifest) {
    issues.push('未找到函式清單表格或 GEMS 標籤');
  }

  if (manifest.functions.length === 0) {
    issues.push('函式清單為空');
  }

  // 檢查是否有 P0 函式（僅警告，不影響 valid）
  if (manifest.stats.p0 === 0 && manifest.stats.total > 0) {
    // 不加入 issues，只是資訊提示
  }

  // 檢查每個函式是否有必要欄位
  for (const fn of manifest.functions) {
    if (!fn.name) {
      issues.push(`函式缺少名稱`);
    }
    if (!fn.priority) {
      issues.push(`函式 ${fn.name || 'unknown'} 缺少優先級`);
    }
    if (manifest.source === 'table' && !fn.file && fn.source !== 'work-item') {
      issues.push(`函式 ${fn.name} 缺少檔案路徑`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * 產生函式清單摘要
 * @param {object} manifest - extractFunctionManifest 的結果
 * @returns {string} 格式化摘要
 */
function formatFunctionManifest(manifest) {
  if (!manifest.hasManifest) {
    return '[WARN] 未找到函式清單';
  }

  const lines = [
    `[INFO] 函式清單 (來源: ${manifest.source})`,
    `   總計: ${manifest.stats.total} 個函式`,
    `   P0: ${manifest.stats.p0} | P1: ${manifest.stats.p1} | P2: ${manifest.stats.p2} | P3: ${manifest.stats.p3}`
  ];

  if (manifest.functions.length <= 5) {
    lines.push('   函式:');
    for (const fn of manifest.functions) {
      lines.push(`   - ${fn.name} (${fn.priority})${fn.file ? ` → ${fn.file}` : ''}`);
    }
  }

  return lines.join('\n');
}

// ============================================
// 檔案清單 (File Manifest) 提取器 v1.0
// 從 Plan 的 Item 詳細規格提取預期檔案路徑
// ============================================

/**
 * 從 Implementation Plan 提取檔案清單 (File Manifest)
 * 
 * 從每個 Item 的「檔案」表格提取預期的檔案路徑：
 * | 檔案 | 動作 | 說明 |
 * |------|------|------|
 * | `src/shared/types/core-types.ts` | New | 核心型別定義 |
 * 
 * @param {string} planPath - implementation plan 檔案路徑
 * @returns {object} { files: [{ path, action, description, functionName }], hasManifest: boolean }
 */
function extractFileManifest(planPath) {
  const result = {
    files: [],
    hasManifest: false
  };

  if (!fs.existsSync(planPath)) {
    result.error = 'Plan not found';
    return result;
  }

  const content = fs.readFileSync(planPath, 'utf8').replace(/\r\n/g, '\n');

  // 找出所有 Item 區塊，提取函式名稱和檔案表格
  const itemPattern = /###\s*Item\s*\d+[:\s]*([^\n]+)/gi;
  let itemMatch;

  while ((itemMatch = itemPattern.exec(content)) !== null) {
    const itemName = itemMatch[1].trim();

    // 取得這個 Item 的區塊內容（到下一個 ### 或 ## 為止）
    const remaining = content.slice(itemMatch.index);
    const nextSectionMatch = remaining.slice(1).search(/\n#{2,3}\s/);
    const itemSection = nextSectionMatch === -1
      ? remaining
      : remaining.slice(0, nextSectionMatch + 1);

    // 從 Item 區塊提取 GEMS 函式名稱
    const gemsNameMatch = itemSection.match(/GEMS:\s*(\w+)\s*\|/);
    const functionName = gemsNameMatch ? gemsNameMatch[1] : itemName;

    // 從 Item 區塊提取檔案表格
    const fileTablePattern = /\*\*檔案\*\*[:\s]*\n\|[^\n]+\|\n\|[-\s|]+\|\n((?:\|[^\n]+\|\n?)+)/gi;
    let tableMatch;

    while ((tableMatch = fileTablePattern.exec(itemSection)) !== null) {
      const tableBody = tableMatch[1];
      const rows = tableBody.trim().split('\n');

      for (const row of rows) {
        const trimmed = row.trim();
        if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;

        const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
        if (cells.length < 2) continue;

        const filePath = cells[0].replace(/`/g, '').trim();
        if (!filePath || filePath === '檔案' || !filePath.includes('/')) continue;

        const action = cells[1] ? cells[1].replace(/`/g, '').trim() : '';
        const description = cells[2] ? cells[2].trim() : '';

        result.files.push({
          path: filePath,
          action,
          description,
          functionName
        });
      }
    }
  }

  result.hasManifest = result.files.length > 0;
  return result;
}

/**
 * 比對 Plan 檔案清單 vs 實際檔案位置
 * 
 * @param {object} fileManifest - extractFileManifest 的結果
 * @param {object} scanResult - gems-validator-lite 的掃描結果
 * @param {string} projectRoot - 專案根目錄
 * @returns {object} { matched: [], misplaced: [], missing: [] }
 */
function compareFilePaths(fileManifest, scanResult, projectRoot) {
  const result = {
    matched: [],
    misplaced: [],
    missing: []
  };

  if (!fileManifest.hasManifest) return result;

  for (const planned of fileManifest.files) {
    const expectedPath = planned.path;
    const functionName = planned.functionName;

    // 在掃描結果中找這個函式
    const found = scanResult.functions.find(f =>
      f.name.toLowerCase() === functionName.toLowerCase()
    );

    if (!found) {
      const fullPath = path.join(projectRoot, expectedPath);
      result.missing.push({
        functionName,
        expectedPath,
        reason: fs.existsSync(fullPath) ? '檔案存在但缺少 GEMS 標籤' : '檔案不存在'
      });
      continue;
    }

    // 比對路徑
    // found.file 可能是多種格式：
    //   - "expense-tracker/src/..." (cwd = workspace root)
    //   - "../expense-tracker/src/..." (cwd = task-pipe/)
    //   - "src/..." (cwd = project root)
    // 需要統一轉換為相對於 projectRoot 的路徑
    const actualRelative = found.file.replace(/\\/g, '/');
    const projectName = path.basename(projectRoot);

    let actualFromProject = actualRelative;

    // 策略 1: 直接前綴剝離 "projectName/"
    if (actualRelative.startsWith(projectName + '/')) {
      actualFromProject = actualRelative.slice(projectName.length + 1);
    }
    // 策略 2: 處理 "../projectName/" 格式 (cwd 不在 workspace root 時)
    else if (actualRelative.includes('/' + projectName + '/')) {
      const idx = actualRelative.indexOf('/' + projectName + '/');
      actualFromProject = actualRelative.slice(idx + projectName.length + 2);
    }
    // 策略 3: 處理 "..\projectName\" 或其他相對路徑格式
    else if (actualRelative.includes(projectName + '/')) {
      const idx = actualRelative.indexOf(projectName + '/');
      actualFromProject = actualRelative.slice(idx + projectName.length + 1);
    }

    const expectedNorm = expectedPath.replace(/\\/g, '/');
    const actualNorm = actualFromProject.replace(/\\/g, '/');

    if (expectedNorm === actualNorm) {
      result.matched.push({ functionName, path: expectedPath });
    } else {
      result.misplaced.push({
        functionName,
        expectedPath: expectedNorm,
        actualPath: actualNorm
      });
    }
  }

  return result;
}

// ============================================
// FLOW↔STEP 一致性檢查 v1.0
// 比對 Plan 定義的 GEMS-FLOW 和 [STEP] 錨點 vs 實際程式碼
// ============================================

/**
 * 從 Plan 提取每個函式的預期 FLOW 和 STEP 錨點
 * @param {string} planPath - implementation plan 檔案路徑
 * @returns {object[]} [{ functionName, expectedFlow, expectedSteps }]
 */
function extractPlanFlowSteps(planPath) {
  if (!fs.existsSync(planPath)) return [];

  const content = fs.readFileSync(planPath, 'utf8').replace(/\r\n/g, '\n');
  const results = [];

  // 找每個 Item 的 code block，提取 GEMS-FLOW 和 [STEP]
  const itemPattern = /###\s*Item\s*\d+[:\s]*([^\n]+)/gi;
  let itemMatch;

  while ((itemMatch = itemPattern.exec(content)) !== null) {
    const remaining = content.slice(itemMatch.index);
    const nextSectionMatch = remaining.slice(1).search(/\n#{2,3}\s/);
    const itemSection = nextSectionMatch === -1
      ? remaining
      : remaining.slice(0, nextSectionMatch + 1);

    // 提取函式名稱
    const gemsNameMatch = itemSection.match(/GEMS:\s*(\w+)\s*\|/);
    if (!gemsNameMatch) continue;
    const functionName = gemsNameMatch[1];

    // 提取 GEMS-FLOW
    const flowMatch = itemSection.match(/GEMS-FLOW:\s*([^\n]+)/);
    const expectedFlow = flowMatch ? flowMatch[1].trim() : null;

    // 提取 [STEP] 錨點
    const stepMatches = itemSection.match(/\/\/\s*\[STEP\]\s*(\w+)/g) || [];
    const expectedSteps = stepMatches.map(s => {
      const m = s.match(/\[STEP\]\s*(\w+)/);
      return m ? m[1] : null;
    }).filter(Boolean);

    if (expectedFlow || expectedSteps.length > 0) {
      results.push({ functionName, expectedFlow, expectedSteps });
    }
  }

  return results;
}

/**
 * 比對 Plan FLOW/STEP vs 實際程式碼 FLOW/STEP
 *
 * @param {string} planPath - implementation plan 檔案路徑
 * @param {object} scanResult - gems-validator-lite 的掃描結果
 * @returns {object} { matched: [], mismatched: [] }
 *   mismatched[]: { functionName, planFlow, actualFlow, planSteps, actualSteps, issues[] }
 */
function compareFlowSteps(planPath, scanResult) {
  const result = { matched: [], mismatched: [] };

  const planFlows = extractPlanFlowSteps(planPath);
  if (planFlows.length === 0) return result;

  for (const plan of planFlows) {
    const codeFn = scanResult.functions.find(f =>
      f.name.toLowerCase() === plan.functionName.toLowerCase()
    );

    if (!codeFn) continue; // 檔案缺失由 compareFilePaths 處理

    const issues = [];

    // 1. 比對 GEMS-FLOW
    const actualFlow = codeFn.flow || '';
    if (plan.expectedFlow && actualFlow) {
      const planFlowNorm = plan.expectedFlow.replace(/\s/g, '');
      const actualFlowNorm = actualFlow.replace(/\s/g, '');
      if (planFlowNorm !== actualFlowNorm) {
        issues.push({
          type: 'FLOW_MISMATCH',
          msg: `GEMS-FLOW 不符`,
          plan: plan.expectedFlow,
          actual: actualFlow
        });
      }
    }

    // 2. 比對 [STEP] 錨點
    // 從實際程式碼的原始檔案讀取 [STEP] 錨點（含行號）
    const stepDetail = extractActualStepsDetailed(codeFn);
    const actualSteps = stepDetail.steps;

    if (plan.expectedSteps.length > 0 && actualSteps.length > 0) {
      const planStepsStr = plan.expectedSteps.join(',');
      const actualStepsStr = actualSteps.join(',');
      if (planStepsStr !== actualStepsStr) {
        issues.push({
          type: 'STEP_MISMATCH',
          msg: `[STEP] 錨點不符`,
          plan: plan.expectedSteps,
          actual: actualSteps
        });
      }
    } else if (plan.expectedSteps.length > 0 && actualSteps.length === 0) {
      issues.push({
        type: 'STEP_MISSING',
        msg: `缺少 [STEP] 錨點`,
        plan: plan.expectedSteps,
        actual: []
      });
    }

    // 3. 檢測 [STEP] 堆疊（錨點沒有散佈到對應程式碼旁）
    if (stepDetail.stepLines.length >= 3) {
      const stacking = detectStepStacking(stepDetail);
      if (stacking.stacked) {
        issues.push({
          type: 'STEP_STACKED',
          msg: `[STEP] 錨點堆疊在一起，應散佈到對應程式碼旁`,
          stackedSteps: stacking.stackedSteps,
          maxConsecutive: stacking.maxConsecutive
        });
      }
    }

    if (issues.length > 0) {
      result.mismatched.push({
        functionName: plan.functionName,
        planFlow: plan.expectedFlow,
        actualFlow,
        planSteps: plan.expectedSteps,
        actualSteps,
        issues
      });
    } else {
      result.matched.push({ functionName: plan.functionName });
    }
  }

  return result;
}

/**
 * 從掃描結果的原始檔案讀取 [STEP] 錨點（含行號）
 * @returns {{ steps: string[], stepLines: { name: string, line: number }[], filePath: string|null }}
 */
function extractActualStepsDetailed(codeFn) {
  const filePath = codeFn.file;
  if (!filePath) return { steps: [], stepLines: [], filePath: null };

  const candidates = [filePath, path.resolve(filePath)];

  for (const fp of candidates) {
    if (fs.existsSync(fp)) {
      const content = fs.readFileSync(fp, 'utf8');
      const lines = content.split('\n');
      const stepLines = [];

      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/\/\/\s*\[STEP\]\s*(\w+)/);
        if (m) {
          stepLines.push({ name: m[1], line: i + 1 });
        }
      }

      return {
        steps: stepLines.map(s => s.name),
        stepLines,
        filePath: fp,
        totalLines: lines.length
      };
    }
  }

  return { steps: [], stepLines: [], filePath: null };
}

/**
 * 檢測 [STEP] 錨點是否堆疊在一起（沒有散佈到對應程式碼旁）
 * 
 * 判定規則：如果有 3+ 個 STEP，且其中有連續 3+ 個 STEP 之間
 * 沒有實質程式碼（只有空行、註解、其他 STEP），就判定為堆疊。
 * 
 * @param {{ stepLines: { name: string, line: number }[], filePath: string }} detail
 * @returns {{ stacked: boolean, stackedSteps: string[], maxConsecutive: number }}
 */
function detectStepStacking(detail) {
  const { stepLines, filePath } = detail;

  if (!filePath || stepLines.length < 3) {
    return { stacked: false, stackedSteps: [], maxConsecutive: 0 };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // 找出連續堆疊的 STEP 群組
  // 兩個 STEP 之間如果只有空行、純註解行、其他 STEP 行，就算「連續」
  let consecutiveGroup = [stepLines[0]];
  let maxConsecutive = 1;
  const stackedGroups = [];

  for (let i = 1; i < stepLines.length; i++) {
    const prevLine = stepLines[i - 1].line;
    const currLine = stepLines[i].line;

    // 檢查兩個 STEP 之間的行是否都是「非實質程式碼」
    let hasCode = false;
    for (let ln = prevLine; ln < currLine - 1; ln++) {
      const lineContent = lines[ln] ? lines[ln].trim() : '';
      // 跳過空行、純註解行、STEP 行
      if (lineContent === '') continue;
      if (lineContent.startsWith('//')) continue;
      if (lineContent.startsWith('*')) continue;  // JSDoc 內容
      if (lineContent.startsWith('/*')) continue;
      if (lineContent.startsWith('*/')) continue;
      // 有實質程式碼
      hasCode = true;
      break;
    }

    if (!hasCode) {
      consecutiveGroup.push(stepLines[i]);
    } else {
      // 結束當前群組
      if (consecutiveGroup.length >= 3) {
        stackedGroups.push([...consecutiveGroup]);
      }
      if (consecutiveGroup.length > maxConsecutive) {
        maxConsecutive = consecutiveGroup.length;
      }
      consecutiveGroup = [stepLines[i]];
    }
  }

  // 處理最後一個群組
  if (consecutiveGroup.length > maxConsecutive) {
    maxConsecutive = consecutiveGroup.length;
  }
  if (consecutiveGroup.length >= 3) {
    stackedGroups.push([...consecutiveGroup]);
  }

  const allStacked = stackedGroups.flatMap(g => g.map(s => s.name));

  return {
    stacked: allStacked.length >= 3,
    stackedSteps: allStacked,
    maxConsecutive,
    stackedGroups
  };
}

/**
 * 向後相容：只回傳 step 名稱陣列
 */
function extractActualSteps(codeFn, scanResult) {
  return extractActualStepsDetailed(codeFn).steps;
}

module.exports = {
  // 原有功能
  extractPlanSpec,
  compareSpecs,
  generateComparisonReport,
  getStoryContext,
  formatStoryContext,

  // 函式清單 (Function Manifest)
  extractFunctionManifest,
  validateFunctionManifest,
  formatFunctionManifest,

  // 檔案清單 (File Manifest) v1.0
  extractFileManifest,
  compareFilePaths,

  // FLOW↔STEP 一致性 v1.0
  compareFlowSteps
};
