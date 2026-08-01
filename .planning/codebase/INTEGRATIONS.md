# External Integrations

**Analysis Date:** 2026-05-24

## Summary

**Physis is a fully client-side single-page application with NO live external service integrations.** It runs entirely in the browser, performs physics simulation locally via WebAssembly (Rapier), and persists user data to the browser's `localStorage`. There is no backend server, no remote database, no authentication provider, no telemetry service, and no third-party SDK that communicates with a remote endpoint at runtime.

The only network requests the app issues at runtime are:
1. Fetching the Geist webfont CSS from `https://fonts.googleapis.com/css2?family=Geist...` at app load (`frontend/src/index.css:2`).
2. Static asset loading from the same origin (the bundled JS, CSS, WASM-as-base64, and preset JSON).

See `.planning/codebase/STACK.md` for the full dependency inventory and `.planning/codebase/ARCHITECTURE.md` for the layered architecture this document references.

## APIs & External Services

**Not applicable.** No HTTP/REST/GraphQL clients are used in production code. There are zero invocations of `fetch(`, `axios`, or `XMLHttpRequest` in `frontend/src/`.

**Vestigial backend client (UNUSED):**
- File: `frontend/src/store/api.ts`
- Status: Dead code. References `../api` (which does not exist) and imports `scenesApi`, `simulationsApi`, `SimulationWebSocket`, `MessageType` from a missing module. Not imported by any active code path; not registered in `useSimulationStore` (`frontend/src/store/index.ts`).
- Intent (per its docstrings): Future integration with a hypothetical Phase-1-era Python/FastAPI backend offering scene CRUD, simulation lifecycle, and a WebSocket stream of physics state.
- Treatment: Should either be deleted or moved to a `legacy/` folder. Flagged in `.planning/codebase/CONCERNS.md` if/when that document is produced.

## Data Storage

**Databases:**
- None. No SQL, no NoSQL, no remote document store, no Supabase / Firebase / PlanetScale / Neon / etc.

**Local Persistence (Browser Storage):**

All persistence is local to the user's browser. There are **two distinct localStorage layers**, both implemented via Zustand's `persist` middleware:

| Storage Key | File | What it persists | Quota guard |
|-------------|------|------------------|-------------|
| `physis-snapshots` | `frontend/src/store/snapshotSlice.ts:168` | 5 named snapshot slots (full scene: environment + entities + constraints) | `QuotaExceededError` caught and returned as user error (`frontend/src/store/snapshotSlice.ts:122-126`) |
| `physis-visualization` | `frontend/src/store/visualizationStore.ts:37` | Visualization toggles (trails, force/velocity vector display, vector display mode) | None |

- Connection: Synchronous Web Storage API (`window.localStorage`)
- Client: `zustand/middleware` `persist` + `createJSONStorage(() => localStorage)` (`frontend/src/store/snapshotSlice.ts:2`, `frontend/src/store/visualizationStore.ts:2`)
- Serialization caveat: `Map<string, Entity>` is manually flattened to a plain array before storage (`serializeEntities()` in `frontend/src/store/snapshotSlice.ts:61-82`) because the default JSON serializer drops `Map`/`Set` contents.
- Version migrations: `version: 1` set on snapshot store (`frontend/src/store/snapshotSlice.ts:171`) — currently no migration handlers wired.

**IndexedDB:**
- Not used. No `indexedDB` references in `frontend/src/` (grep confirmed).

**File-based scene I/O (user-initiated, not automatic persistence):**
- Export: `frontend/src/components/SceneLoader.tsx:197` — `serializeScene()` produces a JSON blob, the browser downloads it (`frontend/src/utils/sceneSerializer.ts:55`).
- Import: User picks a `.json` file; `deserializeScene()` validates with Zod (`frontend/src/utils/sceneSerializer.ts:119`, `frontend/src/utils/sceneValidation.ts`).
- This is not a persistence layer — it's an explicit user gesture for portability between sessions/machines.

**Static scene data (read-only, bundled):**
- `frontend/src/presets/*.json` — 5 bundled preset scenes (`double-spring.json`, `free-fall-stack.json`, `inclined-plane.json`, `projectile.json`, `spring-oscillator.json`). Loaded via static ES imports; not fetched at runtime.

**File Storage:**
- Local filesystem only — and only via user-initiated download/upload through the browser file picker (see scene I/O above). No S3, no Cloudinary, no UploadThing, no Supabase Storage.

