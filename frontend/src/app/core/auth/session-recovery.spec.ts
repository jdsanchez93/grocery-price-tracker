import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService, GenericError, MissingRefreshTokenError } from '@auth0/auth0-angular';
import { of, Subject } from 'rxjs';
import { isDeadSessionError, provideAuthSessionRecovery } from './session-recovery';

describe('isDeadSessionError', () => {
  it('matches errors that mean the session can no longer mint tokens', () => {
    expect(isDeadSessionError(new GenericError('login_required', 'Login required'))).toBe(true);
    expect(isDeadSessionError(new GenericError('invalid_grant', 'Unknown or invalid refresh token.'))).toBe(true);
    expect(isDeadSessionError(new MissingRefreshTokenError('api', 'openid'))).toBe(true);
  });

  it('ignores recoverable or user-initiated errors and non-errors', () => {
    expect(isDeadSessionError(new GenericError('access_denied', 'User cancelled'))).toBe(false);
    expect(isDeadSessionError(new Error('Failed to fetch'))).toBe(false);
    expect(isDeadSessionError(null)).toBe(false);
    expect(isDeadSessionError(undefined)).toBe(false);
  });
});

describe('provideAuthSessionRecovery', () => {
  function setup() {
    const auth = {
      error$: new Subject<unknown>(),
      logout: vi.fn().mockReturnValue(of(undefined)),
      loginWithRedirect: vi.fn().mockReturnValue(of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        provideAuthSessionRecovery(),
      ],
    });
    // Instantiating any root token runs environment initializers.
    TestBed.inject(AuthService);

    return auth;
  }

  it('clears the local session and redirects to login on a dead session', () => {
    const auth = setup();

    auth.error$.next(new GenericError('invalid_grant', 'Unknown or invalid refresh token.'));

    expect(auth.logout).toHaveBeenCalledWith({ openUrl: false });
    expect(auth.loginWithRedirect).toHaveBeenCalledWith({ appState: { target: '/' } });
  });

  it('redirects only once for a burst of failures', () => {
    const auth = setup();

    auth.error$.next(new GenericError('login_required', 'Login required'));
    auth.error$.next(new GenericError('login_required', 'Login required'));

    expect(auth.loginWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('leaves non-session errors alone', () => {
    const auth = setup();

    auth.error$.next(new GenericError('access_denied', 'User cancelled'));

    expect(auth.logout).not.toHaveBeenCalled();
    expect(auth.loginWithRedirect).not.toHaveBeenCalled();
  });
});
