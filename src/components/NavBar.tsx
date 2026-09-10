"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import EkoLogo from "./EkoLogo";

type Session = { name: string; role: "admin" | "user" } | null;

export default function NavBar() {
  const [session, setSession] = useState<Session>(null);
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        setSession(data.session);
        setLoaded(true);
      });
  }, [pathname]);

  if (!loaded || pathname === "/login") return null;
  if (!session) return null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  const userLinks = [
    { href: "/catalog", label: "מה צריך למשרד?" },
    { href: "/my-requests", label: "ההזמנות וההצעות שלי" },
  ];
  const adminLinks = [
    { href: "/admin/order", label: "בונה הזמנה" },
    { href: "/admin/orders", label: "הזמנות קודמות" },
    { href: "/admin/suggestions", label: "מוצרים להוספה" },
    { href: "/admin/products", label: "ניהול מוצרים" },
  ];

  const links = session.role === "admin" ? [...userLinks, ...adminLinks] : userLinks;

  return (
    <header className="border-b border-neutral-200 bg-white sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href={session.role === "admin" ? "/admin/order" : "/catalog"} className="flex items-center gap-2">
            <EkoLogo size="sm" />
            <span className="font-semibold text-neutral-800 hidden sm:inline">קניות למשרד</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  pathname === l.href || pathname.startsWith(`${l.href}/`)
                    ? "bg-violet-50 text-violet-700"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500 truncate max-w-[200px]" dir="ltr">
            {session.name}
            {session.role === "admin" && (
              <span className="me-2 inline-block rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-xs font-semibold" dir="rtl">
                מנהל
              </span>
            )}
          </span>
          <button
            onClick={logout}
            className="text-sm px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
          >
            התנתקות
          </button>
        </div>
      </div>
      <nav className="md:hidden flex overflow-x-auto gap-1 px-4 pb-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              pathname === l.href ? "bg-violet-50 text-violet-700" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
