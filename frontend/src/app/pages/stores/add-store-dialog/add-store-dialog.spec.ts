import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AddStoreDialog } from './add-store-dialog';
import { StoresService } from '@/app/core/services/stores.service';
import { AvailableStore } from '@/app/core/models/store.model';

function makeAvailableStore(overrides: Partial<AvailableStore> = {}): AvailableStore {
  return {
    instanceId: 'kingsoopers:abc',
    name: 'KS #1',
    storeType: 'kingsoopers',
    identifiers: {},
    enabled: true,
    ...overrides,
  };
}

function makeMockStoresService() {
  return {
    loading: signal(false),
    loadingAvailable: signal(false),
    error: signal<string | null>(null),
    getAvailableStoreTypeOptions: signal([
      { value: 'kingsoopers', label: 'King Soopers', disabled: false },
      { value: 'safeway', label: 'Safeway', disabled: false },
    ]),
    getAvailableStoresByType: vi.fn().mockReturnValue([makeAvailableStore()]),
    loadAllStores: vi.fn(),
  };
}

describe('AddStoreDialog', () => {
  let component: AddStoreDialog;
  let fixture: ComponentFixture<AddStoreDialog>;
  let mockStoresService: ReturnType<typeof makeMockStoresService>;

  beforeEach(async () => {
    mockStoresService = makeMockStoresService();

    await TestBed.configureTestingModule({
      imports: [AddStoreDialog],
      providers: [
        { provide: StoresService, useValue: mockStoresService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddStoreDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('open() should set visible to true', () => {
    expect(component.visible()).toBe(false);
    component.open();
    expect(component.visible()).toBe(true);
  });

  it('onDialogHide() should reset state', () => {
    component.selectedStoreType.set('kingsoopers');
    component.selectedLocation.set('kingsoopers:abc');

    component.onDialogHide();

    expect(component.selectedStoreType()).toBeNull();
    expect(component.selectedLocation()).toBeNull();
  });

  it('onStoreTypeChange() should call loadAllStores and reset location', () => {
    component.selectedLocation.set('kingsoopers:abc');
    component.selectedStoreType.set('kingsoopers');
    component.onStoreTypeChange();

    expect(component.selectedLocation()).toBeNull();
    expect(mockStoresService.loadAllStores).toHaveBeenCalled();
  });

  it('onStoreTypeChange() should reset selectedLocation', () => {
    component.selectedLocation.set('kingsoopers:abc');
    component.selectedStoreType.set('safeway');
    component.onStoreTypeChange();

    expect(component.selectedLocation()).toBeNull();
  });

  it('canAddStore should be false when no type or location selected', () => {
    expect(component.canAddStore()).toBe(false);

    component.selectedStoreType.set('kingsoopers');
    expect(component.canAddStore()).toBe(false);

    component.selectedStoreType.set(null);
    component.selectedLocation.set('kingsoopers:abc');
    expect(component.canAddStore()).toBe(false);
  });

  it('canAddStore should be true when both type and location are set', () => {
    component.selectedStoreType.set('kingsoopers');
    component.selectedLocation.set('kingsoopers:abc');
    expect(component.canAddStore()).toBe(true);
  });

  it('addSelectedStore() should emit storeAdded and close dialog', () => {
    const emitted: string[] = [];
    component.storeAdded.subscribe(v => emitted.push(v));

    component.open();
    component.selectedLocation.set('kingsoopers:abc');
    component.addSelectedStore();

    expect(emitted).toEqual(['kingsoopers:abc']);
    expect(component.visible()).toBe(false);
  });

  it('addSelectedStore() should not emit when no location selected', () => {
    const emitted: string[] = [];
    component.storeAdded.subscribe(v => emitted.push(v));

    component.addSelectedStore();

    expect(emitted).toEqual([]);
  });

  it('locationOptions should filter to enabled stores', () => {
    mockStoresService.getAvailableStoresByType.mockReturnValue([
      makeAvailableStore({ instanceId: 'kingsoopers:a', name: 'KS #1', enabled: true }),
      makeAvailableStore({ instanceId: 'kingsoopers:b', name: 'KS #2', enabled: false }),
    ]);
    component.selectedStoreType.set('kingsoopers');

    const options = component.locationOptions();
    expect(options.length).toBe(1);
    expect(options[0].value).toBe('kingsoopers:a');
  });

  describe('locationOptions — address label formatting', () => {
    it('uses just the store name when no address', () => {
      mockStoresService.getAvailableStoresByType.mockReturnValue([
        makeAvailableStore({ instanceId: 'kingsoopers:a', name: 'Pearl St' }),
      ]);
      component.selectedStoreType.set('kingsoopers');

      const options = component.locationOptions();
      expect(options[0].label).toBe('Pearl St');
    });

    it('appends full address when addressLine1 is present', () => {
      mockStoresService.getAvailableStoresByType.mockReturnValue([
        makeAvailableStore({
          instanceId: 'kingsoopers:a', name: 'Pearl St',
          address: { addressLine1: '1234 Pearl St', city: 'Boulder', state: 'CO', zipCode: '80000' },
        }),
      ]);
      component.selectedStoreType.set('kingsoopers');

      const options = component.locationOptions();
      expect(options[0].label).toBe('Pearl St — 1234 Pearl St, Boulder, CO');
    });

    it('appends city and state when addressLine1 is absent', () => {
      mockStoresService.getAvailableStoresByType.mockReturnValue([
        makeAvailableStore({
          instanceId: 'kingsoopers:a', name: 'Pearl St',
          address: { addressLine1: '', city: 'Boulder', state: 'CO' },
        }),
      ]);
      component.selectedStoreType.set('kingsoopers');

      const options = component.locationOptions();
      expect(options[0].label).toBe('Pearl St — Boulder, CO');
    });

    it('does not append anything for disabled stores (they are filtered out)', () => {
      mockStoresService.getAvailableStoresByType.mockReturnValue([
        makeAvailableStore({
          instanceId: 'kingsoopers:a', name: 'Pearl St', enabled: false,
          address: { addressLine1: '123 Main St', city: 'Denver', state: 'CO' },
        }),
      ]);
      component.selectedStoreType.set('kingsoopers');

      expect(component.locationOptions()).toHaveLength(0);
    });
  });
});
