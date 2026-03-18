export function calcNodeDate(startDate: string, offsetDays: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
}
