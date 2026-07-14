import { TestBed } from '@angular/core/testing';
import { Route } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { SelectivePreloadStrategy } from './selective-preload.strategy';

describe('SelectivePreloadStrategy', () => {
  let strategy: SelectivePreloadStrategy;

  beforeEach(() => {
    strategy = TestBed.inject(SelectivePreloadStrategy);
  });

  it('should preload routes tagged with data.preload', async () => {
    const route: Route = { path: 'dashboard', data: { preload: true } };
    const load = vi.fn(() => of('chunk'));

    const result = await firstValueFrom(strategy.preload(route, load));

    expect(load).toHaveBeenCalled();
    expect(result).toBe('chunk');
  });

  it('should not preload routes without data.preload', async () => {
    const route: Route = { path: 'admin' };
    const load = vi.fn(() => of('chunk'));

    const result = await firstValueFrom(strategy.preload(route, load));

    expect(load).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('should not preload routes with data.preload set to false', async () => {
    const route: Route = { path: 'analytics', data: { preload: false } };
    const load = vi.fn(() => of('chunk'));

    const result = await firstValueFrom(strategy.preload(route, load));

    expect(load).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
