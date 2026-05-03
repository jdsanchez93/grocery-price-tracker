import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const messageService = inject(MessageService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const message = err.error?.error ?? 'An unexpected error occurred';
      messageService.add({
        severity: 'error',
        summary: httpErrorSummary(err.status),
        detail: message,
        life: 5000,
      });
      return throwError(() => err);
    })
  );
};

function httpErrorSummary(status: number): string {
  if (status === 0)   return 'Network Error';
  if (status === 401) return 'Session Expired';
  if (status === 400) return 'Bad Request';
  if (status >= 500)  return 'Server Error';
  return 'Error';
}