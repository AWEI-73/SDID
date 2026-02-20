#!/usr/bin/env node
// -*- coding: utf-8 -*-

/**
 * SDID Health Report v1.0
 * 
 * 事後分析工具 — 掃描所有專案的 logs + project-memory，
 * 產出系統級改善建議。
 * 
 * 資料來源:
 *   1. .gems/iterations/iter-X/logs/ (log 檔名解析)
 *   2. .gems/project-memory.json (結構化記錄)
 * 
 * 分析維度:
 *   - 熱點分析: 哪個 phase/step 失敗最多
 *   - 重試成本: 每個 Story 平均重試幾次才 PASS
 *   - WARNING 追蹤: 非嚴格門控的累積趨勢
 *   - 跨專案模式: 多個專案共同的痛點 → 系統改善建議
 * 
 * 用法:
 *   node task-pipe/tools/health-report.cjs --target=todo-app
 *   node task-pipe/tools/health-report.cjs --all
 *   node task-pipe/tools/health-report.cjs --all --json
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CLI 參數解析
// ============================================
const args = process.argv.slice(2);
const flags = {};
for (const arg of args) {
  if (arg.startsWith('--')) {
    const [key, val] = arg.slice(2).split('=');
    flags[key] = val || true;
  }
}

const targetProject = flags.target || null;
const scanAll = flags.all || false;
const jsonOutput = flags.json || false;
const verbose = flags.verbose || false;
const injectMode = flags.inject || false;

// ============================================
// Log 檔名解析器
// ============================================

/**
 * 從 log 檔名解析結構化資訊
 * 
 * 格式範例:
 *   build-phase-2-Story-1.0-fix-2026-02-14T10-44-10.log
 *   gate-check-error-2026-02-13T17-16-41.log
 *   poc-step-1-fix-2026-02-14T14-17-17.log
 *   scan-scan-pass-2026-02-13T17-03-46.log
 */
function parseLogFileName(filename) {
  const base = filename.replace('.log', '');
  
  // 嘗試匹配 build-phase-N-Story-X.Y-type-timestamp
  const buildMatch = base.match(
    /^(build)-phase-(\d+)-(Story-[\d.]+)-([a-z-]+)-(\d{4}-\d{2}-\d{2}T[\d-]+)$/
  );
  if (buildMatch) {
    return {
      engine: 'task-pipe',
      phase: 'BUILD',
      step: buildMatch[2],
      story: buildMatch[3],
      type: normalizeType(buildMatch[4]),
      timestamp: buildMatch[5],
      raw: filename
    };
  }

  // gate-xxx-type-timestamp (sdid-tools)
  const gateMatch = base.match(
    /^(gate)-([a-z]+)-([a-z]+)-(\d{4}-\d{2}-\d{2}T[\d-]+)$/
  );
  if (gateMatch) {
    return {
      engine: 'sdid-tools',
      phase: 'GATE',
      step: gateMatch[2],  // check, plan, shrink, expand, verify
      story: null,
      type: normalizeType(gateMatch[3]),
      timestamp: gateMatch[4],
      raw: filename
    };
  }

  // poc-step-N-type-timestamp
  const pocMatch = base.match(
    /^(poc)-step-(\d+)-([a-z-]+)-(\d{4}-\d{2}-\d{2}T[\d-]+)$/
  );
  if (pocMatch) {
    return {
      engine: 'task-pipe',
      phase: 'POC',
      step: pocMatch[2],
      story: null,
      type: normalizeType(pocMatch[3]),
      timestamp: pocMatch[4],
      raw: filename
    };
  }

  // plan-step-N-Story-X.Y-type-timestamp
  const planMatch = base.match(
    /^(plan)-step-(\d+)-(Story-[\d.]+)-([a-z-]+)-(\d{4}-\d{2}-\d{2}T[\d-]+)$/
  );
  if (planMatch) {
    return {
      engine: 'task-pipe',
      phase: 'PLAN',
      step: planMatch[2],
      story: planMatch[3],
      type: normalizeType(planMatch[4]),
      timestamp: planMatch[5],
      raw: filename
    };
  }

  // scan-scan-type-timestamp
  const scanMatch = base.match(
    /^(scan)-scan-([a-z-]+)-(\d{4}-\d{2}-\d{2}T[\d-]+)$/
  );
  if (scanMatch) {
    return {
      engine: 'task-pipe',
      phase: 'SCAN',
      step: 'scan',
      story: null,
      type: normalizeType(scanMatch[2]),
      timestamp: scanMatch[3],
      raw: filename
    };
  }

  // 無法解析
  return null;
}

