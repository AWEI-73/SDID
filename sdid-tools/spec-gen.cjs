#!/usr/bin/env node
/**
 * spec-gen.cjs — GEMS 字典生成器（原 Skill A）
 *
 * 讀取 Blueprint Enhanced Draft 或 Task-Pipe requirement_spec，
 * 解析「模組動作清單表」→ 產出 .gems/specs/*.json + _index.json
 *
 * 這是框架收斂的最後一塊：上游生成字典 → 下游工具消費
 *   spec-gen → spec-gate → BUILD → dict-sync → SCAN
 *
 * 用法:
 *   node sdid-tools/spec-gen.cjs --project=<dir> --input=<draft.md>
 *   node sdid-tools/spec-gen.cjs --project=<dir> --input=<draft.md> --iter=2
 *   node sdid-tools/spec-gen.cjs --project=<dir> --input=<draft.md> --dry-run
 *
 * 選項:
 *   --project=<dir>    專案根目錄（必填，specs 寫入 <dir>/.gems/specs/）
 *   --input=<file>     輸入的 draft/spec markdown 檔案（必填）
 *   --iter=<N>         只處理指定的 iteration（如 --iter=2 只處理 Iter 2）
 *   --dry-run          只顯示將產出的內容，不實際寫入
 *   --help             顯示用法
 *
 * 輸入格式自動偵測:
 *   Blueprint: 有 "### Iter N: module_name" + 表格 (業務語意|類型|技術名稱|優先級|流向|AC)
 *   Task-Pipe: 有 "模組動作清單表" + 表格 (Story|模組動作名稱|Type|Prio|流程|功能描述)
 *   Skill-A fixture: 有 "模組動作清單表" + 表格 (Story|模組動作名稱|Type|Prio|GEMS-FLOW 簡述|功能描述)
 *
 * 退出碼:
 *   0 — 生成成功
 *   1 — 生成成功但 spec-gate 有 warnings
 *   2 — 參數或輸入錯誤
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ──────────────────────────────────────────
// CLI
// ──────────────────────────────────────────

function parseArgs() {
  const args = { project: null, input: null, iter: null, dryRun: false, help: false };
  for (const a of process.argv.slice(2)) {
    if      (a.startsWith('--project=')) args.project = path.resolve(a.slice(10));
    else if (a.startsWith('--input='))   args.input   = path.resolve(a.slice(8));
    else if (a.startsWith('--iter='))    args.iter    = parseInt(a.slice(7), 10);
    else if (a === '--dry-run')          args.dryRun  = true;
    else if (a === '--help' || a === '-h') args.help  = true;
  }
  return args;
}

// ──────────────────────────────────────────
// 色彩
// ──────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
};
function c(color, text) { return `${C[color]}${text}${C.reset}`; }

function die(msg) {
  console.error(`${c('red', '[spec-gen ERROR]')} ${msg}`);
  process.exit(2);
}

// ──────────────────────────────────────────
// Markdown 表格解析
// ──────────────────────────────────────────

/**
 * 解析 markdown 表格行
 * @param {string} line - "| col1 | col2 | col3 |"
 * @returns {string[]} - ["col1", "col2", "col3"]
 */
function parseTableRow(line) {
  return line
    .split('|')
    .map(s => s.trim())
    .filter((_, i, arr) => i > 0 && i < arr.length); // 去頭尾空欄
}

/**
 * 判斷是否為表格分隔行 (---|---|---)
 */
function isSeparatorRow(line) {
  return /^\|[\s:-]+\|/.test(line.trim());
}

/**
 * 解析一個完整的 markdown 表格（header + rows）
 * @param {string[]} lines - 從表頭開始的行
 * @returns {{ headers: string[], rows: string[][] }}
 */
function parseTable(lines) {
  if (lines.length < 3) return { headers: [], rows: [] };
  const headers = parseTableRow(lines[0]);
  // 跳過分隔行
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (isSeparatorRow(lines[i])) continue;
    if (!lines[i].trim().startsWith('|')) break;
    rows.push(parseTableRow(lines[i]));
  }
  return { headers, rows };
}

// ──────────────────────────────────────────
// 輸入偵測 + 解析
// ──────────────────────────────────────────

