import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getOpenCycleId } from "@/lib/cycle";

type IncomingItem = { productId: number; quantity: number; unitCode?: string };

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await req.json();
  const items: IncomingItem[] = Array.isArray(body.items) ? body.items : [];
  const valid = items.filter((i) => Number(i.quantity) > 0 && Number(i.productId) > 0);

  if (valid.length === 0) {
    return NextResponse.json({ error: "לא נבחרו מוצרים" }, { status: 400 });
  }

  const cycleId = await getOpenCycleId();

  await withTransaction(async (tx) => {
    for (const row of valid) {
      const product = (await tx
        .prepare(`SELECT p.name, p.sku, p.image_url AS "imageUrl" FROM products p WHERE p.id = ?`)
        .get(row.productId)) as { name: string; sku: string | null; imageUrl: string | null } | undefined;
      if (!product) continue;

      const unit = row.unitCode
        ? ((await tx
            .prepare(
              `SELECT unit_code AS "unitCode", unit_label AS "unitLabel" FROM product_units
               WHERE product_id = ? AND unit_code = ? AND active = 1`
            )
            .get(row.productId, row.unitCode)) as { unitCode: string; unitLabel: string } | undefined)
        : undefined;

      await tx
        .prepare(
          `INSERT INTO request_items
            (cycle_id, user_name, product_id, quantity, unit_code, unit_label,
             product_name_snapshot, sku_snapshot, image_url_snapshot)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          cycleId,
          session.name,
          row.productId,
          Math.floor(Number(row.quantity)),
          unit?.unitCode ?? null,
          unit?.unitLabel ?? null,
          product.name,
          product.sku,
          product.imageUrl
        );
    }
  });

  return NextResponse.json({ ok: true, count: valid.length });
}
