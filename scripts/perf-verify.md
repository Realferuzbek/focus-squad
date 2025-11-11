# Performance Verification Playbook

## Targets
- Desktop Lighthouse RES > 90 for `/dashboard`, `/feature/timer`, `/signin`
- `FCP < 1.8s`, `LCP < 2.5s`, `CLS ≈ 0`, `INP < 100ms`

## Local Commands
1. Install deps: `pnpm install` (or `npm install` / `yarn install`)
2. Bundle review: `pnpm analyze`
3. Production build: `NEXT_TELEMETRY_DISABLED=1 next build`
4. Lighthouse desktop runs:
   - `npx lighthouse http://localhost:3000/dashboard --preset=desktop --view`
   - `npx lighthouse http://localhost:3000/feature/timer --preset=desktop --view`
   - `npx lighthouse http://localhost:3000/signin --preset=desktop --view`

## What To Look For
- Identify the reported LCP element in each audit and confirm it is the hero text/image that now streams immediately.
- Ensure `/dashboard`’s avatar/tile section renders without blocking on client JS (check waterfall for <100KB JS before LCP).
- Verify `/feature/timer` shows the iframe/document as LCP with `fetchpriority=high` and no extra blocking requests.
- Confirm `/signin` keeps CLS at ~0 (no shifting between skeleton and hydrated state).
