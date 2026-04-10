'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { collectStructure } = require(path.join(__dirname, '..', 'lib', 'scan', 'collect-structure.cjs'));

function withTempDraft(content, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'collect-structure-'));
  const draftPath = path.join(dir, 'draft_iter-14.md');
  fs.writeFileSync(draftPath, content, 'utf8');
  try {
    run(draftPath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testScopeMatrixFallbackProducesModules() {
  const draft = [
    '# Draft iter-14: Gantt Efficiency Pass',
    '',
    '**Iteration**: iter-14',
    '**Module**: gantt-efficiency-pass',
    '**Goal**: Improve gantt usability.',
    '',
    '## Scope Matrix',
    '',
    '| Slice | Domain | Target | Output | Priority | Flow | Dependency | TDD |',
    '|------|------|--------|------|--------|------|------|-----|',
    '| Story-14.0 safe offset | UI | GanttV5Grid + GanttArtifact | timeline-safe rendering | P1 | RESERVE -> SHIFT | gantt-layout, GanttArtifact | [TDD] |',
    '| Story-14.1 owner filter | UI/HOOK | GanttV5Topbar + useGanttV5Data | owner-filter chips | P1 | BUILD -> FILTER | useGanttV5Data | [TDD] |',
  ].join('\n');

  withTempDraft(draft, (draftPath) => {
    const structure = collectStructure(draftPath);
    const names = structure.modules.map((module) => module.name);

    assert(names.includes('GanttV5Grid'));
    assert(names.includes('GanttArtifact'));
    assert(names.includes('GanttV5Topbar'));
    assert(names.includes('useGanttV5Data'));

    const gridModule = structure.modules.find((module) => module.name === 'GanttV5Grid');
    assert.equal(gridModule.fillLevel, 'table');
    assert(gridModule.features.some((feature) => /safe offset/i.test(feature)));
    assert(gridModule.deps.includes('gantt-layout'));
  });
}

function testExplicitModuleActionsSectionProducesModules() {
  const draft = [
    '# Draft iter-14: Gantt Efficiency Pass',
    '',
    '**Iteration**: iter-14',
    '**Module**: gantt-efficiency-pass',
    '**Goal**: Improve gantt usability.',
    '',
    '## Module Actions',
    '',
    '### GanttV5Grid',
    '- layer: presentation',
    '- desc: Reserve a safe timeline lane before rendering task bars.',
    '- publicAPI: GanttV5Grid',
    '- deps: gantt-layout, MilestoneTimelineMarkers',
    '- features: reserve-safe-offset, shift-timeline',
  ].join('\n');

  withTempDraft(draft, (draftPath) => {
    const structure = collectStructure(draftPath);
    assert.equal(structure.modules.length, 1);
    assert.equal(structure.modules[0].name, 'GanttV5Grid');
    assert.equal(structure.modules[0].fillLevel, 'explicit');
    assert(structure.modules[0].publicAPI.includes('GanttV5Grid'));
  });
}

function main() {
  testScopeMatrixFallbackProducesModules();
  testExplicitModuleActionsSectionProducesModules();
  console.log('test-collect-structure: 2 passed');
}

main();
