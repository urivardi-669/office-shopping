"use client";

import { useEffect, useState } from "react";
import type { TivTaamProduct } from "@/lib/tivtaam/types";
import type { Category } from "@/lib/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import ProductImage from "./ProductImage";
import QuantityStepper from "./QuantityStepper";
import SuggestProductModal from "./SuggestProductModal";

type Mode = "admin" | "employee";

export default function TivTaamSearchModal({
  mode,
  categories,
  onClose,
  onAdded,
  onAddedToRequest,
  onSuggestionSubmitted,
}: {
  mode: Mode;
  categories: Category[];
  onClose: () => void;
  onAdded?: () => void;
  onAddedToRequest?: () => void;
  onSuggestionSubmitted?: () => void;
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 350);
  const [results, setResults] = useState<TivTaamProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<TivTaamProduct | null>(null);
  const [showFreeText, setShowFreeText] = useState(false);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale results when query shrinks below the search threshold
      setResults(null);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/tivtaam/search?q=${encodeURIComponent(debouncedQuery.trim())}`)
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setError(data.error || "שגיאה בחיפוש מוצרים");
          setResults([]);
          return;
        }
        setResults(data.results || []);
      })
      .catch(() => {
        if (!cancelled) {
          setError("שירות טיב טעם אינו זמין כרגע. נסו שוב מאוחר יותר.");
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  if (showFreeText) {
    return (
      <SuggestProductModal
        categories={categories}
        onClose={onClose}
        onSubmitted={() => onSuggestionSubmitted?.()}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-4 space-y-3 border-b border-neutral-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-800">חיפוש מוצר בטיב טעם</h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none">
              ×
            </button>
          </div>
          {!selected && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="לדוגמה: קפה, בננות, חלב..."
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {selected ? (
            <SelectedProductPanel
              product={selected}
              mode={mode}
              categories={categories}
              onBack={() => setSelected(null)}
              onAdded={() => {
                onAdded?.();
                onClose();
              }}
              onAddedToRequest={() => {
                onAddedToRequest?.();
                onClose();
              }}
              onSuggestionSubmitted={() => onSuggestionSubmitted?.()}
            />
          ) : (
            <>
              {query.trim().length < 2 && (
                <p className="text-sm text-neutral-400 text-center py-8">הקלידו לפחות 2 תווים כדי לחפש</p>
              )}
              {loading && <p className="text-sm text-neutral-400 text-center py-8">מחפש...</p>}
              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">{error}</div>
              )}
              {!loading && !error && results && results.length === 0 && query.trim().length >= 2 && (
                <p className="text-sm text-neutral-400 text-center py-8">לא נמצאו מוצרים תואמים</p>
              )}
              {!loading && results && results.length > 0 && (
                <div className="space-y-2">
                  {results.map((p) => (
                    <button
                      key={p.sourceProductId}
                      onClick={() => setSelected(p)}
                      className="w-full flex items-center gap-3 rounded-xl border border-neutral-200 hover:border-violet-300 hover:bg-violet-50/40 p-3 text-start transition"
                    >
                      <ProductImage src={p.imageUrl} alt={p.name} size={56} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-neutral-800 truncate">{p.name}</div>
                        <div className="text-xs text-neutral-400 truncate">
                          {p.brand && <span>{p.brand} · </span>}
                          {p.sku && <span>מק&quot;ט: {p.sku}</span>}
                        </div>
                        {p.officeProductId && (
                          <span className="inline-block mt-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                            כבר קיים בקטלוג
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {!selected && (
          <div className="p-4 border-t border-neutral-100 text-center">
            <button
              onClick={() => setShowFreeText(true)}
              className="text-sm text-violet-600 hover:text-violet-800 font-medium underline underline-offset-4"
            >
              לא מוצאים? הוסיפו מוצר בשם חופשי
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SelectedProductPanel({
  product,
  mode,
  categories,
  onBack,
  onAdded,
  onAddedToRequest,
  onSuggestionSubmitted,
}: {
  product: TivTaamProduct;
  mode: Mode;
  categories: Category[];
  onBack: () => void;
  onAdded: () => void;
  onAddedToRequest: () => void;
  onSuggestionSubmitted: () => void;
}) {
  const defaultUnit = product.units.find((u) => u.isDefault) || product.units[0];
  const [unitCode, setUnitCode] = useState(defaultUnit?.unitCode || "UNIT");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<null | "added" | "requested" | "suggested">(null);

  const unit = product.units.find((u) => u.unitCode === unitCode) || defaultUnit;

  async function addToOfficeCatalog() {
    if (!categoryId) {
      setError("יש לבחור קטגוריה");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/products/from-tivtaam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, tivTaamProduct: product }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "שגיאה בהוספת המוצר");
      return;
    }
    if (data.existing) {
      setError(`המוצר כבר קיים בקטלוג בקטגוריה "${data.product.categoryName}".`);
      return;
    }
    setDone("added");
    setTimeout(onAdded, 700);
  }

  async function addDirectlyToRequest() {
    if (!product.officeProductId) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ productId: product.officeProductId, quantity, unitCode: unit?.unitCode }],
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("שגיאה בהוספת הבקשה");
      return;
    }
    setDone("requested");
    setTimeout(onAddedToRequest, 700);
  }

  async function requestAddition() {
    if (!categoryId) {
      setError("יש לבחור קטגוריה");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: product.name,
        categoryId,
        quantity,
        force: true,
        source: "TIV_TAAM",
        sourceProductId: product.sourceProductId,
        sku: product.sku,
        brand: product.brand,
        imageUrl: product.imageUrl,
        sourceUrl: product.sourceUrl,
        unitCode: unit?.unitCode,
        unitLabel: unit?.unitLabel,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "שגיאה בשליחת הבקשה");
      return;
    }
    setDone("suggested");
    onSuggestionSubmitted();
  }

  if (done) {
    const messages = {
      added: "המוצר נוסף לקטלוג!",
      requested: "הבקשה נוספה בהצלחה!",
      suggested: "ההצעה נשלחה למנהל לאישור.",
    };
    return (
      <div className="text-center space-y-3 py-8">
        <div className="text-4xl">✅</div>
        <p className="font-medium text-neutral-700">{messages[done]}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-700">
        → חזרה לתוצאות
      </button>

      <div className="flex items-center gap-3">
        <ProductImage src={product.imageUrl} alt={product.name} size={72} />
        <div>
          <div className="font-semibold text-neutral-800">{product.name}</div>
          {product.brand && <div className="text-sm text-neutral-500">{product.brand}</div>}
          {product.sku && <div className="text-xs text-neutral-400">מק&quot;ט: {product.sku}</div>}
          {product.sourceCategory && (
            <div className="text-xs text-neutral-400">
              {product.sourceCategory}
              {product.sourceSubcategory ? ` · ${product.sourceSubcategory}` : ""}
            </div>
          )}
        </div>
      </div>

      {product.units.length > 1 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-neutral-700">יחידה</label>
          <div className="flex gap-2">
            {product.units.map((u) => (
              <button
                key={u.unitCode}
                onClick={() => setUnitCode(u.unitCode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                  unitCode === u.unitCode
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-neutral-300 text-neutral-600"
                }`}
              >
                {u.unitLabel}
              </button>
            ))}
          </div>
        </div>
      )}
      {product.units.length === 1 && unit && (
        <div className="text-sm text-neutral-500">
          יחידה: <span className="font-medium text-neutral-700">{unit.unitLabel}</span>
          {unit.packageSize && unit.packageSizeUnit && (
            <span> ({unit.packageSize} {unit.packageSizeUnit})</span>
          )}
        </div>
      )}

      {mode === "admin" && (
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
      )}

      {mode === "employee" && (
        <>
          {product.officeProductId ? (
            <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              המוצר כבר קיים בקטלוג של המשרד — אפשר להוסיף אותו ישירות לבקשה שלכם.
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700">קטגוריה מוצעת</label>
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
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-700">כמות</label>
            <QuantityStepper value={quantity} onChange={setQuantity} min={1} />
          </div>
        </>
      )}

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      <div className="pt-2">
        {mode === "admin" && (
          <button
            onClick={addToOfficeCatalog}
            disabled={saving}
            className="w-full rounded-lg bg-violet-600 text-white py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? "מוסיף..." : "הוסף מוצר"}
          </button>
        )}
        {mode === "employee" && product.officeProductId && (
          <button
            onClick={addDirectlyToRequest}
            disabled={saving}
            className="w-full rounded-lg bg-violet-600 text-white py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? "מוסיף..." : "הוסף לבקשה"}
          </button>
        )}
        {mode === "employee" && !product.officeProductId && (
          <button
            onClick={requestAddition}
            disabled={saving}
            className="w-full rounded-lg bg-violet-600 text-white py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? "שולח..." : `בקש להוסיף מוצר${quantity > 0 ? ` וקבל ${quantity}` : ""}`}
          </button>
        )}
      </div>
    </div>
  );
}
