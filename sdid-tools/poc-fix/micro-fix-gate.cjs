#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = { changed: [], target: null, iter: null, help: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--changed=')) {
      args.changed = arg.split('=').slice(1).join('=').split(',').map((file) => file.trim()).filter(Boolean);
    } else if (arg.startsWith('--target=')) {
      args.target = path.resolve(arg.split('=').slice(1).join('='));
    } else if (arg.startsWith('--iter=')) {
      args.iter = arg.split('=').slice(1).join('=');
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  return args;
}

function writeGateLog(projectRoot, status, content, changedFiles) {
  if (!projectRoot) return null;
  const gemsDir = path.join(projectRoot, '.gems');
  if (!fs.existsSync(gemsDir)) return null;

  const logsDir = path.join(gemsDir, 'logs');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `microfix-${status}-${ts}.log`;
  const filePath = path.join(logsDir, filename);
  const header = [
    'mode: MICRO-FIX',
    `changed: ${(changedFiles || []).join(', ') || '(auto-scan)'}`,
    `result: ${status.toUpperCase()}`,
    `ts: ${new Date().toISOString()}`,
    '---',
    '',
  ].join('\n');

  fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(filePath, header + content, 'utf8');
  return path.relative(projectRoot, filePath);
}

function hasGemsTag(content) {
  return /GEMS[:\s]/i.test(content);
}

function checkFileTags(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileHasGems = hasGemsTag(content);
  const exportPattern = /^export\s+(?:async\s+)?(?:function|const|class|interface|enum|type)\s+(\w+)/;
  const exports = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(exportPattern);
    if (match) {
      exports.push({ name: match[1], line: i + 1 });
    }
  }

  if (exports.length === 0) {
    return { ok: true, missing: [] };
  }

  const missing = [];
  for (const exp of exports) {
    const searchStart = Math.max(0, exp.line - 20);
    const before = lines.slice(searchStart, exp.line - 1).join('\n');
    if (hasGemsTag(before)) continue;

    const line = lines[exp.line - 1] || '';
    const isHelper = fileHasGems && /^(?:get|set|is|has|to|from)[A-Z]/.test(exp.name);
    const isTypeDecl = /^export\s+(?:type|interface|enum)\s+/.test(line);
    if (!isHelper && !isTypeDecl) {
      missing.push(exp.name);
    }
  }

  return { ok: missing.length === 0, missing };
}

function resolveImport(dir, importPath) {
  const cleanPath = importPath.replace(/\.js$/, '');
  const base = path.resolve(dir, cleanPath);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || `${base}.ts`;
}

function checkImports(filePath, projectRoot) {
  const content = fs.readFileSync(filePath, 'utf8');
  const dir = path.dirname(filePath);
  const issues = [];
  const importPattern = /(?:import|require)\s*(?:\{[^}]*\}|[\w*]+)?\s*(?:from\s*)?['"](\.[^'"]+)['"]/g;
  let match;

  while ((match = importPattern.exec(content)) !== null) {
    const resolved = resolveImport(dir, match[1]);
    if (resolved && !fs.existsSync(resolved)) {
      issues.push({ import: match[1], expected: path.relative(projectRoot, resolved) });
    }
  }

  return issues;
}

function findSourceFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', 'dist', '__tests__', '.gems'].includes(entry.name)) {
      findSourceFiles(fullPath, files);
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
      files.push(fullPath);
    }
  }
  return files;
}

function getFilesToCheck(projectRoot, changed) {
  if (changed.length === 0) {
    return findSourceFiles(path.join(projectRoot, 'src'));
  }

  return changed
    .map((file) => {
      if (path.isAbsolute(file)) return file;
      const fromCwd = path.resolve(process.cwd(), file);
      if (fs.existsSync(fromCwd)) return fromCwd;
      return path.resolve(projectRoot, file);
    })
    .filter((file) => fs.existsSync(file) && /\.(ts|tsx|js|jsx)$/.test(file) && !file.includes('.test.'));
}

function printHelp() {
  console.log(`
Micro-Fix Gate

Usage:
  node sdid-tools/poc-fix/micro-fix-gate.cjs --changed=src/foo.ts,src/bar.ts --target=<project>
  node sdid-tools/poc-fix/micro-fix-gate.cjs --target=<project>

Checks:
  1. Exported code has nearby GEMS tags
  2. Relative imports resolve correctly

Note:
  This gate does not require decision-log entries.
`);
}

function main() {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const projectRoot = args.target || process.cwd();
  const filesToCheck = getFilesToCheck(projectRoot, args.changed);

  if (filesToCheck.length === 0) {
    console.log('@PASS | micro-fix-gate | no source files to validate');
    process.exit(0);
  }

  console.log(`\n[Micro-Fix Gate] scanning ${filesToCheck.length} files...\n`);

  const tagIssues = [];
  for (const file of filesToCheck) {
    const result = checkFileTags(file);
    if (!result.ok) {
      tagIssues.push({ file: path.relative(projectRoot, file), missing: result.missing });
    }
  }

  const importIssues = [];
  for (const file of filesToCheck) {
    const issues = checkImports(file, projectRoot);
    if (issues.length > 0) {
      importIssues.push({ file: path.relative(projectRoot, file), broken: issues });
    }
  }

  const hasIssues = tagIssues.length > 0 || importIssues.length > 0;
  if (!hasIssues) {
    console.log(`@PASS | micro-fix-gate | ${filesToCheck.length} files passed`);
    console.log('  ✓ GEMS tags: OK');
    console.log('  ✓ Import integration: OK');
    writeGateLog(projectRoot, 'pass', `${filesToCheck.length} files passed`, args.changed);
    console.log('');
    process.exit(0);
  }

  const changedArg = args.changed.length > 0 ? ` --changed=${args.changed.join(',')}` : '';
  const targetArg = args.target ? ` --target=${path.relative(process.cwd(), args.target) || '.'}` : '';
  const iterArg = args.iter ? ` --iter=${args.iter}` : '';
  const nextCmd = `node sdid-tools/poc-fix/micro-fix-gate.cjs${changedArg}${targetArg}${iterArg}`;

  const summary = [
    tagIssues.length > 0 ? `missing GEMS tags in ${tagIssues.length} files` : '',
    importIssues.length > 0 ? `broken imports in ${importIssues.length} files` : '',
  ].filter(Boolean).join(', ');

  const detailLines = [`@BLOCKER | micro-fix-gate | ${summary}`, ''];
  if (tagIssues.length > 0) {
    detailLines.push(`GEMS tag issues (${tagIssues.length} files):`);
    for (const issue of tagIssues) {
      detailLines.push(`  ${issue.file}`);
      for (const name of issue.missing) {
        detailLines.push(`    - ${name}`);
      }
    }
    detailLines.push('');
  }
  if (importIssues.length > 0) {
    detailLines.push(`Import issues (${importIssues.length} files):`);
    for (const issue of importIssues) {
      detailLines.push(`  ${issue.file}`);
      for (const broken of issue.broken) {
        detailLines.push(`    - ${broken.import} -> ${broken.expected}`);
      }
    }
    detailLines.push('');
  }
  detailLines.push(`NEXT: ${nextCmd}`);

  const logPath = writeGateLog(projectRoot, 'error', detailLines.join('\n'), args.changed);
  console.log(`@BLOCKER | micro-fix-gate | ${summary}`);
  if (logPath) {
    console.log(`@READ: ${logPath}`);
  } else {
    detailLines.slice(1).forEach((line) => console.log(line));
  }
  console.log(`NEXT: ${nextCmd}`);
  console.log('');
  process.exit(1);
}

main();
