"use client";

import { useEffect, useState } from "react";
import type { Category, Product } from "@/lib/types";
import TivTaamSearchModal from "@/components/TivTaamSearchModal";
import ProductImage from "@/components/ProductImage";

export default function AdminProductsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showTivTaam, setShowTivTaam] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ text: string; isError: boolean } | null>(null);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ all: "1" });
    if (categoryFilter !== "all") params.set("category", String(categoryFilter));
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/products?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.products);
        setLoading(false);
      });
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === products.length ? new Set() : new Set(products.map((p) => p.id))));
  }

  async function removeSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`להסיר ${selectedIds.size} מוצרים מהקטלוג לצמיתות?`)) return;
    setRemoving(true);
    setResultMessage(null);
    const res = await fetch("/api/products/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: Array.from(selectedIds) }),
    });
    const data = await res.json();
    setRemoving(false);
    setSelectedIds(new Set());
    load();

    if (res.ok) {
      const parts: string[] = [];
      if (data.removed?.length) parts.push(`הוסרו ${data.removed.length} מוצרים.`);
      if (data.blocked?.length) {
        parts.push(
          `לא ניתן להסיר ${data.blocked.length} מוצרים בעלי היסטוריית בקשות/הזמנות (${data.blocked
            .map((b: { name: string }) => b.name)
            .join(", ")}) — ניתן להשבית אותם במקום.`
        );
      }
      setResultMessage({ text: parts.join(" "), isError: Boolean(data.blocked?.length) });
    } else {
      setResultMessage({ text: data.error || "שגיאה בהסרת מוצרים", isError: true });
    }
  }

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories));
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch products when filters change
  useEffect(load, [categoryFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">ניהול מוצרים</h1>
          <p className="text-sm text-neutral-500">הוספה, עריכה והשבתה של מוצרים בקטלוג</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={removeSelected}
              disabled={removing}
              className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-60"
            >
              {removing ? "מסיר..." : `הסר (${selectedIds.size})`}
            </button>
          )}
          <button
            onClick={() => setShowTivTaam(true)}
            className="rounded-lg bg-neutral-950 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800"
          >
            + הוסף מוצר מטיב טעם
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg border border-neutral-300 text-neutral-700 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            + הוסף מוצר ידנית
          </button>
        </div>
      </div>

      {resultMessage && (
        <div
          className={`text-sm rounded-lg px-3 py-2 ${
            resultMessage.isError ? "text-amber-800 bg-amber-50 border border-amber-200" : "text-emerald-700 bg-emerald-50 border border-emerald-200"
          }`}
        >
          {resultMessage.text}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש מוצר"
          className="flex-1 min-w-[200px] rounded-lg border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="rounded-lg border border-neutral-300 px-3 py-2 bg-white"
        >
          <option value="all">כל הקטגוריות</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs">
            <tr>
              <th className="px-4 py-2 font-medium w-8">
                <input
                  type="checkbox"
                  checked={products.length > 0 && selectedIds.size === products.length}
                  onChange={toggleSelectAll}
                  className="rounded border-neutral-300"
                  aria-label="בחר הכל"
                />
              </th>
              <th className="text-start px-4 py-2 font-medium">מוצר</th>
              <th className="text-start px-4 py-2 font-medium">קטגוריה</th>
              <th className="text-start px-4 py-2 font-medium">מקור</th>
              <th className="text-start px-4 py-2 font-medium">סטטוס</th>
              <th className="text-start px-4 py-2 font-medium">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center text-neutral-400 py-8">
                  טוען...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-neutral-400 py-8">
                  לא נמצאו מוצרים
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className={`border-t border-neutral-100 ${selectedIds.has(p.id) ? "bg-red-50/40" : ""}`}>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelected(p.id)}
                      className="rounded border-neutral-300"
                      aria-label={`בחר ${p.name}`}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <ProductImage src={p.imageUrl} alt={p.name} size={32} />
                      <div>
                        <div className="font-medium text-neutral-700">{p.name}</div>
                        {p.brand && <div className="text-xs text-neutral-400">{p.brand}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{p.categoryName}</td>
                  <td className="px-4 py-2">
                    {p.source === "TIV_TAAM" ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-950 text-white">טיב טעם</span>
                    ) : (
                      <span className="text-xs text-neutral-400">ידני</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-500"
                      }`}
                    >
                      {p.active ? "פעיל" : "מושבת"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setEditing(p)}
                      className="text-violet-600 hover:text-violet-800 font-medium text-xs me-3"
                    >
                      ערוך
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showTivTaam && (
        <TivTaamSearchModal
          mode="admin"
          categories={categories}
          onClose={() => setShowTivTaam(false)}
          onAdded={load}
        />
      )}
      {showAdd && (
        <ProductFormModal
          categories={categories}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
      {editing && (
        <ProductFormModal
          categories={categories}
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ProductFormModal({
  categories,
  product,
  onClose,
  onSaved,
}: {
  categories: Category[];
  product?: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [categoryId, setCategoryId] = useState<number | "">(product?.categoryId ?? "");
  const [active, setActive] = useState(product ? Boolean(product.active) : true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !categoryId) {
      setError("יש למלא שם וקטגוריה");
      return;
    }
    setSaving(true);
    const url = product ? `/api/products/${product.id}` : "/api/products";
    const method = product ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), categoryId, active }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "שגיאה בשמירה");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-neutral-800">{product ? "עריכת מוצר" : "הוספת מוצר"}</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-neutral-700">שם המוצר</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='לדוגמה: "תה ירוק"'
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-neutral-700">קטגוריה</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 bg-white"
          >
            <option value="">בחר קטגוריה</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {product && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-700">סטטוס</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActive(true)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  active ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-neutral-300 text-neutral-600"
                }`}
              >
                פעיל
              </button>
              <button
                type="button"
                onClick={() => setActive(false)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  !active ? "border-neutral-500 bg-neutral-100 text-neutral-700" : "border-neutral-300 text-neutral-600"
                }`}
              >
                השבת מוצר
              </button>
            </div>
          </div>
        )}

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-neutral-300 text-neutral-600 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            ביטול
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-lg bg-violet-600 text-white py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? "שומר..." : "שמור"}
          </button>
        </div>
      </div>
    </div>
  );
}
