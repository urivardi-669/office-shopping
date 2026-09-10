import { cookies } from "next/headers";

export type Session = { name: string; role: "admin" | "user" };

const COOKIE_NAME = "office_shopping_session";

export function encodeSession(session: Session): string {
  return Buffer.from(JSON.stringify(session), "utf-8").toString("base64url");
}

export function decodeSession(raw: string): Session | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
    if (parsed && typeof parsed.name === "string" && (parsed.role === "admin" || parsed.role === "user")) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return decodeSession(raw);
}

/**
 * Same as getSession(), but also accepts an `Authorization: Bearer <token>`
 * header carrying the same encoded session — used by the "eko Fresh" Chrome
 * extension, which can't rely on this app's cookie (cross-context cookie
 * behavior for extensions is unreliable) and instead stores the token itself.
 */
export async function getSessionFromRequest(req: Request): Promise<Session | null> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const session = decodeSession(auth.slice(7));
    if (session) return session;
  }
  return getSession();
}

export const SESSION_COOKIE = COOKIE_NAME;
