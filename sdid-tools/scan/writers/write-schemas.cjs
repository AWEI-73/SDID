'use strict';

/**
 * write-schemas.cjs
 *
 * Writes .gems/docs/schemas.json from collectContract() output.
 * Merges entities + views + enums into a single schemas[] array with kind tag.
 *
 * parseContract field notes:
 *   - entity/view fields use tsType (not type) and dbType (not notes)
 *   - optional is not extracted by parseContract; defaults to false
 *   - entity uses .story (not storyId); view has no story field
 */

const fs   = require('fs');
const path = require('path');

function normalizeFields(fields = []) {
  return fields.map(f => ({
    name:     f.name    || '',
    type:     f.tsType  || '',   // parseContract stores TypeScript type as tsType
    optional: false,             // parseContract does not extract optionality
    dbType:   f.dbType  || null,
    notes:    f.hasDbAnnotation ? f.dbType : null,
  }));
}

function schemasFromEntities(entities, sourceFile) {
  return (entities || []).map(e => ({
    name:       e.name,
    kind:       'entity',
    storyId:    e.story || null,   // parseContract stores as .story
    sourceFile: sourceFile || '',
    fields:     normalizeFields(e.fields),
  }));
}

function schemasFromViews(views, sourceFile) {
  return (views || []).map(v => ({
    name:       v.name,
    kind:       'view',
    storyId:    null,              // parseContract @GEMS-VIEW has no story tag
    sourceFile: sourceFile || '',
    fields:     normalizeFields(v.fields),
  }));
}

function schemasFromEnums(enums, sourceFile) {
  return (enums || []).map(en => ({
    name:       en.name,
    kind:       'enum',
    storyId:    null,
    sourceFile: sourceFile || '',
    fields:     [],               // enums are name-only in current contract format
  }));
}

/**
 * @param {object} contractData  - result of collectContract()
 * @param {string} outDir
 * @param {string} projectName
 * @returns {object} the written JSON object
 */
function writeSchemas(contractData, outDir, projectName) {
  const sourceFile = contractData.sourceFile
    ? path.basename(contractData.sourceFile)
    : null;

  const schemas = [
    ...schemasFromEntities(contractData.entities, sourceFile),
    ...schemasFromViews(contractData.views, sourceFile),
    ...schemasFromEnums(contractData.enums, sourceFile),
  ];

  const out = {
    version:     '1',
    generatedAt: new Date().toISOString(),
    generatedBy: 'scan-runner',
    project:     projectName,
    schemas,
  };

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'schemas.json'), JSON.stringify(out, null, 2), 'utf8');
  return out;
}

module.exports = { writeSchemas };
