// eko Fresh — popup logic. Plain JS, no build step; relies on lib/tivtaam.js
// and lib/api.js (loaded before this file in popup.html).

const els = {
  whoami: document.getElementById("whoami"),
  logoutBtn: document.getElementById("logoutBtn"),
  loginView: document.getElementById("loginView"),
  mainView: document.getElementById("mainView"),
  detailView: document.getElementById("detailView"),
  successView: document.getElementById("successView"),
  loginEmail: document.getElementById("loginEmail"),
  loginBtn: document.getElementById("loginBtn"),
  loginError: document.getElementById("loginError"),
  tabSearch: document.getElementById("tabSearch"),
  tabHistory: document.getElementById("tabHistory"),
  tabTivTaamImport: document.getElementById("tabTivTaamImport"),
  searchPane: document.getElementById("searchPane"),
  historyPane: document.getElementById("historyPane"),
  tivTaamImportPane: document.getElementById("tivTaamImportPane"),
  importQueueBanner: document.getElementById("importQueueBanner"),
  importQueueText: document.getElementById("importQueueText"),
  importOpenTabBtn: document.getElementById("importOpenTabBtn"),
  importCancelBtn: document.getElementById("importCancelBtn"),
  importSetup: document.getElementById("importSetup"),
  importOrderSelect: document.getElementById("importOrderSelect"),
  importOrderStatus: document.getElementById("importOrderStatus"),
  importOrderItems: document.getElementById("importOrderItems"),
  importStartBtn: document.getElementById("importStartBtn"),
  searchInput: document.getElementById("searchInput"),
  searchStatus: document.getElementById("searchStatus"),
  results: document.getElementById("results"),
  historyStatus: document.getElementById("historyStatus"),
  historyList: document.getElementById("historyList"),
  backBtn: document.getElementById("backBtn"),
  detailImg: document.getElementById("detailImg"),
  detailName: document.getElementById("detailName"),
  detailBrand: document.getElementById("detailBrand"),
  detailMeta: document.getElementById("detailMeta"),
  existsBanner: document.getElementById("existsBanner"),
  categoryField: document.getElementById("categoryField"),
  categorySelect: document.getElementById("categorySelect"),
  unitLabel: document.getElementById("unitLabel"),
  qtyMinus: document.getElementById("qtyMinus"),
  qtyPlus: document.getElementById("qtyPlus"),
  qtyValue: document.getElementById("qtyValue"),
  duplicateWarning: document.getElementById("duplicateWarning"),
  submitBtn: document.getElementById("submitBtn"),
  submitError: document.getElementById("submitError"),
  successText: document.getElementById("successText"),
  successBackBtn: document.getElementById("successBackBtn"),
};

let state = {
  categories: [],
  products: [],
  selected: null, // normalized Tiv Taam product
  officeProductId: null,
  quantity: 1,
  force: false,
};

function showView(name) {
  ["loginView", "mainView", "detailView", "successView"].forEach((v) => {
    els[v].hidden = v !== name;
  });
}

function placeholderImg() {
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23a3a3a3" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="%23a3a3a3"/><path d="M21 15l-5-5-9 9"/></svg>'
  );
}

// ---------- Auth ----------

async function refreshAuthUi() {
  const auth = await ekoFreshAuth.get();
  if (!auth) {
    els.whoami.hidden = true;
    els.logoutBtn.hidden = true;
    showView("loginView");
    return false;
  }
  els.whoami.hidden = false;
  els.whoami.textContent = auth.email;
  els.logoutBtn.hidden = false;
  els.tabTivTaamImport.hidden = auth.role !== "admin";
  showView("mainView");
  return true;
}

els.loginBtn.addEventListener("click", async () => {
  const email = els.loginEmail.value.trim();
  els.loginError.hidden = true;
  if (!email) {
    els.loginError.textContent = "יש להזין כתובת דוא\"ל";
    els.loginError.hidden = false;
    return;
  }
  els.loginBtn.disabled = true;
  els.loginBtn.textContent = "מתחבר...";
  try {
    await ekoFreshLogin(email);
    await refreshAuthUi();
    await loadCatalogCache();
  } catch (err) {
    els.loginError.textContent = err.message;
    els.loginError.hidden = false;
  } finally {
    els.loginBtn.disabled = false;
    els.loginBtn.textContent = "התחברות";
  }
});

els.loginEmail.addEventListener("keydown", (e) => {
  if (e.key === "Enter") els.loginBtn.click();
});

els.logoutBtn.addEventListener("click", async () => {
  await ekoFreshAuth.clear();
  await refreshAuthUi();
});

// ---------- Catalog cache (categories + active products, for office-match check) ----------