/**
 * 正規化 log type → verdict 分類
 */
function normalizeType(rawType) {
  if (rawType === 'pass') return 'PASS';
  if (rawType === 'error' || rawType === 'error-spec') return 'ERROR';
  if (rawType === 'fix') return 'FIX';
  if (rawType === 'template') return 'TEMPLATE';
  if (rawType === 'info') return 'INFO';
  if (rawType === 'pending') return 'PENDING';
  if (rawType === 'test-pass') return 'TEST_PASS';
  if (rawType === 'test-fail') return 'TEST_FAIL';
  if (rawType === 'smoke-test') return 'SMOKE_TEST';
  if (rawType.includes('error')) return 'ERROR';
  if (rawType.includes('warn')) return 'WARNING';
  return rawType.toUpperCase();
}

// ============================================
// 專案掃描
// ============================================

/**
 * 掃描單一專案的所有 iteration logs
 */
function scanProject(projectRoot) {
  const gemsDir = path.join(projectRoot, '.gems', 'iterations');
  if (!fs.existsSync(gemsDir)) return null;

  const projectName = path.basename(path.resolve(projectRoot));
  const result = {
    project: projectName,
    path: projectRoot,
    iterations: [],
    logs: [],
    memory: null,
    stats: null
  };

  // 讀取 project-memory.json
  const memPath = path.join(projectRoot, '.gems', 'project-memory.json');
  if (fs.existsSync(memPath)) {
    try {
      result.memory = JSON.parse(fs.readFileSync(memPath, 'utf8'));
    } catch (e) { /* 忽略 */ }
  }

  // 掃描每個 iteration 的 logs
  const iters = fs.readdirSync(gemsDir).filter(d => d.startsWith('iter-'));
  for (const iter of iters) {
    result.iterations.push(iter);
    const logsDir = path.join(gemsDir, iter, 'logs');
    if (!fs.existsSync(logsDir)) continue;

    const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
    for (const logFile of logFiles) {
      const parsed = parseLogFileName(logFile);
      if (parsed) {
        parsed.iteration = iter;
        parsed.project = projectName;
        result.logs.push(parsed);
      }
    }
  }

  // 計算統計
  result.stats = computeStats(result.logs);
  return result;
}

// ============================================
// 統計分析
// ============================================

/**
 * 計算單一專案的統計
 */
