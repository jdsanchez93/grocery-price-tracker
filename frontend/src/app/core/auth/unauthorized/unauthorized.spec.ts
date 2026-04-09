import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Unauthorized } from './unauthorized';
import { provideRouter } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';

describe('Unauthorized', () => {
  let component: Unauthorized;
  let fixture: ComponentFixture<Unauthorized>;

  const createFixture = async (isAuthenticated: boolean) => {
    await TestBed.configureTestingModule({
      imports: [Unauthorized],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { loginWithRedirect: vi.fn(), isAuthenticated$: of(isAuthenticated) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Unauthorized);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await createFixture(false);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call loginWithRedirect when login() is called', () => {
    const auth = TestBed.inject(AuthService);
    component.login();
    expect(auth.loginWithRedirect).toHaveBeenCalledWith({ appState: { target: '/dashboard' } });
  });

  it('should show sign in button when not authenticated', () => {
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const signInBtn = Array.from(buttons).find(b => b.textContent?.includes('Sign In'));
    expect(signInBtn).toBeTruthy();
  });

  it('should hide sign in button when authenticated', async () => {
    TestBed.resetTestingModule();
    await createFixture(true);
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const signInBtn = Array.from(buttons).find(b => b.textContent?.includes('Sign In'));
    expect(signInBtn).toBeFalsy();
  });
});
