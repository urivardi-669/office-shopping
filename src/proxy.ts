import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "office_shopping_session";

function base64UrlToBase64(input: string): string {
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return s;
}

function decodeSession(raw: string): { name: string; role: "admin" | "user" } | null {
  try {
    const binary = atob(base64UrlToBase64(raw));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder("utf-8").decode(bytes);
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed.name === "string" && (parsed.role === "admin" || parsed.role === "user")) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  const session = raw ? decodeSession(raw) : null;

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL(session.role === "admin" ? "/admin/order" : "/catalog", req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/catalog", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/catalog", "/my-requests", "/admin/:path*"],
};
