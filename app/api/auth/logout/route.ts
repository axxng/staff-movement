import { NextRequest, NextResponse } from "next/server";
import {
  getRedis,
  getSessionToken,
  deleteSession,
  clearSessionCookie,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const redis = getRedis();
  const token = getSessionToken(req);

  if (redis && token) {
    await deleteSession(redis, token);
  }

  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
