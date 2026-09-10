import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_INTENT_COOKIE = "office_shopping_admin_intent";
const TTL_MS = 5 * 60 * 1000;

function secret(): string {
  return process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || "dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createAdminIntentToken(): string {
  const payload = String(Date.now() + TTL_MS);
  const sig = sign(payload);
  return Buffer.from(`${payload}.${sig}`, "utf-8").toString("base64url");
}

export function verifyAdminIntentToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [payload, sig] = decoded.split(".");
    if (!payload || !sig) return false;
    const expected = sign(payload);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    return Number(payload) > Date.now();
  } catch {
    return false;
  }
}
