---
description: "[DEPRECATED] 已整合到統一的 sdid skill。請直接使用 sdid skill，它會自動判斷路線（Blueprint / Task-Pipe）。"
---

# Task-Pipe 自動化開發流程（已整合）

此 workflow 已整合進 `.agent/skills/sdid/` skill。

使用方式：直接觸發 sdid skill，它會根據專案狀態和使用者意圖自動判斷路線。

如需單步 debug，仍可直接呼叫 runner.cjs：
```bash
node task-pipe/runner.cjs --phase=BUILD --step=1 --target=[path] --story=[Story-X.Y]
```
