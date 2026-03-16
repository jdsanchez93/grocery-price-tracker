import { STORE_SEVERITY, STORE_TYPE_METADATA, StoreAddress, StoreType } from '@/app/core/models/store.model';
import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

export interface StoreStat {
  label: string;
  value: string | number;
}
import { CardModule } from 'primeng/card';
import { TagModule } from "primeng/tag";

@Component({
  selector: 'app-store-card',
  imports: [CardModule, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <ng-template #title>
        <p-tag
          [severity]="this.tagSeverity()"
          [value]="this.storeDisplayName()"
        />
      </ng-template>
      <ng-template #subtitle>{{name()}}</ng-template>
      <ng-template #content>
        @if (address()) {
          <div class="store-address">
            @if (address()?.addressLine1) {
              <div>{{address()!.addressLine1}}</div>
            }
            <div>{{address()!.city}}, {{address()!.state}}</div>
          </div>
        }
        @if (stats()?.length) {
          <div class="store-stats">
            @for (stat of stats(); track stat.label) {
              <div class="store-stat">
                <span class="stat-label">{{stat.label}}:</span>
                <span class="stat-value">{{stat.value}}</span>
              </div>
            }
          </div>
        }
      </ng-template>
      <ng-template #footer>
          <div class="flex gap-2 mt-1">
            <ng-content />
          </div>
      </ng-template>
    </p-card>
  `,
  styles: `
    .store-stats {
      margin-top: 0.5rem;
    }
    .store-stat {
      display: flex;
      gap: 0.25rem;
      font-size: 0.85rem;
    }
    .stat-label {
      color: var(--p-text-muted-color);
    }
    .stat-value {
      font-weight: 500;
    }
  `,
})
export class StoreCard {
  name = input.required<string>();
  storeType = input.required<StoreType>();
  address = input<StoreAddress | undefined>();
  stats = input<StoreStat[]>();

  private storeMetadata = computed(() => STORE_TYPE_METADATA[this.storeType()]);

  storeDisplayName = computed(() => this.storeMetadata()?.name ?? this.storeType());
  tagSeverity = computed(() => STORE_SEVERITY[this.storeType()]);
}
