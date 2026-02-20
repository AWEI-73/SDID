#!/usr/bin/env node
/**
 * Socratic Question Generator - 純 JavaScript 版本
 * 
 * 基於 BlueMouse 的 knowledge_base.json (70 個精心設計的問題)
 * 完全用 JS 實現，不需要 Python，不需要外部依賴
 * 
 * 功能：
 * 1. 關鍵字匹配 (28 個領域)
 * 2. 自動生成領域專家問題
 * 3. 多語言支援 (zh-TW / en-US)
 * 4. 降級策略 (知識庫 → 通用問題)
 */
const fs = require('fs');
const path = require('path');

// 載入知識庫
let KB = null;
let INVERTED_INDEX = {};

function loadKnowledgeBase() {
  try {
    const kbPath = path.join(__dirname, 'knowledge_base.json');
    if (!fs.existsSync(kbPath)) {
      console.log('[Socratic] knowledge_base.json 不存在，使用內建問題');
      return false;
    }

    KB = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));

    // 建立倒排索引 (關鍵字 → 模組)
    INVERTED_INDEX = {};
    for (const [moduleName, moduleData] of Object.entries(KB.modules)) {
      const keywords = moduleData.keywords || [];
      for (const keyword of keywords) {
        if (!INVERTED_INDEX[keyword.toLowerCase()]) {
          INVERTED_INDEX[keyword.toLowerCase()] = [];
        }
        INVERTED_INDEX[keyword.toLowerCase()].push(moduleName);
      }
    }

    console.log(`[Socratic] 知識庫載入成功: ${Object.keys(KB.modules).length} 個模組`);
    return true;
  } catch (err) {
    console.log(`[Socratic] 知識庫載入失敗: ${err.message}`);
    return false;
  }
}

/**
 * 生成蘇格拉底問題
 * 
 * @param {string} requirement - 需求描述
 * @param {string} language - 語言 (zh-TW / en-US)
 * @returns {object} 問題列表
 */
function generateSocraticQuestions(requirement, language = 'zh-TW') {
  // 確保知識庫已載入
  if (!KB) {
    const loaded = loadKnowledgeBase();
    if (!loaded) {
      return getFallbackQuestions(requirement, language);
    }
  }

  // 1. 關鍵字匹配
  const matchedModules = searchByKeywords(requirement);

  if (matchedModules.length === 0) {
    console.log('[Socratic] 未匹配到特定領域，使用通用問題');
    return getFallbackQuestions(requirement, language);
  }

  // 2. 提取問題
  const questions = [];
  const seenIds = new Set();

  for (const moduleName of matchedModules) {
    const moduleData = KB.modules[moduleName];
    if (!moduleData || !moduleData.questions) continue;

    for (const q of moduleData.questions) {
      if (seenIds.has(q.id)) continue;
      seenIds.add(q.id);

      // 本地化問題
      const localizedQ = localizeQuestion(q, language);
      questions.push(localizedQ);
    }
  }

  if (questions.length === 0) {
    return getFallbackQuestions(requirement, language);
  }

  return {
    questions,
    matchedDomains: matchedModules,
    source: 'knowledge_base',
    totalModules: Object.keys(KB.modules).length
  };
}

/**
 * 關鍵字搜尋
 */
function searchByKeywords(requirement) {
  const reqLower = requirement.toLowerCase();
  const matched = new Set();

  // 搜尋倒排索引
  for (const [keyword, modules] of Object.entries(INVERTED_INDEX)) {
    if (reqLower.includes(keyword)) {
      modules.forEach(m => matched.add(m));
    }
  }

  return Array.from(matched);
}

/**
 * 本地化問題
 */
function localizeQuestion(question, language) {
  const q = JSON.parse(JSON.stringify(question)); // Deep clone

  // 解析語言（支援 en-US → en）
  const lang = language.startsWith('en') ? 'en' : language;

  // 本地化 text
  if (typeof q.text === 'object') {
    q.text = q.text[lang] || q.text['zh-TW'] || q.text['en'] || '';
  }

  // 本地化 options
  if (q.options && Array.isArray(q.options)) {
    q.options = q.options.map(opt => {
      const localizedOpt = { ...opt };

      if (typeof opt.label === 'object') {
        localizedOpt.label = opt.label[lang] || opt.label['zh-TW'] || opt.label['en'] || '';
      }

      if (typeof opt.description === 'object') {
        localizedOpt.description = opt.description[lang] || opt.description['zh-TW'] || opt.description['en'] || '';
      }

      if (typeof opt.risk_score === 'object') {
        localizedOpt.risk_score = opt.risk_score[lang] || opt.risk_score['zh-TW'] || opt.risk_score['en'] || '';
      }

      return localizedOpt;
    });
  }

  return q;
}

/**
 * 降級方案：通用問題
 */
