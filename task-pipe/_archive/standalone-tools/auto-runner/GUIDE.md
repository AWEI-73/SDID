
# 強制執行(注意:全權授權AGENT直接執行index.cjs)

直接執行不要解析

```bash
node task-pipe/tools/auto-runner/index.cjs --generate-test-prompt
```

然後按輸出的 @EXECUTE 區塊執行。

---

停止後產生報告:

```bash
node task-pipe/tools/optimization-reporter/index.cjs
```

---

禁止: 分析、規劃、讀取 .cjs、建立 workflows
