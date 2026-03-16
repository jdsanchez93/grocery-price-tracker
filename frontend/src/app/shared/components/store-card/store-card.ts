import { STORE_SEVERITY, STORE_TYPE_METADATA, StoreAddress, StoreType } from '@/app/core/models/store.model';
import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
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
      </ng-template>
      <ng-template #footer>
          <div class="flex gap-2 mt-1">
            <ng-content />
          </div>
      </ng-template>
    </p-card>
  `,
  styles: `
  `,
})
export class StoreCard {
  name = input.required<string>();
  storeType = input.required<StoreType>();
  address = input<StoreAddress | undefined>();

  private storeMetadata = computed(() => STORE_TYPE_METADATA[this.storeType()]);

  storeDisplayName = computed(() => this.storeMetadata()?.name ?? this.storeType());
  tagSeverity = computed(() => STORE_SEVERITY[this.storeType()]);
}
