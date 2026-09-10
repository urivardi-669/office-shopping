"use client";

import { signIn } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import EkoLogo from "@/components/EkoLogo";

const ERROR_MESSAGES: Record<string, string> = {
  domain: "ההתחברות מוגבלת לכתובות Google של eko.com בלבד.",
  AccessDenied: "ההתחברות מוגבלת לכתובות Google של eko.com בלבד.",
};

function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.11A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.26a12 12 0 0 0 0 10.8l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.2 15.23 0 12 0 7.31 0 3.26 2.69 1.26 6.6l4.01 3.11C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const [adminMode, setAdminMode] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(errorParam ? ERROR_MESSAGES[errorParam] || "שגיאה בהתחברות" : "");
  const [loading, setLoading] = useState(false);

  // --- "workaround" state: see src/app/api/auth/workaround-login/route.ts ---
  // Remove this whole block (and the AccountPicker below) once real Google
  // OAuth credentials are configured; loginAsUser/loginAsAdmin already fall
  // back to the real signIn("google", ...) flow when the workaround is off.
  const [workaroundOn, setWorkaroundOn] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  useEffect(() => {
    fetch("/api/auth/workaround-login")
      .then((r) => r.json())
      .then((d) => setWorkaroundOn(Boolean(d.enabled)))
      .catch(() => setWorkaroundOn(false));
  }, []);
  // --- end "workaround" state ---

  async function loginAsUser() {
    setError("");
    if (workaroundOn) {
      setShowAccountPicker(true);
      return;
    }
    setLoading(true);
    await signIn("google", { callbackUrl: "/api/auth/post-login" });
  }

  async function loginAsAdmin() {
    setError("");
    if (!password) {
      setError("יש להזין סיסמת מנהל");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/admin-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "סיסמה שגויה");
      setLoading(false);
      return;
    }
    setLoading(false);
    if (workaroundOn) {
      setShowAccountPicker(true);
      return;
    }
    setLoading(true);
    await signIn("google", { callbackUrl: "/api/auth/post-login" });
  }

  // "workaround": completes sign-in locally instead of via real Google OAuth.
  async function completeWorkaroundLogin(email: string) {
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/workaround-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "שגיאה בהתחברות");
      return;
    }
    router.push(data.role === "admin" ? "/admin/order" : "/catalog");
    router.refresh();
  }

  if (showAccountPicker) {
    return (
      <AccountPicker
        onBack={() => setShowAccountPicker(false)}
        onContinue={completeWorkaroundLogin}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-0px)] relative">
      <button
        onClick={() => {
          setAdminMode((v) => !v);
          setError("");
        }}
        className="fixed top-4 left-4 z-10 text-xs font-medium px-3 py-1.5 rounded-full border border-neutral-300 text-neutral-600 bg-white hover:bg-neutral-100 transition"
      >
        {adminMode ? "כניסת עובד" : "Admin Login"}
      </button>

      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 space-y-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <EkoLogo size="lg" />
            <div>
              <h1 className="text-xl font-bold text-neutral-900">קניות למשרד</h1>
              <p className="text-sm text-neutral-500 mt-1">
                {adminMode ? "כניסת מנהל" : "התחברות עם חשבון Google של eko.com"}
              </p>
            </div>
          </div>

          {adminMode && (
            <div className="space-y-1.5 text-start">
              <label className="text-sm font-medium text-neutral-700">סיסמת מנהל</label>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loginAsAdmin()}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          )}

          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-start">{error}</div>}

          <button
            onClick={adminMode ? loginAsAdmin : loginAsUser}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-neutral-950 text-white font-medium py-2.5 hover:bg-neutral-800 transition disabled:opacity-60"
          >
            <GoogleIcon />
            {loading ? "מתחבר..." : "Login"}
          </button>

          <p className="text-xs text-neutral-400">
            רק כתובות דוא&quot;ל של <span className="font-medium">eko.com</span> יכולות להתחבר
          </p>
        </div>
      </div>
    </div>
  );
}

// "workaround": mimics the Google account-chooser screen so the login flow looks
// like real Google sign-in, but just takes whatever @eko.com email is typed in.
// Delete this component together with workaround-login/route.ts once real
// Google OAuth credentials are wired up.
function AccountPicker({
  onBack,
  onContinue,
  loading,
  error,
}: {
  onBack: () => void;
  onContinue: (email: string) => void;
  loading: boolean;
  error: string;
}) {
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden">
        <div className="p-8 pb-6 flex flex-col items-center gap-3 text-center">
          <GoogleIcon className="w-9 h-9" />
          <h1 className="text-xl text-neutral-800">כניסה</h1>
          <p className="text-sm text-neutral-500">
            לפני שתמשיכו אל <span className="font-medium">קניות למשרד</span>
          </p>
        </div>

        <div className="px-8 pb-8 space-y-4">
          <div className="space-y-1.5 text-start">
            <label className="text-sm font-medium text-neutral-700">כתובת דוא&quot;ל של eko.com</label>
            <input
              autoFocus
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onContinue(email)}
              placeholder="name@eko.com"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-start focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-start">{error}</div>}

          <div className="flex items-center justify-between pt-2">
            <button onClick={onBack} className="text-sm font-medium text-neutral-500 hover:text-neutral-700">
              חזרה
            </button>
            <button
              onClick={() => onContinue(email)}
              disabled={loading}
              className="rounded-lg bg-blue-600 text-white px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "מתחבר..." : "המשך"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
