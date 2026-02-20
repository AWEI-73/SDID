#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const base = path.join(os.tmpdir(), 'sdid-mock-' + Date.now());

// === Mock A: Task-Pipe, 全新專案 (無任何檔案) ===
const A = path.join(base, 'proj-A-new');
fs.mkdirSync(A, { recursive: true });

// === Mock B: Task-Pipe, POC完成→PLAN中 (state.json at PLAN-2) ===
const B = path.join(base, 'proj-B-plan');
const Bpoc = path.join(B, '.gems/iterations/iter-1/poc');
fs.mkdirSync(Bpoc, { recursive: true });
fs.writeFileSync(path.join(Bpoc, 'requirement_spec_iter-1.md'), '# Spec\n### Story-1.0\n### Story-1.1\n');
fs.writeFileSync(path.join(B, '.gems/iterations/iter-1/.state.json'), JSON.stringify({
  version: '3.0', iteration: 'iter-1', status: 'active',
  flow: { entryPoint: 'POC-1', currentNode: 'PLAN-2', exitPoint: null, mode: 'full' },
  stories: {}, retries: {}, humanAlerts: [],
  createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString()
}, null, 2));

// === Mock C: Task-Pipe, BUILD Phase 5 進行中 (state.json at BUILD-5) ===
const C = path.join(base, 'proj-C-build');
const Cpoc = path.join(C, '.gems/iterations/iter-1/poc');
const Cplan = path.join(C, '.gems/iterations/iter-1/plan');
fs.mkdirSync(Cpoc, { recursive: true });
fs.mkdirSync(Cplan, { recursive: true });
fs.writeFileSync(path.join(Cpoc, 'requirement_spec_iter-1.md'), '# Spec\n### Story-1.0\n');
fs.writeFileSync(path.join(Cplan, 'implementation_plan_Story-1.0.md'), '# Story-1.0 Plan\n');
fs.writeFileSync(path.join(C, '.gems/iterations/iter-1/.state.json'), JSON.stringify({
  version: '3.0', iteration: 'iter-1', status: 'active',
  flow: { entryPoint: 'POC-1', currentNode: 'BUILD-5', exitPoint: null, mode: 'full' },
  stories: { 'Story-1.0': { status: 'in-progress', currentPhase: 'BUILD', currentStep: '5' } },
  retries: {}, humanAlerts: [],
  createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString()
}, null, 2));

// === Mock D: Task-Pipe, BUILD完成→SCAN (filesystem only, no state.json) ===
const D = path.join(base, 'proj-D-scan');
const Dpoc = path.join(D, '.gems/iterations/iter-1/poc');
const Dplan = path.join(D, '.gems/iterations/iter-1/plan');
const Dbuild = path.join(D, '.gems/iterations/iter-1/build');
fs.mkdirSync(Dpoc, { recursive: true });
fs.mkdirSync(Dplan, { recursive: true });
fs.mkdirSync(Dbuild, { recursive: true });
fs.writeFileSync(path.join(Dpoc, 'requirement_spec_iter-1.md'), '# Spec\n### Story-1.0\n');
fs.writeFileSync(path.join(Dplan, 'implementation_plan_Story-1.0.md'), '# Story-1.0\n');
fs.writeFileSync(path.join(Dbuild, 'Fillback_Story-1.0.md'), '# Fillback\n');
fs.writeFileSync(path.join(Dbuild, 'iteration_suggestions_Story-1.0.json'), '{"suggestions":[]}');

// === Mock E: Blueprint, GATE→PLAN (gate pass log exists) ===
const E = path.join(base, 'proj-E-bp-plan');
const Epoc = path.join(E, '.gems/iterations/iter-1/poc');
const Elogs = path.join(E, '.gems/iterations/iter-1/logs');
fs.mkdirSync(Epoc, { recursive: true });
fs.mkdirSync(Elogs, { recursive: true });
fs.writeFileSync(path.join(Epoc, 'requirement_draft_iter-1.md'),
  '# Enhanced Draft\n## 模組動作表\n| 模組 | 動作 |\n|------|------|\n| core | create |\n');
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
fs.writeFileSync(path.join(Elogs, 'gate-check-pass-' + ts + '.log'), '@PASS\n');

console.log('BASE:', base);
console.log('A:', A);
console.log('B:', B);
console.log('C:', C);
console.log('D:', D);
console.log('E:', E);
