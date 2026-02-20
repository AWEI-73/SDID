#!/usr/bin/env node
/**
 * Draft Parser - Enhanced Draft (Markdown) 解析器
 * 
 * 取代 mmap-parser.cjs (YAML)，改為解析 SDID Enhanced Draft 格式
 * 零依賴：只用 Node.js 內建模組，不需要 js-yaml
 * 
 * 解析 requirement_draft_iter-X.md 中的：
 * - 實體表格 (Entity Tables)
 * - 迭代規劃表 (Iteration Planning)
 * - 模組動作清單 (Module Actions)
 * - 族群識別、共用模組、獨立模組、路由結構
 * 
 * 用法:
 *   const parser = require('./draft-parser.cjs');
 *   const draft = parser.load('./project/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md');
 *   const modules = parser.getModulesByIter(draft, 2);
 */

const fs = require('fs');
const path = require('path');

// ============================================
// 載入 Draft 文件
// ============================================
function load(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Draft file not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return parse(content);
}

// ============================================
// 解析 Enhanced Draft
// ============================================
function parse(content) {
    const draft = {
        title: '',
        iteration: '',
        date: '',
        status: '',
        level: '',
        methodology: '',
        goal: '',
        requirement: '',
        groups: [],
        entities: {},
        sharedModules: [],
        modules: {},
        routes: '',
        iterationPlan: [],
        moduleActions: {},
        features: [],
        exclusions: [],
        clarifications: {},
    };

    // === 標題 ===
    const titleMatch = content.match(/^# 📋\s*(.+?)(?:\s*-\s*需求草稿|\s*$)/m);
    if (titleMatch) draft.title = titleMatch[1].trim();

    // === 元資料 ===
    const iterMatch = content.match(/\*\*迭代\*\*:\s*(.+)/);
    if (iterMatch) draft.iteration = iterMatch[1].trim();

    const dateMatch = content.match(/\*\*日期\*\*:\s*(.+)/);
    if (dateMatch) draft.date = dateMatch[1].trim();

    const statusMatch = content.match(/\*\*草稿狀態\*\*:\s*(.+)/);
    if (statusMatch) draft.status = statusMatch[1].trim();

    const levelMatch = content.match(/\*\*(POC )?Level\*\*:\s*([SML])/i);
    if (levelMatch) draft.level = levelMatch[2].toUpperCase();

    const methodMatch = content.match(/\*\*方法論\*\*:\s*(.+)/);
    if (methodMatch) draft.methodology = methodMatch[1].trim();

    const scaleMatch = content.match(/\*\*規模\*\*:\s*([SML])/i);
    if (scaleMatch && !draft.level) draft.level = scaleMatch[1].toUpperCase();

    // === 一句話目標 ===
    const goalMatch = content.match(/##+ 一句話目標\s*\n+([^\n#]+)/);
    if (goalMatch) draft.goal = goalMatch[1].trim();

    // === 用戶原始需求 ===
    const reqMatch = content.match(/## 用戶原始需求\s*\n+([\s\S]*?)(?=\n---|\n##)/);
    if (reqMatch) draft.requirement = reqMatch[1].replace(/^>\s*/gm, '').trim();

    // === 族群識別 ===
    draft.groups = parseTable(content, /### 1\. 族群識別/);

    // === 實體定義 ===
    draft.entities = parseEntities(content);

    // === 共用模組 ===
    draft.sharedModules = parseChecklist(content, /### [23]\. 共用模組/);

    // === 獨立模組 ===
    draft.modules = parseModules(content);

    // === 路由結構 ===
    const routeMatch = content.match(/### [45]\. 路由結構[\s\S]*?```([\s\S]*?)```/);
    if (routeMatch) draft.routes = routeMatch[1].trim();

    // === 迭代規劃表 ===
    draft.iterationPlan = parseIterationPlan(content);

    // === 模組動作清單 ===
    draft.moduleActions = parseModuleActions(content);

    // === 功能模組清單 ===
    draft.features = parseChecklist(content, /## 功能模組清單/);

    // === 不做什麼 ===
    const exclusionMatch = content.match(/### 不做什麼\s*\n([\s\S]*?)(?=\n---|\n##)/);
    if (exclusionMatch) {
        draft.exclusions = exclusionMatch[1].split('\n')
            .filter(l => l.trim().startsWith('-'))
            .map(l => l.replace(/^-\s*/, '').trim());
    }

    // === 釐清項目 ===
    draft.clarifications = parseClarifications(content);

    return draft;
}

// ============================================
// 解析 Markdown 表格
// ============================================
function parseTable(content, headerPattern) {
    const section = extractSection(content, headerPattern);
    if (!section) return [];

    const lines = section.split('\n').filter(l => l.includes('|'));
    if (lines.length < 3) return []; // 至少要有 header + separator + 1 row

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

// ============================================
// 解析實體定義
// ============================================
function parseEntities(content) {
    const entities = {};
    const entitySection = extractSection(content, /### 2\. 實體定義/);
    if (!entitySection) return entities;

    // 找所有 #### EntityName
    const entityBlocks = entitySection.split(/####\s+/).slice(1);

    for (const block of entityBlocks) {
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

// ============================================
// 解析獨立模組
// ============================================
function parseModules(content) {
    const modules = {};
    const section = extractSection(content, /### [34]\. 獨立模組/);
    if (!section) return modules;

    const moduleBlocks = section.split(/####\s+模組[：:]\s*/).slice(1);

    for (const block of moduleBlocks) {
        const nameMatch = block.match(/^([^\n(]+)/);
        if (!nameMatch) continue;

        const name = nameMatch[1].trim();
        if (name.includes('{') && name.includes('}')) continue; // 佔位符

        const depsMatch = block.match(/依賴:\s*\[([^\]]*)\]/);
        const deps = depsMatch
            ? depsMatch[1].split(',').map(d => d.trim()).filter(Boolean)
            : [];

        const features = [];
        const featureLines = block.split('\n').filter(l => /^\s*-\s*\[[ x]\]/.test(l));
        for (const line of featureLines) {
            const checked = /\[x\]/i.test(line);
            const text = line.replace(/^\s*-\s*\[[ x]\]\s*/i, '').trim();
            if (text && !text.includes('{')) features.push({ text, checked });
        }

        modules[name] = { name, deps, features };
    }

    return modules;
}

// ============================================
// 解析迭代規劃表
// ============================================
function parseIterationPlan(content) {
    const section = extractSection(content, /## 📅 迭代規劃表/);
    if (!section) return [];

    const lines = section.split('\n').filter(l => l.includes('|'));
    if (lines.length < 3) return [];

    const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
    const plan = [];

    for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length < 3) continue;
        if (cells[0].startsWith('>') || cells[0].startsWith('-')) continue;

        const entry = {};
        headers.forEach((h, idx) => { entry[h.toLowerCase()] = cells[idx] || ''; });

        // 正規化
        const iter = parseInt(entry['iter'] || entry['迭代'] || '0');
        if (isNaN(iter) || iter === 0) continue;

        plan.push({
            iter,
            scope: entry['範圍'] || entry['scope'] || '',
            goal: entry['目標'] || entry['goal'] || '',
            module: entry['模組'] || entry['module'] || '',
            deps: (entry['依賴'] || entry['deps'] || '無')
                .split(',').map(d => d.trim()).filter(d => d && d !== '無'),
        });
    }

    return plan;
}

// ============================================
// 解析模組動作清單
// ============================================
function parseModuleActions(content) {
    const actions = {};
    const section = extractSection(content, /## 📋 模組動作清單/);
    if (!section) return actions;

    // 找所有 ### Iter N: moduleName
    const iterBlocks = section.split(/###\s+/).slice(1);

    for (const block of iterBlocks) {
        const headerMatch = block.match(/^Iter\s+(\d+):\s*([^\n(]+)/i);
        if (!headerMatch) continue;

        const iter = parseInt(headerMatch[1]);
        const moduleName = headerMatch[2].trim();

        // 檢查是否為 Stub
        const isStub = block.includes('(Stub)') || block.includes('> ');
        if (isStub) {
            const stubDesc = block.match(/>\s*(.+)/);
            actions[moduleName] = {
                iter,
                module: moduleName,
                fillLevel: 'stub',
                stubDescription: stubDesc ? stubDesc[1].trim() : '',
                items: [],
            };
            continue;
        }

        const isPartial = block.includes('(Partial)');

        // 解析動作表格
        const lines = block.split('\n').filter(l => l.includes('|'));
        if (lines.length < 3) {
            actions[moduleName] = { iter, module: moduleName, fillLevel: 'stub', items: [] };
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
                priority: item['優先級'] || item['priority'] || 'P2',
                flow: item['流向'] || item['flow'] || '',
            });
        }

        actions[moduleName] = {
            iter,
            module: moduleName,
            fillLevel: isPartial ? 'partial' : 'full',
            items,
        };
    }

    return actions;
}

// ============================================
// 解析釐清項目
// ============================================
function parseClarifications(content) {
    const section = extractSection(content, /## 釐清項目/);
    if (!section) return {};

    const result = {};
    const subSections = section.split(/###\s+/).slice(1);

    for (const sub of subSections) {
        const nameMatch = sub.match(/^([^\n]+)/);
        if (!nameMatch) continue;

        const name = nameMatch[1].trim();
        const items = [];
        const lines = sub.split('\n').filter(l => /^\s*-\s*\[[ x]\]/.test(l));

        for (const line of lines) {
            const checked = /\[x\]/i.test(line);
            const text = line.replace(/^\s*-\s*\[[ x]\]\s*/i, '').trim();
            items.push({ text, checked });
        }

        result[name] = items;
    }

    return result;
}

// ============================================
// 解析 checklist (- [x] / - [ ])
// ============================================
function parseChecklist(content, headerPattern) {
    const section = extractSection(content, headerPattern);
    if (!section) return [];

    const items = [];
    const lines = section.split('\n').filter(l => /^\s*-\s*\[[ x]\]/.test(l));

    for (const line of lines) {
        const checked = /\[x\]/i.test(line);
        const text = line.replace(/^\s*-\s*\[[ x]\]\s*/i, '').trim();
        if (text && !text.includes('{')) items.push({ text, checked });
    }

    return items;
}

// ============================================
// 提取區塊 (從 header 到下一個同級 header 或 ---)
// ============================================
function extractSection(content, headerPattern) {
    const lines = content.split('\n');
    let startIdx = -1;
    let headerLevel = 0;

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
        if (hMatch && hMatch[1].length <= headerLevel) {
            endIdx = i;
            break;
        }
        if (lines[i].trim() === '---' && i > startIdx + 2) {
            endIdx = i;
            break;
        }
    }

    return lines.slice(startIdx, endIdx).join('\n');
}

// ============================================
// 高階 API：與 mmap-parser 相容的介面
// ============================================

/**
 * 取得指定迭代的模組
 */
function getModulesByIter(draft, iter) {
    const result = [];

    for (const entry of draft.iterationPlan) {
        if (entry.iter === iter) {
            const moduleId = entry.module;
            const moduleDetail = draft.modules[moduleId] || {};
            const actionData = draft.moduleActions[moduleId] || {};

            result.push({
                id: moduleId,
                name: moduleId,
                desc: entry.goal || '',
                deps: entry.deps || moduleDetail.deps || [],
                status: '⬜',
                features: moduleDetail.features || [],
                actions: actionData.items || [],
                fillLevel: actionData.fillLevel || 'stub',
            });
        }
    }

    // 如果沒有迭代規劃表，從 modules 推導
    if (result.length === 0 && iter === 1) {
        for (const [name, mod] of Object.entries(draft.modules)) {
            result.push({
                id: name,
                name,
                desc: '',
                deps: mod.deps || [],
                status: '⬜',
                features: mod.features || [],
                actions: (draft.moduleActions[name] || {}).items || [],
                fillLevel: (draft.moduleActions[name] || {}).fillLevel || 'stub',
            });
        }
    }

    return result;
}

/**
 * 取得所有迭代編號
 */
function getAllIterations(draft) {
    const iters = new Set();
    for (const entry of draft.iterationPlan) {
        iters.add(entry.iter);
    }
    if (iters.size === 0) iters.add(1);
    return Array.from(iters).sort((a, b) => a - b);
}

/**
 * 取得迭代摘要
 */
function getIterationSummary(draft) {
    const summary = {};

    for (const entry of draft.iterationPlan) {
        if (!summary[entry.iter]) {
            summary[entry.iter] = {
                modules: [],
                scope: entry.scope || '',
                goal: entry.goal || '',
                totalActions: 0,
                canParallel: false,
            };
        }
        summary[entry.iter].modules.push(entry.module);

        const actions = draft.moduleActions[entry.module];
        if (actions) {
            summary[entry.iter].totalActions += (actions.items || []).length;
        }
    }

    for (const iter of Object.keys(summary)) {
        summary[iter].canParallel = summary[iter].modules.length > 1;
    }

    return summary;
}

/**
 * 檢查依賴是否滿足
 */
function checkDependencies(draft, moduleId, completedModules = []) {
    // 從迭代規劃表找依賴
    const entry = draft.iterationPlan.find(e => e.module === moduleId);
    const deps = entry ? entry.deps : (draft.modules[moduleId] || {}).deps || [];

    const missing = deps.filter(d => !completedModules.includes(d));

    return {
        satisfied: missing.length === 0,
        missing,
    };
}

/**
 * 計算統計
 */
function calculateStats(draft) {
    const totalModules = Object.keys(draft.modules).length ||
        draft.iterationPlan.reduce((s, e) => { s.add(e.module); return s; }, new Set()).size;

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
        totalModules,
        totalActions,
        totalIterations: getAllIterations(draft).length,
        totalEntities: Object.keys(draft.entities).length,
        priorities: priorityCounts,
        level: draft.level,
        hasEntities: Object.keys(draft.entities).length > 0,
        hasIterationPlan: draft.iterationPlan.length > 0,
        hasModuleActions: Object.keys(draft.moduleActions).length > 0,
    };
}

/**
 * 判斷 Draft 是否為 Enhanced 格式
 */
function isEnhancedDraft(draft) {
    return draft.hasIterationPlan || 
           Object.keys(draft.entities).length > 0 || 
           Object.keys(draft.moduleActions).length > 0;
}

// ============================================
// 導出
// ============================================
module.exports = {
    load,
    parse,
    getModulesByIter,
    getAllIterations,
    getIterationSummary,
    checkDependencies,
    calculateStats,
    isEnhancedDraft,
    // 低階解析
    parseTable,
    parseEntities,
    parseModules,
    parseIterationPlan,
    parseModuleActions,
    parseClarifications,
    parseChecklist,
    extractSection,
};

// ============================================
// CLI 模式
// ============================================
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: node draft-parser.cjs <draft.md> [--iter=N] [--stats] [--modules] [--actions]');
        process.exit(1);
    }

    const filePath = args[0];
    const iterArg = args.find(a => a.startsWith('--iter='));
    const showStats = args.includes('--stats');
    const showModules = args.includes('--modules');
    const showActions = args.includes('--actions');

    try {
        const draft = load(filePath);

        if (showStats) {
            console.log('\n📊 Draft Statistics:');
            console.log(JSON.stringify(calculateStats(draft), null, 2));
            console.log(`\nEnhanced Draft: ${isEnhancedDraft(draft) ? '✅ Yes' : '❌ No (普通 Draft)'}`);
        } else if (iterArg) {
            const iter = parseInt(iterArg.split('=')[1]);
            const modules = getModulesByIter(draft, iter);
            console.log(`\n📦 Modules for iter-${iter}:`);
            modules.forEach(m => {
                console.log(`  ${m.id} (${m.fillLevel}) - ${m.desc}`);
                console.log(`    deps: ${m.deps.join(', ') || '(none)'}`);
                console.log(`    actions: ${m.actions.length}`);
            });
        } else if (showModules) {
            console.log('\n📦 Modules:');
            for (const [name, mod] of Object.entries(draft.modules)) {
                console.log(`  ${name}`);
                console.log(`    deps: ${mod.deps.join(', ') || '(none)'}`);
                console.log(`    features: ${mod.features.length}`);
            }
        } else if (showActions) {
            console.log('\n📋 Module Actions:');
            for (const [name, data] of Object.entries(draft.moduleActions)) {
                console.log(`  ${name} (iter-${data.iter}, ${data.fillLevel})`);
                for (const item of data.items) {
                    console.log(`    ${item.priority} ${item.techName} [${item.type}] - ${item.semantic}`);
                }
            }
        } else {
            console.log('\n🗓️ Iteration Summary:');
            const summary = getIterationSummary(draft);
            for (const [iter, info] of Object.entries(summary)) {
                const parallel = info.canParallel ? ' ⚡並行' : '';
                console.log(`  iter-${iter}: ${info.modules.join(', ')}${parallel}`);
                console.log(`    目標: ${info.goal}`);
                console.log(`    動作數: ${info.totalActions}`);
            }
        }
    } catch (e) {
        console.error(`❌ Error: ${e.message}`);
        process.exit(1);
    }
}
