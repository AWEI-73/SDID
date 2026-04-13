'use strict';

/**
 * collect-functions.cjs
 *
 * Adapter over gems-scanner-v2 scanV2().
 * Maps raw scanner output to canonical functions.json shape
 * (aligned with task-pipe/phases/scan/scan.cjs v7.1 output).
 *
 * Does NOT reimplement scanning logic.
 * Does NOT modify gate rules.
 */

const fs   = require('fs');
const path = require('path');
const { scanV2 } = require('../gems-scanner-v2.cjs');

// ─── Contract cross-reference ────────────────────────────────────────────────
// Mirrors loadContractFlows from scan.cjs — reads @CONTRACT: blocks to inject
// testPath + behavior into matched function entries.

function loadContractFlows(projectRoot, iterNum) {
  const map = {};
  try {
    const contractPath = path.join(
      projectRoot, `.gems/iterations/iter-${iterNum}/contract_iter-${iterNum}.ts`
    );
    if (!fs.existsSync(contractPath)) return map;
    const content = fs.readFileSync(contractPath, 'utf8');
    if (!/\/\/\s*@CONTRACT:\s*\w+/.test(content)) return map;

    const blockRegex =
      /\/\/\s*@CONTRACT:\s*(.+?)(?=\n\/\/\s*@CONTRACT:|\nexport\s+(?:interface|declare|type|class|function)|$)/gs;
    for (const m of content.matchAll(blockRegex)) {
      const block = m[0];
      const name  = m[1].trim().split('|')[0].trim();
      if (!name) continue;
      const testMatch     = block.match(/\/\/\s*@TEST:\s*(.+\.(?:test|spec)\.tsx?)/);
      const behaviorLines = [...block.matchAll(/\/\/\s*-\s*(.+)/g)].map(b => b[1].trim());
      map[name] = {
        testPath:  testMatch ? testMatch[1].trim() : null,
        behaviors: behaviorLines.length > 0 ? behaviorLines : null,
      };
    }
  } catch { /* non-blocking */ }
  return map;
}

// ─── Canonical shape mapper ──────────────────────────────────────────────────

function mapToCanonicalFn(f, contractFlows) {
  const flow          = f.flow || '';
  const flowComplexity = flow ? flow.split('→').length : 0;
  const contractInfo  = contractFlows[f.name] || null;
  return {
    name:        f.name,
    file:        f.file,
    // line numbers
    startLine:   f.startLine || null,
    endLine:     f.endLine   || null,
    commentLine: (f.startLine && f.startLine > 1) ? f.startLine - 1 : null,
    lines:       (f.endLine && f.startLine) ? f.endLine - f.startLine + 1 : null,
    // identity
    risk:        f.priority,
    description: f.description || '',
    signature:   f.signature   || '',
    storyId:     f.storyId     || null,
    // flow
    flow,
    flowComplexity,
    // deps
    deps:        f.deps     || [],
    depsRisk:    f.depsRisk || '',
    testStatus:  f.test     || '',
    // contract cross-ref
    testPath:    contractInfo?.testPath  || null,
    behavior:    contractInfo?.behaviors || null,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Merge multiple scanV2() results into one (same logic as scan.cjs mergeScanResults).
 */
function mergeScanResults(results) {
  const merged = {
    functions: [],
    untagged:  [],
    stats: { total: 0, tagged: 0, P0: 0, P1: 0, P2: 0, P3: 0 },
  };
  for (const r of results) {
    if (!r) continue;
    merged.functions.push(...(r.functions || []));
    merged.untagged.push(...(r.untagged   || []));
    for (const k of ['total', 'tagged', 'P0', 'P1', 'P2', 'P3']) {
      merged.stats[k] = (merged.stats[k] || 0) + (r.stats?.[k] || 0);
    }
  }
  return merged;
}

/**
 * @param {string|string[]} srcDirs  - one or more source directories to scan
 * @param {string}          projectRoot
 * @param {number}          [iterNum=1]
 * @returns {object} payload ready for write-functions.cjs
 */
function collectFunctions(srcDirs, projectRoot, iterNum = 1) {
  const dirs = (Array.isArray(srcDirs) ? srcDirs : [srcDirs])
    .filter(d => require('fs').existsSync(d));

  if (dirs.length === 0) {
    console.warn(`  [collect-functions] No valid srcDirs found — functions will be empty`);
  }

  const rawResults    = dirs.map(d => { try { return scanV2(d, projectRoot); } catch { return null; } });
  const merged        = mergeScanResults(rawResults.filter(Boolean));
  const contractFlows = loadContractFlows(projectRoot, iterNum);

  const functions = merged.functions.map(f => mapToCanonicalFn(f, contractFlows));
  const untagged  = merged.untagged.map(f => ({
    name: f.name,
    file: f.file,
    line: f.line || null,
  }));

  const linesArr        = functions.map(f => f.lines || 0).filter(l => l > 0);
  const avgFunctionLines = linesArr.length > 0
    ? Math.round(linesArr.reduce((a, b) => a + b, 0) / linesArr.length)
    : 0;

  return {
    totalCount:     functions.length,
    untaggedCount:  untagged.length,
    byRisk: {
      P0: merged.stats.P0 || 0,
      P1: merged.stats.P1 || 0,
      P2: merged.stats.P2 || 0,
      P3: merged.stats.P3 || 0,
    },
    avgFunctionLines,
    functions,
    untagged,
  };
}

module.exports = { collectFunctions };
