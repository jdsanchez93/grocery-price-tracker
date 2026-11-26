# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### API (`api/`)
```bash
npm run dev        # Local dev server on port 3003 (tsx watch + .env)
npm run test       # Run tests with vitest
npm run test:watch # Watch mode
```

### Frontend (`frontend/`)
```bash
npm start          # ng serve (dev on port 4200, proxies /api → localhost:3003)
npm run build      # Production build to dist/
npm test           # Vitest with jsdom
```

### Scraper Worker (`scraper-worker/`)
```bash
npm run dev        # Local dev server on port 3010 (tsx watch + .env)
npm start          # Production start
```
Separate Hono.js scraping service with Docker support. Secured by `X-Api-Key` header. Endpoints:
- `POST /scrape/kingsoopers` — body `{ storeId, facilityId, preview?: boolean }`. Returns deals + circularId + timezone. 404 (with JSON body) when no matching circular exists upstream — api/ recognizes this as `NoCircularError`.
- `POST /scrape/kingsoopers/circulars` — metadata-only peek. Returns the full list of weeklyAd circulars (current + preview) without fetching deals. Used by `/admin/scrape/preview-availability`.
- `GET /health`.

### Infrastructure (`infrastructure/`)
```bash
npm run build      # Compile TypeScript
npm run cdk        # CDK CLI commands
npm test           # Jest
```

## Architecture

### Tech Stack
- **API**: Hono.js running on AWS Lambda (`lambda.ts`) or locally (`local.ts`). No build step — uses `tsx` at runtime.
- **Frontend**: Angular v20+ with PrimeNG v21, Tailwind CSS v4
- **Database**: DynamoDB single-table design (`GroceryDeals` table, name in `TABLE_NAME` env var)
- **Auth**: Auth0 JWT with permission-based authorization (`stores:read`, `deals:read`, `user-stores:read`, etc.)
- **Infra**: AWS CDK v2

### API Structure (`api/src/`)
- `app.ts` — Route definitions. Routes are `/stores`, `/admin/*`, `/me/*`
- `middleware/auth.ts` — `authMiddleware({ required })` + `requirePermission(...perms)` for fine-grained permission checks; injects `AuthUser` into context
- `db/client.ts` — DynamoDB client (AWS SDK v3 `@aws-sdk/lib-dynamodb`)
- `scraper/` — `kingsoopers.ts` (Kroger API via scraper-worker), `safeway.ts` (Flipp API), `products.ts` (canonical product matching), `errors.ts` (shared `NoCircularError`). Each chain's top-level `fetchAndPersistWeeklyDeals(identifiers, instanceId, ..., { force?, preview? })` is the canonical end-to-end entry: fetch → pick target → alreadyScraped check → optional force-delete → persist. Throws `NoCircularError` when no matching ad exists upstream.
- `jobs/` — Event-driven Lambda handlers (separate from the api Lambda): `previewScrapePlanner.ts` (weekly trigger) + `previewScrapeWorker.ts` (per-store scrape). Each exports a `run*` function so the same logic powers both the Lambda handler and the admin debug routes in `app.ts`.
- `types/database.ts` — All DynamoDB item type definitions + week/timezone helpers (`candidateWeekIds`, `todayInStoreTz`, `getWeekIdForDate`)

#### Key permissions used by routes
`stores:read`, `stores:write`, `deals:read`, `deals:write`, `user-stores:read`, `user-stores:write`, `history:read`, `scraper:run`

### DynamoDB Key Patterns
```
Deal:          PK = STORE#<instanceId>#WEEK#<week>   SK = DEAL#<id>
StoreInstance: PK = STOREINSTANCE#<instanceId>       SK = METADATA
Circular:      PK = STORE#<instanceId>#WEEK#<week>   SK = METADATA
Product:       PK = PRODUCT#<canonical_id>           SK = METADATA
User:          PK = USER#<userId>                    SK = PROFILE
UserStore:     PK = USER#<userId>                    SK = STOREINSTANCE#<instanceId>

GSI1 (Price History): GSI1PK = PRODUCT#<id>         GSI1SK = <weekId>#<instanceId>
GSI2 (Entity Type):   PK = entityType               SK = weekId   (plain attributes, no GSI2PK/GSI2SK)
```

GSI1 is sparse: an item is indexed only when it has **both** `GSI1PK` and `GSI1SK`. Any write that sets a deal's `canonicalProductId` must set both, or the deal silently drops out of price history.

Store instance IDs are `{type}:{sha256_hash(identifiers)}`. Supported chains: `kingsoopers`, `safeway`, `sprouts`. Each `StoreInstanceItem` carries a required `timezone` field (IANA name, e.g. `America/Denver`) — used to resolve store-local calendar dates.

### Week IDs & "current week" resolution
- `weekId` format is `YYYY-Www` (zero-padded). Each circular is stored under the weekId derived from its own `startDate` (`getWeekIdForDate(new Date(startDate + 'T12:00:00'))`).
- Circulars **usually** run Wed→Tue, 7 days, store-local calendar dates inclusive — but **not always**. Holiday ads break the pattern (Thanksgiving 2026: Wed Nov 18 → Thu Nov 26, then Fri Nov 27 → Tue Dec 1). Never assume a circular's length or start weekday. `CircularItem.startDate` and `endDate` are plain `YYYY-MM-DD` strings in the store's local TZ.
- "Which circular is live right now?" is resolved **by date range**, never by computing a weekId from today's date. Use `findActiveCircular(storeInstanceId, timezone)` in `api/src/db/client.ts`: it takes today in the store's TZ, fetches every partition a covering circular could live in (`candidateWeekIds(today)` in `types/database.ts` — the weekIds of all possible start dates in the last `MAX_CIRCULAR_LENGTH_DAYS`), and returns the one with `startDate <= today <= endDate` (latest start wins on overlap). "Today's weekId" is wrong in two known cases: an extended holiday ad still running in last week's partition while this week's partition holds a pre-scraped ad that hasn't started, and year boundaries (`getWeekIdForDate` gives Wed 2026-12-30 → `2026-W53` but Mon 2027-01-04 → `2027-W01`).
- Read-side endpoints (`/me/deals`, `/admin/scrape/status`, the `?week=` gate) all go through `findActiveCircular`, so each store flips exactly when its local date leaves the old circular's range.
- Known limitation (write side): two circulars that *start* in the same Wed→Tue window get the same weekId and would share a partition (deals mixed, metadata overwritten). Hasn't happened yet; would take something like a 2-day Thanksgiving-only ad followed by a Black Friday ad.
- `weekId < currentWeekId` (lexical compare) is the correct way to filter "strictly past" weeks; works across year boundaries since the format is zero-padded.

