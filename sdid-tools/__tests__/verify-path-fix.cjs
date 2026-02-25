#!/usr/bin/env node
/**
 * STUB-001 路徑修正驗證腳本
 * 確認 function-index.json 的相對路徑可以正確被 resolve
 */
const path = require('path');

// target = ExamForge 專案根目錄（BUILD 時傳入的 --target）
const target = 'C:\\Users\\user\\Desktop\\SDID\\ExamForge';

// function-index.json 實際存的格式："..\ExamForge\src\..."（含 .. 相對路徑）
const actualRelPath = '..\\ExamForge\\src\\modules\\exam_engine\\components\\online-exam-viewer.tsx';

// ---- OLD 邏輯（有 bug）----
const absPathOld = path.isAbsolute(actualRelPath)
  ? actualRelPath
  : path.join(target, actualRelPath.replace(/^[A-Za-z]:\\.*?\\src\\/, 'src/').replace(/\\/g, '/'));

// ---- NEW 邏輯（修正後）----
const resolvedPathNew = path.isAbsolute(actualRelPath)
  ? actualRelPath
  : path.resolve(target, actualRelPath.replace(/\\/g, '/'));

console.log('=== STUB-001 路徑修正驗證 ===\n');
console.log('target      :', target);
console.log('filePath    :', actualRelPath);
console.log('');
console.log('OLD 結果    :', absPathOld);
const oldOk = absPathOld.endsWith('online-exam-viewer.tsx') && !absPathOld.includes('\\..\\');
console.log('  → 正確?', oldOk ? '✅ YES' : '❌ NO（包含 ..）');

console.log('');
console.log('NEW 結果    :', resolvedPathNew);
const newOk = resolvedPathNew.endsWith('online-exam-viewer.tsx') && path.isAbsolute(resolvedPathNew) && !resolvedPathNew.includes('..');
console.log('  → 正確?', newOk ? '✅ YES' : '❌ NO');

// 絕對路徑保持不變
const absolutePath = 'C:\\Users\\user\\Desktop\\SDID\\ExamForge\\src\\modules\\auth\\auth.service.ts';
const resolvedAbs = path.isAbsolute(absolutePath)
  ? absolutePath
  : path.resolve(target, absolutePath.replace(/\\/g, '/'));
console.log('\n--- 絕對路徑保持不變 ---');
console.log('resolved    :', resolvedAbs);
console.log('  → 相同?', absolutePath === resolvedAbs ? '✅ YES' : '❌ NO');
