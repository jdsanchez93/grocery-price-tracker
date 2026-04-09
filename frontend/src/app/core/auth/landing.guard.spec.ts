import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { landingGuard } from './landing.guard';
import { ProfileService } from '@/app/core/services/profile.service';

function makeAuthService(isAuthenticated = false) {
  return {
    isAuthenticated$: new BehaviorSubject(isAuthenticated),
  };
}

function makeMockProfileService(onboarded = true) {
  return {
    loadProfile: vi.fn().mockReturnValue(of({ onboarded })),
  };
}

describe('landingGuard', () => {
  function setup(isAuthenticated = false, onboarded = true) {
    const authService = makeAuthService(isAuthenticated);
    const profileService = makeMockProfileService(onboarded);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: ProfileService, useValue: profileService },
      ],
    });

    return { authService, profileService, router: TestBed.inject(Router) };
  }

  function runGuard() {
    return firstValueFrom(TestBed.runInInjectionContext(() => landingGuard()));
  }

  it('should return true when not authenticated', async () => {
    setup(false);
    const result = await runGuard();
    expect(result).toBe(true);
  });

  it('should return /dashboard UrlTree when authenticated and onboarded', async () => {
    const { router } = setup(true, true);
    const result = await runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/dashboard');
  });

  it('should return /onboarding UrlTree when authenticated and not onboarded', async () => {
    const { router } = setup(true, false);
    const result = await runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/onboarding');
  });

  it('should fall back to /dashboard when loadProfile() throws', async () => {
    const { router, profileService } = setup(true);
    profileService.loadProfile.mockReturnValue(throwError(() => new Error('Network error')));

    const result = await runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/dashboard');
  });

  it('should not call loadProfile when not authenticated', async () => {
    const { profileService } = setup(false);
    await runGuard();
    expect(profileService.loadProfile).not.toHaveBeenCalled();
  });
});
