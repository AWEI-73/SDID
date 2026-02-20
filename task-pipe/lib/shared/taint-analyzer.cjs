#!/usr/bin/env node
/**
 * Taint Analyzer v1.0 - 染色分析 (依賴圖計算)
 * 
 * 核心功能：
 * 1. 解析 GEMS-DEPS 標籤建立依賴圖
 * 2. 當檔案被修改時，計算「受影響範圍」
 * 3. 支援多層傳播 (A→B→C)
 * 
 * 使用場景：
 * - 修改 P0 函式後，找出所有依賴它的檔案
 * - 一次性驗證時，決定要驗證哪些檔案
 * - 整合測試時，擴展測試範圍
 */

const fs = require('fs');

// ============================================
// 依賴圖結構
// ============================================

/**
 * 建立空的依賴圖
 */
function createDependencyGraph() {
  return {
    version: '1.0',
    generatedAt: null,
    // 節點: { [funcName]: { file, priority, deps: [], dependents: [] } }
    nodes: {},
    // 檔案索引: { [file]: [funcName, ...] }
    fileIndex: {},
    // 統計
    stats: {
      totalFunctions: 0,
      totalEdges: 0,
      maxDepth: 0
    }
  };
}

/**
 * 從 functions.json 建立依賴圖
 * @param {string} functionsJsonPath - functions.json 路徑
 * @returns {Object} 依賴圖
 */
function buildDependencyGraph(functionsJsonPath) {
  const graph = createDependencyGraph();
  graph.generatedAt = new Date().toISOString();

  if (!fs.existsSync(functionsJsonPath)) {
    console.warn(`[taint-analyzer] functions.json not found: ${functionsJsonPath}`);
    return graph;
  }

  const data = JSON.parse(fs.readFileSync(functionsJsonPath, 'utf8'));
  const functions = data.functions || [];

  // 第一遍：建立所有節點
  for (const func of functions) {
    const key = `${func.file}:${func.name}`;
    graph.nodes[key] = {
      name: func.name,
      file: func.file,
      priority: func.priority,
      startLine: func.startLine,
      endLine: func.endLine,
      deps: [],        // 我依賴誰
      dependents: [],  // 誰依賴我
      storyId: func.storyId
    };

    // 建立檔案索引
    if (!graph.fileIndex[func.file]) {
      graph.fileIndex[func.file] = [];
    }
    graph.fileIndex[func.file].push(func.name);

    graph.stats.totalFunctions++;
  }

  // 第二遍：解析 GEMS-DEPS 建立邊
  for (const func of functions) {
    if (!func.deps) continue;

    const sourceKey = `${func.file}:${func.name}`;
    const deps = parseDepsString(func.deps);

    for (const dep of deps) {
      // 找到目標節點
      const targetKey = findNodeByName(graph, dep.name, func.file);
      if (targetKey && graph.nodes[targetKey]) {
        // 建立雙向連結
        graph.nodes[sourceKey].deps.push({
          target: targetKey,
          type: dep.type,
          description: dep.description
        });
        graph.nodes[targetKey].dependents.push({
          source: sourceKey,
          type: dep.type
        });
        graph.stats.totalEdges++;
      }
    }
  }

  // 計算最大深度
  graph.stats.maxDepth = calculateMaxDepth(graph);

  return graph;
}

/**
 * 解析 GEMS-DEPS 字串
 * 格式: "[Type.Name (說明)], [Type.Name]"
 */
function parseDepsString(depsStr) {
  if (!depsStr) return [];

  const deps = [];
  // 匹配 [Type.Name (說明)] 或 [Type.Name]
  const regex = /\[([^\]]+)\]/g;
  let match;

  while ((match = regex.exec(depsStr)) !== null) {
    const content = match[1].trim();
    // 解析 Type.Name (說明)
    const descMatch = content.match(/^([^(]+?)(?:\s*\(([^)]+)\))?$/);
    if (descMatch) {
      const fullName = descMatch[1].trim();
      const description = descMatch[2] || '';
      
      // 分離 Type.Name
      const parts = fullName.split('.');
      const type = parts.length > 1 ? parts[0] : 'Unknown';
      const name = parts.length > 1 ? parts.slice(1).join('.') : fullName;

      deps.push({ type, name, fullName, description });
    }
  }

  return deps;
}

/**
 * 根據名稱找節點 (支援模糊匹配)
 */
function findNodeByName(graph, name, currentFile) {
  // 精確匹配
  for (const key of Object.keys(graph.nodes)) {
    if (graph.nodes[key].name === name) {
      return key;
    }
  }

  // 同檔案優先
  const sameFileKey = `${currentFile}:${name}`;
  if (graph.nodes[sameFileKey]) {
    return sameFileKey;
  }

  return null;
}

/**
 * 計算圖的最大深度 (BFS)
 */