/**
 * 偵測輸入格式
 * @returns {'blueprint' | 'taskpipe'}
 */
function detectFormat(content) {
  // Blueprint: 有 "### Iter \d+:" 格式的 iteration subsection headers
  if (/###\s*Iter\s+\d+\s*[:：]/i.test(content)) return 'blueprint';
  // Task-Pipe: 有 "## 5." 或 "模組動作清單表" 但沒有 Iter subsections
  return 'taskpipe';
}

/**
 * 將模組名稱 (snake_case / kebab-case) 轉為 PascalCase Domain
 * "question_bank" → "QuestionBank"
 * "auth-service"  → "AuthService"
 * "shared"        → "Shared"
 * "meal-service"  → "Meal" (去掉 -service 後綴)
 */
function toDomain(moduleName) {
  // 去掉常見後綴
  let clean = moduleName.replace(/[_-](service|module|lib|api)$/i, '');
  return clean
    .split(/[_-]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

/**
 * 技術名稱 → kebab-case（for testFile, spec filename）
 * "PdfTextExtractor" → "pdf-text-extractor"
 */
function toKebab(name) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * 將 flow 字串 → steps 物件（key=stepName, value="" 佔位）
 * "Validate→Query→Hash→IssueJwt" → { Validate: "", Query: "", Hash: "", IssueJwt: "" }
 */
function flowToSteps(flow) {
  if (!flow) return {};
  const steps = {};
  flow.split('→').map(s => s.trim()).filter(Boolean).forEach(s => {
    steps[s] = (s === 'Return') ? '' : 'TODO';
  });
  return steps;
}

/**
 * 根據 Priority 決定 test 欄位
 */
function defaultTest(priority) {
  if (priority === 'P0') return { unit: true, integration: true, e2e: false };
  if (priority === 'P1') return { unit: true, integration: false, e2e: false };
  return { unit: false, integration: false, e2e: false };
}

// ──────────────────────────────────────────
// Blueprint 路線解析
// ──────────────────────────────────────────

/**
 * 解析 Blueprint Enhanced Draft
 * @returns {Array<{ moduleName, domain, specFileName, actions: Array }>}
 */
function parseBlueprint(content, filterIter) {
  const lines = content.split('\n');
  const modules = [];

  // 找「模組動作清單」主區塊
  let actionSectionStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#+\s*.*模組動作清單/i.test(lines[i])) {
      actionSectionStart = i;
      break;
    }
  }
  if (actionSectionStart === -1) {
    die('找不到「模組動作清單」區塊');
  }

  // 找「驗收條件」區塊
  const acMap = parseACSection(content);

  // 找每個 "### Iter N: module_name" subsection
  const iterRegex = /^###\s*Iter\s+(\d+)\s*[:：]\s*(.+)/i;
  let currentModule = null;
  let tableLines = [];

  for (let i = actionSectionStart + 1; i < lines.length; i++) {
    const line = lines[i];

    // 遇到同級或更高級標題 → 結束
    if (/^#{1,2}\s/.test(line) && !/^###/.test(line)) {
      // flush
      if (currentModule && tableLines.length > 0) {
        const parsed = parseBlueprintTable(tableLines, currentModule, acMap);
        if (parsed.actions.length > 0) modules.push(parsed);
      }
      currentModule = null;
      tableLines = [];
      break;
    }

    const m = line.match(iterRegex);
    if (m) {
      // flush previous
      if (currentModule && tableLines.length > 0) {
        const parsed = parseBlueprintTable(tableLines, currentModule, acMap);
        if (parsed.actions.length > 0) modules.push(parsed);
      }
      const iterNum = parseInt(m[1], 10);
      const moduleName = m[2].trim();
      currentModule = { iterNum, moduleName };
      tableLines = [];

      // 如果有 --iter 過濾，跳過不匹配的
      if (filterIter !== null && iterNum !== filterIter) {
        currentModule = null;
      }
      continue;
    }

    if (currentModule && line.trim().startsWith('|')) {
      tableLines.push(line);
    }
  }

  // flush last
  if (currentModule && tableLines.length > 0) {
    const parsed = parseBlueprintTable(tableLines, currentModule, acMap);
    if (parsed.actions.length > 0) modules.push(parsed);
  }

  return modules;
}

/**
 * 解析 Blueprint 格式的表格
 * 表頭: 業務語意 | 類型 | 技術名稱 | 優先級 | 流向 | AC
 */
function parseBlueprintTable(tableLines, moduleInfo, acMap) {
  const { headers, rows } = parseTable(tableLines);

  // 欄位名稱可能有變體，用 fuzzy matching
  const colIdx = {
    desc:     findCol(headers, ['業務語意', '功能描述', 'description']),
    type:     findCol(headers, ['類型', 'Type', 'type']),
    name:     findCol(headers, ['技術名稱', '模組動作名稱', 'name', 'Name']),
    priority: findCol(headers, ['優先級', '優先', 'Prio', 'prio', 'Priority']),
    flow:     findCol(headers, ['流向', '流程', 'GEMS-FLOW', 'Flow', 'flow']),
    ac:       findCol(headers, ['AC', 'ac', '驗收']),
    story:    findCol(headers, ['Story', 'story']),
  };

  const domain = toDomain(moduleInfo.moduleName);
  const specFileName = toKebab(moduleInfo.moduleName) + '.json';
  const actions = [];

  for (const row of rows) {
    const techName = colIdx.name !== -1 ? row[colIdx.name] : null;
    if (!techName) continue;

    const priority = colIdx.priority !== -1 ? normalizePriority(row[colIdx.priority]) : 'P2';
    const flowStr  = colIdx.flow !== -1 ? normalizeFlow(row[colIdx.flow]) : '';
    const desc     = colIdx.desc !== -1 ? row[colIdx.desc] : '';
    const type     = colIdx.type !== -1 ? row[colIdx.type] : 'FUNC';
    const acRef    = colIdx.ac !== -1 ? row[colIdx.ac] : '';
    const story    = colIdx.story !== -1 ? row[colIdx.story]
                     : `Story-${moduleInfo.iterNum}.0`;

    // 從 acMap 取得 Given/When/Then
    const acEntries = resolveAC(acRef, acMap);

    // gemsId: Domain.Action — Action 首字母必須大寫
    const actionName = techName.charAt(0).toUpperCase() + techName.slice(1);

    actions.push({
      gemsId: `${domain}.${actionName}`,
      techName: actionName,
      type,
      priority,
      flow: flowStr,
      description: desc,
      storyRef: normalizeStoryRef(story, moduleInfo.iterNum),
      acEntries,
    });
  }

  return {
    moduleName: moduleInfo.moduleName,
    iterNum: moduleInfo.iterNum,
    domain,
    specFileName,
    actions,
  };
}

// ──────────────────────────────────────────
// 模組名稱推斷
// ──────────────────────────────────────────

/**
 * 多策略推斷模組名稱
 * 優先順序:
 *   1. 標題中的英文名詞 (如 "Auth 系統" → "auth")
 *   2. 標題中的中文 → 英文猜測（如 "用餐管理" → 嘗試從表格推斷）
 *   3. 輸入檔名 (如 "auth-service.md" → "auth")
 *   4. 表格中第一個 techName 的前綴 (如 "AddMeal" → 猜 "meal")
 */
function inferModuleName(content, inputPath) {
  // 策略 1: 標題中的英文名詞（首個 H1）
  // "# 📋 Auth 系統 — Enhanced Draft" → "Auth"
  // "# 📋 ExamForge - 需求草稿" → "ExamForge"
  const h1Match = content.match(/^#\s+[📋🔧]*\s*([A-Za-z][A-Za-z0-9]*)/m);
  if (h1Match) {
    const name = h1Match[1];
    // 排除太泛的詞
    if (!['Enhanced', 'Draft', 'Requirement', 'Spec', 'Skill', 'Blueprint'].includes(name)) {
      return name.toLowerCase();
    }
  }

  // 策略 1b: "# ... XXX 系統" or "# ... XXX 管理"
  const cnTitleMatch = content.match(/^#\s+.*?([A-Za-z][A-Za-z0-9]+)\s*(系統|管理|服務|模組|CRUD)/m);
  if (cnTitleMatch) {
    return cnTitleMatch[1].toLowerCase();
  }

  // 策略 2: 輸入檔名
  if (inputPath) {
    const base = path.basename(inputPath, path.extname(inputPath));
    // "requirement-draft" → 不好, "auth-service" → 好
    if (!/(requirement|draft|spec|input|output)/i.test(base)) {
      return base.replace(/-service$/, '').replace(/-module$/, '');
    }
  }

  // 策略 3: 從表格所有技術名稱找共同詞根
  // "AddMeal", "ListMeals", "DeleteMeal" → 共同: "Meal"
  const techNames = [];
  const nameRegex = /\|\s*([A-Z][a-zA-Z]+)\s*\|/g;
  let nm;
  while ((nm = nameRegex.exec(content)) !== null) {
    const name = nm[1];
    // 排除表頭常見詞
    if (!['Story', 'Type', 'Prio', 'Priority', 'Name', 'FUNC', 'CONST', 'LIB', 'SVC', 'API', 'UI', 'ROUTE', 'HOOK'].includes(name)) {
      techNames.push(name);
    }
  }

  if (techNames.length >= 2) {
    // 找 PascalCase 中的共同詞 (非動詞部分)
    const words = techNames.map(n => n.match(/[A-Z][a-z]+/g) || []);
    const allWords = words.flat();
    const verbs = new Set(['Add', 'Get', 'List', 'Delete', 'Create', 'Update', 'Remove', 'Set', 'Fetch', 'Parse', 'Load', 'Save', 'Find', 'Check', 'Validate', 'Init', 'Render', 'Submit', 'Export', 'Import', 'Handle', 'Process', 'Build', 'Generate', 'Revoke', 'Clear', 'Soft', 'Authorize']);
    const nouns = allWords.filter(w => !verbs.has(w));

    // 找出現次數最多的名詞
    const freq = {};
    for (const n of nouns) freq[n] = (freq[n] || 0) + 1;
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][1] >= 2) {
      return sorted[0][0].toLowerCase(); // "Meal" → "meal"
    }
  }

  // 策略 4: fallback — 第一個 techName 的名詞部分
  if (techNames.length > 0) {
    const firstWords = techNames[0].match(/[A-Z][a-z]+/g) || [];
    const verbs = new Set(['Add', 'Get', 'List', 'Delete', 'Create', 'Update', 'Remove', 'Set']);
    const noun = firstWords.find(w => !verbs.has(w));
    if (noun) return noun.toLowerCase();
  }

  // 策略 5: fallback
  return 'module';
}

// ──────────────────────────────────────────
// Task-Pipe 路線解析
// ──────────────────────────────────────────

/**
 * 解析 Task-Pipe requirement_spec
 * 表頭: Story | 模組動作名稱 | Type | Prio | 流程 | 功能描述
 */
function parseTaskPipe(content, filterIter, args) {
  const lines = content.split('\n');

  // 找「模組動作清單」表格
  let tableStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/模組動作清單/i.test(lines[i])) {
      // 往下找表格起始
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        if (lines[j].trim().startsWith('|')) {
          tableStart = j;
          break;
        }
      }
      break;
    }
  }
  if (tableStart === -1) {
    die('找不到「模組動作清單表」的表格');
  }

  // 收集表格行
  const tableLines = [];
  for (let i = tableStart; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) break;
    tableLines.push(lines[i]);
  }

  const { headers, rows } = parseTable(tableLines);
  const colIdx = {
    story:    findCol(headers, ['Story', 'story']),
    name:     findCol(headers, ['模組動作名稱', '技術名稱', 'name', 'Name']),
    type:     findCol(headers, ['Type', 'type', '類型']),
    priority: findCol(headers, ['Prio', 'Priority', '優先級', '優先']),
    flow:     findCol(headers, ['流程', '流向', 'GEMS-FLOW', 'GEMS-FLOW 簡述', 'Flow']),
    desc:     findCol(headers, ['功能描述', '業務語意', 'description']),
  };

  // 解析驗收標準
  const acMap = parseACSection(content);

  // 推斷 module name: 多策略
  let moduleName = inferModuleName(content, args && args.input);
  const domain = toDomain(moduleName);
  const specFileName = toKebab(moduleName) + '.json';
  const actions = [];

  for (const row of rows) {
    const techName = colIdx.name !== -1 ? row[colIdx.name] : null;
    if (!techName) continue;

    const storyRaw = colIdx.story !== -1 ? row[colIdx.story] : '';
    const priority = colIdx.priority !== -1 ? normalizePriority(row[colIdx.priority]) : 'P2';
    const flowStr  = colIdx.flow !== -1 ? normalizeFlow(row[colIdx.flow]) : '';
    const desc     = colIdx.desc !== -1 ? row[colIdx.desc] : '';
    const type     = colIdx.type !== -1 ? row[colIdx.type] : 'FUNC';

    actions.push({
      gemsId: `${domain}.${techName}`,
      techName,
      type,
      priority,
      flow: flowStr,
      description: desc,
      storyRef: normalizeStoryRef(storyRaw, null),
      acEntries: [],
    });
  }

  return [{
    moduleName,
    iterNum: null,
    domain,
    specFileName,
    actions,
  }];
}

