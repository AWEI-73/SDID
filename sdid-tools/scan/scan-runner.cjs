#!/usr/bin/env node
/**
 * scan-runner.cjs  v1.0
 *
 * Orchestration layer: calls existing collectors/parsers/scanners,
 * normalizes results, writes SCAN products to .gems/docs/.
 *
 * Rules:
 *   - Does NOT reimplement phase/gate logic
 *   - Does NOT modify existing SCAN phase behavior
 *   - Does NOT modify deps.json (raw, owned by dep-scan)
 *   - All heavy lifting delegated to existing parsers via collectors
 *
 * Usage:
 *   node sdid-tools/scan/scan-runner.cjs --target=<project> [--iter=1] [--dry-run]
 *
 * Outputs (all under .gems/docs/):
 *   functions.json    — VERIFY canonical input (aligns with scan.cjs shape)
 *   apis.json         — contract-derived API surface
 *   schemas.json      — contract-derived schema surface
 *   structure.json    — draft-derived module structure
 *   deps.json         — raw graph (written by dep-scan, not modified here)
 *   deps-edges.json   — human/AI-facing curated edge projection
 *   CONTRACT.md       — human-readable contract summary
 *   SCAN.md           — hub document linking all outputs
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Arg parsing ─────────────────────────────────────────────────────────────

function parseArgs() {
  const args = { target: null, iter: 1, dryRun: false, help: false };
  for (const arg of process.argv.slice(2)) {
    if      (arg.startsWith('--target=')) args.target = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iter='))   args.iter   = parseInt(arg.split('=')[1]) || 1;
    else if (arg === '--dry-run')         args.dryRun  = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ─── Collectors ──────────────────────────────────────────────────────────────

const { collectFunctions } = require('../lib/scan/collect-functions.cjs');
const { collectContract  } = require('../lib/scan/collect-contract.cjs');
const { collectStructure } = require('../lib/scan/collect-structure.cjs');
const { collectDepsEdges } = require('../lib/scan/collect-deps.cjs');

// ─── Writers ─────────────────────────────────────────────────────────────────

const { writeFunctions }       = require('./writers/write-functions.cjs');
const { writeApis }            = require('./writers/write-apis.cjs');
const { writeSchemas }         = require('./writers/write-schemas.cjs');
const { writeStructure }       = require('./writers/write-structure.cjs');
const { writeDepsEdges }       = require('./writers/write-deps-edges.cjs');
const { writeContractSummary } = require('./writers/write-contract-summary.cjs');
const { writeScanHub }         = require('./writers/write-scan-hub.cjs');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Discover all source roots in a project.
 * Priority: well-known sub-project dirs (frontend/src, backend-gas/src, backend/src),
 * then root-level src/app/lib.  Returns at least one path (may not exist).
 */
function findSrcDirs(projectRoot) {
  const found = [];

  // Sub-project roots (monorepo / multi-app layout)
  const subProjects = ['frontend', 'backend-gas', 'backend', 'server', 'client'];
  for (const sub of subProjects) {
    for (const inner of ['src', 'app', 'lib']) {
      const p = path.join(projectRoot, sub, inner);
      if (fs.existsSync(p)) found.push(p);
    }
  }

  // Root-level src dirs (single-app layout or supplement)
  for (const candidate of ['src', 'app', 'lib', 'pages']) {
    const p = path.join(projectRoot, candidate);
    if (fs.existsSync(p) && !found.includes(p)) found.push(p);
  }

  // Fallback so caller always has something to display
  if (found.length === 0) found.push(path.join(projectRoot, 'src'));
  return found;
}

/**
 * Find draft file: prefer .gems/design/ (current layout),
 * fall back to .gems/iterations/iter-N/ (legacy layout).
 */
