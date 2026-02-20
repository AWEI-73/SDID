#!/usr/bin/env node
/**
 * GEMS Index MCP Server
 * 
 * 提供函式索引查詢工具，讓 AI 可以：
 * 1. 查詢函式位置 (行號)
 * 2. 取得 FLOW 約束
 * 3. 取得 DEPS 邊界
 * 
 * 用法:
 *   npx @anthropic/mcp-server-stdio node task-pipe/mcp/gems-index-server.cjs
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ==============================================
// 索引載入
// ==============================================

let functionsIndex = null;
let functionIndex = null;

function loadIndex(projectPath = '.') {
  const docsPath = path.join(projectPath, '.gems', 'docs');
  
  const functionsPath = path.join(docsPath, 'functions.json');
  const indexPath = path.join(docsPath, 'function-index.json');
  
  if (fs.existsSync(functionsPath)) {
    functionsIndex = JSON.parse(fs.readFileSync(functionsPath, 'utf8'));
  }
  
  if (fs.existsSync(indexPath)) {
    functionIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  }
  
  return { functionsIndex, functionIndex };
}

// ==============================================
// 工具定義
// ==============================================

const tools = {
  // 查詢函式位置
  gems_find_function: {
    description: '查詢函式的檔案位置和行號範圍',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '函式名稱' },
        projectPath: { type: 'string', description: '專案路徑', default: '.' }
      },
      required: ['name']
    },
    handler: (args) => {
      loadIndex(args.projectPath || '.');
      
      if (!functionsIndex) {
        return { error: '索引不存在，請先執行 SCAN' };
      }
      
      const func = functionsIndex.functions.find(
        f => f.name.toLowerCase() === args.name.toLowerCase()
      );
      
      if (!func) {
        return { error: `找不到函式: ${args.name}` };
      }
      
      return {
        name: func.name,
        file: func.file,
        startLine: func.startLine,
        endLine: func.endLine,
        lines: func.lines,
        priority: func.priority || func.risk,
        flow: func.flow,
        deps: func.deps,
        depsRisk: func.depsRisk,
        storyId: func.storyId,
        readCommand: `讀取 ${func.file} 的第 ${func.startLine} 到 ${func.endLine} 行`
      };
    }
  },
  
  // 列出檔案中的函式
  gems_list_functions_in_file: {
    description: '列出指定檔案中的所有函式',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: '檔案路徑 (部分匹配)' },
        projectPath: { type: 'string', description: '專案路徑', default: '.' }
      },
      required: ['file']
    },
    handler: (args) => {
      loadIndex(args.projectPath || '.');
      
      if (!functionIndex) {
        return { error: '索引不存在，請先執行 SCAN' };
      }
      
      const results = [];
      for (const [filePath, funcs] of Object.entries(functionIndex.byFile)) {
        if (filePath.toLowerCase().includes(args.file.toLowerCase())) {
          results.push({
            file: filePath,
            functions: funcs
          });
        }
      }
      
      return results.length > 0 ? results : { error: `找不到檔案: ${args.file}` };
    }
  },
  
  // 列出 Story 的函式
  gems_list_functions_by_story: {
    description: '列出指定 Story 的所有函式',
    inputSchema: {
      type: 'object',
      properties: {
        storyId: { type: 'string', description: 'Story ID (如 Story-1.0)' },
        projectPath: { type: 'string', description: '專案路徑', default: '.' }
      },
      required: ['storyId']
    },
    handler: (args) => {
      loadIndex(args.projectPath || '.');
      
      if (!functionIndex) {
        return { error: '索引不存在，請先執行 SCAN' };
      }
      
      const funcs = functionIndex.byStory[args.storyId];
      
      if (!funcs) {
        return { error: `找不到 Story: ${args.storyId}` };
      }
      
      // 取得完整資訊
      const details = funcs.map(name => {
        const func = functionsIndex.functions.find(f => f.name === name);
        return func ? {
          name: func.name,
          file: func.file,
          lines: `${func.startLine}-${func.endLine}`,
          priority: func.priority || func.risk
        } : { name };
      });
      
      return {
        storyId: args.storyId,
        count: funcs.length,
        functions: details
      };
    }
  },
  
  // 列出 P0 函式
  gems_list_critical_functions: {
    description: '列出所有 P0 (核心) 函式',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: '專案路徑', default: '.' }
      }
    },
    handler: (args) => {
      loadIndex(args.projectPath || '.');
      
      if (!functionIndex) {
        return { error: '索引不存在，請先執行 SCAN' };
      }
      
      const p0Funcs = functionIndex.byPriority.P0 || [];
      
      const details = p0Funcs.map(name => {
        const func = functionsIndex.functions.find(f => f.name === name);
        return func ? {
          name: func.name,
          file: func.file,
          lines: `${func.startLine}-${func.endLine}`,
          flow: func.flow,
          depsRisk: func.depsRisk
        } : { name };
      });
      
      return {
        count: p0Funcs.length,
        functions: details,
        warning: 'P0 函式是核心邏輯，修改需謹慎'
      };
    }
  }
};

// ==============================================
// MCP Protocol Handler
// ==============================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function sendResponse(id, result) {
  const response = {
    jsonrpc: '2.0',
    id,
    result
  };
  console.log(JSON.stringify(response));
}

function sendError(id, code, message) {
  const response = {
    jsonrpc: '2.0',
    id,
    error: { code, message }
  };
  console.log(JSON.stringify(response));
}

rl.on('line', (line) => {
  try {
    const request = JSON.parse(line);
    const { id, method, params } = request;
    
    switch (method) {
      case 'initialize':
        sendResponse(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'gems-index-server',
            version: '1.0.0'
          }
        });
        break;
        
      case 'tools/list':
        sendResponse(id, {
          tools: Object.entries(tools).map(([name, tool]) => ({
            name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        });
        break;
        
      case 'tools/call':
        const toolName = params.name;
        const tool = tools[toolName];
        
        if (!tool) {
          sendError(id, -32601, `Unknown tool: ${toolName}`);
          break;
        }
        
        try {
          const result = tool.handler(params.arguments || {});
          sendResponse(id, {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          });
        } catch (e) {
          sendError(id, -32000, e.message);
        }
        break;
        
      default:
        sendError(id, -32601, `Unknown method: ${method}`);
    }
  } catch (e) {
    // Ignore parse errors
  }
});

// 啟動訊息
console.error('[gems-index-server] Started');