// ──────────────────────────────────────────
// 驗收條件解析
// ──────────────────────────────────────────

/**
 * 解析「驗收條件/驗收標準」區塊
 * 支援兩種格式:
 *   1. "### Iter N:" → "- **AC-N.M**: ..."
 *   2. "### AC-N.M:" → "- Given ... When ... Then ..."
 * @returns {Map<string, string[]>}  acRef → [Given/When/Then 句子]
 */
function parseACSection(content) {
  const acMap = new Map();
  const lines = content.split('\n');

  // 找驗收區塊
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#+\s*.*驗收(條件|標準)/i.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return acMap;

  // 解析 AC 項目
  let currentRef = null;
  let currentItems = [];

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];

    // 遇到非驗收的頂層標題 → 結束
    if (/^#{1,2}\s/.test(line) && !/驗收|AC/i.test(line) && !/^###/.test(line)) break;

    // "- **AC-N.M**: Given..." 或 "- **AC-N.M - AC-N.K**: 描述"
    const acMatch = line.match(/[-*]\s+\*?\*?AC[-_]?(\d+[\.\-]\d+)(?:\s*[-–—]\s*AC[-_]?(\d+[\.\-]\d+))?\*?\*?\s*[:：]\s*(.+)/i);
    if (acMatch) {
      // flush previous
      if (currentRef && currentItems.length > 0) {
        acMap.set(currentRef, currentItems);
      }

      const startRef = `AC-${acMatch[1].replace('-', '.')}`;
      const endRef   = acMatch[2] ? `AC-${acMatch[2].replace('-', '.')}` : null;
      const text     = acMatch[3].trim();
      currentRef = startRef;
      currentItems = [text];

      // 如果是範圍 (AC-2.1 - AC-2.3)，把同一段文字也存給範圍內每個 AC
      if (endRef) {
        const [, sN, sM] = startRef.match(/AC-(\d+)\.(\d+)/);
        const [, , eM]   = endRef.match(/AC-(\d+)\.(\d+)/);
        for (let m = parseInt(sM, 10); m <= parseInt(eM, 10); m++) {
          acMap.set(`AC-${sN}.${m}`, [text]);
        }
        currentRef = null; // 已經全存了，不需要後續 flush
        currentItems = [];
      }
      continue;
    }

    // "### AC-N.M: 標題" 格式
    const acHeaderMatch = line.match(/^###\s*AC[-_]?(\d+[\.\-]\d+)\s*[:：]\s*(.+)/i);
    if (acHeaderMatch) {
      if (currentRef && currentItems.length > 0) {
        acMap.set(currentRef, currentItems);
      }
      currentRef = `AC-${acHeaderMatch[1].replace('-', '.')}`;
      currentItems = [];
      continue;
    }

    // Given/When/Then 列表項
    if (currentRef && /^\s*[-*]\s+(Given|When|Then)/i.test(line)) {
      currentItems.push(line.replace(/^\s*[-*]\s+/, '').trim());
      continue;
    }

    // 一般列表項（在 AC 內的）
    if (currentRef && /^\s*[-*]\s+/.test(line) && line.trim().length > 5) {
      currentItems.push(line.replace(/^\s*[-*]\s+/, '').trim());
    }
  }

  // flush last
  if (currentRef && currentItems.length > 0) {
    acMap.set(currentRef, currentItems);
  }

  return acMap;
}

