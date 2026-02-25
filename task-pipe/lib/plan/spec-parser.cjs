#!/usr/bin/env node
/**
 * Spec Parser v1.0 - 從 requirement_spec 提取結構化資料
 * 
 * 解析 requirement_spec_iter-X.md，提取：
 * - Story 列表（ID、目標、模組名稱）
 * - 每個 Story 的函式清單（名稱、priority、描述）
 * - 資料契約（型別定義）
 * 
 * 設計原則：盡量從 spec 中提取，不足的部分用合理預設值
 */
const fs = require('fs');
const path = require('path');

/**
 * 解析 requirement_spec 檔案
 * @param {string} specPath - requirement_spec 檔案路徑
 * @returns {object} { title, level, stories: [], contracts: [], deferred: [] }
 */
function parseSpec(specPath) {
  if (!fs.existsSync(specPath)) {
    return { title: '', level: 'M', stories: [], contracts: [], deferred: [], error: 'Spec not found' };
  }

  const content = fs.readFileSync(specPath, 'utf8');
  const result = {
    title: extractTitle(content),
    level: extractLevel(content),
    stories: extractStories(content),
    contracts: extractContracts(content),
    deferred: extractDeferred(content),
  };

  return result;
}

/**
 * 提取標題
 */
function extractTitle(content) {
  const match = content.match(/^#\s+.*?(\S+)\s*-/m);
  return match ? match[1] : '';
}

/**
 * 提取 Level
 */
function extractLevel(content) {
  const match = content.match(/\*\*Level\*\*:\s*(\w+)/i);
  return match ? match[1].toUpperCase() : 'M';
}

/**
 * 提取所有 Story
 */
function extractStories(content) {
  const stories = [];
  // 從 spec 標題提取專案名稱作為模組推導的上下文
  const projectName = extractProjectName(content);

  // 匹配 ### Story X.Y: 標題 或 ### Story X.Y 標題
  const storyPattern = /###\s+Story\s+(\d+\.\d+)[:\s]+(.+)/gi;
  let match;

  while ((match = storyPattern.exec(content)) !== null) {
    const storyId = `Story-${match[1]}`;
    const storyTitle = match[2].trim();
    const storyIndex = stories.length;

    // 提取這個 Story 區塊的內容（到下一個 ### Story 或 ## 為止）
    const blockStart = match.index;
    const remaining = content.slice(blockStart);
    const nextStory = remaining.slice(1).search(/\n###\s+Story\s+\d+\.\d+/i);
    const nextSection = remaining.slice(1).search(/\n##\s+[^#]/);
    let blockEnd = remaining.length;
    if (nextStory !== -1) blockEnd = Math.min(blockEnd, nextStory + 1);
    if (nextSection !== -1) blockEnd = Math.min(blockEnd, nextSection + 1);
    const block = remaining.slice(0, blockEnd);

    // 推導模組名稱（傳入專案名稱作為上下文）
    const moduleName = inferModuleName(storyTitle, storyIndex, projectName);

    // 推導是否為基礎建設
    const isFoundation = storyIndex === 0 || /基礎|infrastructure|shared|config/i.test(storyTitle);

    // Strategy 0: 從 ## 5.5 函式規格表 直接讀取（最高優先）
    const tableFunctions = extractFunctionsFromTable(content, storyId);

    // 如果 5.5 區塊存在但此 story 沒有 table 行，發出警告
    const has55Section = /##\s+5\.5\s+函式規格表/.test(content);
    if (has55Section && !tableFunctions) {
      const storyNum = storyId.replace('Story-', '');
      process.stderr.write(`[spec-parser] WARN: ${storyId} 在 5.5 函式規格表找不到有效行（story="${storyNum}"），fallback 至 BDD regex 策略。請確認表格格式是否正確。\n`);
    }

    // 提取函式清單
    const functions = tableFunctions
      ? tableFunctions.map((fn, i) => enrichFunction(fn, i, tableFunctions.length, storyId, moduleName, isFoundation))
      : extractFunctionsFromStory(block, storyId, moduleName, isFoundation);

    // 提取驗收條件
    const acceptanceCriteria = extractAcceptanceCriteria(block);

    stories.push({
      id: storyId,
      index: parseInt(match[1].split('.')[1]),
      title: storyTitle,
      moduleName,
      isFoundation,
      functions,
      acceptanceCriteria,
    });
  }

  return stories;
}

/**
 * 從 spec 內容提取專案名稱
 * e.g. "# 📦 note-app - 需求規格書" → "note"
 * e.g. "# 📦 recipe-manager - 需求規格書" → "recipe"
 */
function extractProjectName(content) {
  // 匹配標題行: # ... name-app 或 # ... name-manager 等
  const titleMatch = content.match(/^#\s+.*?(\w[\w-]*(?:-app|-manager|-service|-api|-tool|-system))/mi);
  if (titleMatch) {
    // "note-app" → "note", "recipe-manager" → "recipe"
    return titleMatch[1].replace(/-(app|manager|service|api|tool|system)$/i, '');
  }
  // Fallback: 找標題中的英文名詞
  const fallback = content.match(/^#\s+.*?([a-zA-Z][\w-]+)/m);
  return fallback ? fallback[1].toLowerCase() : '';
}

/**
 * Strategy 0: 從 ## 5.5 函式規格表 直接讀取（最高優先）
 * 格式: | Story | 函式名稱 | Type | Priority | GEMS-FLOW | 說明 |
 * @returns {Array|null} 若找到且有有效行則回傳陣列，否則 null
 */
function extractFunctionsFromTable(fullContent, storyId) {
  // 找到 5.5 區塊
  const tableSection = fullContent.match(/##\s+5\.5\s+函式規格表[\s\S]*?(?=\n##\s+[^#]|$)/);
  if (!tableSection) return null;

  // storyId 如 "Story-1.1" → storyNum 如 "1.1"
  const storyNum = storyId.replace('Story-', '');
  const functions = [];

  // 匹配每一列: | storyNum | 函式名稱 | Type | Priority | GEMS-FLOW | 說明 |
  const rowPattern = /\|\s*([\d.]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]*)\s*\|/g;
  let match;
  while ((match = rowPattern.exec(tableSection[0])) !== null) {
    const rowStory = match[1].trim();
    const name = match[2].trim();
    const type = match[3].trim();
    const priority = match[4].trim();
    const flow = match[5].trim();
    const desc = match[6].trim();

    // 只讀取屬於此 Story 的行（完全匹配 storyNum，如 "10.1"）
    if (rowStory !== storyNum) continue;
    // 跳過佔位符列
    if (name.startsWith('[') || type.startsWith('[') || name === '函式名稱') continue;
    // 跳過分隔列
    if (/^[-:]+$/.test(name)) continue;

    functions.push({ name, type, priority, flow, description: desc, source: 'spec-table' });
  }

  return functions.length > 0 ? functions : null;
}

/**
 * 從 Story 區塊提取函式
 */
function extractFunctionsFromStory(block, storyId, moduleName, isFoundation) {
  const functions = [];

  // 策略 1: 從驗收條件提取函式名稱 (e.g. "createNote 驗證標題後建立筆記")
  const acPattern = /^-\s+(\w+)\s+(.+)/gm;
  let match;
  while ((match = acPattern.exec(block)) !== null) {
    const name = match[1];
    const desc = match[2].trim();
    // 過濾掉非函式名稱（首字母大寫的通常是類別或型別）
    if (/^[a-z]/.test(name) && name.length > 2 && !isCommonWord(name)) {
      functions.push({ name, description: desc, source: 'acceptance-criteria' });
    }
  }

  // 策略 2: 從已驗證功能列表提取 (e.g. "- [x] 筆記 CRUD (createNote, listNotes, ...)")
  const verifiedPattern = /\(([^)]+)\)/g;
  while ((match = verifiedPattern.exec(block)) !== null) {
    const names = match[1].split(',').map(n => n.trim()).filter(n => /^[a-z]\w+$/.test(n));
    for (const name of names) {
      if (!functions.find(f => f.name === name)) {
        functions.push({ name, description: '', source: 'verified-list' });
      }
    }
  }

  // 策略 3: 從 Gherkin scenario 提取 (e.g. "When 呼叫 createNote 函數")
  const gherkinPattern = /(?:呼叫|call|invoke)\s+(\w+)/gi;
  while ((match = gherkinPattern.exec(block)) !== null) {
    const name = match[1];
    if (/^[a-z]/.test(name) && !functions.find(f => f.name === name) && !isCommonWord(name)) {
      functions.push({ name, description: '', source: 'gherkin' });
    }
  }

  // 為基礎建設 Story 添加標準函式
  if (isFoundation && functions.length === 0) {
    functions.push(
      { name: 'MemoryStore', description: '記憶體儲存', source: 'inferred', type: 'LIB' },
      { name: 'CoreTypes', description: '核心型別定義', source: 'inferred', type: 'CONST' },
    );
  }

  // 基礎建設 Story: 過濾掉 MemoryStore 的內部方法名稱
  // 這些是 class 方法，不是獨立函式
  if (isFoundation) {
    const storeInternals = new Set(['getAll', 'getById', 'create', 'update', 'remove', 'clear', 'set', 'get', 'has', 'delete']);
    const filtered = functions.filter(f => !storeInternals.has(f.name));
    const inferredSet = [
      { name: 'MemoryStore', description: '記憶體儲存', source: 'inferred', type: 'LIB' },
      { name: 'CoreTypes', description: '核心型別定義', source: 'inferred', type: 'CONST' },
      { name: 'helpers', description: '工具函數', source: 'inferred', type: 'LIB' },
    ];
    const inferredNames = new Set(inferredSet.map(f => f.name));

    // 如果過濾後為空，用標準基礎建設函式
    if (filtered.length === 0) {
      return inferredSet.map((fn, i, arr) => enrichFunction(fn, i, arr.length, storyId, moduleName, isFoundation));
    }
    // 如果過濾後只剩 inferred set 的子集（例如只有 helpers），
    // 說明 spec 提到了這些標準元件但也混入了 store 內部方法，
    // 應該用完整的 inferred set 而非殘缺的子集
    if (filtered.length < inferredSet.length && filtered.every(f => inferredNames.has(f.name))) {
      return inferredSet.map((fn, i, arr) => enrichFunction(fn, i, arr.length, storyId, moduleName, isFoundation));
    }
    // 用過濾後的結果
    return filtered.map((fn, i) => enrichFunction(fn, i, filtered.length, storyId, moduleName, isFoundation));
  }

  // 推導 priority 和其他屬性
  return functions.map((fn, i) => enrichFunction(fn, i, functions.length, storyId, moduleName, isFoundation));
}

/**
 * 豐富函式資訊（推導 priority, flow, deps, type）
 */
function enrichFunction(fn, index, totalCount, storyId, moduleName, isFoundation) {
  // 推導 type
  const type = fn.type || inferType(fn.name, isFoundation);

  // 推導 priority: spec-table 明確指定時保留，否則推導
  const priority = (fn.source === 'spec-table' && /^P[0-3]$/.test(fn.priority || ''))
    ? fn.priority
    : isFoundation
      ? (index === 0 ? 'P0' : 'P1')
      : (index < Math.max(1, Math.ceil(totalCount * 0.3)) ? 'P0' : 'P1');

  // 推導 flow: spec-table 明確填寫時保留，否則推導
  const flow = (fn.source === 'spec-table' && fn.flow && !fn.flow.startsWith('[') && fn.flow !== 'TODO')
    ? fn.flow
    : inferFlow(fn.name, fn.description, type);

  // 推導 deps
  const deps = inferDeps(fn.name, moduleName, isFoundation);

  // 推導 test strategy
  const testStrategy = inferTestStrategy(priority);

  // 推導 test file
  const testFile = inferTestFile(fn.name, type);

  // 推導 file path
  const filePath = inferFilePath(fn.name, type, moduleName);

  return {
    ...fn,
    type,
    priority,
    flow,
    deps,
    depsRisk: inferDepsRisk(deps),
    testStrategy,
    testFile,
    filePath,
    storyId,
  };
}

/**
 * 推導模組名稱
 * @param {string} storyTitle - Story 標題
 * @param {number} storyIndex - Story 在列表中的索引
 * @param {string} projectName - 從 spec 標題提取的專案名稱 (e.g. "note", "recipe")
 */
function inferModuleName(storyTitle, storyIndex, projectName) {
  if (storyIndex === 0 || /基礎|infrastructure|shared|config/i.test(storyTitle)) {
    return 'shared';
  }

  // 優先策略: 如果有專案名稱，用 projectName-core 作為主模組名
  // e.g. note-app → note-core, recipe-manager → recipe-core
  if (projectName) {
    // 檢查標題是否暗示這是核心/CRUD 模組
    if (/CRUD|核心|core|主要|main/i.test(storyTitle)) {
      return `${projectName}-core`;
    }
    // 檢查標題是否有明確的子模組名稱 (e.g. "搜尋模組" → "note-search")
    const subModuleMatch = storyTitle.match(/(\w+)\s*(?:模組|module)/i);
    if (subModuleMatch && subModuleMatch[1].length > 1) {
      const sub = subModuleMatch[1].toLowerCase();
      // 避免重複 (e.g. "note 模組" 在 note-app 裡不需要 note-note)
      if (sub !== projectName) {
        return `${projectName}-${sub}`;
      }
    }
  }

  // Fallback: 嘗試從標題提取模組名稱
  const crudMatch = storyTitle.match(/(\w+)\s*CRUD/i);
  if (crudMatch) {
    const word = crudMatch[1].toLowerCase();
    // 如果 CRUD 前面的詞是中文描述詞，用 projectName
    if (projectName && !/^[a-z]+$/i.test(crudMatch[1])) {
      return `${projectName}-core`;
    }
    return `${word}-core`;
  }

  // 嘗試匹配英文模組名
  const moduleMatch = storyTitle.match(/(\w+)\s*(?:模組|module|core)/i);
  if (moduleMatch && moduleMatch[1].length > 1) {
    return `${moduleMatch[1].toLowerCase()}-core`;
  }

  // 嘗試從標題中的英文單詞推導
  const englishWords = storyTitle.match(/[a-zA-Z]{3,}/g);
  if (englishWords && englishWords.length > 0) {
    const word = englishWords[0].toLowerCase();
    if (word !== 'crud') {
      return `${word}-core`;
    }
  }

  // 最終 fallback: 用 projectName 或 story index
  if (projectName) {
    return `${projectName}-core`;
  }
  return `feature-${storyIndex}`;
}

/**
 * 推導函式類型
 */
function inferType(name, isFoundation) {
  if (/Store|Repository|Cache/i.test(name)) return 'LIB';
  if (/Type|Interface|Schema|Config/i.test(name)) return 'CONST';
  if (/Route|Router|Endpoint/i.test(name)) return 'ROUTE';
  if (/Component|Page|View/i.test(name)) return 'UI';
  if (/Hook|use[A-Z]/i.test(name)) return 'HOOK';
  if (isFoundation) return 'LIB';
  return 'SVC';
}

/**
 * 推導 GEMS-FLOW
 */
function inferFlow(name, description, type) {
  const nameLower = name.toLowerCase();

  // CRUD 操作的標準 flow
  if (/^create|^add|^insert/i.test(name)) return 'VALIDATE→GENERATE_ID→SET_DEFAULTS→PERSIST→RETURN';
  if (/^list|^getAll|^findAll/i.test(name)) return 'FETCH_ALL→SORT→RETURN';
  if (/^get|^find|^fetch/i.test(name)) return 'FIND_BY_ID→RETURN';
  if (/^update|^edit|^modify/i.test(name)) return 'FIND_BY_ID→VALIDATE→MERGE→PERSIST→RETURN';
  if (/^delete|^remove/i.test(name)) return 'FIND_BY_ID→REMOVE→RETURN';
  if (/^search|^filter/i.test(name)) return 'PARSE_QUERY→SEARCH→FILTER→RETURN';

  // 型別/Store
  if (type === 'CONST') return 'DEFINE→EXPORT';
  if (type === 'LIB') return 'INIT→OPERATIONS→EXPORT';

  return 'INPUT→PROCESS→RETURN';
}

/**
 * 推導 GEMS-DEPS
 */
function inferDeps(name, moduleName, isFoundation) {
  if (isFoundation) return '無';
  return '[Shared.MemoryStore], [Shared.CoreTypes]';
}

/**
 * 推導 GEMS-DEPS-RISK
 */
function inferDepsRisk(depsStr) {
  if (!depsStr || depsStr === '無') return 'LOW';
  const deps = depsStr.split(',').map(d => d.trim());
  const moduleDeps = deps.filter(d => /\[(?:Module|External)\./i.test(d));
  if (moduleDeps.length >= 3) return 'HIGH';
  if (moduleDeps.length >= 1) return 'MEDIUM';
  return 'LOW';
}

/**
 * 推導測試策略
 */
function inferTestStrategy(priority) {
  switch (priority) {
    case 'P0': return '✓ Unit | ✓ Integration | ✓ E2E';
    case 'P1': return '✓ Unit | ✓ Integration | - E2E';
    case 'P2': return '✓ Unit | - Integration | - E2E';
    default: return '✓ Unit | - Integration | - E2E';
  }
}

/**
 * 推導測試檔案名
 */
function inferTestFile(name, type) {
  const kebab = name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
  return type === 'UI' ? `${kebab}.test.tsx` : `${kebab}.test.ts`;
}

/**
 * 推導檔案路徑
 */
function inferFilePath(name, type, moduleName) {
  const kebab = name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

  const isShared = moduleName === 'shared';
  const base = isShared ? 'src/shared' : `src/modules/${moduleName}`;

  switch (type) {
    case 'CONST': return `${base}/${isShared ? 'types/' : ''}${kebab}.ts`;
    case 'LIB': return `${base}/${isShared ? 'storage/' : 'lib/'}${kebab}.ts`;
    case 'SVC': return `${base}/services/${kebab}.ts`;
    case 'API': return `${base}/api/${kebab}.ts`;
    case 'HOOK': return `${base}/hooks/${kebab}.ts`;
    case 'UI': return `${base}/components/${kebab}.tsx`;
    case 'ROUTE': return `${base}/pages/${kebab}.tsx`;
    default: return `${base}/${kebab}.ts`;
  }
}

/**
 * 提取驗收條件
 */
function extractAcceptanceCriteria(block) {
  const criteria = [];
  const acPattern = /^-\s+(.+)/gm;
  let match;
  while ((match = acPattern.exec(block)) !== null) {
    criteria.push(match[1].trim());
  }
  return criteria;
}

/**
 * 提取資料契約
 */
function extractContracts(content) {
  const contracts = [];
  // 匹配欄位表格
  const tablePattern = /\|\s*欄位名稱\s*\|[^\n]+\n\|[-\s|]+\n((?:\|[^\n]+\n?)+)/gi;
  let match;
  while ((match = tablePattern.exec(content)) !== null) {
    const rows = match[1].trim().split('\n');
    const fields = [];
    for (const row of rows) {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 3) {
        fields.push({ name: cells[0], type: cells[1], description: cells[2] });
      }
    }
    if (fields.length > 0) {
      // 嘗試從上下文提取實體名稱
      const entityMatch = content.slice(Math.max(0, match.index - 200), match.index)
        .match(/\*\*核心資料實體\*\*:\s*(\w+)/i);
      contracts.push({
        entityName: entityMatch ? entityMatch[1] : 'Entity',
        fields,
      });
    }
  }
  return contracts;
}

/**
 * 提取延期功能
 */
function extractDeferred(content) {
  const deferred = [];
  const deferredSection = content.match(/###\s*延期功能[^]*?(?=\n---|\n##\s|$)/i);
  if (deferredSection) {
    const itemPattern = /^-\s+(.+)/gm;
    let match;
    while ((match = itemPattern.exec(deferredSection[0])) !== null) {
      deferred.push(match[1].trim());
    }
  }
  return deferred;
}

/**
 * 常見非函式名稱
 */
function isCommonWord(name) {
  const common = new Set([
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'has',
    'not', 'are', 'was', 'were', 'been', 'being', 'will', 'would', 'should',
    'can', 'could', 'may', 'might', 'must', 'shall', 'need', 'true', 'false',
    'null', 'undefined', 'return', 'function', 'class', 'interface', 'type',
    'import', 'export', 'default', 'const', 'let', 'var', 'new', 'delete',
    'typeof', 'instanceof', 'void', 'never', 'any', 'string', 'number',
    'boolean', 'object', 'array', 'map', 'set', 'promise',
  ]);
  return common.has(name.toLowerCase());
}

module.exports = { parseSpec };
