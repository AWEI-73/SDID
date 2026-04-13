'use strict';

const assert = require('assert');
const path = require('path');

const {
  parseDraft,
  checkDraft,
  detectStructureReadiness,
} = require(path.join(__dirname, '..', 'blueprint', 'v5', 'draft-gate.cjs'));

function testTableStyleDraftPassesStructureReadiness() {
  const raw = 'table draft';
  const parsed = {
    actions: [
      {
        type: 'UI',
        techName: 'GanttV5Topbar',
        priority: 'P1',
        flow: 'RENDER->STYLE',
      },
    ],
  };
  const structure = detectStructureReadiness(parsed, raw);
  assert.equal(structure.ok, true);
  assert.equal(structure.mode, 'table-actions');
}

function testModuleActionsStylePassesStructureReadiness() {
  const raw = [
    '**餈凋誨**: iter-2',
    '**璅∠?**: auth',
    '**?格?**: module-actions style',
    '',
    '## Module Actions',
    '- module: Auth',
    '- publicAPI: login, logout',
    '- deps: shared/auth',
    '- features: session, refresh',
  ].join('\n');

  const parsed = parseDraft(raw);
  const structure = detectStructureReadiness(parsed, raw);
  assert.equal(structure.ok, true);
  assert.equal(structure.mode, 'module-actions');
}

function testCheckDraftEmitsHelpfulStructureBlocker() {
  const raw = 'broken structure draft';
  const parsed = {
    iterNum: 3,
    module: 'broken-structure',
    goal: 'missing usable structure info',
    deps: '',
    storyStrategy: '',
    apiSummary: [],
    acDefs: [],
    actions: [
      {
        desc: 'broken row',
        type: 'UI',
        techName: '',
        signature: '(props) => JSX.Element',
        priority: 'P1',
        flow: '',
        deps: 'none',
        ac: 'false',
      },
    ],
  };
  const result = checkDraft(parsed, raw, null);
  const codes = result.blockers.map((b) => b.code);
  assert(codes.includes('DR-040'), 'expected DR-040 blocker');
}

function main() {
  testTableStyleDraftPassesStructureReadiness();
  testModuleActionsStylePassesStructureReadiness();
  testCheckDraftEmitsHelpfulStructureBlocker();
  console.log('test-draft-gate-structure-readiness: 3 passed');
}

main();
