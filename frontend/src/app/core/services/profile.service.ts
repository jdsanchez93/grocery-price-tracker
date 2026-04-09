import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '@/environments/environment';

interface UserProfile {
  onboarded: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private http = inject(HttpClient);

  private _onboarded = signal<boolean | null>(null);
  onboarded = this._onboarded.asReadonly();

  loadProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${environment.apiUrl}/me/profile`).pipe(
      tap(profile => this._onboarded.set(profile.onboarded))
    );
  }

  markOnboarded(): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${environment.apiUrl}/me/onboarding/complete`, {}).pipe(
      tap(() => this._onboarded.set(true))
    );
  }
}