function computeStats(logs) {
  if (logs.length === 0) return { total: 0, byVerdict: {}, byPhaseStep: {}, hotspots: [], retryCost: {}, warnings: [], storyEfficiency: {} };

  const stats = {
    total: logs.length,
    byVerdict: {},
    byPhaseStep: {},
    hotspots: [],
    retryCost: {},
    warnings: [],
    storyEfficiency: {}
  };

  // 1. 按 verdict 分類
  for (const log of logs) {
    stats.byVerdict[log.type] = (stats.byVerdict[log.type] || 0) + 1;
  }

  // 2. 按 phase+step 分類 (只計算 ERROR/FIX 類)
  const errorTypes = ['ERROR', 'FIX', 'TEST_FAIL', 'FILEPATH_ERROR', 'FLOW_STEP_ERROR'];
  for (const log of logs) {
    if (!errorTypes.includes(log.type) && !log.type.includes('ERROR')) continue;
    const key = `${log.phase}-${log.step}`;
    if (!stats.byPhaseStep[key]) {
      stats.byPhaseStep[key] = { count: 0, stories: new Set(), types: {} };
    }
    stats.byPhaseStep[key].count++;
    if (log.story) stats.byPhaseStep[key].stories.add(log.story);
    stats.byPhaseStep[key].types[log.type] = (stats.byPhaseStep[key].types[log.type] || 0) + 1;
  }

  // 3. 熱點排序 (失敗次數最多的 phase+step)
  stats.hotspots = Object.entries(stats.byPhaseStep)
    .map(([key, val]) => ({
      phaseStep: key,
      errorCount: val.count,
      affectedStories: val.stories.size,
      errorTypes: val.types
    }))
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, 10);

  // 4. Story 效率 (每個 Story 的 error/pass 比)
  const storyLogs = {};
  for (const log of logs) {
    if (!log.story) continue;
    if (!storyLogs[log.story]) storyLogs[log.story] = { errors: 0, passes: 0, total: 0 };
    storyLogs[log.story].total++;
    if (log.type === 'PASS' || log.type === 'TEST_PASS') {
      storyLogs[log.story].passes++;
    } else if (errorTypes.includes(log.type) || log.type.includes('ERROR')) {
      storyLogs[log.story].errors++;
    }
  }
  stats.storyEfficiency = {};
  for (const [story, data] of Object.entries(storyLogs)) {
    stats.storyEfficiency[story] = {
      ...data,
      retryRatio: data.errors > 0 ? (data.errors / (data.passes || 1)).toFixed(2) : '0'
    };
  }

  // 5. WARNING / TEMPLATE / PENDING 追蹤 (非嚴格門控)
  const softTypes = ['TEMPLATE', 'PENDING', 'INFO', 'WARNING'];
  for (const log of logs) {
    if (softTypes.includes(log.type)) {
      stats.warnings.push({
        phaseStep: `${log.phase}-${log.step}`,
        type: log.type,
        story: log.story,
        iteration: log.iteration,
        timestamp: log.timestamp
      });
    }
  }

  // 序列化 Set
  for (const val of Object.values(stats.byPhaseStep)) {
    val.stories = [...val.stories];
  }

  return stats;
}

// ============================================
// 跨專案分析
// ============================================

/**
 * 跨專案彙總分析
 */
