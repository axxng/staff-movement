# Staff Movement

A self-hosted org-chart and squad-tracking tool. Track reporting lines, move
people across squads, see the full history of every change, and export
snapshots as PNG. Deploys to Vercel free tier with **zero** backend setup —
all data lives in your browser via `localStorage`, with JSON backup/restore for
moving between devices.

## Features

- **Squads view** — nested teams (sub-teams can have sub-sub-teams), drag and
  drop staff between squads. Staff can belong to 0–N teams at once.
- **Reporting view** — drag a person onto another to set their manager. Drop
  on the top zone to clear the manager.
- **History** — every reorganisation (manager change, role change, team join /
  leave / create / delete / reparent, rename) is recorded and searchable.
- **Color-coded role badges** — fully customisable role list and colors.
- **Multiple top-level teams** — model your whole org or just one slice.
- **PNG export** — export either chart view as a PNG snapshot.
- **JSON backup / restore** — move data across devices, snapshot before a
  reorg, share with teammates.
- **Sample data** — one click to populate a demo org.

## Tech

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Zustand (with `persist` middleware → `localStorage`)
- @dnd-kit/core for drag-and-drop
- html-to-image for PNG export

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Deploy to Vercel (free tier)

This is a static-friendly Next.js app with no server runtime, no DB, and no
env vars — perfect for the Hobby plan.

1. Push this repo to GitHub.
2. Visit <https://vercel.com/new> and import the repo.
3. Accept the defaults (framework: Next.js).
4. Click **Deploy**.

That's it. Subsequent pushes auto-deploy. Because data lives in your browser,
each user has their own private workspace; use **Backup JSON** to move data
between devices or share a snapshot.

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
- **`+sub`** on a team to create a sub-team. Sub-teams can have their own
  sub-teams, with no depth limit.
- The **Membership** tab in the sidebar is the fastest way to put one person
  on multiple squads.
- **Backup JSON** before any large reorg — it's free insurance.
- Cycle prevention is built-in: you can't make someone manage their own
  manager, and you can't reparent a team into one of its descendants.

## Limits of localStorage

`localStorage` is per-browser, per-domain. If you want shared multi-user
state, swap `lib/store.ts`'s persist storage for a remote KV (Vercel KV,
Upstash Redis, Supabase, etc.) — the store interface stays the same.
