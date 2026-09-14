import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getOpenCycleId } from "@/lib/cycle";
import { getMergedOrderItems } from "@/lib/orderItems";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const cycleId = await getOpenCycleId();
  const items = await getMergedOrderItems(cycleId);

  const pendingSuggestions = await db
    .prepare(
      `SELECT s.id AS "suggestionId", s.product_name AS "productName", c.name AS "categoryName",
              s.requested_quantity AS "requestedQuantity", s.suggested_by AS "suggestedBy",
              s.image_url AS "imageUrl", s.brand, s.unit_label AS "unitLabel"
       FROM suggestions s
       JOIN categories c ON c.id = s.category_id
       WHERE s.status = 'PENDING' AND s.cycle_id = ?`
    )
    .all(cycleId);

  return NextResponse.json({ items, pendingSuggestions });
}