/**
 * 解析 AC 參照 → Given/When/Then 清單
 * @param {string} acRef - "AC-1.1" or "AC-1.1, AC-1.2" or "-"
 * @param {Map} acMap
 * @returns {string[]}
 */
function resolveAC(acRef, acMap) {
  if (!acRef || acRef === '-' || acRef === '—') return [];
  const refs = acRef.split(/[,，、\s]+/).map(r => r.trim()).filter(Boolean);
  const results = [];
  for (const ref of refs) {
    const normalized = ref.replace(/^AC[-_]?/i, 'AC-');
    if (acMap.has(normalized)) {
      results.push(...acMap.get(normalized));
    }
  }
  return results;
}

// ──────────────────────────────────────────
// 工具函式
// ──────────────────────────────────────────

function findCol(headers, candidates) {
  for (let i = 0; i < headers.length; i++) {
    for (const c of candidates) {
      if (headers[i].includes(c)) return i;
    }
  }
  return -1;
}

function normalizePriority(raw) {
  if (!raw) return 'P2';
  const m = raw.match(/P(\d)/);
  return m ? `P${m[1]}` : 'P2';
}

function normalizeFlow(raw) {
  if (!raw) return '';
  // 統一箭頭格式
  let flow = raw
    .replace(/\s*[→>]\s*/g, '→')
    .replace(/\s*->\s*/g, '→');
  // UPPER_SNAKE → PascalCase: READ_FILE → ReadFile
  flow = flow.replace(/[A-Z][A-Z_]+/g, snake => {
    return snake.split('_').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join('');
  });
  return flow;
}

