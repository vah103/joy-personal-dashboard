# Frontend source

This project is Cloudflare-first. All browser source files live under `src/` and are compiled or copied into the ignored `dist/` directory by `npm run build`.

- `pages/` — dashboard, login, and sale entry pages.
- `features/` — auth, finance, notifications, project details, Project Hub, tasks, and weather.
- `assets/` — icons and bundled Nunito fonts.
- `pwa/` — the web app manifest and service worker.

Public filenames in `dist/` remain stable so installed app icons, cached links, and Cloudflare routes continue working.