function calculateMaxDepth(graph) {
  let maxDepth = 0;

  for (const key of Object.keys(graph.nodes)) {
    const depth = getNodeDepth(graph, key, new Set());
    if (depth > maxDepth) maxDepth = depth;
  }

  return maxDepth;
}

function getNodeDepth(graph, nodeKey, visited) {
  if (visited.has(nodeKey)) return 0;
  visited.add(nodeKey);

  const node = graph.nodes[nodeKey];
  if (!node || node.deps.length === 0) return 0;

  let maxChildDepth = 0;
  for (const dep of node.deps) {
    const childDepth = getNodeDepth(graph, dep.target, visited);
    if (childDepth > maxChildDepth) maxChildDepth = childDepth;
  }

  return maxChildDepth + 1;
}

// ============================================
// 染色分析核心
// ============================================

/**
 * 分析修改影響範圍 (Taint Analysis)
 * @param {Object} graph - 依賴圖
 * @param {string[]} changedFiles - 被修改的檔案列表
 * @param {Object} options - 選項
 * @returns {Object} 影響分析結果
 */
function analyzeImpact(graph, changedFiles, options = {}) {
  const {
    maxDepth = 3,           // 最大傳播深度
    includeSelf = true,     // 是否包含自身
    priorityFilter = null   // 只分析特定優先級 (e.g., ['P0', 'P1'])
  } = options;

  const result = {
    changedFiles,
    changedFunctions: [],   // 直接被修改的函式
    affectedFunctions: [],  // 受影響的函式 (依賴者)
    affectedFiles: [],      // 受影響的檔案
    propagationChains: [],  // 傳播鏈 (用於 debug)
    stats: {
      directChanges: 0,
      indirectAffected: 0,
      totalAffected: 0,
      maxPropagationDepth: 0
    }
  };

  // 1. 找出被修改檔案中的所有函式
  for (const file of changedFiles) {
    const funcs = graph.fileIndex[file] || [];
    for (const funcName of funcs) {
      const key = `${file}:${funcName}`;
      if (graph.nodes[key]) {
        const node = graph.nodes[key];
        
        // 優先級過濾
        if (priorityFilter && !priorityFilter.includes(node.priority)) {
          continue;
        }

        result.changedFunctions.push({
          key,
          name: funcName,
          file,
          priority: node.priority
        });
        result.stats.directChanges++;
      }
    }
  }

  // 2. BFS 傳播：找出所有依賴這些函式的函式
  const visited = new Set();
  const queue = result.changedFunctions.map(f => ({ ...f, depth: 0, chain: [f.key] }));

  while (queue.length > 0) {
    const current = queue.shift();
    
    if (visited.has(current.key)) continue;
    visited.add(current.key);

    const node = graph.nodes[current.key];
    if (!node) continue;

    // 找所有依賴此節點的函式 (dependents)
    for (const dependent of node.dependents) {
      const depNode = graph.nodes[dependent.source];
      if (!depNode || visited.has(dependent.source)) continue;

      // 深度限制
      if (current.depth >= maxDepth) continue;

      const newChain = [...current.chain, dependent.source];
      
      result.affectedFunctions.push({
        key: dependent.source,
        name: depNode.name,
        file: depNode.file,
        priority: depNode.priority,
        affectedBy: current.key,
        depth: current.depth + 1,
        chain: newChain
      });

      result.propagationChains.push({
        from: current.key,
        to: dependent.source,
        depth: current.depth + 1
      });

      // 繼續傳播
      queue.push({
        key: dependent.source,
        name: depNode.name,
        file: depNode.file,
        priority: depNode.priority,
        depth: current.depth + 1,
        chain: newChain
      });

      result.stats.indirectAffected++;
      if (current.depth + 1 > result.stats.maxPropagationDepth) {
        result.stats.maxPropagationDepth = current.depth + 1;
      }
    }
  }

  // 3. 彙整受影響的檔案
  const affectedFileSet = new Set();
  if (includeSelf) {
    changedFiles.forEach(f => affectedFileSet.add(f));
  }
  result.affectedFunctions.forEach(f => affectedFileSet.add(f.file));
  result.affectedFiles = Array.from(affectedFileSet);

  result.stats.totalAffected = result.stats.directChanges + result.stats.indirectAffected;

  return result;
}

/**
 * 產生驗證隊列 (給 incremental-validator 用)
 * @param {Object} impactResult - analyzeImpact 的結果
 * @returns {Object[]} 驗證隊列
 */
