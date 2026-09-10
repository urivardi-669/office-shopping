import { NextRequest, NextResponse } from "next/server";
import { db, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import type { TivTaamProduct } from "@/lib/tivtaam/types";

function isValidTivTaamProduct(v: unknown): v is TivTaamProduct {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.sourceProductId === "string" &&
    p.sourceProductId.trim().length > 0 &&
    /^\d+$/.test(p.sourceProductId) &&
    typeof p.name === "string" &&
    p.name.trim().length > 0 &&
    Array.isArray(p.units)
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const categoryId = Number(body?.categoryId);
  const tivTaamProduct = body?.tivTaamProduct;

  if (!categoryId || !isValidTivTaamProduct(tivTaamProduct)) {
    return NextResponse.json({ error: "נתוני מוצר לא תקינים" }, { status: 400 });
  }

  const category = await db.prepare(`SELECT id FROM categories WHERE id = ?`).get(categoryId);
  if (!category) return NextResponse.json({ error: "קטגוריה לא נמצאה" }, { status: 400 });

  const existing = (await db
    .prepare(
      `SELECT p.id, p.name, p.category_id AS categoryId, c.name AS categoryName
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.source = 'TIV_TAAM' AND p.source_product_id = ?`
    )
    .get(tivTaamProduct.sourceProductId)) as
    | { id: number; name: string; categoryId: number; categoryName: string }
    | undefined;

  if (existing) {
    return NextResponse.json({ created: false, existing: true, product: existing });
  }

  const productId = await withTransaction(async (tx) => {
    const info = await tx
      .prepare(
        `INSERT INTO products
          (name, category_id, active, source, source_product_id, sku, brand, image_url,
           source_url, source_category, source_subcategory, source_availability, last_synced_at)
         VALUES (?, ?, 1, 'TIV_TAAM', ?, ?, ?, ?, ?, ?, ?, ?, now())
         RETURNING id`
      )
      .run(
        tivTaamProduct.name.trim(),
        categoryId,
        tivTaamProduct.sourceProductId,
        tivTaamProduct.sku ?? null,
        tivTaamProduct.brand ?? null,
        tivTaamProduct.imageUrl ?? null,
        tivTaamProduct.sourceUrl ?? null,
        tivTaamProduct.sourceCategory ?? null,
        tivTaamProduct.sourceSubcategory ?? null,
        tivTaamProduct.sourceAvailability ?? null
      );
    const newProductId = info.lastInsertRowid as number;

    for (const unit of tivTaamProduct.units) {
      await tx
        .prepare(
          `INSERT INTO product_units (product_id, unit_code, unit_label, package_size, package_size_unit, is_default, active)
           VALUES (?, ?, ?, ?, ?, ?, 1)`
        )
        .run(
          newProductId,
          unit.unitCode,
          unit.unitLabel,
          unit.packageSize ?? null,
          unit.packageSizeUnit ?? null,
          unit.isDefault ? 1 : 0
        );
    }
    return newProductId;
  });

  const product = await db
    .prepare(
      `SELECT p.id, p.name, p.category_id AS categoryId, c.name AS categoryName
       FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`
    )
    .get(productId);

  return NextResponse.json({ created: true, existing: false, product });
}