function normalizeStoryRef(raw, iterNum) {
  if (!raw || raw === '-' || raw === '—') {
    return iterNum !== null ? `Story-${iterNum}.0` : 'Story-1.0';
  }
  // 已經是 Story-N.M 格式
  if (/^Story-/i.test(raw)) return raw;
  // 純數字: "1.0" → "Story-1.0"
  if (/^\d+\.\d+$/.test(raw)) return `Story-${raw}`;
  // "N.M" 帶 iteration
  return `Story-${raw}`;
}

// ──────────────────────────────────────────
// 字典生成
// ──────────────────────────────────────────

/**
 * 從 module 解析結果 → dict-schema 格式 JSON
 */
function generateSpecFile(module) {
  const { moduleName, domain, specFileName, actions } = module;

  // $meta
  const spec = {
    $meta: {
      manages: `src/${toKebab(moduleName)}.ts`,
      description: `${domain} 模組`,
      source: 'spec-gen.cjs 自動生成',
      lastSynced: new Date().toISOString().slice(0, 10),
    },
  };

  for (const action of actions) {
    const entry = {
      priority: action.priority,
      status: '⬜',
      signature: '(TODO)→Promise<void>',
      description: action.description || `${action.techName} 功能`,
      targetFile: `src/${toKebab(moduleName)}.ts`,
      lineRange: 'L1-1',
    };

    // P0/P1 必填欄位
    if (action.priority === 'P0' || action.priority === 'P1') {
      entry.flow = action.flow || 'TODO→Return';
      entry.steps = flowToSteps(action.flow);
      entry.deps = {};
      entry.depsRisk = 'LOW';
      entry.test = defaultTest(action.priority);
      entry.testFile = `${toKebab(action.techName)}.test.ts`;

      if (action.acEntries.length > 0) {
        entry.ac = action.acEntries;
      } else {
        entry.ac = [
          `Given valid input, When ${action.techName}(), Then expected result`,
          `Given invalid input, When ${action.techName}(), Then throw appropriate error`,
        ];
      }

      if (action.priority === 'P0') {
        entry.allowedImports = [];
      }
    }

    // P2/P3 選填
    if (action.priority === 'P2' || action.priority === 'P3') {
      if (action.flow) {
        entry.flow = action.flow;
        entry.steps = flowToSteps(action.flow);
      }
    }

    entry.storyRef = action.storyRef;

    spec[action.gemsId] = entry;
  }

  return spec;
}

