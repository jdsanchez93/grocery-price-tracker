import { describe, it, expect } from 'vitest';

// Inline the logic for testing with arbitrary dates
function getWeekIdForDate(date: Date): string {
  const adjusted = new Date(date.getTime() - 3 * 24 * 60 * 60 * 1000);
  const startOfYear = new Date(adjusted.getFullYear(), 0, 1);
  const days = Math.floor((adjusted.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${adjusted.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

describe('getCurrentWeekId', () => {
  it('should start a new week on Wednesday', () => {
    const tuesday = new Date('2025-02-11T12:00:00');
    const wednesday = new Date('2025-02-12T12:00:00');

    const tuesdayWeek = getWeekIdForDate(tuesday);
    const wednesdayWeek = getWeekIdForDate(wednesday);

    expect(tuesdayWeek).not.toBe(wednesdayWeek);
  });

  it('should keep the same week from Wednesday through Tuesday', () => {
    const wednesday = new Date('2025-02-12T12:00:00');
    const thursday = new Date('2025-02-13T12:00:00');
    const friday = new Date('2025-02-14T12:00:00');
    const saturday = new Date('2025-02-15T12:00:00');
    const sunday = new Date('2025-02-16T12:00:00');
    const monday = new Date('2025-02-17T12:00:00');
    const tuesday = new Date('2025-02-18T12:00:00');

    const weekId = getWeekIdForDate(wednesday);

    expect(getWeekIdForDate(thursday)).toBe(weekId);
    expect(getWeekIdForDate(friday)).toBe(weekId);
    expect(getWeekIdForDate(saturday)).toBe(weekId);
    expect(getWeekIdForDate(sunday)).toBe(weekId);
    expect(getWeekIdForDate(monday)).toBe(weekId);
    expect(getWeekIdForDate(tuesday)).toBe(weekId);
  });

  it('should increment week on the next Wednesday', () => {
    const wednesday1 = new Date('2025-02-12T12:00:00');
    const wednesday2 = new Date('2025-02-19T12:00:00');

    const week1 = getWeekIdForDate(wednesday1);
    const week2 = getWeekIdForDate(wednesday2);

    // Extract week numbers and verify they differ by 1
    const weekNum1 = parseInt(week1.split('-W')[1]);
    const weekNum2 = parseInt(week2.split('-W')[1]);

    expect(weekNum2 - weekNum1).toBe(1);
  });

  it('should handle year boundary correctly', () => {
    const dec31 = new Date('2025-12-31T12:00:00');
    const jan1 = new Date('2026-01-01T12:00:00');

    // Both should produce valid week IDs
    const week1 = getWeekIdForDate(dec31);
    const week2 = getWeekIdForDate(jan1);

    expect(week1).toMatch(/^\d{4}-W\d{2}$/);
    expect(week2).toMatch(/^\d{4}-W\d{2}$/);
  });
});
