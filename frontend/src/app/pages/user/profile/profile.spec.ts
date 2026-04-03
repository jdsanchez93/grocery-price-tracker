import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@auth0/auth0-angular';
import { BehaviorSubject } from 'rxjs';
import { Auth0User, ROLES_CLAIM } from '@/app/core/auth/auth.constants';
import { Profile } from './profile';

describe('Profile', () => {
  let component: Profile;
  let fixture: ComponentFixture<Profile>;
  let user$: BehaviorSubject<Auth0User | null>;
  let isLoading$: BehaviorSubject<boolean>;
  let isAuthenticated$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    user$ = new BehaviorSubject<Auth0User | null>(null);
    isLoading$ = new BehaviorSubject<boolean>(false);
    isAuthenticated$ = new BehaviorSubject<boolean>(false);

    const authMock = {
      user$: user$.asObservable(),
      isLoading$: isLoading$.asObservable(),
      isAuthenticated$: isAuthenticated$.asObservable(),
      loginWithRedirect: vi.fn(),
      logout: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [{ provide: AuthService, useValue: authMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(Profile);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('displays user name in card title', async () => {
    user$.next({ name: 'Jane Doe' });
    fixture.detectChanges();
    await fixture.whenStable();

    const title = fixture.nativeElement.querySelector('.p-card-title');
    expect(title?.textContent?.trim()).toBe('Jane Doe');
  });

  it('displays the user role in card subtitle', async () => {
    user$.next({ name: 'Jane Doe', [ROLES_CLAIM]: ['admin'] });
    fixture.detectChanges();
    await fixture.whenStable();

    const subtitle = fixture.nativeElement.querySelector('.p-card-subtitle');
    expect(subtitle?.textContent?.trim()).toBe('admin');
  });

  it('displays multiple roles joined with ", "', async () => {
    user$.next({ name: 'Jane Doe', [ROLES_CLAIM]: ['admin', 'power_user'] });
    fixture.detectChanges();
    await fixture.whenStable();

    const subtitle = fixture.nativeElement.querySelector('.p-card-subtitle');
    expect(subtitle?.textContent?.trim()).toBe('admin, power_user');
  });

  it('displays empty string for role when no roles claim present', async () => {
    user$.next({ name: 'Jane Doe' });
    fixture.detectChanges();
    await fixture.whenStable();

    const subtitle = fixture.nativeElement.querySelector('.p-card-subtitle');
    expect(subtitle?.textContent?.trim()).toBe('');
  });

  it('displays nothing for name when user is null', async () => {
    user$.next(null);
    fixture.detectChanges();
    await fixture.whenStable();

    const title = fixture.nativeElement.querySelector('.p-card-title');
    expect(title?.textContent?.trim()).toBe('');
  });
});
