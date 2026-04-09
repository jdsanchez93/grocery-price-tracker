import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProfileService } from './profile.service';

const API = '/api';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpCtrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpCtrl = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ProfileService);
  });

  afterEach(() => httpCtrl.verify());

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('onboarded signal should start as null', () => {
    expect(service.onboarded()).toBeNull();
  });

  describe('loadProfile', () => {
    it('should GET /me/profile', () => {
      service.loadProfile().subscribe();
      const req = httpCtrl.expectOne(`${API}/me/profile`);
      expect(req.request.method).toBe('GET');
      req.flush({ onboarded: true });
    });

    it('should set onboarded signal to true from response', () => {
      service.loadProfile().subscribe();
      httpCtrl.expectOne(`${API}/me/profile`).flush({ onboarded: true });
      expect(service.onboarded()).toBe(true);
    });

    it('should set onboarded signal to false from response', () => {
      service.loadProfile().subscribe();
      httpCtrl.expectOne(`${API}/me/profile`).flush({ onboarded: false });
      expect(service.onboarded()).toBe(false);
    });
  });

  describe('markOnboarded', () => {
    it('should POST /me/onboarding/complete', () => {
      service.markOnboarded().subscribe();
      const req = httpCtrl.expectOne(`${API}/me/onboarding/complete`);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true });
    });

    it('should set onboarded signal to true on success', () => {
      service.markOnboarded().subscribe();
      httpCtrl.expectOne(`${API}/me/onboarding/complete`).flush({ success: true });
      expect(service.onboarded()).toBe(true);
    });
  });
});
