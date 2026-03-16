import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ConfigureStores } from './configure-stores';
import { AdminService } from '../../../core/services/admin.service';
import { AvailableStore } from '../../../core/models/store.model';

function makeStore(overrides: Partial<AvailableStore> = {}): AvailableStore {
  return {
    instanceId: 'kingsoopers:abc',
    name: 'KS Pearl',
    storeType: 'kingsoopers',
    identifiers: {},
    enabled: true,
    ...overrides,
  };
}

function makeMockAdminService() {
  return {
    getAllStores: vi.fn().mockReturnValue(of([])),
    createStore: vi.fn().mockReturnValue(of({ success: true, store: makeStore() })),
  };
}

describe('ConfigureStores', () => {
  let component: ConfigureStores;
  let fixture: ComponentFixture<ConfigureStores>;
  let mockAdminService: ReturnType<typeof makeMockAdminService>;
  let messageServiceAdd: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    mockAdminService = makeMockAdminService();

    await TestBed.configureTestingModule({
      imports: [ConfigureStores],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigureStores);
    component = fixture.componentInstance;

    const messageService = fixture.debugElement.injector.get(MessageService);
    messageServiceAdd = vi.spyOn(messageService, 'add');

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- dynamicFields computed ---

  describe('dynamicFields', () => {
    it('returns [] when no type selected', () => {
      expect(component.dynamicFields()).toEqual([]);
    });

    it('returns storeId + facilityId for kingsoopers', () => {
      component.onTypeChange('kingsoopers');
      expect(component.dynamicFields().map(f => f.key)).toEqual(['storeId', 'facilityId']);
    });

    it('returns storeId + postalCode for safeway', () => {
      component.onTypeChange('safeway');
      expect(component.dynamicFields().map(f => f.key)).toEqual(['storeId', 'postalCode']);
    });

    it('returns storeId only for sprouts', () => {
      component.onTypeChange('sprouts');
      expect(component.dynamicFields().map(f => f.key)).toEqual(['storeId']);
    });
  });

  // --- identifierForm computed ---

  describe('identifierForm', () => {
    it('returns a new FormGroup instance when type changes', () => {
      component.onTypeChange('kingsoopers');
      const first = component.identifierForm();
      component.onTypeChange('safeway');
      const second = component.identifierForm();
      expect(first).not.toBe(second);
    });

    it('kingsoopers form has storeId and facilityId controls', () => {
      component.onTypeChange('kingsoopers');
      const controls = Object.keys(component.identifierForm().controls);
      expect(controls).toEqual(['storeId', 'facilityId']);
    });

    it('safeway form has storeId and postalCode controls, no facilityId', () => {
      component.onTypeChange('safeway');
      const controls = Object.keys(component.identifierForm().controls);
      expect(controls).toEqual(['storeId', 'postalCode']);
      expect(component.identifierForm().get('facilityId')).toBeNull();
    });
  });

  // --- loadStores ---

  describe('loadStores (via ngOnInit)', () => {
    it('calls getAllStores on init', () => {
      expect(mockAdminService.getAllStores).toHaveBeenCalled();
    });

    it('populates stores signal on success', () => {
      const store = makeStore();
      mockAdminService.getAllStores.mockReturnValue(of([store]));
      component.ngOnInit();
      expect(component.stores()).toEqual([store]);
    });

    it('sets loading to false after success', () => {
      mockAdminService.getAllStores.mockReturnValue(of([]));
      component.ngOnInit();
      expect(component.loading()).toBe(false);
    });

    it('sets loading to false on error', () => {
      mockAdminService.getAllStores.mockReturnValue(throwError(() => new Error('fail')));
      component.ngOnInit();
      expect(component.loading()).toBe(false);
    });
  });

  // --- submitForm: validation guards ---

  describe('submitForm — validation guards', () => {
    it('sets typeTouched when no type selected and does not call createStore', () => {
      component.submitForm();
      expect(component.typeTouched()).toBe(true);
      expect(mockAdminService.createStore).not.toHaveBeenCalled();
    });

    it('does not call createStore when type is set but name is empty', () => {
      component.onTypeChange('kingsoopers');
      // nameControl stays empty
      component.submitForm();
      expect(mockAdminService.createStore).not.toHaveBeenCalled();
    });

    it('does not call createStore when name is filled but identifier fields are empty', () => {
      component.onTypeChange('kingsoopers');
      component.nameControl.setValue('KS Pearl');
      // identifier controls remain empty/invalid
      component.submitForm();
      expect(mockAdminService.createStore).not.toHaveBeenCalled();
    });
  });

  // --- addressForm ---

  describe('addressForm', () => {
    it('has the four expected controls', () => {
      const controls = Object.keys(component.addressForm.controls);
      expect(controls).toEqual(['addressLine1', 'city', 'state', 'zipCode']);
    });

    it('all controls start empty', () => {
      const { addressLine1, city, state, zipCode } = component.addressForm.getRawValue();
      expect(addressLine1).toBeFalsy();
      expect(city).toBeFalsy();
      expect(state).toBeFalsy();
      expect(zipCode).toBeFalsy();
    });
  });

  // --- submitForm: success path ---

  describe('submitForm — success', () => {
    function fillForm() {
      component.onTypeChange('kingsoopers');
      component.nameControl.setValue('KS Pearl');
      component.identifierForm().setValue({ storeId: '12345', facilityId: '67890' });
    }

    it('calls createStore with correct payload (no address)', () => {
      const store = makeStore({ name: 'KS Pearl' });
      mockAdminService.createStore.mockReturnValue(of({ success: true, store }));
      fillForm();
      component.submitForm();
      expect(mockAdminService.createStore).toHaveBeenCalledWith({
        type: 'kingsoopers',
        name: 'KS Pearl',
        storeId: '12345',
        facilityId: '67890',
        postalCode: undefined,
      });
    });

    it('omits address from payload when all address fields are empty', () => {
      fillForm();
      component.addressForm.setValue({ addressLine1: '', city: '', state: '', zipCode: '' });
      component.submitForm();
      const payload = mockAdminService.createStore.mock.calls[0][0];
      expect(payload).not.toHaveProperty('address');
    });

    it('includes address in payload when addressLine1 is filled', () => {
      fillForm();
      component.addressForm.setValue({ addressLine1: '1234 Pearl St', city: 'Boulder', state: 'CO', zipCode: '80000' });
      component.submitForm();
      const payload = mockAdminService.createStore.mock.calls[0][0];
      expect(payload.address).toEqual({
        addressLine1: '1234 Pearl St',
        city: 'Boulder',
        state: 'CO',
        zipCode: '80000',
      });
    });

    it('includes address when only city is filled (no addressLine1)', () => {
      fillForm();
      component.addressForm.setValue({ addressLine1: '', city: 'Boulder', state: 'CO', zipCode: '' });
      component.submitForm();
      const payload = mockAdminService.createStore.mock.calls[0][0];
      expect(payload.address).toBeDefined();
      expect(payload.address.city).toBe('Boulder');
    });

    it('omits zipCode from address when it is empty', () => {
      fillForm();
      component.addressForm.setValue({ addressLine1: '123 Main St', city: 'Denver', state: 'CO', zipCode: '' });
      component.submitForm();
      const payload = mockAdminService.createStore.mock.calls[0][0];
      expect(payload.address?.zipCode).toBeUndefined();
    });

    it('trims whitespace from address fields', () => {
      fillForm();
      component.addressForm.setValue({ addressLine1: '  Main St  ', city: '  Denver  ', state: ' CO ', zipCode: ' 80201 ' });
      component.submitForm();
      const payload = mockAdminService.createStore.mock.calls[0][0];
      expect(payload.address).toEqual({
        addressLine1: 'Main St',
        city: 'Denver',
        state: 'CO',
        zipCode: '80201',
      });
    });

    it('resets addressForm on success', () => {
      const store = makeStore();
      mockAdminService.createStore.mockReturnValue(of({ success: true, store }));
      fillForm();
      component.addressForm.setValue({ addressLine1: '123 Main St', city: 'Denver', state: 'CO', zipCode: '80201' });
      component.submitForm();
      expect(component.addressForm.getRawValue()).toEqual({ addressLine1: null, city: null, state: null, zipCode: null });
    });

    it('appends returned store to stores signal', () => {
      const store = makeStore();
      mockAdminService.createStore.mockReturnValue(of({ success: true, store }));
      fillForm();
      component.submitForm();
      expect(component.stores()).toContain(store);
    });

    it('shows success toast', () => {
      const store = makeStore({ name: 'KS Pearl' });
      mockAdminService.createStore.mockReturnValue(of({ success: true, store }));
      fillForm();
      component.submitForm();
      expect(messageServiceAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'Store added', detail: 'KS Pearl' })
      );
    });

    it('resets selectedType to null', () => {
      fillForm();
      component.submitForm();
      expect(component.selectedType()).toBeNull();
    });

    it('resets typeTouched to false', () => {
      fillForm();
      component.submitForm();
      expect(component.typeTouched()).toBe(false);
    });

    it('resets nameControl to empty string', () => {
      fillForm();
      component.submitForm();
      expect(component.nameControl.value).toBe('');
    });

    it('sets submitting to false after success', () => {
      fillForm();
      component.submitForm();
      expect(component.submitting()).toBe(false);
    });
  });

  // --- submitForm: error path ---

  describe('submitForm — error', () => {
    function fillForm() {
      component.onTypeChange('kingsoopers');
      component.nameControl.setValue('KS Pearl');
      component.identifierForm().setValue({ storeId: '12345', facilityId: '67890' });
    }

    it('shows error toast with error message', () => {
      mockAdminService.createStore.mockReturnValue(throwError(() => new Error('Network error')));
      fillForm();
      component.submitForm();
      expect(messageServiceAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', summary: 'Error', detail: 'Network error' })
      );
    });

    it('sets submitting to false after error', () => {
      mockAdminService.createStore.mockReturnValue(throwError(() => new Error('fail')));
      fillForm();
      component.submitForm();
      expect(component.submitting()).toBe(false);
    });

    it('does not reset selectedType on error', () => {
      mockAdminService.createStore.mockReturnValue(throwError(() => new Error('fail')));
      fillForm();
      component.submitForm();
      expect(component.selectedType()).toBe('kingsoopers');
    });
  });
});
