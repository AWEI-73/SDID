export function calcNodeDate(startDate: string, offsetDays: number): string {
  const [year, month, day] = startDate.split('-').map(Number);
  const date = new Date(year, month - 1, day); // local time, no UTC shift
  date.setDate(date.getDate() + offsetDays);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
