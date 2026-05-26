import { AdminService } from '@/app/core/services/admin.service';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { StoreCard, StoreStat } from "@/app/shared/components/store-card/store-card";
import { ButtonModule, ButtonSeverity } from "primeng/button";
import { AvailableStore } from '@/app/core/models/store.model';
import { map, switchMap } from 'rxjs';
import { PreviewAvailabilityResponse, ScrapeStatusResponse } from '@/app/core/models/admin.model';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-scrape-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StoreCard, ButtonModule, SkeletonModule],
  template: `
    @if (loading()) {
      <div class="store-grid">
          @for (_ of skeletonItems; track $index) {
            <p-skeleton height="170px" borderRadius="var(--card-border-radius, 12px)" />
          }
      </div>
    } @else {
      <div class="action-bar">
        <p-button
          label="Check preview availability"
          icon="pi pi-search"
          severity="secondary"
          (click)="checkPreviewAvailability()"
          [loading]="checkingPreview()"
          [disabled]="allStores().length === 0"
          data-testid="check-preview-availability" />
      </div>

      <div class="preview-results" aria-live="polite">
        @if (previewResults(); as results) {
          <div class="preview-panel" data-testid="preview-panel">
            <div class="preview-panel__header">
              <h3 class="preview-panel__title">Preview availability</h3>
              <p-button
                icon="pi pi-times"
                severity="secondary"
                [text]="true"
                [rounded]="true"
                ariaLabel="Dismiss preview availability results"
                (click)="dismissPreviewResults()" />
            </div>
            <ul class="preview-panel__list">
              @for (row of results; track row.instanceId) {
                <li class="preview-panel__row">
                  <span class="preview-panel__store">{{ row.name }}</span>
                  <span class="preview-panel__status">{{ row.status }}</span>
                </li>
              }
            </ul>
          </div>
        }
      </div>

      <div class="store-grid">
          @for (store of allStores(); track store.instanceId) {
            <app-store-card [name]="store.name" [storeType]="store.storeType" [address]="store.address" [stats]="storeStats(store.instanceId)">
              <p-button
                [label]="scrapeLabel(store.instanceId)"
                (click)="scrapeStore(store.instanceId, !scrapeStatus()[store.instanceId]?.scraped ? false : true)"
                [loading]="scrapingInProgress().has(store.instanceId)"
                [severity]="scrapeSeverity(store.instanceId)" />
            </app-store-card>
          }
      </div>
    }
  `,
  styles: `
    .action-bar {
      display: flex;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }
    .preview-panel {
      margin-top: 1rem;
      padding: 1rem 1.25rem;
      border: 1px solid var(--surface-border, #e0e0e0);
      border-radius: var(--card-border-radius, 12px);
      background: var(--surface-card, #fff);
    }
    .preview-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    .preview-panel__title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
    }
    .preview-panel__list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .preview-panel__row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.25rem 0;
    }
    .preview-panel__store {
      font-weight: 500;
    }
    .preview-panel__status {
      color: var(--text-color-secondary, #555);
    }
    .store-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 1.5rem;
    }
  `,
})
export class ScrapeManagement implements OnInit {
  private adminService = inject(AdminService);
  private messageService = inject(MessageService);

  loading = signal<boolean>(false);

  // track loading per instanceId
  scrapingInProgress = signal<Set<string>>(new Set());

  allStores = signal<AvailableStore[]>([]);
  scrapeStatus = signal<ScrapeStatusResponse>({});

  // Preview-availability check state. `previewResults` is null until the user
  // runs a check; rendered rows include the store's display name so the panel
  // doesn't need to look up against `allStores` on every render.
  checkingPreview = signal<boolean>(false);
  previewResults = signal<ReadonlyArray<{ instanceId: string; name: string; status: string }> | null>(null);

  skeletonItems = [1, 2, 3, 4];

  ngOnInit(): void {
    this.loading.set(true);

    this.adminService.getAllStores()
      .pipe(
        switchMap(stores => {
          return this.adminService.getScrapeStatus(stores.map(s => s.instanceId))
            .pipe(
              map(status => { return { status, stores } })
            )
        })
      )
      .subscribe({
        next: ({ status, stores }) => {
          this.allStores.set(stores);
          this.scrapeStatus.set(status);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        }
      });
  }

  scrapeLabel(instanceId: string): string {
    const status = this.scrapeStatus()[instanceId];
    return status?.scraped ? 'Force Re-scrape' : 'Scrape';
  }

  storeStats(instanceId: string): StoreStat[] {
    const status = this.scrapeStatus()[instanceId];
    return status?.scraped && status.dealCount
      ? [{ label: 'Deals this week', value: status.dealCount }]
      : [{ label: 'Deals this week', value: 'Not scraped' }];
  }

  scrapeSeverity(instanceId: string): ButtonSeverity {
    const status = this.scrapeStatus()[instanceId];
    return status?.scraped ? 'warn' : 'primary'
  }

  checkPreviewAvailability(): void {
    const instanceIds = this.allStores().map(s => s.instanceId);
    if (instanceIds.length === 0) return;

    this.checkingPreview.set(true);
    this.adminService.checkPreviewAvailability(instanceIds).subscribe({
      next: (res: PreviewAvailabilityResponse) => {
        const nameById = new Map(this.allStores().map(s => [s.instanceId, s.name]));
        const rows = instanceIds.map(id => {
          const entry = res.availability[id];
          return {
            instanceId: id,
            name: nameById.get(id) ?? id,
            status: formatPreviewStatus(entry),
          };
        });
        this.previewResults.set(rows);
        this.checkingPreview.set(false);
      },
      error: () => {
        this.checkingPreview.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Check failed',
          detail: 'Could not check preview availability. Try again.',
        });
      },
    });
  }

  dismissPreviewResults(): void {
    this.previewResults.set(null);
  }

  scrapeStore(instanceId: string, force: boolean = false) {
    this.scrapingInProgress.update(s => { s.add(instanceId); return new Set(s); });
    this.adminService.autoScrapeStore(instanceId, force)
      .subscribe({
        next: (res) => {
          this.scrapingInProgress.update(s => { s.delete(instanceId); return new Set(s); });
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `${instanceId} has been scraped successfully.`
          });
          const dealCount = res.alreadyScraped ? res.existingDealCount : res.dealCount;
          this.scrapeStatus.update(s => ({
            ...s,
            [instanceId]: { scraped: true, dealCount: dealCount, circularId: res.circularId }
          }));
        },
        error: () => {
          this.scrapingInProgress.update(s => { s.delete(instanceId); return new Set(s); });
        }
      });
  }
}

function formatPreviewStatus(entry: { available: boolean; startDate?: string; endDate?: string; reason?: string; message?: string } | undefined): string {
  if (!entry) return 'No response';
  if (entry.available && entry.startDate && entry.endDate) {
    return `Preview ready (${entry.startDate} – ${entry.endDate})`;
  }
  if (entry.available) return 'Preview ready';
  switch (entry.reason) {
    case 'store_not_found':
      return 'Store not found';
    case 'not_implemented':
      return 'Not supported for this store type';
    case 'upstream_error':
      return `Error: ${entry.message ?? 'upstream unavailable'}`;
    default:
      return 'Not yet published';
  }
}
