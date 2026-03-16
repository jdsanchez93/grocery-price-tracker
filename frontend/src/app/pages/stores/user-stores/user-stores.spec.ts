import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { UserStores } from './user-stores';
import { StoresService } from '@/app/core/services/stores.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { UserStore } from '@/app/core/models/store.model';

function makeUserStore(overrides: Partial<UserStore> = {}): UserStore {
  return {
    instanceId: 'kingsoopers:abc',
    name: 'King Soopers #1',
    storeType: 'kingsoopers',
    chain: 'kroger',
    addedAt: '2026-01-01',
    ...overrides,
  };
}

function makeMockStoresService() {
  return {
    getUserStores: signal<UserStore[]>([]),
    loading: signal(false),
    error: signal<string | null>(null),
    addStore: vi.fn().mockReturnValue(of(undefined)),
    removeStore: vi.fn().mockReturnValue(of(undefined)),
    loadUserStores: vi.fn(),
    getAvailableStoreTypeOptions: signal([]),
    getAvailableStores: signal([]),
    loadingAvailable: signal(false),
    loadAvailableStores: vi.fn(),
    clearAvailableStores: vi.fn(),
  };
}

describe('UserStores', () => {
  let component: UserStores;
  let fixture: ComponentFixture<UserStores>;
  let mockStoresService: ReturnType<typeof makeMockStoresService>;
  let mockConfirmationService: { confirm: ReturnType<typeof vi.fn> };
  let mockMessageService: { add: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockStoresService = makeMockStoresService();

    await TestBed.configureTestingModule({
      imports: [UserStores],
      providers: [
        { provide: StoresService, useValue: mockStoresService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserStores);
    component = fixture.componentInstance;

    // Get the component-level injected services and spy on them
    mockConfirmationService = { confirm: vi.fn() };
    mockMessageService = { add: vi.fn() };
    const injector = fixture.debugElement.injector;
    const realConfirmation = injector.get(ConfirmationService);
    const realMessage = injector.get(MessageService);
    mockConfirmationService.confirm = vi.spyOn(realConfirmation, 'confirm');
    mockMessageService.add = vi.spyOn(realMessage, 'add');

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show skeleton when loading and no stores', () => {
    mockStoresService.loading.set(true);
    fixture.detectChanges();

    const skeletons = fixture.nativeElement.querySelectorAll('p-skeleton');
    expect(skeletons.length).toBe(2);
  });

  it('should show error state when error signal is set', () => {
    mockStoresService.error.set('Something went wrong');
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('.error-container');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toContain('Something went wrong');
  });

  it('should show empty state when not loading and no stores', () => {
    mockStoresService.loading.set(false);
    fixture.detectChanges();

    const emptyEl = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyEl).toBeTruthy();
    expect(emptyEl.textContent).toContain('No stores added yet');
  });

  it('should show store grid when stores exist', () => {
    mockStoresService.getUserStores.set([makeUserStore()]);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-store-card');
    expect(cards.length).toBe(1);
  });

  it('addSelectedStore should subscribe and show success toast', () => {
    mockStoresService.addStore.mockReturnValue(of(undefined));

    component.addSelectedStore('kingsoopers:abc');

    expect(mockStoresService.addStore).toHaveBeenCalledWith('kingsoopers:abc');
    expect(mockMessageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Store Added' })
    );
  });

  it('addSelectedStore should show error toast on failure', () => {
    mockStoresService.error.set('Failed to add store');
    mockStoresService.addStore.mockReturnValue(throwError(() => new Error('fail')));

    component.addSelectedStore('kingsoopers:abc');

    expect(mockMessageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Failed to Add Store' })
    );
  });

  it('addSelectedStore should not call service when instanceId is empty', () => {
    component.addSelectedStore('');
    expect(mockStoresService.addStore).not.toHaveBeenCalled();
  });

  it('confirmRemove should call confirmationService.confirm', () => {
    component.confirmRemove('kingsoopers:abc', 'King Soopers #1');

    expect(mockConfirmationService.confirm).toHaveBeenCalled();
    const config = mockConfirmationService.confirm.mock.calls[0][0];
    expect(config.message).toContain('King Soopers #1');
  });

  it('confirmRemove accept callback should subscribe to removeStore and show success toast', () => {
    mockStoresService.removeStore.mockReturnValue(of(undefined));

    component.confirmRemove('kingsoopers:abc', 'King Soopers #1');

    const config = mockConfirmationService.confirm.mock.calls[0][0];
    config.accept();

    expect(mockStoresService.removeStore).toHaveBeenCalledWith('kingsoopers:abc');
    expect(mockMessageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Store Removed' })
    );
  });

  it('confirmRemove accept callback should show error toast on failure', () => {
    mockStoresService.error.set('Failed to remove store');
    mockStoresService.removeStore.mockReturnValue(throwError(() => new Error('fail')));

    component.confirmRemove('kingsoopers:abc', 'King Soopers #1');

    const config = mockConfirmationService.confirm.mock.calls[0][0];
    config.accept();

    expect(mockMessageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Failed to Remove Store' })
    );
  });

  it('retry should call loadUserStores', () => {
    component.retry();
    expect(mockStoresService.loadUserStores).toHaveBeenCalled();
  });
});
