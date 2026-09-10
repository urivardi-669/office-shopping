# eko Fresh (Chrome extension)

Lets employees search Tiv Taam directly from their own browser and send a
request straight to the office-shopping app — bypassing the fact that Tiv
Taam's bot-protection blocks requests from Vercel's servers (this runs on the
employee's own network instead, exactly like visiting tivtaam.co.il normally).

## Why this exists

The deployed app's server-side Tiv Taam search is blocked in production by
Tiv Taam's WAF (403 on all requests from Vercel's IPs). This extension moves
the "search Tiv Taam" step into the browser itself — a normal browser
request, from a normal residential/office IP, which Tiv Taam doesn't block —
and submits the result to the existing app APIs
(`/api/requests`, `/api/suggestions`) exactly as the website already does.
No new backend logic was introduced beyond letting those endpoints accept an
`Authorization: Bearer <token>` header as an alternative to the site's cookie
(see `src/lib/session.ts` → `getSessionFromRequest`).

## Install (unpacked, for now)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this `extension/` folder.
4. Pin the "eko Fresh" icon to the toolbar for easy access.

## Use

1. Click the icon, enter your `@eko.com` email (same trust model as the
   website's login for now — no separate password).
2. Search a product by name.
3. Pick a result, choose quantity, and press **בקש הזמנה**.
   - If it's already in the office catalog, this creates a normal request.
   - If it's new, this creates a product suggestion for the admin to
     approve (same "מוצרים להוספה" flow as the website), with your
     requested quantity attached.
4. Check **ההיסטוריה שלי** to see your past requests/suggestions.

## If the app moves to a different domain

Update `APP_URL` in `lib/api.js` and the matching entry in
`manifest.json`'s `host_permissions`.

## Publishing beyond "Load unpacked"

For real distribution to the team, either:

- Upload to the Chrome Web Store as a **private/unlisted** listing
  restricted to your Google Workspace domain, or
- Use Chrome Enterprise policy (`ExtensionInstallForcelist` /
  `ExtensionInstallAllowlist`) to push it to managed eko.com devices, or
- Zip this folder and share it for manual "Load unpacked" install (fine for
  a small pilot group, as done above).
