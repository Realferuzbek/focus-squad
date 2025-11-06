# Flip Countdown — web-only

Flip Countdown is a lightweight countdown timer served as a plain static site. It stays local-only, ships the background and alarm assets, and runs entirely in the browser.

## Local development
```bash
npm install
npm run start
```
Then open <http://localhost:5173>.

## Deployment (Vercel)
1. Framework preset: **Other**
2. Output directory: `/` (project root)
3. Build command: *(leave empty for static hosting)*

## Legacy Electron build
The full Electron desktop app is preserved on the `electron-app-snapshot` branch if you need installers or packaging scripts.