/**
 * 從所有 modules → _index.json
 */
function generateIndex(modules) {
  const index = {
    $meta: {
      description: 'GEMS 字典全域索引',
      format: '{ "Domain.Action": "specs/xxx.json" }',
      lastSynced: new Date().toISOString().slice(0, 10),
    },
  };

  for (const mod of modules) {
    for (const action of mod.actions) {
      // P0/P1 必須在 index，P2+ 可選
      if (action.priority === 'P0' || action.priority === 'P1') {
        index[action.gemsId] = `specs/${mod.specFileName}`;
      }
    }
  }

  return index;
}

// ──────────────────────────────────────────
// 寫入
// ──────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeSpecs(projectRoot, modules, indexData, dryRun) {
  const specsDir = path.join(projectRoot, '.gems', 'specs');

  if (dryRun) {
    console.log(c('cyan', '\n📋 --dry-run 模式，以下為將產出的檔案：\n'));
  } else {
    ensureDir(specsDir);
  }

  const written = [];

  // 寫 spec 檔案
  for (const mod of modules) {
    const spec = generateSpecFile(mod);
    const filePath = path.join(specsDir, mod.specFileName);
    const json = JSON.stringify(spec, null, 2);

    if (dryRun) {
      console.log(c('bold', `── ${mod.specFileName} ──`));
      console.log(json);
      console.log('');
    } else {
      // 如果已存在，合併（不覆蓋已有條目）
      if (fs.existsSync(filePath)) {
        const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const merged = mergeSpec(existing, spec);
        fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');
        console.log(`  ${c('yellow', '↻')} 合併: ${mod.specFileName} (既有 ${Object.keys(existing).length - 1} + 新增 ${countNew(existing, spec)} 條目)`);
      } else {
        fs.writeFileSync(filePath, json, 'utf8');
        console.log(`  ${c('green', '+')} 建立: ${mod.specFileName} (${mod.actions.length} 條目)`);
      }
    }
    written.push(mod.specFileName);
  }

  // 寫 _index.json
  const indexPath = path.join(specsDir, '_index.json');
  const indexJson = JSON.stringify(indexData, null, 2);

  if (dryRun) {
    console.log(c('bold', '── _index.json ──'));
    console.log(indexJson);
  } else {
    if (fs.existsSync(indexPath)) {
      const existing = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      const merged = { ...existing, ...indexData };
      fs.writeFileSync(indexPath, JSON.stringify(merged, null, 2), 'utf8');
      console.log(`  ${c('yellow', '↻')} 合併: _index.json`);
    } else {
      fs.writeFileSync(indexPath, indexJson, 'utf8');
      console.log(`  ${c('green', '+')} 建立: _index.json`);
    }
  }

  return written;
}

