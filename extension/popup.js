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
  searchPane: document.getElementById("searchPane"),
  historyPane: document.getElementById("historyPane"),
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

function setTab(tab) {
  els.tabSearch.classList.toggle("active", tab === "search");
  els.tabHistory.classList.toggle("active", tab === "history");
  els.searchPane.hidden = tab !== "search";
  els.historyPane.hidden = tab !== "history";
  if (tab === "history") loadHistory();
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

async function loadHistory() {
  els.historyStatus.textContent = "טוען...";
  els.historyList.innerHTML = "";
  try {
    const [requests, suggestions] = await Promise.all([ekoFreshGetMyRequests(), ekoFreshGetMySuggestions()]);
    els.historyStatus.textContent = requests.length === 0 && suggestions.length === 0 ? "עדיין אין היסטוריה" : "";

    const rows = [];
    for (const r of requests) {
      rows.push({
        name: r.productName,
        meta: `${r.quantity}${r.unitLabel ? " " + r.unitLabel : ""} · ${r.categoryName}`,
        badge: r.cycleStatus === "OPEN" ? "בהזמנה הפתוחה" : "בהזמנה שהושלמה",
        badgeClass: "result-badge",
        img: r.imageUrlSnapshot,
        time: r.createdAt,
      });
    }
    for (const s of suggestions) {
      rows.push({
        name: s.productName,
        meta: `הצעה · ${s.categoryName}`,
        badge: STATUS_LABELS[s.status] || s.status,
        badgeClass: "result-badge",
        img: s.imageUrl,
        time: s.createdAt,
      });
    }
    rows.sort((a, b) => new Date(b.time) - new Date(a.time));

    els.historyList.innerHTML = rows
      .map(
        (r) => `
      <div class="result-card" style="cursor:default">
        <img class="result-img" src="${r.img || placeholderImg()}" alt="" onerror="this.src='${placeholderImg()}'" />
        <div class="result-info">
          <div class="result-name">${escapeHtml(r.name)}</div>
          <div class="result-meta">${escapeHtml(r.meta)}</div>
        </div>
        <span class="${r.badgeClass}">${escapeHtml(r.badge)}</span>
      </div>`
      )
      .join("");
  } catch (err) {
    els.historyStatus.textContent = "שגיאה בטעינת היסטוריה";
  }
}

// ---------- Init ----------

(async function init() {
  const loggedIn = await refreshAuthUi();
  if (loggedIn) await loadCatalogCache();
})();
