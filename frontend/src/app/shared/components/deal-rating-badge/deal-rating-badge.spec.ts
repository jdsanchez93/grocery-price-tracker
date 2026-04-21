import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DealRatingBadge } from './deal-rating-badge';
import { DealRating } from '../../../core/models/deal.model';

function makeRating(overrides: Partial<DealRating> = {}): DealRating {
  return {
    label: 'typical',
    percentVsAvg: 0,
    historicalAvg: 4.00,
    historicalMin: 3.50,
    sampleSize: 8,
    ...overrides,
  };
}

describe('DealRatingBadge', () => {
  let component: DealRatingBadge;
  let fixture: ComponentFixture<DealRatingBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DealRatingBadge],
    }).compileComponents();

    fixture = TestBed.createComponent(DealRatingBadge);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('rating', makeRating());
    fixture.detectChanges();
  });

  describe('config', () => {
    it('best → success severity, "Best Price", star icon', () => {
      fixture.componentRef.setInput('rating', makeRating({ label: 'best' }));
      fixture.detectChanges();
      const cfg = component.config();
      expect(cfg.severity).toBe('success');
      expect(cfg.value).toBe('Best Price');
      expect(cfg.icon).toBe('pi pi-star-fill');
    });

    it('good → success severity, "Good Deal", no icon', () => {
      fixture.componentRef.setInput('rating', makeRating({ label: 'good' }));
      fixture.detectChanges();
      const cfg = component.config();
      expect(cfg.severity).toBe('success');
      expect(cfg.value).toBe('Good Deal');
      expect(cfg.icon).toBeUndefined();
    });

    it('typical → secondary severity, "Typical"', () => {
      fixture.componentRef.setInput('rating', makeRating({ label: 'typical' }));
      fixture.detectChanges();
      const cfg = component.config();
      expect(cfg.severity).toBe('secondary');
      expect(cfg.value).toBe('Typical');
    });

    it('high → warn severity, "High"', () => {
      fixture.componentRef.setInput('rating', makeRating({ label: 'high' }));
      fixture.detectChanges();
      const cfg = component.config();
      expect(cfg.severity).toBe('warn');
      expect(cfg.value).toBe('High');
    });
  });

  describe('tooltip', () => {
    it('shows negative percent with no sign when below average', () => {
      fixture.componentRef.setInput('rating', makeRating({ percentVsAvg: -12, sampleSize: 6 }));
      fixture.detectChanges();
      expect(component.tooltip()).toBe('-12% vs avg (6 weeks)');
    });

    it('shows positive percent with + sign when above average', () => {
      fixture.componentRef.setInput('rating', makeRating({ percentVsAvg: 8, sampleSize: 4 }));
      fixture.detectChanges();
      expect(component.tooltip()).toBe('+8% vs avg (4 weeks)');
    });

    it('shows no sign when exactly at average', () => {
      fixture.componentRef.setInput('rating', makeRating({ percentVsAvg: 0, sampleSize: 10 }));
      fixture.detectChanges();
      expect(component.tooltip()).toBe('0% vs avg (10 weeks)');
    });
  });
});