function crossProjectAnalysis(projectResults) {
  const cross = {
    totalProjects: projectResults.length,
    totalLogs: 0,
    globalHotspots: {},
    systemRecommendations: [],
    warningTrends: {}
  };

  // 彙總所有專案的 hotspot
  for (const proj of projectResults) {
    if (!proj.stats) continue;
    cross.totalLogs += proj.stats.total;

    for (const hotspot of proj.stats.hotspots) {
      const key = hotspot.phaseStep;
      if (!cross.globalHotspots[key]) {
        cross.globalHotspots[key] = { totalErrors: 0, projects: [], errorTypes: {} };
      }
      cross.globalHotspots[key].totalErrors += hotspot.errorCount;
      cross.globalHotspots[key].projects.push(proj.project);
      for (const [t, c] of Object.entries(hotspot.errorTypes)) {
        cross.globalHotspots[key].errorTypes[t] = (cross.globalHotspots[key].errorTypes[t] || 0) + c;
      }
    }

    // WARNING 趨勢
    for (const w of (proj.stats.warnings || [])) {
      const key = `${w.phaseStep}:${w.type}`;
      if (!cross.warningTrends[key]) {
        cross.warningTrends[key] = { count: 0, projects: new Set() };
      }
      cross.warningTrends[key].count++;
      cross.warningTrends[key].projects.add(proj.project);
    }
  }

  // 產出系統改善建議
  const sortedHotspots = Object.entries(cross.globalHotspots)
    .sort((a, b) => b[1].totalErrors - a[1].totalErrors);

  for (const [phaseStep, data] of sortedHotspots) {
    if (data.totalErrors < 3) continue; // 至少 3 次才算有意義
    const projectCount = data.projects.length;
    const uniqueProjects = [...new Set(data.projects)];

    let severity = 'LOW';
    let recommendation = '';

    if (uniqueProjects.length >= 3) {
      severity = 'HIGH';
      recommendation = `系統性問題: ${phaseStep} 在 ${uniqueProjects.length} 個專案都失敗。建議檢查該 Gate 的驗證邏輯或 AI 引導品質。`;
    } else if (data.totalErrors >= 5) {
      severity = 'MEDIUM';
      recommendation = `高頻失敗: ${phaseStep} 累計 ${data.totalErrors} 次錯誤。建議加強 @HINT 或改善 emitFix 的範例品質。`;
    } else {
      recommendation = `偶發問題: ${phaseStep} 有 ${data.totalErrors} 次錯誤，持續觀察。`;
    }

    // 特定 phase 的具體建議
    const specificAdvice = getSpecificAdvice(phaseStep, data);
    if (specificAdvice) recommendation += ' ' + specificAdvice;

    cross.systemRecommendations.push({
      phaseStep,
      severity,
      totalErrors: data.totalErrors,
      affectedProjects: uniqueProjects,
      errorTypes: data.errorTypes,
      recommendation
    });
  }

  // WARNING 趨勢建議 (只看 PENDING/WARNING，不看 INFO/TEMPLATE)
  const upgradeableTypes = ['PENDING', 'WARNING'];
  for (const [key, data] of Object.entries(cross.warningTrends)) {
    data.projects = [...data.projects];
    const eventType = key.split(':')[1];
    if (!upgradeableTypes.includes(eventType)) continue;
    if (data.count >= 3 && data.projects.length >= 2) {
      cross.systemRecommendations.push({
        phaseStep: key.split(':')[0],
        severity: 'UPGRADE_CANDIDATE',
        totalErrors: data.count,
        affectedProjects: data.projects,
        errorTypes: { [key.split(':')[1]]: data.count },
        recommendation: `WARNING→BLOCKER 升級候選: ${key} 在 ${data.projects.length} 個專案出現 ${data.count} 次。考慮將此檢查從 WARNING 升級為 BLOCKER。`
      });
    }
  }

  // 按嚴重度排序
  const severityOrder = { HIGH: 0, UPGRADE_CANDIDATE: 1, MEDIUM: 2, LOW: 3 };
  cross.systemRecommendations.sort((a, b) =>
    (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
  );

  return cross;
}

/**
 * 針對特定 phase/step 的具體改善建議
 */
function getSpecificAdvice(phaseStep, data) {
  const adviceMap = {
    'BUILD-1': '骨架檢查失敗通常是 scaffold 不完整。考慮在 PLAN 階段加入 scaffold 驗證。',
    'BUILD-2': '標籤驗收是最常見的失敗點。檢查 emitFix 的 GEMS 標籤範例是否夠清楚。',
    'BUILD-4': 'Test Gate 失敗通常是測試檔案 import 錯誤。考慮在 Phase 3 加入 import 路徑驗證。',
    'BUILD-5': 'TDD 測試失敗。檢查 Phase 3 產出的測試模板品質。',
    'GATE-check': 'Blueprint Gate 失敗。檢查 Enhanced Draft 模板的引導是否足夠。',
    'POC-1': 'POC 模糊消除失敗。requirement_draft 的格式引導可能需要加強。'
  };
  return adviceMap[phaseStep] || null;
}

// ============================================
// 輸出格式化
// ============================================

function formatReport(projectResults, crossAnalysis) {
  const lines = [];
  const hr = '─'.repeat(60);

  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════╗');
  lines.push('║           SDID Health Report v1.0                       ║');
  lines.push('╚══════════════════════════════════════════════════════════╝');
  lines.push('');

  // 總覽
  lines.push(`📊 掃描 ${crossAnalysis.totalProjects} 個專案 | ${crossAnalysis.totalLogs} 筆 log`);
  lines.push(hr);

  // 每個專案的摘要
  for (const proj of projectResults) {
    if (!proj.stats || proj.stats.total === 0) continue;
    lines.push('');
    lines.push(`📁 ${proj.project} (${proj.iterations.length} iterations, ${proj.stats.total} logs)`);

    // Verdict 分佈
    const verdicts = Object.entries(proj.stats.byVerdict)
      .map(([k, v]) => `${k}:${v}`)
      .join(' | ');
    lines.push(`   分佈: ${verdicts}`);

    // 熱點
    if (proj.stats.hotspots.length > 0) {
      lines.push('   🔥 熱點:');
      for (const h of proj.stats.hotspots.slice(0, 3)) {
        const types = Object.entries(h.errorTypes).map(([k, v]) => `${k}×${v}`).join(', ');
        lines.push(`      ${h.phaseStep}: ${h.errorCount} 次錯誤 (${types})`);
      }
    }

    // Story 效率
    const inefficient = Object.entries(proj.stats.storyEfficiency)
      .filter(([_, d]) => parseFloat(d.retryRatio) > 1.0)
      .sort((a, b) => parseFloat(b[1].retryRatio) - parseFloat(a[1].retryRatio));
    if (inefficient.length > 0) {
      lines.push('   ⚡ 高重試 Story:');
      for (const [story, data] of inefficient.slice(0, 3)) {
        lines.push(`      ${story}: ${data.errors}E/${data.passes}P (重試比 ${data.retryRatio})`);
      }
    }

    // WARNING 數量
    if (proj.stats.warnings.length > 0) {
      lines.push(`   ⚠️  非嚴格門控事件: ${proj.stats.warnings.length} 筆`);
    }
  }

  // 跨專案系統建議
  if (crossAnalysis.systemRecommendations.length > 0) {
    lines.push('');
    lines.push(hr);
    lines.push('🏥 系統改善建議 (跨專案分析)');
    lines.push(hr);

    for (const rec of crossAnalysis.systemRecommendations) {
      const icon = rec.severity === 'HIGH' ? '🔴' :
                   rec.severity === 'UPGRADE_CANDIDATE' ? '🟡' :
                   rec.severity === 'MEDIUM' ? '🟠' : '⚪';
      lines.push('');
      lines.push(`${icon} [${rec.severity}] ${rec.phaseStep}`);
      lines.push(`   累計: ${rec.totalErrors} 次 | 影響: ${rec.affectedProjects.join(', ')}`);
      lines.push(`   建議: ${rec.recommendation}`);
    }
  } else {
    lines.push('');
    lines.push('✅ 無跨專案系統性問題');
  }

  lines.push('');
  lines.push(hr);
  lines.push(`報告產出時間: ${new Date().toISOString()}`);
  lines.push('');

  return lines.join('\n');
}

// ============================================
// 自動偵測 workspace 中的專案
// ============================================

function findProjects(workspaceRoot) {
  const projects = [];
  const entries = fs.readdirSync(workspaceRoot);
  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const fullPath = path.join(workspaceRoot, entry);
    if (!fs.statSync(fullPath).isDirectory()) continue;
    const gemsDir = path.join(fullPath, '.gems', 'iterations');
    if (fs.existsSync(gemsDir)) {
      projects.push(fullPath);
    }
  }
  return projects;
}

