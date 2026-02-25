#!/usr/bin/env node
/**
 * 用 ExamForge 的真實 function-index.json 跑 STUB-001 偵測邏輯
 * 確認修正後的路徑 resolve 是否能找到檔案並偵測 stub
 */
const path = require('path');
const fs = require('fs');

const target = 'C:\\Users\\user\\Desktop\\SDID\\ExamForge';
const fnIndexPath = path.join(target, '.gems', 'docs', 'function-index.json');

if (!fs.existsSync(fnIndexPath)) {
  console.error('❌ function-index.json not found at:', fnIndexPath);
  process.exit(1);
}

const fnIndex = JSON.parse(fs.readFileSync(fnIndexPath, 'utf8'));

const STUB_PATTERNS = [
  /^\s*return\s*\[\s*\]\s*[;,]?\s*$/m,
  /^\s*return\s*\{\s*\}\s*[;,]?\s*$/m,
  /^\s*return\s*null\s*[;,]?\s*$/m,
  /^\s*return\s*undefined\s*[;,]?\s*$/m,
  /^\s*\/\/\s*TODO/mi,
  /throw\s+new\s+Error\s*\(\s*['"`]not\s+implemented/mi,
  /throw\s+new\s+Error\s*\(\s*['"`]stub/mi,
];

let smallFns = 0, stubs = 0, fileNotFound = 0, checked = 0;
const stubList = [];

for (const [filePath, functions] of Object.entries(fnIndex.byFile || {})) {
  for (const fn of functions) {
    const lines = fn.lines || '';
    if (!lines) continue;
    const [startLine, endLine] = lines.split('-').map(Number);
    const size = endLine - startLine;
    if (size > 5) continue;
    smallFns++;

    // 修正後的路徑解析
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(target, filePath.replace(/\\/g, '/'));

    if (!fs.existsSync(resolvedPath)) {
      fileNotFound++;
      if (fileNotFound <= 3) console.log('  ⚠ Not found:', resolvedPath);
      continue;
    }
    checked++;

    const fileContent = fs.readFileSync(resolvedPath, 'utf8');
    const fileLines = fileContent.split('\n');
    const fnBody = fileLines.slice(Math.max(0, startLine - 1), endLine).join('\n');

    const nonTagLines = fnBody.split('\n').filter(l =>
      l.trim() && !/^\s*\/\/\s*\[STEP/.test(l) && !/^\s*\/\*/.test(l) && !/^\s*\*/.test(l)
    );
    if (nonTagLines.length <= 2) {
      const isStub = STUB_PATTERNS.some(p => p.test(fnBody)) || nonTagLines.length <= 1;
      if (isStub) {
        stubs++;
        stubList.push(`${fn.name} (${fn.priority || 'P?'}, ${size}L, ${path.basename(filePath)})`);
      }
    }
  }
}

console.log('=== STUB-001 Live Test (ExamForge) ===\n');
console.log('Small fns scanned (size<=5):', smallFns);
console.log('Files not found:', fileNotFound);
console.log('Files checked:', checked);
console.log('Stubs detected:', stubs);

if (stubList.length > 0) {
  console.log('\n偵測到的 STUB 函數:');
  stubList.forEach(s => console.log(' ', s));
} else {
  console.log('\n⚠ 未偵測到任何 stub（可能所有小函數都已實作）');
}
