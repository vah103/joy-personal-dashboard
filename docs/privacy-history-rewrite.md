# Controlled Git history privacy cleanup

The current build removes private Google Docs links from deploy artifacts, and new runtime source must not add personal seed data. Historical commits can still contain files that were public at the time they were committed. Removing those objects requires rewriting Git history and force-updating the remote; it must not be performed as part of a normal feature PR.

## Preconditions

1. Make the repository temporarily private or schedule a maintenance window.
2. Disable merges and ask every contributor to stop pushing.
3. Create a mirror backup outside the repository:

   ```bash
   git clone --mirror git@github.com:vah103/joy-personal-dashboard.git joy-personal-dashboard-backup.git
   ```

4. Record the current `main` SHA and production Worker version.
5. Rotate or revoke any credential that was ever committed. OAuth client IDs are public identifiers, but client secrets, refresh tokens and encryption secrets must always be rotated.

## Rewrite in a disposable mirror

Install `git-filter-repo`, clone a second mirror and remove the known private paths or text patterns. Examples:

```bash
python -m pip install git-filter-repo
git clone --mirror git@github.com:vah103/joy-personal-dashboard.git joy-personal-dashboard-rewrite.git
cd joy-personal-dashboard-rewrite.git

git filter-repo \
  --path worker/finance-with-seed.js \
  --invert-paths
```

For document identifiers or other text embedded in otherwise valid files, use a replacement expressions file and review every rewritten commit:

```bash
cat > replacements.txt <<'EOF'
<private-document-id>==>private-document
EOF

git filter-repo --replace-text replacements.txt
```

Never paste real secrets into this tracked runbook. Keep the replacement file outside the repository.

## Validate before force-push

```bash
git fsck --full
git log --all -- worker/finance-with-seed.js
git grep '<private-document-id>' $(git rev-list --all)
```

Also run a secret scanner against all rewritten refs and confirm that the application can be checked out, installed, tested and built from the rewritten `main`.

## Publish during the maintenance window

```bash
git push --force --mirror origin
```

Then:

- invalidate old branches and tags that should not survive;
- re-run CI and deploy only from the rewritten `main`;
- tell every contributor to delete old clones and clone again;
- remove cached archives or release artifacts that contain the old objects;
- keep the offline mirror backup until production is verified.

## Why this is manual

A history rewrite changes every descendant commit SHA and can break open pull requests, local clones, deployment references and audit trails. Normal deployment and cleanup commands must never force-push automatically.
