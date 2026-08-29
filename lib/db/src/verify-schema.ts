import { pool } from "./index";

const requiredColumns: Record<string, readonly string[]> = {
  staff_users: ["id", "email", "role", "password_hash"],
  sync_aids: ["id", "created_by_id", "version", "archived_at"],
  sync_complaints: ["id", "created_by_id", "version", "archived_at"],
  sync_people: ["id", "created_by_id", "version", "archived_at"],
  sync_tasks: ["id", "created_by_id", "version", "archived_at"],
};

async function verifySchema() {
  const tableNames = Object.keys(requiredColumns);
  const { rows } = await pool.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [tableNames],
  );

  const available = new Map<string, Set<string>>();
  for (const row of rows) {
    const columns = available.get(row.table_name) ?? new Set<string>();
    columns.add(row.column_name);
    available.set(row.table_name, columns);
  }

  const missing = Object.entries(requiredColumns).flatMap(([table, columns]) =>
    columns
      .filter((column) => !available.get(table)?.has(column))
      .map((column) => `${table}.${column}`),
  );

  if (missing.length > 0) {
    throw new Error(
      `Database schema is not ready. Missing: ${missing.join(
        ", ",
      )}. Apply a reviewed, data-preserving schema migration before starting the API.`,
    );
  }

  console.log("Database schema verified");
}

verifySchema().finally(() => pool.end());