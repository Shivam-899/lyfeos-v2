/**
 * Formats a Date object to a YYYY-MM-DD string using local time parts.
 * This avoids the timezone offset shifting bug associated with .toISOString().
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the date string for tomorrow in local time.
 */
export function getLocalTomorrowString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return getLocalDateString(d);
}

/**
 * Returns the date string for yesterday in local time.
 */
export function getLocalYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

/**
 * Calculates the next occurrence date for recurring tasks.
 * Uses local calendar date arithmetic to prevent timezone shifting.
 */
export function getNextRecurringDate(
  currentDueDate?: string,
  repeat?: "none" | "daily" | "weekly" | "monthly"
): string {
  const today = new Date();
  let base: Date;
  if (currentDueDate) {
    const [y, m, d] = currentDueDate.split("-").map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      base = new Date(y, m - 1, d);
    } else {
      base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }
  } else {
    base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  if (repeat === "daily") {
    base.setDate(base.getDate() + 1);
  } else if (repeat === "weekly") {
    base.setDate(base.getDate() + 7);
  } else if (repeat === "monthly") {
    const prevDay = base.getDate();
    base.setMonth(base.getMonth() + 1);
    // Handle month-end boundary overflow (e.g. Jan 31 -> Feb 28/29)
    if (base.getDate() !== prevDay) {
      base.setDate(0);
    }
  }

  return getLocalDateString(base);
}
