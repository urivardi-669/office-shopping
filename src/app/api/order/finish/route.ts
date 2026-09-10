import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getOpenCycleId } from "@/lib/cycle";

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const cycleId = await getOpenCycleId();
  await db.prepare(`UPDATE cycles SET status = 'CLOSED', closed_at = now() WHERE id = ?`).run(cycleId);
  await db.prepare(`INSERT INTO cycles (status) VALUES ('OPEN')`).run();
  return NextResponse.json({ ok: true, orderId: cycleId });
}
