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
