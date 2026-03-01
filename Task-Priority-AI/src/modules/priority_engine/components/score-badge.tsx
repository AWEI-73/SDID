// @GEMS-FUNCTION: ScoreBadge
/**
 * GEMS: ScoreBadge | P1 | ○○ | (score: number)→string | Story-2.1 | 分數顯示標籤
 * GEMS-FLOW: RECEIVE_SCORE → FORMAT_DISPLAY → RENDER_BADGE
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: score-badge.test.tsx
 */
export function ScoreBadge(score: number): string {
  // [STEP] RECEIVE_SCORE
  const safeScore = isNaN(score) ? 0 : score;

  // [STEP] FORMAT_DISPLAY
  let color = 'gray';
  if (safeScore >= 80) color = 'red';
  else if (safeScore >= 50) color = 'orange';
  else if (safeScore > 0) color = 'green';

  const displayText = `${safeScore}/100`;

  // [STEP] RENDER_BADGE
  return `<span class="score-badge" style="background-color: ${color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em;">${displayText}</span>`;
}
