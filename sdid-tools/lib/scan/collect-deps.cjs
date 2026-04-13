'use strict';

/**
 * collect-deps.cjs
 *
 * Reads the raw deps.json written by dep-scan, transforms adjacency graph
 * into a curated edge projection for deps-edges.json.
 *
 * Raw deps.json:  tool-facing, not modified.
 * deps-edges.json: human/AI-facing projection — cross-module edges only,
 *                  with risk annotation from circular/unusedExport signals.
 *
 * Does NOT reimplement dep-scan logic.
 * dep-scan must have run first (scan-runner spawns it before calling this).
 */

const fs   = require('fs');
const path = require('path');

// ─── Risk annotation ─────────────────────────────────────────────────────────

function buildRiskSets(circular, unusedExports) {
  const circularFiles     = new Set(circular.flat());
  const unusedExportFiles = new Set((unusedExports || []).map(u => u.file));
  return { circularFiles, unusedExportFiles };
}

function edgeRisk(fromFile, toFile, circularFiles, unusedExportFiles) {
  if (circularFiles.has(fromFile) || circularFiles.has(toFile)) return 'HIGH';
  if (unusedExportFiles.has(toFile))                            return 'MEDIUM';
  return 'LOW';
}

// ─── Top-level dir helper ────────────────────────────────────────────────────
// Cross-module = from and to live under different top-level directories.
// e.g. "src/modules/auth/foo.ts" → top = "src"
//      "src/shared/bar.ts" → top = "src"  (same top, skip)
// Second segment used when top is "src": "src/modules/..." → "modules"

function topSegment(filePath) {
  const parts = filePath.split('/');
  if (parts.length < 2) return parts[0] || '';
  // If first segment is a generic root (src/app/lib), use second segment for granularity
  if (/^(src|app|lib|pages)$/.test(parts[0]) && parts.length >= 2) return parts[1];
  return parts[0];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * @param {string} projectRoot
 * @returns {{ edges: object[] } | null}  null if deps.json not found
 */
function collectDepsEdges(projectRoot) {
  const depsJsonPath = path.join(projectRoot, '.gems', 'docs', 'deps.json');
  if (!fs.existsSync(depsJsonPath)) return null;

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(depsJsonPath, 'utf8'));
  } catch { return null; }

  const { graph = {}, circular = [], unusedExports = [] } = raw;
  const { circularFiles, unusedExportFiles } = buildRiskSets(circular, unusedExports);

  const edges = [];
  for (const [fromFile, { imports = [] }] of Object.entries(graph)) {
    const fromTop = topSegment(fromFile);
    for (const toFile of imports) {
      const toTop = topSegment(toFile);
      // Keep only cross-module edges; drop same-module helper noise
      if (fromTop === toTop) continue;

      edges.push({
        from:   fromFile,
        to:     toFile,
        kind:   'module',
        risk:   edgeRisk(fromFile, toFile, circularFiles, unusedExportFiles),
        source: 'dep-scan',
      });
    }
  }

  return { edges };
}

module.exports = { collectDepsEdges };
