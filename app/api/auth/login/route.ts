import { NextRequest, NextResponse } from "next/server";
import {
  getRedis,
  verifyCredentials,
  createSession,
  setSessionCookie,
} from "@/lib/auth";
import { checkLoginRateLimit, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const redis = getRedis();
  if (!redis)
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  let body: { username: string; password: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.username || !body.password) {
    return NextResponse.json(
      { error: "Username and password required" },
      { status: 400 },
    );
  }

  const username = body.username.trim().toLowerCase();

  const rl = await checkLoginRateLimit(redis, getClientIp(req), username);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const user = await verifyCredentials(redis, username, body.password);
  if (!user) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    );
  }

  const token = await createSession(redis, user);
  setSessionCookie(token);

  return NextResponse.json({
    username: user.username,
    role: user.role,
  });
}
