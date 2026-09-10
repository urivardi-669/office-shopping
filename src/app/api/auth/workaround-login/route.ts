import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encodeSession, SESSION_COOKIE } from "@/lib/session";
import { ADMIN_INTENT_COOKIE, verifyAdminIntentToken } from "@/lib/adminIntent";

// ============================================================================
// "workaround" — TEMPORARY stand-in for real Google OAuth.
//
// Real Google credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) haven't been
// provisioned yet. Until they are, the login screen mimics the Google account
// picker but this route just trusts whatever @eko.com email is typed in and
// signs that person in directly — no real Google verification happens.
//
// The real Auth.js/Google wiring (src/auth.ts, /api/auth/[...nextauth],
// /api/auth/post-login) is untouched and ready to take over as soon as
// GOOGLE_CLIENT_ID/SECRET are set — this route can be deleted at that point,
// along with the "workaround" branch in src/app/login/page.tsx.
//
// Gate: disabled automatically once real Google credentials are present, and
// can also be force-disabled via WORKAROUND_LOGIN=false.
// ============================================================================

const ALLOWED_DOMAIN = "eko.com";

function workaroundEnabled(): boolean {
  if (process.env.WORKAROUND_LOGIN === "false") return false;
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) return false;
  return true;
}

export async function POST(req: NextRequest) {
  if (!workaroundEnabled()) {
    return NextResponse.json({ error: "ה-workaround מנוטרל. יש להתחבר עם Google." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();

  if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return NextResponse.json({ error: `יש להזין כתובת דוא"ל בדומיין ${ALLOWED_DOMAIN}` }, { status: 400 });
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

  const token = encodeSession({ name: email, role });
  // `token` lets non-cookie clients (the "eko Fresh" browser extension) carry
  // this same session as an `Authorization: Bearer` header instead.
  const res = NextResponse.json({ ok: true, role, token });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.set(ADMIN_INTENT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET() {
  return NextResponse.json({ enabled: workaroundEnabled() });
}
