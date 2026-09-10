import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const categories = await db
    .prepare(`SELECT id, name FROM categories ORDER BY sort_order, id`)
    .all();
  return NextResponse.json({ categories });
}
