#!/usr/bin/env node
/**
 * Draft Parser Standalone - 活藍圖解析器 (獨立版)
 * 
 * 從 task-pipe/tools/draft-parser.cjs 提取，零依賴。
 * 支援 Enhanced Draft v1 + v2 + v3 (活藍圖) 格式。
 * 
 * v2 新增解析：deps 欄位、狀態欄位、交付欄位、公開 API、[DONE]/[STUB]/[CURRENT] 標記
 * v3 新增解析：一句話目標 inline 格式、模組 API 摘要、藍圖狀態欄位、精簡 7 區塊結構
 */

const fs = require('fs');
const path = require('path');

/**
 * v2.3: 解析操作欄位
 * 優先讀 操作 欄位 (NEW/MOD)，向後相容 [Modify] 標記
 */
function resolveOperation(operationField, techName) {
  if (operationField) {
    const op = operationField.toUpperCase().trim();
    if (op === 'MOD' || op === 'MODIFY') return 'MOD';
    if (op === 'NEW') return 'NEW';
  }
  // 向後相容：techName 含 [Modify] → MOD
  if (/\[Modify\]/i.test(techName)) return 'MOD';
  return 'NEW';
}

function load(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Draft file not found: ${filePath}`);
  }
  return parse(fs.readFileSync(filePath, 'utf8'));
}

function parse(content) {
  // normalize CRLF → LF (Windows 環境寫出的 markdown 會有 \r\n)
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const draft = {
    title: '', iteration: '', date: '', status: '', level: '',
    methodology: '', goal: '', requirement: '',
    groups: [], entities: {}, sharedModules: [], modules: {},
    routes: '', iterationPlan: [], moduleActions: {},
    features: [], exclusions: [], clarifications: {},
    variationPoints: null,
  };

  // 標題 (v3: 無 📋 emoji; v2: 有 📋)
  const titleMatch = content.match(/^# (?:📋\s*)?(.+?)(?:\s*-\s*(?:需求草稿|活藍圖)|\s*$)/m);
  if (titleMatch) draft.title = titleMatch[1].trim();

  // 元資料
  const iterMatch = content.match(/\*\*迭代\*\*:\s*(.+)/);
  if (iterMatch) draft.iteration = iterMatch[1].trim();

  const levelMatch = content.match(/\*\*(POC )?Level\*\*:\s*([SML])/i);
  if (levelMatch) draft.level = levelMatch[2].toUpperCase();
  const scaleMatch = content.match(/\*\*規模\*\*:\s*([SML])/i);
  if (scaleMatch && !draft.level) draft.level = scaleMatch[1].toUpperCase();

  // 一句話目標 (v3: inline **一句話目標**: 在 section 1 內; v2: 獨立 ## 一句話目標)
  const goalMatch = content.match(/##+ 一句話目標\s*\n+([^\n#]+)/);
  if (goalMatch) {
    draft.goal = goalMatch[1].trim();
  } else {
    // v3 inline format: **一句話目標**: ...
    const inlineGoalMatch = content.match(/\*\*一句話目標\*\*\s*[:：]\s*(.+)/);
    if (inlineGoalMatch) draft.goal = inlineGoalMatch[1].trim();
  }

  // 用戶原始需求
  const reqMatch = content.match(/## 用戶原始需求\s*\n+([\s\S]*?)(?=\n---|\n##)/);
  if (reqMatch) draft.requirement = reqMatch[1].replace(/^>\s*/gm, '').trim();

  // 族群 (v3: ### 2.1 族群識別 表格; v2: ### 1. 族群識別 表格; v4: inline 列表)
  draft.groups = parseTable(content, /#{2,4}\s*(?:2\.1|1\.)\s*族群識別/);
  // v4 fallback: inline 列表格式 "- 角色A: 職責描述（特殊需求）"
  if (draft.groups.length === 0) {
    const groupSection = extractSection(content, /#{2,4}\s*(?:2\.1|1\.)\s*族群識別/);
    if (groupSection) {
      const listItems = groupSection.split('\n').filter(l => /^\s*-\s+\S/.test(l) && !l.includes('['));
      for (const line of listItems) {
        const m = line.match(/^\s*-\s+([^:：]+)[：:]\s*(.+)/);
        if (m) {
          const name = m[1].trim();
          const rest = m[2].trim();
          const specialMatch = rest.match(/（([^）]+)）/);
          draft.groups.push({
            '族群名稱': name,
            '描述': specialMatch ? rest.replace(/（[^）]+）/, '').trim() : rest,
            '特殊需求': specialMatch ? specialMatch[1] : '',
          });
        }
      }
    }
  }

  // 實體 (v3: ### 2.2 實體定義; v2: ### 2. 實體定義)
  draft.entities = parseEntities(content);

  // 共用模組
  draft.sharedModules = parseChecklist(content, /#{2,4}\s*[23]\.\s*共用模組/);

  // 獨立模組 (v2: 含公開 API; v3: 模組 API 摘要)
  draft.modules = parseModules(content);

  // 路由 (v3: ### 2.3 路由結構; v2: ### 4. 或 ### 5. 路由結構)
  const routeMatch = content.match(/#{2,4}\s*(?:2\.3|[45]\.)\s*路由結構[\s\S]*?```([\s\S]*?)```/);
  if (routeMatch) draft.routes = routeMatch[1].trim();

  // 迭代規劃表 (v3: ## 3. 迭代規劃表; v2: ## 📅 迭代規劃表)
  draft.iterationPlan = parseIterationPlan(content);

  // 模組動作清單 (v3: ## 5. 模組動作清單; v2: ## 📋 模組動作清單)
  draft.moduleActions = parseModuleActions(content);

  // 功能模組清單
  draft.features = parseChecklist(content, /## 功能模組清單/);

  // 不做什麼 (v3: **不做什麼**: 在 section 1 內; v2: ### 不做什麼)
  const exMatch = content.match(/### 不做什麼\s*\n([\s\S]*?)(?=\n---|\n##)/);
  if (exMatch) {
    draft.exclusions = exMatch[1].split('\n')
      .filter(l => l.trim().startsWith('-'))
      .map(l => l.replace(/^-\s*/, '').trim());
  } else {
    // v3 inline format: **不做什麼**: followed by list items
    const inlineExMatch = content.match(/\*\*不做什麼\*\*\s*[:：]\s*\n([\s\S]*?)(?=\n---|\n##|\n\*\*)/);
    if (inlineExMatch) {
      draft.exclusions = inlineExMatch[1].split('\n')
        .filter(l => l.trim().startsWith('-'))
        .map(l => l.replace(/^-\s*/, '').trim());
    }
  }

  // 釐清項目
  draft.clarifications = parseClarifications(content);

  // v2.1: 變異點分析
  draft.variationPoints = parseVariationPoints(content);

  return draft;
}

// === 表格解析 ===
function parseTable(content, headerPattern) {
  const section = extractSection(content, headerPattern);
  if (!section) return [];
  const lines = section.split('\n').filter(l => l.includes('|'));
  if (lines.length < 3) return [];
  const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length === 0 || cells.every(c => c.includes('{') && c.includes('}'))) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

// === 實體解析 ===
function parseEntities(content) {
  const entities = {};
  const section = extractSection(content, /#{2,4}\s*(?:2\.2|2\.)\s*實體定義/);
  if (!section) return entities;

  // 格式 A: #### EntityName 分塊格式（標準格式）
  const blocks = section.split(/####\s+/).slice(1);
  if (blocks.length > 0) {
    for (const block of blocks) {
      const nameMatch = block.match(/^([^\n]+)/);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim();
      const lines = block.split('\n').filter(l => l.includes('|'));
      if (lines.length < 3) continue;
      const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
      const fields = [];
      for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length < 2) continue;
        const field = {};
        headers.forEach((h, idx) => { field[h.toLowerCase()] = cells[idx] || ''; });
        fields.push(field);
      }
      entities[name] = fields;
    }
    if (Object.keys(entities).length > 0) return entities;
  }

  // 格式 B: 扁平表格格式（第一欄是實體名稱，每行一個欄位）
  // | 實體名稱 | 欄位 | 型別 | 約束 | 說明 |
  const tableLines = section.split('\n').filter(l => l.includes('|'));
  if (tableLines.length >= 3) {
    const headers = tableLines[0].split('|').map(h => h.trim()).filter(Boolean);
    // 第一欄是實體名稱欄位（如「實體名稱」「Entity」等）
    const firstHeader = (headers[0] || '').toLowerCase();
    const isEntityTable = /實體|entity/i.test(firstHeader);
    if (isEntityTable) {
      for (let i = 2; i < tableLines.length; i++) {
        const cells = tableLines[i].split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length < 2) continue;
        const entityName = cells[0];
        if (!entityName || /^[-:]+$/.test(entityName)) continue;
        if (!entities[entityName]) entities[entityName] = [];
        const field = {};
        headers.slice(1).forEach((h, idx) => { field[h.toLowerCase()] = cells[idx + 1] || ''; });
        entities[entityName].push(field);
      }
    }
  }

  return entities;
}

// === 模組解析 (v2: 含公開 API; v3: 模組 API 摘要) ===
function parseModules(content) {
  const modules = {};
  
  // v2: ### 3. 獨立模組 or ### 4. 獨立模組
  const section = extractSection(content, /#{2,4}\s*[34]\.\s*獨立模組/);
  if (section) {
    parseModulesFromSection(section, modules);
  }
  
  // v3: ### 模組 API 摘要 (under 迭代規劃表)
  const apiSummarySection = extractSection(content, /#{2,4}\s*模組 API 摘要/);
  if (apiSummarySection) {
    parseModulesFromAPISummary(apiSummarySection, modules);
  }
  
  return modules;
}

/**
 * v2 格式: #### 模組：module-name
 */
function parseModulesFromSection(section, modules) {
  const blocks = section.split(/####\s+模組[：:]\s*/).slice(1);
  for (const block of blocks) {
    const nameMatch = block.match(/^([^\n(]+)/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    if (name.includes('{') && name.includes('}')) continue;

    const depsMatch = block.match(/依賴:\s*\[([^\]]*)\]/);
    const deps = depsMatch ? depsMatch[1].split(',').map(d => d.trim()).filter(Boolean) : [];

    const layerMatch = block.match(/layer:\s*(feature|adapter|shared)/i);
    const layer = layerMatch ? layerMatch[1].toLowerCase() : 'feature';

    // v2: 公開 API
    const apiLines = [];
    const apiSection = block.match(/公開 API[^:]*:\s*\n([\s\S]*?)(?=\n- (?:獨立功能|\[[ x]\])|\n####|\n$)/);
    if (apiSection) {
      apiSection[1].split('\n').forEach(l => {
        const m = l.match(/^\s*-\s*(.+)/);
        if (m) apiLines.push(m[1].trim());
      });
    }

    const features = [];
    const featureLines = block.split('\n').filter(l => /^\s*-\s*\[[ x]\]/.test(l));
    for (const line of featureLines) {
      const checked = /\[x\]/i.test(line);
      const text = line.replace(/^\s*-\s*\[[ x]\]\s*/i, '').trim();
      if (text && !text.includes('{')) features.push({ text, checked });
    }

    modules[name] = { name, deps, features, publicAPI: apiLines, layer };
  }
}

/**
 * v3 格式: #### module-name (under ### 模組 API 摘要)
 * - 依賴: [shared/types]
 * - 公開 API:
 *   - functionA(args): ReturnType
 */
function parseModulesFromAPISummary(section, modules) {
  const blocks = section.split(/####\s+/).slice(1);
  for (const block of blocks) {
    const nameMatch = block.match(/^([^\n(]+)/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    if (name.includes('{') && name.includes('}')) continue;
    if (modules[name]) continue; // v2 已解析過，不覆蓋

    const depsMatch = block.match(/依賴\s*[:：]\s*\[?([^\]\n]*)\]?/);
    const deps = depsMatch
      ? depsMatch[1].split(',').map(d => d.trim().replace(/^\[|\]$/g, '')).filter(d => d && d !== '無')
      : [];

    const apiLines = [];
    const lines = block.split('\n');
    let inAPI = false;
    for (const l of lines) {
      if (/公開 API\s*[:：]/.test(l)) { inAPI = true; continue; }
      if (inAPI) {
        const m = l.match(/^\s+-\s+(.+)/);
        if (m) {
          apiLines.push(m[1].trim());
        } else if (l.trim() && !l.trim().startsWith('-')) {
          inAPI = false;
        }
      }
    }

    modules[name] = { name, deps, features: [], publicAPI: apiLines, layer: 'feature' };
  }
}

// === 迭代規劃表 (v2: 含交付 + 狀態) ===
function parseIterationPlan(content) {
  // v3: ## 3. 迭代規劃表; v2: ## 📅 迭代規劃表
  const section = extractSection(content, /##\s*(?:📅\s*)?(?:\d+\.\s*)?迭代規劃表/);
  if (!section) return [];
  // 移除 HTML 註解後再解析表格
  const cleanSection = section.replace(/<!--[\s\S]*?-->/g, '');
  const lines = cleanSection.split('\n').filter(l => l.includes('|') && l.trim().startsWith('|'));
  if (lines.length < 3) return [];
  const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
  const plan = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 3) continue;
    const entry = {};
    headers.forEach((h, idx) => { entry[h.toLowerCase()] = cells[idx] || ''; });
    const iterRaw = entry['iter'] || entry['迭代'] || '0';
    // 支援 "iter-1" 和 "1" 兩種格式
    const iterNum = iterRaw.match(/\d+/);
    const iter = iterNum ? parseInt(iterNum[0]) : 0;
    if (isNaN(iter) || iter === 0) continue;
    plan.push({
      iter,
      scope: entry['範圍'] || entry['scope'] || '',
      goal: entry['目標'] || entry['goal'] || '',
      module: entry['模組'] || entry['module'] || '',
      delivery: entry['交付'] || entry['delivery'] || 'FULL',
      deps: (entry['依賴'] || entry['deps'] || '無').split(',').map(d => d.trim()).filter(d => d && d !== '無'),
      status: entry['狀態'] || entry['status'] || '',
    });
  }
  return plan;
}

// === 模組動作清單 (v2: 含 deps + 狀態) ===

/**
 * 從 block 內容提取第一個表格的行（截斷多表格）
 * 遇到第二個 separator 行就停止，避免第二個表格的 header 被誤讀為資料行
 */
function extractFirstTableLines(blockContent) {
  const allLines = blockContent.split('\n').filter(l => l.includes('|') && l.trim().startsWith('|'));
  if (allLines.length < 3) return allLines;
  const isSep = (l) => l.split('|').map(c => c.trim()).filter(Boolean).every(c => /^:?-+:?$/.test(c));
  const firstSepIdx = allLines.findIndex(l => isSep(l));
  if (firstSepIdx < 0) return allLines;
  const nextSepIdx = allLines.findIndex((l, i) => i > firstSepIdx && isSep(l));
  if (nextSepIdx > firstSepIdx) {
    // nextSepIdx - 1 是第二個表格的 header 行，也要排除
    return allLines.slice(0, nextSepIdx - 1);
  }
  return allLines;
}

/**
 * 從 block 內容提取所有子表格的資料行（合併多表格）
 * 用第一個表格的 header，跳過後續表格的 header + separator，只保留資料行
 * 用於 Story-0 / Story-1 分表格的 block 格式
 */
function extractAllTableLines(blockContent) {
  const allLines = blockContent.split('\n').filter(l => l.includes('|') && l.trim().startsWith('|'));
  if (allLines.length < 3) return allLines;
  const isSep = (l) => l.split('|').map(c => c.trim()).filter(Boolean).every(c => /^:?-+:?$/.test(c));

  // 找所有 separator 的位置
  const sepIndices = allLines.map((l, i) => isSep(l) ? i : -1).filter(i => i >= 0);
  if (sepIndices.length === 0) return allLines;

  // 第一個表格：header(0) + sep(sepIndices[0]) + data rows
  const result = [allLines[0], allLines[sepIndices[0]]]; // header + first sep

  for (let s = 0; s < sepIndices.length; s++) {
    const dataStart = sepIndices[s] + 1;
    const dataEnd = s + 1 < sepIndices.length ? sepIndices[s + 1] - 1 : allLines.length; // 下一個 sep 前一行是 header，排除
    for (let i = dataStart; i < dataEnd; i++) {
      if (!isSep(allLines[i])) result.push(allLines[i]);
    }
  }

  return result;
}

function parseModuleActions(content) {
  const actions = {};
  // v3: ## 5. 模組動作清單; v2: ## 📋 模組動作清單; 任意數字前綴
  const section = extractSection(content, /##\s*(?:📋\s*)?(?:\d+\.\s*)?模組動作清單/);
  if (!section) return actions;
  const iterBlocks = section.split(/###\s+/).slice(1);

  for (const block of iterBlocks) {
    const headerMatch = block.match(/^Iter\s+(\d+):\s*([^\n[\(]+)/i);
    if (!headerMatch) continue;
    const iter = parseInt(headerMatch[1]);
    let moduleName = headerMatch[2].trim();

    // v2: 解析狀態標記 [CURRENT] [STUB] [DONE]
    const statusMatch = block.match(/\[(CURRENT|STUB|DONE)\]/i);
    const blockStatus = statusMatch ? statusMatch[1].toUpperCase() : '';

    // Stub 偵測
    const isStub = block.includes('(Stub)') || blockStatus === 'STUB' || 
      (blockStatus !== 'CURRENT' && blockStatus !== 'DONE' && !block.split('\n').some(l => l.trim().startsWith('|')) && /^>\s/.test(block.split('\n').find(l => l.startsWith('>')) || ''));
    if (isStub) {
      const stubDesc = block.match(/>\s*(.+)/);
      // v2: 解析 Stub 的預估和公開 API
      const estimateMatch = block.match(/預估:\s*(.+)/);
      const apiMatch = block.match(/公開 API:\s*(.+)/);

      // v2.4: 解析 Stub 裡的函式 Flow 清單表格（STUB-003 需要）
      const cleanStubBlock = block.replace(/<!--[\s\S]*?-->/g, '');
      const stubLines = extractFirstTableLines(cleanStubBlock);
      const stubItems = [];
      if (stubLines.length >= 3) {
        const stubHeaders = stubLines[0].split('|').map(h => h.trim()).filter(Boolean);
        for (let i = 2; i < stubLines.length; i++) {
          const cells = stubLines[i].split('|').map(c => c.trim()).filter(Boolean);
          if (cells.length < 3) continue;
          const item = {};
          stubHeaders.forEach((h, idx) => { item[h.toLowerCase()] = cells[idx] || ''; });
          stubItems.push({
            semantic: item['業務語意'] || item['semantic'] || '',
            type: item['類型'] || item['type'] || '',
            techName: item['技術名稱'] || item['techname'] || '',
            priority: item['優先級'] || item['p'] || item['priority'] || 'P2',
            flow: item['流向'] || item['flow'] || '',
            deps: item['依賴'] || item['deps'] || '無',
            status: item['狀態'] || item['status'] || '○○',
            evolution: item['演化'] || item['evolution'] || 'BASE',
            ac: item['ac'] || item['AC'] || '',
            operation: resolveOperation(item['操作'] || item['operation'] || '', item['技術名稱'] || item['techname'] || ''),
          });
        }
      }

      // Bug fix: don't overwrite CURRENT/FULL/PARTIAL with STUB
      if (!actions[moduleName] || !['CURRENT', 'FULL', 'PARTIAL'].includes(actions[moduleName].status)) {
        actions[moduleName] = {
          iter, module: moduleName, fillLevel: 'stub', status: blockStatus || 'STUB',
          stubDescription: stubDesc ? stubDesc[1].trim() : '',
          estimate: estimateMatch ? estimateMatch[1].trim() : '',
          stubAPI: apiMatch ? apiMatch[1].split(',').map(s => s.trim()) : [],
          items: stubItems,
        };
      }
      continue;
    }

    // Done 偵測
    const isDone = blockStatus === 'DONE';
    if (isDone) {
      const summaryMatch = block.match(/>\s*(.+)/);
      // Bug fix: don't overwrite CURRENT/FULL/PARTIAL with DONE
      if (!actions[moduleName] || !['CURRENT', 'FULL', 'PARTIAL'].includes(actions[moduleName].status)) {
        actions[moduleName] = {
          iter, module: moduleName, fillLevel: 'done', status: 'DONE',
          summary: summaryMatch ? summaryMatch[1].trim() : '',
          items: [],
        };
      }
      continue;
    }

    // Full/Partial 解析
    const isPartial = block.includes('(Partial)');
    // 移除 HTML 註解後再解析表格，合併所有子表格（支援 Story-0/Story-1 分表格格式）
    const cleanBlock = block.replace(/<!--[\s\S]*?-->/g, '');
    const lines = extractAllTableLines(cleanBlock);
    if (lines.length < 3) {
      // Bug fix: don't overwrite CURRENT/FULL/PARTIAL with empty stub
      if (!actions[moduleName] || !['CURRENT', 'FULL', 'PARTIAL'].includes(actions[moduleName].status)) {
        actions[moduleName] = { iter, module: moduleName, fillLevel: 'stub', status: blockStatus, items: [] };
      }
      continue;
    }

    const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
    const items = [];
    for (let i = 2; i < lines.length; i++) {
      const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length < 3) continue;
      const item = {};
      headers.forEach((h, idx) => { item[h.toLowerCase()] = cells[idx] || ''; });
      items.push({
        semantic: item['業務語意'] || item['semantic'] || '',
        type: item['類型'] || item['type'] || '',
        techName: item['技術名稱'] || item['techname'] || '',
        priority: item['優先級'] || item['p'] || item['priority'] || 'P2',
        flow: item['流向'] || item['flow'] || '',
        deps: item['依賴'] || item['deps'] || '無',
        status: item['狀態'] || item['status'] || '○○',
        evolution: item['演化'] || item['evolution'] || 'BASE',
        ac: item['ac'] || item['AC'] || '',
        // v2.3: 操作欄位 NEW=新建 MOD=修改既有（向後相容：[Modify] 標記自動轉 MOD）
        operation: resolveOperation(item['操作'] || item['operation'] || '', item['技術名稱'] || item['techname'] || ''),
      });
    }

    actions[moduleName] = {
      iter, module: moduleName,
      fillLevel: isPartial ? 'partial' : 'full',
      status: blockStatus || 'CURRENT',
      items,
    };
  }
  return actions;
}

// === 釐清項目 ===
function parseClarifications(content) {
  const section = extractSection(content, /## 釐清項目/);
  if (!section) return {};
  const result = {};
  const subs = section.split(/###\s+/).slice(1);
  for (const sub of subs) {
    const nameMatch = sub.match(/^([^\n]+)/);
    if (!nameMatch) continue;
    const items = [];
    sub.split('\n').filter(l => /^\s*-\s*\[[ x]\]/.test(l)).forEach(line => {
      const checked = /\[x\]/i.test(line);
      const text = line.replace(/^\s*-\s*\[[ x]\]\s*/i, '').trim();
      items.push({ text, checked });
    });
    result[nameMatch[1].trim()] = items;
  }
  return result;
}

// === Checklist ===
function parseChecklist(content, headerPattern) {
  const section = extractSection(content, headerPattern);
  if (!section) return [];
  const items = [];
  section.split('\n').filter(l => /^\s*-\s*\[[ x]\]/.test(l)).forEach(line => {
    const checked = /\[x\]/i.test(line);
    const text = line.replace(/^\s*-\s*\[[ x]\]\s*/i, '').trim();
    if (text && !text.includes('{')) items.push({ text, checked });
  });
  return items;
}

// === 變異點分析 (v2.1) ===
function parseVariationPoints(content) {
  // v3: ## 4. 變異點分析; v2: ## 🔄 變異點分析
  const section = extractSection(content, /##\s*(?:🔄\s*)?(?:\d+\.\s*)?變異點分析/);
  if (!section) return null;

  const result = { nouns: [], layers: [], confirmed: [] };

  // 名詞分析表
  const nounSection = section.match(/### 名詞分析[\s\S]*?(?=### |$)/);
  if (nounSection) {
    const cleanSection = nounSection[0].replace(/<!--[\s\S]*?-->/g, '');
    const lines = cleanSection.split('\n').filter(l => l.includes('|') && l.trim().startsWith('|'));
    if (lines.length >= 3) {
      for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
          result.nouns.push({
            name: cells[0],
            fixed: /\[固定\]/.test(cells[1]),
            variable: /\[可變\]/.test(cells[1]),
            description: cells[2] || '',
          });
        }
      }
    }
  }

  // 分層定義表
  const layerSection = section.match(/### 分層定義[\s\S]*?(?=### |$)/);
  if (layerSection) {
    const cleanSection = layerSection[0].replace(/<!--[\s\S]*?-->/g, '');
    const lines = cleanSection.split('\n').filter(l => l.includes('|') && l.trim().startsWith('|'));
    if (lines.length >= 3) {
      for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 3) {
          result.layers.push({
            layer: cells[0],
            name: cells[1],
            dimension: cells[2] || '',
            apiChange: cells[3] || '',
            iter: cells[4] ? parseInt(cells[4]) : null,
          });
        }
      }
    }
  }

  // 確認狀態
  const confirmLines = section.split('\n').filter(l => /^\s*-\s*\[[ x]\]/.test(l));
  for (const line of confirmLines) {
    const checked = /\[x\]/i.test(line);
    const text = line.replace(/^\s*-\s*\[[ x]\]\s*/i, '').trim();
    result.confirmed.push({ text, checked });
  }

  return result;
}

// === 區塊提取 ===
function extractSection(content, headerPattern) {
  // normalize CRLF → LF (Windows 環境寫出的 markdown 會有 \r\n)
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let startIdx = -1, headerLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    if (headerPattern.test(lines[i])) {
      startIdx = i;
      const hMatch = lines[i].match(/^(#{1,6})/);
      headerLevel = hMatch ? hMatch[1].length : 2;
      break;
    }
  }
  if (startIdx === -1) return null;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const hMatch = lines[i].match(/^(#{1,6})\s/);
    if (hMatch && hMatch[1].length <= headerLevel) { endIdx = i; break; }
    if (lines[i].trim() === '---' && i > startIdx + 2) { endIdx = i; break; }
  }
  return lines.slice(startIdx, endIdx).join('\n');
}

// === 高階 API ===

/**
 * 從複合模組的 actions 中篩選屬於特定模組的 actions。
 * 使用模組的 publicAPI 和 features 來判斷歸屬。
 * 如果模組是 'shared'，匹配 CONST/LIB 類型且 deps 為 '無' 或 Internal。
 */
function filterActionsForModule(compositeActionData, moduleName, moduleDefs) {
  if (!compositeActionData || !compositeActionData.items || compositeActionData.items.length === 0) {
    return compositeActionData;
  }

  const moduleDef = moduleDefs[moduleName] || {};
  const publicAPI = (moduleDef.publicAPI || []).map(api => {
    // 從 "addExpense(input: ExpenseInput): Expense" 提取函式名 "addExpense"
    const m = api.match(/^(\w+)\s*\(/);
    return m ? m[1] : api.trim();
  });

  const filtered = compositeActionData.items.filter(item => {
    const techName = (item.techName || '').replace(/\s*\[Modify\]/i, '').trim();

    // 1. 如果模組有 publicAPI，用 API 名稱匹配
    if (publicAPI.length > 0 && publicAPI.includes(techName)) return true;

    // 2. shared 模組：匹配 CONST/LIB 類型且 deps 為 '無' 或 Internal
    if (moduleName === 'shared') {
      const type = item.type || '';
      if (type === 'CONST' || type === 'LIB') {
        const deps = item.deps || '無';
        if (deps === '無' || /\[Internal\./.test(deps)) return true;
      }
    }

    // 3. 如果模組有 features，用 feature 文字匹配
    if (moduleDef.features) {
      for (const feat of moduleDef.features) {
        if (feat.text && feat.text.includes(techName)) return true;
      }
    }

    // 4. deps 中包含 [Module.<moduleName>] 的 → 不屬於此模組（是依賴此模組的）
    // deps 中包含 [Shared.*] 且模組不是 shared → 可能屬於此模組
    return false;
  });

  if (filtered.length === 0) return compositeActionData; // fallback: 全部返回

  return {
    ...compositeActionData,
    items: filtered,
  };
}

function getModulesByIter(draft, iter) {
  const result = [];
  for (const entry of draft.iterationPlan) {
    if (entry.iter === iter) {
      const moduleDetail = draft.modules[entry.module] || {};
      // 直接查找 moduleActions，如果找不到，嘗試找包含此模組名的複合 key
      let actionData = draft.moduleActions[entry.module];
      if (!actionData) {
        for (const [key, val] of Object.entries(draft.moduleActions)) {
          if (key.split(',').map(s => s.trim()).includes(entry.module)) {
            // 複合 key 命中：篩選屬於此模組的 actions
            actionData = filterActionsForModule(val, entry.module, draft.modules);
            break;
          }
        }
      }
      actionData = actionData || {};
      result.push({
        id: entry.module, name: entry.module,
        desc: entry.goal || '', deps: entry.deps || moduleDetail.deps || [],
        delivery: entry.delivery || 'FULL',
        status: entry.status || actionData.status || '',
        features: moduleDetail.features || [],
        publicAPI: moduleDetail.publicAPI || [],
        layer: moduleDetail.layer || 'feature',
        actions: actionData.items || [],
        fillLevel: actionData.fillLevel || 'stub',
      });
    }
  }
  if (result.length === 0 && iter === 1) {
    for (const [name, mod] of Object.entries(draft.modules)) {
      result.push({
        id: name, name, desc: '', deps: mod.deps || [],
        delivery: 'FULL', status: '',
        features: mod.features || [], publicAPI: mod.publicAPI || [],
        layer: mod.layer || 'feature',
        actions: (draft.moduleActions[name] || {}).items || [],
        fillLevel: (draft.moduleActions[name] || {}).fillLevel || 'stub',
      });
    }
  }
  return result;
}

function getAllIterations(draft) {
  const iters = new Set();
  for (const entry of draft.iterationPlan) iters.add(entry.iter);
  if (iters.size === 0) iters.add(1);
  return Array.from(iters).sort((a, b) => a - b);
}

function getCurrentIter(draft) {
  const current = draft.iterationPlan.find(e => e.status === '[CURRENT]');
  if (current) return current.iter;
  // fallback: 找第一個非 DONE 的
  for (const entry of draft.iterationPlan) {
    if (entry.status !== '[DONE]') return entry.iter;
  }
  return 1;
}

function getIterationSummary(draft) {
  const summary = {};
  for (const entry of draft.iterationPlan) {
    if (!summary[entry.iter]) {
      summary[entry.iter] = {
        modules: [], scope: entry.scope || '', goal: entry.goal || '',
        delivery: entry.delivery || 'FULL', status: entry.status || '',
        totalActions: 0, canParallel: false,
      };
    }
    summary[entry.iter].modules.push(entry.module);
    const actions = draft.moduleActions[entry.module];
    if (actions) summary[entry.iter].totalActions += (actions.items || []).length;
  }
  for (const iter of Object.keys(summary)) {
    summary[iter].canParallel = summary[iter].modules.length > 1;
  }
  return summary;
}

function checkDependencies(draft, moduleId, completedModules = []) {
  const entry = draft.iterationPlan.find(e => e.module === moduleId);
  const deps = entry ? entry.deps : (draft.modules[moduleId] || {}).deps || [];
  const missing = deps.filter(d => !completedModules.includes(d));
  return { satisfied: missing.length === 0, missing };
}

function calculateStats(draft) {
  const moduleSet = new Set();
  draft.iterationPlan.forEach(e => moduleSet.add(e.module));
  const totalModules = Object.keys(draft.modules).length || moduleSet.size;
  let totalActions = 0;
  const priorityCounts = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const mod of Object.values(draft.moduleActions)) {
    for (const item of (mod.items || [])) {
      totalActions++;
      const p = item.priority || 'P2';
      priorityCounts[p] = (priorityCounts[p] || 0) + 1;
    }
  }
  return {
    totalModules, totalActions,
    totalIterations: getAllIterations(draft).length,
    totalEntities: Object.keys(draft.entities).length,
    priorities: priorityCounts, level: draft.level,
    hasEntities: Object.keys(draft.entities).length > 0,
    hasIterationPlan: draft.iterationPlan.length > 0,
    hasModuleActions: Object.keys(draft.moduleActions).length > 0,
  };
}

function isEnhancedDraft(draft) {
  return draft.iterationPlan.length > 0 ||
    Object.keys(draft.entities).length > 0 ||
    Object.keys(draft.moduleActions).length > 0;
}

function isV2Draft(draft) {
  // v2 特徵：動作清單有 deps 或 status 欄位，或迭代規劃表有 delivery/status
  for (const mod of Object.values(draft.moduleActions)) {
    for (const item of (mod.items || [])) {
      if (item.deps && item.deps !== '無') return true;
      if (item.status && item.status !== '○○') return true;
    }
    if (mod.status && ['CURRENT', 'STUB', 'DONE'].includes(mod.status)) return true;
  }
  for (const entry of draft.iterationPlan) {
    if (entry.delivery && entry.delivery !== 'FULL') return true;
    if (entry.status) return true;
  }
  return false;
}

/**
 * v3 偵測：v3 特徵 — 一句話目標 inline、模組 API 摘要、無 📋 emoji 標題
 */
function isV3Draft(rawContent) {
  if (!rawContent) return false;
  // v3 特徵：有 **一句話目標**: inline 格式
  if (/\*\*一句話目標\*\*\s*[:：]/.test(rawContent)) return true;
  // v3 特徵：有 ### 模組 API 摘要
  if (/###\s*模組 API 摘要/.test(rawContent)) return true;
  // v3 特徵：有 ## \d+\. 模組動作清單 (numbered sections without emoji)
  if (/##\s*\d+\.\s*模組動作清單/.test(rawContent)) return true;
  return false;
}

/**
 * v4 偵測：v4 特徵 — AC 骨架內嵌在動作清單、族群識別為 inline 列表、無獨立驗收條件區塊
 */
function isV4Draft(rawContent) {
  if (!rawContent) return false;
  // v4 特徵：有 **AC 骨架** 行（在動作清單區塊內）
  if (/\*\*AC 骨架\*\*/.test(rawContent)) return true;
  // v4 特徵：有 ## 6. 藍圖備註（取代 ## 6. 驗收條件）
  if (/##\s*6\.\s*藍圖備註/.test(rawContent)) return true;
  return false;
}

module.exports = {
  load, parse,
  getModulesByIter, getAllIterations, getCurrentIter,
  getIterationSummary, checkDependencies,
  calculateStats, isEnhancedDraft, isV2Draft, isV3Draft, isV4Draft,
  filterActionsForModule,
  parseTable, parseEntities, parseModules,
  parseIterationPlan, parseModuleActions,
  parseClarifications, parseChecklist, extractSection,
};
