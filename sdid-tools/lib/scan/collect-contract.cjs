'use strict';

/**
 * collect-contract.cjs
 *
 * One parseContract() call → returns { apis, entities, views, enums, stories, sourceFile }.
 * Both write-apis and write-schemas consume this single result.
 *
 * Also handles current-style contracts:
 *   // @CONTRACT: Name | Priority | Type | Story-X.Y
 *   export declare function Name(props: PropsType): ReturnType;
 *
 * Current-style entries are merged into apis[] so apis.json is never empty
 * when the project uses the new annotation format (UI/SVC/API/HTTP types).
 *
 * Does NOT reimplement contract parsing / gate logic.
 */

const fs   = require('fs');
const path = require('path');
const { parseContract } = require('../../blueprint/contract-writer.cjs');

function findContractFile(projectRoot, iterNum) {
  const p = path.join(
    projectRoot, `.gems/iterations/iter-${iterNum}/contract_iter-${iterNum}.ts`
  );
  return fs.existsSync(p) ? p : null;
}

// ─── Current-style @CONTRACT adapter ────────────────────────────────────────
// Format: // @CONTRACT: Name | Priority | Type | Story-X.Y
// Followed optionally by @RISK, @GEMS-FLOW, behavior lines, then
//   export declare function Name(props: PropsType): ReturnType;
//
// All types (UI, SVC, API, HTTP, CONST, ROUTE…) are extracted as API surfaces.
// Type is preserved in the `kind` field so consumers can filter if needed.

const CURRENT_CONTRACT_LINE =
  /^\/\/\s*@CONTRACT:\s*([^|]+)\|([^|]+)\|([^|]+)\|(.+)$/;

const DECLARE_FN =
  /^export declare function (\w+)\s*\(([^)]*)\)\s*:\s*(.+?)\s*;/;

/**
 * Parse current-style @CONTRACT blocks from raw content.
 * Returns an array compatible with the apis[] shape expected by write-apis.
 */
function parseCurrentStyleContracts(content) {
  const lines   = content.split('\n');
  const results = [];
  let i = 0;

  while (i < lines.length) {
    const m = CURRENT_CONTRACT_LINE.exec(lines[i].trim());
    if (!m) { i++; continue; }

    const name     = m[1].trim();
    const priority = m[2].trim();
    const type     = m[3].trim();
    const storyId  = m[4].trim();

    // Scan forward (up to 20 lines) for the export declare function signature
    let method = null;
    for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
      const fnMatch = DECLARE_FN.exec(lines[j].trim());
      if (fnMatch && fnMatch[1] === name) {
        method = { name: fnMatch[1], params: fnMatch[2].trim(), returnType: fnMatch[3].trim() };
        break;
      }
    }

    results.push({
      name,
      story:   storyId,
      kind:    type,      // UI / SVC / API / HTTP / etc.
      priority,
      methods: method ? [method] : [],
      _source: 'current-style',
    });
    i++;
  }

  return results;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * @param {string} projectRoot
 * @param {number} [iterNum=1]
 * @returns {{ apis, entities, views, enums, stories, sourceFile: string|null }}
 */
function collectContract(projectRoot, iterNum = 1) {
  const contractPath = findContractFile(projectRoot, iterNum);
  if (!contractPath) {
    return { apis: [], entities: [], views: [], enums: [], stories: [], sourceFile: null };
  }

  const content = fs.readFileSync(contractPath, 'utf8');

  // Run both parsers
  const parsed       = parseContract(content);
  const currentStyle = parseCurrentStyleContracts(content);

  // Merge: @GEMS-API entries take priority; current-style fills the gaps.
  // De-duplicate by name (prefer @GEMS-API if both exist).
  const gemsNames = new Set((parsed.apis || []).map(a => a.name));
  const mergedApis = [
    ...(parsed.apis || []),
    ...currentStyle.filter(a => !gemsNames.has(a.name)),
  ];

  return {
    apis:       mergedApis,
    entities:   parsed.entities  || [],
    views:      parsed.views     || [],
    enums:      parsed.enums     || [],
    stories:    parsed.stories   || [],
    sourceFile: contractPath,
  };
}

module.exports = { collectContract, parseCurrentStyleContracts };