async function loadCatalogCache() {
  try {
    const [categories, products] = await Promise.all([ekoFreshGetCategories(), ekoFreshGetActiveProducts()]);
    state.categories = categories;
    state.products = products;
    els.categorySelect.innerHTML = categories.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  } catch {
    // Non-fatal — category selection / office-match just won't be available yet.
  }
}

function findOfficeMatch(sourceProductId) {
  const match = state.products.find((p) => p.sourceProductId === sourceProductId);
  return match ? match.id : null;
}

// ---------- Tabs ----------

els.tabSearch.addEventListener("click", () => setTab("search"));
els.tabHistory.addEventListener("click", () => setTab("history"));
els.tabTivTaamImport.addEventListener("click", () => setTab("tivTaamImport"));

function setTab(tab) {
  els.tabSearch.classList.toggle("active", tab === "search");
  els.tabHistory.classList.toggle("active", tab === "history");
  els.tabTivTaamImport.classList.toggle("active", tab === "tivTaamImport");
  els.searchPane.hidden = tab !== "search";
  els.historyPane.hidden = tab !== "history";
  els.tivTaamImportPane.hidden = tab !== "tivTaamImport";
  if (tab === "history") loadHistory();
  if (tab === "tivTaamImport") loadTivTaamImportPane();
}

// ---------- Search ----------

let searchDebounce = null;
els.searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  const q = els.searchInput.value.trim();
  if (q.length < 2) {
    els.results.innerHTML = "";
    els.searchStatus.textContent = "";
    return;
  }
  els.searchStatus.textContent = "מחפש...";
  searchDebounce = setTimeout(() => runSearch(q), 350);
});

async function runSearch(query) {
  try {
    const results = await searchTivTaam(query, 12);
    els.searchStatus.textContent = results.length === 0 ? "לא נמצאו מוצרים" : "";
    renderResults(results);
  } catch (err) {
    els.searchStatus.textContent = "טיב טעם אינו זמין כרגע. נסו שוב מאוחר יותר.";
    els.results.innerHTML = "";
  }
}

