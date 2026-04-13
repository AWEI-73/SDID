'use strict';

/**
 * write-functions.cjs
 *
 * Writes .gems/docs/functions.json from collect-functions payload.
 * Output shape is canonical — aligned with task-pipe SCAN phase.
 *
 * generatedBy is 'scan-runner' to distinguish from the existing 'scan' phase.
 * VERIFY accepts either value; it reads only the functions array.
 */

const fs   = require('fs');
const path = require('path');

/**
 * @param {object} payload   - result of collectFunctions()
 * @param {string} outDir    - .gems/docs/ directory
 * @param {string} projectName
 * @returns {object} the written JSON object
 */
function writeFunctions(payload, outDir, projectName) {
  const out = {
    version:         '1',
    generatedBy:     'scan-runner',
    generatedAt:     new Date().toISOString(),
    project:         projectName,
    totalCount:      payload.totalCount,
    untaggedCount:   payload.untaggedCount,
    byRisk:          payload.byRisk,
    avgFunctionLines: payload.avgFunctionLines,
    functions:       payload.functions,
    untagged:        payload.untagged,
  };

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'functions.json'), JSON.stringify(out, null, 2), 'utf8');
  return out;
}

module.exports = { writeFunctions };
