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

export const SESSION_COOKIE = COOKIE_NAME;
