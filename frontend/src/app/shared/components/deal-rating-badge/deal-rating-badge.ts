import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DealRating } from '../../../core/models/deal.model';

type TagSeverity = 'success' | 'secondary' | 'warn';

const RATING_CONFIG: Record<DealRating['label'], { severity: TagSeverity; value: string; icon?: string }> = {
  best:    { severity: 'success',   value: 'Best Price', icon: 'pi pi-star-fill' },
  good:    { severity: 'success',   value: 'Good Deal' },
  typical: { severity: 'secondary', value: 'Typical' },
  high:    { severity: 'warn',      value: 'High' },
};

@Component({
  selector: 'app-deal-rating-badge',
  imports: [TagModule, TooltipModule],
  template: `
    <p-tag
      [severity]="config().severity"
      [value]="config().value"
      [icon]="config().icon ?? ''"
      [pTooltip]="tooltip()"
      tooltipPosition="top"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealRatingBadge {
  rating = input.required<DealRating>();

  config = computed(() => RATING_CONFIG[this.rating().label]);

  tooltip = computed(() => {
    const r = this.rating();
    const sign = r.percentVsAvg > 0 ? '+' : '';
    return `${sign}${r.percentVsAvg}% vs avg (${r.sampleSize} weeks)`;
  });
}
