# User Authentication & Management Design

## Overview

Replace the current shared `APP_PASSWORD` with per-user username/password authentication, admin-managed user accounts, and session-based auth using httpOnly cookies. All data stored in the existing Upstash Redis instance.

## Data Model

### Users

Stored in Redis hash `staff-movement:users` as `username -> JSON`:

```json
{
  "username": "alice",
  "passwordHash": "$2b$10$...",
  "role": "admin" | "user",
  "createdAt": 1713168000000
}
```

- Passwords hashed with bcrypt
- Two roles: `admin` (can manage users) and `user` (can use the app)
- No self-registration; admins create all accounts

### Sessions

Stored as individual Redis keys: `staff-movement:session:{token} -> JSON`:

```json
{
  "username": "alice",
  "role": "admin"
}
```

- Token is a cryptographically random string
- Delivered to client as an httpOnly cookie (`staff-movement-session`)
- No expiry; sessions persist until explicit logout

### Seed Admin

On first visit, if no users exist in Redis, the login page shows a "Create Admin Account" form. This creates the first admin user and logs them in. This endpoint is disabled once any user exists.

## API Routes

### Auth Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | None | Validate credentials, set session cookie |
| POST | `/api/auth/logout` | Session | Clear session cookie, delete from Redis |
| GET | `/api/auth/me` | Session | Return current user `{ username, role }` or 401 |
| POST | `/api/auth/setup` | None | Create initial admin (only when 0 users exist) |

### User Management Routes (Admin Only)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users` | Admin | List all users (without password hashes) |
| POST | `/api/users` | Admin | Create user `{ username, password, role }` |
| PUT | `/api/users/[username]` | Admin | Update password or role |
| DELETE | `/api/users/[username]` | Admin | Delete user (cannot delete yourself) |

### Existing Routes

- `GET/PUT /api/state` — replace `x-app-password` header check with session cookie validation. Any logged-in user (admin or user) can read/write.
- `GET /api/config` — update to report auth method (no longer `authRequired` boolean based on `APP_PASSWORD`).

## Frontend

### Login Page (`/login`)

- Simple form: username, password, submit button
- On success: redirect to `/`
- On failure: show error message
- If no users exist: show "Create Admin Account" form instead (username + password)

### Navigation Guard

- `page.tsx` calls `GET /api/auth/me` on mount
- If 401: redirect to `/login`
- Pass user info (username, role) to child components

### User Management

- New section in the Sidebar, visible to admin users only
- Lists all users with role badges (admin/user)
- Add user form: username, password, role dropdown
- Per-user actions: change password, change role, delete
- Cannot delete yourself

### Removals

- Remove `PasswordPrompt.tsx` component
- Remove `APP_PASSWORD` env var support from API routes
- Remove `x-app-password` header logic from `lib/sync.ts`
- Remove password from localStorage

### Session Handling

- httpOnly cookie is sent automatically with all fetch requests (same-origin)
- Sync module (`lib/sync.ts`) no longer needs to manage password headers
- Sign out button calls `/api/auth/logout` and redirects to `/login`

## New Dependency

- `bcryptjs` — pure JS bcrypt implementation (no native compilation needed for Vercel serverless)

## Migration

When deploying this change:
1. The `APP_PASSWORD` env var becomes unused and can be removed from Vercel
2. First visit after deploy will prompt to create an admin account
3. No data migration needed — app state in Redis is unchanged
