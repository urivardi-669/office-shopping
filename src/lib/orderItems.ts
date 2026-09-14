import { db } from "@/lib/db";

export type MergedOrderItem = {
  productId: number;
  productName: string;
  categoryName: string;
  demand: number;
  requesters: string[];
  finalQuantity: number;
  imageUrl: string | null;
  unitLabel: string | null;
};

/**
 * The builder's working list for a cycle: every product with employee demand
 * (defaulted to that demand until the admin overrides it) plus every product
 * the admin explicitly added/edited via order_items — minus anything marked
 * `excluded` (removed via "מחק"), which never resurfaces regardless of demand.
 */
export async function getMergedOrderItems(cycleId: number): Promise<MergedOrderItem[]> {
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
      `SELECT oi.product_id AS "productId", oi.final_quantity AS "finalQuantity", oi.excluded AS "excluded",
              p.name AS "productName", c.name AS "categoryName", p.image_url AS "imageUrl",
              (SELECT unit_label FROM product_units WHERE product_id = p.id AND is_default = 1 LIMIT 1) AS "unitLabel"
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN categories c ON c.id = p.category_id
       WHERE oi.cycle_id = ?`
    )
    .all(cycleId)) as {
    productId: number;
    finalQuantity: number;
    excluded: boolean;
    productName: string;
    categoryName: string;
    imageUrl: string | null;
    unitLabel: string | null;
  }[];

  const byProduct = new Map<number, MergedOrderItem>();

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

  const excludedProductIds = new Set<number>();

  for (const row of orderRows) {
    if (row.excluded) {
      excludedProductIds.add(row.productId);
      continue;
    }
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

  for (const id of excludedProductIds) {
    byProduct.delete(id);
  }

  return Array.from(byProduct.values()).sort((a, b) => a.categoryName.localeCompare(b.categoryName, "he"));
}
