/**
 * Thrown when an upstream scrape can't proceed because the requested circular
 * doesn't exist (or hasn't been published yet for a preview ask). Callers can
 * treat this as an expected 404 rather than an unexpected scraper failure.
 *
 * Shared between Kroger and Safeway scrapers so route handlers can use one
 * `instanceof NoCircularError` check regardless of which chain produced it.
 */
export class NoCircularError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoCircularError';
  }
}
