# GEMS Control Tower Tools

This directory contains various tools used for scanning, validating, and managing GEMS-FLOW projects.

## Tool Status Categories

### 🚀 Active Tools
Used in the current automated workflows (POC, PLAN, BUILD, SCAN).

| Tool | Description |
|---|---|
| `run-all-scanners.cjs` | Orchestrator that runs all domain-specific scanners. |
| `gems-scanner.cjs` | Core tool for extracting GEMS tags and generating specs. |
| `report-generator.cjs` | Consolidates results from various gates into standardized reports. |
| `gems-gate.cjs` | Validation gate for GEMS tag compliance. |
| `gems-test-gate.cjs` | Validation gate for P0/P1 test coverage. |
| `spec-aggregator.cjs` | Aggregates all scanner outputs into `system-blueprint.json`. |
| `spec-generator.cjs` | Generates human-readable Markdown and HTML specifications. |
| `init-project.cjs` | Initializes a new GEMS-FLOW project structure. |
| `init-iteration.cjs` | Set up a new development iteration. |
| `story-number-advisor.cjs` | AI-assisted story numbering based on project architecture. |
| `scaffold-files.cjs` | High-level code skeleton generation. |
| `sync-scaffold.cjs` | Synchronizes code files with the implementation plan. |
| `tech-stack-scanner.cjs` | Identifies technologies and dependencies used in the project. |
| `structure-scanner.cjs` | Maps the project's file and module structure. |
| `schema-parser.cjs` | Parses SQL schema into a structured JSON representation. |
| `config-scanner.cjs` | Extracts environment and configuration details. |

### 🔄 Migrated / Integrated
Tools whose primary logic has been migrated to `src/modules` services, but scripts are kept for CLI usage.

| Tool | Description | Migrated To |
|---|---|---|
| `plan-validator.cjs` | Validates implementation plans against GEMS rules. | `dashboard/services` |
| `init-poc.cjs` | Initializes POC environment. | `poc/tools` |
| `process-html-poc.cjs` | Processes raw HTML POCs into structured specs. | `poc/tools` |

### 🛠️ Legacy / Utility
Older tools or debugging utilities.

| Tool | Description | Status |
|---|---|---|
| `find_failures.cjs` | Utility to parse Jest JSON output and identify failures. | Utility |
| `backup-iteration.cjs` | Backs up current iteration state. | Active (Utility) |
| `database-scanner.cjs` | Older version of schema parsing logic. | Legacy |
| `gems-coverage-report.cjs` | Generates a standalone GEMS coverage report. | Legacy |
| `integration-checker.cjs` | Checks for cross-module integration issues. | Legacy |
| `generate-hub-index.cjs` | Generates index for the GEMS Hub UI. | Legacy |

## How to Run Tests
All tools are tested using Jest:
```bash
npm test
```
Tests are located in the `__tests__` subdirectory.
