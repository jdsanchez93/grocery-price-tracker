import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, signal } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { PriceTrendChart } from './price-trend-chart';
import { Deal, DealRating } from '../../../../core/models/deal.model';
import { makeDeal } from '../../../../core/models/test-utils';
import { StoresService } from '../../../../core/services/stores.service';
import { UserStore } from '../../../../core/models/store.model';

@Component({ selector: 'p-chart', template: '' })
class StubChart {
  type = input<string>();
  data = input<unknown>();
  options = input<unknown>();
  responsive = input<boolean>();
  height = input<string>();
  ariaLabel = input<string>();
}

function makeRating(overrides: Partial<DealRating> = {}): DealRating {
  return {
    label: 'best',
    percentVsAvg: -20,
    historicalAvg: 2.5,
    historicalMin: 1.5,
    sampleSize: 10,
    ...overrides,
  };
}

function makeUserStore(overrides: Partial<UserStore> = {}): UserStore {
  return {
    instanceId: 'kingsoopers:abc',
    name: 'My Local King Soopers',
    storeType: 'kingsoopers',
    chain: 'kroger',
    addedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

interface ChartDataset {
  label: string;
  data: (number | null)[];
  borderColor: string;
  borderDash?: number[];
}
interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}
interface TooltipCtx {
  dataset: { label?: string };
  parsed: { y: number | null };
}
interface ChartOptions {
  maintainAspectRatio: boolean;
  responsive: boolean;
  plugins: {
    tooltip: {
      callbacks: {
        label: (ctx: TooltipCtx) => string;
      };
    };
  };
  scales: {
    y: {
      ticks: {
        callback: (value: number | string) => string;
      };
    };
  };
}

describe('PriceTrendChart', () => {
  let fixture: ComponentFixture<PriceTrendChart>;
  let component: PriceTrendChart;

  async function setup(history: Deal[], userStores: UserStore[] = []) {
    const userStoresSignal = signal<UserStore[]>(userStores);
    const fakeStoresService = { getUserStores: userStoresSignal.asReadonly() };

    await TestBed.configureTestingModule({
      imports: [PriceTrendChart],
      providers: [{ provide: StoresService, useValue: fakeStoresService }],
    })
      .overrideComponent(PriceTrendChart, {
        remove: { imports: [ChartModule] },
        add: { imports: [StubChart] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PriceTrendChart);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('history', history);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  describe('hasEnoughHistory gate', () => {
    it('is false with zero deals; renders empty-state and no chart', async () => {
      await setup([]);
      expect(component.hasEnoughHistory()).toBe(false);
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('p-chart')).toBeFalsy();
    });

    it('is false with one deal; renders empty-state', async () => {
      await setup([makeDeal()]);
      expect(component.hasEnoughHistory()).toBe(false);
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    });

    it('is true with two or more deals; renders the chart', async () => {
      await setup([
        makeDeal({ dealId: 'a', weekId: '2026-W10' }),
        makeDeal({ dealId: 'b', weekId: '2026-W11' }),
      ]);
      expect(component.hasEnoughHistory()).toBe(true);
      expect(fixture.nativeElement.querySelector('p-chart')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeFalsy();
    });
  });

  describe('weekLabels (via chartData.labels)', () => {
    it('sorts week ids ascending and dedupes repeats', async () => {
      await setup([
        makeDeal({ dealId: 'a', weekId: '2026-W14', priceNumber: 1 }),
        makeDeal({ dealId: 'b', weekId: '2026-W10', priceNumber: 2 }),
        makeDeal({ dealId: 'c', weekId: '2026-W14', priceNumber: 3 }),
      ]);
      expect((component.chartData() as ChartData).labels).toEqual(['2026-W10', '2026-W14']);
    });
  });

  describe('pricesByStore grouping', () => {
    it('produces one dataset per store with data.length === labels.length', async () => {
      await setup([
        makeDeal({ dealId: '1', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W10', priceNumber: 2.99 }),
        makeDeal({ dealId: '2', storeInstanceId: 'safeway:xyz',     weekId: '2026-W11', priceNumber: 3.49 }),
      ]);
      const data = component.chartData() as ChartData;
      expect(data.datasets).toHaveLength(2);
      expect(data.datasets[0].data).toHaveLength(data.labels.length);
      expect(data.datasets[1].data).toHaveLength(data.labels.length);
    });

    it('uses null for store+week combinations that have no deal (verifies spanGaps: false)', async () => {
      await setup([
        makeDeal({ dealId: '1', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W10', priceNumber: 2.99 }),
        makeDeal({ dealId: '2', storeInstanceId: 'safeway:xyz',     weekId: '2026-W11', priceNumber: 3.49 }),
      ]);
      const data = component.chartData() as ChartData;
      // storeIds are sorted alphabetically: kingsoopers comes before safeway.
      const kingsoopers = data.datasets[0];
      const safeway = data.datasets[1];
      expect(kingsoopers.data).toEqual([2.99, null]);
      expect(safeway.data).toEqual([null, 3.49]);
    });

    it('keeps the lowest price when multiple deals exist for the same store+week', async () => {
      await setup([
        makeDeal({ dealId: '1', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W10', priceNumber: 3.49 }),
        makeDeal({ dealId: '2', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W10', priceNumber: 2.99 }),
      ]);
      const data = component.chartData() as ChartData;
      expect(data.datasets).toHaveLength(1);
      expect(data.datasets[0].data).toEqual([2.99]);
    });

    it('skips deals with a null priceNumber and does not create a dataset solely from them', async () => {
      await setup([
        makeDeal({ dealId: '1', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W10', priceNumber: 2.99 }),
        makeDeal({ dealId: '2', storeInstanceId: 'safeway:xyz',     weekId: '2026-W11', priceNumber: null }),
        makeDeal({ dealId: '3', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W12', priceNumber: 3.49 }),
      ]);
      const data = component.chartData() as ChartData;
      // safeway deal had null price → no safeway dataset.
      expect(data.datasets).toHaveLength(1);
      expect(data.datasets[0].label).toBe('King Soopers');
      // W11 stays in the labels (built from all deals) but the value is null.
      expect(data.labels).toEqual(['2026-W10', '2026-W11', '2026-W12']);
      expect(data.datasets[0].data).toEqual([2.99, null, 3.49]);
    });
  });

  describe('store label resolution', () => {
    it('uses the user store nickname when it matches the instance id', async () => {
      await setup(
        [
          makeDeal({ dealId: '1', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W10', priceNumber: 2.99 }),
          makeDeal({ dealId: '2', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W11', priceNumber: 3.49 }),
        ],
        [makeUserStore({ instanceId: 'kingsoopers:abc', name: 'My Local King Soopers' })],
      );
      const data = component.chartData() as ChartData;
      expect(data.datasets[0].label).toBe('My Local King Soopers');
    });

    it('falls back to getStoreDisplayName when no user store matches', async () => {
      await setup([
        makeDeal({ dealId: '1', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W10', priceNumber: 2.99 }),
        makeDeal({ dealId: '2', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W11', priceNumber: 3.49 }),
      ]);
      const data = component.chartData() as ChartData;
      expect(data.datasets[0].label).toBe('King Soopers');
    });
  });

  describe('historical-avg reference line', () => {
    it('appends a "Historical avg" dataset when any deal has rating.historicalAvg', async () => {
      await setup([
        makeDeal({
          dealId: '1',
          storeInstanceId: 'kingsoopers:abc',
          weekId: '2026-W10',
          priceNumber: 2.99,
          rating: makeRating({ historicalAvg: 2.5 }),
        }),
        makeDeal({
          dealId: '2',
          storeInstanceId: 'kingsoopers:abc',
          weekId: '2026-W11',
          priceNumber: 3.49,
        }),
      ]);
      const data = component.chartData() as ChartData;
      const avg = data.datasets.find((d) => d.label === 'Historical avg');
      expect(avg).toBeTruthy();
      expect(avg!.borderDash).toEqual([5, 5]);
      expect(avg!.data).toEqual([2.5, 2.5]);
    });

    it('does not append a "Historical avg" dataset when no deal has a rating', async () => {
      await setup([
        makeDeal({ dealId: '1', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W10', priceNumber: 2.99 }),
        makeDeal({ dealId: '2', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W11', priceNumber: 3.49 }),
      ]);
      const data = component.chartData() as ChartData;
      expect(data.datasets.some((d) => d.label === 'Historical avg')).toBe(false);
    });
  });

  describe('dataset color assignment', () => {
    it('assigns each store the base hue of its <p-tag> severity (kingsoopers→info/blue, safeway→danger/red, sprouts→success/green)', async () => {
      await setup([
        makeDeal({ dealId: '1', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W10', priceNumber: 2.99 }),
        makeDeal({ dealId: '2', storeInstanceId: 'safeway:xyz',     weekId: '2026-W11', priceNumber: 3.49 }),
        makeDeal({ dealId: '3', storeInstanceId: 'sprouts:foo',     weekId: '2026-W12', priceNumber: 1.99 }),
      ]);
      const data = component.chartData() as ChartData;
      // storeIds sort alphabetically: kingsoopers, safeway, sprouts.
      expect(data.datasets[0].borderColor).toBe('#3b82f6'); // info / --p-blue-500
      expect(data.datasets[1].borderColor).toBe('#ef4444'); // danger / --p-red-500
      expect(data.datasets[2].borderColor).toBe('#22c55e'); // success / --p-green-500
    });

    it('uses shaded variants of the same hue when multiple stores share a chain', async () => {
      await setup([
        makeDeal({ dealId: '1', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W10', priceNumber: 2.99 }),
        makeDeal({ dealId: '2', storeInstanceId: 'kingsoopers:def', weekId: '2026-W11', priceNumber: 3.49 }),
        makeDeal({ dealId: '3', storeInstanceId: 'kingsoopers:ghi', weekId: '2026-W12', priceNumber: 3.79 }),
      ]);
      const data = component.chartData() as ChartData;
      expect(data.datasets).toHaveLength(3);
      // Same hue ladder, three distinct shades in order.
      expect(data.datasets[0].borderColor).toBe('#3b82f6'); // blue-500
      expect(data.datasets[1].borderColor).toBe('#93c5fd'); // blue-300
      expect(data.datasets[2].borderColor).toBe('#1d4ed8'); // blue-700
      expect(new Set(data.datasets.map((d) => d.borderColor)).size).toBe(3);
    });

    it('counts shades independently per severity (two kingsoopers + two safeway each cycle their own ladder)', async () => {
      await setup([
        makeDeal({ dealId: '1', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W10', priceNumber: 2.99 }),
        makeDeal({ dealId: '2', storeInstanceId: 'kingsoopers:def', weekId: '2026-W11', priceNumber: 3.49 }),
        makeDeal({ dealId: '3', storeInstanceId: 'safeway:abc',     weekId: '2026-W10', priceNumber: 2.79 }),
        makeDeal({ dealId: '4', storeInstanceId: 'safeway:def',     weekId: '2026-W11', priceNumber: 3.29 }),
      ]);
      const data = component.chartData() as ChartData;
      // Sorted: kingsoopers:abc, kingsoopers:def, safeway:abc, safeway:def
      expect(data.datasets[0].borderColor).toBe('#3b82f6'); // blue-500 (1st info)
      expect(data.datasets[1].borderColor).toBe('#93c5fd'); // blue-300 (2nd info)
      expect(data.datasets[2].borderColor).toBe('#ef4444'); // red-500  (1st danger)
      expect(data.datasets[3].borderColor).toBe('#fca5a5'); // red-300  (2nd danger)
    });
  });

  describe('chartOptions', () => {
    it('sets maintainAspectRatio=false and responsive=true', async () => {
      await setup([
        makeDeal({ dealId: '1', weekId: '2026-W10' }),
        makeDeal({ dealId: '2', weekId: '2026-W11' }),
      ]);
      const opts = component.chartOptions() as ChartOptions;
      expect(opts.maintainAspectRatio).toBe(false);
      expect(opts.responsive).toBe(true);
    });

    it('formats the tooltip label as "<label>: $<price.toFixed(2)>"', async () => {
      await setup([
        makeDeal({ dealId: '1', weekId: '2026-W10' }),
        makeDeal({ dealId: '2', weekId: '2026-W11' }),
      ]);
      const opts = component.chartOptions() as ChartOptions;
      const out = opts.plugins.tooltip.callbacks.label({
        dataset: { label: 'King Soopers' },
        parsed: { y: 2.99 },
      });
      expect(out).toBe('King Soopers: $2.99');
    });

    it('returns an empty string from the tooltip label callback when parsed.y is null', async () => {
      await setup([
        makeDeal({ dealId: '1', weekId: '2026-W10' }),
        makeDeal({ dealId: '2', weekId: '2026-W11' }),
      ]);
      const opts = component.chartOptions() as ChartOptions;
      const out = opts.plugins.tooltip.callbacks.label({
        dataset: { label: 'King Soopers' },
        parsed: { y: null },
      });
      expect(out).toBe('');
    });

    it('formats y-axis tick values as US dollars to two decimals', async () => {
      await setup([
        makeDeal({ dealId: '1', weekId: '2026-W10' }),
        makeDeal({ dealId: '2', weekId: '2026-W11' }),
      ]);
      const opts = component.chartOptions() as ChartOptions;
      expect(opts.scales.y.ticks.callback(1.5)).toBe('$1.50');
      expect(opts.scales.y.ticks.callback('2')).toBe('$2.00');
    });
  });
});
