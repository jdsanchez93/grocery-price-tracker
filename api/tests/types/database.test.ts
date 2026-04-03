import { describe, it, expect } from 'vitest';
import { getWeekIdForDate, Keys } from '../../src/types/database'

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

describe('Keys.gsi1', () => {
  it('pk should be prefixed with PRODUCT#', () => {
    expect(Keys.gsi1.pk('chicken-breast')).toBe('PRODUCT#chicken-breast');
  });

  it('sk should be prefixed with weekId, not a calendar date', () => {
    const sk = Keys.gsi1.sk('2026-W14', 'kingsoopers:abc123');
    expect(sk).toBe('2026-W14#kingsoopers:abc123');
    // Ensure it does NOT start with an ISO calendar date (YYYY-MM-DD)
    expect(sk).not.toMatch(/^\d{4}-\d{2}-\d{2}#/);
  });

  it('sk should sort chronologically across weeks', () => {
    const sk1 = Keys.gsi1.sk('2026-W10', 'kingsoopers:abc123');
    const sk2 = Keys.gsi1.sk('2026-W14', 'kingsoopers:abc123');
    const sk3 = Keys.gsi1.sk('2027-W01', 'kingsoopers:abc123');
    expect(sk1 < sk2).toBe(true);
    expect(sk2 < sk3).toBe(true);
  });

  it('sk should include storeInstanceId for per-store disambiguation', () => {
    const sk = Keys.gsi1.sk('2026-W14', 'safeway:xyz789');
    expect(sk).toContain('safeway:xyz789');
  });
});