**Caching:**
- None at the application layer. Browser HTTP cache handles static assets.
- In-memory module-level caches exist for physics frame data (e.g., `chartBuffers` at `frontend/src/store/chartBuffer.ts:92`, `contactForceMap` at `frontend/src/components/contactForceStore.ts:8`) — these are runtime buffers, not "caches" in the integration sense.

## Authentication & Identity

**Auth Provider:**
- None. The application has no concept of users, accounts, sessions, or auth tokens.
- No Clerk, Auth0, NextAuth, Supabase Auth, Firebase Auth, Cognito, etc.

**Why:** Pure client-side tool. All data is per-browser-profile via `localStorage`. There is nothing to authenticate against.

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry, Rollbar, Bugsnag, Datadog RUM, or similar SDK.
- Errors are surfaced to the user via `sonner` toast notifications and an in-app `<ErrorFallback>` component (`frontend/src/components/ErrorFallback.tsx`).

**Logs:**
- `console.log` / `console.warn` / `console.error` only. No structured logger. No remote log shipping.

**Analytics:**
- None. No Google Analytics, Plausible, PostHog, Amplitude, Mixpanel, etc.

**Performance Monitoring:**
- None. The repo's `frontend/benchmark/` directory exists for local benchmarks (see `.planning/codebase/STRUCTURE.md`-implied tooling), not for production telemetry.

## CI/CD & Deployment

**Hosting:**
- Not configured in-repo. Output of `npm run build` (a static `frontend/dist/` directory) can be deployed to any static host.

**CI Pipeline:**
- None detected. No `.github/workflows/`, no `.gitlab-ci.yml`, no `azure-pipelines.yml`, no `bitbucket-pipelines.yml`, no Jenkinsfile.

**Deployment Hooks:**
- None.

## Environment Configuration

**Required env vars:**
- **None.** No `import.meta.env.VITE_*` references in `frontend/src/`. The application requires zero environment configuration to build or run.

**Secrets location:**
- Not applicable. There are no secrets — no API keys, no client tokens, no DSNs, nothing to leak.

**`.env*` files:**
- Not present in `frontend/`. The application is statically configurable through source code only.

## Webhooks & Callbacks

**Incoming:**
- None. The application is a browser SPA — it cannot receive webhooks.

**Outgoing:**
- None. The application does not call any third-party APIs at runtime.

## Third-Party Network Endpoints Actually Contacted at Runtime

Despite having no integrations in the traditional sense, the running app does make these network requests:

| Endpoint | Purpose | Trigger | Where configured |
|----------|---------|---------|------------------|
| `https://fonts.googleapis.com/css2?family=Geist:wght@400;600&family=Geist+Mono:wght@400;600&display=swap` | Geist webfont CSS | App load | `frontend/src/index.css:2` |
| `https://fonts.gstatic.com/...` (transitively) | Geist font files | After CSS loads | Triggered by the @import above |

**Note:** The repo also bundles `@fontsource-variable/geist` 5.2.8 (`frontend/src/index.css:10`) which ships the font locally. The Google Fonts `@import` is therefore redundant and represents an unnecessary third-party request — flagged for consideration in any concerns audit.

## Browser APIs Used (not "integrations" but worth surfacing for completeness)

These are first-party browser platform APIs the app depends on; they are not external services but they are the boundary surface that someone reviewing "integrations" might care about:

- **WebGL2** — three.js renderer (`frontend/src/components/Scene3D.tsx`)
- **WebAssembly** — Rapier physics engine via `@dimforge/rapier3d-compat`
- **Web Storage (`localStorage`)** — see "Local Persistence" above
- **File API / Blob / URL.createObjectURL** — scene export download (`frontend/src/utils/sceneSerializer.ts`, `frontend/src/components/SceneLoader.tsx`)
- **`<input type="file">`** — scene import upload (`frontend/src/components/MenuBar.tsx`)
- **ResizeObserver** — Radix UI internals; polyfilled in test setup (`frontend/src/test/setup.ts:5-9`)
- **Page Visibility API** — pause-on-hide in `frontend/src/components/App.tsx` (per `ARCHITECTURE.md` line 44)
- **Keyboard events** — global shortcuts in `frontend/src/components/App.tsx`

## Cross-Links

- Persistence implementation details and constraints: `.planning/codebase/ARCHITECTURE.md` (see "Store Layer" and "Architectural Constraints" sections)
- File locations for persistence stores: `.planning/codebase/STRUCTURE.md` (see `src/store/`)
- Full dependency list and versions: `.planning/codebase/STACK.md`

---

*Integration audit: 2026-05-24*
