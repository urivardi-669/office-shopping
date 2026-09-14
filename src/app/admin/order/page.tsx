"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, OrderItem, Product } from "@/lib/types";
import ProductImage from "@/components/ProductImage";

type PendingSuggestion = {
  suggestionId: number;
  productName: string;
  categoryName: string;
  requestedQuantity: number;
  suggestedBy: string;
  imageUrl?: string | null;
  brand?: string | null;
  unitLabel?: string | null;
};

export default function AdminOrderPage() {
  const router = useRouter();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [pending, setPending] = useState<PendingSuggestion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [busyProduct, setBusyProduct] = useState<number | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/order")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setPending(d.pendingSuggestions || []);
        setLoading(false);
      });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories));
  }, []);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (categoryFilter !== "all" && it.categoryName !== categoryFilter) return false;
      if (search.trim() && !it.productName.includes(search.trim())) return false;
      return true;
    });
  }, [items, categoryFilter, search]);

  async function updateQuantity(productId: number, finalQuantity: number) {
    setBusyProduct(productId);
    await fetch("/api/order/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, finalQuantity }),
    });
    await refreshItems(productId, finalQuantity);
    setBusyProduct(null);
  }

  function refreshItems(productId: number, finalQuantity: number) {
    setItems((prev) => prev.map((it) => (it.productId === productId ? { ...it, finalQuantity } : it)));
    return Promise.resolve();
  }

  async function deleteFromOrder(productId: number) {
    setBusyProduct(productId);
    await fetch(`/api/order/item?productId=${productId}`, { method: "DELETE" });
    load();
    setBusyProduct(null);
  }

  async function approveSuggestion(suggestionId: number) {
    await fetch(`/api/suggestions/${suggestionId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addToOrder: true }),
    });
    load();
  }

  async function rejectSuggestion(suggestionId: number) {
    await fetch(`/api/suggestions/${suggestionId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeFromOrder: true }),
    });
    load();
  }

  async function finishOrder() {
    if (!confirm("לסיים את ההזמנה הנוכחית? היא תישמר בהזמנות קודמות ותיפתח הזמנה חדשה.")) return;
    setFinishing(true);
    const res = await fetch("/api/order/finish", { method: "POST" });
    const data = await res.json();
    setFinishing(false);
    if (data.orderId) {
      router.push(`/admin/orders/${data.orderId}`);
      return;
    }
    load();
  }

  const totalFinal = items.reduce((s, it) => s + it.finalQuantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">בונה הזמנה</h1>
          <p className="text-sm text-neutral-500">
            כמות כוללת בהזמנה הסופית: <span className="font-semibold text-violet-700">{totalFinal}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:bg-violet-700"
          >
            + הוסף מוצר
          </button>
          <button
            onClick={finishOrder}
            disabled={finishing}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
          >
            {finishing ? "מסיים..." : "סיים הזמנה"}
          </button>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-amber-800">⚠ מוצרים חדשים הממתינים לאישור</h2>
          <div className="space-y-2">
            {pending.map((p) => (
              <div
                key={p.suggestionId}
                className="flex items-center justify-between gap-3 bg-white rounded-lg border border-amber-200 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <ProductImage src={p.imageUrl} alt={p.productName} size={36} />
                  <div>
                    <div className="font-medium text-neutral-800">
                      {p.productName}
                      {p.brand ? ` · ${p.brand}` : ""}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {p.categoryName} · ביקוש: {p.requestedQuantity}
                      {p.unitLabel ? ` ${p.unitLabel}` : ""} · מבקש: {p.suggestedBy}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveSuggestion(p.suggestionId)}
                    className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2.5 py-1 text-xs font-semibold"
                  >
                    אשר + הוסף להזמנה
                  </button>
                  <button
                    onClick={() => rejectSuggestion(p.suggestionId)}
                    className="text-red-700 bg-red-50 hover:bg-red-100 rounded-lg px-2.5 py-1 text-xs font-semibold"
                  >
                    דחה
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש מוצר"
          className="flex-1 min-w-[200px] rounded-lg border border-neutral-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 bg-white"
        >
          <option value="all">כל הקטגוריות</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs">
            <tr>
              <th className="text-start px-4 py-2 font-medium">מוצר</th>
              <th className="text-start px-4 py-2 font-medium">קטגוריה</th>
              <th className="text-start px-4 py-2 font-medium">ביקוש</th>
              <th className="text-start px-4 py-2 font-medium">הזמנה סופית</th>
              <th className="text-start px-4 py-2 font-medium">מבקשים</th>
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
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-neutral-400 py-8">
                  אין פריטים להצגה
                </td>
              </tr>
            ) : (
              filtered.map((it) => (
                <tr key={it.productId} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-medium text-neutral-700">
                    <div className="flex items-center gap-2">
                      <ProductImage src={it.imageUrl} alt={it.productName} size={28} />
                      {it.productName}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{it.categoryName}</td>
                  <td className="px-4 py-2">
                    {it.demand}
                    {it.unitLabel ? ` ${it.unitLabel}` : ""}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      value={it.finalQuantity}
                      disabled={busyProduct === it.productId}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        setItems((prev) =>
                          prev.map((x) => (x.productId === it.productId ? { ...x, finalQuantity: v } : x))
                        );
                      }}
                      onBlur={(e) => updateQuantity(it.productId, Math.max(0, Number(e.target.value) || 0))}
                      className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-center"
                    />
                  </td>
                  <td className="px-4 py-2 text-neutral-500 text-xs">
                    {it.requesters.length > 0 ? it.requesters.join(", ") : "-"}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => deleteFromOrder(it.productId)}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      מחק
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddProductModal
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddProductModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<number | "">("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (categoryId) params.set("category", String(categoryId));
    fetch(`/api/products?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setProducts(d.products));
  }, [categoryId]);

  async function add() {
    if (!productId || quantity <= 0) {
      setError("יש לבחור מוצר ולהזין כמות");
      return;
    }
    setSaving(true);
    await fetch("/api/order/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, finalQuantity: quantity }),
    });
    setSaving(false);
    onAdded();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-neutral-800">הוסף מוצר להזמנה</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-neutral-700">קטגוריה</label>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value ? Number(e.target.value) : "");
              setProductId("");
            }}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 bg-white"
          >
            <option value="">כל הקטגוריות</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-neutral-700">מוצר</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 bg-white"
          >
            <option value="">בחר מוצר</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-neutral-700">כמות</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-neutral-300 text-neutral-600 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            ביטול
          </button>
          <button
            onClick={add}
            disabled={saving}
            className="flex-1 rounded-lg bg-violet-600 text-white py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? "מוסיף..." : "הוסף"}
          </button>
        </div>
      </div>
    </div>
  );
}
