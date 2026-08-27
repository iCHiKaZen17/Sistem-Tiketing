import { getDay, getHours } from 'date-fns';

/**
 * Checks if a given date falls within working hours:
 * Monday (1) to Friday (5), between 08:00 and 17:00.
 */
export function isWorkingHour(date: Date = new Date()): boolean {
  const day = getDay(date); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) {
    return false;
  }
  const hours = getHours(date);
  return hours >= 8 && hours < 17;
}

/**
 * Calculates total working minutes between start and end date (08:00 - 17:00, Mon-Fri).
 */
export function calculateWorkingMinutes(start: Date, end: Date): number {
  if (start >= end) return 0;

  let current = new Date(start);
  let totalMinutes = 0;

  while (current < end) {
    if (isWorkingHour(current)) {
      totalMinutes++;
    }
    current = new Date(current.getTime() + 60000); // Step 1 minute
  }

  return totalMinutes;
}
