import { NextResponse } from "next/server";
import { getRedis, userCount } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const redis = getRedis();
  const hasStorage = !!redis;

  let hasUsers = false;
  if (redis) {
    try {
      hasUsers = (await userCount(redis)) > 0;
    } catch {
      // Redis not reachable — treat as no users
    }
  }

  return NextResponse.json({ hasStorage, hasUsers });
}
