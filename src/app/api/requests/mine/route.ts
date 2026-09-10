import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const items = await db
    .prepare(
      `SELECT ri.id, ri.quantity, ri.created_at AS "createdAt", ri.cycle_id AS "cycleId",
              COALESCE(ri.product_name_snapshot, p.name) AS "productName", c.name AS "categoryName", cy.status AS "cycleStatus",
              ri.unit_label AS "unitLabel", ri.image_url_snapshot AS "imageUrlSnapshot"
       FROM request_items ri
       JOIN products p ON p.id = ri.product_id
       JOIN categories c ON c.id = p.category_id
       JOIN cycles cy ON cy.id = ri.cycle_id
       WHERE ri.user_name = ? AND ri.product_id IS NOT NULL
       ORDER BY ri.created_at DESC`
    )
    .all(session.name);

  return NextResponse.json({ items });
}
