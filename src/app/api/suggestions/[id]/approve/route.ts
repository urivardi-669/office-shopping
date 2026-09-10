import { NextRequest, NextResponse } from "next/server";
import { db, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const { id } = await params;
  const suggestionId = Number(id);
  const body = await req.json().catch(() => ({}));
  const addToOrder = body.addToOrder !== false;

  const suggestion = (await db.prepare(`SELECT * FROM suggestions WHERE id = ?`).get(suggestionId)) as
    | {
        id: number;
        product_name: string;
        category_id: number;
        status: string;
        requested_quantity: number;
        cycle_id: number;
        source: string;
        source_product_id: string | null;
        sku: string | null;
        brand: string | null;
        image_url: string | null;
        source_url: string | null;
        unit_code: string | null;
        unit_label: string | null;
      }
    | undefined;

  if (!suggestion) return NextResponse.json({ error: "הצעה לא נמצאה" }, { status: 404 });
  if (suggestion.status !== "PENDING") {
    return NextResponse.json({ error: "ההצעה כבר טופלה" }, { status: 400 });
  }

  const productId = await withTransaction(async (tx) => {
    let resolvedProductId: number;

    const existingBySource =
      suggestion.source === "TIV_TAAM" && suggestion.source_product_id
        ? ((await tx
            .prepare(`SELECT id FROM products WHERE source = 'TIV_TAAM' AND source_product_id = ?`)
            .get(suggestion.source_product_id)) as { id: number } | undefined)
        : undefined;

    if (existingBySource) {
      resolvedProductId = existingBySource.id;
    } else {
      const productInfo = await tx
        .prepare(
          `INSERT INTO products (name, category_id, active, source, source_product_id, sku, brand, image_url, source_url)
           VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
           RETURNING id`
        )
        .run(
          suggestion.product_name,
          suggestion.category_id,
          suggestion.source,
          suggestion.source_product_id,
          suggestion.sku,
          suggestion.brand,
          suggestion.image_url,
          suggestion.source_url
        );
      resolvedProductId = productInfo.lastInsertRowid as number;

      if (suggestion.unit_code && suggestion.unit_label) {
        await tx
          .prepare(
            `INSERT INTO product_units (product_id, unit_code, unit_label, is_default, active)
             VALUES (?, ?, ?, 1, 1)`
          )
          .run(resolvedProductId, suggestion.unit_code, suggestion.unit_label);
      }
    }

    await tx
      .prepare(
        `UPDATE suggestions SET status = 'APPROVED', reviewed_by = ?, reviewed_at = now(), resulting_product_id = ?
         WHERE id = ?`
      )
      .run(session.name, resolvedProductId, suggestionId);

    // Link any request_items that referenced this suggestion to the new (or matched) product.
    await tx
      .prepare(`UPDATE request_items SET product_id = ? WHERE suggestion_id = ?`)
      .run(resolvedProductId, suggestionId);

    if (addToOrder && suggestion.requested_quantity > 0) {
      await tx
        .prepare(
          `INSERT INTO order_items (cycle_id, product_id, final_quantity)
           VALUES (?, ?, ?)
           ON CONFLICT(cycle_id, product_id) DO UPDATE SET final_quantity = order_items.final_quantity + excluded.final_quantity, updated_at = now()`
        )
        .run(suggestion.cycle_id, resolvedProductId, suggestion.requested_quantity);
    }

    return resolvedProductId;
  });

  return NextResponse.json({ ok: true, productId });
}
