#!/usr/bin/env node
/**
 * SDID MCP Server — Thin Shell
 *
 * 只做：transport + tool registration + 轉發到 adapters/
 * 業務邏輯全部在 adapters/ 和 sdid-core/ 裡。
 *
 * Tools:
 *   sdid-loop            — ★ 主入口：自動偵測狀態並執行下一步
 *   sdid-state-guide     — 路由大腦（狀態/該讀/歷史/下一步/紅線）
 *   sdid-run             — 通用 CLI 執行器（安全白名單）
 *   sdid-spec-gen        — 字典生成
 *   sdid-spec-gate       — 字典品質驗證
 *   sdid-dict-sync       — 行號回寫
 *   sdid-scanner         — GEMS 標籤掃描
 *   sdid-blueprint-gate  — 藍圖品質驗證
 *   sdid-micro-fix-gate  — 小修驗收 gate
 *   sdid-poc-scaffold    — POC-FIX 骨架遷移
 *   sdid-build           — BUILD/POC/PLAN runner
 *   sdid-scan            — SCAN runner
 *   sdid-test            — 整合測試 runner + 報告
 *   sdid-init-test-project  — 建立臨時測試專案供 flow audit 使用
 *   sdid-audit-save-report  — AI 跑完 flow audit 後存報告 + 清除 temp 專案
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// ── Adapters ──
import * as loop from './adapters/loop.mjs';
import * as stateGuide from './adapters/state-guide.mjs';
import { specGen, specGate, blueprintGate, microFixGate, pocToScaffold, run } from './adapters/cli-tools.mjs';
import { dictSyncTool, scannerTool } from './adapters/data-tools.mjs';
import { build, scan } from './adapters/runners.mjs';
import { testRunner } from './adapters/test-runner.mjs';
import { initTestProject } from './adapters/init-test-project.mjs';
import { auditReport } from './adapters/audit-report.mjs';

// ── Server ──
const server = new McpServer({ name: 'sdid', version: '1.1.0' });

// ── Tool Registration ──
server.registerTool('sdid-loop',           loop.schema,           loop.handler);
server.registerTool('sdid-state-guide',    stateGuide.schema,     stateGuide.handler);
server.registerTool('sdid-spec-gen',       specGen.schema,        specGen.handler);
server.registerTool('sdid-spec-gate',      specGate.schema,       specGate.handler);
server.registerTool('sdid-dict-sync',      dictSyncTool.schema,   dictSyncTool.handler);
server.registerTool('sdid-scanner',        scannerTool.schema,    scannerTool.handler);
server.registerTool('sdid-blueprint-gate', blueprintGate.schema,  blueprintGate.handler);
server.registerTool('sdid-micro-fix-gate', microFixGate.schema,   microFixGate.handler);
server.registerTool('sdid-poc-scaffold',   pocToScaffold.schema,  pocToScaffold.handler);
server.registerTool('sdid-build',          build.schema,          build.handler);
server.registerTool('sdid-scan',           scan.schema,           scan.handler);
server.registerTool('sdid-run',            run.schema,            run.handler);
server.registerTool('sdid-test',                testRunner.schema,        testRunner.handler);
server.registerTool('sdid-init-test-project',   initTestProject.schema,   initTestProject.handler);
server.registerTool('sdid-audit-save-report',   auditReport.schema,       auditReport.handler);

// ── Start ──
const transport = new StdioServerTransport();
await server.connect(transport);
