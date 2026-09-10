import { Pool, PoolClient } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function createPool(): Pool {
  // Deliberately does not throw when unset: this module is imported (and this
  // function runs) during `next build`'s page-data collection, before Vercel
  // env vars are necessarily available. `pg.Pool` doesn't actually open a
  // connection until the first `.query()`/`.connect()` call, so a missing
  // connection string only surfaces as an error at that point (a real request
  // at runtime), never at build/import time.
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  return new Pool({
    connectionString,
    ssl: !connectionString || /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false },
  });
}

const pool = global.__pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") global.__pgPool = pool;

// Translates the SQLite-style `?` placeholders used throughout the app's SQL
// into Postgres-style `$1, $2, ...` positional parameters.
function toPgSql(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

type QueryExecutor = Pick<Pool | PoolClient, "query">;

function makeDb(executor: QueryExecutor) {
  return {
    prepare(sql: string) {
      const pgSql = toPgSql(sql);
      return {
        async all(...params: unknown[]) {
          await ensureInit();
          const res = await executor.query(pgSql, params);
          return res.rows;
        },
        async get(...params: unknown[]) {
          await ensureInit();
          const res = await executor.query(pgSql, params);
          return res.rows[0];
        },
        async run(...params: unknown[]) {
          await ensureInit();
          const res = await executor.query(pgSql, params);
          return { changes: res.rowCount ?? 0, lastInsertRowid: res.rows[0]?.id };
        },
      };
    },
    async exec(sql: string) {
      await ensureInit();
      await executor.query(sql);
    },
  };
}

export type Db = ReturnType<typeof makeDb>;

export const db = makeDb(pool);

/** Runs `fn` inside a single Postgres transaction (BEGIN/COMMIT/ROLLBACK). */
export async function withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  await ensureInit();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(makeDb(client));
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function addColumnIfMissing(table: string, column: string, definition: string) {
  const res = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  if (res.rowCount === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function runInit() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('admin','user')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS cycles (
      id SERIAL PRIMARY KEY,
      status TEXT NOT NULL CHECK(status IN ('OPEN','CLOSED')) DEFAULT 'OPEN',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      closed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      product_name TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      suggested_by TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING','APPROVED','REJECTED')) DEFAULT 'PENDING',
      requested_quantity INTEGER NOT NULL DEFAULT 0,
      cycle_id INTEGER NOT NULL REFERENCES cycles(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      rejection_reason TEXT,
      resulting_product_id INTEGER REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS request_items (
      id SERIAL PRIMARY KEY,
      cycle_id INTEGER NOT NULL REFERENCES cycles(id),
      user_name TEXT NOT NULL,
      product_id INTEGER REFERENCES products(id),
      suggestion_id INTEGER REFERENCES suggestions(id),
      quantity INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      cycle_id INTEGER NOT NULL REFERENCES cycles(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      final_quantity INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(cycle_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS product_units (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      unit_code TEXT NOT NULL,
      unit_label TEXT NOT NULL,
      package_size REAL,
      package_size_unit TEXT,
      is_default INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(product_id, unit_code)
    );
  `);

  // --- Additive migrations (idempotent: guarded by information_schema checks) ---
  await addColumnIfMissing("products", "source", `TEXT NOT NULL DEFAULT 'MANUAL'`);
  await addColumnIfMissing("products", "source_product_id", `TEXT`);
  await addColumnIfMissing("products", "sku", `TEXT`);
  await addColumnIfMissing("products", "brand", `TEXT`);
  await addColumnIfMissing("products", "image_url", `TEXT`);
  await addColumnIfMissing("products", "source_url", `TEXT`);
  await addColumnIfMissing("products", "source_category", `TEXT`);
  await addColumnIfMissing("products", "source_subcategory", `TEXT`);
  await addColumnIfMissing("products", "source_availability", `TEXT`);
  await addColumnIfMissing("products", "last_synced_at", `TIMESTAMPTZ`);

  await addColumnIfMissing("suggestions", "source", `TEXT NOT NULL DEFAULT 'MANUAL'`);
  await addColumnIfMissing("suggestions", "source_product_id", `TEXT`);
  await addColumnIfMissing("suggestions", "sku", `TEXT`);
  await addColumnIfMissing("suggestions", "brand", `TEXT`);
  await addColumnIfMissing("suggestions", "image_url", `TEXT`);
  await addColumnIfMissing("suggestions", "source_url", `TEXT`);
  await addColumnIfMissing("suggestions", "unit_code", `TEXT`);
  await addColumnIfMissing("suggestions", "unit_label", `TEXT`);

  await addColumnIfMissing("request_items", "unit_code", `TEXT`);
  await addColumnIfMissing("request_items", "unit_label", `TEXT`);
  await addColumnIfMissing("request_items", "product_name_snapshot", `TEXT`);
  await addColumnIfMissing("request_items", "sku_snapshot", `TEXT`);
  await addColumnIfMissing("request_items", "image_url_snapshot", `TEXT`);

  await addColumnIfMissing("order_items", "unit_code", `TEXT`);
  await addColumnIfMissing("order_items", "unit_label", `TEXT`);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_source_id
    ON products(source, source_product_id)
    WHERE source_product_id IS NOT NULL;
  `);

  const cycleCount = await pool.query(`SELECT COUNT(*) AS c FROM cycles`);
  if (Number(cycleCount.rows[0].c) === 0) {
    await pool.query(`INSERT INTO cycles (status) VALUES ('OPEN')`);
  }

  const catCount = await pool.query(`SELECT COUNT(*) AS c FROM categories`);
  if (Number(catCount.rows[0].c) === 0) {
    const seed: Record<string, string[]> = {
      "מוצרי חלב": ["חלב 3%", "חלב ללא לקטוז", "גבינה צהובה", "גבינה לבנה", "קוטג'", "יוגורט", "חמאה"],
      "פירות וירקות": ["תפוחים", "בננות", "תפוזים", "עגבניות", "מלפפונים", "גזר", "פלפלים"],
      "שתיה קלה": ["מים", "סודה", "קולה", "קולה זירו", "ספרייט", "מיץ תפוזים"],
      "שונות": ["קפה", "תה", "סוכר", "כוסות חד פעמיות", "צלחות חד פעמיות", "נייר סופג", "מגבונים"],
    };
    let order = 0;
    for (const [catName, products] of Object.entries(seed)) {
      const catRes = await pool.query(`INSERT INTO categories (name, sort_order) VALUES ($1, $2) RETURNING id`, [
        catName,
        order++,
      ]);
      const catId = catRes.rows[0].id;
      for (const p of products) {
        await pool.query(`INSERT INTO products (name, category_id) VALUES ($1, $2)`, [p, catId]);
      }
    }
  }
}

let initPromise: Promise<void> | null = null;
export function ensureInit(): Promise<void> {
  if (!initPromise) initPromise = runInit();
  return initPromise;
}
