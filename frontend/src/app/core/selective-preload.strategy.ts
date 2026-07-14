import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

/**
 * Preloads only routes tagged with `data: { preload: true }`.
 *
 * Unlike PreloadAllModules, this avoids downloading chunks most users never
 * visit (e.g. /admin — its roleGuard is canActivate, which does NOT prevent
 * preloading), which matters on slow connections where background chunk
 * downloads compete with API calls for bandwidth.
 */
@Injectable({ providedIn: 'root' })
export class SelectivePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return route.data?.['preload'] ? load() : of(null);
  }
}
