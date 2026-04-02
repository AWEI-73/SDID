#!/usr/bin/env node
/**
 * sync-skills.cjs
 * 三向同步：.kiro/skills/ ↔ .agent/skills/ ↔ .claude/commands/
 * 任一處變更 → 自動同步到另外兩處（writeIfChanged 防止無限循環）
 *
 * 用法：
 *   node sdid-tools/sync-skills.cjs [changedFile]  ← Kiro / Agent hook / 手動
 *   echo '{"tool_input":{"file_path":"..."}}' | node sdid-tools/sync-skills.cjs  ← Claude PostToolUse hook (stdin)
 *   node sdid-tools/sync-skills.cjs  ← 全量同步（以 .kiro/skills 為 master）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KIRO_SKILLS    = path.join(ROOT, '.kiro', 'skills');
const AGENT_SKILLS   = path.join(ROOT, '.agent', 'skills');
const CLAUDE_COMMANDS = path.join(ROOT, '.claude', 'commands');

// ── helpers ──────────────────────────────────────────────────────────────────

function writeIfChanged(destPath, src) {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const dst = fs.existsSync(destPath) ? fs.readFileSync(destPath, 'utf8') : null;
  if (src === dst) return false;
  fs.writeFileSync(destPath, src, 'utf8');
  return true;
}

function tag(changed) { return changed ? 'synced  ' : 'unchanged'; }

// ── 偵測來源並解析 skillName + rel ─────────────────────────────────────────

function detectSource(abs) {
  if (abs.startsWith(KIRO_SKILLS + path.sep) || abs === KIRO_SKILLS) {
    const rel = path.relative(KIRO_SKILLS, abs);
    const parts = rel.split(path.sep);
    return { origin: 'kiro', rel, skillName: parts[0], isSkillMd: parts.length === 2 && parts[1] === 'SKILL.md' };
  }
  if (abs.startsWith(AGENT_SKILLS + path.sep) || abs === AGENT_SKILLS) {
    const rel = path.relative(AGENT_SKILLS, abs);
    const parts = rel.split(path.sep);
    return { origin: 'agent', rel, skillName: parts[0], isSkillMd: parts.length === 2 && parts[1] === 'SKILL.md' };
  }
  if (abs.startsWith(CLAUDE_COMMANDS + path.sep) && abs.endsWith('.md')) {
    const base = path.basename(abs, '.md');
    return { origin: 'claude', rel: `${base}.md`, skillName: base, isSkillMd: true };
  }
  return null;
}

// ── 單檔同步（三向） ──────────────────────────────────────────────────────────

function syncFile(abs) {
  if (!fs.existsSync(abs)) { console.log(`[sync-skills] not found: ${abs}`); return; }
  const info = detectSource(abs);
  if (!info) { console.log(`[sync-skills] skip (outside skill dirs): ${abs}`); return; }

  const src = fs.readFileSync(abs, 'utf8');
  const { origin, rel, skillName, isSkillMd } = info;

  if (origin === 'claude') {
    // .claude/commands/<name>.md → .kiro/skills/<name>/SKILL.md + .agent/skills/<name>/SKILL.md
    const skillRel = path.join(skillName, 'SKILL.md');
    console.log(`[sync-skills] .kiro   ${tag(writeIfChanged(path.join(KIRO_SKILLS, skillRel), src))}: ${skillRel}`);
    console.log(`[sync-skills] .agent  ${tag(writeIfChanged(path.join(AGENT_SKILLS, skillRel), src))}: ${skillRel}`);
  } else {
    // .kiro/skills/<rel> or .agent/skills/<rel> → 另一個 + .claude/commands/
    if (origin !== 'kiro')
      console.log(`[sync-skills] .kiro   ${tag(writeIfChanged(path.join(KIRO_SKILLS, rel), src))}: ${rel}`);
    if (origin !== 'agent')
      console.log(`[sync-skills] .agent  ${tag(writeIfChanged(path.join(AGENT_SKILLS, rel), src))}: ${rel}`);
    if (isSkillMd) {
      const claudePath = path.join(CLAUDE_COMMANDS, `${skillName}.md`);
      console.log(`[sync-skills] .claude ${tag(writeIfChanged(claudePath, src))}: commands/${skillName}.md`);
    }
  }
}

// ── 全量同步（以 .kiro/skills 為 master） ────────────────────────────────────

function syncAll() {
  let count = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
      } else if (entry.name.endsWith('.md')) { syncFile(full); count++; }
    }
  }
  walk(KIRO_SKILLS);
  console.log(`[sync-skills] done — ${count} files checked`);
}

// ── 入口 ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

// 1. stdin 模式（Claude PostToolUse hook：--stdin + JSON via stdin）
if (args[0] === '--stdin') {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      const evt = JSON.parse(raw);
      const filePath = evt?.tool_input?.file_path || '';
      if (filePath) {
        syncFile(path.resolve(ROOT, filePath));
      } else {
        console.log('[sync-skills] skip (no file_path in stdin JSON)');
      }
    } catch {
      console.log('[sync-skills] skip (stdin not valid JSON)');
    }
  });
} else if (args[0]) {
  // 2. CLI 引數模式（Kiro hook `${file}` / 手動）
  syncFile(path.resolve(args[0]));
} else {
  // 3. 無引數 → 全量同步
  syncAll();
}
