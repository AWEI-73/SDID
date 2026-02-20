/**
 * Project Type Detection - 專案類型偵測工具
 * 
 * 用於 dry-run 模式，偵測專案類型和源碼目錄
 */

const fs = require('fs');
const path = require('path');

/**
 * 偵測專案類型
 * @param {string} projectPath - 專案路徑
 * @returns {{ type: string, isGreenfield: boolean }}
 */
function detectProjectType(projectPath) {
    const absPath = path.resolve(projectPath);
    
    // 檢查是否為 greenfield（新專案）
    const srcExists = fs.existsSync(path.join(absPath, 'src'));
    const packageExists = fs.existsSync(path.join(absPath, 'package.json'));
    const gemsExists = fs.existsSync(path.join(absPath, '.gems'));
    
    const isGreenfield = !srcExists && !packageExists;
    
    // 偵測專案類型
    let type = 'unknown';
    
    if (packageExists) {
        try {
            const pkg = JSON.parse(fs.readFileSync(path.join(absPath, 'package.json'), 'utf-8'));
            
            // TypeScript
            if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) {
                type = 'typescript';
            }
            // React
            else if (pkg.dependencies?.react) {
                type = 'react';
            }
            // Vue
            else if (pkg.dependencies?.vue) {
                type = 'vue';
            }
            // Node.js
            else if (pkg.main || pkg.type === 'module') {
                type = 'nodejs';
            }
            else {
                type = 'javascript';
            }
        } catch (e) {
            type = 'javascript';
        }
    }
    // Python
    else if (fs.existsSync(path.join(absPath, 'requirements.txt')) || 
             fs.existsSync(path.join(absPath, 'pyproject.toml'))) {
        type = 'python';
    }
    // Google Apps Script
    else if (fs.existsSync(path.join(absPath, 'appsscript.json'))) {
        type = 'gas';
    }
    // 只有 .gems 目錄（POC 階段）
    else if (gemsExists) {
        type = 'gems-only';
    }
    
    return { type, isGreenfield };
}

/**
 * 取得源碼目錄
 * @param {string} projectPath - 專案路徑
 * @param {string} projectType - 專案類型
 * @returns {string} 源碼目錄路徑
 */
function getSrcDir(projectPath, projectType) {
    const absPath = path.resolve(projectPath);
    
    // 常見的源碼目錄
    const candidates = ['src', 'lib', 'app', 'source'];
    
    for (const dir of candidates) {
        const fullPath = path.join(absPath, dir);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            return fullPath;
        }
    }
    
    // Python 專案可能直接在根目錄
    if (projectType === 'python') {
        return absPath;
    }
    
    // GAS 專案直接在根目錄
    if (projectType === 'gas') {
        return absPath;
    }
    
    // 預設返回 src（即使不存在）
    return path.join(absPath, 'src');
}

module.exports = {
    detectProjectType,
    getSrcDir
};
