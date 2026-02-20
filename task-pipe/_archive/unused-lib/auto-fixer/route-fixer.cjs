#!/usr/bin/env node
/**
 * Route Auto-Fixer v1.0
 * 自動修復未註冊的路由
 * 
 * 策略:
 * 1. 解析錯誤訊息找出缺失的路由路徑
 * 2. 找到對應的頁面/模組檔案
 * 3. 在 router 或 routes 設定中加入路由
 */

const fs = require('fs');
const path = require('path');

/**
 * 從錯誤訊息提取路由路徑
 * @param {string} errorContent 
 * @returns {string|null}
 */
function extractRoutePath(errorContent) {
    const patterns = [
        /Route not registered[:\s]+([/\w-]+)/i,
        /路由.*未註冊[:\s]+([/\w-]+)/,
        /missing route[:\s]+([/\w-]+)/i,
        /\/([a-z][a-z0-9-]+)/i  // 最寬鬆的匹配
    ];

    for (const pattern of patterns) {
        const match = errorContent.match(pattern);
        if (match) {
            return match[1].startsWith('/') ? match[1] : '/' + match[1];
        }
    }
    return null;
}

/**
 * 從路由路徑推測模組名稱
 * @param {string} routePath 
 * @returns {string}
 */
function guessModuleName(routePath) {
    // /api/users -> Users
    // /memo -> Memo
    const parts = routePath.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1] || 'index';
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
}

/**
 * 找到路由設定檔案
 * @param {string} projectDir 
 * @returns {string|null}
 */
function findRouterFile(projectDir) {
    const candidates = [
        'src/routes.ts',
        'src/routes.tsx',
        'src/router.ts',
        'src/router.tsx',
        'src/App.tsx',
        'src/main.tsx',
        'app/routes.ts',
        'routes/index.ts'
    ];

    for (const candidate of candidates) {
        const fullPath = path.join(projectDir, candidate);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }
    return null;
}

/**
 * 生成路由定義程式碼
 * @param {string} routePath 
 * @param {string} moduleName 
 * @param {string} framework - 'react-router' | 'next' | 'vue-router'
 * @returns {string}
 */
function generateRouteCode(routePath, moduleName, framework = 'react-router') {
    switch (framework) {
        case 'react-router':
            return `  { path: '${routePath}', element: <${moduleName}Page /> },`;
        case 'next':
            return `// Next.js: 請在 pages${routePath}.tsx 或 app${routePath}/page.tsx 創建頁面`;
        case 'vue-router':
            return `  { path: '${routePath}', component: ${moduleName}Page },`;
        default:
            return `  { path: '${routePath}', component: ${moduleName}Page },`;
    }
}

/**
 * 主修復函式
 * @param {Object} params 
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function fix(params) {
    const { errorContent, projectDir = '.' } = params;

    // 1. 提取路由路徑
    const routePath = extractRoutePath(errorContent);
    if (!routePath) {
        return { success: false, message: '無法從錯誤訊息中提取路由路徑' };
    }

    // 2. 推測模組名稱
    const moduleName = guessModuleName(routePath);

    // 3. 找路由設定檔
    const routerFile = findRouterFile(projectDir);

    // 4. 生成建議
    const suggestion = generateRouteCode(routePath, moduleName);

    let message = `建議為 ${routePath} 增加路由:\n`;
    message += `\n${suggestion}\n`;

    if (routerFile) {
        message += `\n路由設定檔: ${path.relative(projectDir, routerFile)}`;
    } else {
        message += `\n⚠ 未找到路由設定檔，請手動創建`;
    }

    return {
        success: true,
        message,
        suggestion,
        routePath,
        moduleName,
        routerFile
    };
}

// CLI 測試
if (require.main === module) {
    (async () => {
        const result = await fix({
            errorContent: 'Route not registered: /api/users',
            projectDir: '.'
        });
        console.log('Fix Result:', result);
    })();
}

module.exports = {
    fix,
    extractRoutePath,
    guessModuleName,
    findRouterFile,
    generateRouteCode
};
