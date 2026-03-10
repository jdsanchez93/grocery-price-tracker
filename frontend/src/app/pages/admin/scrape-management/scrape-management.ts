import { AdminService } from '@/app/core/services/admin.service';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { StoreCard } from "@/app/shared/components/store-card/store-card";
import { ButtonModule, ButtonSeverity } from "primeng/button";
import { AvailableStore } from '@/app/core/models/store.model';
import { map, switchMap } from 'rxjs';
import { ScrapeStatusResponse } from '@/app/core/models/admin.model';

@Component({
  selector: 'app-scrape-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToastModule, StoreCard, ButtonModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
        @for (store of allStores(); track store.instanceId) {
          <app-store-card [name]="store.name" [storeType]="store.storeType">
            <p-button                                             
              [label]="scrapeLabel(store.instanceId)"                                                                                                                                                                                                                   
              (click)="scrapeStore(store.instanceId, !scrapeStatus()[store.instanceId]?.scraped ? false : true)" 
              [loading]="scrapingInProgress().has(store.instanceId)" 
              [severity]="scrapeSeverity(store.instanceId)" />
          </app-store-card>
        }
    </div>
  `,
  styles: ``,
})
export class ScrapeManagement implements OnInit {
  private adminService = inject(AdminService);
  private messageService = inject(MessageService);

  error = signal<string | null>(null);
  loading = signal<boolean>(false);

  // track loading per instanceId
  scrapingInProgress = signal<Set<string>>(new Set());

  allStores = signal<AvailableStore[]>([]);
  scrapeStatus = signal<ScrapeStatusResponse>({});

  ngOnInit(): void {
    this.loading.set(true);
    this.error.set(null);

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
        error: (err) => {
          this.error.set(err.message || 'Failed to initialize');
          this.loading.set(false);
        }
      });
  }

  scrapeLabel(instanceId: string): string {
    const status = this.scrapeStatus()[instanceId];
    return status?.scraped ? `Force Re-scrape (${status.dealCount} deals)` : 'Scrape';
  }

  scrapeSeverity(instanceId: string): ButtonSeverity {
    const status = this.scrapeStatus()[instanceId];
    return status?.scraped ? 'warn' : 'primary'
  }

  scrapeStore(instanceId: string, force: boolean = false) {
    this.scrapingInProgress.update(s => { s.add(instanceId); return new Set(s); });
    this.error.set(null);
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
        error: (err) => {
          this.error.set(err.message || 'Failed to initiate scrape');
          this.scrapingInProgress.update(s => { s.delete(instanceId); return new Set(s); });
          this.messageService.add({
            severity: 'error',
            summary: 'Scraping error',
            detail: this.error()!
          });
        }
      });
  }
}
