import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@auth0/auth0-angular';
import { LoginButton } from './login-button';

describe('LoginButton', () => {
  let component: LoginButton;
  let fixture: ComponentFixture<LoginButton>;
  let authMock: { loginWithRedirect: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authMock = { loginWithRedirect: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginButton],
      providers: [{ provide: AuthService, useValue: authMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginButton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a "Log in" button', () => {
    const button = fixture.nativeElement.querySelector('p-button');
    expect(button).toBeTruthy();
    expect(button.getAttribute('label')).toBe('Log in');
  });

  it('should call loginWithRedirect when login() is called', () => {
    component.login();
    expect(authMock.loginWithRedirect).toHaveBeenCalledOnce();
  });

  it('should call loginWithRedirect when the button is clicked', () => {
    const button: HTMLElement = fixture.nativeElement.querySelector('p-button button');
    button.click();
    expect(authMock.loginWithRedirect).toHaveBeenCalledOnce();
  });
});
