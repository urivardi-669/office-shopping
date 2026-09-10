"use client";

import { useEffect, useState } from "react";
import type { Category } from "@/lib/types";
import QuantityStepper from "./QuantityStepper";

export default function SuggestProductModal({
  categories,
  onClose,
  onSubmitted,
  initialCategoryId,
}: {
  categories: Category[];
  onClose: () => void;
  onSubmitted: () => void;
  initialCategoryId?: number;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">(initialCategoryId ?? "");
  const [quantity, setQuantity] = useState(0);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState<string[] | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale check results when the name changes
    setWarning(null);
    setError("");
  }, [name]);

  async function checkAndSubmit(force = false) {
    setError("");
    if (!name.trim()) {
      setError("יש להזין שם מוצר");
      return;
    }
    if (!categoryId) {
      setError("יש לבחור קטגוריה");
      return;
    }
    setLoading(true);

    if (!force) {
      const checkRes = await fetch(`/api/suggestions/check?name=${encodeURIComponent(name.trim())}`);
      const checkData = await checkRes.json();
      if (checkData.exact) {
        setError("המוצר כבר קיים ברשימת המוצרים.");
        setLoading(false);
        return;
      }
      if (checkData.similar?.length > 0) {
        setWarning(checkData.similar);
        setLoading(false);
        return;
      }
    }

    const res = await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), categoryId, quantity, force: true }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "שגיאה בשליחת ההצעה");
      return;
    }
    setDone(true);
    onSubmitted();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center space-y-3 py-4">
            <div className="text-4xl">✅</div>
            <p className="font-medium text-neutral-700">ההצעה נשלחה למנהל לאישור.</p>
            <button
              onClick={onClose}
              className="mt-2 rounded-lg bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:bg-violet-700"
            >
              סגירה
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-neutral-800">הצעת מוצר חדש</h2>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700">שם המוצר</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='לדוגמה: "חלב שקדים"'
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700">קטגוריה</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
              >
                <option value="">בחר קטגוריה</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700">כמות נדרשת (אופציונלי)</label>
              <QuantityStepper value={quantity} onChange={setQuantity} />
              <p className="text-xs text-neutral-400">
                אם תזינו כמות, ההצעה תישלח וגם תתווסף לבקשת ההזמנה שלכם עבור הסבב הנוכחי.
              </p>
            </div>

            {warning && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
                <p className="font-medium">ייתכן שהמוצר כבר קיים:</p>
                <ul className="list-disc pr-5">
                  {warning.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <p>אפשר לשלוח בכל זאת, והמנהל יחליט.</p>
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
                onClick={() => checkAndSubmit(Boolean(warning))}
                disabled={loading}
                className="flex-1 rounded-lg bg-violet-600 text-white py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60"
              >
                {loading ? "שולח..." : quantity > 0 ? `שלח הצעה ובקש ${quantity}` : "שלח הצעה"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
