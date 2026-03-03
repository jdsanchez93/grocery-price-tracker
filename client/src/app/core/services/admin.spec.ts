import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { Admin } from './admin';
import { environment } from '../../../environments/environment';

describe('Admin', () => {
  let service: Admin;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(Admin);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should POST to /admin/scrape/auto with instanceId param', () => {
    service.initiateScrape('kingsoopers:abc123').subscribe();

    const req = httpTesting.expectOne(r =>
      r.url === `${environment.apiUrl}/admin/scrape/auto`
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.params.get('instanceId')).toBe('kingsoopers:abc123');
    req.flush({});
  });

  it('should default force to false', () => {
    service.initiateScrape('kingsoopers:abc123').subscribe();

    const req = httpTesting.expectOne(r => r.url.includes('/admin/scrape/auto'));
    expect(req.request.params.get('force')).toBe('false');
    req.flush({});
  });

  it('should pass force=true when specified', () => {
    service.initiateScrape('kingsoopers:abc123', true).subscribe();

    const req = httpTesting.expectOne(r => r.url.includes('/admin/scrape/auto'));
    expect(req.request.params.get('force')).toBe('true');
    req.flush({});
  });

  it('should send empty body', () => {
    service.initiateScrape('safeway:def456').subscribe();

    const req = httpTesting.expectOne(r => r.url.includes('/admin/scrape/auto'));
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('should return the response from the API', () => {
    const mockResponse = { status: 'started', jobId: '123' };
    let result: any;

    service.initiateScrape('kingsoopers:abc123').subscribe(r => result = r);

    const req = httpTesting.expectOne(r => r.url.includes('/admin/scrape/auto'));
    req.flush(mockResponse);

    expect(result).toEqual(mockResponse);
  });

  it('should propagate errors', () => {
    let error: any;

    service.initiateScrape('kingsoopers:abc123').subscribe({
      error: (e) => error = e,
    });

    const req = httpTesting.expectOne(r => r.url.includes('/admin/scrape/auto'));
    req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

    expect(error).toBeTruthy();
    expect(error.status).toBe(403);
  });
});