// ============================================
// --inject: 注入 HIGH 建議到 project-memory
// ============================================

/**
 * 把跨專案分析的 HIGH/UPGRADE_CANDIDATE 建議注入到各專案的 knownPitfalls
 * 
 * @param {Array} projectResults - scanProject 結果
 * @param {object} crossAnalysis - crossProjectAnalysis 結果
 * @returns {{ injected: number, skipped: number, projects: string[] }}
 */
function injectToMemory(projectResults, crossAnalysis) {
  const { loadMemory, saveMemory } = require('../lib/shared/project-memory.cjs');
  
  const injectableRecs = crossAnalysis.systemRecommendations
    .filter(r => r.severity === 'HIGH' || r.severity === 'UPGRADE_CANDIDATE');
  
  if (injectableRecs.length === 0) {
    return { injected: 0, skipped: 0, projects: [] };
  }

  let totalInjected = 0;
  let totalSkipped = 0;
  const affectedProjects = new Set();

  for (const proj of projectResults) {
    // 找出影響此專案的建議
    const relevantRecs = injectableRecs.filter(r => 
      r.affectedProjects.includes(proj.project)
    );
    if (relevantRecs.length === 0) continue;

    const memory = loadMemory(proj.path);
    if (!memory.summary.knownPitfalls) {
      memory.summary.knownPitfalls = [];
    }

    for (const rec of relevantRecs) {
      // 格式: "[HEALTH] BUILD-2: 標籤驗收系統性失敗 (30次/7專案)"
      const pitfall = `[HEALTH] ${rec.phaseStep}: ${rec.severity === 'UPGRADE_CANDIDATE' ? 'WARNING→BLOCKER 升級候選' : '系統性失敗'} (${rec.totalErrors}次/${rec.affectedProjects.length}專案)`;
      
      // 去重
      const exists = memory.summary.knownPitfalls.some(p => 
        p.startsWith(`[HEALTH] ${rec.phaseStep}:`)
      );
      
      if (exists) {
        totalSkipped++;
        continue;
      }

      memory.summary.knownPitfalls.push(pitfall);
      totalInjected++;
      affectedProjects.add(proj.project);
    }

    // 保持 pitfall 上限 (10 個)
    if (memory.summary.knownPitfalls.length > 10) {
      // 優先保留 [HEALTH] 開頭的，刪舊的非 HEALTH
      const healthPitfalls = memory.summary.knownPitfalls.filter(p => p.startsWith('[HEALTH]'));
      const otherPitfalls = memory.summary.knownPitfalls.filter(p => !p.startsWith('[HEALTH]'));
      memory.summary.knownPitfalls = [
        ...otherPitfalls.slice(-(10 - healthPitfalls.length)),
        ...healthPitfalls
      ].slice(-10);
    }

    saveMemory(proj.path, memory);
  }

  return { injected: totalInjected, skipped: totalSkipped, projects: [...affectedProjects] };
}

