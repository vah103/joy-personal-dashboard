# Repository maintenance

## Source-of-truth rules

1. Dashboard pages live in `src/pages/`.
2. Reusable frontend behavior lives in `src/features/`.
3. Stable public data and browser URLs live in `project-data/`.
4. Cloudflare request handling lives in `worker/`.
5. D1 migrations are append-only. Never rewrite or delete an applied migration.
6. Generated output lives only in `dist/` and is never committed.

## Cross-feature ownership

A feature must not load another unrelated feature. In particular:

- Project Hub may load TurtleBot4 project assets only.
- IELTS may load IELTS assets only.
- Finance may load Finance assets only.
- Vocabulary and Say it are attached by `scripts/inject-language-tools.mjs`.

This prevents an unrelated cache failure from hiding another dashboard tool.

## Safe deletion checklist

A file may be deleted only after all of the following are true:

- no production HTML, JavaScript, CSS, Worker route, build script, service worker, or manifest references it;
- no test reads or validates it;
- it is not an applied D1 migration;
- it is not needed to preserve an existing public URL;
- it is not part of an active pull request that has not been replaced;
- `npm test` and `npm run build` pass after removal.

## Compatibility paths

`scripts/run-tests.mjs` creates temporary symlinks for legacy root filenames. These are local test artifacts, not committed duplicates. Do not add the old root files back to Git.

## Scratchpad status

The visible dashboard is being replaced by Vocabulary, but the existing Scratchpad persistence code and D1 history remain intentionally retained until the dashboard bootstrap is refactored and the stored note is exported or explicitly discarded. Removing only the UI route while leaving startup references would break the dashboard; deleting the tables or migrations would destroy recoverable user data.

## GitHub hygiene

- Develop on a focused branch and open one pull request per concern.
- Do not mix the open Finance expense-map work with repository cleanup.
- Close superseded pull requests rather than merging duplicate implementations.
- Delete merged remote branches from GitHub when the branch is no longer needed.
- Prefer squash merge for cleanup PRs so repository history has one clear maintenance commit.
