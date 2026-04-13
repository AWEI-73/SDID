'use strict';

/**
 * write-deps-edges.cjs
 *
 * Writes .gems/docs/deps-edges.json — human/AI-facing edge projection.
 *
 * Complement to deps.json (raw tool-facing graph from dep-scan).
 * Does NOT modify or replace deps.json.
 */

const fs   = require('fs');
const path = require('path');

/**
 * @param {{ edges: object[] } | null} edgesData  - result of collectDepsEdges()
 * @param {string} outDir
 * @param {string} projectName
 * @returns {object|null} the written JSON object, or null if skipped
 */
function writeDepsEdges(edgesData, outDir, projectName) {
  if (!edgesData) {
    console.log('  [skip] deps-edges.json — deps.json not found; run dep-scan first');
    return null;
  }

  const out = {
    version:     '1',
    generatedAt: new Date().toISOString(),
    generatedBy: 'scan-runner',
    project:     projectName,
    note:        'Human/AI-facing edge projection. Raw graph: deps.json',
    edges:       edgesData.edges,
  };

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'deps-edges.json'), JSON.stringify(out, null, 2), 'utf8');
  return out;
}

module.exports = { writeDepsEdges };
