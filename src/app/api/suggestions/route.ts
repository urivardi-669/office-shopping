import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { getOpenCycleId } from "@/lib/cycle";
import { isExactMatch } from "@/lib/similarity";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");

  if (scope === "mine") {
    const rows = await db
      .prepare(
        `SELECT s.id, s.product_name AS "productName", s.status, s.requested_quantity AS "requestedQuantity",
                s.created_at AS "createdAt", s.rejection_reason AS "rejectionReason",
                c.name AS "categoryName", s.source, s.brand, s.image_url AS "imageUrl", s.unit_label AS "unitLabel"
         FROM suggestions s
         JOIN categories c ON c.id = s.category_id
         WHERE s.suggested_by = ?
         ORDER BY s.created_at DESC`
      )
      .all(session.name);
    return NextResponse.json({ suggestions: rows });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const rows = await db
    .prepare(
      `SELECT s.id, s.product_name AS "productName", s.status, s.requested_quantity AS "requestedQuantity",
              s.created_at AS "createdAt", s.suggested_by AS "suggestedBy", s.rejection_reason AS "rejectionReason",
              c.id AS "categoryId", c.name AS "categoryName",
              s.source, s.brand, s.image_url AS "imageUrl", s.sku, s.unit_label AS "unitLabel"
       FROM suggestions s
       JOIN categories c ON c.id = s.category_id
       ORDER BY (s.status = 'PENDING') DESC, s.created_at DESC`
    )
    .all();
  return NextResponse.json({ suggestions: rows });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await req.json();
  const name = String(body.name || "").trim();
  const categoryId = Number(body.categoryId);
  const quantity = Math.max(0, Math.floor(Number(body.quantity) || 0));
  const force = Boolean(body.force);

  // Optional Tiv Taam provenance, when this suggestion originated from a Tiv Taam search result.
  const source = body.source === "TIV_TAAM" ? "TIV_TAAM" : "MANUAL";
  const sourceProductId = typeof body.sourceProductId === "string" ? body.sourceProductId.trim() || null : null;
  const sku = typeof body.sku === "string" ? body.sku.trim() || null : null;
  const brand = typeof body.brand === "string" ? body.brand.trim() || null : null;
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null;
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() || null : null;
  const unitCode = typeof body.unitCode === "string" ? body.unitCode.trim() || null : null;
  const unitLabel = typeof body.unitLabel === "string" ? body.unitLabel.trim() || null : null;

  if (!name || !categoryId) {
    return NextResponse.json({ error: "יש למלא שם וקטגוריה" }, { status: 400 });
  }

  if (source === "TIV_TAAM" && sourceProductId) {
    const existingBySource = await db
      .prepare(`SELECT id FROM products WHERE source = 'TIV_TAAM' AND source_product_id = ? AND active = 1`)
      .get(sourceProductId);
    if (existingBySource) {
      return NextResponse.json(
        { error: "המוצר כבר קיים ברשימת המוצרים.", code: "DUPLICATE" },
        { status: 409 }
      );
    }
  }

  if (!force) {
    const activeProducts = (await db.prepare(`SELECT name FROM products WHERE active = 1`).all()) as {
      name: string;
    }[];
    const exactExists = activeProducts.some((p) => isExactMatch(p.name, name));
    if (exactExists) {
      return NextResponse.json({ error: "המוצר כבר קיים ברשימת המוצרים.", code: "DUPLICATE" }, { status: 409 });
    }
  }

  const cycleId = await getOpenCycleId();
  const info = await db
    .prepare(
      `INSERT INTO suggestions
        (product_name, category_id, suggested_by, requested_quantity, cycle_id,
         source, source_product_id, sku, brand, image_url, source_url, unit_code, unit_label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
    .run(
      name,
      categoryId,
      session.name,
      quantity,
      cycleId,
      source,
      sourceProductId,
      sku,
      brand,
      imageUrl,
      sourceUrl,
      unitCode,
      unitLabel
    );

  const suggestionId = info.lastInsertRowid as number;

  if (quantity > 0) {
    await db
      .prepare(
        `INSERT INTO request_items
          (cycle_id, user_name, suggestion_id, quantity, unit_code, unit_label, product_name_snapshot, sku_snapshot, image_url_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(cycleId, session.name, suggestionId, quantity, unitCode, unitLabel, name, sku, imageUrl);
  }

  return NextResponse.json({ ok: true, suggestionId });
}
