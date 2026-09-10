import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const includeInactive = searchParams.get("all") === "1" && session?.role === "admin";

  let sql = `
    SELECT p.id, p.name, p.active, p.category_id AS categoryId, c.name AS categoryName,
           p.source, p.brand, p.image_url AS imageUrl, p.sku, p.source_url AS sourceUrl
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (!includeInactive) {
    sql += ` AND p.active = 1`;
  }
  if (category) {
    sql += ` AND c.id = ?`;
    params.push(Number(category));
  }
  if (search) {
    sql += ` AND p.name LIKE ?`;
    params.push(`%${search}%`);
  }
  sql += ` ORDER BY c.sort_order, p.name`;

  const products = (await db.prepare(sql).all(...params)) as { id: number }[];

  if (products.length > 0) {
    const ids = products.map((p) => p.id);
    const placeholders = ids.map(() => "?").join(",");
    const units = (await db
      .prepare(
        `SELECT product_id AS productId, unit_code AS unitCode, unit_label AS unitLabel,
                package_size AS packageSize, package_size_unit AS packageSizeUnit, is_default AS isDefault
         FROM product_units WHERE active = 1 AND product_id IN (${placeholders})
         ORDER BY is_default DESC, id`
      )
      .all(...ids)) as { productId: number }[];
    const byProduct = new Map<number, unknown[]>();
    for (const u of units) {
      if (!byProduct.has(u.productId)) byProduct.set(u.productId, []);
      byProduct.get(u.productId)!.push(u);
    }
    for (const p of products as (typeof products[number] & { units?: unknown[] })[]) {
      p.units = byProduct.get(p.id) || [];
    }
  }

  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const body = await req.json();
  const name = String(body.name || "").trim();
  const categoryId = Number(body.categoryId);
  if (!name || !categoryId) {
    return NextResponse.json({ error: "יש למלא שם וקטגוריה" }, { status: 400 });
  }
  const info = await db
    .prepare(`INSERT INTO products (name, category_id, active) VALUES (?, ?, 1) RETURNING id`)
    .run(name, categoryId);
  const product = await db
    .prepare(
      `SELECT p.id, p.name, p.active, p.category_id AS categoryId, c.name AS categoryName
       FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`
    )
    .get(info.lastInsertRowid);
  return NextResponse.json({ product });
}
