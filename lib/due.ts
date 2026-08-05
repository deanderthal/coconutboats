export const DUE_SOON_DAYS = 10;

export type DueSummary = {
  overdue: number;
  dueSoon: number;
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function summarizeDueDates(
  items: Array<{ dueDate?: string | null }>,
  days = DUE_SOON_DAYS
): DueSummary {
  const today = localDateKey();
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + days);
  const limit = localDateKey(limitDate);

  return items.reduce<DueSummary>(
    (summary, item) => {
      const dueDate = item.dueDate;
      if (!dueDate) return summary;

      if (dueDate < today) summary.overdue += 1;
      else if (dueDate <= limit) summary.dueSoon += 1;

      return summary;
    },
    { overdue: 0, dueSoon: 0 }
  );
}
