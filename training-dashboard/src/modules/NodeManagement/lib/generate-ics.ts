/**
 * GEMS: generateIcs | P2 | ✓✓ | (className: string, nodes: Array<{name: string, dueDate: string}>)→string | Story-2.1 | 產生 .ics 格式字串
 * GEMS-FLOW: NODES→ICS_TEXT
 * GEMS-DEPS: [ClassNodeSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// AC-2.3
// [STEP] NODES — 接收班別名稱與節點列表
// [STEP] ICS_TEXT — 產生 VCALENDAR + VEVENT 格式字串

/**
 * 產生 .ics 格式字串（純計算，不含 file I/O）
 * @param className - 班別名稱
 * @param nodes - 節點列表（含計算後的實際日期）
 * @returns .ics 格式字串
 */
export function generateIcs(
  className: string,
  nodes: Array<{ name: string; dueDate: string }>
): string {
  // [STEP] NODES
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // [STEP] ICS_TEXT
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TrainingDashboard//NodeManagement//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  nodes.forEach((node, i) => {
    const dateStr = node.dueDate.replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:node-${i}-${dateStr}@training-dashboard`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dateStr}`,
      `DTEND;VALUE=DATE:${dateStr}`,
      `SUMMARY:【${className}】${node.name}`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
