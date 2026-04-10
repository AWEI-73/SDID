'use strict';

/**
 * collect-structure.cjs
 *
 * Adapter over draft-parser-standalone.
 * Primary source remains draft moduleActions, but when the draft only provides
 * a structure-ready action table, we synthesize modules from that table so
 * SCAN stays aligned with the golden draft template and draft-gate DR-040.
 */

const fs = require('fs');
const draftParser = require('../draft-parser-standalone.cjs');

function inferLayer(name, hint = '') {
  const n = `${name} ${hint}`.toLowerCase();
  if (/page|screen|view|layout|artifact|topbar|grid|marker|panel|drawer/.test(n)) return 'presentation';
  if (/hook|store|context|state|slice/.test(n)) return 'state';
  if (/service|api|repo|repository|client/.test(n)) return 'service';
  if (/util|lib|shared|common|helper|layout/.test(n)) return 'shared';
  return null;
}

function normalizeList(value) {
  return String(value || '')
    .split(/[,+/&]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item !== '-' && item.toLowerCase() !== 'none');
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function readRaw(draftPath) {
  return fs.readFileSync(draftPath, 'utf8').replace(/\r\n/g, '\n');
}

function inferIteration(raw, draftPath) {
  const rawMatch = raw.match(/\*\*Iteration\*\*:\s*iter-(\d+)/i) || raw.match(/\*\*餈凋誨\*\*:\s*iter-(\d+)/);
  if (rawMatch) return `iter-${rawMatch[1]}`;

  const pathMatch = String(draftPath).match(/draft_iter-(\d+)\.md/i);
  if (pathMatch) return `iter-${pathMatch[1]}`;

  return null;
}

function mapModuleActionsToModules(moduleActions) {
  return Object.entries(moduleActions || {}).map(([name, mod]) => ({
    name,
    layer: inferLayer(name),
    desc: mod.desc || mod.stubDescription || mod.summary || null,
    deps: mod.deps || [],
    publicAPI: mod.publicApi || [],
    features: (mod.items || []).map((item) => item.techName || item.name).filter(Boolean),
    iter: mod.iter != null ? `iter-${mod.iter}` : null,
    fillLevel: mod.fillLevel || null,
  }));
}

function parseMarkdownTable(section) {
  const lines = section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'));

  if (lines.length < 3) return [];

  const headers = lines[0].split('|').map((cell) => cell.trim()).filter(Boolean);
  const rows = [];
  for (let index = 2; index < lines.length; index += 1) {
    const cells = lines[index].split('|').map((cell) => cell.trim()).filter(Boolean);
    if (cells.length === 0) continue;
    const row = {};
    headers.forEach((header, cellIndex) => {
      row[header] = cells[cellIndex] || '';
    });
    rows.push(row);
  }
  return rows;
}

function collectModulesFromScopeMatrix(raw, iteration) {
  const match = raw.match(/##\s+Scope Matrix\s*\n([\s\S]*?)(?=\n##\s+|$)/i);
  if (!match) return [];

  const rows = parseMarkdownTable(match[1]);
  if (rows.length === 0) return [];

  const modules = new Map();

  for (const row of rows) {
    const targets = normalizeList(row.Target);
    const deps = normalizeList(row.Dependency);
    const features = dedupe([row.Slice, row.Output]);

    for (const target of targets) {
      const existing = modules.get(target) || {
        name: target,
        layer: inferLayer(target, row.Domain),
        desc: null,
        deps: [],
        publicAPI: [],
        features: [],
        iter: iteration,
        fillLevel: 'table',
      };

      existing.layer = existing.layer || inferLayer(target, row.Domain);
      existing.deps = dedupe([...existing.deps, ...deps.filter((dep) => dep !== target)]);
      existing.features = dedupe([...existing.features, ...features]);
      modules.set(target, existing);
    }
  }

  return [...modules.values()];
}

function collectModulesFromExplicitSection(raw, iteration) {
  const match = raw.match(/##\s+Module Actions\s*\n([\s\S]*?)(?=\n##\s+|$)/i);
  if (!match) return [];

  const modules = [];
  const blocks = match[1].split(/\n###\s+/).map((block) => block.trim()).filter(Boolean);

  for (const block of blocks) {
    const normalized = block.startsWith('### ') ? block.slice(4) : block;
    const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
    const name = lines[0];
    if (!name) continue;

    const findValue = (label) => {
      const line = lines.find((entry) => entry.toLowerCase().startsWith(`- ${label}:`));
      return line ? line.split(':').slice(1).join(':').trim() : '';
    };

    const layer = findValue('layer');
    const desc = findValue('desc');
    const deps = normalizeList(findValue('deps'));
    const publicAPI = normalizeList(findValue('publicapi'));
    const features = normalizeList(findValue('features'));

    modules.push({
      name,
      layer: layer || inferLayer(name),
      desc: desc || null,
      deps,
      publicAPI,
      features,
      iter: iteration,
      fillLevel: 'explicit',
    });
  }

  return modules;
}

function collectFallbackModules(raw, draft) {
  const iteration = draft.iteration || null;
  const explicitModules = collectModulesFromExplicitSection(raw, iteration);
  if (explicitModules.length > 0) return explicitModules;
  return collectModulesFromScopeMatrix(raw, iteration);
}

/**
 * @param {string} draftPath - absolute path to draft_iter-N.md
 * @returns {{ modules: object[] }}
 */
function collectStructure(draftPath) {
  if (!fs.existsSync(draftPath)) return { modules: [] };

  const raw = readRaw(draftPath);
  const draft = draftParser.load(draftPath);
  const iteration = inferIteration(raw, draftPath);
  const primaryModules = mapModuleActionsToModules(draft.moduleActions);

  if (primaryModules.length > 0) {
    return {
      modules: primaryModules.map((module) => ({
        ...module,
        iter: module.iter || iteration,
      })),
    };
  }

  return { modules: collectFallbackModules(raw, { ...draft, iteration }) };
}

module.exports = { collectStructure };
