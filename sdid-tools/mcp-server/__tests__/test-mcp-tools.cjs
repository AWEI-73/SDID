#!/usr/bin/env node
'use strict';

const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const { pathToFileURL } = require('url');
const os = require('os');
const path = require('path');
const fs = require('fs');

const execFileAsync = promisify(execFile);

const TOOLS_DIR = path.resolve(__dirname, '..', '..');
const SERVER_FILE = path.resolve(__dirname, '..', 'index.mjs');
const ADAPTER_FILE = path.resolve(__dirname, '..', 'adapters', 'data-tools.mjs');
const RUNNERS_FILE = path.resolve(__dirname, '..', 'adapters', 'runners.mjs');

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, label, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`);
  }
  results.push({ label, ok: !!condition });
}

function section(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function legacyIndexNames() {
  return ['function-index-v2.json', 'function-index.json'];
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdid-mcp-scan-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, '.gems', 'iterations', 'iter-1'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'sdid-mcp-scan-fixture' }, null, 2));
  fs.writeFileSync(path.join(root, 'src', 'sample.js'), [
    '/** GEMS: sampleFunction | P0 | VALIDATE->RETURN | Story-1.1 | @TEST: src/sample.test.js | deps:[] */',
    'function sampleFunction(input) {',
    '  return input;',
    '}',
    '',
    'module.exports = { sampleFunction };',
    '',
  ].join('\n'));
  return root;
}

function assertNoLegacyIndexes(projectRoot, labelPrefix) {
  for (const name of legacyIndexNames()) {
    const docsPath = path.join(projectRoot, '.gems', 'docs', name);
    const rootPath = path.join(projectRoot, '.gems', name);
    assert(!fs.existsSync(docsPath), `${labelPrefix}: no .gems/docs/${name}`);
    assert(!fs.existsSync(rootPath), `${labelPrefix}: no .gems/${name}`);
  }
}

async function testMcpIndexLoads() {
  section('MCP index loads');

  try {
    await execFileAsync('node', ['--check', SERVER_FILE], { timeout: 30000 });
    assert(true, 'index.mjs passes node --check');
  } catch (err) {
    assert(false, 'index.mjs passes node --check', err.stderr || err.message);
  }

  const child = spawn('node', [SERVER_FILE], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });

  let stderr = '';
  child.stderr.on('data', d => { stderr += d.toString(); });
  await new Promise(resolve => setTimeout(resolve, 800));
  const exitCode = child.exitCode;
  child.kill('SIGTERM');

  assert(exitCode === null, 'MCP server starts without immediate crash', stderr.trim().slice(0, 500));
}

async function testScannerUsesCanonicalScan() {
  section('MCP scanner uses canonical SCAN');

  const adapterSrc = fs.readFileSync(ADAPTER_FILE, 'utf8');
  const runnersSrc = fs.readFileSync(RUNNERS_FILE, 'utf8');
  assert(adapterSrc.includes('runRunner'), 'sdid-scanner delegates to runner');
  assert(adapterSrc.includes('--phase=SCAN'), 'sdid-scanner passes canonical SCAN phase');
  assert(runnersSrc.includes('--phase=SCAN'), 'sdid-scan passes canonical SCAN phase');
  assert(!adapterSrc.includes('gems-scanner-v2'), 'sdid-scanner does not import legacy scanner');
  assert(!adapterSrc.includes('generateFunctionIndex'), 'sdid-scanner does not call legacy index generation');
  assert(!adapterSrc.includes('function-index'), 'sdid-scanner adapter does not reference legacy index outputs');

  const dataTools = await import(pathToFileURL(ADAPTER_FILE).href);
  const runners = await import(pathToFileURL(RUNNERS_FILE).href);
  assert(dataTools.scannerTool.schema.description.includes('.gems/docs/functions.json'), 'sdid-scanner schema documents canonical output');
  assert(runners.scan.schema.description.includes('.gems/docs/'), 'sdid-scan schema documents docs output');

  const projectRoot = makeFixture();
  assertNoLegacyIndexes(projectRoot, 'before SCAN');

  const scannerResult = await dataTools.scannerTool.handler({ project: projectRoot, iteration: 'iter-1' });
  const scannerText = scannerResult.content?.[0]?.text || '';
  assert(scannerText.includes('Canonical output: .gems/docs/functions.json'), 'sdid-scanner response names canonical output');
  assert(fs.existsSync(path.join(projectRoot, '.gems', 'docs', 'functions.json')), 'sdid-scanner produces .gems/docs/functions.json');
  assertNoLegacyIndexes(projectRoot, 'after sdid-scanner');

  fs.rmSync(path.join(projectRoot, '.gems', 'docs'), { recursive: true, force: true });
  const scanResult = await runners.scan.handler({ target: projectRoot, iteration: 'iter-1' });
  const scanText = scanResult.content?.[0]?.text || '';
  assert(scanText.includes('functions.json'), 'sdid-scan output references functions.json');
  assert(fs.existsSync(path.join(projectRoot, '.gems', 'docs', 'functions.json')), 'sdid-scan produces .gems/docs/functions.json');
  assertNoLegacyIndexes(projectRoot, 'after sdid-scan');
}

async function main() {
  console.log('\nSDID MCP Server Integration Tests');
  console.log(`Server: ${SERVER_FILE}`);
  console.log(`Time:   ${new Date().toISOString()}`);

  await testMcpIndexLoads();
  await testScannerUsesCanonicalScan();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\nFailures:');
    results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.label}`));
    process.exit(1);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
