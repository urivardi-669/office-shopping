import { db } from "@/lib/db";

export async function getOpenCycleId(): Promise<number> {
  const row = (await db.prepare(`SELECT id FROM cycles WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1`).get()) as
    | { id: number }
    | undefined;
  if (row) return row.id;
  const info = await db.prepare(`INSERT INTO cycles (status) VALUES ('OPEN') RETURNING id`).run();
  return info.lastInsertRowid as number;
}
