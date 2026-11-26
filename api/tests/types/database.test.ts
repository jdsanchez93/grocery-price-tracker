import { describe, it, expect, vi, afterEach } from 'vitest';
import { getWeekIdForDate, Keys, todayInStoreTz, candidateWeekIds, MAX_CIRCULAR_LENGTH_DAYS } from '../../src/types/database'

describe('getWeekIdForDate', () => {
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

describe('todayInStoreTz', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the same calendar date when UTC and store-local agree', () => {
    // 2026-05-19T18:00:00Z = 2026-05-19T12:00:00 MDT — same date in both zones
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T18:00:00Z'));
    expect(todayInStoreTz('America/Denver')).toBe('2026-05-19');
  });

  it('returns yesterday in Mountain when UTC has already rolled over', () => {
    // 2026-05-20T03:00:00Z = 2026-05-19T21:00:00 MDT — still Tuesday in Denver
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T03:00:00Z'));
    expect(todayInStoreTz('America/Denver')).toBe('2026-05-19');
  });

  it('returns tomorrow once Mountain crosses midnight (Wed 00:00 MDT)', () => {
    // 2026-05-20T06:00:00Z = 2026-05-20T00:00:00 MDT — Wednesday begins in Denver
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T06:00:00Z'));
    expect(todayInStoreTz('America/Denver')).toBe('2026-05-20');
  });

  it('respects a different timezone (Pacific lags Mountain by one hour)', () => {
    // 2026-05-20T06:30:00Z = 2026-05-20T00:30 MDT (already Wed) but 2026-05-19T23:30 PDT (still Tue)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T06:30:00Z'));
    expect(todayInStoreTz('America/Denver')).toBe('2026-05-20');
    expect(todayInStoreTz('America/Los_Angeles')).toBe('2026-05-19');
  });
});

describe('candidateWeekIds', () => {
  // Circulars are stored under getWeekIdForDate(startDate). The candidates must
  // include the stored weekId of every circular that could be covering `today`.
  const weekOf = (startDate: string) => getWeekIdForDate(new Date(startDate + 'T12:00:00'));

  it('puts today\'s own week first, then earlier weeks, with no duplicates', () => {
    const ids = candidateWeekIds('2026-05-19'); // Tue
    expect(ids[0]).toBe(weekOf('2026-05-19'));
    expect(ids).toContain(weekOf('2026-05-13')); // the Wed→Tue circular covering today
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort().reverse()).toEqual(ids);
  });

  it('includes last week\'s partition for a holiday ad that runs past Tuesday', () => {
    // Thanksgiving 2026: ad ran Wed Nov 18 → Thu Nov 26 (stored W47). On Wed Nov 25
    // today's own week is W48, which may hold a pre-scraped ad starting Fri Nov 27.
    const ids = candidateWeekIds('2026-11-25');
    expect(ids).toEqual(expect.arrayContaining([weekOf('2026-11-18'), weekOf('2026-11-27')]));
    expect(weekOf('2026-11-18')).not.toBe(weekOf('2026-11-25'));
  });

  it('finds a circular that started before a year boundary', () => {
    // Wed 2026-12-30 is stored as 2026-W53, but getWeekIdForDate rolls to 2027-W01 on
    // Mon 2027-01-04 — inside that same Wed→Tue window.
    expect(weekOf('2027-01-04')).not.toBe(weekOf('2026-12-30'));
    expect(candidateWeekIds('2027-01-04')).toContain(weekOf('2026-12-30'));
  });

  it('covers every start date within the lookback window', () => {
    const ids = new Set(candidateWeekIds('2026-03-10'));
    for (let k = 0; k < MAX_CIRCULAR_LENGTH_DAYS; k++) {
      const start = new Date(Date.UTC(2026, 2, 10 - k)).toISOString().slice(0, 10);
      expect(ids.has(weekOf(start))).toBe(true);
    }
  });
});
