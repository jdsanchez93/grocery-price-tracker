import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Onboarding } from './onboarding';
import { StoresService } from '@/app/core/services/stores.service';
import { ProfileService } from '@/app/core/services/profile.service';
import { AvailableStore } from '@/app/core/models/store.model';

function makeAvailableStore(overrides: Partial<AvailableStore> = {}): AvailableStore {
  return {
    instanceId: 'kingsoopers:abc',
    name: 'King Soopers',
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
    addStore: vi.fn().mockReturnValue(of(undefined)),
    loadAllStores: vi.fn(),
    getAvailableStoresByType: vi.fn().mockReturnValue([makeAvailableStore()]),
  };
}

function makeMockProfileService() {
  return {
    markOnboarded: vi.fn().mockReturnValue(of({ success: true })),
  };
}

describe('Onboarding', () => {
  let mockStoresService: ReturnType<typeof makeMockStoresService>;
  let mockProfileService: ReturnType<typeof makeMockProfileService>;

  function setup() {
    mockStoresService = makeMockStoresService();
    mockProfileService = makeMockProfileService();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: StoresService, useValue: mockStoresService },
        { provide: ProfileService, useValue: mockProfileService },
      ],
    });

    const fixture = TestBed.createComponent(Onboarding);
    fixture.detectChanges();
    return fixture;
  }

  it('should create', () => {
    const fixture = setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should start on step 1', () => {
    const fixture = setup();
    expect(fixture.componentInstance.activeStep()).toBe(1);
  });

  describe('storeTypeOptions', () => {
    it('should return an option for each supported store type', () => {
      const fixture = setup();
      const options = fixture.componentInstance.storeTypeOptions();
      expect(options.length).toBe(3);
      expect(options.map(o => o.value)).toEqual(['kingsoopers', 'safeway', 'sprouts']);
    });

    it('should use display names as labels', () => {
      const fixture = setup();
      const options = fixture.componentInstance.storeTypeOptions();
      expect(options.find(o => o.value === 'kingsoopers')?.label).toBe('King Soopers');
      expect(options.find(o => o.value === 'safeway')?.label).toBe('Safeway');
      expect(options.find(o => o.value === 'sprouts')?.label).toBe('Sprouts');
    });
  });

  describe('locationOptions', () => {
    it('should return empty array when no store type selected', () => {
      const fixture = setup();
      expect(fixture.componentInstance.locationOptions()).toHaveLength(0);
    });

    it('should filter out disabled stores', () => {
      const fixture = setup();
      mockStoresService.getAvailableStoresByType.mockReturnValue([
        makeAvailableStore({ instanceId: 'kingsoopers:a', enabled: true }),
        makeAvailableStore({ instanceId: 'kingsoopers:b', enabled: false }),
      ]);
      fixture.componentInstance.selectedStoreType.set('kingsoopers');
      const options = fixture.componentInstance.locationOptions();
      expect(options.length).toBe(1);
      expect(options[0].value).toBe('kingsoopers:a');
    });

    it('should format label with full address when addressLine1 is present', () => {
      const fixture = setup();
      mockStoresService.getAvailableStoresByType.mockReturnValue([
        makeAvailableStore({
          name: 'King Soopers',
          address: { addressLine1: '123 Main St', city: 'Denver', state: 'CO' },
        }),
      ]);
      fixture.componentInstance.selectedStoreType.set('kingsoopers');
      const label = fixture.componentInstance.locationOptions()[0].label;
      expect(label).toBe('King Soopers — 123 Main St, Denver, CO');
    });

    it('should omit addressLine1 from label when not present', () => {
      const fixture = setup();
      mockStoresService.getAvailableStoresByType.mockReturnValue([
        makeAvailableStore({
          name: 'Safeway',
          storeType: 'safeway',
          address: { addressLine1: '', city: 'Denver', state: 'CO' },
        }),
      ]);
      fixture.componentInstance.selectedStoreType.set('safeway');
      const label = fixture.componentInstance.locationOptions()[0].label;
      expect(label).toBe('Safeway — Denver, CO');
    });

    it('should omit address suffix when no address', () => {
      const fixture = setup();
      mockStoresService.getAvailableStoresByType.mockReturnValue([
        makeAvailableStore({ name: 'Sprouts' }),
      ]);
      fixture.componentInstance.selectedStoreType.set('kingsoopers');
      const label = fixture.componentInstance.locationOptions()[0].label;
      expect(label).toBe('Sprouts');
    });
  });

  describe('selectedStore', () => {
    it('should return null when no location is selected', () => {
      const fixture = setup();
      expect(fixture.componentInstance.selectedStore()).toBeNull();
    });

    it('should return the matching available store when a location is selected', () => {
      const fixture = setup();
      const store = makeAvailableStore({ instanceId: 'kingsoopers:abc' });
      mockStoresService.getAvailableStoresByType.mockReturnValue([store]);
      fixture.componentInstance.selectedStoreType.set('kingsoopers');
      fixture.componentInstance.selectedLocation.set('kingsoopers:abc');
      expect(fixture.componentInstance.selectedStore()).toEqual(store);
    });

    it('should return null when selected instanceId does not match any store', () => {
      const fixture = setup();
      mockStoresService.getAvailableStoresByType.mockReturnValue([
        makeAvailableStore({ instanceId: 'kingsoopers:abc' }),
      ]);
      fixture.componentInstance.selectedStoreType.set('kingsoopers');
      fixture.componentInstance.selectedLocation.set('safeway:xyz');
      expect(fixture.componentInstance.selectedStore()).toBeNull();
    });
  });

  describe('canProceedToConfirm', () => {
    it('should be false when both type and location are null', () => {
      const fixture = setup();
      expect(fixture.componentInstance.canProceedToConfirm()).toBe(false);
    });

    it('should be false when only type is selected', () => {
      const fixture = setup();
      fixture.componentInstance.selectedStoreType.set('kingsoopers');
      expect(fixture.componentInstance.canProceedToConfirm()).toBe(false);
    });

    it('should be false when only location is selected', () => {
      const fixture = setup();
      fixture.componentInstance.selectedLocation.set('kingsoopers:abc');
      expect(fixture.componentInstance.canProceedToConfirm()).toBe(false);
    });

    it('should be true when both type and location are selected', () => {
      const fixture = setup();
      fixture.componentInstance.selectedStoreType.set('kingsoopers');
      fixture.componentInstance.selectedLocation.set('kingsoopers:abc');
      expect(fixture.componentInstance.canProceedToConfirm()).toBe(true);
    });
  });

  describe('onStoreTypeChange', () => {
    it('should clear selectedLocation', () => {
      const fixture = setup();
      fixture.componentInstance.selectedLocation.set('kingsoopers:abc');
      fixture.componentInstance.selectedStoreType.set('safeway');
      fixture.componentInstance.onStoreTypeChange();
      expect(fixture.componentInstance.selectedLocation()).toBeNull();
    });

    it('should call loadAllStores', () => {
      const fixture = setup();
      fixture.componentInstance.selectedStoreType.set('safeway');
      fixture.componentInstance.onStoreTypeChange();
      expect(mockStoresService.loadAllStores).toHaveBeenCalled();
    });
  });

  describe('addStore', () => {
    function selectStore(fixture: ReturnType<typeof setup>) {
      const store = makeAvailableStore({ instanceId: 'kingsoopers:abc' });
      mockStoresService.getAvailableStoresByType.mockReturnValue([store]);
      fixture.componentInstance.selectedStoreType.set('kingsoopers');
      fixture.componentInstance.selectedLocation.set('kingsoopers:abc');
      fixture.componentInstance.activeStep.set(2);
    }

    it('should call storesService.addStore with the selected instanceId', () => {
      const fixture = setup();
      selectStore(fixture);
      fixture.componentInstance.addStore(vi.fn());
      expect(mockStoresService.addStore).toHaveBeenCalledWith('kingsoopers:abc');
    });

    it('should call profileService.markOnboarded on success', () => {
      const fixture = setup();
      selectStore(fixture);
      fixture.componentInstance.addStore(vi.fn());
      expect(mockProfileService.markOnboarded).toHaveBeenCalled();
    });

    it('should advance to step 3 on success', () => {
      const fixture = setup();
      selectStore(fixture);
      const activateCallback = vi.fn();
      fixture.componentInstance.addStore(activateCallback);
      expect(activateCallback).toHaveBeenCalledWith(3);
    });

    it('should set addError and not advance on failure', () => {
      const fixture = setup();
      selectStore(fixture);
      mockStoresService.error.set('Network error');
      mockStoresService.addStore.mockReturnValue(throwError(() => new Error('fail')));

      const activateCallback = vi.fn();
      fixture.componentInstance.addStore(activateCallback);

      expect(fixture.componentInstance.addError()).toBe('Network error');
      expect(activateCallback).not.toHaveBeenCalled();
    });

    it('should use fallback error message when service error is null', () => {
      const fixture = setup();
      selectStore(fixture);
      mockStoresService.error.set(null);
      mockStoresService.addStore.mockReturnValue(throwError(() => new Error('fail')));

      fixture.componentInstance.addStore(vi.fn());

      expect(fixture.componentInstance.addError()).toBe('Failed to add store. Please try again.');
    });

    it('should not call service when no location is selected', () => {
      const fixture = setup();
      fixture.componentInstance.addStore(vi.fn());
      expect(mockStoresService.addStore).not.toHaveBeenCalled();
    });

    it('should clear addError before attempting', () => {
      const fixture = setup();
      selectStore(fixture);
      fixture.componentInstance.addError.set('Previous error');
      fixture.componentInstance.addStore(vi.fn());
      expect(fixture.componentInstance.addError()).toBeNull();
    });
  });
});
