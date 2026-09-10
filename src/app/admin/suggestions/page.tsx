"use client";

import { useEffect, useState } from "react";
import type { Suggestion } from "@/lib/types";
import ProductImage from "@/components/ProductImage";

function StatusBadge({ status }: { status: Suggestion["status"] }) {
  const map = {
    PENDING: { label: "ממתין", cls: "bg-amber-100 text-amber-700" },
    APPROVED: { label: "אושר", cls: "bg-emerald-100 text-emerald-700" },
    REJECTED: { label: "נדחה", cls: "bg-red-100 text-red-700" },
  } as const;
  const s = map[status];
  return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.cls}`}>{s.label}</span>;
}

export default function AdminSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<Suggestion | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");

  function load() {
    setLoading(true);
    fetch("/api/suggestions")
      .then((r) => r.json())
      .then((d) => {
        setSuggestions(d.suggestions || []);
        setLoading(false);
      });
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
  useEffect(load, []);

  async function approve(id: number) {
    setBusyId(id);
    await fetch(`/api/suggestions/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addToOrder: true }),
    });
    setBusyId(null);
    load();
  }

  async function reject() {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    await fetch(`/api/suggestions/${rejecting.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason, removeFromOrder: true }),
    });
    setBusyId(null);
    setRejecting(null);
    setRejectReason("");
    load();
  }

  const visible = filter === "PENDING" ? suggestions.filter((s) => s.status === "PENDING") : suggestions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">מוצרים להוספה</h1>
          <p className="text-sm text-neutral-500">בקשות עובדים להוספת מוצרים חדשים לקטלוג</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("PENDING")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              filter === "PENDING" ? "bg-violet-600 text-white border-violet-600" : "border-neutral-300 text-neutral-600"
            }`}
          >
            ממתינים
          </button>
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              filter === "ALL" ? "bg-violet-600 text-white border-violet-600" : "border-neutral-300 text-neutral-600"
            }`}
          >
            הכל
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs">
            <tr>
              <th className="text-start px-4 py-2 font-medium">מוצר</th>
              <th className="text-start px-4 py-2 font-medium">קטגוריה</th>
              <th className="text-start px-4 py-2 font-medium">כמות מבוקשת</th>
              <th className="text-start px-4 py-2 font-medium">הוצע על ידי</th>
              <th className="text-start px-4 py-2 font-medium">תאריך</th>
              <th className="text-start px-4 py-2 font-medium">סטטוס</th>
              <th className="text-start px-4 py-2 font-medium">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center text-neutral-400 py-8">
                  טוען...
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-neutral-400 py-8">
                  אין הצעות להצגה
                </td>
              </tr>
            ) : (
              visible.map((s) => (
                <tr key={s.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-medium text-neutral-700">
                    <div className="flex items-center gap-2">
                      <ProductImage src={s.imageUrl} alt={s.productName} size={32} />
                      <div>
                        <div>{s.productName}</div>
                        {(s.brand || s.sku) && (
                          <div className="text-xs text-neutral-400 font-normal">
                            {s.brand}
                            {s.brand && s.sku ? " · " : ""}
                            {s.sku && `מק"ט: ${s.sku}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{s.categoryName}</td>
                  <td className="px-4 py-2">
                    {s.requestedQuantity ? `${s.requestedQuantity}${s.unitLabel ? ` ${s.unitLabel}` : ""}` : "-"}
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{s.suggestedBy}</td>
                  <td className="px-4 py-2 text-neutral-400">
                    {new Date(s.createdAt + "Z").toLocaleDateString("he-IL")}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-2">
                    {s.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <button
                          disabled={busyId === s.id}
                          onClick={() => approve(s.id)}
                          className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                        >
                          אישור
                        </button>
                        <button
                          disabled={busyId === s.id}
                          onClick={() => setRejecting(s)}
                          className="text-red-700 bg-red-50 hover:bg-red-100 rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                        >
                          דחייה
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">טופל</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rejecting && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setRejecting(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-neutral-800">דחיית הצעה: {rejecting.productName}</h2>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700">סיבת דחייה (אופציונלי)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder='לדוגמה: "יש מוצר דומה כבר ברשימה."'
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setRejecting(null)}
                className="flex-1 rounded-lg border border-neutral-300 text-neutral-600 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                ביטול
              </button>
              <button
                onClick={reject}
                className="flex-1 rounded-lg bg-red-600 text-white py-2 text-sm font-medium hover:bg-red-700"
              >
                דחה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
