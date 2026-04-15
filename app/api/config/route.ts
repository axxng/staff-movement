import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const hasStorage =
    !!(process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL) &&
    !!(process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN);
  const authRequired = !!process.env.APP_PASSWORD;
  return NextResponse.json({ hasStorage, authRequired });
}
