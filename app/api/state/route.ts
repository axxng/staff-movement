import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import type { AppState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEY = "staff-movement:state";
const TS_KEY = "staff-movement:updatedAt";

const getRedis = (): Redis | null => {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

const requirePassword = (): string | null => {
  return process.env.APP_PASSWORD ?? null;
};

const checkAuth = (req: NextRequest): boolean => {
  const required = requirePassword();
  if (!required) return true;
  const provided = req.headers.get("x-app-password");
  return provided === required;
};

const unauthorized = () =>
  NextResponse.json({ error: "unauthorized" }, { status: 401 });

const notConfigured = () =>
  NextResponse.json(
    {
      error:
        "Upstash Redis env vars not set. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    },
    { status: 503 },
  );

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();
  const redis = getRedis();
  if (!redis) return notConfigured();

  try {
    const [state, updatedAt] = await Promise.all([
      redis.get<AppState>(KEY),
      redis.get<number>(TS_KEY),
    ]);
    return NextResponse.json({
      state: state ?? null,
      updatedAt: updatedAt ?? null,
      authRequired: requirePassword() != null,
    });
  } catch (err) {
    console.error("GET /api/state failed", err);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();
  const redis = getRedis();
  if (!redis) return notConfigured();

  let body: { state: AppState; baseUpdatedAt: number | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.state || typeof body.state !== "object") {
    return NextResponse.json({ error: "invalid state" }, { status: 400 });
  }

  try {
    const cur = await redis.get<number>(TS_KEY);
    if (cur != null && body.baseUpdatedAt != null && cur > body.baseUpdatedAt) {
      // Someone else updated since we last loaded — return current and let
      // the client merge / accept.
      const state = await redis.get<AppState>(KEY);
      return NextResponse.json(
        { conflict: true, state: state ?? null, updatedAt: cur },
        { status: 409 },
      );
    }
    const ts = Date.now();
    await Promise.all([redis.set(KEY, body.state), redis.set(TS_KEY, ts)]);
    return NextResponse.json({ ok: true, updatedAt: ts });
  } catch (err) {
    console.error("PUT /api/state failed", err);
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
