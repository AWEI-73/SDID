'use strict';

/**
 * write-structure.cjs
 *
 * Writes .gems/docs/structure.json from collectStructure() output.
 */

const fs   = require('fs');
const path = require('path');

/**
 * @param {object} structureData  - result of collectStructure()
 * @param {string} outDir
 * @param {string} projectName
 * @returns {object} the written JSON object
 */
function writeStructure(structureData, outDir, projectName) {
  const out = {
    version:     '1',
    generatedAt: new Date().toISOString(),
    generatedBy: 'scan-runner',
    project:     projectName,
    modules:     structureData.modules,
  };

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'structure.json'), JSON.stringify(out, null, 2), 'utf8');
  return out;
}

module.exports = { writeStructure };