function generateValidationQueue(impactResult) {
  const queue = [];
  const seen = new Set();

  // 直接修改的函式 - 高優先級
  for (const func of impactResult.changedFunctions) {
    if (seen.has(func.key)) continue;
    seen.add(func.key);

    queue.push({
      key: func.key,
      file: func.file,
      name: func.name,
      priority: func.priority,
      validationType: 'direct',  // 直接修改
      validationScope: ['tags', 'tests', 'integration'],
      urgency: 'high'
    });
  }

  // 受影響的函式 - 根據深度決定優先級
  for (const func of impactResult.affectedFunctions) {
    if (seen.has(func.key)) continue;
    seen.add(func.key);

    queue.push({
      key: func.key,
      file: func.file,
      name: func.name,
      priority: func.priority,
      validationType: 'affected',  // 間接影響
      affectedBy: func.affectedBy,
      depth: func.depth,
      validationScope: func.depth <= 1 ? ['tests', 'integration'] : ['integration'],
      urgency: func.depth <= 1 ? 'medium' : 'low'
    });
  }

  // 按優先級排序
  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  queue.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return queue;
}

/**
 * 產生 AI 可讀的影響報告
 */
function generateImpactReport(impactResult) {
  const { changedFiles, changedFunctions, affectedFunctions, affectedFiles, stats } = impactResult;

  let report = `@TAINT_ANALYSIS
### 影響範圍分析

**修改的檔案**: ${changedFiles.length} 個
${changedFiles.map(f => `- ${f}`).join('\n')}

**直接修改的函式**: ${stats.directChanges} 個
${changedFunctions.map(f => `- ${f.name} (${f.priority}) @ ${f.file}`).join('\n')}

**間接受影響**: ${stats.indirectAffected} 個
`;

  if (affectedFunctions.length > 0) {
    report += `
**受影響的函式** (依深度排序):
`;
    // 按深度分組
    const byDepth = {};
    for (const f of affectedFunctions) {
      if (!byDepth[f.depth]) byDepth[f.depth] = [];
      byDepth[f.depth].push(f);
    }

    for (const depth of Object.keys(byDepth).sort()) {
      report += `\n  Depth ${depth}:\n`;
      for (const f of byDepth[depth]) {
        report += `  - ${f.name} (${f.priority}) ← 受 ${f.affectedBy.split(':')[1]} 影響\n`;
      }
    }
  }

  report += `
**需要驗證的檔案**: ${affectedFiles.length} 個
${affectedFiles.map(f => `- ${f}`).join('\n')}

**統計**:
- 最大傳播深度: ${stats.maxPropagationDepth}
- 總影響範圍: ${stats.totalAffected} 個函式
`;

  return report;
}

// ============================================
// CLI
// ============================================

if (require.main === module) {
  const args = process.argv.slice(2);
  
  // 解析參數
  let functionsJson = null;
  let changedFiles = [];
  let maxDepth = 3;

  for (const arg of args) {
    if (arg.startsWith('--functions=')) {
      functionsJson = arg.split('=')[1];
    } else if (arg.startsWith('--changed=')) {
      changedFiles = arg.split('=')[1].split(',');
    } else if (arg.startsWith('--depth=')) {
      maxDepth = parseInt(arg.split('=')[1]);
    }
  }

  if (!functionsJson) {
    console.log(`
🔍 Taint Analyzer v1.0 - 染色分析

用法:
  node taint-analyzer.cjs --functions=<path> --changed=<files> [--depth=N]

參數:
  --functions=<path>  functions.json 路徑
  --changed=<files>   被修改的檔案 (逗號分隔)
  --depth=N           最大傳播深度 (預設: 3)

範例:
  node taint-analyzer.cjs --functions=.gems/docs/functions.json --changed=src/core/auth.ts
`);
    process.exit(0);
  }

  console.log(`\n🔍 Taint Analyzer v1.0`);
  console.log(`   Functions: ${functionsJson}`);
  console.log(`   Changed: ${changedFiles.join(', ')}`);
  console.log(`   Max Depth: ${maxDepth}`);

  // 建立依賴圖
  const graph = buildDependencyGraph(functionsJson);
  console.log(`\n📊 依賴圖統計:`);
  console.log(`   函式數: ${graph.stats.totalFunctions}`);
  console.log(`   依賴邊: ${graph.stats.totalEdges}`);
  console.log(`   最大深度: ${graph.stats.maxDepth}`);

  // 分析影響
  if (changedFiles.length > 0) {
    const impact = analyzeImpact(graph, changedFiles, { maxDepth });
    console.log(generateImpactReport(impact));

    // 產生驗證隊列
    const queue = generateValidationQueue(impact);
    console.log(`\n📋 驗證隊列 (${queue.length} 項):`);
    queue.slice(0, 10).forEach((item, i) => {
      console.log(`   ${i + 1}. [${item.urgency}] ${item.name} (${item.validationType})`);
    });
  }
}

module.exports = {
  createDependencyGraph,
  buildDependencyGraph,
  parseDepsString,
  analyzeImpact,
  generateValidationQueue,
  generateImpactReport
};
