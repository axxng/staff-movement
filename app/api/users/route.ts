import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getUser, createUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const result = await requireAdmin(req);
  if (result instanceof Response) return result;

  const all = await result.redis.hgetall<
    Record<string, { username: string; role: string; createdAt: number }>
  >("staff-movement:users");

  const users = Object.values(all ?? {}).map((u) => ({
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
  }));

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const result = await requireAdmin(req);
  if (result instanceof Response) return result;

  let body: { username: string; password: string; role: "admin" | "user" };
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

  const role = body.role === "admin" ? "admin" : "user";
  const username = body.username.trim().toLowerCase();

  const existing = await getUser(result.redis, username);
  if (existing) {
    return NextResponse.json(
      { error: "Username already exists" },
      { status: 409 },
    );
  }

  const user = await createUser(result.redis, username, body.password, role);
  return NextResponse.json({
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
  });
}
