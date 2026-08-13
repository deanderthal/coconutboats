export const DUE_SOON_DAYS = 10;

export type DueSummary = { overdue: number; dueSoon: number };

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isWithinDays(due_date: string | null | undefined, days = DUE_SOON_DAYS) {
  if (!due_date) return false;
  const today = localDateKey();
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + days);
  return due_date >= today && due_date <= localDateKey(limitDate);
}

export function isOverdue(due_date: string | null | undefined) {
  return Boolean(due_date && due_date < localDateKey());
}

export function summarizeDueDates(items: Array<{ due_date?: string | null }>, days = DUE_SOON_DAYS): DueSummary {
  return items.reduce<DueSummary>((summary, item) => {
    if (isOverdue(item.due_date)) summary.overdue += 1;
    else if (isWithinDays(item.due_date, days)) summary.dueSoon += 1;
    return summary;
  }, { overdue: 0, dueSoon: 0 });
}
