import { Component, computed, inject, signal } from '@angular/core';
import { Card } from "primeng/card";
import { StoresService } from '../../core/services/stores.service';
import { Button } from "primeng/button";
import { Admin } from '../../core/services/admin';
import { DealsService } from '../../core/services/deals.service';
import { Tag } from "primeng/tag";
import { STORE_TYPE_METADATA, StoreType } from '../../core/models/deal.model';
import { Toast } from "primeng/toast";
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-scrape-management',
  imports: [Card, Button, Tag, Toast],
  providers: [MessageService],
  templateUrl: './scrape-management.html',
  styleUrl: './scrape-management.css'
})
export class ScrapeManagement {
  private storesService = inject(StoresService);
  private adminService = inject(Admin);
  private dealsService = inject(DealsService);
  private messageService = inject(MessageService);

  stores = this.storesService.getUserStores;
  deals = this.dealsService.getDeals;

  loading = signal<Set<string>>(new Set());
  error = signal<string | null>(null);

  alreadyScraped = computed(() => {
    const uniqueInstanceIds = new Set(this.deals().map(deal => deal.storeInstanceId));
    return uniqueInstanceIds;
  });

  scrapeStore(instanceId: string, force: boolean = false) {
    this.loading.update(s => { s.add(instanceId); return new Set(s); });
    this.error.set(null);
    this.adminService.initiateScrape(instanceId, force).subscribe({
      next: () => {
        this.loading.update(s => { s.delete(instanceId); return new Set(s); });
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `${instanceId} has been scraped successfully.`
        });
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to initiate scrape');
        this.loading.update(s => { s.delete(instanceId); return new Set(s); });
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: this.error()!
        });
      }
    });
  }
  getStoreTypeName(type: StoreType): string {
    return STORE_TYPE_METADATA[type]?.name ?? type;
  }
}
