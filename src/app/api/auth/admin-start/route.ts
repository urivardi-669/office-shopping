import { NextRequest, NextResponse } from "next/server";
import { ADMIN_INTENT_COOKIE, createAdminIntentToken } from "@/lib/adminIntent";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = String(body.password || "");

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "סיסמת מנהל שגויה" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_INTENT_COOKIE, createAdminIntentToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 5,
  });
  return res;
}
