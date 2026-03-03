/**
 * sdid-state-guide adapter
 */
import { z } from 'zod';
import { createRequire } from 'node:module';
import path from 'node:path';
import { TOOLS_DIR, resolvePath } from '../lib/utils.mjs';

const require = createRequire(import.meta.url);
const stateGuide = require(path.join(TOOLS_DIR, 'state-guide.cjs'));

export const schema = {
  title: 'SDID State Guide',
  description: '取得專案目前的 SDID 狀態指令包（📍狀態/📖該讀什麼/⚠️歷史提示/🎯下一步/🚫紅線）。每次進入專案時應優先呼叫此工具。支援 Blueprint 和 Task-Pipe 兩條路線的完整狀態偵測。',
  inputSchema: {
    project: z.string().describe('專案根目錄路徑（如 ExamForge）'),
    iter: z.string().optional().describe('指定迭代（如 iter-11），省略則自動偵測'),
    story: z.string().optional().describe('指定 Story（如 Story-11.1）'),
    gems: z.string().optional().describe('指定 gemsId（如 PDF.ParseBufferWithImages）'),
  },
};

export async function handler({ project, iter, story, gems }) {
  const fs = require('fs');
  const projectRoot = resolvePath(project);

  if (!fs.existsSync(projectRoot)) {
    return { content: [{ type: 'text', text: `ERROR: 找不到專案目錄: ${projectRoot}` }] };
  }

  try {
    const activeIter = iter || stateGuide.detectActiveIter(projectRoot);
    const fullState = stateGuide.detectFullState(projectRoot, activeIter, story || null);
    const { phase, step, route } = fullState;
    const resolvedStory = story || fullState.story;

    const targetGems = stateGuide.resolveTargetGems(projectRoot, resolvedStory, gems);
    const hints = stateGuide.resolveHints(projectRoot, phase, step, resolvedStory);

    const PHASE_SCRIPT_MAP = {
      POC: (s) => `task-pipe/phases/poc/step-${s}.cjs`,
      PLAN: (s) => `task-pipe/phases/plan/step-${s}.cjs`,
      BUILD: (s) => `task-pipe/phases/build/phase-${s}.cjs`,
      SCAN: (s) => `task-pipe/phases/scan/step-${s}.cjs`,
    };
    const scriptFn = PHASE_SCRIPT_MAP[phase?.toUpperCase()];
    const scriptPath = scriptFn && step ? scriptFn(step) : null;
    const phase2Script = (phase === 'BUILD' && parseInt(step) !== 2)
      ? 'task-pipe/phases/build/phase-2.cjs' : null;

    const output = stateGuide.formatGuide({
      phase, step,
      story: resolvedStory,
      iter: activeIter,
      route,
      resumeCtx: hints.resumeCtx || null,
      scriptPath,
      gems: targetGems,
      pitfalls: hints.pitfalls || [],
      histHint: hints.histHint || null,
      phase2Script,
      fullState,
    });

    return { content: [{ type: 'text', text: output }] };
  } catch (err) {
    return { content: [{ type: 'text', text: `ERROR: ${err.message}\n${err.stack}` }] };
  }
}
