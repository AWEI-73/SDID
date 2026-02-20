#!/usr/bin/env node

/**
 * 假路由修正工具
 * 
 * 功能：
 * 1. 偵測假路由（只有資料陣列）
 * 2. 產生真實路由實作
 * 3. 提供 Hash Router 或 History Router 選項
 * 
 * 使用方式：
 * node tools/fix-fake-routing.cjs <routes-dir> [--type=hash|history]
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * Hash Router 模板
 */
const HASH_ROUTER_TEMPLATE = `/**
 * GEMS: Router | P1 | ✓✓ | ()→Router | Story-1.0 | Hash 路由系統
 * GEMS-FLOW: 初始化→註冊路由→監聽變化→處理路由→渲染頁面
 * GEMS-DEPS: [Type.RouteConfig (路由設定)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: router.test.ts
 */

export interface RouteConfig {
  path: string;
  handler: () => void;
  title?: string;
}

export class HashRouter {
  private routes: Map<string, RouteConfig>;
  private notFoundHandler: (() => void) | null;

  constructor() {
    this.routes = new Map();
    this.notFoundHandler = null;
    
    // [STEP] 初始化: 監聽 hash 變化
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
  }

  // [STEP] 註冊路由: 加入路由設定
  register(path: string, handler: () => void, title?: string): void {
    this.routes.set(path, { path, handler, title });
  }

  // [STEP] 監聽變化: 設定 404 處理
  setNotFound(handler: () => void): void {
    this.notFoundHandler = handler;
  }

  // [STEP] 處理路由: 取得當前路由並執行
  private handleRoute(): void {
    const hash = window.location.hash.slice(1) || '/';
    const route = this.routes.get(hash);

    if (route) {
      // [STEP] 渲染頁面: 執行路由處理函式
      if (route.title) {
        document.title = route.title;
      }
      route.handler();
    } else if (this.notFoundHandler) {
      this.notFoundHandler();
    }
  }

  // 導航到指定路由
  navigate(path: string): void {
    window.location.hash = path;
  }

  // 取得當前路由
  getCurrentPath(): string {
    return window.location.hash.slice(1) || '/';
  }
}

// 使用範例
export function initRouter(): HashRouter {
  const router = new HashRouter();

  // 註冊路由
  router.register('/', () => {
    console.log('Home page');
  }, 'Home');

  router.register('/about', () => {
    console.log('About page');
  }, 'About');

  // 404 處理
  router.setNotFound(() => {
    console.log('404 Not Found');
  });

  return router;
}
`;

/**
 * History Router 模板
 */
const HISTORY_ROUTER_TEMPLATE = `/**
 * GEMS: Router | P1 | ✓✓ | ()→Router | Story-1.0 | History 路由系統
 * GEMS-FLOW: 初始化→註冊路由→監聽變化→處理路由→渲染頁面
 * GEMS-DEPS: [Type.RouteConfig (路由設定)]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: router.test.ts
 */

export interface RouteConfig {
  path: string;
  handler: () => void;
  title?: string;
}

export class HistoryRouter {
  private routes: Map<string, RouteConfig>;
  private notFoundHandler: (() => void) | null;

  constructor() {
    this.routes = new Map();
    this.notFoundHandler = null;
    
    // [STEP] 初始化: 監聽 popstate 事件
    window.addEventListener('popstate', () => this.handleRoute());
    
    // 攔截所有連結點擊
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A') {
        e.preventDefault();
        const href = target.getAttribute('href');
        if (href) this.navigate(href);
      }
    });
    
    this.handleRoute();
  }

  // [STEP] 註冊路由: 加入路由設定
  register(path: string, handler: () => void, title?: string): void {
    this.routes.set(path, { path, handler, title });
  }

  // [STEP] 監聽變化: 設定 404 處理
  setNotFound(handler: () => void): void {
    this.notFoundHandler = handler;
  }

  // [STEP] 處理路由: 取得當前路由並執行
  private handleRoute(): void {
    const path = window.location.pathname;
    const route = this.routes.get(path);

    if (route) {
      // [STEP] 渲染頁面: 執行路由處理函式
      if (route.title) {
        document.title = route.title;
      }
      route.handler();
    } else if (this.notFoundHandler) {
      this.notFoundHandler();
    }
  }

  // 導航到指定路由
  navigate(path: string): void {
    window.history.pushState({}, '', path);
    this.handleRoute();
  }

  // 取得當前路由
  getCurrentPath(): string {
    return window.location.pathname;
  }
}

// 使用範例
export function initRouter(): HistoryRouter {
  const router = new HistoryRouter();

  // 註冊路由
  router.register('/', () => {
    console.log('Home page');
  }, 'Home');

  router.register('/about', () => {
    console.log('About page');
  }, 'About');

  // 404 處理
  router.setNotFound(() => {
    console.log('404 Not Found');
  });

  return router;
}
`;