function findDraftFile(projectRoot, iterNum) {
  const candidates = [
    path.join(projectRoot, `.gems/design/draft_iter-${iterNum}.md`),
    path.join(projectRoot, `.gems/iterations/iter-${iterNum}/draft_iter-${iterNum}.md`),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

function findContractFile(projectRoot, iterNum) {
  const p = path.join(projectRoot, `.gems/iterations/iter-${iterNum}/contract_iter-${iterNum}.ts`);
  return fs.existsSync(p) ? p : null;
}

function step(label) {
  console.log(`\n[scan-runner] ${label}`);
}

function ok(msg)   { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function skip(msg) { console.log(`  —  ${msg}`); }

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs();

  if (args.help) {
    console.log([
      'Usage: node scan-runner.cjs --target=<project> [--iter=1] [--dry-run]',
      '',
      'Options:',
      '  --target=<path>   Project root (required)',
      '  --iter=<N>        Iteration number (default: 1)',
      '  --dry-run         Preview mode — no files written',
      '  --help            Show this message',
    ].join('\n'));
    process.exit(0);
  }

  if (!args.target) {
    console.error('❌ --target=<project> is required');
    process.exit(1);
  }

  const projectRoot  = args.target;
  const projectName  = path.basename(projectRoot);
  const iterNum      = args.iter;
  const outDir       = path.join(projectRoot, '.gems', 'docs');
  const srcDirs      = findSrcDirs(projectRoot);
  const draftPath    = findDraftFile(projectRoot, iterNum);
  const contractPath = findContractFile(projectRoot, iterNum);

  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║         scan-runner  v1.0             ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`  Project : ${projectName}`);
  console.log(`  Target  : ${projectRoot}`);
  console.log(`  Iter    : iter-${iterNum}`);
  console.log(`  Src     : ${srcDirs.map(d => path.relative(projectRoot, d)).join(', ')}`);
  console.log(`  Out     : ${outDir}`);
  if (args.dryRun) console.log('  [DRY RUN — no files written]');

  const generatedAt = new Date().toISOString();
  const summary = {};

  // ── [1/7] functions.json ──────────────────────────────────────────────────
  step('[1/7] functions.json');
  const fnPayload = collectFunctions(srcDirs, projectRoot, iterNum);
  summary.fnCount      = fnPayload.totalCount;
  summary.untaggedCount = fnPayload.untaggedCount;
  if (!args.dryRun) {
    writeFunctions(fnPayload, outDir, projectName);
    ok(`functions.json — ${fnPayload.totalCount} tagged, ${fnPayload.untaggedCount} untagged`);
  } else {
    skip(`[dry] ${fnPayload.totalCount} functions`);
  }

  // ── [2/7] apis.json + schemas.json (one parseContract call) ──────────────
  step('[2/7] apis.json + schemas.json');
  const contractData = collectContract(projectRoot, iterNum);
  summary.apiCount    = contractData.apis.length;
  summary.schemaCount = contractData.entities.length + contractData.views.length + contractData.enums.length;
  let apisJson = null, schemasJson = null;
  if (contractPath) {
    if (!args.dryRun) {
      apisJson    = writeApis(contractData, outDir, projectName);
      schemasJson = writeSchemas(contractData, outDir, projectName);
      ok(`apis.json — ${apisJson.apis.length} APIs`);
      ok(`schemas.json — ${schemasJson.schemas.length} schemas`);
    } else {
      skip(`[dry] apis:${contractData.apis.length}  schemas:${summary.schemaCount}`);
    }
  } else {
    warn(`contract_iter-${iterNum}.ts not found — apis.json + schemas.json skipped`);
  }

  // ── [3/7] CONTRACT.md ─────────────────────────────────────────────────────
  step('[3/7] CONTRACT.md');
  if (!args.dryRun && apisJson && schemasJson) {
    writeContractSummary(apisJson, schemasJson, outDir);
    ok('CONTRACT.md');
  } else if (!apisJson) {
    skip('CONTRACT.md — no contract data');
  } else {
    skip('[dry] CONTRACT.md');
  }

  // ── [4/7] structure.json ──────────────────────────────────────────────────
  step('[4/7] structure.json');
  if (draftPath) {
    const structureData = collectStructure(draftPath);
    summary.moduleCount = structureData.modules.length;
    if (!args.dryRun) {
      writeStructure(structureData, outDir, projectName);
      ok(`structure.json — ${structureData.modules.length} modules`);
    } else {
      skip(`[dry] ${structureData.modules.length} modules`);
    }
  } else {
    warn(`draft_iter-${iterNum}.md not found — structure.json skipped`);
    summary.moduleCount = 0;
  }

  // ── [5/7] deps.json (dep-scan, raw) ──────────────────────────────────────
  step('[5/7] deps.json  (dep-scan)');
  const depScanPath = path.resolve(__dirname, '../../task-pipe/tools/dep-scan.cjs');
  if (fs.existsSync(depScanPath)) {
    try {
      execSync(`node "${depScanPath}" --target="${projectRoot}"`, { stdio: 'pipe' });
      ok('deps.json  (raw graph — not modified by scan-runner)');
    } catch (e) {
      warn(`dep-scan failed: ${e.message?.split('\n')[0] || 'unknown'}`);
    }
  } else {
    warn('dep-scan.cjs not found — deps.json skipped');
  }

  // ── [6/7] deps-edges.json ─────────────────────────────────────────────────
  step('[6/7] deps-edges.json');
  const edgesData = collectDepsEdges(projectRoot);
  summary.edgeCount = edgesData?.edges?.length ?? 0;
  if (!args.dryRun) {
    const depsEdgesOut = writeDepsEdges(edgesData, outDir, projectName);
    if (depsEdgesOut) ok(`deps-edges.json — ${depsEdgesOut.edges.length} cross-module edges`);
  } else {
    skip(`[dry] ${summary.edgeCount} edges`);
  }

  // ── [7/7] SCAN.md hub ─────────────────────────────────────────────────────
  step('[7/7] SCAN.md');
  if (!args.dryRun) {
    writeScanHub({
      projectName,
      generatedAt,
      inputs: {
        contract: contractPath ? path.relative(projectRoot, contractPath) : null,
        draft:    draftPath    ? path.relative(projectRoot, draftPath)    : null,
        srcDirs:  srcDirs.map(d => path.relative(projectRoot, d)),
      },
      summary,
      outDir,
    });
    ok('SCAN.md');
  } else {
    skip('[dry] SCAN.md');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────');
  console.log('✅ scan-runner complete');
  console.log(`   fns:${summary.fnCount ?? '?'}  apis:${summary.apiCount ?? '?'}  schemas:${summary.schemaCount ?? '?'}  modules:${summary.moduleCount ?? '?'}  edges:${summary.edgeCount ?? '?'}`);
  console.log(`   Output → ${outDir}`);
  console.log('─────────────────────────────────────────\n');
}

main();

module.exports = { parseArgs }; // exported for tests
