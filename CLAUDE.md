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
- **Auth**: Auth0 JWT with scope-based authorization (`user`, `admin`, `browse` scopes)
- **Infra**: AWS CDK v2

### API Structure (`api/src/`)
- `app.ts` — Route definitions. Routes are `/api/stores/:type`, `/api/admin/*`, `/api/me/*`
- `middleware/auth.ts` — `authMiddleware({ required, scopes })` factory; injects `AuthUser` into context
- `db/client.ts` — DynamoDB client (AWS SDK v3 `@aws-sdk/lib-dynamodb`)
- `scraper/` — `kingsoopers.ts` (Kroger API), `safeway.ts` (Flipp API), `products.ts` (canonical product matching). All return `StandardDeal` objects.
- `types/database.ts` — All DynamoDB item type definitions

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

Store instance IDs are `{type}:{sha256_hash(identifiers)}`. Supported chains: `kingsoopers`, `safeway`, `sprouts`.

### Frontend Structure (`frontend/src/app/`)
- `app.routes.ts` — Lazy-loaded standalone routes
- `core/auth/` — Auth0 integration, `roleGuard` for admin routes
- `core/models/` — TypeScript interfaces for deals, stores, admin
- `core/services/` — `deals.service.ts`, `stores.service.ts`, `admin.service.ts` (all `providedIn: 'root'`)
- `pages/` — Feature pages: `dashboard/`, `deals/`, `stores/`, `admin/`
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
