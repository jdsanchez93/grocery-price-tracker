import { NavigationEnd, NavigationError } from '@angular/router';
import {
  CHUNK_RELOAD_FLAG,
  handleChunkLoadRecovery,
  isChunkLoadError
} from './chunk-load-recovery';

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key)
  };
}

describe('isChunkLoadError', () => {
  it('matches webpack ChunkLoadError by name', () => {
    const error = new Error('Loading chunk 42 failed.');
    error.name = 'ChunkLoadError';
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('matches dynamic import failures across browsers', () => {
    const messages = [
      'Failed to fetch dynamically imported module: https://app.example/chunk-ABC123.js',
      'error loading dynamically imported module',
      'Importing a module script failed.'
    ];
    for (const message of messages) {
      expect(isChunkLoadError(new TypeError(message))).toBe(true);
    }
  });

  it('rejects unrelated errors and non-errors', () => {
    expect(isChunkLoadError(new Error('Http failure response: 500'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('handleChunkLoadRecovery', () => {
  const chunkError = () =>
    new TypeError('Failed to fetch dynamically imported module: https://app.example/chunk-ABC123.js');

  it('reloads to the target URL on a chunk-load NavigationError and sets the flag', () => {
    const storage = fakeStorage();
    const navigate = vi.fn();

    handleChunkLoadRecovery(new NavigationError(1, '/deals', chunkError()), navigate, storage);

    expect(navigate).toHaveBeenCalledWith('/deals');
    expect(storage.getItem(CHUNK_RELOAD_FLAG)).toBe('1');
  });

  it('does not reload a second time while the flag is set', () => {
    const storage = fakeStorage({ [CHUNK_RELOAD_FLAG]: '1' });
    const navigate = vi.fn();

    handleChunkLoadRecovery(new NavigationError(1, '/deals', chunkError()), navigate, storage);

    expect(navigate).not.toHaveBeenCalled();
  });

  it('ignores NavigationErrors that are not chunk-load failures', () => {
    const storage = fakeStorage();
    const navigate = vi.fn();

    handleChunkLoadRecovery(
      new NavigationError(1, '/deals', new Error('guard rejected')),
      navigate,
      storage
    );

    expect(navigate).not.toHaveBeenCalled();
    expect(storage.getItem(CHUNK_RELOAD_FLAG)).toBeNull();
  });

  it('clears the flag on NavigationEnd so a later deploy can recover again', () => {
    const storage = fakeStorage({ [CHUNK_RELOAD_FLAG]: '1' });

    handleChunkLoadRecovery(new NavigationEnd(1, '/deals', '/deals'), vi.fn(), storage);

    expect(storage.getItem(CHUNK_RELOAD_FLAG)).toBeNull();
  });

  it('does not reload when storage is unavailable (no loop guard possible)', () => {
    const throwing = {
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {
        throw new Error('storage disabled');
      },
      removeItem: () => {
        throw new Error('storage disabled');
      }
    };
    const navigate = vi.fn();

    handleChunkLoadRecovery(new NavigationError(1, '/deals', chunkError()), navigate, throwing);

    expect(navigate).not.toHaveBeenCalled();
  });
});
