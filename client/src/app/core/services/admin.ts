import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Admin {
  private http = inject(HttpClient);
  
  initiateScrape(instanceId: string, force: boolean = false): Observable<any> {
    return this.http.post(`${environment.apiUrl}/admin/scrape/auto`, {}, {params: {'instanceId': instanceId, 'force': force}})
    .pipe(
      tap(x => console.log('scrape response', x))
    );
  }
}
