import { NextRequest, NextResponse } from "next/server";
import { db, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const productIds: number[] = Array.isArray(body.productIds) ? body.productIds.map(Number).filter(Boolean) : [];

  if (productIds.length === 0) {
    return NextResponse.json({ error: "לא נבחרו מוצרים" }, { status: 400 });
  }

  const removed: { id: number; name: string }[] = [];
  const blocked: { id: number; name: string; reason: string }[] = [];

  for (const id of productIds) {
    const product = (await db.prepare(`SELECT id, name FROM products WHERE id = ?`).get(id)) as
      | { id: number; name: string }
      | undefined;
    if (!product) continue;

    try {
      await withTransaction(async (tx) => {
        await tx.prepare(`DELETE FROM product_units WHERE product_id = ?`).run(id);
        await tx.prepare(`DELETE FROM products WHERE id = ?`).run(id);
      });
      removed.push(product);
    } catch {
      blocked.push({
        id,
        name: product.name,
        reason: "למוצר יש היסטוריית בקשות/הזמנות. ניתן להשבית אותו במקום.",
      });
    }
  }

  return NextResponse.json({ removed, blocked });
}
