import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { encodeSession, SESSION_COOKIE } from "@/lib/session";
import { ADMIN_INTENT_COOKIE, verifyAdminIntentToken } from "@/lib/adminIntent";

const ALLOWED_DOMAIN = "eko.com";

export async function GET(req: NextRequest) {
  const nextAuthSession = await auth();
  const email = nextAuthSession?.user?.email?.toLowerCase() || "";

  if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return NextResponse.redirect(new URL("/login?error=domain", req.url));
  }

  const intentToken = req.cookies.get(ADMIN_INTENT_COOKIE)?.value;
  const isAdmin = verifyAdminIntentToken(intentToken);
  const role: "admin" | "user" = isAdmin ? "admin" : "user";

  const existing = (await db.prepare(`SELECT id, role FROM users WHERE name = ?`).get(email)) as
    | { id: number; role: string }
    | undefined;
  if (existing) {
    if (existing.role !== role) {
      await db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, existing.id);
    }
  } else {
    await db.prepare(`INSERT INTO users (name, role) VALUES (?, ?)`).run(email, role);
  }

  const res = NextResponse.redirect(new URL(role === "admin" ? "/admin/order" : "/catalog", req.url));
  res.cookies.set(SESSION_COOKIE, encodeSession({ name: email, role }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.set(ADMIN_INTENT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
