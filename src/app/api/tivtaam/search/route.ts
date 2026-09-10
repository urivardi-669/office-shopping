import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { tivTaamProductSource, TivTaamUnavailableError } from "@/lib/tivtaam/source";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") || "").trim();
  if (query.length < 2) return NextResponse.json({ results: [] });

  try {
    const results = await tivTaamProductSource.searchProducts(query);

    const sourceIds = results.map((r) => r.sourceProductId);
    const existingMap = new Map<string, number>();
    if (sourceIds.length > 0) {
      const placeholders = sourceIds.map(() => "?").join(",");
      const rows = (await db
        .prepare(
          `SELECT id, source_product_id AS sourceProductId FROM products
           WHERE source = 'TIV_TAAM' AND source_product_id IN (${placeholders})`
        )
        .all(...sourceIds)) as { id: number; sourceProductId: string }[];
      for (const row of rows) existingMap.set(row.sourceProductId, row.id);
    }

    const withOfficeMatch = results.map((r) => ({
      ...r,
      officeProductId: existingMap.get(r.sourceProductId) ?? null,
    }));

    return NextResponse.json({ results: withOfficeMatch });
  } catch (err) {
    if (err instanceof TivTaamUnavailableError) {
      return NextResponse.json({ error: "שירות טיב טעם אינו זמין כרגע. נסו שוב מאוחר יותר." }, { status: 503 });
    }
    return NextResponse.json({ error: "שגיאה בחיפוש מוצרים" }, { status: 500 });
  }
}