/**
 * 合併兩個 spec：保留既有條目，只補新的
 */
function mergeSpec(existing, generated) {
  const merged = { ...existing };
  for (const [key, val] of Object.entries(generated)) {
    if (key === '$meta') {
      // 更新 meta 的 lastSynced
      merged.$meta = { ...existing.$meta, lastSynced: val.lastSynced };
      continue;
    }
    if (!(key in existing)) {
      merged[key] = val;
    }
  }
  return merged;
}

function countNew(existing, generated) {
  let count = 0;
  for (const key of Object.keys(generated)) {
    if (key !== '$meta' && !(key in existing)) count++;
  }
  return count;
}

// ──────────────────────────────────────────
// 報告
// ──────────────────────────────────────────

function printSummary(modules, format) {
  console.log(c('bold', '\n╔═══════════════════════════════════════╗'));
  console.log(c('bold',   '║        spec-gen 字典生成報告          ║'));
  console.log(c('bold',   '╚═══════════════════════════════════════╝'));
  console.log(`  路線: ${format === 'blueprint' ? 'Blueprint Enhanced Draft' : 'Task-Pipe requirement_spec'}`);
  console.log(`  模組數: ${modules.length}`);

  let totalActions = 0;
  let p0Count = 0, p1Count = 0;

  for (const mod of modules) {
    const actionCount = mod.actions.length;
    totalActions += actionCount;
    for (const a of mod.actions) {
      if (a.priority === 'P0') p0Count++;
      if (a.priority === 'P1') p1Count++;
    }
    console.log(`  ${c('cyan', '├')} ${mod.domain} (${mod.specFileName}): ${actionCount} 條目`);
    for (const a of mod.actions) {
      console.log(`  ${c('dim', '│')}   ${a.priority} ${a.gemsId}`);
    }
  }

  console.log(`\n  總計: ${totalActions} 條目 (${p0Count} P0 + ${p1Count} P1 + ${totalActions - p0Count - p1Count} other)`);
}

