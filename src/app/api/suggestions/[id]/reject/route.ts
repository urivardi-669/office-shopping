import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const { id } = await params;
  const suggestionId = Number(id);
  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim() : null;
  const removeFromOrder = Boolean(body.removeFromOrder);

  const suggestion = (await db.prepare(`SELECT * FROM suggestions WHERE id = ?`).get(suggestionId)) as
    | { id: number; status: string }
    | undefined;
  if (!suggestion) return NextResponse.json({ error: "הצעה לא נמצאה" }, { status: 404 });
  if (suggestion.status !== "PENDING") {
    return NextResponse.json({ error: "ההצעה כבר טופלה" }, { status: 400 });
  }

  await db
    .prepare(
      `UPDATE suggestions SET status = 'REJECTED', reviewed_by = ?, reviewed_at = now(), rejection_reason = ?
       WHERE id = ?`
    )
    .run(session.name, reason, suggestionId);

  if (removeFromOrder) {
    await db.prepare(`DELETE FROM request_items WHERE suggestion_id = ?`).run(suggestionId);
  }

  return NextResponse.json({ ok: true });
}
