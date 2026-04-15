import { NextRequest, NextResponse } from "next/server";
import { getRedis, requireAuth } from "@/lib/auth";
import type { AppState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEY = "staff-movement:state";
const TS_KEY = "staff-movement:updatedAt";

export async function GET() {
  const redis = getRedis();
  if (!redis)
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  try {
    const [state, updatedAt] = await Promise.all([
      redis.get<AppState>(KEY),
      redis.get<number>(TS_KEY),
    ]);
    return NextResponse.json({
      state: state ?? null,
      updatedAt: updatedAt ?? null,
    });
  } catch (err) {
    console.error("GET /api/state failed", err);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireAuth(req);
  if (result instanceof Response) return result;
  const { redis } = result;

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