function printTodoForAI(modules) {
  console.log(c('yellow', '\n⚠️  以下欄位為佔位值，需要 AI 補完：'));
  console.log('');
  for (const mod of modules) {
    for (const action of mod.actions) {
      const todos = [];
      todos.push('signature (型別簽名)');
      if (action.priority === 'P0' || action.priority === 'P1') {
        todos.push('steps (每個 flow 步驟的說明)');
        todos.push('deps (依賴清單，格式: Category.Name)');
        todos.push('depsRisk (LOW/MEDIUM/HIGH)');
        if (action.acEntries.length === 0) {
          todos.push('ac (Given/When/Then 驗收條件)');
        }
        if (action.priority === 'P0') {
          todos.push('allowedImports (允許的外部 import)');
        }
      }
      console.log(`  ${c('cyan', action.gemsId)}: ${todos.join(', ')}`);
    }
  }
  console.log(`\n  ${c('dim', '提示: 補完後執行')} node sdid-tools/spec-gate.cjs --project=<dir> ${c('dim', '驗證字典品質')}`);
}

// ──────────────────────────────────────────
// 主程式
// ──────────────────────────────────────────

function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
spec-gen.cjs — GEMS 字典生成器（原 Skill A）

  讀取 Blueprint Enhanced Draft 或 Task-Pipe requirement_spec，
  解析「模組動作清單表」→ 產出 .gems/specs/*.json + _index.json

  用法:
    node sdid-tools/spec-gen.cjs --project=<dir> --input=<draft.md>
    node sdid-tools/spec-gen.cjs --project=<dir> --input=<draft.md> --iter=2
    node sdid-tools/spec-gen.cjs --project=<dir> --input=<draft.md> --dry-run

  選項:
    --project=<dir>    專案根目錄（必填）
    --input=<file>     輸入的 draft/spec markdown（必填）
    --iter=<N>         只處理指定的 iteration
    --dry-run          只顯示不寫入
    --help             顯示用法

  退出碼: 0=成功  2=參數錯誤
`);
    process.exit(0);
  }

  if (!args.project) die('缺少 --project=<dir>');
  if (!args.input)   die('缺少 --input=<draft.md>');

  if (!fs.existsSync(args.input)) die(`輸入檔案不存在: ${args.input}`);
  if (!fs.existsSync(args.project)) die(`專案目錄不存在: ${args.project}`);

  const content = fs.readFileSync(args.input, 'utf8');
  const format  = detectFormat(content);

  // 解析
  let modules;
  if (format === 'blueprint') {
    modules = parseBlueprint(content, args.iter);
  } else {
    modules = parseTaskPipe(content, args.iter, args);
  }

  if (modules.length === 0) {
    die('未解析到任何模組動作。請確認輸入檔案包含「模組動作清單」表格');
  }

  // 報告
  printSummary(modules, format);

  // 生成 index
  const indexData = generateIndex(modules);

  // 寫入
  console.log(c('bold', '\n── 檔案輸出 ──'));
  const written = writeSpecs(args.project, modules, indexData, args.dryRun);

  // AI 待辦
  printTodoForAI(modules);

  if (!args.dryRun) {
    console.log(c('green', `\n✅ spec-gen 完成`));
    console.log(`  下一步: ${c('dim', `node sdid-tools/spec-gate.cjs --project=${args.project}`)}`);
  }
}

main();
