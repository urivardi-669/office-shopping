import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getOpenCycleId } from "@/lib/cycle";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const body = await req.json();
  const productId = Number(body.productId);
  const finalQuantity = Math.max(0, Math.floor(Number(body.finalQuantity) || 0));
  if (!productId) return NextResponse.json({ error: "מוצר לא תקין" }, { status: 400 });

  const cycleId = await getOpenCycleId();
  await db
    .prepare(
      `INSERT INTO order_items (cycle_id, product_id, final_quantity)
       VALUES (?, ?, ?)
       ON CONFLICT(cycle_id, product_id) DO UPDATE SET final_quantity = excluded.final_quantity, updated_at = now()`
    )
    .run(cycleId, productId, finalQuantity);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const productId = Number(searchParams.get("productId"));
  if (!productId) return NextResponse.json({ error: "מוצר לא תקין" }, { status: 400 });

  const cycleId = await getOpenCycleId();

  // When nobody actually requested this product, just remove the row —
  // there's nothing worth keeping a placeholder for. But when employees did
  // request it, the order list falls back to showing their raw demand count
  // whenever there's no order_items row (see /api/order's merge logic) — so
  // deleting outright would make it silently reappear at the demand count,
  // looking exactly like the delete did nothing. Keep an explicit zeroed row
  // instead, so "excluded from this order" stays visible and sticks.
  const demand = (await db
    .prepare(`SELECT COUNT(*)::int AS cnt FROM request_items WHERE cycle_id = ? AND product_id = ?`)
    .get(cycleId, productId)) as { cnt: number };

  if (demand.cnt > 0) {
    await db
      .prepare(
        `INSERT INTO order_items (cycle_id, product_id, final_quantity)
         VALUES (?, ?, 0)
         ON CONFLICT(cycle_id, product_id) DO UPDATE SET final_quantity = 0, updated_at = now()`
      )
      .run(cycleId, productId);
  } else {
    await db.prepare(`DELETE FROM order_items WHERE cycle_id = ? AND product_id = ?`).run(cycleId, productId);
  }

  return NextResponse.json({ ok: true });
}
