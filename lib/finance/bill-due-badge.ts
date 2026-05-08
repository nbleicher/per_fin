/** Human-readable due labels for dashboard/Finance tables (local calendar). */

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function clampDueDate(year: number, monthIndex: number, dueDay: number): Date {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(Math.max(1, dueDay), last);
  return new Date(year, monthIndex, day);
}

const DAY_MS = 86_400_000;

/**
 * Next calendar occurrence label for "this cycle": overdue if this month's due date passed,
 * else days until due or "Due today".
 */
export function billDueBadgeLabel(dueDay: number, referenceDate: Date = new Date()): string {
  const today = startOfDay(referenceDate);
  const y = referenceDate.getFullYear();
  const m = referenceDate.getMonth();
  const thisDue = clampDueDate(y, m, dueDay);

  if (thisDue.getTime() === today.getTime()) {
    return "Due today";
  }
  if (thisDue < today) {
    return "Overdue";
  }
  const days = Math.round((thisDue.getTime() - today.getTime()) / DAY_MS);
  return `Due in ${days}d`;
}
