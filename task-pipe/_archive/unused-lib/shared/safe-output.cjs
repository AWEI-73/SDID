/**
 * Safe Output - 防止終端機截斷的輸出工具
 * 
 * 問題: Cursor/Windsurf 等 IDE 的終端機會截斷長輸出
 * 解決: 分段輸出 + 檔案備份
 */

const fs = require('fs');
const path = require('path');

/**
 * 安全輸出（分段 + 檔案備份）
 * @param {string} content - 要輸出的內容
 * @param {object} options - 選項
 * @param {string} options.outputFile - 備份檔案路徑（可選）
 * @param {number} options.chunkSize - 每段最大行數（預設 50）
 * @param {number} options.delay - 每段之間的延遲 ms（預設 0）
 */
function safeOutput(content, options = {}) {
  const {
    outputFile = null,
    chunkSize = 50,
    delay = 0,
  } = options;

  // 分段輸出到終端機
  const lines = content.split('\n');
  
  if (lines.length <= chunkSize) {
    // 短內容直接輸出
    console.log(content);
  } else {
    // 長內容分段輸出
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize).join('\n');
      console.log(chunk);
      
      // 延遲（給終端機緩衝時間）
      if (delay > 0 && i + chunkSize < lines.length) {
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Busy wait
        }
      }
    }
  }

  // 備份到檔案
  if (outputFile) {
    try {
      const dir = path.dirname(outputFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputFile, content, 'utf8');
      console.log(`\n[i] Full output saved to: ${outputFile}`);
    } catch (err) {
      console.error(`[!] Failed to save output: ${err.message}`);
    }
  }
}

/**
 * 簡化版：只輸出關鍵資訊到終端機，完整內容存檔
 * @param {string} summary - 摘要（輸出到終端機）
 * @param {string} fullContent - 完整內容（存到檔案）
 * @param {string} outputFile - 檔案路徑
 */
function summaryOutput(summary, fullContent, outputFile) {
  // 終端機只顯示摘要
  console.log(summary);
  
  // 完整內容存檔
  try {
    const dir = path.dirname(outputFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputFile, fullContent, 'utf8');
    console.log(`\n[i] Full output: ${outputFile}`);
    console.log(`[i] Read the file for complete instructions\n`);
  } catch (err) {
    console.error(`[!] Failed to save: ${err.message}`);
  }
}

/**
 * 進度輸出（逐行輸出，避免緩衝）
 * @param {string[]} lines - 行陣列
 */
function progressOutput(lines) {
  lines.forEach(line => {
    console.log(line);
    // 強制刷新（Node.js 會自動處理）
  });
}

module.exports = {
  safeOutput,
  summaryOutput,
  progressOutput,
};
