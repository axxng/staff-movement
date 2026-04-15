import { NextRequest, NextResponse } from "next/server";
import {
  getRedis,
  userCount,
  createUser,
  createSession,
  setSessionCookie,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const redis = getRedis();
  if (!redis)
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const count = await userCount(redis);
  if (count > 0) {
    return NextResponse.json(
      { error: "Setup already completed" },
      { status: 403 },
    );
  }

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

  if (body.password.length < 4) {
    return NextResponse.json(
      { error: "Password must be at least 4 characters" },
      { status: 400 },
    );
  }

  const user = await createUser(
    redis,
    body.username.trim().toLowerCase(),
    body.password,
    "admin",
  );

  const token = await createSession(redis, user);
  setSessionCookie(token);

  return NextResponse.json({
    username: user.username,
    role: user.role,
  });
}