// ============================================
// Main
// ============================================

function main() {
  const workspaceRoot = process.cwd();
  let projectPaths = [];

  if (targetProject) {
    const resolved = path.resolve(workspaceRoot, targetProject);
    if (!fs.existsSync(resolved)) {
      console.error(`❌ 專案不存在: ${resolved}`);
      process.exit(1);
    }
    projectPaths = [resolved];
  } else if (scanAll) {
    projectPaths = findProjects(workspaceRoot);
    if (projectPaths.length === 0) {
      console.error('❌ 找不到任何有 .gems/iterations/ 的專案');
      process.exit(1);
    }
  } else {
    // 預設: 當前目錄
    const gemsDir = path.join(workspaceRoot, '.gems', 'iterations');
    if (fs.existsSync(gemsDir)) {
      projectPaths = [workspaceRoot];
    } else {
      // 嘗試掃描子目錄
      projectPaths = findProjects(workspaceRoot);
    }
    if (projectPaths.length === 0) {
      console.error('❌ 找不到 .gems/iterations/。用 --target=<path> 或 --all');
      process.exit(1);
    }
  }

  // 掃描所有專案
  const projectResults = [];
  for (const pp of projectPaths) {
    const result = scanProject(pp);
    if (result) projectResults.push(result);
  }

  // 跨專案分析
  const crossAnalysis = crossProjectAnalysis(projectResults);

  // 輸出
  if (jsonOutput) {
    const output = {
      generatedAt: new Date().toISOString(),
      projects: projectResults.map(p => ({
        ...p,
        memory: p.memory ? { summary: p.memory.summary, totalEntries: (p.memory.entries || []).length } : null
      })),
      crossAnalysis: {
        ...crossAnalysis,
        globalHotspots: undefined // 太大，用 recommendations 就好
      }
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(formatReport(projectResults, crossAnalysis));
  }

  // --inject: 注入 HIGH 建議到 project-memory
  if (injectMode) {
    const injectResult = injectToMemory(projectResults, crossAnalysis);
    if (injectResult.injected > 0) {
      console.log(`\n💉 Inject: ${injectResult.injected} 筆 pitfall 注入到 ${injectResult.projects.join(', ')}`);
    } else if (injectResult.skipped > 0) {
      console.log(`\n💉 Inject: 全部已存在 (${injectResult.skipped} 筆跳過)`);
    } else {
      console.log('\n💉 Inject: 無 HIGH/UPGRADE_CANDIDATE 建議需要注入');
    }
  }
}

main();
