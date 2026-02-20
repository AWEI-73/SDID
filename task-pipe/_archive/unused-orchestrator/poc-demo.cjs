#!/usr/bin/env node
/**
 * Task-Pipe Orchestrator POC
 * 
 * 這是一個概念驗證，展示 Orchestrator 如何運作
 * 
 * 執行方式:
 *   node task-pipe/orchestrator/poc-demo.cjs --target=my-project
 * 
 * 需要設定環境變數:
 *   ANTHROPIC_API_KEY=sk-ant-xxx
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// 1. 錨點解析器 - 從腳本輸出中提取結構化資料
// ============================================================

function parseAnchors(output) {
  const result = {
    context: null,
    task: null,
    template: null,
    output: null,
    nextCommand: null,
    status: 'unknown' // pass, fail, blocker
  };
  
  // 解析 @PASS
  if (output.includes('@PASS') || output.includes('✅ PASS')) {
    result.status = 'pass';
  }
  
  // 解析 @BLOCKER
  if (output.includes('@BLOCKER') || output.includes('❌ BLOCKER')) {
    result.status = 'blocker';
  }
  
  // 解析 @TACTICAL_FIX
  if (output.includes('@TACTICAL_FIX')) {
    result.status = 'fix';
  }
  
  // 解析 @CONTEXT 區塊
  const contextMatch = output.match(/@CONTEXT\s*\n([\s\S]*?)(?=@[A-Z]|$)/);
  if (contextMatch) {
    result.context = contextMatch[1].trim();
  }
  
  // 解析 @TASK 區塊
  const taskMatch = output.match(/@TASK\s*\n([\s\S]*?)(?=@[A-Z]|$)/);
  if (taskMatch) {
    result.task = taskMatch[1].trim();
  }
  
  // 解析 @TEMPLATE 區塊
  const templateMatch = output.match(/@TEMPLATE\s*\n([\s\S]*?)(?=@[A-Z]|$)/);
  if (templateMatch) {
    result.template = templateMatch[1].trim();
  }
  
  // 解析 @OUTPUT 區塊
  const outputMatch = output.match(/@OUTPUT\s*\n([\s\S]*?)(?=@[A-Z]|$)/);
  if (outputMatch) {
    result.output = outputMatch[1].trim();
  }
  
  // 解析「下一步」指令
  const nextMatch = output.match(/下一步[：:]\s*(node\s+[^\n]+)/);
  if (nextMatch) {
    result.nextCommand = nextMatch[1].trim();
  }
  
  return result;
}

// ============================================================
// 2. LLM 呼叫層 - 呼叫 Claude API
// ============================================================

async function callClaude(prompt, systemPrompt = '') {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.error('❌ 缺少 ANTHROPIC_API_KEY 環境變數');
    process.exit(1);
  }
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt || 'You are a senior software engineer. Follow the instructions precisely.',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }
  
  const data = await response.json();
  return data.content[0].text;
}

// ============================================================
// 3. 檔案寫入器 - 解析 AI 回應並寫入檔案
// ============================================================

function extractAndWriteFiles(response, projectRoot) {
  const files = [];
  
  // 匹配 ```language:path 或 ```language filepath 格式
  const codeBlockPattern = /```(\w+)(?::|[\s]+)([\w\/.\\-]+)\n([\s\S]*?)```/g;
  let match;
  
  while ((match = codeBlockPattern.exec(response)) !== null) {
    const [, language, filePath, content] = match;
    const fullPath = path.join(projectRoot, filePath);
    
    // 確保目錄存在
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 寫入檔案
    fs.writeFileSync(fullPath, content.trim(), 'utf8');
    files.push(filePath);
    console.log(`  📝 寫入: ${filePath}`);
  }
  
  return files;
}

// ============================================================
// 4. 主迴圈 - Orchestrator 核心
// ============================================================

async function runOrchestrator(target, options = {}) {
  const { maxSteps = 50, dryRun = false } = options;
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TASK-PIPE ORCHESTRATOR');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Target: ${target}`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // 初始指令
  let currentCommand = `node task-pipe/runner.cjs --phase=POC --step=0 --target=${target}`;
  let stepCount = 0;
  let retryCount = 0;
  const maxRetries = 3;
  
  while (currentCommand && stepCount < maxSteps) {
    stepCount++;
    console.log(`\n┌─────────────────────────────────────────────────────────────────`);
    console.log(`│ Step ${stepCount}: ${currentCommand}`);
    console.log(`└─────────────────────────────────────────────────────────────────\n`);
    
    // 1. 執行 runner.cjs
    let output;
    try {
      output = execSync(currentCommand, { 
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 30000
      });
    } catch (err) {
      output = err.stdout || err.message;
    }
    
    console.log('📋 Runner 輸出:');
    console.log(output.substring(0, 500) + (output.length > 500 ? '...' : ''));
    
    // 2. 解析錨點
    const anchors = parseAnchors(output);
    console.log(`\n🔍 解析結果: status=${anchors.status}, hasTask=${!!anchors.task}, nextCmd=${!!anchors.nextCommand}`);
    
    // 3. 根據狀態決定下一步
    if (anchors.status === 'pass') {
      console.log('✅ PASS - 進入下一步');
      retryCount = 0;
      
      if (anchors.nextCommand) {
        currentCommand = anchors.nextCommand;
      } else {
        console.log('🎉 流程完成！');
        break;
      }
    }
    else if (anchors.status === 'blocker') {
      console.log('❌ BLOCKER - 需要人類介入');
      break;
    }
    else if (anchors.task) {
      // 有任務需要執行
      console.log('📝 有任務需要執行，呼叫 Claude...');
      
      if (dryRun) {
        console.log('[DRY RUN] 跳過 API 呼叫');
        console.log('任務內容:', anchors.task.substring(0, 200));
        break;
      }
      
      // 組裝 prompt
      const prompt = [
        anchors.context ? `## Context\n${anchors.context}` : '',
        `## Task\n${anchors.task}`,
        anchors.template ? `## Template\n${anchors.template}` : '',
        anchors.output ? `## Expected Output\n${anchors.output}` : ''
      ].filter(Boolean).join('\n\n');
      
      try {
        const response = await callClaude(prompt);
        console.log('🤖 Claude 回應:', response.substring(0, 300) + '...');
        
        // 寫入檔案
        const files = extractAndWriteFiles(response, target);
        console.log(`📁 寫入 ${files.length} 個檔案`);
        
        // 重跑驗證 (不改變 currentCommand，讓它重跑同一步)
        retryCount++;
        if (retryCount >= maxRetries) {
          console.log(`⚠️ 重試 ${maxRetries} 次仍失敗，標記為 BLOCKER`);
          break;
        }
      } catch (err) {
        console.error('❌ Claude API 錯誤:', err.message);
        break;
      }
    }
    else {
      console.log('⚠️ 無法解析狀態，停止');
      break;
    }
    
    // 防止無限迴圈
    if (stepCount >= maxSteps) {
      console.log(`⚠️ 達到最大步數 ${maxSteps}，停止`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  完成！共執行 ${stepCount} 步`);
  console.log('═══════════════════════════════════════════════════════════════');
}

// ============================================================
// 5. CLI 入口
// ============================================================

const args = process.argv.slice(2);
const target = args.find(a => a.startsWith('--target='))?.split('=')[1] || '.';
const dryRun = args.includes('--dry-run');
const maxSteps = parseInt(args.find(a => a.startsWith('--max-steps='))?.split('=')[1] || '50');

runOrchestrator(target, { dryRun, maxSteps }).catch(console.error);