### Scheduled preview-scrape (prod-only)
- **EventBridge Scheduler** fires a weekly recurring schedule Tue 9am `America/Denver` → planner Lambda → per-store one-time schedules at uniformly random times in `[SCHEDULE_WINDOW_START_HOUR, END_HOUR]` MT today (defaults 12/23, env-tunable on the planner Lambda) → worker Lambda → existing `fetchAndPersistWeeklyDeals(..., { preview: true })`.
- One-time schedules use `ActionAfterCompletion: DELETE` to self-clean. Deterministic schedule names = idempotent on planner re-runs (`ConflictException` swallowed).
- Manual triggers: `POST /admin/scheduler/plan-now?dryRun=true|false` (default `true`). Dev tests scheduling logic via dryRun against local API + DDB without touching AWS. Prod escape hatch with `?dryRun=false`.
- `@aws-sdk/client-scheduler` is **not** in the Lambda Node 22 runtime defaults, so the planner Lambda bundles it (whereas the api Lambda externalizes `@aws-sdk/*` since it only uses runtime-provided clients).
- **Live-circular check** (`api/src/jobs/liveCircularCheck.ts`, `runLiveCircularCheck`): backstop for ads the Tuesday run misses because the chain hadn't published them yet (Safeway's post-Thanksgiving 2026 ad, starting Fri Nov 27, wasn't up on Tue Nov 24). A second recurring schedule, `live-circular-check` (`cron(30 0,12 * * ? *)` `America/Denver`: 00:30 and 12:30 MT daily), invokes its own Lambda (10 min timeout), which checks enabled non-sprouts stores one at a time.
  - Per store, metadata only: Kroger `fetchCircularsList` (scraper-worker `/scrape/kingsoopers/circulars`) or Safeway Flipp publications → the ad whose store-local dates cover today (`pickLiveCircular` / `selectWeeklyAd`) → `getCircular(instanceId, circularWeekId(startDate))`, the same partition the scrape would write to.
  - Same circularId → `already_scraped`, no deal fetch. Missing → the chain's `fetchAndPersistWeeklyDeals` with no `preview`, except Kroger passes `preview` = the live ad's own `previewCircular` flag, because the scraper-worker picks a circular by that flag. Nothing upstream covers today → `no_live_ad` (logged, not thrown). Partition already holds a *different* circular → `partition_conflict`: warns and writes nothing, because a non-force scrape would mix two ads' deals. Resolve it by hand with `/admin/scrape/auto?force=true`.
  - Per-store failures don't stop other stores. The Lambda handler throws at the end if any store returned `error`, so it shows in the Errors metric and Lambda's async retries re-run the check (cheap for stores already done).
  - Manual trigger: `POST /admin/scheduler/live-check-now?dryRun=true|false&instanceId=X` (default `dryRun=true`, like plan-now). A dry run still reads upstream metadata and DDB but writes nothing. In prod, use `instanceId` with `dryRun=false`: API Gateway's 30s limit can cut off a multi-store run.
  - Logs: `"live circular scraped"` when it filled a gap; `"live check done"` carries per-run counts.

### Frontend Structure (`frontend/src/app/`)
- `app.routes.ts` — Lazy-loaded standalone routes
- `core/auth/` — Auth0 integration; `roleGuard('role1', 'role2')` (takes role args) for protected routes; `landingGuard` redirects authenticated users past the landing page
- `core/models/` — TypeScript interfaces for deals, stores, admin
- `core/services/` — `deals.service.ts`, `stores.service.ts`, `admin.service.ts`, `analytics.service.ts`, `profile.service.ts`, `role.service.ts` (all `providedIn: 'root'`)
- `pages/` — Feature pages: `dashboard/`, `deals/`, `stores/`, `admin/`, `landing/`, `onboarding/`, `user/`, `analytics/`
- `shared/components/` — Reusable components

## Angular Rules (frontend/)

- Standalone components only — do NOT set `standalone: true` (default in v20+)
- Use `input()` / `output()` functions, not `@Input` / `@Output` decorators
- Use `inject()` function, not constructor injection
- Use signals for state; `computed()` for derived state; never `mutate()` — use `set()` / `update()`
- `changeDetection: ChangeDetectionStrategy.OnPush` on all components
- Native control flow only: `@if`, `@for`, `@switch` — never `*ngIf`, `*ngFor`, `*ngSwitch`
- No `ngClass` — use `[class]` bindings; no `ngStyle` — use `[style]` bindings
- No `@HostBinding` / `@HostListener` — put host bindings in `host: {}` in the decorator
- Reactive forms over template-driven
- Must pass AXE checks and WCAG AA minimums

## PrimeNG v21 Notes
- Row expansion template name is `#expandedrow` (not `#rowexpansion`)
- Template names match their `ContentChild` decorator arg: `#header`, `#body`, `#expandedrow`, etc.
