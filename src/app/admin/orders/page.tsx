"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type OrderSummary = {
  orderId: number;
  closedAt: string;
  createdAt: string;
  itemCount: number;
  totalQuantity: number;
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const router = useRouter();

  function load() {
    fetch("/api/admin/orders")
      .then((r) => r.json())
      .then((d) => {
        setOrders(d.orders || []);
        setLoading(false);
      });
  }

  useEffect(load, []);

  async function deleteOrder(e: React.MouseEvent, orderId: number) {
    e.stopPropagation();
    if (!confirm(`למחוק לצמיתות את הזמנה #${orderId}? הפעולה אינה הפיכה.`)) return;
    setDeletingId(orderId);
    const res = await fetch(`/api/admin/orders/${orderId}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "שגיאה במחיקת ההזמנה");
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-800">הזמנות קודמות</h1>
        <p className="text-sm text-neutral-500">היסטוריית ההזמנות שהושלמו</p>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs">
            <tr>
              <th className="text-start px-4 py-2 font-medium">מס&apos; הזמנה</th>
              <th className="text-start px-4 py-2 font-medium">תאריך סיום</th>
              <th className="text-start px-4 py-2 font-medium">מס&apos; פריטים</th>
              <th className="text-start px-4 py-2 font-medium">כמות כוללת</th>
              <th className="text-start px-4 py-2 font-medium">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center text-neutral-400 py-8">
                  טוען...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-neutral-400 py-8">
                  עדיין אין הזמנות שהושלמו
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr
                  key={o.orderId}
                  onClick={() => router.push(`/admin/orders/${o.orderId}`)}
                  className="border-t border-neutral-100 cursor-pointer hover:bg-violet-50/60 transition"
                >
                  <td className="px-4 py-3 font-medium text-violet-700">הזמנה #{o.orderId}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {o.closedAt ? new Date(o.closedAt + "Z").toLocaleString("he-IL") : "-"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{o.itemCount}</td>
                  <td className="px-4 py-3 text-neutral-600">{o.totalQuantity}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => deleteOrder(e, o.orderId)}
                      disabled={deletingId === o.orderId}
                      className="text-red-600 hover:text-red-800 font-medium text-xs disabled:opacity-50"
                    >
                      {deletingId === o.orderId ? "מוחק..." : "מחק"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
