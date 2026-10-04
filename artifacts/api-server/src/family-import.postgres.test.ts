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
    "families", "family_members", "family_assignment_history", "idempotency_keys", "sync_audit_events",
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

  async function request(path: string, body: unknown, method: "POST" | "PATCH" = "POST") {
    // Distinct keys prevent idempotency from serializing the competing writes.
    const key = path === "/families/import"
      ? `sha256-${createHash("sha256").update(randomUUID()).digest("hex")}`
      : method === "PATCH" ? undefined : randomUUID();
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...headers, ...(key ? { "Idempotency-Key": key } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
    });
    return { status: response.status, body: await response.json() };
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

  async function race(lockSql: string, fragment: string, operations: Array<() => ReturnType<typeof request>>) {
    const blocker = await database.pool.connect();
    const pending: Array<ReturnType<typeof request>> = [];
    try {
      await blocker.query("BEGIN");
      await blocker.query(lockSql);
      for (const operation of operations) {
        const requestPromise = operation();
        pending.push(requestPromise);
        // Drain requests and avoid unhandled rejections if a later waiter times out.
        void requestPromise.catch(() => {});
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

  test("concurrent import and family reassignment cannot exceed shelter capacity", async () => {
    const { db, shelterUnitsTable, familiesTable, familyMembersTable } = database;
    const targetShelterId = randomUUID();
    const sourceShelterId = randomUUID();
    const occupiedFamilyId = randomUUID();
    const movingFamilyId = randomUUID();
    const movingMemberId = `moving-${randomUUID()}`;
    await db.insert(shelterUnitsTable).values([
      { id: targetShelterId, sectorId, code: "SYNTHETIC-IMPORT-MOVE-TARGET", capacity: 2 },
      { id: sourceShelterId, sectorId, code: "SYNTHETIC-IMPORT-MOVE-SOURCE", capacity: 2 },
    ]);
    await db.insert(familiesTable).values([
      {
        id: occupiedFamilyId, campId, sectorId, shelterId: targetShelterId,
        headName: "Synthetic target occupant", createdById: actorId, status: "ACTIVE",
      },
      {
        id: movingFamilyId, campId, sectorId, shelterId: sourceShelterId,
        headName: "Synthetic family to move", createdById: actorId, status: "ACTIVE",
      },
    ]);
    await db.insert(familyMembersTable).values({
      familyId: movingFamilyId,
      fullName: "Synthetic moving family member",
      nationalId: movingMemberId,
      gender: "MALE",
      relationship: "HEAD",
    });

    const imported = family(`import-${randomUUID()}`, targetShelterId);
    const before = await database.pool.query(
      `SELECT
         (SELECT count(*)::int FROM families) AS families,
         (SELECT count(*)::int FROM family_members) AS members,
         (SELECT count(*)::int FROM family_assignment_history) AS assignments,
         (SELECT count(*)::int FROM sync_audit_events) AS audits,
         (SELECT count(*)::int FROM idempotency_keys) AS claims`,
    );
    const responses = await race(
      "SELECT id FROM shelter_units WHERE id = '" + targetShelterId + "' FOR UPDATE",
      'from "shelter_units"',
      [
        () => request("/families/import", { campId, families: [imported] }),
        () => request(`/families/${movingFamilyId}`, { shelterId: targetShelterId, expectedVersion: 1 }, "PATCH"),
      ],
    );

    const importWon = responses[0].status === 201;
    const moveWon = responses[1].status === 200;
    assert.equal(Number(importWon) + Number(moveWon), 1, "Exactly one write takes the final shelter place");
    assert.equal(responses[0].status, importWon ? 201 : 400);
    assert.equal(responses[1].status, moveWon ? 200 : 400);
    if (!importWon) {
      assert.deepEqual(responses[0].body, { error: "عدد الأسر المحدد يتجاوز السعة المتاحة لوحدة إيواء." });
    }
    if (!moveWon) {
      assert.deepEqual(responses[1].body, { error: "Shelter has reached its capacity" });
    }

    const assignments = await database.pool.query(
      `SELECT id FROM families
       WHERE shelter_id = $1 AND archived_at IS NULL`,
      [targetShelterId],
    );
    assert.equal(assignments.rowCount, 2, "The full shelter is never over capacity");
    assert(assignments.rows.some((row) => row.id === occupiedFamilyId), "The existing occupant remains assigned");

    const movingFamily = await database.pool.query(
      "SELECT shelter_id FROM families WHERE id = $1",
      [movingFamilyId],
    );
    assert.equal(movingFamily.rows[0].shelter_id, moveWon ? targetShelterId : sourceShelterId);
    const importedMembers = await database.pool.query(
      "SELECT family_id, national_id FROM family_members WHERE national_id = ANY($1::text[])",
      [imported.members.map((member) => member.nationalId)],
    );
    assert.equal(importedMembers.rowCount, importWon ? 2 : 0, "A rejected import leaves no partial members");

    const after = await database.pool.query(
      `SELECT
         (SELECT count(*)::int FROM families) AS families,
         (SELECT count(*)::int FROM family_members) AS members,
         (SELECT count(*)::int FROM family_assignment_history) AS assignments,
         (SELECT count(*)::int FROM sync_audit_events) AS audits,
         (SELECT count(*)::int FROM idempotency_keys) AS claims`,
    );
    assert.equal(after.rows[0].families, before.rows[0].families + Number(importWon));
    assert.equal(after.rows[0].members, before.rows[0].members + (importWon ? 2 : 0));
    assert.equal(after.rows[0].assignments, before.rows[0].assignments + Number(moveWon), "Only a successful move records assignment history");
    assert.equal(after.rows[0].audits, before.rows[0].audits + 1, "Only the successful operation is audited");
    assert.equal(after.rows[0].claims, before.rows[0].claims + Number(importWon), "Rejected writes leave no import claim");
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
    const imports = [firstImport, secondImport];
    const blocker = await database.pool.connect();
    const pending: Array<ReturnType<typeof request>> = [];
    let blockerOpen = true;

    try {
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM shelter_units WHERE id = $1 FOR UPDATE",
        [firstShelterId],
      );

      // Queue the first file on the lower shelter ID before starting the
      // inverse-order file. If locks followed file order, the latter could
      // hold the other shelter while waiting here, creating a deadlock when
      // PostgreSQL grants this lock to the first transaction.
      pending.push(request("/families/import", { campId, families: firstImport }));
      void pending[0].catch(() => {});
      await waitForBlockedWrites('from "shelter_units"', 1);

      pending.push(request("/families/import", { campId, families: secondImport }));
      const results = Promise.all(pending);
      void results.catch(() => {});
      await waitForBlockedWrites('from "shelter_units"', 2);

      await blocker.query("COMMIT");
      blockerOpen = false;
      const responses = await results;
      assert.deepEqual(responses.map((response) => response.status), [201, 201]);
      assert.deepEqual(responses.map((response) => response.body), [
        { importedCount: 2 },
        { importedCount: 2 },
      ]);
    } finally {
      if (blockerOpen) await blocker.query("ROLLBACK");
      blocker.release();
      await Promise.allSettled(pending);
    }

    const expectedMembers = imports.flatMap((families) =>
      families.flatMap((entry) => entry.members.map((member) => [member.nationalId, entry.shelterId])),
    ).sort(([leftId], [rightId]) => String(leftId).localeCompare(String(rightId)));
    const persistedMembers = await database.pool.query(
      `SELECT m.national_id, f.shelter_id
       FROM family_members m
       JOIN families f ON f.id = m.family_id
       WHERE m.national_id = ANY($1::text[])
       ORDER BY m.national_id`,
      [expectedMembers.map(([nationalId]) => nationalId)],
    );
    assert.equal(persistedMembers.rowCount, 8, "Both imports must persist all four families' members");
    assert.deepEqual(
      persistedMembers.rows.map((row) => [row.national_id, row.shelter_id]),
      expectedMembers,
      "Every synthetic member must belong to its requested shelter",
    );

    const familiesPerShelter = await database.pool.query(
      `SELECT shelter_id, count(*)::int AS count
       FROM families
       WHERE shelter_id = ANY($1::uuid[]) AND archived_at IS NULL
       GROUP BY shelter_id
       ORDER BY shelter_id`,
      [[firstShelterId, secondShelterId]],
    );
    assert.deepEqual(
      familiesPerShelter.rows.map((row) => [row.shelter_id, row.count]),
      [[firstShelterId, 2], [secondShelterId, 2]],
    );

    const membersPerFamily = await database.pool.query(
      `SELECT family_id, count(*)::int AS count
       FROM family_members
       WHERE national_id = ANY($1::text[])
       GROUP BY family_id
       ORDER BY family_id`,
      [expectedMembers.map(([nationalId]) => nationalId)],
    );
    assert.equal(membersPerFamily.rowCount, 4, "All four imported families must persist");
    assert(membersPerFamily.rows.every((row) => row.count === 2), "Each imported family must have both members");
  });

  test("concurrent family transfers with reversed shelter order both finish without deadlock", async () => {
    const { db, shelterUnitsTable, familiesTable, familyMembersTable } = database;
    const [firstShelterId, secondShelterId] = [randomUUID(), randomUUID()].sort();
    await db.insert(shelterUnitsTable).values([
      { id: firstShelterId, sectorId, code: "SYNTHETIC-TRANSFER-A", capacity: 2 },
      { id: secondShelterId, sectorId, code: "SYNTHETIC-TRANSFER-B", capacity: 2 },
    ]);

    const families = [
      { id: randomUUID(), input: family(`transfer-first-${randomUUID()}`, firstShelterId) },
      { id: randomUUID(), input: family(`transfer-second-${randomUUID()}`, secondShelterId) },
    ];
    await db.insert(familiesTable).values(families.map(({ id, input }) => ({
      id,
      campId,
      sectorId,
      shelterId: input.shelterId,
      headName: input.headName,
      createdById: actorId,
      status: "ACTIVE" as const,
    })));
    await db.insert(familyMembersTable).values(families.flatMap(({ id, input }) =>
      input.members.map((member) => ({
        familyId: id,
        fullName: member.fullName,
        nationalId: member.nationalId,
        gender: member.gender as "MALE" | "FEMALE" | "OTHER",
        relationship: member.relationship,
      })),
    ));

    const blocker = await database.pool.connect();
    const pending: Array<ReturnType<typeof request>> = [];
    let blockerOpen = true;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM shelter_units WHERE id = $1 FOR UPDATE", [firstShelterId]);

      // Queue the lower-ID -> higher-ID transfer first, then its inverse.
      // Without consistent ordering, the second transaction can hold the
      // higher-ID shelter while waiting for this blocker, deadlocking the first.
      pending.push(request(`/families/${families[0].id}`, {
        shelterId: secondShelterId, expectedVersion: 1,
      }, "PATCH"));
      void pending[0].catch(() => {});
      await waitForBlockedWrites('from "shelter_units"', 1);

      pending.push(request(`/families/${families[1].id}`, {
        shelterId: firstShelterId, expectedVersion: 1,
      }, "PATCH"));
      const results = Promise.all(pending);
      void results.catch(() => {});
      await waitForBlockedWrites('from "shelter_units"', 2);

      await blocker.query("COMMIT");
      blockerOpen = false;
      const responses = await results;
      assert.deepEqual(responses.map((response) => response.status), [200, 200]);
      assert.deepEqual(
        responses.map((response) => (response.body as { shelterId: string }).shelterId),
        [secondShelterId, firstShelterId],
      );
    } finally {
      if (blockerOpen) await blocker.query("ROLLBACK");
      blocker.release();
      await Promise.allSettled(pending);
    }

    const persistedFamilies = await database.pool.query(
      `SELECT id, shelter_id, version FROM families
       WHERE id = ANY($1::uuid[]) ORDER BY id`,
      [families.map(({ id }) => id)],
    );
    const expectedAssignments = [
      [families[0].id, secondShelterId, 2],
      [families[1].id, firstShelterId, 2],
    ].sort(([leftId], [rightId]) => String(leftId).localeCompare(String(rightId)));
    assert.deepEqual(
      persistedFamilies.rows.map((row) => [row.id, row.shelter_id, row.version]),
      expectedAssignments,
      "Both families must end in their requested shelter and increment exactly once",
    );

    const expectedMembers = families.flatMap(({ id, input }) =>
      input.members.map((member) => [id, member.nationalId]),
    ).sort(([leftFamily, leftNationalId], [rightFamily, rightNationalId]) =>
      `${leftFamily}:${leftNationalId}`.localeCompare(`${rightFamily}:${rightNationalId}`),
    );
    const persistedMembers = await database.pool.query(
      `SELECT family_id, national_id FROM family_members
       WHERE family_id = ANY($1::uuid[]) ORDER BY family_id, national_id`,
      [families.map(({ id }) => id)],
    );
    assert.equal(persistedMembers.rowCount, 4, "Both families must retain both members");
    assert.deepEqual(
      persistedMembers.rows.map((row) => [row.family_id, row.national_id]),
      expectedMembers,
      "Every member must remain associated with its original family",
    );

    const assignmentHistory = await database.pool.query(
      `SELECT family_id, from_shelter_id, to_shelter_id
       FROM family_assignment_history
       WHERE family_id = ANY($1::uuid[]) ORDER BY family_id`,
      [families.map(({ id }) => id)],
    );
    const expectedHistory = [
      [families[0].id, firstShelterId, secondShelterId],
      [families[1].id, secondShelterId, firstShelterId],
    ].sort(([leftId], [rightId]) => String(leftId).localeCompare(String(rightId)));
    assert.deepEqual(
      assignmentHistory.rows.map((row) => [row.family_id, row.from_shelter_id, row.to_shelter_id]),
      expectedHistory,
      "Both successful moves must have matching assignment history",
    );

    const occupiedPerShelter = await database.pool.query(
      `SELECT s.id, s.capacity, count(f.id)::int AS occupied
       FROM shelter_units s
       LEFT JOIN families f ON f.shelter_id = s.id AND f.archived_at IS NULL
       WHERE s.id = ANY($1::uuid[])
       GROUP BY s.id, s.capacity ORDER BY s.id`,
      [[firstShelterId, secondShelterId]],
    );
    assert.deepEqual(
      occupiedPerShelter.rows.map((row) => [row.id, row.capacity, row.occupied]),
      [[firstShelterId, 2, 1], [secondShelterId, 2, 1]],
      "Shelter assignments must remain within capacity after both transfers",
    );
  });

  test("a family move and import cannot both take the final place in the same shelter", async () => {
    const { db, shelterUnitsTable, familiesTable } = database;
    const targetShelterId = randomUUID();
    const sourceShelterId = randomUUID();
    await db.insert(shelterUnitsTable).values([
      { id: targetShelterId, sectorId, code: "SYNTHETIC-MOVE-TARGET", capacity: 2 },
      { id: sourceShelterId, sectorId, code: "SYNTHETIC-MOVE-SOURCE", capacity: 2 },
    ]);
    const occupiedId = randomUUID();
    const movingFamilyId = randomUUID();
    await db.insert(familiesTable).values([
      {
        id: occupiedId, campId, sectorId, shelterId: targetShelterId,
        headName: "Synthetic target occupant", createdById: actorId, status: "ACTIVE",
      },
      {
        id: movingFamilyId, campId, sectorId, shelterId: sourceShelterId,
        headName: "Synthetic moving family", createdById: actorId, status: "ACTIVE",
      },
    ]);
    const imported = family(`move-race-${randomUUID()}`, targetShelterId);
    const before = await database.pool.query(
      "SELECT (SELECT count(*)::int FROM families) AS families",
    );
    const responses = await race(
      `SELECT id FROM shelter_units WHERE id = '${targetShelterId}' FOR UPDATE`,
      'from "shelter_units"',
      [
        () => request(`/families/${movingFamilyId}`, {
          shelterId: targetShelterId,
          expectedVersion: 1,
        }, "PATCH"),
        () => request("/families/import", { campId, families: [imported] }),
      ],
    );
    const moveSucceeded = responses[0].status === 200;
    const importSucceeded = responses[1].status === 201;
    assert.notEqual(importSucceeded, moveSucceeded, "Exactly one operation succeeds");
    assert.equal(responses[importSucceeded ? 0 : 1].status, 400);
    assert.deepEqual(responses[importSucceeded ? 0 : 1].body, {
      error: importSucceeded
        ? "Shelter has reached its capacity"
        : "عدد الأسر المحدد يتجاوز السعة المتاحة لوحدة إيواء.",
    });

    const assignments = await database.pool.query(
      `SELECT id FROM families
       WHERE shelter_id = $1 AND archived_at IS NULL
       ORDER BY id`,
      [targetShelterId],
    );
    assert.equal(assignments.rowCount, 2, "The target shelter must never exceed capacity");
    assert(assignments.rows.some((row) => row.id === occupiedId), "The existing occupant stays assigned");

    const movedFamily = await database.pool.query(
      "SELECT shelter_id, version FROM families WHERE id = $1",
      [movingFamilyId],
    );
    assert.equal(movedFamily.rowCount, 1);
    assert.equal(movedFamily.rows[0].shelter_id, moveSucceeded ? targetShelterId : sourceShelterId);
    assert.equal(movedFamily.rows[0].version, moveSucceeded ? 2 : 1, "A rejected move must not partially update the family");
    const history = await database.pool.query(
      "SELECT from_shelter_id, to_shelter_id FROM family_assignment_history WHERE family_id = $1",
      [movingFamilyId],
    );
    assert.equal(history.rowCount, moveSucceeded ? 1 : 0, "Only a successful move may write assignment history");
    if (moveSucceeded) {
      assert.deepEqual(history.rows[0], { from_shelter_id: sourceShelterId, to_shelter_id: targetShelterId });
    }

    const importedMembers = await database.pool.query(
      "SELECT family_id, national_id FROM family_members WHERE national_id = ANY($1::text[])",
      [[...imported.members].map((member) => member.nationalId)],
    );
    assert.equal(importedMembers.rowCount, importSucceeded ? 2 : 0, "A rejected import must not leave partial members");
    if (importSucceeded) {
      assert.equal(new Set(importedMembers.rows.map((row) => row.family_id)).size, 1);
      assert(assignments.rows.some((row) => row.id === importedMembers.rows[0].family_id));
    }
    const after = await database.pool.query("SELECT count(*)::int AS families FROM families");
    assert.equal(after.rows[0].families, before.rows[0].families + Number(importSucceeded));
  });

  test("reducing shelter capacity and importing cannot leave assignments above capacity", async () => {
    const { db, shelterUnitsTable, familiesTable } = database;
    const shelterId = randomUUID();
    await db.insert(shelterUnitsTable).values({
      id: shelterId, sectorId, code: "SYNTHETIC-CAPACITY-RACE", capacity: 3,
    });
    await db.insert(familiesTable).values([1, 2].map((index) => ({
      id: randomUUID(), campId, sectorId, shelterId,
      headName: `Synthetic capacity occupant ${index}`,
      createdById: actorId, status: "ACTIVE" as const,
    })));
    const imported = family(`capacity-race-${randomUUID()}`, shelterId);
    const before = await database.pool.query(
      "SELECT (SELECT count(*)::int FROM families) AS families",
    );
    const responses = await race(
      `SELECT id FROM shelter_units WHERE id = '${shelterId}' FOR UPDATE`,
      'from "shelter_units"',
      [
        () => request("/families/import", { campId, families: [imported] }),
        () => request(`/shelters/${shelterId}`, {
          capacity: 2,
          expectedVersion: 1,
        }, "PATCH"),
      ],
    );
    const importSucceeded = responses[0].status === 201;
    const capacityReductionSucceeded = responses[1].status === 200;
    assert.notEqual(importSucceeded, capacityReductionSucceeded, "Exactly one operation succeeds");
    assert.equal(responses[importSucceeded ? 1 : 0].status, importSucceeded ? 409 : 400);
    assert.deepEqual(responses[importSucceeded ? 1 : 0].body, {
      error: importSucceeded
        ? "Shelter capacity cannot be lower than its current assignments"
        : "عدد الأسر المحدد يتجاوز السعة المتاحة لوحدة إيواء.",
    });

    const shelter = await database.pool.query(
      "SELECT capacity, version FROM shelter_units WHERE id = $1",
      [shelterId],
    );
    assert.equal(shelter.rowCount, 1);
    assert.equal(shelter.rows[0].capacity, capacityReductionSucceeded ? 2 : 3);
    assert.equal(shelter.rows[0].version, capacityReductionSucceeded ? 2 : 1);
    const assignments = await database.pool.query(
      "SELECT count(*)::int AS count FROM families WHERE shelter_id = $1 AND archived_at IS NULL",
      [shelterId],
    );
    assert(assignments.rows[0].count <= shelter.rows[0].capacity, "Assigned families must stay within the committed capacity");

    const importedMembers = await database.pool.query(
      "SELECT family_id, national_id FROM family_members WHERE national_id = ANY($1::text[])",
      [[...imported.members].map((member) => member.nationalId)],
    );
    assert.equal(importedMembers.rowCount, importSucceeded ? 2 : 0, "A rejected import must not leave partial members");
    if (importSucceeded) {
      assert.equal(new Set(importedMembers.rows.map((row) => row.family_id)).size, 1);
    }
    const after = await database.pool.query("SELECT count(*)::int AS families FROM families");
    assert.equal(after.rows[0].families, before.rows[0].families + Number(importSucceeded));
  });
  });
