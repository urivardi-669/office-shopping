"use client";

import { useEffect, useMemo, useState } from "react";
import type { Category, Product } from "@/lib/types";
import QuantityStepper from "@/components/QuantityStepper";
import ProductImage from "@/components/ProductImage";
import TivTaamSearchModal from "@/components/TivTaamSearchModal";

export default function CatalogPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | "all">("all");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [unitByProduct, setUnitByProduct] = useState<Record<number, string>>({});
  const [showTivTaam, setShowTivTaam] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- toggling loading state for the fetch below
    setLoading(true);
    const params = new URLSearchParams();
    if (activeCategory !== "all") params.set("category", String(activeCategory));
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/products?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.products);
        setLoading(false);
      });
  }, [activeCategory, search]);

  const totalSelected = useMemo(
    () => Object.values(quantities).reduce((sum, q) => sum + (q || 0), 0),
    [quantities]
  );

  function setQty(productId: number, qty: number) {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, qty) }));
  }

  function defaultUnitCode(p: Product): string | undefined {
    return p.units?.find((u) => u.isDefault)?.unitCode || p.units?.[0]?.unitCode;
  }

  async function submitRequest() {
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => {
        const id = Number(productId);
        const product = products.find((p) => p.id === id);
        const unitCode = unitByProduct[id] || (product ? defaultUnitCode(product) : undefined);
        return { productId: id, quantity, unitCode };
      });
    if (items.length === 0) return;
    setSubmitting(true);
    setSubmitMessage("");
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setSubmitting(false);
    if (res.ok) {
      setQuantities({});
      setSubmitMessage("הבקשה נשלחה בהצלחה!");
      setTimeout(() => setSubmitMessage(""), 4000);
    } else {
      setSubmitMessage("שגיאה בשליחת הבקשה");
    }
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-neutral-800">מה צריך למשרד?</h1>
        <p className="text-sm text-neutral-500">בחרו מוצרים וכמויות, ושלחו בקשה למנהל</p>
      </div>

      <div className="relative">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש מוצר"
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 pe-10 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
        />
        <span className="absolute inset-y-0 end-3 flex items-center text-neutral-400">🔍</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
            activeCategory === "all"
              ? "bg-violet-600 text-white border-violet-600"
              : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50"
          }`}
        >
          הכל
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
              activeCategory === c.id
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-neutral-400 py-16">טוען מוצרים...</div>
      ) : products.length === 0 ? (
        <div className="text-center text-neutral-400 py-16">לא נמצאו מוצרים</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {products.map((p) => {
            const units = p.units && p.units.length > 1 ? p.units : null;
            const selectedUnit = unitByProduct[p.id] || defaultUnitCode(p);
            return (
              <div
                key={p.id}
                className={`rounded-xl border bg-white p-4 flex items-center gap-3 transition ${
                  (quantities[p.id] || 0) > 0 ? "border-violet-400 ring-1 ring-violet-200" : "border-neutral-200"
                }`}
              >
                <ProductImage src={p.imageUrl} alt={p.name} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-neutral-800 truncate">{p.name}</div>
                  <div className="text-xs text-neutral-400 truncate">
                    {p.categoryName}
                    {p.brand ? ` · ${p.brand}` : ""}
                  </div>
                  {units && (
                    <div className="flex gap-1 mt-1.5">
                      {units.map((u) => (
                        <button
                          key={u.unitCode}
                          onClick={() => setUnitByProduct((prev) => ({ ...prev, [p.id]: u.unitCode }))}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            selectedUnit === u.unitCode
                              ? "border-violet-500 bg-violet-50 text-violet-700"
                              : "border-neutral-300 text-neutral-500"
                          }`}
                        >
                          {u.unitLabel}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <QuantityStepper value={quantities[p.id] || 0} onChange={(v) => setQty(p.id, v)} />
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center pt-2">
        <button
          onClick={() => setShowTivTaam(true)}
          className="text-sm text-violet-600 hover:text-violet-800 font-medium underline underline-offset-4"
        >
          לא מצאתם את מה שחיפשתם? הצע מוצר
        </button>
      </div>

      {totalSelected > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-10">
          <div className="max-w-6xl mx-auto px-4 pb-4">
            <div className="bg-white border border-neutral-200 shadow-lg rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="text-sm text-neutral-600">
                נבחרו <span className="font-bold text-violet-700">{totalSelected}</span> פריטים
                {submitMessage && <span className="ms-3 text-emerald-600 font-medium">{submitMessage}</span>}
              </div>
              <button
                onClick={submitRequest}
                disabled={submitting}
                className="rounded-lg bg-violet-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-60"
              >
                {submitting ? "שולח..." : "בקש הזמנה"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTivTaam && (
        <TivTaamSearchModal
          mode="employee"
          categories={categories}
          onClose={() => setShowTivTaam(false)}
          onAddedToRequest={() => {
            setSubmitMessage("הבקשה נשלחה בהצלחה!");
            setTimeout(() => setSubmitMessage(""), 4000);
          }}
        />
      )}
    </div>
  );
}
