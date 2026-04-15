import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const result = await requireAuth(req);
  if (result instanceof Response) return result;
  return NextResponse.json(result.user);
}
