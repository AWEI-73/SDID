# SDID Monitor

Task-Pipe 流程監控 GUI。

## 啟動

```bash
cd sdid-monitor
npm install   # 第一次
node server.cjs
# → http://localhost:3737
```

## Runner Hook 整合

在 runner 跑完每個 phase 後，加一行 notify 讓 UI 即時更新：

```bash
# Windows CMD
curl -s -X POST http://localhost:3737/api/notify -H "Content-Type: application/json" -d "{}" > nul

# PowerShell
Invoke-RestMethod -Method POST http://localhost:3737/api/notify
```

或在 `task-pipe/runner.cjs` 的 phase 完成後加：

```js
// 非阻塞，monitor 不在線也不影響
require('http').request({ hostname: 'localhost', port: 3737, path: '/api/notify', method: 'POST' }).end();
```

## 結構

```
sdid-monitor/
├── server.cjs   # Express API + SSE
├── index.html   # 單頁 UI
└── package.json
```
