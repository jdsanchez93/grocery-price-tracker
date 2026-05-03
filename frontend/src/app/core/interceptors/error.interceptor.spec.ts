import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let messageServiceAdd: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        MessageService,
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    messageServiceAdd = vi.spyOn(TestBed.inject(MessageService), 'add');
  });

  afterEach(() => httpMock.verify());

  function triggerError(status: number, errorBody: object | string = {}) {
    let caught: HttpErrorResponse | undefined;
    http.get('/api/test').subscribe({ error: (e) => (caught = e) });
    httpMock.expectOne('/api/test').flush(errorBody, { status, statusText: 'Error' });
    return caught;
  }

  it('shows a toast when the server returns a 400', () => {
    triggerError(400, { error: 'Deal not found' });
    expect(messageServiceAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Bad Request', detail: 'Deal not found' })
    );
  });

  it('shows a toast when the server returns a 401', () => {
    triggerError(401, { error: 'Unauthorized' });
    expect(messageServiceAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Session Expired' })
    );
  });

  it('shows a toast when the server returns a 500', () => {
    triggerError(500, { error: 'Internal error' });
    expect(messageServiceAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Server Error' })
    );
  });

  it('shows a toast for any 5xx status', () => {
    triggerError(503, { error: 'Service unavailable' });
    expect(messageServiceAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Server Error' })
    );
  });

  it('falls back to generic message when error body has no error field', () => {
    triggerError(500, {});
    expect(messageServiceAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'An unexpected error occurred' })
    );
  });

  it('re-throws the error so subscribers can react', () => {
    let caught: HttpErrorResponse | undefined;
    http.get('/api/test').subscribe({ error: (e) => (caught = e) });
    httpMock.expectOne('/api/test').flush({ error: 'fail' }, { status: 500, statusText: 'Error' });
    expect(caught).toBeInstanceOf(HttpErrorResponse);
  });

  it('sets toast life to 5000ms', () => {
    triggerError(400, { error: 'oops' });
    expect(messageServiceAdd).toHaveBeenCalledWith(
      expect.objectContaining({ life: 5000 })
    );
  });
});
