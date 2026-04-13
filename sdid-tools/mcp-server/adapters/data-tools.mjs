/**
 * Data tool adapters.
 * dict-sync and scanner.
 */
import { z } from 'zod';
import { createRequire } from 'node:module';
import path from 'node:path';
import { TOOLS_DIR, resolvePath, runRunner } from '../lib/utils.mjs';

const require = createRequire(import.meta.url);

export const dictSyncTool = {
  schema: {
    title: 'SDID Dict Sync',
    description: 'Sync GEMS dictionary metadata from source into .gems/specs.',
    inputSchema: {
      project: z.string().describe('Project root path'),
      src: z.string().optional().describe('Source directory, defaults to src'),
      dryRun: z.boolean().optional().describe('Preview changes without writing'),
    },
  },
  async handler({ project, src, dryRun }) {
    const projectRoot = resolvePath(project);
    try {
      const dictSync = require(path.join(TOOLS_DIR, 'dict-sync.cjs'));
      const result = dictSync.syncDict(projectRoot, { srcSubDir: src || 'src', dryRun: !!dryRun });
      const lines = ['## dict-sync result', ''];
      lines.push(`updated: ${result.updated}`);
      lines.push(`skipped: ${result.skipped}`);
      if (result.details && result.details.length > 0) {
        lines.push('', '### details');
        for (const d of result.details) lines.push(`- ${d}`);
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `ERROR: ${err.message}` }] };
    }
  },
};

export const scannerTool = {
  schema: {
    title: 'SDID GEMS Scanner',
    description: 'Execute canonical SCAN via task-pipe runner. Canonical output is .gems/docs/functions.json.',
    inputSchema: {
      project: z.string().describe('Project root path'),
      src: z.string().optional().describe('Legacy-compatible option; canonical SCAN auto-detects source directories'),
      iteration: z.string().optional().describe('Iteration, for example iter-1'),
    },
  },
  async handler({ project, iteration }) {
    const projectRoot = resolvePath(project);
    const args = [`--target=${projectRoot}`, '--phase=SCAN'];
    if (iteration) args.push(`--iteration=${iteration}`);

    const result = await runRunner(args);
    const text = [
      '## SDID Scanner',
      '',
      'Delegated to canonical SCAN.',
      'Canonical output: .gems/docs/functions.json',
      '',
      result.output,
    ].join('\n');
    return { content: [{ type: 'text', text }] };
  },
};
