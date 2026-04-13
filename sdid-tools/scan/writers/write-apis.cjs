'use strict';

/**
 * write-apis.cjs
 *
 * Writes .gems/docs/apis.json from collectContract() output.
 * Source fields from parseContract(): api.name, api.story, api.methods[].
 */

const fs   = require('fs');
const path = require('path');

/**
 * @param {object} contractData  - result of collectContract()
 * @param {string} outDir
 * @param {string} projectName
 * @returns {object} the written JSON object
 */
function writeApis(contractData, outDir, projectName) {
  const sourceFile = contractData.sourceFile
    ? path.basename(contractData.sourceFile)
    : null;

  const out = {
    version:     '1',
    generatedAt: new Date().toISOString(),
    generatedBy: 'scan-runner',
    project:     projectName,
    apis: contractData.apis.map(api => ({
      // parseContract uses api.name (not apiName) and api.story (not storyId)
      apiName:    api.name,
      kind:       api.kind    || null,   // present on current-style entries (UI/SVC/API/HTTP)
      storyId:    api.story   || null,
      sourceFile: sourceFile  || '',
      methods: (api.methods || []).map(m => ({
        name:       m.name,
        params:     m.params      || '',
        returnType: m.returnType  || '',
      })),
    })),
  };

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'apis.json'), JSON.stringify(out, null, 2), 'utf8');
  return out;
}

module.exports = { writeApis };