/**
 * 偵測假路由
 */
function detectFakeRouting(routesDir) {
  if (!fs.existsSync(routesDir)) {
    return { hasFakeRouting: false, files: [] };
  }

  const files = fs.readdirSync(routesDir)
    .filter(f => f.endsWith('.ts') || f.endsWith('.js'));

  const fakeRoutingFiles = [];

  for (const file of files) {
    const filePath = path.join(routesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // 假路由特徵
    const hasRouteArray = content.includes('routes') && content.includes('[');
    const hasRouteLogic = 
      content.includes('addEventListener') ||
      content.includes('pushState') ||
      content.includes('class') && content.includes('Router') ||
      content.includes('navigate');

    if (hasRouteArray && !hasRouteLogic) {
      fakeRoutingFiles.push(file);
    }
  }

  return {
    hasFakeRouting: fakeRoutingFiles.length > 0,
    files: fakeRoutingFiles
  };
}

/**
 * 產生路由檔案
 */
function generateRouter(routesDir, type = 'hash') {
  const template = type === 'hash' ? HASH_ROUTER_TEMPLATE : HISTORY_ROUTER_TEMPLATE;
  const outputPath = path.join(routesDir, 'router.ts');

  fs.writeFileSync(outputPath, template, 'utf-8');

  return outputPath;
}

/**
 * 主程式
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log(`
使用方式:
  node tools/fix-fake-routing.cjs <routes-dir> [--type=hash|history]

範例:
  node tools/fix-fake-routing.cjs src/routes
  node tools/fix-fake-routing.cjs src/routes --type=history
    `);
    process.exit(1);
  }

  const routesDir = args[0];
  const typeArg = args.find(arg => arg.startsWith('--type='));
  const type = typeArg ? typeArg.split('=')[1] : 'hash';

  if (!['hash', 'history'].includes(type)) {
    log('❌ 錯誤: type 必須是 hash 或 history', 'red');
    process.exit(1);
  }

  try {
    log('🔍 假路由修正工具', 'cyan');
    log('='.repeat(50), 'cyan');

    // 偵測假路由
    const result = detectFakeRouting(routesDir);

    if (!result.hasFakeRouting) {
      log('\n✅ 未偵測到假路由', 'green');
      return;
    }

    log(`\n⚠️  偵測到假路由: ${result.files.join(', ')}`, 'yellow');

    // 產生真實路由
    log(`\n📝 產生 ${type.toUpperCase()} Router...`, 'cyan');
    const outputPath = generateRouter(routesDir, type);

    log(`\n✅ 已產生: ${outputPath}`, 'green');

    log('\n📋 下一步:', 'cyan');
    log('1. 檢查產生的 router.ts', 'yellow');
    log('2. 在 main.ts 中引入並初始化路由', 'yellow');
    log('3. 刪除舊的假路由檔案', 'yellow');
    log('4. 執行測試確認路由正常', 'yellow');

    log('\n範例程式碼:', 'cyan');
    log(`
import { initRouter } from './routes/router';

const router = initRouter();

// 導航範例
router.navigate('/about');
    `, 'yellow');

  } catch (error) {
    log(`\n❌ 錯誤: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
