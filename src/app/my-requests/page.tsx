"use client";

import { useEffect, useState } from "react";
import type { MyRequestItem, Suggestion } from "@/lib/types";
import ProductImage from "@/components/ProductImage";

function StatusBadge({ status }: { status: Suggestion["status"] }) {
  const map = {
    PENDING: { label: "ממתין לאישור", cls: "bg-amber-100 text-amber-700" },
    APPROVED: { label: "אושר ✓", cls: "bg-emerald-100 text-emerald-700" },
    REJECTED: { label: "נדחה", cls: "bg-red-100 text-red-700" },
  } as const;
  const s = map[status];
  return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.cls}`}>{s.label}</span>;
}

export default function MyRequestsPage() {
  const [items, setItems] = useState<MyRequestItem[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/requests/mine").then((r) => r.json()),
      fetch("/api/suggestions?scope=mine").then((r) => r.json()),
    ]).then(([reqData, sugData]) => {
      setItems(reqData.items || []);
      setSuggestions(sugData.suggestions || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center text-neutral-400 py-16">טוען...</div>;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-neutral-800 mb-1">ההזמנות שלי</h1>
        <p className="text-sm text-neutral-500 mb-4">היסטוריית הבקשות שהגשת</p>
        {items.length === 0 ? (
          <div className="text-neutral-400 text-sm bg-white rounded-xl border border-neutral-200 p-6 text-center">
            עדיין לא הגשת בקשות
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-500 text-xs">
                <tr>
                  <th className="text-start px-4 py-2 font-medium">מוצר</th>
                  <th className="text-start px-4 py-2 font-medium">קטגוריה</th>
                  <th className="text-start px-4 py-2 font-medium">כמות</th>
                  <th className="text-start px-4 py-2 font-medium">תאריך</th>
                  <th className="text-start px-4 py-2 font-medium">מחזור</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-neutral-100">
                    <td className="px-4 py-2 font-medium text-neutral-700">
                      <div className="flex items-center gap-2">
                        <ProductImage src={it.imageUrlSnapshot} alt={it.productName} size={28} />
                        {it.productName}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{it.categoryName}</td>
                    <td className="px-4 py-2">
                      {it.quantity}
                      {it.unitLabel ? ` ${it.unitLabel}` : ""}
                    </td>
                    <td className="px-4 py-2 text-neutral-400">
                      {new Date(it.createdAt + "Z").toLocaleString("he-IL")}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          it.cycleStatus === "OPEN" ? "bg-blue-100 text-blue-700" : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {it.cycleStatus === "OPEN" ? "פתוח" : "סגור"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-neutral-800 mb-1">ההצעות שלי</h2>
        <p className="text-sm text-neutral-500 mb-4">מוצרים שהצעת להוסיף לקטלוג</p>
        {suggestions.length === 0 ? (
          <div className="text-neutral-400 text-sm bg-white rounded-xl border border-neutral-200 p-6 text-center">
            עדיין לא הצעת מוצרים חדשים
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-neutral-200 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ProductImage src={s.imageUrl} alt={s.productName} size={36} />
                    <div>
                      <div className="font-semibold text-neutral-800">{s.productName}</div>
                      <div className="text-xs text-neutral-400">
                        קטגוריה: {s.categoryName}
                        {s.brand ? ` · ${s.brand}` : ""}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                {s.requestedQuantity > 0 && (
                  <div className="text-xs text-neutral-500">
                    כמות שהתבקשה: {s.requestedQuantity}
                    {s.unitLabel ? ` ${s.unitLabel}` : ""}
                  </div>
                )}
                {s.status === "REJECTED" && s.rejectionReason && (
                  <div className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1">
                    סיבת דחייה: {s.rejectionReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
