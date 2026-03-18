import type { NodeWithDate } from '../types';

export function generateIcs(className: string, nodes: NodeWithDate[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//train-dashboard//EN',
    'CALSCALE:GREGORIAN',
  ];

  for (const node of nodes) {
    if (!node.actual_date) continue;
    const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dtStart = node.actual_date.replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${node.id}@train-dashboard`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `SUMMARY:${className} - ${node.name}`,
      `DESCRIPTION:${node.notes || ''}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
