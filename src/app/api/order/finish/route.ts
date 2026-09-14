import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getOpenCycleId } from "@/lib/cycle";
import { getMergedOrderItems } from "@/lib/orderItems";

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const cycleId = await getOpenCycleId();

  // Lock in exactly what the builder was showing: a product with demand the
  // admin never touched only exists as a display default (no order_items
  // row yet), and the finished-order view only reads order_items — so
  // without this, an untouched item would silently drop out of the real
  // order despite looking included in the builder right up to this click.
  const visibleItems = await getMergedOrderItems(cycleId);
  for (const item of visibleItems) {
    await db
      .prepare(
        `INSERT INTO order_items (cycle_id, product_id, final_quantity, excluded)
         VALUES (?, ?, ?, false)
         ON CONFLICT(cycle_id, product_id) DO UPDATE
           SET final_quantity = excluded.final_quantity, excluded = false, updated_at = now()`
      )
      .run(cycleId, item.productId, item.finalQuantity);
  }

  await db.prepare(`UPDATE cycles SET status = 'CLOSED', closed_at = now() WHERE id = ?`).run(cycleId);
  await db.prepare(`INSERT INTO cycles (status) VALUES ('OPEN')`).run();
  return NextResponse.json({ ok: true, orderId: cycleId });
}
