import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, describe, test } from "node:test";
import type { Server } from "node:http";

describe("family transfer and shelter archive serialization on isolated PostgreSQL tables", {
  skip: process.env.FAMILY_SHELTER_ARCHIVE_POSTGRES_TEST !== "1",
}, () => {
  const schema = `family_shelter_archive_test_${randomUUID().replaceAll("-", "")}`;
  const tables = [
    "staff_users", "staff_sessions", "camps", "camp_sectors", "shelter_units",
    "families", "family_members", "family_assignment_history", "idempotency_keys", "sync_audit_events",
  ];
  const previousOptions = process.env.PGOPTIONS;
  const previousNodeEnv = process.env.NODE_ENV;
  const actorId = randomUUID();
  const campId = randomUUID();
  const sectorId = randomUUID();
  const token = `synthetic-${randomUUID()}`;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  let database: typeof import("@workspace/db");
  let server: Server | undefined;
  let schemaCreated = false;
  let baseUrl: string;

  before(async () => {
    assert.notEqual(process.env.NODE_ENV, "production", "Development database only");
    assert.notEqual(process.env.REPLIT_DEPLOYMENT, "1", "Never run inside a deployment");
    process.env.PGOPTIONS = `-c search_path=${schema} -c application_name=${schema} -c statement_timeout=15000`;
    process.env.NODE_ENV = "test";
    database = await import("@workspace/db");
    const { pool, db, staffUsers, sessions, campsTable, campSectorsTable } = database;
    assert.equal((await pool.query("SELECT current_setting('search_path') AS path")).rows[0].path, schema);
    await pool.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    for (const table of tables) {
      await pool.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    }

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

    const foreignKeys = await pool.query(
      `SELECT c.relname AS table_name, con.conname AS name, pg_get_constraintdef(con.oid) AS definition
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND con.contype = 'f' AND c.relname = ANY($1::text[])`,
      [tables],
    );
    for (const foreignKey of foreignKeys.rows) {
      if (!tables.some((table) => foreignKey.definition.includes(`REFERENCES public.${table}(`))) continue;
      assert.match(foreignKey.name, /^[a-z_][a-z0-9_]*$/);
      const definition = (foreignKey.definition as string).replaceAll("REFERENCES public.", `REFERENCES "${schema}".`);
      await pool.query(`ALTER TABLE "${schema}"."${foreignKey.table_name}" ADD CONSTRAINT "${foreignKey.name}" ${definition}`);
    }

    const { hashToken } = await import("./middlewares/auth");
    await db.insert(staffUsers).values({
      id: actorId,
      email: `${actorId}@example.invalid`,
      name: "Synthetic shelter race manager",
      passwordHash: "not-a-login-password",
      role: "MANAGER",
    });
    await db.insert(sessions).values({
      userId: actorId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 120_000),
    });
    await db.insert(campsTable).values({ id: campId, name: "Synthetic shelter race camp" });
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
          assert.match(schema, /^family_shelter_archive_test_[a-f0-9]{32}$/);
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

  async function request(path: string, body: unknown) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    return { status: response.status, body: await response.json() };
  }

  async function get(path: string) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { authorization: headers.authorization },
      signal: AbortSignal.timeout(20_000),
    });
    return { status: response.status, body: await response.json() };
  }

  async function waitForBlockedWrites(fragment: string, expectedWaiters: number) {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const waiting = await database.pool.query(
        `SELECT pid FROM pg_stat_activity
         WHERE application_name = $1 AND wait_event_type = 'Lock'
           AND position($2 in query) > 0 AND pid <> pg_backend_pid()`,
        [schema, fragment],
      );
      if (waiting.rowCount === expectedWaiters) {
        assert.equal(new Set(waiting.rows.map((row) => row.pid)).size, expectedWaiters);
        return;
      }
      await delay(20);
    }
    assert.fail(`Both PATCH transactions must reach the real shelter-row lock: ${fragment}`);
  }

  async function raceShelterPatchRequests(
    targetShelterId: string,
    operations: Array<() => ReturnType<typeof request>>,
  ) {
    const blocker = await database.pool.connect();
    const pending: Array<ReturnType<typeof request>> = [];
    try {
      await blocker.query("BEGIN");
      await blocker.query(`SELECT id FROM shelter_units WHERE id = '${targetShelterId}' FOR UPDATE`);
      for (const operation of operations) {
        const promise = operation();
        pending.push(promise);
        void promise.catch(() => {});
        await waitForBlockedWrites('from "shelter_units"', pending.length);
      }
      const results = Promise.all(pending);
      await blocker.query("COMMIT");
      return await results;
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      await Promise.allSettled(pending);
    }
  }

  test("archive-first rejects transfer; transfer-first records both writes in lock order", async () => {
    const { db, shelterUnitsTable, familiesTable } = database;

    for (const firstOperation of ["archive", "transfer"] as const) {
      const targetShelterId = randomUUID();
      const sourceShelterId = randomUUID();
      const movingFamilyId = randomUUID();
      await db.insert(shelterUnitsTable).values([
        { id: targetShelterId, sectorId, code: `SYNTHETIC-RACE-TARGET-${firstOperation}`, capacity: 2 },
        { id: sourceShelterId, sectorId, code: `SYNTHETIC-RACE-SOURCE-${firstOperation}`, capacity: 2 },
      ]);
      await db.insert(familiesTable).values({
        id: movingFamilyId,
        campId,
        sectorId,
        shelterId: sourceShelterId,
        headName: `Synthetic family in ${firstOperation}-first race`,
        createdById: actorId,
        status: "ACTIVE",
      });

      const archive = () => request(`/shelters/${targetShelterId}/archive`, { expectedVersion: 1 });
      const transfer = () => request(`/families/${movingFamilyId}`, {
        shelterId: targetShelterId,
        expectedVersion: 1,
      });
      const operations = firstOperation === "archive" ? [archive, transfer] : [transfer, archive];
      const [firstResponse, secondResponse] = await raceShelterPatchRequests(targetShelterId, operations);
      const archiveResponse = firstOperation === "archive" ? firstResponse : secondResponse;
      const transferResponse = firstOperation === "transfer" ? firstResponse : secondResponse;

      assert.equal(archiveResponse.status, 200);
      assert.equal(transferResponse.status, firstOperation === "archive" ? 400 : 200);
      if (firstOperation === "archive") {
        assert.deepEqual(transferResponse.body, { error: "Shelter does not belong to the selected sector" });
      }

      const [shelter, movedFamily, history, auditRows] = await Promise.all([
        database.pool.query("SELECT archived_at, version FROM shelter_units WHERE id = $1", [targetShelterId]),
        database.pool.query("SELECT shelter_id, archived_at, version FROM families WHERE id = $1", [movingFamilyId]),
        database.pool.query(
          "SELECT from_shelter_id, to_shelter_id FROM family_assignment_history WHERE family_id = $1",
          [movingFamilyId],
        ),
        database.pool.query(
          `SELECT action, entity_type, entity_id, actor_staff_id, created_at
           FROM sync_audit_events WHERE entity_id = ANY($1::uuid[]) ORDER BY created_at`,
          [[targetShelterId, movingFamilyId]],
        ),
      ]);

      assert.equal(shelter.rowCount, 1);
      assert.notEqual(shelter.rows[0].archived_at, null);
      assert.equal(shelter.rows[0].version, 2);
      assert.equal(movedFamily.rowCount, 1);
      assert.equal(movedFamily.rows[0].shelter_id, firstOperation === "transfer" ? targetShelterId : sourceShelterId);
      assert.equal(movedFamily.rows[0].archived_at, null);
      assert.equal(movedFamily.rows[0].version, firstOperation === "transfer" ? 2 : 1);
      assert.equal(history.rowCount, firstOperation === "transfer" ? 1 : 0);
      if (firstOperation === "transfer") {
        assert.deepEqual(history.rows[0], {
          from_shelter_id: sourceShelterId,
          to_shelter_id: targetShelterId,
        });
      }
      assert.deepEqual(
        auditRows.rows.map(({ action, entity_type, entity_id, actor_staff_id }) => ({
          action,
          entity_type,
          entity_id,
          actor_staff_id,
        })),
        firstOperation === "transfer"
          ? [
              { action: "UPDATE", entity_type: "FAMILY", entity_id: movingFamilyId, actor_staff_id: actorId },
              { action: "ARCHIVE", entity_type: "SHELTER", entity_id: targetShelterId, actor_staff_id: actorId },
            ]
          : [
              { action: "ARCHIVE", entity_type: "SHELTER", entity_id: targetShelterId, actor_staff_id: actorId },
            ],
        "A transfer must not be audited after archive has won the shelter lock",
      );
      if (firstOperation === "transfer") {
        assert(auditRows.rows[0].created_at < auditRows.rows[1].created_at);
      }
    }
  });

  test("simultaneous shelter archives with the same version create one archive record", async () => {
    const { db, shelterUnitsTable } = database;
    const shelterId = randomUUID();
    await db.insert(shelterUnitsTable).values({
      id: shelterId,
      sectorId,
      code: "SYNTHETIC-SIMULTANEOUS-SHELTER-ARCHIVE",
      capacity: 3,
    });

    const responses = await raceShelterPatchRequests(shelterId, [
      () => request(`/shelters/${shelterId}/archive`, { expectedVersion: 1 }),
      () => request(`/shelters/${shelterId}/archive`, { expectedVersion: 1 }),
    ]);

    const successes = responses.filter((response) => response.status === 200);
    const conflicts = responses.filter((response) => response.status === 409);
    assert.equal(successes.length, 1, "Exactly one archive request must succeed");
    assert.equal(conflicts.length, 1, "The competing archive must report the committed archived state");
    assert.deepEqual(conflicts[0].body, {
      error: "Shelter is already archived",
      code: "SHELTER_ALREADY_ARCHIVED",
      currentVersion: 2,
    });

    const [persistedShelter, audits] = await Promise.all([
      database.pool.query("SELECT archived_at, version FROM shelter_units WHERE id = $1", [shelterId]),
      database.pool.query(
        `SELECT action, entity_type, entity_id, actor_staff_id
         FROM sync_audit_events WHERE entity_id = $1`,
        [shelterId],
      ),
    ]);
    assert.equal(persistedShelter.rowCount, 1);
    assert(persistedShelter.rows[0].archived_at, "The winning archive must set archived_at");
    assert.equal(persistedShelter.rows[0].version, 2, "The shelter version must advance exactly once");
    assert.deepEqual(audits.rows, [{
      action: "ARCHIVE",
      entity_type: "SHELTER",
      entity_id: shelterId,
      actor_staff_id: actorId,
    }], "Only the winning archive may write an audit event");
  });

  test("archiving after a completed transfer retains and keeps the active family manageable", async () => {
    const { db, shelterUnitsTable, familiesTable } = database;
    const targetShelterId = randomUUID();
    const sourceShelterId = randomUUID();
    const movingFamilyId = randomUUID();
    await db.insert(shelterUnitsTable).values([
      { id: targetShelterId, sectorId, code: "SYNTHETIC-ARCHIVE-RETAINED", capacity: 2 },
      { id: sourceShelterId, sectorId, code: "SYNTHETIC-ARCHIVE-SOURCE", capacity: 2 },
    ]);
    await db.insert(familiesTable).values({
      id: movingFamilyId,
      campId,
      sectorId,
      shelterId: sourceShelterId,
      headName: "Synthetic retained family",
      createdById: actorId,
      status: "ACTIVE",
    });

    const transfer = await request(`/families/${movingFamilyId}`, {
      shelterId: targetShelterId,
      expectedVersion: 1,
    });
    assert.equal(transfer.status, 200);
    assert.equal((transfer.body as { shelterId: string }).shelterId, targetShelterId);

    const archive = await request(`/shelters/${targetShelterId}/archive`, { expectedVersion: 1 });
    assert.equal(archive.status, 200);
    assert.notEqual((archive.body as { archivedAt: string | null }).archivedAt, null);

    const [familyList, familyDetail, shelterList] = await Promise.all([
      get("/families"),
      get(`/families/${movingFamilyId}`),
      get("/shelters"),
    ]);
    assert.equal(familyList.status, 200);
    assert.equal(familyDetail.status, 200);
    assert.equal(shelterList.status, 200);
    assert.equal(
      (familyList.body as Array<{ id: string; shelterId: string | null }>).find((family) => family.id === movingFamilyId)?.shelterId,
      targetShelterId,
    );
    assert.equal((familyDetail.body as { shelterId: string | null }).shelterId, targetShelterId);
    assert.equal(
      (shelterList.body as Array<{ id: string }>).some((shelter) => shelter.id === targetShelterId),
      false,
    );

    const edit = await request(`/families/${movingFamilyId}`, {
      headName: "Synthetic family remains manageable",
      expectedVersion: 2,
    });
    assert.equal(edit.status, 200);
    assert.equal((edit.body as { headName: string }).headName, "Synthetic family remains manageable");
    assert.equal((edit.body as { shelterId: string | null }).shelterId, targetShelterId);

    const [familyRow, archiveAudit, assignmentHistory] = await Promise.all([
      database.pool.query(
        "SELECT shelter_id, archived_at, version, head_name FROM families WHERE id = $1",
        [movingFamilyId],
      ),
      database.pool.query(
        `SELECT metadata FROM sync_audit_events
         WHERE action = 'ARCHIVE' AND entity_type = 'SHELTER' AND entity_id = $1`,
        [targetShelterId],
      ),
      database.pool.query(
        "SELECT from_shelter_id, to_shelter_id FROM family_assignment_history WHERE family_id = $1",
        [movingFamilyId],
      ),
    ]);
    assert.equal(familyRow.rowCount, 1);
    assert.equal(familyRow.rows[0].shelter_id, targetShelterId);
    assert.equal(familyRow.rows[0].archived_at, null);
    assert.equal(familyRow.rows[0].version, 3);
    assert.equal(familyRow.rows[0].head_name, "Synthetic family remains manageable");
    assert.equal(archiveAudit.rowCount, 1);
    assert.deepEqual(archiveAudit.rows[0].metadata, {
      expectedVersion: 1,
      retainedActiveFamilyAssignmentCount: 1,
    });
    assert.deepEqual(assignmentHistory.rows, [{
      from_shelter_id: sourceShelterId,
      to_shelter_id: targetShelterId,
    }]);
  });
});
