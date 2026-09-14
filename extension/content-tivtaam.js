// eko Fresh — Tiv Taam import assistant (content script).
//
// Semi-auto MVP: this script NEVER adds anything to the cart itself. It only
// reads the admin's finalized order (handed off by the extension popup via
// chrome.storage.local) and fills Tiv Taam's own search box for each line
// item in turn, then tries to highlight the matching "הוספה לסל" result so
// the admin can visually confirm it's the right product before clicking it
// and setting the quantity themselves, on their own logged-in session.
//
// Why no automated clicking: Tiv Taam's cart/checkout has no documented API,
// its DOM can change at any time, and clicking "add to cart" is a real
// purchase-adjacent action on someone's real account — that stays a human
// action by design, not just for now.

const QUEUE_KEY = "ekoFreshTivTaamQueue";
const HIGHLIGHT_CLASS = "ekofresh-match-highlight";
const SEARCH_INPUT_SELECTOR = 'input.search-input[type="search"], input[type="search"]';

let panelEl = null;
let matchWatchTimer = null;

function normalizeName(str) {
  return (str || "").replace(/\s+/g, " ").trim().toLowerCase();
}

async function getQueue() {
  const stored = await chrome.storage.local.get([QUEUE_KEY]);
  return stored[QUEUE_KEY] || null;
}

async function setQueue(queue) {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

async function clearQueue() {
  await chrome.storage.local.remove(QUEUE_KEY);
}

function currentItem(queue) {
  if (!queue) return null;
  return queue.items[queue.currentIndex] || null;
}

// ---------- Search box automation (fill only — never clicks "add") ----------

function fillSearchBox(query) {
  const input = document.querySelector(SEARCH_INPUT_SELECTOR);
  if (!input) return false;
  input.focus();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, query);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("keyup", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function clearHighlights() {
  document.querySelectorAll("." + HIGHLIGHT_CLASS).forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
}

function highlightMatches(productName) {
  clearHighlights();
  const target = normalizeName(productName);
  if (!target) return;
  const buttons = document.querySelectorAll('button.add-to-cart[aria-label^="הוספה לסל"]');
  buttons.forEach((btn) => {
    const label = normalizeName((btn.getAttribute("aria-label") || "").replace(/^הוספה לסל/, ""));
    if (label && (label.includes(target) || target.includes(label))) {
      btn.classList.add(HIGHLIGHT_CLASS);
    }
  });
}

function watchForMatches(productName) {
  if (matchWatchTimer) clearInterval(matchWatchTimer);
  const deadline = Date.now() + 4000;
  matchWatchTimer = setInterval(() => {
    highlightMatches(productName);
    if (Date.now() > deadline) clearInterval(matchWatchTimer);
  }, 200);
}

// ---------- Floating panel ----------

function ensurePanel() {
  if (panelEl) return panelEl;
  panelEl = document.createElement("div");
  panelEl.id = "ekofresh-import-panel";
  panelEl.innerHTML = `
    <div class="ekofresh-header">
      <span class="ekofresh-pill">eko</span>
      <span class="ekofresh-title">ייבוא הזמנה לטיב טעם</span>
      <button type="button" class="ekofresh-close" title="סגור">✕</button>
    </div>
    <div class="ekofresh-progress"></div>
    <div class="ekofresh-item"></div>
    <div class="ekofresh-instruction">
      👉 קודם לחצו על "הוסיפו" המסומן בירוק בעמוד, וקבעו כמות — <b>רק אז</b> לחצו כאן:
    </div>
    <div class="ekofresh-actions">
      <button type="button" class="ekofresh-btn ekofresh-btn-primary" data-action="search">חפש שוב</button>
      <button type="button" class="ekofresh-btn ekofresh-btn-success" data-action="next">כבר הוספתי בטיב טעם ← הבא</button>
      <button type="button" class="ekofresh-btn ekofresh-btn-ghost" data-action="skip">דלג בלי להוסיף</button>
    </div>
    <div class="ekofresh-finish-actions" hidden>
      <button type="button" class="ekofresh-btn ekofresh-btn-success ekofresh-btn-block" data-action="finish">
        סגור חלון וגש לעגלה לסיום ההזמנה
      </button>
    </div>
  `;
  document.body.appendChild(panelEl);
  panelEl.querySelector(".ekofresh-close").addEventListener("click", async () => {
    if (!confirm("לסגור את הייבוא? ניתן להמשיך מאוחר יותר מתוך התוסף.")) return;
    removePanel();
  });
  panelEl.querySelector('[data-action="search"]').addEventListener("click", async () => {
    const queue = await getQueue();
    const item = currentItem(queue);
    if (item) runSearchFor(item);
  });
  panelEl.querySelector('[data-action="next"]').addEventListener("click", () => advance(true));
  panelEl.querySelector('[data-action="skip"]').addEventListener("click", () => advance(false));
  panelEl.querySelector('[data-action="finish"]').addEventListener("click", async () => {
    await clearQueue();
    removePanel();
  });
  return panelEl;
}

function removePanel() {
  if (panelEl) {
    panelEl.remove();
    panelEl = null;
  }
  clearHighlights();
  if (matchWatchTimer) clearInterval(matchWatchTimer);
}

function runSearchFor(item) {
  const filled = fillSearchBox(item.name);
  if (filled) watchForMatches(item.name);
}

async function advance(markDone) {
  const queue = await getQueue();
  if (!queue) return;
  const item = currentItem(queue);
  if (item) item.done = item.done || markDone;
  queue.currentIndex += 1;
  await setQueue(queue);
  await render();
}

async function render() {
  const queue = await getQueue();
  if (!queue) {
    removePanel();
    return;
  }
  const panel = ensurePanel();
  const item = currentItem(queue);
  const doneCount = queue.items.filter((it) => it.done).length;
  panel.querySelector(".ekofresh-progress").textContent = `הזמנה #${queue.orderId} · הושלמו ${doneCount} מתוך ${queue.items.length}`;

  if (!item) {
    panel.querySelector(".ekofresh-item").innerHTML = `<div class="ekofresh-done">🎉 הייבוא הושלם! אפשר לעבור לתשלום בטיב טעם.</div>`;
    panel.querySelector(".ekofresh-actions").hidden = true;
    panel.querySelector(".ekofresh-finish-actions").hidden = false;
    clearHighlights();
    return;
  }

  panel.querySelector(".ekofresh-actions").hidden = false;
  panel.querySelector(".ekofresh-finish-actions").hidden = true;
  panel.querySelector(".ekofresh-item").innerHTML = `
    <div class="ekofresh-item-name">${escapeHtml(item.name)}</div>
    <div class="ekofresh-item-qty">כמות להוספה: <b>${item.quantity}${item.unitLabel ? " " + escapeHtml(item.unitLabel) : ""}</b></div>
  `;
  runSearchFor(item);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ---------- Init ----------

(async function init() {
  await render();
})();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[QUEUE_KEY]) {
    render();
  }
});
