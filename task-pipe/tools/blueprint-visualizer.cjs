#!/usr/bin/env node
/**
 * Blueprint Visualizer - Enhanced Draft → HTML 視覺化
 * 
 * 將 Enhanced Draft (Markdown 或 JSON) 轉為可互動的 HTML 視覺化頁面。
 * 
 * 用法:
 *   node blueprint-visualizer.cjs <draft.md>                    # 從 Markdown 產生 HTML
 *   node blueprint-visualizer.cjs <draft.md> --output=out.html  # 指定輸出路徑
 *   node blueprint-visualizer.cjs --json <data.json>            # 從 JSON 產生 HTML
 */

const fs = require('fs');
const path = require('path');

function loadDraft(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.json') {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    const draftParser = require('./draft-parser.cjs');
    return draftParser.load(filePath);
}

function generateHTML(draft) {
    const draftParser = require('./draft-parser.cjs');
    const stats = draftParser.calculateStats(draft);
    const isEnhanced = draftParser.isEnhancedDraft(draft);
    const summary = draftParser.getIterationSummary(draft);
    const allIters = draftParser.getAllIterations(draft);

    // Priority colors
    const pColor = { P0: '#ef4444', P1: '#f59e0b', P2: '#3b82f6', P3: '#6b7280' };

    // Build entity HTML
    let entitiesHTML = '';
    for (const [name, fields] of Object.entries(draft.entities || {})) {
        const rows = fields.map(f =>
            `<tr><td>${esc(f['欄位'] || f.field || '')}</td><td><code>${esc(f['型別'] || f.type || '')}</code></td><td>${esc(f['約束'] || f.constraint || '')}</td><td>${esc(f['說明'] || f.desc || '')}</td></tr>`
        ).join('');
        entitiesHTML += `
        <div class="card entity-card">
            <h3>📦 ${esc(name)}</h3>
            <table><thead><tr><th>欄位</th><th>型別</th><th>約束</th><th>說明</th></tr></thead>
            <tbody>${rows}</tbody></table>
        </div>`;
    }

    // Build iteration timeline
    let timelineHTML = '';
    for (const iter of allIters) {
        const info = summary[iter] || { modules: [], goal: '', canParallel: false };
        const mods = draftParser.getModulesByIter(draft, iter);
        const modCards = mods.map(m => {
            const fillBadge = m.fillLevel === 'full' ? '<span class="badge badge-full">Full</span>' :
                              m.fillLevel === 'partial' ? '<span class="badge badge-partial">Partial</span>' :
                              '<span class="badge badge-stub">Stub</span>';
            const depsList = m.deps.length > 0 ? m.deps.map(d => `<span class="dep-tag">${esc(d)}</span>`).join(' ') : '<span class="dep-none">無依賴</span>';
            return `<div class="module-card">
                <div class="module-header"><strong>${esc(m.id)}</strong> ${fillBadge}</div>
                <div class="module-deps">依賴: ${depsList}</div>
                <div class="module-actions">${m.actions.length} 個動作</div>
            </div>`;
        }).join('');

        const parallelBadge = info.canParallel ? '<span class="badge badge-parallel">⚡ 可並行</span>' : '';
        timelineHTML += `
        <div class="timeline-item">
            <div class="timeline-marker">Iter ${iter}</div>
            <div class="timeline-content">
                <div class="timeline-header">${esc(info.goal || info.scope || '')} ${parallelBadge}</div>
                <div class="module-grid">${modCards}</div>
            </div>
        </div>`;
    }

    // Build action tables per module
    let actionsHTML = '';
    for (const [modName, actData] of Object.entries(draft.moduleActions || {})) {
        if (actData.fillLevel === 'stub') {
            actionsHTML += `<div class="card"><h3>📋 Iter ${actData.iter}: ${esc(modName)} <span class="badge badge-stub">Stub</span></h3><p class="stub-desc">${esc(actData.stubDescription || '待細化')}</p></div>`;
            continue;
        }
        const rows = (actData.items || []).map(item => {
            const pc = pColor[item.priority] || '#6b7280';
            return `<tr>
                <td>${esc(item.semantic)}</td>
                <td><code>${esc(item.type)}</code></td>
                <td><strong>${esc(item.techName)}</strong></td>
                <td><span class="priority-badge" style="background:${pc}">${esc(item.priority)}</span></td>
                <td class="flow-cell">${esc(item.flow).replace(/→/g, '<span class="flow-arrow">→</span>')}</td>
            </tr>`;
        }).join('');
        const suffix = actData.fillLevel === 'partial' ? ' <span class="badge badge-partial">Partial</span>' : '';
        actionsHTML += `
        <div class="card">
            <h3>📋 Iter ${actData.iter}: ${esc(modName)}${suffix}</h3>
            <table class="action-table"><thead><tr><th>業務語意</th><th>類型</th><th>技術名稱</th><th>優先級</th><th>流向</th></tr></thead>
            <tbody>${rows}</tbody></table>
        </div>`;
    }

    // Groups
    let groupsHTML = '';
    if (draft.groups && draft.groups.length > 0) {
        const rows = draft.groups.map(g =>
            `<tr><td><strong>${esc(g['族群名稱'] || g.name || '')}</strong></td><td>${esc(g['描述'] || g.desc || '')}</td><td>${esc(g['特殊需求'] || g.needs || '')}</td></tr>`
        ).join('');
        groupsHTML = `<table><thead><tr><th>族群</th><th>描述</th><th>特殊需求</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    // Features
    let featuresHTML = '';
    for (const f of (draft.features || [])) {
        const icon = f.checked ? '✅' : '⬜';
        featuresHTML += `<div class="feature-item ${f.checked ? 'checked' : ''}">${icon} ${esc(f.text)}</div>`;
    }

    // Exclusions
    let exclusionsHTML = (draft.exclusions || []).map(e => `<li>${esc(e)}</li>`).join('');

    // Modules overview
    let modulesHTML = '';
    for (const [name, mod] of Object.entries(draft.modules || {})) {
        const deps = (mod.deps || []).map(d => `<span class="dep-tag">${esc(d)}</span>`).join(' ') || '<span class="dep-none">無</span>';
        const feats = (mod.features || []).map(f => `<div class="feature-item ${f.checked ? 'checked' : ''}">${f.checked ? '✅' : '⬜'} ${esc(f.text)}</div>`).join('');
        modulesHTML += `<div class="card module-detail-card"><h3>🧩 ${esc(name)}</h3><div class="module-deps">依賴: ${deps}</div><div class="module-features">${feats}</div></div>`;
    }

    // Priority distribution chart (CSS bar)
    const totalActions = stats.totalActions || 1;
    const pBars = ['P0', 'P1', 'P2', 'P3'].map(p => {
        const count = stats.priorities[p] || 0;
        const pct = Math.round(count / totalActions * 100);
        return `<div class="pbar" style="width:${Math.max(pct, 2)}%;background:${pColor[p]}" title="${p}: ${count}">${count > 0 ? `${p}(${count})` : ''}</div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📐 ${esc(draft.title || 'Blueprint')} - SDID 藍圖視覺化</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;line-height:1.6}
.container{max-width:1200px;margin:0 auto;padding:20px}
h1{font-size:1.8rem;margin-bottom:8px}
h2{font-size:1.3rem;margin:32px 0 16px;padding-bottom:8px;border-bottom:2px solid #334155;color:#38bdf8}
h3{font-size:1.1rem;margin-bottom:12px;color:#f1f5f9}
.header{background:linear-gradient(135deg,#1e293b,#0f172a);border:1px solid #334155;border-radius:12px;padding:24px;margin-bottom:24px}
.header-meta{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px}
.meta-tag{background:#1e293b;border:1px solid #475569;border-radius:6px;padding:4px 12px;font-size:.85rem}
.meta-tag.enhanced{border-color:#22c55e;color:#22c55e}
.goal-box{background:#1e3a5f;border-left:4px solid #38bdf8;padding:16px;border-radius:0 8px 8px 0;margin:16px 0;font-size:1.05rem}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0}
.stat-card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;text-align:center}
.stat-value{font-size:1.8rem;font-weight:700;color:#38bdf8}
.stat-label{font-size:.8rem;color:#94a3b8;margin-top:4px}
.card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:.9rem}
th{background:#334155;padding:8px 12px;text-align:left;font-weight:600;color:#cbd5e1}
td{padding:8px 12px;border-bottom:1px solid #1e293b}
tr:hover td{background:#334155}
code{background:#0f172a;padding:2px 6px;border-radius:4px;font-size:.85rem;color:#a78bfa}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.75rem;font-weight:600}
.badge-full{background:#166534;color:#86efac}
.badge-partial{background:#854d0e;color:#fde047}
.badge-stub{background:#374151;color:#9ca3af}
.badge-parallel{background:#1e3a5f;color:#38bdf8}
.priority-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.75rem;font-weight:700;color:#fff}
.flow-cell{font-family:'Fira Code',monospace;font-size:.85rem;color:#94a3b8}
.flow-arrow{color:#38bdf8;font-weight:700;margin:0 2px}
.timeline-item{display:flex;gap:16px;margin-bottom:20px}
.timeline-marker{min-width:70px;background:#38bdf8;color:#0f172a;font-weight:700;text-align:center;padding:8px;border-radius:8px;font-size:.9rem;height:fit-content}
.timeline-content{flex:1;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px}
.timeline-header{font-weight:600;margin-bottom:12px;font-size:1rem}
.module-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}
.module-card{background:#0f172a;border:1px solid #475569;border-radius:6px;padding:12px}
.module-header{margin-bottom:6px}
.module-deps{font-size:.8rem;color:#94a3b8;margin:4px 0}
.module-actions{font-size:.8rem;color:#64748b}
.dep-tag{background:#1e3a5f;color:#7dd3fc;padding:1px 6px;border-radius:3px;font-size:.75rem;margin-right:4px}
.dep-none{color:#64748b;font-size:.75rem}
.feature-item{padding:4px 0;font-size:.9rem}
.feature-item.checked{color:#86efac}
.stub-desc{color:#94a3b8;font-style:italic;padding:8px;background:#0f172a;border-radius:4px}
.entity-card{border-left:3px solid #a78bfa}
.module-detail-card{border-left:3px solid #38bdf8}
.module-features{margin-top:8px}
.pbar-container{display:flex;height:28px;border-radius:6px;overflow:hidden;background:#0f172a;margin:8px 0}
.pbar{display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;color:#fff;transition:width .3s}
.section-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.arch-note{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin:16px 0;font-size:.85rem;color:#94a3b8}
.arch-note strong{color:#38bdf8}
.arch-layers{display:flex;flex-direction:column;gap:4px;margin:12px 0}
.arch-layer{display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:4px;font-size:.85rem}
.arch-layer .layer-num{min-width:24px;height:24px;background:#38bdf8;color:#0f172a;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem}
.arch-layer .layer-name{font-weight:600;min-width:80px}
.arch-layer .layer-desc{color:#94a3b8}
.l1{background:#0f172a;border:1px solid #334155}
.l2{background:#0f172a;border:1px solid #334155}
.l3{background:#0f172a;border:1px solid #334155}
.l4{background:#0f172a;border:1px solid #334155}
.l5{background:#1e293b;border:1px solid #475569}
.l6{background:#0f172a;border:1px solid #334155}
footer{text-align:center;padding:32px;color:#475569;font-size:.8rem}
@media(max-width:768px){.stats-grid{grid-template-columns:repeat(2,1fr)}.timeline-item{flex-direction:column}.module-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="container">

<!-- Header -->
<div class="header">
    <h1>📐 ${esc(draft.title || 'Blueprint')}</h1>
    <div class="header-meta">
        <span class="meta-tag">${esc(draft.iteration || 'iter-1')}</span>
        <span class="meta-tag">${esc(draft.date || '')}</span>
        <span class="meta-tag">Level ${esc(draft.level || '?')}</span>
        <span class="meta-tag ${isEnhanced ? 'enhanced' : ''}">${isEnhanced ? '✅ Enhanced Draft' : '📄 Standard Draft'}</span>
        <span class="meta-tag">SDID v1.0</span>
    </div>
</div>

<!-- Goal -->
<div class="goal-box">🎯 ${esc(draft.goal || '(未設定)')}</div>

<!-- Stats -->
<div class="stats-grid">
    <div class="stat-card"><div class="stat-value">${stats.totalModules}</div><div class="stat-label">模組</div></div>
    <div class="stat-card"><div class="stat-value">${stats.totalEntities}</div><div class="stat-label">實體</div></div>
    <div class="stat-card"><div class="stat-value">${stats.totalActions}</div><div class="stat-label">動作</div></div>
    <div class="stat-card"><div class="stat-value">${stats.totalIterations}</div><div class="stat-label">迭代</div></div>
    <div class="stat-card"><div class="stat-value">${draft.level || '?'}</div><div class="stat-label">規模</div></div>
    <div class="stat-card"><div class="stat-value">${(draft.groups || []).length}</div><div class="stat-label">族群</div></div>
</div>

<!-- Priority Distribution -->
<h2>📊 優先級分佈</h2>
<div class="pbar-container">${pBars}</div>

<!-- Architecture -->
<h2>🏗️ 模組化架構</h2>
<div class="arch-layers">
    <div class="arch-layer l1"><span class="layer-num">1</span><span class="layer-name">Config</span><span class="layer-desc">全域配置 — 不依賴其他層</span></div>
    <div class="arch-layer l2"><span class="layer-num">2</span><span class="layer-name">Assets</span><span class="layer-desc">靜態資源</span></div>
    <div class="arch-layer l3"><span class="layer-num">3</span><span class="layer-name">Lib</span><span class="layer-desc">第三方庫封裝 — 僅依賴 Config</span></div>
    <div class="arch-layer l4"><span class="layer-num">4</span><span class="layer-name">Shared</span><span class="layer-desc">跨模組共用 — 依賴 Config, Lib</span></div>
    <div class="arch-layer l5"><span class="layer-num">5</span><span class="layer-name">Modules</span><span class="layer-desc">核心業務 (垂直分片) — 依賴 Shared, Config, Lib</span></div>
    <div class="arch-layer l6"><span class="layer-num">6</span><span class="layer-name">Routes</span><span class="layer-desc">路由定義 — 依賴 Modules, Shared</span></div>
</div>

<!-- Groups -->
${groupsHTML ? `<h2>👥 族群識別</h2><div class="card">${groupsHTML}</div>` : ''}

<!-- Entities -->
${entitiesHTML ? `<h2>📦 實體定義</h2>${entitiesHTML}` : ''}

<!-- Modules -->
${modulesHTML ? `<h2>🧩 獨立模組</h2><div class="section-grid">${modulesHTML}</div>` : ''}

<!-- Iteration Timeline -->
${timelineHTML ? `<h2>🗓️ 迭代規劃</h2>${timelineHTML}` : ''}

<!-- Module Actions -->
${actionsHTML ? `<h2>📋 模組動作清單</h2>${actionsHTML}` : ''}

<!-- Features -->
${featuresHTML ? `<h2>✅ 功能模組清單</h2><div class="card">${featuresHTML}</div>` : ''}

<!-- Exclusions -->
${exclusionsHTML ? `<h2>🚫 不做什麼</h2><div class="card"><ul>${exclusionsHTML}</ul></div>` : ''}

<footer>SDID Blueprint Visualizer | Generated ${new Date().toISOString().split('T')[0]} | Task-Pipe Framework</footer>
</div>
</body>
</html>`;
}

function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================
// 導出
// ============================================
module.exports = { generateHTML, loadDraft };

// ============================================
// CLI
// ============================================
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
Blueprint Visualizer - Enhanced Draft → HTML

用法:
  node blueprint-visualizer.cjs <draft.md>                    從 Markdown 產生 HTML
  node blueprint-visualizer.cjs <data.json>                   從 JSON 產生 HTML
  node blueprint-visualizer.cjs <file> --output=out.html      指定輸出路徑
`);
        process.exit(0);
    }

    const inputFile = args.find(a => !a.startsWith('--'));
    const outputArg = args.find(a => a.startsWith('--output='));
    const outputFile = outputArg ? outputArg.split('=')[1] : null;

    if (!inputFile || !fs.existsSync(inputFile)) {
        console.error('❌ 檔案不存在:', inputFile);
        process.exit(1);
    }

    try {
        const draft = loadDraft(inputFile);
        const html = generateHTML(draft);

        if (outputFile) {
            fs.writeFileSync(outputFile, html, 'utf8');
            console.log(`✅ 已產生: ${outputFile}`);
        } else {
            const baseName = path.basename(inputFile, path.extname(inputFile));
            const outPath = path.join(path.dirname(inputFile), `${baseName}-blueprint.html`);
            fs.writeFileSync(outPath, html, 'utf8');
            console.log(`✅ 已產生: ${outPath}`);
        }
    } catch (e) {
        console.error('❌ 錯誤:', e.message);
        process.exit(1);
    }
}
