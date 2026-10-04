import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, describe, test } from "node:test";
import type { Server } from "node:http";

// Run explicitly with test:family-import-postgres. Never reuse a production
// connection or let an absent test table resolve to a populated public table.
describe("family import concurrency on isolated PostgreSQL tables", {
  skip: process.env.FAMILY_IMPORT_POSTGRES_TEST !== "1",
}, () => {
  const schema = `family_import_test_${randomUUID().replaceAll("-", "")}`;
  const tables = [
    "staff_users", "staff_sessions", "camps", "camp_sectors", "shelter_units",
    "families", "family_members", "idempotency_keys", "sync_audit_events",
  ];
  const previousOptions = process.env.PGOPTIONS;
  const previousNodeEnv = process.env.NODE_ENV;
  let database: typeof import("@workspace/db");
  let server: Server | undefined;
  let schemaCreated = false;
  let baseUrl: string;
  const actorId = randomUUID();
  const campId = randomUUID();
  const sectorId = randomUUID();
  const token = `synthetic-${randomUUID()}`;
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  before(async () => {
    assert.notEqual(process.env.NODE_ENV, "production", "Development database only");
    assert.notEqual(process.env.REPLIT_DEPLOYMENT, "1", "Never run inside a deployment");
    // Set before importing @workspace/db so EVERY connection, including new
    // transaction connections, has an isolated search_path and application_name.
    process.env.PGOPTIONS = `-c search_path=${schema} -c application_name=${schema} -c statement_timeout=15000`;
    process.env.NODE_ENV = "test"; // The real app must not run its development seed.
    database = await import("@workspace/db");
    const { pool, db, staffUsers, sessions, campsTable, campSectorsTable } = database;
    const settings = await pool.query("SELECT current_setting('search_path') AS path");
    assert.equal(settings.rows[0].path, schema);
    await pool.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    // Copy schema definitions/indexes only, never SELECT or copy family data.
    for (const table of tables) {
      await pool.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    }
    // LIKE chooses a new name for expression indexes. Preserve the name used
    // by the production route's unique-violation -> public 409 mapping.
    const indexes = await pool.query(
      `SELECT index_class.relname AS name
       FROM pg_index i
       JOIN pg_class index_class ON index_class.oid = i.indexrelid
       JOIN pg_class table_class ON table_class.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = table_class.relnamespace
       WHERE n.nspname = $1 AND table_class.relname = 'family_members'
         AND i.indisunique AND i.indexprs IS NOT NULL`,
      [schema],
    );
    assert.equal(indexes.rowCount, 1, "The real national-ID unique index must exist");
    const indexName = indexes.rows[0].name as string;
    assert.match(indexName, /^[a-z_][a-z0-9_]*$/);
    await pool.query(`ALTER INDEX "${schema}"."${indexName}" RENAME TO family_members_national_id_normalized_unique`);
    // LIKE does not copy foreign keys; restore them inside the isolated schema.
    const foreignKeys = await pool.query(
      `SELECT c.relname AS table_name, con.conname AS name,
              pg_get_constraintdef(con.oid) AS definition
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND con.contype = 'f' AND c.relname = ANY($1::text[])`,
      [tables],
    );
    for (const foreignKey of foreignKeys.rows) {
      // Legacy-user references are nullable and unused by these staff routes.
      if (!tables.some((table) => foreignKey.definition.includes(`REFERENCES public.${table}(`))) continue;
      assert.match(foreignKey.name, /^[a-z_][a-z0-9_]*$/);
      const definition = (foreignKey.definition as string).replaceAll("REFERENCES public.", `REFERENCES "${schema}".`);
      await pool.query(`ALTER TABLE "${schema}"."${foreignKey.table_name}" ADD CONSTRAINT "${foreignKey.name}" ${definition}`);
    }
    const { hashToken } = await import("./middlewares/auth");
    await db.insert(staffUsers).values({
      id: actorId, email: `${actorId}@example.invalid`, name: "Synthetic concurrency manager",
      passwordHash: "not-a-login-password", role: "MANAGER",
    });
    await db.insert(sessions).values({
      userId: actorId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 120_000),
    });
    await db.insert(campsTable).values({ id: campId, name: "Synthetic concurrency camp" });
    await db.insert(campSectorsTable).values({ id: sectorId, campId, name: "Synthetic sector" });
    const { default: app } = await import("./app");
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      server!.once("listening", resolve);
      server!.once("error", reject);
    });
    const address = server.address();
    assert(address && typeof address === "object");
    baseUrl = `http://127.0.0.1:${address.port}/api/sync`;
  });

  after(async () => {
    try {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server!.close((error) => error ? reject(error) : resolve());
          server!.closeIdleConnections();
        });
      }
    } finally {
      try {
        if (schemaCreated) {
          // Only this randomly named, allowlisted synthetic schema is removed.
          assert.match(schema, /^family_import_test_[a-f0-9]{32}$/);
          await database.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
          const remaining = await database.pool.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [schema]);
          assert.equal(remaining.rowCount, 0, "All synthetic records and tables must be cleaned up");
        }
      } finally {
        if (database) await database.pool.end();
        if (previousOptions === undefined) delete process.env.PGOPTIONS;
        else process.env.PGOPTIONS = previousOptions;
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });

  function family(nationalId: string, shelterId?: string) {
    return {
      campId, sectorId, shelterId, headName: "Synthetic family",
      members: [
        { fullName: "Synthetic head", nationalId, gender: "MALE", relationship: "HEAD" },
        { fullName: "Synthetic child", nationalId: `child-${randomUUID()}`, gender: "FEMALE", relationship: "CHILD" },
      ],
    };
  }

  async function request(path: string, body: unknown) {
    // Distinct keys prevent idempotency from serializing the competing writes.
    const key = path === "/families/import"
      ? `sha256-${createHash("sha256").update(randomUUID()).digest("hex")}`
      : randomUUID();
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST", headers: { ...headers, "Idempotency-Key": key },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
    });
    return { status: response.status, body: await response.json() };
  }

  async function waitForBlockedWrites(fragment: string) {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const waiting = await database.pool.query(
        `SELECT pid FROM pg_stat_activity
         WHERE application_name = $1 AND wait_event_type = 'Lock'
           AND position($2 in query) > 0 AND pid <> pg_backend_pid()`,
        [schema, fragment],
      );
      if (waiting.rowCount === 2) {
        assert.equal(new Set(waiting.rows.map((row) => row.pid)).size, 2, "Two independent PostgreSQL transactions must overlap");
        return;
      }
      await delay(20);
    }
    assert.fail(`Both API transactions must reach the real PostgreSQL lock: ${fragment}`);
  }

  async function race(lockSql: string, fragment: string, operations: Array<() => ReturnType<typeof request>>) {
    const blocker = await database.pool.connect();
    const pending: Array<ReturnType<typeof request>> = [];
    try {
      await blocker.query("BEGIN");
      await blocker.query(lockSql);
      pending.push(...operations.map((operation) => operation()));
      // Attach rejection handlers immediately; drain all requests on failure.
      const results = Promise.all(pending);
      void results.catch(() => {});
      await waitForBlockedWrites(fragment);
      await blocker.query("COMMIT");
      return await results;
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      await Promise.allSettled(pending);
    }
  }

  test("concurrent imports reject a normalized duplicate ID and roll back the entire loser", async () => {
    const nationalId = `synthetic-${randomUUID()}`;
    // No shelter lock: both preflight ID reads finish before either INSERT.
    const first = family(`  ${nationalId.toUpperCase()}  `);
    const second = family(nationalId);
    const responses = await race(
      "LOCK TABLE family_members IN SHARE MODE", 'insert into "family_members"',
      [
        () => request("/families/import", { campId, families: [first] }),
        () => request("/families/import", { campId, families: [second] }),
      ],
    );
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    assert.deepEqual(responses.find((response) => response.status === 201)!.body, { importedCount: 1 });
    assert.deepEqual(responses.find((response) => response.status === 409)!.body, {
      error: "يوجد رقم هوية مسجل مسبقًا في النظام.",
    });
    const persisted = await database.pool.query(
      "SELECT family_id, national_id FROM family_members WHERE lower(btrim(national_id)) = $1", [nationalId],
    );
    assert.equal(persisted.rowCount, 1, "Normalized identity must be stored once");
    const families = await database.pool.query("SELECT id FROM families");
    assert.equal(families.rowCount, 1, "Unique violation must roll back the loser's family");
    const members = await database.pool.query("SELECT id FROM family_members");
    assert.equal(members.rowCount, 2, "No child or partial member from the losing import");
    const audits = await database.pool.query("SELECT entity_id FROM sync_audit_events");
    assert.deepEqual(audits.rows, [{ entity_id: persisted.rows[0].family_id }]);
    const claims = await database.pool.query("SELECT status_code FROM idempotency_keys");
    assert.deepEqual(claims.rows, [{ status_code: 201 }], "Losing claim must roll back too");
  });

  test("import and manual creation cannot both take the final shelter place", async () => {
    const { db, shelterUnitsTable, familiesTable } = database;
    const shelterId = randomUUID();
    await db.insert(shelterUnitsTable).values({ id: shelterId, sectorId, code: "SYNTHETIC-LAST-PLACE", capacity: 2 });
    const occupiedId = randomUUID();
    await db.insert(familiesTable).values({
      id: occupiedId, campId, sectorId, shelterId, headName: "Synthetic existing occupant",
      createdById: actorId, status: "ACTIVE",
    });
    const imported = family(`import-${randomUUID()}`, shelterId);
    const manual = family(`manual-${randomUUID()}`, shelterId);
    const before = await database.pool.query(
      "SELECT (SELECT count(*)::int FROM families) AS families, (SELECT count(*)::int FROM idempotency_keys) AS claims",
    );
    const responses = await race(
      `SELECT id FROM shelter_units WHERE id = '${shelterId}' FOR UPDATE`,
      'from "shelter_units"',
      [
        () => request("/families/import", { campId, families: [imported] }),
        () => request("/families", manual),
      ],
    );
    const winner = responses.findIndex((response) => response.status === 201);
    assert.notEqual(winner, -1, "Exactly one operation succeeds");
    const loser = responses[1 - winner];
    assert.equal(loser.status, 400);
    assert.deepEqual(loser.body, {
      error: winner === 0 ? "Shelter has reached its capacity" : "عدد الأسر المحدد يتجاوز السعة المتاحة لوحدة إيواء.",
    });
    const assignments = await database.pool.query(
      `SELECT f.id FROM families f JOIN shelter_units s ON s.id = f.shelter_id
       WHERE s.id = $1 AND f.archived_at IS NULL`, [shelterId],
    );
    assert.equal(assignments.rowCount, 2, "The last place is taken once, never over capacity");
    assert(assignments.rows.some((row) => row.id === occupiedId), "Existing occupant stays untouched");
    const successful = winner === 0 ? imported : manual;
    const rejected = winner === 0 ? manual : imported;
    const members = await database.pool.query(
      "SELECT family_id, national_id FROM family_members WHERE national_id = ANY($1::text[])",
      [[...imported.members, ...manual.members].map((member) => member.nationalId)],
    );
    assert.equal(members.rowCount, 2, "Only the winning family's members may persist");
    assert.deepEqual(members.rows.map((row) => row.national_id).sort(), successful.members.map((member) => member.nationalId).sort());
    const winnerFamilyId = members.rows[0].family_id;
    assert(members.rows.every((row) => row.family_id === winnerFamilyId));
    assert(assignments.rows.some((row) => row.id === winnerFamilyId));
    assert(!members.rows.some((row) => rejected.members.some((member) => member.nationalId === row.national_id)));
    const after = await database.pool.query(
      "SELECT (SELECT count(*)::int FROM families) AS families, (SELECT count(*)::int FROM idempotency_keys) AS claims",
    );
    assert.equal(after.rows[0].families, before.rows[0].families + 1, "No orphan family from the rejected write");
    assert.equal(after.rows[0].claims, before.rows[0].claims + 1, "Rejected writes leave no idempotency claim");
    const audits = await database.pool.query(
      "SELECT entity_id FROM sync_audit_events WHERE entity_id = ANY($1::uuid[])",
      [assignments.rows.map((row) => row.id)],
    );
    assert.deepEqual(audits.rows, [{ entity_id: winnerFamilyId }], "Only the winner has a creation audit");
  });
});