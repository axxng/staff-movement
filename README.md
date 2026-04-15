# Staff Movement

A self-hosted org-chart and squad-tracking tool. Track reporting lines, move
people across squads, see the full history of every change, and export
snapshots as PNG.

Deploys to **Vercel free tier** with optional **Upstash Redis** (also free
tier) for cross-device sync. Without Redis it still works as a single-browser
app via `localStorage`.

## Features

- **Squads view** — nested teams (sub-teams can have sub-sub-teams, no depth
  limit). Drag-and-drop staff between squads. Staff can belong to N squads at
  once. Per-team PNG export from the team header.
- **Reporting view** — drag a person onto another to set their manager. Drop
  on the top zone to clear the manager. Cycle prevention built in.
- **History** — every reorganisation is recorded with timestamp, type, and
  before/after labels. Searchable and filterable.
- **Search** — global search box dims everything that doesn't match a name,
  role, or team. Works on both views simultaneously.
- **Undo / Redo** — `Cmd/Ctrl+Z` to undo, `Cmd/Ctrl+Shift+Z` (or `Ctrl+Y`) to
  redo. Up to 100 steps.
- **Color-coded role badges** — fully editable role list with color picker.
- **Multiple top-level teams** — model your whole org or just one slice.
- **PNG export** — full-view export, plus per-team subtree export.
- **JSON backup / restore** — manual snapshots; works without a server.
- **Cross-device sync** — optional, via Upstash Redis. Optimistic
  concurrency control means simultaneous edits won't silently clobber each
  other.
- **Password gate** — optional, set `APP_PASSWORD` to keep your public
  Vercel URL private.
- **Sample data** — one click to populate a demo org.

## Tech

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Zustand + zundo (undo) + persist middleware (`localStorage`)
- @dnd-kit/core for drag-and-drop
- @upstash/redis for cross-device sync
- html-to-image for PNG export

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Without Redis env vars the sync indicator
shows **Local only** and everything stays in your browser.

## Deploy to Vercel (free tier)

### 1. Push the repo to GitHub
Then `Import Project` at <https://vercel.com/new>, accept Next.js defaults,
deploy.

### 2. (Optional) Add Upstash Redis for cross-device sync

You have two equivalent options:

**Option A — via Vercel Marketplace (recommended)**
1. In your Vercel project → **Storage** → **Create Database** →
   **Upstash → Redis**.
2. Pick the free plan, region, and a name.
3. Vercel automatically injects `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` into your project's env vars (and pulls them
   locally with `vercel env pull`).
4. Redeploy.

**Option B — direct from upstash.com**
1. Create a free Redis database at <https://upstash.com>.
2. Copy the **REST URL** and **REST Token**.
3. In Vercel project → **Settings → Environment Variables**, add:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Redeploy.

Either way: open the deployed site, the indicator should turn green
("Synced"). Open the same URL on a second device — it loads the same data.

### 3. (Optional) Add a password

Add `APP_PASSWORD` to your Vercel env vars (any string). On next load the
app will prompt for it before allowing reads or writes. The password is
stored in `localStorage` per browser, and the **Sign out** link in the
header forgets it.

> Note: `APP_PASSWORD` is a single shared password — it's a privacy gate,
> not a multi-user auth system. Pick a long random string.

## How sync works

- On mount, the client calls `GET /api/state`. If the server has data, the
  client adopts it. If the server is empty, the client pushes its local
  state.
- Every state change debounces (600 ms) into a `PUT /api/state` with the
  last-seen `updatedAt` as a base version.
- If the server's current `updatedAt` is newer than the base, the server
  returns `409` with the latest state. The client adopts it instead of
  clobbering. (This is "last-write-wins with collision detection" — good
  enough for a small team. For a multi-editor scenario, swap in a CRDT.)
- The `localStorage` cache stays in sync, so you have an offline copy too.

## Data model

```ts
Staff      { id, name, roleId, managerId | null }
Team       { id, name, parentId | null, memberIds: StaffId[] }
Role       { id, label, color }
Movement   { id, timestamp, type, staffId?, teamId?, fromLabel?, toLabel?, note? }
```

- A team's `parentId` enables arbitrary nesting (squad → sub-squad → ...).
- A staff member can appear in any number of `Team.memberIds` arrays.
- Reporting lines are independent of squad membership — they're just
  `Staff.managerId`. The reporting tree is derived from the full staff list.

## Tips

- **Double-click a team name** to rename it.
- **`+sub`** on a team to create a sub-team.
- **`PNG`** in a team header exports just that subtree (vs. **Export PNG**
  on the whole view).
- The **Membership** tab in the sidebar is the fastest way to put one
  person on multiple squads.
- Cycle prevention is built in — you can't make someone manage their own
  manager, and you can't reparent a team into one of its descendants.
- Use **Backup JSON** before any large reorg — it's free insurance, even
  if you have Redis configured.
