import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { Event, NavigationEnd, NavigationError, Router } from '@angular/router';

/**
 * sessionStorage key marking that a recovery reload already happened.
 * Guards against reload loops when a chunk is missing for reasons a
 * fresh index.html can't fix (e.g. a genuinely broken deploy).
 */
export const CHUNK_RELOAD_FLAG = 'chunk-load-recovery.reloaded';

/**
 * Detects a failed lazy-route chunk load: webpack's ChunkLoadError plus the
 * dynamic-import failure messages thrown by Chrome, Firefox, and Safari
 * (the esbuild/Vite builder surfaces the raw import() rejection).
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'ChunkLoadError') return true;
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
    error.message
  );
}

/**
 * Recovers from lazy-route chunk 404s after a frontend deploy: a user whose
 * open tab holds a stale index.html requests a hashed chunk that no longer
 * matches, the router emits NavigationError, and we do a one-time full page
 * load of the target URL to pick up the fresh index.html (served no-store).
 *
 * A successful navigation clears the flag so recovery works again for a
 * later deploy; a failed recovery leaves it set so we never reload twice
 * for the same attempt.
 */
export function provideChunkLoadRecovery(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const router = inject(Router);
    router.events.subscribe(event =>
      handleChunkLoadRecovery(event, url => window.location.assign(url))
    );
  });
}

/** Exported for tests; `navigate` performs the full page load. */
export function handleChunkLoadRecovery(
  event: Event,
  navigate: (url: string) => void,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = window.sessionStorage
): void {
  if (event instanceof NavigationEnd) {
    try {
      storage.removeItem(CHUNK_RELOAD_FLAG);
    } catch {
      // Storage unavailable (e.g. blocked by browser settings) — nothing to clear.
    }
    return;
  }

  if (event instanceof NavigationError && isChunkLoadError(event.error)) {
    try {
      if (storage.getItem(CHUNK_RELOAD_FLAG) !== null) return;
      storage.setItem(CHUNK_RELOAD_FLAG, '1');
    } catch {
      // Without storage we can't guard against a reload loop — don't reload.
      return;
    }
    navigate(event.url);
  }
}