function renderResults(results) {
  els.results.innerHTML = "";
  for (const p of results) {
    const officeId = findOfficeMatch(p.sourceProductId);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "result-card";
    card.innerHTML = `
      <img class="result-img" src="${p.imageUrl || placeholderImg()}" alt="" onerror="this.src='${placeholderImg()}'" />
      <div class="result-info">
        <div class="result-name">${escapeHtml(p.name)}</div>
        <div class="result-meta">${escapeHtml(p.brand || p.sourceSubcategory || "")}</div>
      </div>
      ${officeId ? '<span class="result-badge">בקטלוג</span>' : ""}
    `;
    card.addEventListener("click", () => openDetail(p, officeId));
    els.results.appendChild(card);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ---------- Detail / request ----------

function openDetail(product, officeId) {
  state.selected = product;
  state.officeProductId = officeId;
  state.quantity = 1;
  state.force = false;

  els.detailImg.src = product.imageUrl || placeholderImg();
  els.detailImg.onerror = () => (els.detailImg.src = placeholderImg());
  els.detailName.textContent = product.name;
  els.detailBrand.textContent = product.brand || "";
  const unit = product.units[0];
  const packageInfo = unit && unit.packageSize ? `${unit.packageSize} ${unit.packageSizeUnit || ""}` : "";
  els.detailMeta.textContent = [product.sku ? `מק"ט: ${product.sku}` : "", packageInfo].filter(Boolean).join(" · ");
  els.unitLabel.textContent = unit ? unit.unitLabel : "יח'";
  els.qtyValue.textContent = "1";
  els.existsBanner.hidden = !officeId;
  els.categoryField.hidden = Boolean(officeId);
  els.duplicateWarning.hidden = true;
  els.submitError.hidden = true;
  els.submitBtn.textContent = "בקש הזמנה";
  showView("detailView");
}

els.backBtn.addEventListener("click", () => showView("mainView"));
els.successBackBtn.addEventListener("click", () => {
  els.searchInput.value = "";
  els.results.innerHTML = "";
  els.searchStatus.textContent = "";
  setTab("search");
  showView("mainView");
});

els.qtyMinus.addEventListener("click", () => {
  state.quantity = Math.max(1, state.quantity - 1);
  els.qtyValue.textContent = String(state.quantity);
});
els.qtyPlus.addEventListener("click", () => {
  state.quantity += 1;
  els.qtyValue.textContent = String(state.quantity);
});

els.submitBtn.addEventListener("click", async () => {
  const product = state.selected;
  if (!product) return;
  els.submitError.hidden = true;
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "שולח...";

  try {
    if (state.officeProductId) {
      const unit = product.units[0];
      await ekoFreshSubmitRequest(state.officeProductId, state.quantity, unit ? unit.unitCode : undefined);
      showSuccess("הבקשה נשלחה בהצלחה!");
      return;
    }

    if (!state.categories.length) await loadCatalogCache();
    const categoryId = Number(els.categorySelect.value);
    const unit = product.units[0];

    const res = await ekoFreshSubmitSuggestion({
      name: product.name,
      categoryId,
      quantity: state.quantity,
      force: state.force,
      source: "TIV_TAAM",
      sourceProductId: product.sourceProductId,
      sku: product.sku,
      brand: product.brand,
      imageUrl: product.imageUrl,
      sourceUrl: product.sourceUrl,
      unitCode: unit ? unit.unitCode : null,
      unitLabel: unit ? unit.unitLabel : null,
    });

    if (res.status === 409) {
      state.force = true;
      els.duplicateWarning.hidden = false;
      els.duplicateWarning.textContent = (res.body && res.body.error) || "המוצר כבר קיים ברשימת המוצרים.";
      els.submitBtn.textContent = "שלח בכל זאת";
      return;
    }

    if (!res.ok) {
      throw new Error((res.body && res.body.error) || "שגיאה בשליחת ההצעה");
    }

    showSuccess("ההצעה נשלחה למנהל לאישור, יחד עם הבקשה שלך.");
  } catch (err) {
    els.submitError.textContent = err.message;
    els.submitError.hidden = false;
  } finally {
    els.submitBtn.disabled = false;
    if (els.submitBtn.textContent === "שולח...") els.submitBtn.textContent = "בקש הזמנה";
  }
});

function showSuccess(text) {
  els.successText.textContent = text;
  showView("successView");
}

// ---------- History ----------

const STATUS_LABELS = {
  PENDING: "ממתין לאישור",
  APPROVED: "אושר ✓",
  REJECTED: "נדחה",
};

let historyRows = [];

async function loadHistory() {
  els.historyStatus.textContent = "טוען...";
  els.historyList.innerHTML = "";
  try {
    const [requests, suggestions] = await Promise.all([ekoFreshGetMyRequests(), ekoFreshGetMySuggestions()]);
    els.historyStatus.textContent = requests.length === 0 && suggestions.length === 0 ? "עדיין אין היסטוריה" : "";

    const rows = [];
    for (const r of requests) {
      rows.push({
        type: "request",
        name: r.productName,
        meta: `${r.quantity}${r.unitLabel ? " " + r.unitLabel : ""} · ${r.categoryName}`,
        badge: r.cycleStatus === "OPEN" ? "בהזמנה הפתוחה" : "בהזמנה שהושלמה",
        badgeClass: "result-badge",
        img: r.imageUrlSnapshot,
        time: r.createdAt,
        productId: r.productId,
        quantity: r.quantity,
        unitCode: r.unitCode,
      });
    }
    for (const s of suggestions) {
      rows.push({
        type: "suggestion",
        name: s.productName,
        meta: `הצעה · ${s.categoryName}`,
        badge: STATUS_LABELS[s.status] || s.status,
        badgeClass: "result-badge",
        img: s.imageUrl,
        time: s.createdAt,
      });
    }
    rows.sort((a, b) => new Date(b.time) - new Date(a.time));
    historyRows = rows;

    els.historyList.innerHTML = rows
      .map(
        (r, i) => `
      <div class="result-card" style="cursor:default">
        <img class="result-img" src="${r.img || placeholderImg()}" alt="" onerror="this.src='${placeholderImg()}'" />
        <div class="result-info">
          <div class="result-name">${escapeHtml(r.name)}</div>
          <div class="result-meta">${escapeHtml(r.meta)}</div>
        </div>
        <span class="${r.badgeClass}">${escapeHtml(r.badge)}</span>
        ${
          r.type === "request"
            ? `<button type="button" class="link-btn reorder-btn" data-idx="${i}">↻ הזמן שוב</button>`
            : ""
        }
      </div>`
      )
      .join("");
  } catch (err) {
    els.historyStatus.textContent = "שגיאה בטעינת היסטוריה";
  }
}

els.historyList.addEventListener("click", async (e) => {
  const btn = e.target.closest(".reorder-btn");
  if (!btn) return;
  const row = historyRows[Number(btn.dataset.idx)];
  if (!row) return;

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "מוסיף...";
  try {
    await ekoFreshSubmitRequest(row.productId, row.quantity, row.unitCode || undefined);
    btn.textContent = "✓ נוסף להזמנה";
  } catch (err) {
    btn.textContent = "שגיאה, נסו שוב";
    btn.disabled = false;
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  }
});

// ---------- Tiv Taam import (admin) ----------
//
// Semi-auto MVP: the extension never touches the real cart on tivtaam.co.il.
// It only hands the finalized order's line items to a content script that
// auto-fills Tiv Taam's own search box for each product in turn — the admin
// still reviews the match and clicks "הוספה לסל" / sets quantity themselves,
// on their own logged-in Tiv Taam session, in that tab.
const TIVTAAM_QUEUE_KEY = "ekoFreshTivTaamQueue";

let importState = { order: null, items: [] };

async function loadTivTaamImportPane() {
  await refreshImportBanner();
  els.importOrderStatus.textContent = "טוען הזמנות...";
  els.importOrderItems.innerHTML = "";
  els.importStartBtn.disabled = true;
  try {
    const orders = await ekoFreshGetAdminOrders();
    if (orders.length === 0) {
      els.importOrderStatus.textContent = "אין עדיין הזמנות שהושלמו";
      els.importOrderSelect.innerHTML = "";
      return;
    }
    els.importOrderSelect.innerHTML = orders
      .map(
        (o) =>
          `<option value="${o.orderId}">הזמנה #${o.orderId} · ${o.itemCount} מוצרים · ${new Date(o.closedAt).toLocaleDateString("he-IL")}</option>`
      )
      .join("");
    els.importOrderStatus.textContent = "";
    await loadOrderPreview(Number(els.importOrderSelect.value));
  } catch (err) {
    els.importOrderStatus.textContent = err.message;
  }
}

els.importOrderSelect.addEventListener("change", () => {
  loadOrderPreview(Number(els.importOrderSelect.value));
});

async function loadOrderPreview(orderId) {
  if (!orderId) return;
  els.importOrderStatus.textContent = "טוען פריטים...";
  els.importStartBtn.disabled = true;
  try {
    const detail = await ekoFreshGetAdminOrderDetail(orderId);
    importState = { order: detail.order, items: detail.items || [] };
    els.importOrderStatus.textContent = "";
    els.importOrderItems.innerHTML = importState.items
      .map(
        (it) => `
      <div class="result-card" style="cursor:default">
        <img class="result-img" src="${it.imageUrl || placeholderImg()}" alt="" onerror="this.src='${placeholderImg()}'" />
        <div class="result-info">
          <div class="result-name">${escapeHtml(it.productName)}</div>
          <div class="result-meta">${it.finalQuantity}${it.unitLabel ? " " + escapeHtml(it.unitLabel) : ""} · ${escapeHtml(it.categoryName)}</div>
        </div>
      </div>`
      )
      .join("");
    els.importStartBtn.disabled = importState.items.length === 0;
  } catch (err) {
    els.importOrderStatus.textContent = err.message;
  }
}

els.importStartBtn.addEventListener("click", async () => {
  if (!importState.items.length) return;
  const queue = {
    orderId: importState.order.id,
    startedAt: new Date().toISOString(),
    currentIndex: 0,
    items: importState.items.map((it) => ({
      productId: it.productId,
      name: it.productName,
      quantity: it.finalQuantity,
      unitLabel: it.unitLabel,
      sourceUrl: it.sourceUrl,
      done: false,
    })),
  };
  await chrome.storage.local.set({ [TIVTAAM_QUEUE_KEY]: queue });
  await openOrFocusTivTaamTab();
  await refreshImportBanner();
});

els.importOpenTabBtn.addEventListener("click", openOrFocusTivTaamTab);

els.importCancelBtn.addEventListener("click", async () => {
  if (!confirm("לבטל את ייבוא ההזמנה הנוכחית לטיב טעם?")) return;
  await chrome.storage.local.remove(TIVTAAM_QUEUE_KEY);
  await refreshImportBanner();
});

async function openOrFocusTivTaamTab() {
  const tabs = await chrome.tabs.query({ url: "https://www.tivtaam.co.il/*" });
  if (tabs.length > 0) {
    // Reload even an existing tab: if the extension was reloaded/updated
    // since this tab was opened, its content script is orphaned (extension
    // context invalidated) and silently stops reacting to storage changes —
    // a fresh navigation re-injects it so the import panel reliably appears.
    await chrome.tabs.reload(tabs[0].id);
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: "https://www.tivtaam.co.il/" });
  }
}

async function refreshImportBanner() {
  const stored = await chrome.storage.local.get([TIVTAAM_QUEUE_KEY]);
  const queue = stored[TIVTAAM_QUEUE_KEY];
  if (!queue) {
    els.importQueueBanner.hidden = true;
    els.importSetup.hidden = false;
    return;
  }
  const doneCount = queue.items.filter((it) => it.done).length;
  els.importQueueBanner.hidden = false;
  els.importSetup.hidden = true;
  els.importQueueText.textContent = `ייבוא הזמנה #${queue.orderId} בטיב טעם — הושלמו ${doneCount} מתוך ${queue.items.length} פריטים`;
}

// ---------- Init ----------

(async function init() {
  const loggedIn = await refreshAuthUi();
  if (loggedIn) await loadCatalogCache();
})();
