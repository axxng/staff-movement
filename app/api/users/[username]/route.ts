import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getUser, updateUser, deleteUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteParams = { params: { username: string } };

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const result = await requireAdmin(req);
  if (result instanceof Response) return result;

  const target = params.username.toLowerCase();
  const existing = await getUser(result.redis, target);
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: { password?: string; role?: "admin" | "user" };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.password && body.password.length < 4) {
    return NextResponse.json(
      { error: "Password must be at least 4 characters" },
      { status: 400 },
    );
  }

  const updated = await updateUser(result.redis, target, {
    password: body.password,
    role: body.role,
  });

  return NextResponse.json({
    username: updated!.username,
    role: updated!.role,
    createdAt: updated!.createdAt,
  });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const result = await requireAdmin(req);
  if (result instanceof Response) return result;

  const target = params.username.toLowerCase();

  if (target === result.user.username) {
    return NextResponse.json(
      { error: "Cannot delete yourself" },
      { status: 400 },
    );
  }

  const removed = await deleteUser(result.redis, target);
  if (!removed) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