function getFallbackQuestions(requirement, language) {
  const isZhTW = language === 'zh-TW';

  const questions = [];

  // Q1: 並發處理
  questions.push({
    id: 'fallback_concurrency',
    type: 'single_choice',
    text: isZhTW
      ? '如果多個用戶同時操作同一筆資料，如何處理？'
      : 'How to handle concurrent operations on the same data?',
    options: [
      {
        label: isZhTW ? 'A. 樂觀鎖 (Optimistic Lock)' : 'A. Optimistic Lock',
        description: isZhTW
          ? '假設衝突很少，只在提交時檢查。效能好但可能失敗。'
          : 'Assume conflicts are rare, check only on commit. Good performance but may fail.',
        risk_score: isZhTW ? '衝突時需重試' : 'Retry on conflict',
        value: 'optimistic'
      },
      {
        label: isZhTW ? 'B. 悲觀鎖 (Pessimistic Lock)' : 'B. Pessimistic Lock',
        description: isZhTW
          ? '操作前先鎖定資料。安全但效能差。'
          : 'Lock data before operation. Safe but slower.',
        risk_score: isZhTW ? '效能瓶頸' : 'Performance bottleneck',
        value: 'pessimistic'
      },
      {
        label: isZhTW ? 'C. 隊列處理 (Queue)' : 'C. Queue Processing',
        description: isZhTW
          ? '所有操作進入隊列依序處理。最安全但延遲高。'
          : 'All operations queued. Safest but high latency.',
        risk_score: isZhTW ? '用戶等待時間長' : 'High user wait time',
        value: 'queue'
      }
    ]
  });

  // Q2: 錯誤處理
  questions.push({
    id: 'fallback_error_handling',
    type: 'single_choice',
    text: isZhTW
      ? '當操作失敗時（如網路中斷、資料庫錯誤），如何處理？'
      : 'How to handle operation failures (network, database errors)?',
    options: [
      {
        label: isZhTW ? 'A. 立即回滾 (Rollback)' : 'A. Immediate Rollback',
        description: isZhTW
          ? '失敗就取消，保證資料一致性。'
          : 'Cancel on failure, ensure data consistency.',
        risk_score: isZhTW ? '交易成功率低' : 'Low success rate',
        value: 'rollback'
      },
      {
        label: isZhTW ? 'B. 自動重試 (Retry)' : 'B. Auto Retry',
        description: isZhTW
          ? '失敗後自動重試 3 次。可能重複執行。'
          : 'Retry 3 times on failure. May duplicate.',
        risk_score: isZhTW ? '重複執行風險' : 'Duplication risk',
        value: 'retry'
      },
      {
        label: isZhTW ? 'C. 人工介入 (Manual)' : 'C. Manual Intervention',
        description: isZhTW
          ? '標記為待處理，由客服人工處理。'
          : 'Mark as pending, manual handling by support.',
        risk_score: isZhTW ? '營運成本高' : 'High operational cost',
        value: 'manual'
      }
    ]
  });

  // Q3: 資料驗證
  questions.push({
    id: 'fallback_validation',
    type: 'single_choice',
    text: isZhTW
      ? '對於用戶輸入的資料，如何驗證？'
      : 'How to validate user input data?',
    options: [
      {
        label: isZhTW ? 'A. 前端驗證' : 'A. Frontend Validation',
        description: isZhTW
          ? '在瀏覽器端驗證。快速但不安全（可被繞過）。'
          : 'Validate in browser. Fast but insecure (can be bypassed).',
        risk_score: isZhTW ? '安全風險' : 'Security risk',
        value: 'frontend'
      },
      {
        label: isZhTW ? 'B. 後端驗證' : 'B. Backend Validation',
        description: isZhTW
          ? '在伺服器端驗證。安全但增加延遲。'
          : 'Validate on server. Secure but adds latency.',
        risk_score: isZhTW ? '效能折損' : 'Performance cost',
        value: 'backend'
      },
      {
        label: isZhTW ? 'C. 雙重驗證' : 'C. Double Validation',
        description: isZhTW
          ? '前後端都驗證。最安全但開發成本高。'
          : 'Validate both sides. Safest but high dev cost.',
        risk_score: isZhTW ? '開發成本高' : 'High dev cost',
        value: 'both'
      }
    ]
  });

  return {
    questions,
    source: 'fallback',
    note: isZhTW
      ? '這是通用問題。安裝完整知識庫可獲得更精準的領域專家問題。'
      : 'These are generic questions. Install full knowledge base for domain-specific expert questions.'
  };
}

/**
 * 格式化輸出（用於 CLI）
 */
function formatQuestionsForCLI(result) {
  let output = '\n=== 🧠 蘇格拉底邏輯預檢 ===\n\n';

  if (result.matchedDomains && result.matchedDomains.length > 0) {
    output += `檢測到領域: ${result.matchedDomains.join(', ')}\n\n`;
  }

  result.questions.forEach((q, idx) => {
    output += `${idx + 1}. ${q.text}\n\n`;

    if (q.options) {
      q.options.forEach(opt => {
        output += `   ${opt.label}\n`;
        if (opt.description) {
          output += `      ${opt.description}\n`;
        }
        if (opt.risk_score) {
          output += `      風險: ${opt.risk_score}\n`;
        }
        output += '\n';
      });
    }
  });

  if (result.note) {
    output += `💡 ${result.note}\n`;
  }

  output += '===================\n';

  return output;
}

// 自我測試
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('用法: node socratic-generator.cjs "<需求描述>" [語言]');
    console.log('範例: node socratic-generator.cjs "建立一個電商平台" zh-TW');
    process.exit(1);
  }

  const requirement = args[0];
  const language = args[1] || 'zh-TW';

  console.log(`\n需求: ${requirement}`);
  console.log(`語言: ${language}\n`);

  const result = generateSocraticQuestions(requirement, language);

  console.log(formatQuestionsForCLI(result));

  // 輸出 JSON（供程式使用）
  if (args.includes('--json')) {
    console.log('\n=== JSON 輸出 ===\n');
    console.log(JSON.stringify(result, null, 2));
  }
}

module.exports = {
  generateSocraticQuestions,
  formatQuestionsForCLI,
  loadKnowledgeBase
};
