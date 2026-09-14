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

## Admin: importing a finished order into Tiv Taam

Admins (role `admin`) see an extra **"ייבוא לטיב טעם"** tab in the popup:

1. Pick one of the completed orders (`בונה הזמנה` → סיים הזמנה) from the dropdown.
2. Click **התחל ייבוא בטיב טעם**. This saves the order's line items to the
   extension's local storage and opens/focuses a tivtaam.co.il tab.
3. On that tab, a small floating panel appears and walks through the order
   one product at a time: it fills Tiv Taam's own search box with the
   product name and (once results render) outlines the matching "הוספה לסל"
   result in green.
4. **The admin still does the actual add-to-cart click and sets the
   quantity themselves**, on their own logged-in Tiv Taam session — the
   extension never clicks "add to cart" or touches checkout/payment. Once
   added, click **✓ הפריט נוסף — הבא** in the panel to move to the next item
   (or **דלג** to skip one without marking it done).
5. Progress is saved (survives closing the tab/popup) until you finish or
   press **בטל ייבוא** in the popup.

This is intentionally a "semi-auto" assistant, not full automation: Tiv Taam
has no documented cart/checkout API, so anything beyond "fill the search box
and point at the likely match" would mean scripting clicks against their
live DOM on a real account — fragile, and a real purchase-adjacent action
that should stay a deliberate human click.

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
