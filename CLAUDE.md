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
- `types/database.ts` — All DynamoDB item type definitions + week/timezone helpers (`activeWeekId`, `todayInStoreTz`, `getWeekIdForDate`)

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

GSI1 (Price History): GSI1PK = PRODUCT#<id>         GSI1SK = <date>#<instanceId>
GSI2 (Browse):        GSI2PK = WEEK#<week>          GSI2SK = STORE#<instanceId>#DEPT#<dept>
```

Store instance IDs are `{type}:{sha256_hash(identifiers)}`. Supported chains: `kingsoopers`, `safeway`, `sprouts`. Each `StoreInstanceItem` carries a required `timezone` field (IANA name, e.g. `America/Denver`) — used to resolve store-local calendar dates.

### Week IDs & "current week" resolution
- `weekId` format is `YYYY-Www` (zero-padded). Each circular is stored under the weekId derived from its own `startDate` (`getWeekIdForDate(new Date(startDate + 'T12:00:00'))`).
- Circulars run **Wed→Tue, 7 days, store-local calendar dates inclusive**. `CircularItem.startDate` and `endDate` are plain `YYYY-MM-DD` strings in the store's local TZ.
- "What week is it right now?" is **never** computed from a wall clock. Use `activeWeekId(timezone)` in `api/src/types/database.ts` — resolves today's date in the store's TZ → weekId of its current circular. The function relies on the invariant that any day inside a Wed→Tue range produces the same weekId as its startDate.
- Read-side endpoints (`/me/deals`, `/admin/scrape/status`) resolve "current" per-store via `activeWeekId`, so they tick over exactly when each store's local clock crosses Wed midnight — not when UTC does.
- `weekId < currentWeekId` (lexical compare) is the correct way to filter "strictly past" weeks; works across year boundaries since the format is zero-padded.

### Scheduled preview-scrape (prod-only)
- **EventBridge Scheduler** fires a weekly recurring schedule Tue 9am `America/Denver` → planner Lambda → per-store one-time schedules at uniformly random times in `[SCHEDULE_WINDOW_START_HOUR, END_HOUR]` MT today (defaults 9/23, env-tunable on the planner Lambda) → worker Lambda → existing `fetchAndPersistWeeklyDeals(..., { preview: true })`.
- One-time schedules use `ActionAfterCompletion: DELETE` to self-clean. Deterministic schedule names = idempotent on planner re-runs (`ConflictException` swallowed).
- Manual triggers: `POST /admin/scheduler/plan-now?dryRun=true|false` (default `true`). Dev tests scheduling logic via dryRun against local API + DDB without touching AWS. Prod escape hatch with `?dryRun=false`.
- `@aws-sdk/client-scheduler` is **not** in the Lambda Node 22 runtime defaults, so the planner Lambda bundles it (whereas the api Lambda externalizes `@aws-sdk/*` since it only uses runtime-provided clients).

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
