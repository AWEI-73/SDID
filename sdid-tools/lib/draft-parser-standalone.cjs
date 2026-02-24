#!/usr/bin/env node
/**
 * Draft Parser Standalone - 活藍圖解析器 (獨立版)
 * 
 * 從 task-pipe/tools/draft-parser.cjs 提取，零依賴。
 * 支援 Enhanced Draft v1 + v2 (活藍圖) 格式。
 * 
 * v2 新增解析：deps 欄位、狀態欄位、交付欄位、公開 API、[DONE]/[STUB]/[CURRENT] 標記
 */

const fs = require('fs');
const path = require('path');

function load(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Draft file not found: ${filePath}`);
  }
  return parse(fs.readFileSync(filePath, 'utf8'));
}

function parse(content) {
  const draft = {
    title: '', iteration: '', date: '', status: '', level: '',
    methodology: '', goal: '', requirement: '',
    groups: [], entities: {}, sharedModules: [], modules: {},
    routes: '', iterationPlan: [], moduleActions: {},
    features: [], exclusions: [], clarifications: {},
    variationPoints: null,
  };

  // 標題
  const titleMatch = content.match(/^# 📋\s*(.+?)(?:\s*-\s*(?:需求草稿|活藍圖)|\s*$)/m);
  if (titleMatch) draft.title = titleMatch[1].trim();

  // 元資料
  const iterMatch = content.match(/\*\*迭代\*\*:\s*(.+)/);
  if (iterMatch) draft.iteration = iterMatch[1].trim();

  const levelMatch = content.match(/\*\*(POC )?Level\*\*:\s*([SML])/i);
  if (levelMatch) draft.level = levelMatch[2].toUpperCase();
  const scaleMatch = content.match(/\*\*規模\*\*:\s*([SML])/i);
  if (scaleMatch && !draft.level) draft.level = scaleMatch[1].toUpperCase();

  // 一句話目標
  const goalMatch = content.match(/##+ 一句話目標\s*\n+([^\n#]+)/);
  if (goalMatch) draft.goal = goalMatch[1].trim();

  // 用戶原始需求
  const reqMatch = content.match(/## 用戶原始需求\s*\n+([\s\S]*?)(?=\n---|\n##)/);
  if (reqMatch) draft.requirement = reqMatch[1].replace(/^>\s*/gm, '').trim();

  // 族群
  draft.groups = parseTable(content, /### 1\. 族群識別/);

  // 實體
  draft.entities = parseEntities(content);

  // 共用模組
  draft.sharedModules = parseChecklist(content, /### [23]\. 共用模組/);

  // 獨立模組 (v2: 含公開 API)
  draft.modules = parseModules(content);

  // 路由
  const routeMatch = content.match(/### [45]\. 路由結構[\s\S]*?```([\s\S]*?)```/);
  if (routeMatch) draft.routes = routeMatch[1].trim();

  // 迭代規劃表 (v2: 含交付 + 狀態)
  draft.iterationPlan = parseIterationPlan(content);

  // 模組動作清單 (v2: 含 deps + 狀態)
  draft.moduleActions = parseModuleActions(content);

  // 功能模組清單
  draft.features = parseChecklist(content, /## 功能模組清單/);

  // 不做什麼
  const exMatch = content.match(/### 不做什麼\s*\n([\s\S]*?)(?=\n---|\n##)/);
  if (exMatch) {
    draft.exclusions = exMatch[1].split('\n')
      .filter(l => l.trim().startsWith('-'))
      .map(l => l.replace(/^-\s*/, '').trim());
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
  const section = extractSection(content, /### 2\. 實體定義/);
  if (!section) return entities;
  const blocks = section.split(/####\s+/).slice(1);
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
  return entities;
}

// === 模組解析 (v2: 含公開 API) ===
function parseModules(content) {
  const modules = {};
  const section = extractSection(content, /### [34]\. 獨立模組/);
  if (!section) return modules;
  const blocks = section.split(/####\s+模組[：:]\s*/).slice(1);
  for (const block of blocks) {
    const nameMatch = block.match(/^([^\n(]+)/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    if (name.includes('{') && name.includes('}')) continue;

    const depsMatch = block.match(/依賴:\s*\[([^\]]*)\]/);
    const deps = depsMatch ? depsMatch[1].split(',').map(d => d.trim()).filter(Boolean) : [];

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

    modules[name] = { name, deps, features, publicAPI: apiLines };
  }
  return modules;
}

// === 迭代規劃表 (v2: 含交付 + 狀態) ===
function parseIterationPlan(content) {
  const section = extractSection(content, /## 📅 迭代規劃表/);
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
    const iter = parseInt(entry['iter'] || entry['迭代'] || '0');
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
function parseModuleActions(content) {
  const actions = {};
  const section = extractSection(content, /## 📋 模組動作清單/);
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
      actions[moduleName] = {
        iter, module: moduleName, fillLevel: 'stub', status: blockStatus || 'STUB',
        stubDescription: stubDesc ? stubDesc[1].trim() : '',
        estimate: estimateMatch ? estimateMatch[1].trim() : '',
        stubAPI: apiMatch ? apiMatch[1].split(',').map(s => s.trim()) : [],
        items: [],
      };
      continue;
    }

    // Done 偵測
    const isDone = blockStatus === 'DONE';
    if (isDone) {
      const summaryMatch = block.match(/>\s*(.+)/);
      actions[moduleName] = {
        iter, module: moduleName, fillLevel: 'done', status: 'DONE',
        summary: summaryMatch ? summaryMatch[1].trim() : '',
        items: [],
      };
      continue;
    }

    // Full/Partial 解析
    const isPartial = block.includes('(Partial)');
    // 移除 HTML 註解後再解析表格
    const cleanBlock = block.replace(/<!--[\s\S]*?-->/g, '');
    const lines = cleanBlock.split('\n').filter(l => l.includes('|') && l.trim().startsWith('|'));
    if (lines.length < 3) {
      actions[moduleName] = { iter, module: moduleName, fillLevel: 'stub', status: blockStatus, items: [] };
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
  const section = extractSection(content, /## 🔄 變異點分析/);
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
  const lines = content.split('\n');
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

module.exports = {
  load, parse,
  getModulesByIter, getAllIterations, getCurrentIter,
  getIterationSummary, checkDependencies,
  calculateStats, isEnhancedDraft, isV2Draft,
  filterActionsForModule,
  parseTable, parseEntities, parseModules,
  parseIterationPlan, parseModuleActions,
  parseClarifications, parseChecklist, extractSection,
};
