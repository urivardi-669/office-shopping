"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";

type OrderDetailItem = {
  productId: number;
  productName: string;
  categoryName: string;
  imageUrl: string | null;
  unitLabel: string | null;
  finalQuantity: number;
  demand: number;
  requesters: string[];
};

type Order = { id: number; status: string; createdAt: string; closedAt: string | null };

export default function AdminOrderDetailPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderDetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/orders/${cycleId}`)
      .then(async (r) => {
        if (!r.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const d = await r.json();
        setOrder(d.order);
        setItems(d.items || []);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [cycleId]);

  const totalQuantity = items.reduce((s, it) => s + it.finalQuantity, 0);

  if (loading) return <div className="text-center text-neutral-400 py-16">טוען...</div>;
  if (notFound || !order) {
    return (
      <div className="space-y-4">
        <Link href="/admin/orders" className="text-sm text-violet-600 hover:text-violet-800">
          ← חזרה להזמנות קודמות
        </Link>
        <div className="text-center text-neutral-400 py-16">ההזמנה לא נמצאה</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-violet-600 hover:text-violet-800">
          ← חזרה להזמנות קודמות
        </Link>
        <h1 className="text-2xl font-bold text-neutral-800 mt-2">הזמנה #{order.id}</h1>
        <p className="text-sm text-neutral-500">
          הושלמה בתאריך {order.closedAt ? new Date(order.closedAt + "Z").toLocaleString("he-IL") : "-"} · כמות כוללת:{" "}
          <span className="font-semibold text-violet-700">{totalQuantity}</span>
        </p>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs">
            <tr>
              <th className="text-start px-4 py-2 font-medium">מוצר</th>
              <th className="text-start px-4 py-2 font-medium">קטגוריה</th>
              <th className="text-start px-4 py-2 font-medium">ביקוש</th>
              <th className="text-start px-4 py-2 font-medium">הזמנה סופית</th>
              <th className="text-start px-4 py-2 font-medium">מבקשים</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-neutral-400 py-8">
                  אין פריטים בהזמנה זו
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.productId} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-medium text-neutral-700">
                    <div className="flex items-center gap-2">
                      <ProductImage src={it.imageUrl} alt={it.productName} size={28} />
                      {it.productName}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{it.categoryName}</td>
                  <td className="px-4 py-2">{it.demand}</td>
                  <td className="px-4 py-2 font-medium">
                    {it.finalQuantity}
                    {it.unitLabel ? ` ${it.unitLabel}` : ""}
                  </td>
                  <td className="px-4 py-2 text-neutral-500 text-xs">
                    {it.requesters.length > 0 ? it.requesters.join(", ") : "-"}
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
