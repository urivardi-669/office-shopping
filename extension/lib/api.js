// Talks to the office-shopping web app's existing API — nothing new was built
// server-side for this extension beyond letting requests carry an
// `Authorization: Bearer <token>` header as an alternative to the browser
// cookie the website itself uses (see src/lib/session.ts).
//
// If the app is ever redeployed to a different domain, update APP_URL here
// AND the matching host_permissions entry in manifest.json.
const APP_URL = "https://office-shopping-nine.vercel.app";

const ekoFreshAuth = {
  async get() {
    const stored = await chrome.storage.local.get(["ekoFreshEmail", "ekoFreshToken", "ekoFreshRole"]);
    if (!stored.ekoFreshToken) return null;
    return { email: stored.ekoFreshEmail, token: stored.ekoFreshToken, role: stored.ekoFreshRole };
  },
  async set(email, token, role) {
    await chrome.storage.local.set({ ekoFreshEmail: email, ekoFreshToken: token, ekoFreshRole: role });
  },
  async clear() {
    await chrome.storage.local.remove(["ekoFreshEmail", "ekoFreshToken", "ekoFreshRole"]);
  },
};

async function apiFetch(path, options) {
  const auth = await ekoFreshAuth.get();
  const headers = Object.assign({ "Content-Type": "application/json" }, (options && options.headers) || {});
  if (auth) headers["Authorization"] = `Bearer ${auth.token}`;
  const res = await fetch(`${APP_URL}${path}`, Object.assign({}, options, { headers }));
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

async function ekoFreshLogin(email) {
  const res = await apiFetch("/api/auth/workaround-login", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error((res.body && res.body.error) || "שגיאה בהתחברות");
  await ekoFreshAuth.set(email, res.body.token, res.body.role);
  return res.body;
}

async function ekoFreshGetCategories() {
  const res = await apiFetch("/api/categories", { method: "GET" });
  if (!res.ok) throw new Error("שגיאה בטעינת קטגוריות");
  return res.body.categories;
}

async function ekoFreshGetActiveProducts() {
  const res = await apiFetch("/api/products", { method: "GET" });
  if (!res.ok) throw new Error("שגיאה בטעינת קטלוג");
  return res.body.products;
}

async function ekoFreshSubmitRequest(productId, quantity, unitCode) {
  const res = await apiFetch("/api/requests", {
    method: "POST",
    body: JSON.stringify({ items: [{ productId, quantity, unitCode }] }),
  });
  if (!res.ok) throw new Error((res.body && res.body.error) || "שגיאה בשליחת הבקשה");
  return res.body;
}

async function ekoFreshSubmitSuggestion(payload) {
  const res = await apiFetch("/api/suggestions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res; // caller inspects .ok / .status (409 = duplicate) / .body
}

async function ekoFreshGetMyRequests() {
  const res = await apiFetch("/api/requests/mine", { method: "GET" });
  if (!res.ok) throw new Error("שגיאה בטעינת היסטוריה");
  return res.body.items;
}

async function ekoFreshGetMySuggestions() {
  const res = await apiFetch("/api/suggestions?scope=mine", { method: "GET" });
  if (!res.ok) throw new Error("שגיאה בטעינת היסטוריה");
  return res.body.suggestions;
}
