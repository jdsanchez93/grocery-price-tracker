import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { AddStoreDialog } from './add-store-dialog';
import { StoresService } from '@/app/core/services/stores.service';

function makeMockStoresService() {
  return {
    loading: signal(false),
    loadingAvailable: signal(false),
    error: signal<string | null>(null),
    getAvailableStoreTypeOptions: signal([
      { value: 'kingsoopers', label: 'King Soopers', disabled: false },
      { value: 'safeway', label: 'Safeway', disabled: false },
    ]),
    getAvailableStores: signal([
      { instanceId: 'kingsoopers:abc', name: 'KS #1', storeType: 'kingsoopers', identifiers: {}, enabled: true },
    ]),
    loadAvailableStores: vi.fn(),
    clearAvailableStores: vi.fn(),
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

  it('onDialogHide() should reset state and clear available stores', () => {
    component.selectedStoreType.set('kingsoopers');
    component.selectedLocation.set('kingsoopers:abc');

    component.onDialogHide();

    expect(component.selectedStoreType()).toBeNull();
    expect(component.selectedLocation()).toBeNull();
    expect(mockStoresService.clearAvailableStores).toHaveBeenCalled();
  });

  it('onStoreTypeChange() should load available stores when type selected', () => {
    component.selectedStoreType.set('kingsoopers');
    component.onStoreTypeChange();

    expect(mockStoresService.loadAvailableStores).toHaveBeenCalledWith('kingsoopers');
  });

  it('onStoreTypeChange() should clear available stores when type is null', () => {
    component.selectedStoreType.set(null);
    component.onStoreTypeChange();

    expect(mockStoresService.clearAvailableStores).toHaveBeenCalled();
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
    (mockStoresService.getAvailableStores as WritableSignal<unknown[]>).set([
      { instanceId: 'kingsoopers:a', name: 'KS #1', storeType: 'kingsoopers', identifiers: {}, enabled: true },
      { instanceId: 'kingsoopers:b', name: 'KS #2', storeType: 'kingsoopers', identifiers: {}, enabled: false },
    ]);

    const options = component.locationOptions();
    expect(options.length).toBe(1);
    expect(options[0].value).toBe('kingsoopers:a');
  });
});
