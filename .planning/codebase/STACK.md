# Technology Stack

**Analysis Date:** 2026-05-24

## Languages

**Primary:**
- TypeScript ~5.7.3 — All application source under `frontend/src/` (`.ts` and `.tsx`)
- TSX/JSX (react-jsx) — All React components (`frontend/src/components/*.tsx`, `frontend/src/main.tsx`)

**Secondary:**
- CSS (Tailwind v4 directives) — `frontend/src/index.css` (global styles, theme tokens, Geist font)
- HTML — `frontend/index.html` (single entry point, mounts `<div id="root">`)
- JSON — Preset scene definitions under `frontend/src/presets/*.json`

## Runtime

**Environment:**
- Browser only (single-page application). No Node.js runtime in production.
- Target: `esnext` (modern browsers with WebGL2 + WebAssembly support) — `frontend/vite.config.ts:18`
- Module system: Native ESM (`"type": "module"` in `frontend/package.json:5`)
- WebAssembly: Rapier physics engine loaded as inlined-base64 WASM via `@dimforge/rapier3d-compat`

**Package Manager:**
- npm (lockfile: `frontend/package-lock.json` present, ~committed)
- No `.nvmrc` / `.node-version` pinned. Node only used for build tooling (Vite, Vitest, tsc).

## Frameworks

**Core (UI):**
- React 19.1.0 — Component model, hooks, StrictMode (`frontend/src/main.tsx:7`)
- React DOM 19.1.0 — `createRoot` rendering API
- @vitejs/plugin-react 4.4.0 — Fast Refresh + JSX transform (`frontend/vite.config.ts:8`)

**3D Rendering Stack:**
- three 0.174.0 — WebGL renderer, scene graph, geometries, materials
- @react-three/fiber 9.1.0 — React reconciler for three.js (declarative `<Canvas>`)
- @react-three/drei 10.7.0 — Helpers (`OrbitControls`, `Grid`, `GizmoHelper`, `GizmoViewport`, `Cone`, `Cylinder`, `Outlines`) used in `frontend/src/components/Scene3D.tsx` and `frontend/src/components/Arrow3D.tsx`
- @react-three/rapier 2.2.0 — Rapier WASM bridge for R3F (`<Physics>`, `<RigidBody>`, `useSpringJoint`, `useBeforePhysicsStep`)

**Physics Engine:**
- @dimforge/rapier3d-compat 0.19.2 (transitive, pinned by `@react-three/rapier`) — Rust-compiled WASM physics. Listed in `optimizeDeps.exclude` to avoid Vite pre-bundling its WASM (`frontend/vite.config.ts:14-16`).

**State Management:**
- zustand 5.0.5 — Global stores with slice pattern + `persist` middleware (`zustand/middleware`)
  - Used by: `frontend/src/store/index.ts`, `frontend/src/store/snapshotSlice.ts`, `frontend/src/store/visualizationStore.ts`, `frontend/src/store/chartDataStore.ts`

**Forms & Validation:**
- react-hook-form 7.74.0 — Form state in dialogs (`CreationDialog.tsx`, `ForceFieldDialog.tsx`, `SpringCreationDialog.tsx`)
- @hookform/resolvers 5.2.2 — Bridge to Zod
- zod 4.4.1 — Runtime schema validation (`frontend/src/utils/sceneValidation.ts`)

**UI Component Library:**
- shadcn 4.6.0 + shadcn/ui primitives under `frontend/src/components/ui/` (style: `radix-nova`, base color: `neutral`, configured in `frontend/components.json`)
- radix-ui 1.4.3 (umbrella) — Unstyled accessible primitives (Dialog, DropdownMenu, ScrollArea, Sheet, Tooltip, Switch, Slider, Label, Separator)
- @radix-ui/react-slot 1.1.2, @radix-ui/react-tooltip 1.1.8 — Explicit pinned versions
- class-variance-authority 0.7.1 + clsx 2.1.1 + tailwind-merge 3.5.0 — `cn()` utility in `frontend/src/lib/utils.ts`
- lucide-react 0.487.0 — Icon library (configured in `frontend/components.json:13`)
- sonner 2.0.7 — Toast notifications (wrapped at `frontend/src/components/ui/sonner.tsx`)

**Layout & Interaction:**
- react-draggable 4.5.0 — Draggable panels (e.g., `ChartPanel.tsx`). Requires `findDOMNode` polyfill for React 19 — see `frontend/src/test/setup.ts:13-25`.
- re-resizable 6.11.2 — Resizable side panels

**Charting:**
- lightweight-charts 5.2.0 — TradingView charting library used by `frontend/src/components/ChartCanvas.tsx`

