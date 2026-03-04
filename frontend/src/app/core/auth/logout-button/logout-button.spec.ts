import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@auth0/auth0-angular';
import { LogoutButton } from './logout-button';

describe('LogoutButton', () => {
  let component: LogoutButton;
  let fixture: ComponentFixture<LogoutButton>;
  let authMock: { logout: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authMock = { logout: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LogoutButton],
      providers: [{ provide: AuthService, useValue: authMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(LogoutButton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a "Log out" button', () => {
    const button = fixture.nativeElement.querySelector('p-button');
    expect(button).toBeTruthy();
    expect(button.getAttribute('label')).toBe('Log out');
  });

  it('should call logout with returnTo when logout() is called', () => {
    component.logout();
    expect(authMock.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    });
  });

  it('should call logout when the button is clicked', () => {
    const button: HTMLElement = fixture.nativeElement.querySelector('p-button button');
    button.click();
    expect(authMock.logout).toHaveBeenCalledOnce();
  });
});
