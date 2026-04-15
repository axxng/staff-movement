import { Redis } from "@upstash/redis";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { AuthUser, SessionUser } from "./types";

const USERS_KEY = "staff-movement:users";
const SESSION_PREFIX = "staff-movement:session:";
const COOKIE_NAME = "staff-movement-session";

export function getRedis(): Redis | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// --- User CRUD ---

export async function listUsers(redis: Redis): Promise<AuthUser[]> {
  const all = await redis.hgetall<Record<string, AuthUser>>(USERS_KEY);
  if (!all) return [];
  return Object.values(all);
}

export async function getUser(
  redis: Redis,
  username: string,
): Promise<AuthUser | null> {
  return redis.hget<AuthUser>(USERS_KEY, username);
}

export async function userCount(redis: Redis): Promise<number> {
  return redis.hlen(USERS_KEY);
}

export async function createUser(
  redis: Redis,
  username: string,
  password: string,
  role: "admin" | "user",
): Promise<AuthUser> {
  const passwordHash = await bcrypt.hash(password, 10);
  const user: AuthUser = { username, passwordHash, role, createdAt: Date.now() };
  await redis.hset(USERS_KEY, { [username]: user });
  return user;
}

export async function updateUser(
  redis: Redis,
  username: string,
  updates: { password?: string; role?: "admin" | "user" },
): Promise<AuthUser | null> {
  const user = await getUser(redis, username);
  if (!user) return null;
  if (updates.password) {
    user.passwordHash = await bcrypt.hash(updates.password, 10);
  }
  if (updates.role) {
    user.role = updates.role;
  }
  await redis.hset(USERS_KEY, { [username]: user });
  return user;
}

export async function deleteUser(
  redis: Redis,
  username: string,
): Promise<boolean> {
  const removed = await redis.hdel(USERS_KEY, username);
  return removed > 0;
}

export async function verifyCredentials(
  redis: Redis,
  username: string,
  password: string,
): Promise<AuthUser | null> {
  const user = await getUser(redis, username);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

// --- Sessions ---

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(
  redis: Redis,
  user: AuthUser,
): Promise<string> {
  const token = generateToken();
  const session: SessionUser = { username: user.username, role: user.role };
  await redis.set(SESSION_PREFIX + token, session);
  return token;
}

export async function getSession(
  redis: Redis,
  token: string,
): Promise<SessionUser | null> {
  return redis.get<SessionUser>(SESSION_PREFIX + token);
}

export async function deleteSession(
  redis: Redis,
  token: string,
): Promise<void> {
  await redis.del(SESSION_PREFIX + token);
}

export function setSessionCookie(token: string): void {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export function clearSessionCookie(): void {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function getSessionToken(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

// --- Route helpers ---

export async function requireAuth(
  req: NextRequest,
): Promise<{ user: SessionUser; redis: Redis } | Response> {
  const redis = getRedis();
  if (!redis) {
    return new Response(JSON.stringify({ error: "Storage not configured" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
  const token = getSessionToken(req);
  if (!token) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const session = await getSession(redis, token);
  if (!session) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return { user: session, redis };
}

export async function requireAdmin(
  req: NextRequest,
): Promise<{ user: SessionUser; redis: Redis } | Response> {
  const result = await requireAuth(req);
  if (result instanceof Response) return result;
  if (result.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Admin required" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  return result;
}
