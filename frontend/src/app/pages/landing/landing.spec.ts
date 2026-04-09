import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AuthService } from '@auth0/auth0-angular';
import { Landing } from './landing';

describe('Landing', () => {
  function setup() {
    const authService = { loginWithRedirect: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: AuthService, useValue: authService },
      ],
    });

    const fixture = TestBed.createComponent(Landing);
    fixture.detectChanges();
    return { fixture, authService };
  }

  it('should create', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show the Get Started button', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.textContent).toContain('Get Started');
  });

  it('login() should call loginWithRedirect', () => {
    const { fixture, authService } = setup();
    fixture.componentInstance.login();
    expect(authService.loginWithRedirect).toHaveBeenCalledWith({ appState: { target: '/' } });
  });
});
