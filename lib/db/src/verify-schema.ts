import { pool } from "./index";

const requiredColumns: Record<string, readonly string[]> = {
  staff_users: ["id", "email", "role", "password_hash"],
  sync_aids: ["id", "created_by_id", "version", "archived_at"],
  sync_complaints: ["id", "created_by_id", "version", "archived_at"],
  sync_people: ["id", "created_by_id", "version", "archived_at"],
  sync_tasks: ["id", "created_by_id", "version", "archived_at", "result", "submitted_at", "approved_by_id", "approved_at"],
  camps: ["id", "name", "active"],
  camp_sectors: ["id", "camp_id", "name"],
  shelter_units: ["id", "sector_id", "code", "capacity", "status", "version", "archived_at"],
  families: ["id", "camp_id", "sector_id", "shelter_id", "delegate_id", "status", "version"],
  family_members: ["id", "family_id", "full_name", "critical_case"],
  family_assignment_history: ["id", "family_id", "changed_by_id"],
  family_needs: ["id", "family_id", "category", "status", "priority", "version"],
  need_status_history: ["id", "need_id", "to_status", "changed_by_id"],
  login_rate_limit_counters: ["key", "failures", "blocked_until", "last_attempt_at", "expires_at"],
  aid_distributions: ["id", "aid_id", "need_id", "family_id", "quantity", "status", "executed_by_id", "delivered_at"],
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

  const { rows: managerInvariantRows } = await pool.query<{
    active_privileged_count: string;
    index_present: boolean;
  }>(
    `SELECT
       (
         SELECT count(*)::text
         FROM staff_users
         WHERE active = true AND role IN ('ADMIN', 'MANAGER')
       ) AS active_privileged_count,
       EXISTS (
         SELECT 1
         FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'staff_users'
           AND indexname = 'staff_users_single_active_manager'
       ) AS index_present`,
  );
  const managerInvariant = managerInvariantRows[0];
  if (!managerInvariant?.index_present || Number(managerInvariant.active_privileged_count) > 1) {
    throw new Error(
      "Database manager isolation is not ready. Apply drizzle/0003_single_active_manager.sql before starting the API.",
    );
  }

  console.log("Database schema verified");
}

verifySchema().finally(() => pool.end());