**Styling:**
- tailwindcss 4.1.0 — Utility CSS framework (v4, CSS-first config via `@theme` in `frontend/src/index.css`)
- @tailwindcss/vite 4.1.0 — Vite plugin replacing PostCSS pipeline (`frontend/vite.config.ts:8`)
- tw-animate-css 1.4.0 — Animation utilities
- postcss 8.5.0 + autoprefixer 10.4.20 — Present as devDeps but Tailwind v4 plugin handles processing
- @fontsource-variable/geist 5.2.8 — Geist variable font (also pulled from Google Fonts at top of `frontend/src/index.css:2`)

**Testing:**
- vitest 4.1.5 — Test runner (Vite-native, jest-compatible API)
- @testing-library/react 16.3.2 — React component testing
- @testing-library/jest-dom 6.9.1 — Custom matchers (`toBeInTheDocument`, etc.)
- jsdom 29.1.1 — DOM environment for tests (`frontend/vite.config.ts:25`)

**Build/Dev:**
- vite 6.3.0 — Dev server + production bundler
- typescript ~5.7.3 — Compiler (used for type-checking; emit handled by Vite)
- Build target: `esnext` (no transpilation to legacy syntax)

## Key Dependencies

**Critical (physics correctness depends on these):**
- @dimforge/rapier3d-compat 0.19.2 — Authoritative physics simulation. WASM module excluded from Vite optimizeDeps.
- @react-three/rapier 2.2.0 — Bridges Rapier WASM to React lifecycle. Provides `<Physics timeStep={1/120}>` in `frontend/src/components/Scene3D.tsx`.
- three 0.174.0 — Underlying WebGL renderer; @types/three pinned at 0.173.0 (one minor behind runtime).
- @react-three/fiber 9.1.0 — Renderer reconciler. React 19 compatibility required.

**State & validation:**
- zustand 5.0.5 — Single source of truth for entities, simulation control, UI state.
- zod 4.4.1 — Scene JSON validation gate at import boundary (`frontend/src/utils/sceneValidation.ts`).

**Visualization data path:**
- lightweight-charts 5.2.0 — Time-series chart renderer for 12 physics metrics.

## Configuration

**Environment:**
- No `.env` files present in `frontend/` (verified — repo uses no `VITE_*` environment variables in source).
- No runtime configuration injected at build time. All configuration lives in code or `localStorage`.

**Build:**
- `frontend/vite.config.ts` — Vite config (React plugin, Tailwind plugin, `@/*` alias to `./src/*`, esnext target, port 5173 with `open: true`, Vitest test config inline)
- `frontend/tsconfig.json` — Project references root (no source files, just composite refs)
- `frontend/tsconfig.app.json` — App TS config (`ES2022` target, `react-jsx`, `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `bundler` moduleResolution, `@/*` path alias)
- `frontend/tsconfig.node.json` — Node-side config for `vite.config.ts` (`ES2023` lib, `strict`)
- `frontend/components.json` — shadcn CLI config (style `radix-nova`, css `src/index.css`, `cssVariables: true`, no Tailwind config file because v4 uses CSS-first)

**Lint/Format:**
- No ESLint config detected in `frontend/`. No `.eslintrc*` / `eslint.config.*`.
- No Prettier config detected. No `.prettierrc*` / `prettier.config.*`.
- Code style is enforced by TypeScript strict mode + reviewer discretion only.

**Scripts (`frontend/package.json:6-10`):**
```bash
npm run dev        # vite — start dev server on :5173, auto-opens browser
npm run build      # tsc -b && vite build — typecheck then bundle to frontend/dist/
npm run preview    # vite preview — serve built artifacts locally
```

No `test` script is registered in `package.json` despite Vitest being installed and configured. Tests are invoked via `npx vitest` directly.

## Platform Requirements

**Development:**
- Node.js (any LTS able to run Vite 6 / Vitest 4) — version not pinned
- Modern browser with WebGL2 + WebAssembly support (the app probes WebGL in `frontend/src/components/App.tsx`)
- Windows / macOS / Linux all supported (no platform-specific deps; Windows used per `gitStatus`)

**Production:**
- Deployment target: **Static SPA**. `vite build` outputs to `frontend/dist/` (verified: contains `index.html` + `assets/`).
- Host: Any static file host (no Node server, no edge functions, no SSR). Suitable for GitHub Pages, Netlify, Vercel static, S3+CloudFront, etc.
- Browser must support: ES2022 syntax, WebAssembly (for Rapier), WebGL2 (for three.js), `localStorage` (for persistence).

**No backend:** This is a fully client-side application. See `.planning/codebase/INTEGRATIONS.md` for details on the (vestigial, unused) backend API stub at `frontend/src/store/api.ts` and the local-only persistence strategy.

## Cross-Links

- Directory layout and where new code goes: `.planning/codebase/STRUCTURE.md`
- Layer responsibilities and data flow: `.planning/codebase/ARCHITECTURE.md`

---

*Stack analysis: 2026-05-24*
