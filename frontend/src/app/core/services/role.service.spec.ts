import { TestBed } from '@angular/core/testing';

import { RoleService } from './role.service';
import { BehaviorSubject } from 'rxjs';
import { Auth0User, ROLES_CLAIM } from '../auth/auth.constants';
import { AuthService } from '@auth0/auth0-angular';

describe('RoleService', () => {
  let service: RoleService;
  let user$: BehaviorSubject<Auth0User | null>;

  beforeEach(() => {
    user$ = new BehaviorSubject<Auth0User | null>(null);

    const authMock = {
      user$: user$.asObservable(),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authMock }]
    });
    service = TestBed.inject(RoleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return false for both when user is null (unauthenticated)', () => {
    // user$ starts as null — no next() call needed
    expect(service.isPowerUser()).toBe(false);
    expect(service.isAdmin()).toBe(false);
  });

  it('should correctly classify a user with no roles (not power user, not admin)', () => {
    user$.next({ [ROLES_CLAIM]: [] });
    expect(service.isPowerUser()).toBe(false);
    expect(service.isAdmin()).toBe(false);
  });

  it('should correctly classify a basic user (not power user, not admin)', () => {
    user$.next({ [ROLES_CLAIM]: ['user'] });
    expect(service.isPowerUser()).toBe(false);
    expect(service.isAdmin()).toBe(false);
  });

  it('should correctly classify a power_user', () => {
    user$.next({ [ROLES_CLAIM]: ['power_user'] });
    expect(service.isPowerUser()).toBe(true);
    expect(service.isAdmin()).toBe(false);
  });

  it('should correctly classify an admin', () => {
    user$.next({ [ROLES_CLAIM]: ['admin'] });
    expect(service.isPowerUser()).toBe(true);
    expect(service.isAdmin()).toBe(true);
  });
});
