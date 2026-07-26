# Frontend modules

These files are source modules used only by the Cloudflare production build.

- `auth/` — Google account and integration controls.
- `project-hub/` — TurtleBot4 Project Hub UI, rendering, actions, performance guard, and card artwork.
- `notifications/` — Web Push setup, mobile notification styling, and the three-state weather status UI.

`scripts/build.mjs` copies these modules into `dist/` using their existing public filenames, so deployed URLs remain backward-compatible.
