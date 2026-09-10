import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getOpenCycleId } from "@/lib/cycle";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const cycleId = await getOpenCycleId();

  const demandRows = (await db
    .prepare(
      `SELECT p.id AS "productId", p.name AS "productName", c.name AS "categoryName", p.image_url AS "imageUrl",
              SUM(ri.quantity)::int AS demand,
              STRING_AGG(DISTINCT ri.user_name, ',') AS requesters,
              (SELECT unit_label FROM product_units WHERE product_id = p.id AND is_default = 1 LIMIT 1) AS "unitLabel"
       FROM request_items ri
       JOIN products p ON p.id = ri.product_id
       JOIN categories c ON c.id = p.category_id
       WHERE ri.cycle_id = ? AND ri.product_id IS NOT NULL
       GROUP BY p.id, p.name, c.name, p.image_url`
    )
    .all(cycleId)) as {
    productId: number;
    productName: string;
    categoryName: string;
    imageUrl: string | null;
    demand: number;
    requesters: string;
    unitLabel: string | null;
  }[];

  const orderRows = (await db
    .prepare(
      `SELECT oi.product_id AS "productId", oi.final_quantity AS "finalQuantity", p.name AS "productName", c.name AS "categoryName",
              p.image_url AS "imageUrl",
              (SELECT unit_label FROM product_units WHERE product_id = p.id AND is_default = 1 LIMIT 1) AS "unitLabel"
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN categories c ON c.id = p.category_id
       WHERE oi.cycle_id = ?`
    )
    .all(cycleId)) as {
    productId: number;
    finalQuantity: number;
    productName: string;
    categoryName: string;
    imageUrl: string | null;
    unitLabel: string | null;
  }[];

  const byProduct = new Map<
    number,
    {
      productId: number;
      productName: string;
      categoryName: string;
      demand: number;
      requesters: string[];
      finalQuantity: number;
      imageUrl: string | null;
      unitLabel: string | null;
    }
  >();

  for (const row of demandRows) {
    byProduct.set(row.productId, {
      productId: row.productId,
      productName: row.productName,
      categoryName: row.categoryName,
      demand: row.demand,
      requesters: row.requesters ? row.requesters.split(",") : [],
      finalQuantity: row.demand,
      imageUrl: row.imageUrl,
      unitLabel: row.unitLabel,
    });
  }

  for (const row of orderRows) {
    const existing = byProduct.get(row.productId);
    if (existing) {
      existing.finalQuantity = row.finalQuantity;
    } else {
      byProduct.set(row.productId, {
        productId: row.productId,
        productName: row.productName,
        categoryName: row.categoryName,
        demand: 0,
        requesters: [],
        finalQuantity: row.finalQuantity,
        imageUrl: row.imageUrl,
        unitLabel: row.unitLabel,
      });
    }
  }

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

  return NextResponse.json({
    items: Array.from(byProduct.values()).sort((a, b) => a.categoryName.localeCompare(b.categoryName, "he")),
    pendingSuggestions,
  });
}
