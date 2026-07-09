import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

const PREFIX = "staff-movement:rl";

// Separate in-memory caches so an identifier that's already over its limit is
// rejected without a Redis round-trip. This keeps Redis (and bcrypt) cost flat
// under a sustained attack — repeat offenders never reach storage.
const ipCache = new Map<string, number>();
const userCache = new Map<string, number>();

let ipLimiter: Ratelimit | null = null;
let userLimiter: Ratelimit | null = null;

function getLimiters(redis: Redis): {
  ipLimiter: Ratelimit;
  userLimiter: Ratelimit;
} {
  if (!ipLimiter) {
    ipLimiter = new Ratelimit({
      redis,
      // Primary gate: stops a single source spraying many accounts.
      limiter: Ratelimit.slidingWindow(10, "10 m"),
      prefix: `${PREFIX}:ip`,
      analytics: false,
      ephemeralCache: ipCache,
    });
  }
  if (!userLimiter) {
    userLimiter = new Ratelimit({
      redis,
      // Backstop against distributed brute force against one account. Kept
      // lenient enough that a legitimate user retrying won't trip it.
      limiter: Ratelimit.slidingWindow(10, "15 m"),
      prefix: `${PREFIX}:user`,
      analytics: false,
      ephemeralCache: userCache,
    });
  }
  return { ipLimiter, userLimiter };
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.ip ?? "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

function retryAfter(reset: number): number {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

// Per-IP only — used by the setup route, where no account exists yet.
export async function checkIpRateLimit(
  redis: Redis,
  ip: string,
): Promise<RateLimitResult> {
  const { ipLimiter } = getLimiters(redis);
  const res = await ipLimiter.limit(ip);
  return { ok: res.success, retryAfterSeconds: retryAfter(res.reset) };
}

// Per-IP first (primary gate), then per-username backstop.
export async function checkLoginRateLimit(
  redis: Redis,
  ip: string,
  username: string,
): Promise<RateLimitResult> {
  const { ipLimiter, userLimiter } = getLimiters(redis);

  const ipRes = await ipLimiter.limit(ip);
  if (!ipRes.success) {
    return { ok: false, retryAfterSeconds: retryAfter(ipRes.reset) };
  }

  const userRes = await userLimiter.limit(username);
  if (!userRes.success) {
    return { ok: false, retryAfterSeconds: retryAfter(userRes.reset) };
  }

  return { ok: true, retryAfterSeconds: 0 };
}
