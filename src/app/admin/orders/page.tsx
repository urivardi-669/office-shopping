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
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/orders")
      .then((r) => r.json())
      .then((d) => {
        setOrders(d.orders || []);
        setLoading(false);
      });
  }, []);

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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center text-neutral-400 py-8">
                  טוען...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-neutral-400 py-8">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
