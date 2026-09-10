import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const { id } = await params;
  const productId = Number(id);
  const body = await req.json();

  const existing = await db.prepare(`SELECT id FROM products WHERE id = ?`).get(productId);
  if (!existing) {
    return NextResponse.json({ error: "מוצר לא נמצא" }, { status: 404 });
  }

  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (typeof body.name === "string" && body.name.trim()) {
    fields.push("name = ?");
    values.push(body.name.trim());
  }
  if (body.categoryId !== undefined) {
    fields.push("category_id = ?");
    values.push(Number(body.categoryId));
  }
  if (typeof body.active === "boolean") {
    fields.push("active = ?");
    values.push(body.active ? 1 : 0);
  }

  if (fields.length > 0) {
    values.push(productId);
    await db.prepare(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  const product = await db
    .prepare(
      `SELECT p.id, p.name, p.active, p.category_id AS "categoryId", c.name AS "categoryName"
       FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`
    )
    .get(productId);
  return NextResponse.json({ product });
}
