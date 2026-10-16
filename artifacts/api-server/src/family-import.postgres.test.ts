import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, describe, test } from "node:test";
import type { Server } from "node:http";

// Run explicitly with test:family-import-postgres. Never reuse a production
// connection or let an absent test table resolve to a populated public table.
describe("family-write concurrency on isolated PostgreSQL tables", {
  skip: process.env.FAMILY_IMPORT_POSTGRES_TEST !== "1",
}, () => {
  const schema = `family_import_test_${randomUUID().replaceAll("-", "")}`;
  const tables = [
    "staff_users", "staff_sessions", "camps", "camp_sectors", "shelter_units",
    "families", "family_members", "family_assignment_history", "sync_aids",
    "idempotency_keys", "sync_audit_events",
  ];
  const previousOptions = process.env.PGOPTIONS;
  const previousNodeEnv = process.env.NODE_ENV;
  const actorId = randomUUID();
  const campId = randomUUID();
  const sectorId = randomUUID();
  const token = `synthetic-${randomUUID()}`;
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  let database: typeof import("@workspace/db");
  let server: Server | undefined;
  let schemaCreated = false;
  let baseUrl: string;

  before(async () => {
    assert.notEqual(process.env.NODE_ENV, "production", "Development database only");
    assert.notEqual(process.env.REPLIT_DEPLOYMENT, "1", "Never run inside a deployment");
    // Set before importing @workspace/db so every connection uses the isolated
    // search_path and application_name.
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

    // LIKE chooses a new name for expression indexes. Preserve the production
    // route's unique-violation -> public 409 mapping.
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
    await pool.query(
      `ALTER INDEX "${schema}"."${indexName}" RENAME TO family_members_national_id_normalized_unique`,
    );

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
      if (!tables.some((table) => foreignKey.definition.includes(`REFERENCES public.${table}(`))) continue;
      assert.match(foreignKey.name, /^[a-z_][a-z0-9_]*$/);
      const definition = (foreignKey.definition as string).replaceAll(
        "REFERENCES public.",
        `REFERENCES "${schema}".`,
      );
      await pool.query(
        `ALTER TABLE "${schema}"."${foreignKey.table_name}" ADD CONSTRAINT "${foreignKey.name}" ${definition}`,
      );
    }

    const { hashToken } = await import("./middlewares/auth");
    await db.insert(staffUsers).values({
      id: actorId,
      email: `${actorId}@example.invalid`,
      name: "Synthetic concurrency manager",
      passwordHash: "not-a-login-password",
      role: "MANAGER",
    });
    await db.insert(sessions).values({
      userId: actorId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 120_000),
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
          assert.match(schema, /^family_import_test_[a-f0-9]{32}$/);
          await database.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
          const remaining = await database.pool.query(
            "SELECT 1 FROM pg_namespace WHERE nspname = $1",
            [schema],
          );
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
      campId,
      sectorId,
      shelterId,
      headName: "Synthetic family",
      members: [
        { fullName: "Synthetic head", nationalId, gender: "MALE", relationship: "HEAD" },
        { fullName: "Synthetic child", nationalId: `child-${randomUUID()}`, gender: "FEMALE", relationship: "CHILD" },
      ],
    };
  }

  async function request(
    path: string,
    body: unknown,
    method: "POST" | "PATCH" = "POST",
    idempotencyKey?: string,
  ) {
    const key = idempotencyKey ?? (path === "/families/import"
      ? `sha256-${createHash("sha256").update(randomUUID()).digest("hex")}`
      : method === "PATCH" ? undefined : randomUUID());
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...headers, ...(key ? { "Idempotency-Key": key } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }

  async function waitForBlockedWrites(fragment: string, expectedWaiters = 2) {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const waiting = await database.pool.query(
        `SELECT pid FROM pg_stat_activity
         WHERE application_name = $1 AND wait_event_type = 'Lock'
           AND position($2 in query) > 0 AND pid <> pg_backend_pid()`,
        [schema, fragment],
      );
      if (waiting.rowCount === expectedWaiters) {
        assert.equal(
          new Set(waiting.rows.map((row) => row.pid)).size,
          expectedWaiters,
          "Independent PostgreSQL transactions must overlap",
        );
        return;
      }
      await delay(20);
    }
    assert.fail(`All API transactions must reach the real PostgreSQL lock: ${fragment}`);
  }

  async function race(
    lockSql: string,
    fragment: string,
    operations: Array<() => ReturnType<typeof request>>,
  ) {
    const blocker = await database.pool.connect();
    const pending: Array<ReturnType<typeof request>> = [];
    try {
      await blocker.query("BEGIN");
      await blocker.query(lockSql);
      for (const operation of operations) {
        const promise = operation();
        pending.push(promise);
        void promise.catch(() => {});
        await waitForBlockedWrites(fragment, pending.length);
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

  async function createShelter(id: string, capacity: number, code: string) {
    await database.db.insert(database.shelterUnitsTable).values({ id, sectorId, code, capacity });
  }

  async function createExistingFamily(shelterId: string, label: string) {
    const id = randomUUID();
    const input = family(`${label}-${randomUUID()}`, shelterId);
    await database.db.insert(database.familiesTable).values({
      id,
      campId,
      sectorId,
      shelterId,
      headName: input.headName,
      createdById: actorId,
      status: "ACTIVE",
    });
    await database.db.insert(database.familyMembersTable).values(input.members.map((member) => ({
      familyId: id,
      fullName: member.fullName,
      nationalId: member.nationalId,
      gender: member.gender as "MALE" | "FEMALE" | "OTHER",
      relationship: member.relationship,
    })));
    return { id, input };
  }

  test("concurrent imports reject a normalized duplicate ID and roll back the entire loser", async () => {
    const nationalId = `synthetic-${randomUUID()}`;
    const first = family(`  ${nationalId.toUpperCase()}  `);
    const second = family(nationalId);
    const responses = await race(
      "LOCK TABLE family_members IN SHARE MODE",
      'insert into "family_members"',
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
      "SELECT family_id, national_id FROM family_members WHERE lower(btrim(national_id)) = $1",
      [nationalId],
    );
    assert.equal(persisted.rowCount, 1, "Normalized identity must be stored once");
    assert.equal((await database.pool.query("SELECT id FROM families")).rowCount, 1);
    assert.equal((await database.pool.query("SELECT id FROM family_members")).rowCount, 2);
    assert.deepEqual(
      (await database.pool.query("SELECT entity_id FROM sync_audit_events")).rows,
      [{ entity_id: persisted.rows[0].family_id }],
    );
    assert.deepEqual(
      (await database.pool.query("SELECT status_code FROM idempotency_keys ORDER BY status_code")).rows,
      [{ status_code: 201 }],
      "Losing claim must roll back too",
    );
  });

  test("concurrent aid archive requests with the same version create one archive and one conflict", async () => {
    const aidId = randomUUID();
    await database.db.insert(database.aids).values({
      id: aidId,
      title: "Synthetic archive race aid",
      type: "FOOD",
      quantity: 10,
      unit: "packages",
      location: "Synthetic camp",
      distributionDate: "2026-10-14",
      createdById: actorId,
    });

    const responses = await race(
      `SELECT id FROM sync_aids WHERE id = '${aidId}' FOR UPDATE`,
      "sync_aids",
      [
        () => request(`/aids/${aidId}/archive`, { expectedVersion: 1 }, "PATCH"),
        () => request(`/aids/${aidId}/archive`, { expectedVersion: 1 }, "PATCH"),
      ],
    );

    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    assert.deepEqual(responses.find((response) => response.status === 409)!.body, {
      error: "Aid has been updated; refresh and retry with the current version",
      code: "VERSION_CONFLICT",
      currentVersion: 2,
    });

    const [aid, archiveEvents] = await Promise.all([
      database.pool.query(
        "SELECT archived_at, version FROM sync_aids WHERE id = $1",
        [aidId],
      ),
      database.pool.query(
        `SELECT action, entity_type, entity_id, metadata FROM sync_audit_events
         WHERE entity_id = $1`,
        [aidId],
      ),
    ]);
    assert.equal(aid.rowCount, 1);
    assert.notEqual(aid.rows[0].archived_at, null);
    assert.equal(aid.rows[0].version, 2, "The aid version must advance exactly once");
    assert.deepEqual(archiveEvents.rows, [{
      action: "ARCHIVE",
      entity_type: "AID",
      entity_id: aidId,
      metadata: { expectedVersion: 1 },
    }]);
  });

  test("an import rejects duplicate normalized identities before saving any family and leaves its key reusable", async () => {
    const repeatedNationalId = `synthetic ${randomUUID()}`;
    const spacedNationalId = `SYNTHETIC\t ${repeatedNationalId.slice("synthetic ".length).toUpperCase()}`;
    const familyNames = [0, 1, 2].map((index) => `Duplicate batch family ${index} ${randomUUID()}`);
    const attemptedFamilies = [
      { ...family(`batch-unique-${randomUUID()}`), headName: familyNames[0] },
      { ...family(spacedNationalId), headName: familyNames[1] },
      { ...family(repeatedNationalId), headName: familyNames[2] },
    ];
    const correctedFamilies = [
      attemptedFamilies[0],
      attemptedFamilies[1],
      { ...family(`batch-corrected-${randomUUID()}`), headName: familyNames[2] },
    ];
    const key = `sha256-${createHash("sha256").update(randomUUID()).digest("hex")}`;
    const operation = `importFamilies:${campId}`;
    const before = await database.pool.query(
      `SELECT (SELECT count(*)::int FROM families) AS families,
              (SELECT count(*)::int FROM family_members) AS members,
              (SELECT count(*)::int FROM sync_audit_events) AS audits,
              (SELECT count(*)::int FROM idempotency_keys) AS claims`,
    );

    const rejected = await request("/families/import", { campId, families: attemptedFamilies }, "POST", key);
    assert.equal(rejected.status, 400);
    assert.deepEqual(rejected.body, { error: "يوجد رقم هوية مكرر بين أفراد الملف." });
    assert.equal(
      (await database.pool.query(
        "SELECT id FROM families WHERE head_name = ANY($1::text[])",
        [familyNames],
      )).rowCount,
      0,
      "The rejected batch must not leave any families",
    );
    const afterRejection = await database.pool.query(
      `SELECT (SELECT count(*)::int FROM families) AS families,
              (SELECT count(*)::int FROM family_members) AS members,
              (SELECT count(*)::int FROM sync_audit_events) AS audits,
              (SELECT count(*)::int FROM idempotency_keys) AS claims`,
    );
    assert.deepEqual(afterRejection.rows, before.rows, "A rejected duplicate batch must have no persisted side effects");
    const rejectedClaim = await database.pool.query(
      `SELECT status_code FROM idempotency_keys
       WHERE user_id = $1 AND operation = $2 AND key = $3`,
      [actorId, operation, key],
    );
    assert.equal(rejectedClaim.rowCount, 0, "The rejected request must not consume its idempotency key");

    const retried = await request("/families/import", { campId, families: correctedFamilies }, "POST", key);
    assert.equal(retried.status, 201);
    assert.deepEqual(retried.body, { importedCount: correctedFamilies.length });
    const savedBatch = await database.pool.query(
      `SELECT f.head_name, count(fm.id)::int AS members
       FROM families f
       LEFT JOIN family_members fm ON fm.family_id = f.id
       WHERE f.head_name = ANY($1::text[])
       GROUP BY f.head_name ORDER BY f.head_name`,
      [familyNames],
    );
    assert.equal(savedBatch.rowCount, correctedFamilies.length);
    assert(savedBatch.rows.every((row) => row.members === 2), "The corrected retry must save every family and member");
    const afterRetry = await database.pool.query(
      `SELECT (SELECT count(*)::int FROM families) AS families,
              (SELECT count(*)::int FROM family_members) AS members,
              (SELECT count(*)::int FROM sync_audit_events) AS audits,
              (SELECT count(*)::int FROM idempotency_keys) AS claims`,
    );
    assert.equal(afterRetry.rows[0].families, before.rows[0].families + correctedFamilies.length);
    assert.equal(afterRetry.rows[0].members, before.rows[0].members + correctedFamilies.length * 2);
    assert.equal(afterRetry.rows[0].audits, before.rows[0].audits + correctedFamilies.length);
    assert.equal(afterRetry.rows[0].claims, before.rows[0].claims + 1);
    assert.deepEqual(
      (await database.pool.query(
        `SELECT status_code FROM idempotency_keys
         WHERE user_id = $1 AND operation = $2 AND key = $3`,
        [actorId, operation, key],
      )).rows,
      [{ status_code: 201 }],
    );
  });

  test("import and manual creation cannot both take the final shelter place", async () => {
    const shelterId = randomUUID();
    await createShelter(shelterId, 2, "SYNTHETIC-LAST-PLACE");
    const occupied = await createExistingFamily(shelterId, "occupant");
    const imported = family(`import-${randomUUID()}`, shelterId);
    const manual = family(`manual-${randomUUID()}`, shelterId);
    const responses = await race(
      `SELECT id FROM shelter_units WHERE id = '${shelterId}' FOR UPDATE`,
      'from "shelter_units"',
      [
        () => request("/families/import", { campId, families: [imported] }),
        () => request("/families", manual),
      ],
    );
    const winner = responses.findIndex((response) => response.status === 201);
    assert.notEqual(winner, -1, "Exactly one write must take the last place");
    assert.equal(responses[1 - winner].status, 400);
    const assignments = await database.pool.query(
      "SELECT id FROM families WHERE shelter_id = $1 AND archived_at IS NULL",
      [shelterId],
    );
    assert.equal(assignments.rowCount, 2);
    assert(assignments.rows.some((row) => row.id === occupied.id), "Existing occupant stays assigned");
    const successful = winner === 0 ? imported : manual;
    const rejected = winner === 0 ? manual : imported;
    const memberIds = [...successful.members, ...rejected.members].map((member) => member.nationalId);
    const members = await database.pool.query(
      "SELECT family_id, national_id FROM family_members WHERE national_id = ANY($1::text[])",
      [memberIds],
    );
    assert.equal(members.rowCount, 2, "Only the successful write's members persist");
    assert.deepEqual(
      members.rows.map((row) => row.national_id).sort(),
      successful.members.map((member) => member.nationalId).sort(),
    );
  });

  test("a full target rejects a multi-shelter import atomically and leaves its key reusable", async () => {
    const availableShelterId = randomUUID();
    const fullShelterId = randomUUID();
    await createShelter(availableShelterId, 2, "SYNTHETIC-IMPORT-AVAILABLE");
    await createShelter(fullShelterId, 1, "SYNTHETIC-IMPORT-FULL");
    await createExistingFamily(fullShelterId, "full-occupant");
    const imported = [
      family(`multi-available-${randomUUID()}`, availableShelterId),
      family(`multi-full-${randomUUID()}`, fullShelterId),
    ];
    const key = `sha256-${createHash("sha256").update(randomUUID()).digest("hex")}`;
    const attemptedIds = imported.flatMap((entry) => entry.members.map((member) => member.nationalId));

    const rejected = await request("/families/import", { campId, families: imported }, "POST", key);
    assert.equal(rejected.status, 400);
    const absentMembers = await database.pool.query(
      "SELECT national_id FROM family_members WHERE national_id = ANY($1::text[])",
      [attemptedIds],
    );
    assert.equal(absentMembers.rowCount, 0, "The rejected import must not leave partial members");
    const operation = `importFamilies:${campId}`;
    const failedClaim = await database.pool.query(
      `SELECT status_code FROM idempotency_keys
       WHERE user_id = $1 AND operation = $2 AND key = $3`,
      [actorId, operation, key],
    );
    assert.equal(failedClaim.rowCount, 0, "A rejected import must not consume its idempotency key");

    const capacityUpdate = await request(`/shelters/${fullShelterId}`, {
      capacity: 2,
      expectedVersion: 1,
    }, "PATCH");
    assert.equal(capacityUpdate.status, 200);
    const retried = await request("/families/import", { campId, families: imported }, "POST", key);
    assert.equal(retried.status, 201);
    assert.deepEqual(retried.body, { importedCount: 2 });
    const savedMembers = await database.pool.query(
      "SELECT national_id FROM family_members WHERE national_id = ANY($1::text[])",
      [attemptedIds],
    );
    assert.equal(savedMembers.rowCount, 4);
    const successfulClaim = await database.pool.query(
      `SELECT status_code FROM idempotency_keys
       WHERE user_id = $1 AND operation = $2 AND key = $3`,
      [actorId, operation, key],
    );
    assert.deepEqual(successfulClaim.rows, [{ status_code: 201 }]);
  });

  test("replaying a successful import returns its saved result without creating duplicates", async () => {
    const imported = family(`successful-replay-${randomUUID()}`);
    const key = `sha256-${createHash("sha256").update(randomUUID()).digest("hex")}`;
    const operation = `importFamilies:${campId}`;
    const counts = async () => {
      const result = await database.pool.query(
        `SELECT (SELECT count(*)::int FROM families) AS families,
                (SELECT count(*)::int FROM family_members) AS members,
                (SELECT count(*)::int FROM sync_audit_events) AS audits,
                (SELECT count(*)::int FROM idempotency_keys) AS claims`,
      );
      return result.rows[0];
    };

    const before = await counts();
    const original = await request("/families/import", { campId, families: [imported] }, "POST", key);
    assert.equal(original.status, 201);
    assert.deepEqual(original.body, { importedCount: 1 });
    const afterOriginal = await counts();
    assert.equal(afterOriginal.families, before.families + 1);
    assert.equal(afterOriginal.members, before.members + 2);
    assert.equal(afterOriginal.audits, before.audits + 1);
    assert.equal(afterOriginal.claims, before.claims + 1);

    const replay = await request("/families/import", { campId, families: [imported] }, "POST", key);
    assert.deepEqual(replay, original, "A successful retry must return the original status and response");
    assert.deepEqual(
      await counts(),
      afterOriginal,
      "A successful retry must not add families, members, audit events, or idempotency rows",
    );
    const savedClaim = await database.pool.query(
      `SELECT status_code FROM idempotency_keys
       WHERE user_id = $1 AND operation = $2 AND key = $3`,
      [actorId, operation, key],
    );
    assert.deepEqual(savedClaim.rows, [{ status_code: 201 }]);
  });

  test("concurrent import and family reassignment cannot exceed shelter capacity", async () => {
    const targetShelterId = randomUUID();
    const sourceShelterId = randomUUID();
    await createShelter(targetShelterId, 2, "SYNTHETIC-IMPORT-MOVE-TARGET");
    await createShelter(sourceShelterId, 2, "SYNTHETIC-IMPORT-MOVE-SOURCE");
    await createExistingFamily(targetShelterId, "target-occupant");
    const moving = await createExistingFamily(sourceShelterId, "moving-family");
    const imported = family(`capacity-import-${randomUUID()}`, targetShelterId);
    const before = await database.pool.query(
      `SELECT (SELECT count(*)::int FROM families) AS families,
              (SELECT count(*)::int FROM family_members) AS members,
              (SELECT count(*)::int FROM family_assignment_history) AS assignments,
              (SELECT count(*)::int FROM sync_audit_events) AS audits,
              (SELECT count(*)::int FROM idempotency_keys) AS claims`,
    );
    const responses = await race(
      `SELECT id FROM shelter_units WHERE id = '${targetShelterId}' FOR UPDATE`,
      'from "shelter_units"',
      [
        () => request("/families/import", { campId, families: [imported] }),
        () => request(`/families/${moving.id}`, {
          shelterId: targetShelterId,
          expectedVersion: 1,
        }, "PATCH"),
      ],
    );
    const importWon = responses[0].status === 201;
    const moveWon = responses[1].status === 200;
    assert.equal(Number(importWon) + Number(moveWon), 1, "Exactly one write takes the final place");
    assert.equal(responses[0].status, importWon ? 201 : 400);
    assert.equal(responses[1].status, moveWon ? 200 : 400);
    if (!importWon) assert.deepEqual(responses[0].body, { error: "عدد الأسر المحدد يتجاوز السعة المتاحة لوحدة إيواء." });
    if (!moveWon) assert.deepEqual(responses[1].body, { error: "Shelter has reached its capacity" });

    const assignmentCount = await database.pool.query(
      "SELECT count(*)::int AS count FROM families WHERE shelter_id = $1 AND archived_at IS NULL",
      [targetShelterId],
    );
    assert.equal(assignmentCount.rows[0].count, 2);
    const movingState = await database.pool.query(
      "SELECT shelter_id, version FROM families WHERE id = $1",
      [moving.id],
    );
    assert.equal(movingState.rows[0].shelter_id, moveWon ? targetShelterId : sourceShelterId);
    assert.equal(movingState.rows[0].version, moveWon ? 2 : 1);
    const importMembers = await database.pool.query(
      "SELECT family_id, national_id FROM family_members WHERE national_id = ANY($1::text[])",
      [imported.members.map((member) => member.nationalId)],
    );
    assert.equal(importMembers.rowCount, importWon ? 2 : 0, "A rejected import must leave no partial members");
    const after = await database.pool.query(
      `SELECT (SELECT count(*)::int FROM families) AS families,
              (SELECT count(*)::int FROM family_members) AS members,
              (SELECT count(*)::int FROM family_assignment_history) AS assignments,
              (SELECT count(*)::int FROM sync_audit_events) AS audits,
              (SELECT count(*)::int FROM idempotency_keys) AS claims`,
    );
    assert.equal(after.rows[0].families, before.rows[0].families + Number(importWon));
    assert.equal(after.rows[0].members, before.rows[0].members + (importWon ? 2 : 0));
    assert.equal(after.rows[0].assignments, before.rows[0].assignments + Number(moveWon));
    assert.equal(after.rows[0].audits, before.rows[0].audits + 1);
    assert.equal(after.rows[0].claims, before.rows[0].claims + Number(importWon));
  });

  test("concurrent imports with reversed shelter order both finish without deadlock", async () => {
    const { db, shelterUnitsTable } = database;
    const [firstShelterId, secondShelterId] = [randomUUID(), randomUUID()].sort();
    await db.insert(shelterUnitsTable).values([
      { id: firstShelterId, sectorId, code: "SYNTHETIC-ORDER-A", capacity: 10 },
      { id: secondShelterId, sectorId, code: "SYNTHETIC-ORDER-B", capacity: 10 },
    ]);
    const firstImport = [
      family(`ordered-first-a-${randomUUID()}`, firstShelterId),
      family(`ordered-first-b-${randomUUID()}`, secondShelterId),
    ];
    const secondImport = [
      family(`ordered-second-b-${randomUUID()}`, secondShelterId),
      family(`ordered-second-a-${randomUUID()}`, firstShelterId),
    ];
    const responses = await race(
      `SELECT id FROM shelter_units WHERE id = '${firstShelterId}' FOR UPDATE`,
      'from "shelter_units"',
      [
        () => request("/families/import", { campId, families: firstImport }),
        () => request("/families/import", { campId, families: secondImport }),
      ],
    );
    assert.deepEqual(responses.map((response) => response.status), [201, 201]);
    assert.deepEqual(responses.map((response) => response.body), [
      { importedCount: 2 },
      { importedCount: 2 },
    ]);
    const expectedMembers = [...firstImport, ...secondImport].flatMap((entry) =>
      entry.members.map((member) => member.nationalId),
    );
    const persistedMembers = await database.pool.query(
      "SELECT national_id FROM family_members WHERE national_id = ANY($1::text[])",
      [expectedMembers],
    );
    assert.equal(persistedMembers.rowCount, 8, "Both imports must persist all four families' members");
    const familiesPerShelter = await database.pool.query(
      `SELECT shelter_id, count(*)::int AS count FROM families
       WHERE shelter_id = ANY($1::uuid[]) AND archived_at IS NULL
       GROUP BY shelter_id ORDER BY shelter_id`,
      [[firstShelterId, secondShelterId]],
    );
    assert.deepEqual(
      familiesPerShelter.rows.map((row) => [row.shelter_id, row.count]),
      [[firstShelterId, 2], [secondShelterId, 2]],
    );
  });

  test("concurrent family transfers with reversed shelter order both finish without deadlock", async () => {
    const [firstShelterId, secondShelterId] = [randomUUID(), randomUUID()].sort();
    await createShelter(firstShelterId, 2, "SYNTHETIC-TRANSFER-A");
    await createShelter(secondShelterId, 2, "SYNTHETIC-TRANSFER-B");
    const first = await createExistingFamily(firstShelterId, "transfer-first");
    const second = await createExistingFamily(secondShelterId, "transfer-second");
    const responses = await race(
      `SELECT id FROM shelter_units WHERE id = '${firstShelterId}' FOR UPDATE`,
      'from "shelter_units"',
      [
        () => request(`/families/${first.id}`, { shelterId: secondShelterId, expectedVersion: 1 }, "PATCH"),
        () => request(`/families/${second.id}`, { shelterId: firstShelterId, expectedVersion: 1 }, "PATCH"),
      ],
    );
    assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    assert.deepEqual(
      responses.map((response) => (response.body as { shelterId: string }).shelterId),
      [secondShelterId, firstShelterId],
    );
    const states = await database.pool.query(
      "SELECT id, shelter_id, version FROM families WHERE id = ANY($1::uuid[]) ORDER BY id",
      [[first.id, second.id]],
    );
    const expectedStates = [
      [first.id, secondShelterId, 2],
      [second.id, firstShelterId, 2],
    ].sort(([left], [right]) => String(left).localeCompare(String(right)));
    assert.deepEqual(states.rows.map((row) => [row.id, row.shelter_id, row.version]), expectedStates);
    const history = await database.pool.query(
      `SELECT family_id, from_shelter_id, to_shelter_id
       FROM family_assignment_history WHERE family_id = ANY($1::uuid[]) ORDER BY family_id`,
      [[first.id, second.id]],
    );
    assert.deepEqual(
      history.rows.map((row) => [row.family_id, row.from_shelter_id, row.to_shelter_id]),
      [
        [first.id, firstShelterId, secondShelterId],
        [second.id, secondShelterId, firstShelterId],
      ].sort(([left], [right]) => String(left).localeCompare(String(right))),
    );
  });

  test("two concurrent family PATCH requests cannot take the same final shelter place", async () => {
    const targetShelterId = randomUUID();
    const sourceShelterIds = [randomUUID(), randomUUID()];
    await createShelter(targetShelterId, 2, "SYNTHETIC-TWO-MOVES-TARGET");
    await Promise.all(sourceShelterIds.map((id, index) =>
      createShelter(id, 2, `SYNTHETIC-TWO-MOVES-SOURCE-${index}`),
    ));
    const occupied = await createExistingFamily(targetShelterId, "two-moves-occupant");
    const moving = await Promise.all(sourceShelterIds.map((id, index) =>
      createExistingFamily(id, `two-moves-family-${index}`),
    ));
    const responses = await race(
      `SELECT id FROM shelter_units WHERE id = '${targetShelterId}' FOR UPDATE`,
      'from "shelter_units"',
      moving.map(({ id }) => () => request(
        `/families/${id}`,
        { shelterId: targetShelterId, expectedVersion: 1 },
        "PATCH",
      )),
    );
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
    assert.deepEqual(responses.find((response) => response.status === 400)!.body, {
      error: "Shelter has reached its capacity",
    });
    const assignments = await database.pool.query(
      "SELECT id FROM families WHERE shelter_id = $1 AND archived_at IS NULL",
      [targetShelterId],
    );
    assert.equal(assignments.rowCount, 2);
    assert(assignments.rows.some((row) => row.id === occupied.id));
    const states = await database.pool.query(
      "SELECT id, shelter_id, version FROM families WHERE id = ANY($1::uuid[]) ORDER BY id",
      [moving.map(({ id }) => id)],
    );
    assert.equal(states.rows.filter((row) => row.shelter_id === targetShelterId).length, 1);
    assert.equal(states.rows.filter((row) => row.version === 2).length, 1);
    assert.equal(
      (await database.pool.query(
        "SELECT family_id FROM family_assignment_history WHERE family_id = ANY($1::uuid[])",
        [moving.map(({ id }) => id)],
      )).rowCount,
      1,
      "Only the successful move may write assignment history",
    );
  });

  test("direct family and shelter PATCH requests cannot race past reduced capacity", async () => {
    const targetShelterId = randomUUID();
    const sourceShelterId = randomUUID();
    await createShelter(targetShelterId, 3, "SYNTHETIC-PATCH-RACE-TARGET");
    await createShelter(sourceShelterId, 2, "SYNTHETIC-PATCH-RACE-SOURCE");
    const occupants = await Promise.all([0, 1].map((index) =>
      createExistingFamily(targetShelterId, `patch-race-occupant-${index}`),
    ));
    const moving = await createExistingFamily(sourceShelterId, "patch-race-moving");
    const responses = await race(
      `SELECT id FROM shelter_units WHERE id = '${targetShelterId}' FOR UPDATE`,
      'from "shelter_units"',
      [
        () => request(`/families/${moving.id}`, {
          shelterId: targetShelterId,
          expectedVersion: 1,
        }, "PATCH"),
        () => request(`/shelters/${targetShelterId}`, {
          capacity: 2,
          expectedVersion: 1,
        }, "PATCH"),
      ],
    );
    const moveSucceeded = responses[0].status === 200;
    const capacityReductionSucceeded = responses[1].status === 200;
    assert.notEqual(moveSucceeded, capacityReductionSucceeded, "Exactly one competing PATCH succeeds");
    assert.equal(responses[0].status, moveSucceeded ? 200 : 400);
    if (!moveSucceeded) assert.deepEqual(responses[0].body, { error: "Shelter has reached its capacity" });
    assert.equal(responses[1].status, capacityReductionSucceeded ? 200 : 409);
    if (!capacityReductionSucceeded) {
      assert.deepEqual(responses[1].body, {
        error: "Shelter capacity cannot be lower than its current assignments",
      });
    }
    const shelter = await database.pool.query(
      "SELECT capacity, version FROM shelter_units WHERE id = $1",
      [targetShelterId],
    );
    assert.equal(shelter.rows[0].capacity, capacityReductionSucceeded ? 2 : 3);
    assert.equal(shelter.rows[0].version, capacityReductionSucceeded ? 2 : 1);
    const assignments = await database.pool.query(
      "SELECT id FROM families WHERE shelter_id = $1 AND archived_at IS NULL",
      [targetShelterId],
    );
    assert.equal(assignments.rowCount, capacityReductionSucceeded ? 2 : 3);
    assert(occupants.every(({ id }) => assignments.rows.some((row) => row.id === id)));
    assert(assignments.rowCount <= shelter.rows[0].capacity);
    const movedState = await database.pool.query(
      "SELECT shelter_id, version FROM families WHERE id = $1",
      [moving.id],
    );
    assert.equal(movedState.rows[0].shelter_id, moveSucceeded ? targetShelterId : sourceShelterId);
    assert.equal(movedState.rows[0].version, moveSucceeded ? 2 : 1);
  });

  test("reducing shelter capacity and importing cannot leave assignments above capacity", async () => {
    const shelterId = randomUUID();
    await createShelter(shelterId, 3, "SYNTHETIC-CAPACITY-RACE");
    const occupants = await Promise.all([0, 1].map((index) =>
      createExistingFamily(shelterId, `capacity-occupant-${index}`),
    ));
    const imported = {
      ...family(`capacity-import-${randomUUID()}`, shelterId),
      headName: `Synthetic capacity import ${randomUUID()}`,
    };
    const responses = await race(
      `SELECT id FROM shelter_units WHERE id = '${shelterId}' FOR UPDATE`,
      'from "shelter_units"',
      [
        () => request("/families/import", { campId, families: [imported] }),
        () => request(`/shelters/${shelterId}`, { capacity: 2, expectedVersion: 1 }, "PATCH"),
      ],
    );
    const importSucceeded = responses[0].status === 201;
    const capacityReductionSucceeded = responses[1].status === 200;
    assert.notEqual(importSucceeded, capacityReductionSucceeded, "Exactly one operation succeeds");
    assert.equal(responses[0].status, importSucceeded ? 201 : 400);
    if (!importSucceeded) {
      assert.deepEqual(responses[0].body, {
        error: "عدد الأسر المحدد يتجاوز السعة المتاحة لوحدة إيواء.",
      });
    }
    assert.equal(responses[1].status, capacityReductionSucceeded ? 200 : 409);
    if (!capacityReductionSucceeded) {
      assert.deepEqual(responses[1].body, {
        error: "Shelter capacity cannot be lower than its current assignments",
      });
    }
    const [shelter, assignments, members, importedFamily] = await Promise.all([
      database.pool.query("SELECT capacity, version FROM shelter_units WHERE id = $1", [shelterId]),
      database.pool.query(
        "SELECT id FROM families WHERE shelter_id = $1 AND archived_at IS NULL ORDER BY id",
        [shelterId],
      ),
      database.pool.query(
        "SELECT national_id FROM family_members WHERE national_id = ANY($1::text[])",
        [imported.members.map((member) => member.nationalId)],
      ),
      database.pool.query("SELECT id FROM families WHERE head_name = $1", [imported.headName]),
    ]);
    assert.equal(shelter.rows[0].capacity, capacityReductionSucceeded ? 2 : 3);
    assert.equal(shelter.rows[0].version, capacityReductionSucceeded ? 2 : 1);
    assert.equal(assignments.rowCount, importSucceeded ? 3 : 2);
    assert(
      occupants.every(({ id }) => assignments.rows.some((row) => row.id === id)),
      "Both original shelter occupants must remain assigned",
    );
    assert(assignments.rowCount! <= shelter.rows[0].capacity);
    assert.equal(members.rowCount, importSucceeded ? 2 : 0);
    assert.equal(importedFamily.rowCount, importSucceeded ? 1 : 0);
    if (importSucceeded) {
      assert.equal(
        new Set(members.rows.map((row) => row.national_id)).size,
        2,
        "Both intended imported members must persist",
      );
    }
  });

  test("family archive and shelter capacity PATCH requests serialize without partial writes", async () => {
    const shelterId = randomUUID();
    await createShelter(shelterId, 2, "SYNTHETIC-ARCHIVE-CAPACITY-RACE");
    const families = await Promise.all([0, 1].map((index) =>
      createExistingFamily(shelterId, `archive-capacity-family-${index}`),
    ));
    const archivedFamilyId = families[0].id;
    const responses = await race(
      `SELECT id FROM shelter_units WHERE id = '${shelterId}' FOR UPDATE`,
      'from "shelter_units"',
      [
        () => request(`/families/${archivedFamilyId}/archive`, { expectedVersion: 1 }, "PATCH"),
        () => request(`/shelters/${shelterId}`, { capacity: 1, expectedVersion: 1 }, "PATCH"),
      ],
    );
    const archiveResponse = responses[0];
    const capacityResponse = responses[1];
    const capacityReductionSucceeded = capacityResponse.status === 200;
    assert.equal(archiveResponse.status, 200);
    assert.equal(capacityResponse.status, capacityReductionSucceeded ? 200 : 409);
    if (!capacityReductionSucceeded) {
      assert.deepEqual(capacityResponse.body, {
        error: "Shelter capacity cannot be lower than its current assignments",
      });
    }
    const [shelter, archivedFamily, activeFamilies, audit] = await Promise.all([
      database.pool.query("SELECT capacity, version FROM shelter_units WHERE id = $1", [shelterId]),
      database.pool.query("SELECT status, archived_at, version FROM families WHERE id = $1", [archivedFamilyId]),
      database.pool.query(
        "SELECT id FROM families WHERE shelter_id = $1 AND archived_at IS NULL ORDER BY id",
        [shelterId],
      ),
      database.pool.query(
        "SELECT action, entity_type, entity_id FROM sync_audit_events WHERE entity_id = ANY($1::uuid[])",
        [[shelterId, archivedFamilyId]],
      ),
    ]);
    assert.equal(shelter.rows[0].capacity, capacityReductionSucceeded ? 1 : 2);
    assert.equal(shelter.rows[0].version, capacityReductionSucceeded ? 2 : 1);
    assert.notEqual(archivedFamily.rows[0].archived_at, null);
    assert.equal(archivedFamily.rows[0].version, 2);
    assert.equal(activeFamilies.rowCount, 1);
    assert(audit.rows.some((row) => row.entity_id === archivedFamilyId && row.action === "ARCHIVE"));
    assert(activeFamilies.rowCount <= shelter.rows[0].capacity);
  });

  test("family import uses a place freed by a prior archive and rolls back when import locks first", async () => {
    for (const importLocksFirst of [false, true]) {
      const shelterId = randomUUID();
      const archivedFamilyId = randomUUID();
      const remainingFamilyId = randomUUID();
      const imported = {
        ...family(`archive-import-race-${randomUUID()}`, shelterId),
        headName: `Synthetic archive race ${randomUUID()}`,
      };
      await createShelter(shelterId, 2, `SYNTHETIC-ARCHIVE-IMPORT-${randomUUID()}`);
      await database.db.insert(database.familiesTable).values([
        {
          id: archivedFamilyId,
          campId,
          sectorId,
          shelterId,
          headName: "Synthetic family to archive",
          createdById: actorId,
          status: "ACTIVE",
        },
        {
          id: remainingFamilyId,
          campId,
          sectorId,
          shelterId,
          headName: "Synthetic family staying active",
          createdById: actorId,
          status: "ACTIVE",
        },
      ]);
      const before = await database.pool.query(
        `SELECT (SELECT count(*)::int FROM families) AS families,
                (SELECT count(*)::int FROM family_members) AS members,
                (SELECT count(*)::int FROM sync_audit_events) AS audits,
                (SELECT count(*)::int FROM idempotency_keys) AS claims`,
      );
      const archive = () => request(
        `/families/${archivedFamilyId}/archive`,
        { expectedVersion: 1 },
        "PATCH",
      );
      const importFamily = () => request("/families/import", { campId, families: [imported] });
      const responses = await race(
        `SELECT id FROM shelter_units WHERE id = '${shelterId}' FOR UPDATE`,
        'from "shelter_units"',
        importLocksFirst ? [importFamily, archive] : [archive, importFamily],
      );
      const archiveResponse = responses[importLocksFirst ? 1 : 0];
      const importResponse = responses[importLocksFirst ? 0 : 1];
      const importSucceeded = !importLocksFirst;

      assert.equal(archiveResponse.status, 200);
      assert.equal((archiveResponse.body as { id: string }).id, archivedFamilyId);
      assert.equal((archiveResponse.body as { status: string }).status, "ARCHIVED");
      assert.equal(importResponse.status, importSucceeded ? 201 : 400);
      if (importSucceeded) {
        assert.deepEqual(importResponse.body, { importedCount: 1 });
      } else {
        assert.deepEqual(importResponse.body, {
          error: "عدد الأسر المحدد يتجاوز السعة المتاحة لوحدة إيواء.",
        });
      }

      const [archivedFamily, activeFamilies, importedMembers, importedFamily, audit] = await Promise.all([
        database.pool.query(
          "SELECT status, archived_at, version FROM families WHERE id = $1",
          [archivedFamilyId],
        ),
        database.pool.query(
          "SELECT id FROM families WHERE shelter_id = $1 AND archived_at IS NULL ORDER BY id",
          [shelterId],
        ),
        database.pool.query(
          "SELECT family_id, national_id FROM family_members WHERE national_id = ANY($1::text[])",
          [imported.members.map((member) => member.nationalId)],
        ),
        database.pool.query("SELECT id FROM families WHERE head_name = $1", [imported.headName]),
        database.pool.query(
          `SELECT action, entity_type, entity_id, actor_staff_id FROM sync_audit_events
           WHERE entity_id = ANY($1::uuid[]) ORDER BY entity_id`,
          [[archivedFamilyId]],
        ),
      ]);
      assert.equal(archivedFamily.rows[0].status, "ARCHIVED");
      assert(archivedFamily.rows[0].archived_at);
      assert.equal(archivedFamily.rows[0].version, 2);
      assert(activeFamilies.rows.some((row) => row.id === remainingFamilyId));
      assert.equal(activeFamilies.rowCount, importSucceeded ? 2 : 1);
      assert.equal(importedFamily.rowCount, importSucceeded ? 1 : 0);
      assert.equal(importedMembers.rowCount, importSucceeded ? 2 : 0);
      if (importSucceeded) {
        assert.equal(new Set(importedMembers.rows.map((row) => row.family_id)).size, 1);
        assert.equal(importedMembers.rows[0].family_id, importedFamily.rows[0].id);
      }
      assert.deepEqual(audit.rows, [{
        action: "ARCHIVE",
        entity_type: "FAMILY",
        entity_id: archivedFamilyId,
        actor_staff_id: actorId,
      }]);
      const after = await database.pool.query(
        `SELECT (SELECT count(*)::int FROM families) AS families,
                (SELECT count(*)::int FROM family_members) AS members,
                (SELECT count(*)::int FROM sync_audit_events) AS audits,
                (SELECT count(*)::int FROM idempotency_keys) AS claims`,
      );
      assert.equal(after.rows[0].families, before.rows[0].families + Number(importSucceeded));
      assert.equal(after.rows[0].members, before.rows[0].members + (importSucceeded ? 2 : 0));
      assert.equal(after.rows[0].audits, before.rows[0].audits + 1 + Number(importSucceeded));
      assert.equal(after.rows[0].claims, before.rows[0].claims + Number(importSucceeded));
    }
  });

  test("a family move and the archive freeing its final place serialize on the shelter row", async () => {
    for (const archiveFirst of [true, false]) {
      const targetShelterId = randomUUID();
      const sourceShelterId = randomUUID();
      await createShelter(targetShelterId, 1, `SYNTHETIC-MOVE-ARCHIVE-${randomUUID().slice(0, 8)}`);
      await createShelter(sourceShelterId, 2, `SYNTHETIC-MOVE-SOURCE-${randomUUID().slice(0, 8)}`);
      const archivedFamily = await createExistingFamily(targetShelterId, "last-place-resident");
      const movingFamily = await createExistingFamily(sourceShelterId, "incoming-family");
      const archive = () => request(
        `/families/${archivedFamily.id}/archive`,
        { expectedVersion: 1 },
        "PATCH",
      );
      const move = () => request(
        `/families/${movingFamily.id}`,
        { shelterId: targetShelterId, expectedVersion: 1 },
        "PATCH",
      );
      const responses = await race(
        `SELECT id FROM shelter_units WHERE id = '${targetShelterId}' FOR UPDATE`,
        'from "shelter_units"',
        archiveFirst ? [archive, move] : [move, archive],
      );
      const archiveResponse = responses[archiveFirst ? 0 : 1];
      const moveResponse = responses[archiveFirst ? 1 : 0];
      const moveSucceeded = archiveFirst;
      assert.equal(archiveResponse.status, 200);
      assert.equal(moveResponse.status, moveSucceeded ? 200 : 400);
      if (!moveSucceeded) {
        assert.deepEqual(moveResponse.body, { error: "Shelter has reached its capacity" });
      }

      const [targetAssignments, archivedState, movingState, history, audit] = await Promise.all([
        database.pool.query(
          "SELECT count(*)::int AS count FROM families WHERE shelter_id = $1 AND archived_at IS NULL",
          [targetShelterId],
        ),
        database.pool.query(
          "SELECT status, archived_at, version FROM families WHERE id = $1",
          [archivedFamily.id],
        ),
        database.pool.query(
          "SELECT shelter_id, version FROM families WHERE id = $1",
          [movingFamily.id],
        ),
        database.pool.query(
          "SELECT from_shelter_id, to_shelter_id FROM family_assignment_history WHERE family_id = $1",
          [movingFamily.id],
        ),
        database.pool.query(
          `SELECT action, entity_id, actor_staff_id FROM sync_audit_events
           WHERE entity_id = ANY($1::uuid[]) ORDER BY entity_id, action`,
          [[archivedFamily.id, movingFamily.id]],
        ),
      ]);
      assert.equal(targetAssignments.rows[0].count, moveSucceeded ? 1 : 0);
      assert(targetAssignments.rows[0].count <= 1);
      assert.equal(archivedState.rows[0].status, "ARCHIVED");
      assert(archivedState.rows[0].archived_at);
      assert.equal(archivedState.rows[0].version, 2);
      assert.equal(movingState.rows[0].shelter_id, moveSucceeded ? targetShelterId : sourceShelterId);
      assert.equal(movingState.rows[0].version, moveSucceeded ? 2 : 1);
      assert.equal(history.rowCount, moveSucceeded ? 1 : 0);
      if (moveSucceeded) {
        assert.deepEqual(history.rows[0], {
          from_shelter_id: sourceShelterId,
          to_shelter_id: targetShelterId,
        });
      }
      const expectedAudit = [
        ["ARCHIVE", archivedFamily.id, actorId],
        ...(moveSucceeded ? [["UPDATE", movingFamily.id, actorId]] : []),
      ].sort((left, right) => `${left[1]}:${left[0]}`.localeCompare(`${right[1]}:${right[0]}`));
      assert.deepEqual(
        audit.rows.map((row) => [row.action, row.entity_id, row.actor_staff_id]),
        expectedAudit,
      );
    }
  });

  test("a stale family archive cannot free a full shelter for a concurrent move", async () => {
    for (const archiveFirst of [true, false]) {
      const targetShelterId = randomUUID();
      const sourceShelterId = randomUUID();
      await createShelter(targetShelterId, 1, `SYNTHETIC-STALE-ARCHIVE-${randomUUID().slice(0, 8)}`);
      await createShelter(sourceShelterId, 2, `SYNTHETIC-STALE-SOURCE-${randomUUID().slice(0, 8)}`);
      const residentFamilyId = randomUUID();
      const movingFamilyId = randomUUID();
      await database.db.insert(database.familiesTable).values([
        {
          id: residentFamilyId,
          campId,
          sectorId,
          shelterId: targetShelterId,
          headName: "Synthetic resident with a newer version",
          createdById: actorId,
          status: "ACTIVE",
          version: 2,
        },
        {
          id: movingFamilyId,
          campId,
          sectorId,
          shelterId: sourceShelterId,
          headName: "Synthetic family waiting to move",
          createdById: actorId,
          status: "ACTIVE",
        },
      ]);
      const archive = () => request(
        `/families/${residentFamilyId}/archive`,
        { expectedVersion: 1 },
        "PATCH",
      );
      const move = () => request(
        `/families/${movingFamilyId}`,
        { shelterId: targetShelterId, expectedVersion: 1 },
        "PATCH",
      );
      const responses = await race(
        `SELECT id FROM shelter_units WHERE id = '${targetShelterId}' FOR UPDATE`,
        'from "shelter_units"',
        archiveFirst ? [archive, move] : [move, archive],
      );
      const archiveResponse = responses[archiveFirst ? 0 : 1];
      const moveResponse = responses[archiveFirst ? 1 : 0];
      assert.equal(archiveResponse.status, 409);
      assert.deepEqual(archiveResponse.body, {
        error: "Family has been updated; refresh and retry with the current version",
        code: "VERSION_CONFLICT",
        currentVersion: 2,
      });
      assert.equal(moveResponse.status, 400);
      assert.deepEqual(moveResponse.body, { error: "Shelter has reached its capacity" });

      const [assignments, resident, moving, history, audit] = await Promise.all([
        database.pool.query(
          "SELECT count(*)::int AS count FROM families WHERE shelter_id = $1 AND archived_at IS NULL",
          [targetShelterId],
        ),
        database.pool.query(
          "SELECT status, archived_at, version FROM families WHERE id = $1",
          [residentFamilyId],
        ),
        database.pool.query(
          "SELECT shelter_id, status, archived_at, version FROM families WHERE id = $1",
          [movingFamilyId],
        ),
        database.pool.query(
          "SELECT family_id FROM family_assignment_history WHERE family_id = ANY($1::uuid[])",
          [[residentFamilyId, movingFamilyId]],
        ),
        database.pool.query(
          "SELECT entity_id FROM sync_audit_events WHERE entity_id = ANY($1::uuid[])",
          [[residentFamilyId, movingFamilyId]],
        ),
      ]);
      assert.equal(assignments.rows[0].count, 1, "The full shelter must remain full");
      assert.deepEqual(resident.rows[0], { status: "ACTIVE", archived_at: null, version: 2 });
      assert.deepEqual(moving.rows[0], {
        shelter_id: sourceShelterId,
        status: "ACTIVE",
        archived_at: null,
        version: 1,
      });
      assert.equal(history.rowCount, 0, "Rejected operations must not create assignment history");
      assert.equal(audit.rowCount, 0, "Rejected operations must not create audit records");
    }
  });

  test("concurrent archive and reassignment of the same family obey the winning lock order", async () => {
    for (const archiveFirst of [true, false]) {
      const sourceShelterId = randomUUID();
      const targetShelterId = randomUUID();
      await createShelter(sourceShelterId, 2, `SYNTHETIC-SAME-FAMILY-SOURCE-${randomUUID().slice(0, 8)}`);
      await createShelter(targetShelterId, 2, `SYNTHETIC-SAME-FAMILY-TARGET-${randomUUID().slice(0, 8)}`);
      const existingFamily = await createExistingFamily(sourceShelterId, "archive-reassign-race");
      const archive = () => request(
        `/families/${existingFamily.id}/archive`,
        { expectedVersion: 1 },
        "PATCH",
      );
      const reassign = () => request(
        `/families/${existingFamily.id}`,
        { shelterId: targetShelterId, expectedVersion: 1 },
        "PATCH",
      );
      const responses = await race(
        `SELECT id FROM shelter_units WHERE id = '${sourceShelterId}' FOR UPDATE`,
        'from "shelter_units"',
        archiveFirst ? [archive, reassign] : [reassign, archive],
      );
      const archiveResponse = responses[archiveFirst ? 0 : 1];
      const reassignmentResponse = responses[archiveFirst ? 1 : 0];
      assert.equal(archiveResponse.status, archiveFirst ? 200 : 409);
      assert.equal(reassignmentResponse.status, archiveFirst ? 409 : 200);
      const conflictResponse = archiveFirst ? reassignmentResponse : archiveResponse;
      if (conflictResponse.status === 409) {
        assert.deepEqual(conflictResponse.body, {
          error: "Family has been updated; refresh and retry with the current version",
          code: "VERSION_CONFLICT",
          currentVersion: 2,
        });
      }

      const [persisted, history, audit] = await Promise.all([
        database.pool.query(
          "SELECT shelter_id, status, archived_at, version FROM families WHERE id = $1",
          [existingFamily.id],
        ),
        database.pool.query(
          "SELECT from_shelter_id, to_shelter_id FROM family_assignment_history WHERE family_id = $1",
          [existingFamily.id],
        ),
        database.pool.query(
          "SELECT action, entity_id, actor_staff_id FROM sync_audit_events WHERE entity_id = $1 ORDER BY action",
          [existingFamily.id],
        ),
      ]);
      assert.equal(persisted.rowCount, 1);
      assert.equal(persisted.rows[0].shelter_id, archiveFirst ? sourceShelterId : targetShelterId);
      assert.equal(persisted.rows[0].status, archiveFirst ? "ARCHIVED" : "ACTIVE");
      assert.equal(Boolean(persisted.rows[0].archived_at), archiveFirst);
      assert.equal(persisted.rows[0].version, 2);
      assert.equal(history.rowCount, archiveFirst ? 0 : 1);
      if (!archiveFirst) {
        assert.deepEqual(history.rows[0], {
          from_shelter_id: sourceShelterId,
          to_shelter_id: targetShelterId,
        });
      }
      assert.deepEqual(audit.rows.map((row) => [row.action, row.entity_id, row.actor_staff_id]), [
        [archiveFirst ? "ARCHIVE" : "UPDATE", existingFamily.id, actorId],
      ]);
    }
  });

  test("a stale family archive cannot overwrite a concurrent family edit or add an archive audit", async () => {
    const shelterId = randomUUID();
    await createShelter(shelterId, 3, "SYNTHETIC-EDIT-ARCHIVE-RACE");
    const existingFamily = await createExistingFamily(shelterId, "edit-archive-race");
    const responses = await race(
      `SELECT id FROM shelter_units WHERE id = '${shelterId}' FOR UPDATE`,
      'from "shelter_units"',
      [
        () => request(`/families/${existingFamily.id}`, {
          headName: "Edited by the winning employee",
          expectedVersion: 1,
        }, "PATCH"),
        () => request(`/families/${existingFamily.id}/archive`, { expectedVersion: 1 }, "PATCH"),
      ],
    );
    assert.equal(responses[0].status, 200);
    assert.equal(responses[1].status, 409);
    assert.deepEqual(responses[1].body, {
      error: "Family has been updated; refresh and retry with the current version",
      code: "VERSION_CONFLICT",
      currentVersion: 2,
    });
    const persisted = await database.pool.query(
      "SELECT head_name, status, archived_at, version FROM families WHERE id = $1",
      [existingFamily.id],
    );
    assert.deepEqual(persisted.rows, [{
      head_name: "Edited by the winning employee",
      status: "ACTIVE",
      archived_at: null,
      version: 2,
    }]);
    const audits = await database.pool.query(
      `SELECT action, entity_type, entity_id, actor_staff_id
       FROM sync_audit_events WHERE entity_id = $1 ORDER BY action`,
      [existingFamily.id],
    );
    assert.deepEqual(audits.rows, [{
      action: "UPDATE",
      entity_type: "FAMILY",
      entity_id: existingFamily.id,
      actor_staff_id: actorId,
    }]);
  });

  test("repeated family archive returns an explicit already-archived conflict without another audit", async () => {
    const { db, shelterUnitsTable, familiesTable } = database;
    const shelterId = randomUUID();
    const familyId = randomUUID();
    await db.insert(shelterUnitsTable).values({
      id: shelterId, sectorId, code: "SYNTHETIC-REPEATED-FAMILY-ARCHIVE", capacity: 3,
    });
    await db.insert(familiesTable).values({
      id: familyId, campId, sectorId, shelterId,
      headName: "Synthetic family to archive twice",
      createdById: actorId, status: "ACTIVE",
    });

    const archiveBody = { expectedVersion: 1 };
    const firstResponse = await request(`/families/${familyId}/archive`, archiveBody, "PATCH");
    const retryResponse = await request(`/families/${familyId}/archive`, archiveBody, "PATCH");

    assert.equal(firstResponse.status, 200, "The first archive request must commit");
    assert.equal(retryResponse.status, 409, "A repeated archive must identify the already-archived state");
    assert.deepEqual(retryResponse.body, {
      error: "Family is already archived",
      code: "FAMILY_ALREADY_ARCHIVED",
      currentVersion: 2,
    });

    const audits = await database.pool.query(
      `SELECT action, entity_type, entity_id, actor_staff_id
       FROM sync_audit_events WHERE entity_id = $1 ORDER BY action`,
      [familyId],
    );
    assert.deepEqual(audits.rows, [{
      action: "ARCHIVE",
      entity_type: "FAMILY",
      entity_id: familyId,
      actor_staff_id: actorId,
    }], "The rejected repeated archive must not create a second audit event");
  });

  test("simultaneous family archives with the same version create one archive record", async () => {
    const { db, shelterUnitsTable, familiesTable } = database;
    const shelterId = randomUUID();
    const familyId = randomUUID();
    await db.insert(shelterUnitsTable).values({
      id: shelterId, sectorId, code: "SYNTHETIC-SIMULTANEOUS-FAMILY-ARCHIVE", capacity: 3,
    });
    await db.insert(familiesTable).values({
      id: familyId, campId, sectorId, shelterId,
      headName: "Synthetic family for simultaneous archive",
      createdById: actorId, status: "ACTIVE",
    });

    const responses = await race(
      `SELECT id FROM shelter_units WHERE id = '${shelterId}' FOR UPDATE`,
      'from "shelter_units"',
      [
        () => request(`/families/${familyId}/archive`, { expectedVersion: 1 }, "PATCH"),
        () => request(`/families/${familyId}/archive`, { expectedVersion: 1 }, "PATCH"),
      ],
    );

    const successes = responses.filter((response) => response.status === 200);
    const conflicts = responses.filter((response) => response.status === 409);
    assert.equal(successes.length, 1, "Exactly one archive request must succeed");
    assert.equal(conflicts.length, 1, "The competing archive must return a conflict");
    assert.deepEqual(conflicts[0].body, {
      error: "Family is already archived",
      code: "FAMILY_ALREADY_ARCHIVED",
      currentVersion: 2,
    });

    const [persistedFamily, audits] = await Promise.all([
      database.pool.query(
        "SELECT status, archived_at, version FROM families WHERE id = $1",
        [familyId],
      ),
      database.pool.query(
        `SELECT action, entity_type, entity_id, actor_staff_id
         FROM sync_audit_events WHERE entity_id = $1 ORDER BY action`,
        [familyId],
      ),
    ]);
    assert.equal(persistedFamily.rowCount, 1);
    assert.equal(persistedFamily.rows[0].status, "ARCHIVED");
    assert(persistedFamily.rows[0].archived_at, "The winning archive must set archived_at");
    assert.equal(persistedFamily.rows[0].version, 2, "The family version must advance exactly once");
    assert.deepEqual(audits.rows, [{
      action: "ARCHIVE",
      entity_type: "FAMILY",
      entity_id: familyId,
      actor_staff_id: actorId,
    }], "Only the winning archive may write an audit event");
  });
});
