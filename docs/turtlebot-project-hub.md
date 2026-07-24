# TurtleBot Project Hub

The TurtleBot Project Hub turns the **TurtleBot 4** card into a project workspace with four tabs:

- **Roadmap** — weighted stages, completion gates, editable checklist status and result summaries.
- **Commands** — reusable ROS 2 commands with run location, safety labels and editable personal copies.
- **Lab Journal** — daily GitHub reports summarized into commands, results, evidence and open issues.
- **Plan & Joy** — an editable next-action plan, To-do integration and project-aware guidance.

## Data ownership

The TurtleBot repository is the source of truth for:

- `.joy/project.json`
- `.joy/roadmap.json`
- `.joy/commands.json`
- `report/YYYY-MM-DD.md`
- commits, maps and evidence files

Joy stores personal edits separately in Cloudflare D1. GitHub refreshes therefore do not overwrite Vanh's edited summaries, checklist confirmations, personal commands, journals or plan.

## Private GitHub access

`vah103/turtlebot4_project` is private. Add a fine-grained GitHub token to the Cloudflare Worker as `GITHUB_TOKEN`.

The token only needs read access to this repository:

- **Contents:** Read-only
- **Metadata:** Read-only

Never place the token in frontend code or commit it to GitHub.

```bash
cd ~/joy-personal-dashboard/joy-personal-dashboard
npx wrangler secret put GITHUB_TOKEN
```

Paste the token only into Wrangler's private prompt.

Without the secret, Joy uses the bundled project snapshot and labels the card **GitHub snapshot**. Personal edits still fall back to local storage when the Google/D1 session is unavailable.

## Deploy

```bash
cd ~/joy-personal-dashboard/joy-personal-dashboard
git pull --ff-only
npm install
npm test
npm run db:migrate:remote
npm run deploy
```

After deployment, reconnect Google only when the current Joy session has expired. Open the **TurtleBot 4** card and confirm that the header says **GitHub synced · Saved**.
