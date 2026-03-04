import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@auth0/auth0-angular';
import { BehaviorSubject } from 'rxjs';
import { AuthButtons } from './auth-buttons';

describe('AuthButtons', () => {
  let component: AuthButtons;
  let fixture: ComponentFixture<AuthButtons>;
  let isLoading$: BehaviorSubject<boolean>;
  let isAuthenticated$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    isLoading$ = new BehaviorSubject<boolean>(false);
    isAuthenticated$ = new BehaviorSubject<boolean>(false);

    const authMock = {
      isLoading$: isLoading$.asObservable(),
      isAuthenticated$: isAuthenticated$.asObservable(),
      loginWithRedirect: vi.fn(),
      logout: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AuthButtons],
      providers: [{ provide: AuthService, useValue: authMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthButtons);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show spinner while loading', async () => {
    isLoading$.next(true);
    isAuthenticated$.next(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('p-progressSpinner')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-login-button')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-logout-button')).toBeNull();
  });

  it('should show login button when not authenticated', async () => {
    isLoading$.next(false);
    isAuthenticated$.next(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-login-button')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-logout-button')).toBeNull();
    expect(fixture.nativeElement.querySelector('p-progressSpinner')).toBeNull();
  });

  it('should show logout button when authenticated', async () => {
    isLoading$.next(false);
    isAuthenticated$.next(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-logout-button')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-login-button')).toBeNull();
    expect(fixture.nativeElement.querySelector('p-progressSpinner')).toBeNull();
  });

  it('should switch from spinner to login button when loading completes', async () => {
    isLoading$.next(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('p-progressSpinner')).toBeTruthy();

    isLoading$.next(false);
    isAuthenticated$.next(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-login-button')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('p-progressSpinner')).toBeNull();
  });
});
