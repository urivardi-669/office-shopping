import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const orders = await db
    .prepare(
      `SELECT cy.id AS "orderId", cy.closed_at AS "closedAt", cy.created_at AS "createdAt",
              COUNT(DISTINCT oi.product_id)::int AS "itemCount",
              COALESCE(SUM(oi.final_quantity), 0)::int AS "totalQuantity"
       FROM cycles cy
       LEFT JOIN order_items oi ON oi.cycle_id = cy.id AND oi.final_quantity > 0
       WHERE cy.status = 'CLOSED'
       GROUP BY cy.id
       ORDER BY cy.closed_at DESC`
    )
    .all();

  return NextResponse.json({ orders });
}
