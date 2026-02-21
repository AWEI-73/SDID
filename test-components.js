const { run } = require('./task-pipe/phases/build/phase-7.cjs');
// Wait, the functions are not exported. Let me just test it directly by copying the logic.
const fs = require('fs');
const path = require('path');

function findNewComponents(srcPath) {
    const components = [];

    // 遞迴掃描所有 components 目錄（任意深度）
    function scanDir(dir, relBase) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                // 跳過 __tests__ 和 node_modules
                if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
                scanDir(path.join(dir, entry.name), `${relBase}/${entry.name}`);
            } else if (/\.(tsx|jsx)$/.test(entry.name)) {
                components.push(`${relBase}/${entry.name}`);
            }
        }
    }

    // 1. src/components/ (根層，AI 最常放這裡)
    scanDir(path.join(srcPath, 'components'), 'components');

    // 2. src/shared/components/
    scanDir(path.join(srcPath, 'shared', 'components'), 'shared/components');

    // 3. src/modules/*/components/ (任意深度)
    const modulesDir = path.join(srcPath, 'modules');
    if (fs.existsSync(modulesDir)) {
        const modules = fs.readdirSync(modulesDir, { withFileTypes: true });
        for (const mod of modules) {
            if (mod.isDirectory()) {
                scanDir(path.join(modulesDir, mod.name, 'components'), `modules/${mod.name}/components`);
            }
        }
    }

    return components;
}

const srcPath = path.join(process.cwd(), 'focus-quest', 'src');
const target = path.join(process.cwd(), 'focus-quest');
const comps = findNewComponents(srcPath);
console.log('Comps found:', comps);

function findOrphanComponents(target, srcPath, components) {
    if (components.length === 0) return [];

    const entryFiles = [
        path.join(srcPath, 'App.tsx'),
        path.join(srcPath, 'App.jsx'),
        path.join(srcPath, 'main.tsx'),
        path.join(srcPath, 'main.jsx'),
        path.join(srcPath, 'main.js'),
        path.join(srcPath, 'index.tsx'),
        path.join(srcPath, 'index.jsx'),
        path.join(srcPath, 'index.js'),
        // 根目錄的 index.html (Vanilla JS 直接 script 引用)
        path.join(target, 'index.html')
    ];

    let entryContent = '';
    const foundEntries = [];
    for (const ef of entryFiles) {
        if (fs.existsSync(ef)) {
            entryContent += fs.readFileSync(ef, 'utf8') + '\n';
            foundEntries.push(path.basename(ef));
        }
    }

    if (!entryContent) {
        return ['找不到任何進入點 (App.tsx / main.tsx / index.html)，無法確認 UI 掛載'];
    }

    // 對每個 component 做精確偵測
    const orphans = [];
    for (const comp of components) {
        const compName = comp.replace(/\.(tsx|jsx)$/, '').split('/').pop();
        // PascalCase 轉換 (timer-display → TimerDisplay)
        const pascal = compName
            .replace(/-./g, x => x[1].toUpperCase())
            .replace(/^./, x => x.toUpperCase());

        console.log(`Checking ${comp} (name: ${compName}, pascal: ${pascal})`);

        // 偵測各種掛載方式：
        // 1. import TimerDisplay from '...'
        // 2. import { TimerDisplay } from '...'
        // 3. <TimerDisplay ... />
        // 4. React.createElement(TimerDisplay, ...)
        // 5. Vanilla: <script src="...timer-display...">
        const patterns = [
            new RegExp(`import\\s+${pascal}\\s+from`, 'i'),
            new RegExp(`import\\s*\\{[^}]*\\b${pascal}\\b[^}]*\\}`, 'i'),
            new RegExp(`<${pascal}[\\s/>]`),
            new RegExp(`createElement\\s*\\(\\s*${pascal}`),
            new RegExp(`src=["'][^"']*${compName}["']`, 'i'),
        ];

        const isMounted = patterns.some(p => {
            const match = p.test(entryContent);
            if (match) console.log(`Matched pattern ${p}`);
            return match;
        });
        if (!isMounted) {
            orphans.push(`${comp} (未在 ${foundEntries.join('/')} 中發現掛載)`);
        } else {
            console.log(`${comp} IS MOUNTED`);
        }
    }

    return orphans;
}

console.log('Orphans:', findOrphanComponents(target, srcPath, comps));
