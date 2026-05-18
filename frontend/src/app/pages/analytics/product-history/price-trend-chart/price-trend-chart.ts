import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { Deal } from '../../../../core/models/deal.model';
import { StoresService } from '../../../../core/services/stores.service';
import { getStoreDisplayName, getStoreSeverity, TagSeverity } from '../../../../core/models/store.model';

/**
 * Resolved at runtime so dark/light theme tokens apply correctly.
 * Returns the empty string in non-browser environments.
 */
function readCssVar(name: string, fallback: string): string {
  if (typeof getComputedStyle === 'undefined' || typeof document === 'undefined') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Per-severity shade ladder: index 0 = base hue (matches the <p-tag> color),
 * additional indices step lighter/darker so multiple stores of the same chain stay
 * grouped by hue but remain visually distinguishable.
 */
const SEVERITY_SHADE_VARS: Record<TagSeverity, readonly string[]> = {
  info:      ['--p-blue-500',    '--p-blue-300',    '--p-blue-700'],
  success:   ['--p-green-500',   '--p-green-300',   '--p-green-700'],
  warn:      ['--p-amber-500',   '--p-amber-300',   '--p-amber-700'],
  danger:    ['--p-red-500',     '--p-red-300',     '--p-red-700'],
  secondary: ['--p-surface-500', '--p-surface-300', '--p-surface-700'],
  contrast:  ['--p-text-color',  '--p-text-color',  '--p-text-color'],
};

const SEVERITY_SHADE_FALLBACKS: Record<TagSeverity, readonly string[]> = {
  info:      ['#3b82f6', '#93c5fd', '#1d4ed8'],
  success:   ['#22c55e', '#86efac', '#15803d'],
  warn:      ['#f59e0b', '#fcd34d', '#b45309'],
  danger:    ['#ef4444', '#fca5a5', '#b91c1c'],
  secondary: ['#64748b', '#cbd5e1', '#334155'],
  contrast:  ['#334155', '#334155', '#334155'],
};

@Component({
  selector: 'app-price-trend-chart',
  imports: [ChartModule],
  template: `
    @if (hasEnoughHistory()) {
      <p-chart
        type="line"
        [data]="chartData()"
        [options]="chartOptions()"
        [responsive]="true"
        height="320px"
        ariaLabel="Price trend over time per store"
      />
    } @else {
      <div class="empty-state" role="status">Not enough history yet to plot a trend.</div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .empty-state {
      padding: 1.5rem;
      text-align: center;
      color: var(--p-text-muted-color);
      background: var(--p-surface-card);
      border: 1px dashed var(--p-surface-border);
      border-radius: var(--p-border-radius, 6px);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceTrendChart {
  readonly history = input.required<Deal[]>();

  private storesService = inject(StoresService);

  hasEnoughHistory = computed(() => this.history().length >= 2);

  /** Sorted oldest → newest, unique weekIds (ISO `YYYY-Www` sorts lexically). */
  private weekLabels = computed(() => {
    const weeks = new Set<string>();
    for (const deal of this.history()) {
      weeks.add(deal.weekId);
    }
    return [...weeks].sort();
  });

  /** Map of storeInstanceId → (weekId → priceNumber). */
  private pricesByStore = computed(() => {
    const map = new Map<string, Map<string, number>>();
    for (const deal of this.history()) {
      if (deal.priceNumber == null) continue;
      let storePrices = map.get(deal.storeInstanceId);
      if (!storePrices) {
        storePrices = new Map();
        map.set(deal.storeInstanceId, storePrices);
      }
      // If multiple deals exist for the same store+week, keep the lowest price.
      const existing = storePrices.get(deal.weekId);
      if (existing == null || deal.priceNumber < existing) {
        storePrices.set(deal.weekId, deal.priceNumber);
      }
    }
    return map;
  });

  /** First non-empty rating provides historicalAvg (same value for all items of one product). */
  private historicalAvg = computed<number | null>(() => {
    for (const deal of this.history()) {
      if (deal.rating?.historicalAvg != null) {
        return deal.rating.historicalAvg;
      }
    }
    return null;
  });

  private storeDisplayName(instanceId: string): string {
    const userStore = this.storesService.getUserStores().find((s) => s.instanceId === instanceId);
    return userStore?.name ?? getStoreDisplayName(instanceId);
  }

  chartData = computed(() => {
    const labels = this.weekLabels();
    const prices = this.pricesByStore();
    const storeIds = [...prices.keys()].sort();

    // Track how many stores of each severity we've assigned so multiple stores
    // of the same chain get distinct shades from the same hue ladder.
    const shadeIndexBySeverity = new Map<TagSeverity, number>();

    const datasets = storeIds.map((storeId) => {
      const storePrices = prices.get(storeId)!;
      const severity = getStoreSeverity(storeId);
      const shadeIndex = shadeIndexBySeverity.get(severity) ?? 0;
      shadeIndexBySeverity.set(severity, shadeIndex + 1);
      const vars = SEVERITY_SHADE_VARS[severity];
      const fallbacks = SEVERITY_SHADE_FALLBACKS[severity];
      const colorVar = vars[shadeIndex % vars.length];
      const fallback = fallbacks[shadeIndex % fallbacks.length];
      const color = readCssVar(colorVar, fallback);
      return {
        label: this.storeDisplayName(storeId),
        data: labels.map((week) => storePrices.get(week) ?? null),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        tension: 0.3,
        spanGaps: false,
        pointRadius: 3,
        pointHoverRadius: 5,
      };
    });

    const avg = this.historicalAvg();
    if (avg != null) {
      const mutedColor = readCssVar('--p-text-muted-color', '#94a3b8');
      datasets.push({
        label: 'Historical avg',
        data: labels.map(() => avg),
        borderColor: mutedColor,
        backgroundColor: mutedColor,
        borderWidth: 1,
        borderDash: [5, 5],
        tension: 0,
        spanGaps: true,
        pointRadius: 0,
        pointHoverRadius: 0,
      } as (typeof datasets)[number] & { borderDash: number[] });
    }

    return { labels, datasets };
  });

  chartOptions = computed(() => {
    const textColor = readCssVar('--p-text-color', '#334155');
    const textMutedColor = readCssVar('--p-text-muted-color', '#64748b');
    const borderColor = readCssVar('--p-surface-border', '#e2e8f0');

    return {
      maintainAspectRatio: false,
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          labels: { color: textColor, usePointStyle: true },
        },
        tooltip: {
          callbacks: {
            label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
              const value = ctx.parsed.y;
              if (value == null) return '';
              const label = ctx.dataset.label ?? '';
              return `${label}: $${value.toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textMutedColor },
          grid: { color: borderColor, display: false },
        },
        y: {
          ticks: {
            color: textMutedColor,
            callback: (value: number | string) => `$${Number(value).toFixed(2)}`,
          },
          grid: { color: borderColor },
        },
      },
    };
  });
}
