import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isExactMatch, isSimilar } from "@/lib/similarity";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") || "").trim();
  if (!name) return NextResponse.json({ exact: false, similar: [] });

  const products = (await db.prepare(`SELECT name FROM products WHERE active = 1`).all()) as { name: string }[];
  const pendingSuggestions = (await db
    .prepare(`SELECT product_name AS name FROM suggestions WHERE status = 'PENDING'`)
    .all()) as { name: string }[];

  const all = [...products, ...pendingSuggestions];

  const exact = all.some((p) => isExactMatch(p.name, name));
  const similar = all.filter((p) => !isExactMatch(p.name, name) && isSimilar(p.name, name)).map((p) => p.name);

  return NextResponse.json({ exact, similar: Array.from(new Set(similar)) });
}
