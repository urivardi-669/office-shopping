import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cycleId: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { cycleId: cycleIdParam } = await params;
  const cycleId = Number(cycleIdParam);

  const cycle = (await db
    .prepare(`SELECT id, status, created_at AS createdAt, closed_at AS closedAt FROM cycles WHERE id = ?`)
    .get(cycleId)) as { id: number; status: string; createdAt: string; closedAt: string | null } | undefined;

  if (!cycle || cycle.status !== "CLOSED") {
    return NextResponse.json({ error: "הזמנה לא נמצאה" }, { status: 404 });
  }

  const demandRows = (await db
    .prepare(
      `SELECT p.id AS productId, SUM(ri.quantity)::int AS demand,
              STRING_AGG(DISTINCT ri.user_name, ',') AS requesters
       FROM request_items ri
       JOIN products p ON p.id = ri.product_id
       WHERE ri.cycle_id = ? AND ri.product_id IS NOT NULL
       GROUP BY p.id`
    )
    .all(cycleId)) as { productId: number; demand: number; requesters: string }[];
  const demandByProduct = new Map(demandRows.map((r) => [r.productId, r]));

  const items = (await db
    .prepare(
      `SELECT oi.product_id AS productId, oi.final_quantity AS finalQuantity,
              p.name AS productName, c.name AS categoryName, p.image_url AS imageUrl,
              (SELECT unit_label FROM product_units WHERE product_id = p.id AND is_default = 1 LIMIT 1) AS unitLabel
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN categories c ON c.id = p.category_id
       WHERE oi.cycle_id = ? AND oi.final_quantity > 0
       ORDER BY c.sort_order, p.name`
    )
    .all(cycleId)) as {
    productId: number;
    finalQuantity: number;
    productName: string;
    categoryName: string;
    imageUrl: string | null;
    unitLabel: string | null;
  }[];

  const enriched = items.map((it) => {
    const demand = demandByProduct.get(it.productId);
    return {
      ...it,
      demand: demand?.demand ?? 0,
      requesters: demand?.requesters ? demand.requesters.split(",") : [],
    };
  });

  return NextResponse.json({ order: cycle, items: enriched });
}
