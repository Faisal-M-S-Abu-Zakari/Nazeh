import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import {
  aids,
  aidDistributionsTable,
  campSectorsTable,
  complaints,
  db,
  familyMembersTable,
  familyNeedsTable,
  familiesTable,
  familyAssignmentHistoryTable,
  idempotencyKeys,
  sessions,
  sessionsTable,
  staffUsers,
  syncAuditEvents,
  tasks,
  needStatusHistoryTable,
  campsTable,
  shelterUnitsTable,
  usersTable,
} from "@workspace/db";
import app from "./app";
import { hashToken } from "./middlewares/auth";
import { hashPassword } from "./lib/security";

test("creating a task rejects invalid dueAt without persisting a partial task", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const [manager] = await db.select().from(staffUsers)
    .where(eq(staffUsers.email, "manager@alaqsa.local")).limit(1);
  assert(manager?.active);
  const token = `invalid-task-date-${randomUUID()}`;
  const tokenHash = hashToken(token);
  const idempotencyKey = randomUUID();
  const title = `invalid-due-date-${randomUUID()}`;
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "Idempotency-Key": idempotencyKey,
  };

  try {
    await db.insert(sessions).values({
      userId: manager.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const response = await fetch(`${baseUrl}/sync/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        description: "Integration test task",
        location: "integration-test",
        priority: "MEDIUM",
        dueAt: "2030-02-31T12:00:00.000Z",
      }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "dueAt must be a valid ISO 8601 date-time",
    });

    const createdTasks = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.title, title));
    assert.equal(createdTasks.length, 0, "invalid dueAt must not create a task");
  } finally {
    const partialTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.title, title));
    if (partialTasks.length) {
      const partialTaskIds = partialTasks.map((task) => task.id);
      await db.delete(syncAuditEvents).where(inArray(syncAuditEvents.entityId, partialTaskIds));
      await db.delete(tasks).where(inArray(tasks.id, partialTaskIds));
    }
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, idempotencyKey));
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
});

test("updating a task rejects invalid dueAt without changing the task or version", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const [manager] = await db.select().from(staffUsers)
    .where(eq(staffUsers.email, "manager@alaqsa.local")).limit(1);
  assert(manager?.active);
  const token = `invalid-task-update-date-${randomUUID()}`;
  const tokenHash = hashToken(token);
  const title = `unchanged-task-${randomUUID()}`;
  let taskId: string | undefined;
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  try {
    await db.insert(sessions).values({
      userId: manager.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const [task] = await db.insert(tasks).values({
      title,
      description: "Integration test task",
      location: "integration-test",
      createdById: manager.id,
    }).returning();
    taskId = task.id;

    const response = await fetch(`${baseUrl}/sync/tasks/${task.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        title: "must not be saved",
        dueAt: "2030-02-31T12:00:00.000Z",
        expectedVersion: task.version,
      }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "dueAt must be a valid ISO 8601 date-time",
    });

    const [unchangedTask] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    assert.equal(unchangedTask.title, title, "invalid dueAt must not apply other task changes");
    assert.equal(unchangedTask.dueAt, null);
    assert.equal(unchangedTask.version, task.version, "invalid dueAt must not increment the task version");
  } finally {
    if (taskId) {
      await db.delete(syncAuditEvents).where(eq(syncAuditEvents.entityId, taskId));
      await db.delete(tasks).where(eq(tasks.id, taskId));
    }
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
});

test("task sync list preserves the instant in an offset dueAt", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const [manager] = await db.select().from(staffUsers)
    .where(eq(staffUsers.email, "manager@alaqsa.local")).limit(1);
  assert(manager?.active);
  const token = `offset-task-date-${randomUUID()}`;
  const tokenHash = hashToken(token);
  const idempotencyKey = randomUUID();
  const title = `offset-due-date-${randomUUID()}`;
  const dueAt = "2030-02-28T17:45:00+05:30";
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "Idempotency-Key": idempotencyKey,
  };

  try {
    await db.insert(sessions).values({
      userId: manager.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const response = await fetch(`${baseUrl}/sync/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        description: "Integration test task with offset dueAt",
        location: "integration-test",
        priority: "MEDIUM",
        dueAt,
      }),
    });
    assert.equal(response.status, 201);

    const listResponse = await fetch(`${baseUrl}/sync/tasks`, { headers });
    assert.equal(listResponse.status, 200);
    const listedTasks = await listResponse.json() as Array<{ title: string; dueAt: string | null }>;
    const listedTask = listedTasks.find((task) => task.title === title);
    assert(listedTask, "created task should appear in the sync task list");
    assert(listedTask.dueAt, "listed task should include its dueAt");
    assert.equal(
      new Date(listedTask.dueAt).toISOString(),
      new Date(dueAt).toISOString(),
      "listed dueAt must represent the same instant as the submitted offset timestamp",
    );
  } finally {
    const createdTasks = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.title, title));
    if (createdTasks.length) {
      const taskIds = createdTasks.map((task) => task.id);
      await db.delete(syncAuditEvents).where(inArray(syncAuditEvents.entityId, taskIds));
      await db.delete(tasks).where(inArray(tasks.id, taskIds));
    }
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, idempotencyKey));
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
});

test("idempotent response-loss retries and optimistic status conflicts", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const [manager] = await db.select().from(staffUsers)
    .where(eq(staffUsers.email, "manager@alaqsa.local")).limit(1);
  assert(manager?.active);
  const userId = manager.id;
  const token = `task10-${randomUUID()}`;
  const tokenHash = hashToken(token);
  const title = `task10-aid-${randomUUID()}`;
  let complaintId: string | undefined;
  let taskId: string | undefined;
  let aidId: string | undefined;
  let idempotencyKey: string | undefined;

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + 60_000),
  });
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  try {
    const key = randomUUID();
    idempotencyKey = key;
    const body = JSON.stringify({
      title,
      type: "FOOD",
      quantity: 7,
      unit: "parcel",
      location: "integration-test",
      distributionDate: "2030-01-01",
    });
    // Model a lost response: the server commits it, while the caller discards it.
    await fetch(`${baseUrl}/sync/aids`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": key },
      body,
    });
    const retry = await fetch(`${baseUrl}/sync/aids`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": key },
      body,
    });
    aidId = (await retry.clone().json() as { id: string }).id;
    assert.equal(retry.status, 201);
    const created = await db.select().from(aids).where(and(eq(aids.createdById, userId), eq(aids.title, title)));
    assert.equal(created.length, 1, "same idempotency key creates exactly one aid");

    const [complaint] = await db.insert(complaints).values({
      complainantName: "Integration",
      subject: "Conflict",
      description: "Complaint conflict test",
      createdById: userId,
    }).returning({ id: complaints.id });
    complaintId = complaint.id;
    const [task] = await db.insert(tasks).values({
      title: "Conflict",
      description: "Task conflict test",
      location: "integration-test",
      createdById: userId,
    }).returning({ id: tasks.id });
    taskId = task.id;

    for (const scenario of [
      {
        path: `complaints/${complaintId}`,
        first: "IN_REVIEW",
        stale: "RESOLVED",
        read: async () => (await db.select().from(complaints).where(eq(complaints.id, complaintId!)))[0],
      },
      {
        path: `tasks/${taskId}`,
        first: "IN_PROGRESS",
        stale: "COMPLETED",
        read: async () => (await db.select().from(tasks).where(eq(tasks.id, taskId!)))[0],
      },
    ]) {
      const first = await fetch(`${baseUrl}/sync/${scenario.path}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: scenario.first, expectedVersion: 1 }),
      });
      assert.equal(first.status, 200);
      const stale = await fetch(`${baseUrl}/sync/${scenario.path}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: scenario.stale, expectedVersion: 1 }),
      });
      assert.equal(stale.status, 409);
      const current = await scenario.read();
      assert.equal(current.status, scenario.first, "stale write must preserve the newer state");
      assert.equal(current.version, 2);
    }

    const logout = await fetch(`${baseUrl}/auth/logout`, { method: "POST", headers });
    assert.equal(logout.status, 204);
    const revoked = await fetch(`${baseUrl}/auth/me`, { headers });
    assert.equal(revoked.status, 401, "requireAuth rejects a logged-out session");
  } finally {
    if (complaintId) await db.delete(complaints).where(eq(complaints.id, complaintId));
    if (taskId) await db.delete(tasks).where(eq(tasks.id, taskId));
    if (idempotencyKey) await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, idempotencyKey));
    if (aidId) await db.delete(syncAuditEvents).where(eq(syncAuditEvents.entityId, aidId));
    if (complaintId) await db.delete(syncAuditEvents).where(eq(syncAuditEvents.entityId, complaintId));
    if (taskId) await db.delete(syncAuditEvents).where(eq(syncAuditEvents.entityId, taskId));
    if (aidId) await db.delete(aids).where(eq(aids.id, aidId));
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("family workflow stays isolated and security completion requires approval", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const [canonicalManager] = await db.select().from(staffUsers)
    .where(eq(staffUsers.email, "manager@alaqsa.local")).limit(1);
  assert(canonicalManager?.active);
  const ids = {
    manager: canonicalManager.id, delegateOne: randomUUID(), delegateTwo: randomUUID(),
    securityOfficer: randomUUID(), securityMember: randomUUID(), family: randomUUID(), task: randomUUID(),
  };
  const tokens = Object.fromEntries(Object.entries(ids).map(([key]) => [key, `${key}-${randomUUID()}`]));
  const campId = "70000000-0000-4000-8000-000000000001";
  const sectorId = "71000000-0000-4000-8000-000000000001";
  const headers = (key: keyof typeof tokens) => ({
    authorization: `Bearer ${tokens[key]}`,
    "content-type": "application/json",
  });
  const idempotencyKeyValues: string[] = [];
  const nextIdempotencyKey = () => {
    const key = randomUUID();
    idempotencyKeyValues.push(key);
    return key;
  };
  const staff = [
    [ids.delegateOne, "delegate-one", "DELEGATE"],
    [ids.delegateTwo, "delegate-two", "DELEGATE"],
    [ids.securityOfficer, "security-officer", "SECURITY_OFFICER"],
    [ids.securityMember, "security-member", "SECURITY_MEMBER"],
  ] as const;
  let familyId: string | undefined;
  let needId: string | undefined;
  let shelterId: string | undefined;
  try {
    for (const [id, label, role] of staff) {
      await db.insert(staffUsers).values({ id, email: `${label}-${id}@example.invalid`, name: label, passwordHash: "not-used", role });
    }
    for (const [key, id] of [["manager", ids.manager], ["delegateOne", ids.delegateOne], ["delegateTwo", ids.delegateTwo], ["securityOfficer", ids.securityOfficer], ["securityMember", ids.securityMember]] as const) {
      await db.insert(sessions).values({ userId: id, tokenHash: hashToken(tokens[key]), expiresAt: new Date(Date.now() + 60_000) });
    }
    const created = await fetch(`${baseUrl}/sync/families`, {
      method: "POST",
      headers: { ...headers("delegateOne"), "Idempotency-Key": nextIdempotencyKey() },
      body: JSON.stringify({
        campId, sectorId, headName: "أسرة اختبار العزل", delegateId: ids.delegateOne,
        members: [{ fullName: "عضو اختبار", gender: "OTHER", relationship: "رب الأسرة", criticalCase: true }],
      }),
    });
    assert.equal(created.status, 201);
    const family = await created.json() as { id: string; version: number; status: string };
    familyId = family.id;
    assert.equal(family.status, "PENDING_APPROVAL");
    const hidden = await fetch(`${baseUrl}/sync/families`, { headers: headers("delegateTwo") });
    assert.equal(hidden.status, 200);
    assert(!(await hidden.text()).includes(family.id), "delegate must not see another delegate's family");
    const approved = await fetch(`${baseUrl}/sync/families/${family.id}/approve`, {
      method: "PATCH", headers: { ...headers("manager"), "Idempotency-Key": nextIdempotencyKey() }, body: "{}",
    });
    assert.equal(approved.status, 200);
    const need = await fetch(`${baseUrl}/sync/needs`, {
      method: "POST", headers: { ...headers("delegateOne"), "Idempotency-Key": nextIdempotencyKey() },
      body: JSON.stringify({ familyId: family.id, category: "MEDICAL", title: "احتياج اختبار", priority: "CRITICAL" }),
    });
    assert.equal(need.status, 201);
    const needRecord = await need.json() as { id: string; version: number };
    needId = needRecord.id;
    const archivedNeed = await fetch(`${baseUrl}/sync/needs/${needRecord.id}/archive`, {
      method: "PATCH", headers: { ...headers("manager"), "Idempotency-Key": nextIdempotencyKey() },
      body: JSON.stringify({ expectedVersion: needRecord.version }),
    });
    assert.equal(archivedNeed.status, 200);
    const deniedNeed = await fetch(`${baseUrl}/sync/needs`, {
      method: "POST", headers: { ...headers("delegateTwo"), "Idempotency-Key": nextIdempotencyKey() },
      body: JSON.stringify({ familyId: family.id, category: "FOOD", title: "تسريب اختبار", priority: "LOW" }),
    });
    assert.equal(deniedNeed.status, 404);
    const hiddenFamiliesForSecurity = await fetch(`${baseUrl}/sync/families`, { headers: headers("securityMember") });
    assert.equal(hiddenFamiliesForSecurity.status, 403);
    const shelterCode = `IT-${randomUUID().slice(0, 8)}`;
    const createdShelter = await fetch(`${baseUrl}/sync/shelters`, {
      method: "POST", headers: { ...headers("manager"), "Idempotency-Key": nextIdempotencyKey() },
      body: JSON.stringify({ sectorId, code: shelterCode, capacity: 2 }),
    });
    assert.equal(createdShelter.status, 201);
    const shelter = await createdShelter.json() as { id: string; version: number };
    shelterId = shelter.id;
    const updatedShelter = await fetch(`${baseUrl}/sync/shelters/${shelter.id}`, {
      method: "PATCH", headers: headers("manager"),
      body: JSON.stringify({ capacity: 3, expectedVersion: shelter.version }),
    });
    assert.equal(updatedShelter.status, 200);
    const assignedFamily = await fetch(`${baseUrl}/sync/families/${family.id}`, {
      method: "PATCH", headers: headers("manager"),
      body: JSON.stringify({ shelterId: shelter.id, expectedVersion: 2 }),
    });
    assert.equal(assignedFamily.status, 200);
    const archivedShelter = await fetch(`${baseUrl}/sync/shelters/${shelter.id}/archive`, {
      method: "PATCH", headers: headers("manager"),
      body: JSON.stringify({ expectedVersion: shelter.version + 1 }),
    });
    assert.equal(archivedShelter.status, 200);
    const historyResponse = await fetch(`${baseUrl}/sync/families/${family.id}/assignment-history`, {
      headers: headers("manager"),
    });
    assert.equal(historyResponse.status, 200);
    const history = await historyResponse.json() as Array<{
      fromShelterCode: string | null;
      toShelterCode: string | null;
      toShelterArchived: boolean;
      changedByName: string | null;
      reason: string | null;
    }>;
    assert.equal(history.length, 1);
    assert.equal(history[0]?.fromShelterCode, null);
    assert.equal(history[0]?.toShelterCode, shelterCode);
    assert.equal(history[0]?.toShelterArchived, true, "archived shelter names remain visible in assignment history");
    assert.equal(history[0]?.changedByName, canonicalManager.name);
    assert.equal(history[0]?.reason, "Operational reassignment");
    const delegateHistory = await fetch(`${baseUrl}/sync/families/${family.id}/assignment-history`, {
      headers: headers("delegateOne"),
    });
    assert.equal(delegateHistory.status, 200, "the assigned delegate can read the family's assignment history");
    const hiddenDelegateHistory = await fetch(`${baseUrl}/sync/families/${family.id}/assignment-history`, {
      headers: headers("delegateTwo"),
    });
    assert.equal(hiddenDelegateHistory.status, 404, "other delegates cannot read the family's history");
    const deniedHistory = await fetch(`${baseUrl}/sync/families/${family.id}/assignment-history`, {
      headers: headers("securityMember"),
    });
    assert.equal(deniedHistory.status, 403, "unauthorized roles cannot read assignment history");
    const unchangedFamily = await fetch(`${baseUrl}/sync/families/${family.id}`, {
      headers: headers("manager"),
    });
    const unchangedFamilyBody = await unchangedFamily.json() as { shelterId: string | null };
    assert.equal(unchangedFamilyBody.shelterId, shelter.id, "reading assignment history does not change the current shelter");
    await db.insert(tasks).values({
      id: ids.task, title: "مهمة اختبار", description: "نتيجة اختبار", location: "القطاع الشمالي",
      assignedToId: ids.securityMember, createdById: ids.manager,
    });
    const memberTasks = await fetch(`${baseUrl}/sync/tasks`, { headers: headers("securityMember") });
    assert.equal(memberTasks.status, 200);
    assert((await memberTasks.text()).includes(ids.task));
    const submitted = await fetch(`${baseUrl}/sync/tasks/${ids.task}/submit`, {
      method: "PATCH", headers: { ...headers("securityMember"), "Idempotency-Key": nextIdempotencyKey() },
      body: JSON.stringify({ result: "تم التنفيذ", expectedVersion: 1 }),
    });
    assert.equal(submitted.status, 200);
    const completion = await fetch(`${baseUrl}/sync/tasks/${ids.task}/approve`, {
      method: "PATCH", headers: { ...headers("securityOfficer"), "Idempotency-Key": nextIdempotencyKey() },
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    assert.equal(completion.status, 200);
  } finally {
    if (familyId) {
      if (needId) await db.delete(needStatusHistoryTable).where(eq(needStatusHistoryTable.needId, needId));
      await db.delete(familyAssignmentHistoryTable).where(eq(familyAssignmentHistoryTable.familyId, familyId));
      await db.delete(familyNeedsTable).where(eq(familyNeedsTable.familyId, familyId));
      await db.delete(familyMembersTable).where(eq(familyMembersTable.familyId, familyId));
      await db.delete(familiesTable).where(eq(familiesTable.id, familyId));
    }
    if (shelterId) await db.delete(shelterUnitsTable).where(eq(shelterUnitsTable.id, shelterId));
    await db.delete(tasks).where(eq(tasks.id, ids.task));
    if (idempotencyKeyValues.length) {
      await db.delete(idempotencyKeys).where(inArray(idempotencyKeys.key, idempotencyKeyValues));
    }
    const entityIds = [familyId, needId, shelterId, ids.task].filter((id): id is string => Boolean(id));
    if (entityIds.length) {
      await db.delete(syncAuditEvents).where(inArray(syncAuditEvents.entityId, entityIds));
    }
    await db.delete(sessions).where(inArray(
      sessions.tokenHash,
      Object.values(tokens).map((token) => hashToken(token)),
    ));
    for (const id of Object.values(ids)) {
      if (id === ids.manager || id === ids.family || id === ids.task) continue;
      await db.delete(staffUsers).where(eq(staffUsers.id, id));
    }
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("aid distributions link approved needs, prevent duplicate delivery, and record receipt", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const [manager] = await db.select().from(staffUsers)
    .where(eq(staffUsers.email, "manager@alaqsa.local")).limit(1);
  assert(manager?.active);
  const managerId = manager.id;
  const delegateId = randomUUID();
  const familyId = randomUUID();
  const approvedNeedId = randomUUID();
  const requiredNeedId = randomUUID();
  const aidId = randomUUID();
  const campId = randomUUID();
  const sectorId = randomUUID();
  const managerToken = `distribution-manager-${randomUUID()}`;
  const delegateToken = `distribution-delegate-${randomUUID()}`;
  const headers = (token: string) => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  });
  try {
    await db.insert(staffUsers).values([
      { id: delegateId, email: `${delegateId}@example.invalid`, name: "Distribution delegate", passwordHash: "not-used", role: "DELEGATE" },
    ]);
    await db.insert(sessions).values([
      { userId: managerId, tokenHash: hashToken(managerToken), expiresAt: new Date(Date.now() + 60_000) },
      { userId: delegateId, tokenHash: hashToken(delegateToken), expiresAt: new Date(Date.now() + 60_000) },
    ]);
    await db.insert(campsTable).values({ id: campId, name: "Distribution test camp" });
    await db.insert(campSectorsTable).values({ id: sectorId, campId, name: "Distribution test sector" });
    await db.insert(familiesTable).values({
      id: familyId, campId, sectorId, headName: "Distribution test family",
      delegateId, status: "ACTIVE",
    });
    await db.insert(familyNeedsTable).values([
      { id: approvedNeedId, familyId, category: "FOOD", title: "Approved food", priority: "HIGH", status: "APPROVED", createdById: managerId },
      { id: requiredNeedId, familyId, category: "WATER", title: "Unapproved water", priority: "HIGH", status: "REQUIRED", createdById: managerId },
    ]);
    await db.insert(aids).values({
      id: aidId, title: "Distribution test aid", type: "FOOD", quantity: 10, unit: "parcel",
      location: "Distribution test", distributionDate: "2030-01-01", createdById: managerId,
    });

    const assigned = await fetch(`${baseUrl}/sync/aids/${aidId}/distributions`, {
      method: "POST",
      headers: { ...headers(managerToken), "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ familyId, needId: approvedNeedId, quantity: 3 }),
    });
    assert.equal(assigned.status, 201);
    const distribution = await assigned.json() as { id: string; status: string; executedById: string };
    assert.equal(distribution.status, "ASSIGNED");
    assert.equal(distribution.executedById, managerId);

    const duplicate = await fetch(`${baseUrl}/sync/aids/${aidId}/distributions`, {
      method: "POST",
      headers: { ...headers(managerToken), "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ familyId, needId: approvedNeedId, quantity: 3 }),
    });
    assert.equal(duplicate.status, 409);

    const unapproved = await fetch(`${baseUrl}/sync/aids/${aidId}/distributions`, {
      method: "POST",
      headers: { ...headers(managerToken), "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ familyId, needId: requiredNeedId, quantity: 1 }),
    });
    assert.equal(unapproved.status, 400);
    const skippedApproval = await fetch(`${baseUrl}/sync/needs/${requiredNeedId}`, {
      method: "PATCH",
      headers: headers(managerToken),
      body: JSON.stringify({ status: "FULFILLED", expectedVersion: 1 }),
    });
    assert.equal(skippedApproval.status, 400, "a need cannot skip approval and execution");

    const visibleToDelegate = await fetch(`${baseUrl}/sync/aids/${aidId}/distributions`, {
      headers: headers(delegateToken),
    });
    assert.equal(visibleToDelegate.status, 200);
    assert.equal((await visibleToDelegate.json() as unknown[]).length, 1);

    const concurrentReceipts = await Promise.all([
      fetch(`${baseUrl}/sync/distributions/${distribution.id}/receive`, {
        method: "POST",
        headers: { ...headers(managerToken), "Idempotency-Key": randomUUID() },
        body: JSON.stringify({ deliveredAt: "2030-01-01T09:00:00.000Z" }),
      }),
      fetch(`${baseUrl}/sync/distributions/${distribution.id}/receive`, {
        method: "POST",
        headers: { ...headers(delegateToken), "Idempotency-Key": randomUUID() },
        body: JSON.stringify({ deliveredAt: "2030-01-01T09:01:00.000Z" }),
      }),
    ]);
    assert.deepEqual(
      concurrentReceipts.map((response) => response.status).sort(),
      [200, 409],
      "concurrent delivery confirmations must have exactly one winner",
    );
    const winningResponse = concurrentReceipts.find((response) => response.status === 200);
    assert(winningResponse);
    const winningBody = await winningResponse.json() as {
      id: string;
      status: string;
      deliveredById: string | null;
      deliveredAt: string | null;
    };
    assert.equal(winningBody.id, distribution.id);
    assert.equal(winningBody.status, "RECEIVED");
    assert(winningBody.deliveredById);
    assert(winningBody.deliveredAt);

    const [storedDistribution] = await db.select().from(aidDistributionsTable)
      .where(eq(aidDistributionsTable.id, distribution.id));
    assert(storedDistribution);
    assert.equal(storedDistribution.status, "RECEIVED");
    assert.equal(storedDistribution.deliveredById, winningBody.deliveredById);
    assert.equal(
      storedDistribution.deliveredAt?.toISOString(),
      new Date(winningBody.deliveredAt).toISOString(),
    );
    const receiveAuditRows = await db.select().from(syncAuditEvents).where(and(
      eq(syncAuditEvents.entityId, distribution.id),
      eq(syncAuditEvents.action, "RECEIVE"),
    ));
    assert.equal(receiveAuditRows.length, 1, "concurrent confirmations must create one receipt audit");

    const repeatedReceipt = await fetch(`${baseUrl}/sync/distributions/${distribution.id}/receive`, {
      method: "POST",
      headers: { ...headers(delegateToken), "Idempotency-Key": randomUUID() },
      body: "{}",
    });
    assert.equal(repeatedReceipt.status, 409);
    const [need] = await db.select().from(familyNeedsTable).where(eq(familyNeedsTable.id, approvedNeedId));
    assert.equal(need.status, "FULFILLED");
    const reopened = await fetch(`${baseUrl}/sync/needs/${approvedNeedId}`, {
      method: "PATCH",
      headers: headers(managerToken),
      body: JSON.stringify({ status: "IN_PROGRESS", expectedVersion: need.version }),
    });
    assert.equal(reopened.status, 400, "fulfilled needs cannot be reopened by a status patch");
    const auditRows = await db.select().from(syncAuditEvents).where(eq(syncAuditEvents.entityId, distribution.id));
    assert(auditRows.some((row) => row.action === "DUPLICATE_ATTEMPT"));
    assert(auditRows.some((row) => row.action === "DUPLICATE_RECEIVE_ATTEMPT"));

    const cancelled = await fetch(`${baseUrl}/sync/distributions/${distribution.id}/cancel`, {
      method: "PATCH",
      headers: { ...headers(managerToken), "Idempotency-Key": randomUUID() },
    });
    assert.equal(cancelled.status, 200);
    const cancelledBody = await cancelled.json() as {
      id: string;
      status: string;
      deliveredById: string | null;
      deliveredAt: string | null;
    };
    assert.equal(cancelledBody.id, distribution.id);
    assert.equal(cancelledBody.status, "CANCELLED");
    assert.equal(cancelledBody.deliveredById, null);
    assert.equal(cancelledBody.deliveredAt, null);

    const [cancelledDistribution] = await db.select().from(aidDistributionsTable)
      .where(eq(aidDistributionsTable.id, distribution.id));
    assert(cancelledDistribution);
    assert.equal(cancelledDistribution.status, "CANCELLED");
    assert.equal(cancelledDistribution.deliveredById, null);
    assert.equal(cancelledDistribution.deliveredAt, null);
    const finalAuditRows = await db.select().from(syncAuditEvents).where(eq(syncAuditEvents.entityId, distribution.id));
    assert.equal(
      finalAuditRows.filter((row) => row.action === "RECEIVE").length,
      1,
      "cancelling a received distribution must not create a new receipt audit",
    );
    assert.equal(finalAuditRows.filter((row) => row.action === "CANCEL").length, 1);
  } finally {
    await db.delete(aidDistributionsTable).where(eq(aidDistributionsTable.aidId, aidId));
    await db.delete(needStatusHistoryTable).where(inArray(needStatusHistoryTable.needId, [approvedNeedId, requiredNeedId]));
    await db.delete(familyNeedsTable).where(eq(familyNeedsTable.familyId, familyId));
    await db.delete(aids).where(eq(aids.id, aidId));
    await db.delete(syncAuditEvents).where(inArray(syncAuditEvents.actorStaffId, [managerId, delegateId]));
    await db.delete(idempotencyKeys).where(inArray(idempotencyKeys.userId, [managerId, delegateId]));
    await db.delete(sessions).where(inArray(sessions.userId, [managerId, delegateId]));
    await db.delete(familiesTable).where(eq(familiesTable.id, familyId));
    await db.delete(campSectorsTable).where(eq(campSectorsTable.id, sectorId));
    await db.delete(campsTable).where(eq(campsTable.id, campId));
    await db.delete(staffUsers).where(eq(staffUsers.id, delegateId));
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("displaced family-head access stays linked to the authenticated active family", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const password = "FamilyHeadTest2026!";
  const userEmail = `family-head-${randomUUID()}@example.invalid`;
  const otherUserEmail = `other-family-head-${randomUUID()}@example.invalid`;
  const unlinkedUserEmail = `unlinked-family-head-${randomUUID()}@example.invalid`;
  const campId = randomUUID();
  const sectorId = randomUUID();
  const familyId = randomUUID();
  const otherFamilyId = randomUUID();
  const archivedFamilyId = randomUUID();
  const existingNeedId = randomUUID();
  const otherNeedId = randomUUID();
  const receivedAidId = randomUUID();
  const pendingAidId = randomUUID();
  const otherAidId = randomUUID();
  let userId: number | undefined;
  let otherUserId: number | undefined;
  let unlinkedUserId: number | undefined;
  let token: string | undefined;
  let otherToken: string | undefined;
  let unlinkedToken: string | undefined;

  try {
    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(usersTable).values({
      email: userEmail,
      passwordHash,
      role: "DISPLACED",
      rank: "DISPLACED",
      name: "Family head integration",
      identity: `family-head-${randomUUID()}`,
    }).returning({ id: usersTable.id });
    userId = user.id;
    const [otherUser] = await db.insert(usersTable).values({
      email: otherUserEmail,
      passwordHash,
      role: "DISPLACED",
      rank: "DISPLACED",
      name: "Other family head integration",
      identity: `other-family-head-${randomUUID()}`,
    }).returning({ id: usersTable.id });
    otherUserId = otherUser.id;
    const [unlinkedUser] = await db.insert(usersTable).values({
      email: unlinkedUserEmail,
      passwordHash,
      role: "DISPLACED",
      rank: "DISPLACED",
      name: "Unlinked family head integration",
      identity: `unlinked-family-head-${randomUUID()}`,
    }).returning({ id: usersTable.id });
    unlinkedUserId = unlinkedUser.id;

    await db.insert(campsTable).values({ id: campId, name: "Family-head integration camp" });
    await db.insert(campSectorsTable).values({ id: sectorId, campId, name: "Family-head integration sector" });
    await db.insert(familiesTable).values([
      {
        id: familyId,
        campId,
        sectorId,
        headName: "Family head integration",
        headLegacyUserId: userId,
        status: "ACTIVE",
      },
      {
        id: otherFamilyId,
        campId,
        sectorId,
        headName: "Other family head integration",
        headLegacyUserId: otherUserId,
        status: "ACTIVE",
      },
      {
        id: archivedFamilyId,
        campId,
        sectorId,
        headName: "Archived family head integration",
        headLegacyUserId: unlinkedUserId,
        status: "ARCHIVED",
        archivedAt: new Date(),
      },
    ]);
    await db.insert(familyMembersTable).values([
      {
        familyId,
        fullName: "Visible linked member",
        gender: "OTHER",
        relationship: "Child",
      },
      {
        familyId: otherFamilyId,
        fullName: "Private other-family member",
        gender: "OTHER",
        relationship: "Child",
      },
      {
        familyId: archivedFamilyId,
        fullName: "Archived-only family member",
        gender: "OTHER",
        relationship: "Child",
      },
    ]);
    await db.insert(familyNeedsTable).values({
      id: existingNeedId,
      familyId,
      category: "MEDICAL",
      title: "Existing linked need",
      priority: "HIGH",
      status: "REQUIRED",
      createdByLegacyUserId: userId,
    });
    await db.insert(familyNeedsTable).values({
      id: otherNeedId,
      familyId: otherFamilyId,
      category: "FOOD",
      title: "Private other-family need",
      priority: "CRITICAL",
      status: "REQUIRED",
      createdByLegacyUserId: otherUserId,
    });
    await db.insert(familyNeedsTable).values({
      familyId: archivedFamilyId,
      category: "SHELTER",
      title: "Archived-only family need",
      priority: "HIGH",
      status: "REQUIRED",
      createdByLegacyUserId: unlinkedUserId,
    });
    const [manager] = await db.select({ id: staffUsers.id }).from(staffUsers)
      .where(eq(staffUsers.email, "manager@alaqsa.local")).limit(1);
    assert(manager, "seed manager required");
    await db.insert(aids).values([
      { id: receivedAidId, title: "Received parcel", type: "FOOD", quantity: 10, unit: "parcel", location: "Test", distributionDate: "2030-01-01", createdById: manager.id },
      { id: pendingAidId, title: "Pending parcel", type: "FOOD", quantity: 10, unit: "parcel", location: "Test", distributionDate: "2030-01-01", createdById: manager.id },
      { id: otherAidId, title: "Private other-family aid", type: "FOOD", quantity: 10, unit: "parcel", location: "Test", distributionDate: "2030-01-01", createdById: manager.id },
    ]);
    await db.insert(aidDistributionsTable).values([
      { aidId: receivedAidId, needId: existingNeedId, familyId, quantity: 2, unit: "parcel", status: "RECEIVED", executedById: manager.id, deliveredById: manager.id, deliveredAt: new Date("2030-01-02T10:00:00Z") },
      { aidId: pendingAidId, needId: existingNeedId, familyId, quantity: 1, unit: "parcel", status: "ASSIGNED", executedById: manager.id },
      { aidId: otherAidId, needId: otherNeedId, familyId: otherFamilyId, quantity: 3, unit: "parcel", status: "RECEIVED", executedById: manager.id, deliveredById: manager.id, deliveredAt: new Date("2030-01-03T10:00:00Z") },
    ]);

    const login = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: userEmail, password, role: "displaced" }),
    });
    assert.equal(login.status, 200);
    const loginBody = await login.json() as { token: string; user: { id: number; role: string } };
    token = loginBody.token;
    assert.equal(loginBody.user.id, userId);
    assert.equal(loginBody.user.role, "displaced");
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    };
    const otherLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: otherUserEmail, password, role: "displaced" }),
    });
    assert.equal(otherLogin.status, 200);
    const otherLoginBody = await otherLogin.json() as { token: string };
    otherToken = otherLoginBody.token;
    const otherHeaders = {
      authorization: `Bearer ${otherToken}`,
      "content-type": "application/json",
    };

    const familyResponse = await fetch(`${baseUrl}/family/me`, { headers });
    assert.equal(familyResponse.status, 200);
    const familyBody = await familyResponse.json() as {
      id: string;
      status: string;
      members: Array<{ fullName: string }>;
    };
    assert.equal(familyBody.id, familyId);
    assert.equal(familyBody.status, "ACTIVE");
    assert.deepEqual(familyBody.members.map((member) => member.fullName), ["Visible linked member"]);
    assert(!JSON.stringify(familyBody).includes(otherFamilyId));
    assert(!JSON.stringify(familyBody).includes("Private other-family member"));

    const needsResponse = await fetch(`${baseUrl}/family/me/needs`, { headers });
    assert.equal(needsResponse.status, 200);
    const needsBody = await needsResponse.json() as Array<{ id: string; familyId: string; title: string }>;
    assert.deepEqual(needsBody.map((need) => need.familyId), [familyId]);
    assert(needsBody.some((need) => need.id === existingNeedId && need.title === "Existing linked need"));
    assert(!needsBody.some((need) => need.familyId === otherFamilyId));
    const historyResponse = await fetch(`${baseUrl}/family/me/aid-distributions`, { headers });
    assert.equal(historyResponse.status, 200);
    const historyBody = await historyResponse.json() as Array<Record<string, unknown>>;
    assert.equal(historyBody.length, 1, "only received distributions of the linked family are returned");
    assert.deepEqual({
      title: historyBody[0].title,
      quantity: historyBody[0].quantity,
      unit: historyBody[0].unit,
      deliveredAt: historyBody[0].deliveredAt,
    }, { title: "Received parcel", quantity: 2, unit: "parcel", deliveredAt: "2030-01-02T10:00:00.000Z" });
    assert.deepEqual(Object.keys(historyBody[0]).sort(), ["deliveredAt", "id", "quantity", "title", "type", "unit"].sort());
    assert(!JSON.stringify(historyBody).includes("Private other-family aid"));
    const otherHistoryResponse = await fetch(`${baseUrl}/family/me/aid-distributions?familyId=${familyId}`, { headers: otherHeaders });
    assert.equal(otherHistoryResponse.status, 200);
    const otherHistory = await otherHistoryResponse.json() as Array<{ title: string }>;
    assert.deepEqual(otherHistory.map((aid) => aid.title), ["Private other-family aid"], "query parameters cannot change family scope");
    assert(!JSON.stringify(otherHistory).includes("Received parcel"));

    const injectedNeedTitle = `Should stay linked ${randomUUID()}`;
    const createdNeedResponse = await fetch(`${baseUrl}/family/me/needs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        familyId: otherFamilyId,
        category: "WATER",
        title: injectedNeedTitle,
        priority: "CRITICAL",
      }),
    });
    assert.equal(createdNeedResponse.status, 201);
    const createdNeed = await createdNeedResponse.json() as {
      id: string;
      familyId: string;
      category: string;
      status: string;
      createdByLegacyUserId: number;
    };
    assert.equal(createdNeed.familyId, familyId);
    assert.equal(createdNeed.category, "WATER");
    assert.equal(createdNeed.status, "REQUIRED");
    assert.equal(createdNeed.createdByLegacyUserId, userId);

    const [storedNeed] = await db.select().from(familyNeedsTable).where(eq(familyNeedsTable.id, createdNeed.id));
    assert.equal(storedNeed.familyId, familyId);
    const history = await db.select().from(needStatusHistoryTable).where(eq(needStatusHistoryTable.needId, createdNeed.id));
    assert.deepEqual(history.map((entry) => ({
      needId: entry.needId,
      toStatus: entry.toStatus,
      changedByLegacyUserId: entry.changedByLegacyUserId,
    })), [{
      needId: createdNeed.id,
      toStatus: "REQUIRED",
      changedByLegacyUserId: userId,
    }]);

    await db.update(usersTable).set({ active: false }).where(eq(usersTable.id, userId));
    const inactiveFamilyResponse = await fetch(`${baseUrl}/family/me`, { headers });
    assert.equal(inactiveFamilyResponse.status, 401);
    const [revokedSession] = await db.select({ revokedAt: sessionsTable.revokedAt })
      .from(sessionsTable)
      .where(eq(sessionsTable.tokenHash, hashToken(token)));
    assert(revokedSession?.revokedAt, "deactivating a legacy account revokes its session");
    const inactiveFamilyBody = await inactiveFamilyResponse.text();
    assert(!inactiveFamilyBody.includes("Visible linked member"));
    assert(!inactiveFamilyBody.includes("Existing linked need"));

    const inactiveNeedsResponse = await fetch(`${baseUrl}/family/me/needs`, { headers });
    assert.equal(inactiveNeedsResponse.status, 401);
    const inactiveNeedsBody = await inactiveNeedsResponse.text();
    assert(!inactiveNeedsBody.includes("Existing linked need"));
    const inactiveHistoryResponse = await fetch(`${baseUrl}/family/me/aid-distributions`, { headers });
    assert.equal(inactiveHistoryResponse.status, 401);

    const inactiveCreateResponse = await fetch(`${baseUrl}/family/me/needs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        category: "WATER",
        title: `Must not be created ${randomUUID()}`,
        priority: "CRITICAL",
      }),
    });
    assert.equal(inactiveCreateResponse.status, 401);
    const inactiveCreateBody = await inactiveCreateResponse.text();
    assert(!inactiveCreateBody.includes("Must not be created"));

    const otherFamilyResponse = await fetch(`${baseUrl}/family/me`, { headers: otherHeaders });
    assert.equal(otherFamilyResponse.status, 200, "deactivating one account leaves other sessions signed in");
    const [otherSession] = await db.select({ revokedAt: sessionsTable.revokedAt })
      .from(sessionsTable)
      .where(eq(sessionsTable.tokenHash, hashToken(otherToken)));
    assert.equal(otherSession?.revokedAt, null, "unrelated sessions remain active");

    const unlinkedLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: unlinkedUserEmail, password, role: "displaced" }),
    });
    assert.equal(unlinkedLogin.status, 200);
    const unlinkedLoginBody = await unlinkedLogin.json() as { token: string };
    unlinkedToken = unlinkedLoginBody.token;
    const unlinkedHeaders = {
      authorization: `Bearer ${unlinkedToken}`,
      "content-type": "application/json",
    };

    const unlinkedFamilyResponse = await fetch(`${baseUrl}/family/me`, { headers: unlinkedHeaders });
    assert.equal(unlinkedFamilyResponse.status, 404);
    const unlinkedFamilyBody = await unlinkedFamilyResponse.text();
    assert(!unlinkedFamilyBody.includes("Archived-only family member"));
    assert(!unlinkedFamilyBody.includes("Archived-only family need"));

    const unlinkedNeedsResponse = await fetch(`${baseUrl}/family/me/needs`, { headers: unlinkedHeaders });
    assert.equal(unlinkedNeedsResponse.status, 404);
    const unlinkedNeedsBody = await unlinkedNeedsResponse.text();
    assert(!unlinkedNeedsBody.includes("Archived-only family need"));
    const unlinkedHistoryResponse = await fetch(`${baseUrl}/family/me/aid-distributions`, { headers: unlinkedHeaders });
    assert.equal(unlinkedHistoryResponse.status, 404);
    assert(!(await unlinkedHistoryResponse.text()).includes("Private other-family aid"));

    const unlinkedCreateResponse = await fetch(`${baseUrl}/family/me/needs`, {
      method: "POST",
      headers: unlinkedHeaders,
      body: JSON.stringify({
        category: "FOOD",
        title: `Must not be created without family ${randomUUID()}`,
        priority: "HIGH",
      }),
    });
    assert.equal(unlinkedCreateResponse.status, 404);
    const unlinkedCreateBody = await unlinkedCreateResponse.text();
    assert(!unlinkedCreateBody.includes("Must not be created without family"));
  } finally {
    await db.delete(aidDistributionsTable).where(inArray(aidDistributionsTable.aidId, [receivedAidId, pendingAidId, otherAidId]));
    await db.delete(aids).where(inArray(aids.id, [receivedAidId, pendingAidId, otherAidId]));
    if (token) {
      await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(token)));
    }
    if (otherToken) {
      await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(otherToken)));
    }
    if (unlinkedToken) {
      await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(unlinkedToken)));
    }
    if (userId) {
      await db.delete(needStatusHistoryTable).where(eq(needStatusHistoryTable.changedByLegacyUserId, userId));
      await db.delete(familyNeedsTable).where(eq(familyNeedsTable.createdByLegacyUserId, userId));
    }
    if (otherUserId) {
      await db.delete(familyNeedsTable).where(eq(familyNeedsTable.createdByLegacyUserId, otherUserId));
    }
    if (unlinkedUserId) {
      await db.delete(familyNeedsTable).where(eq(familyNeedsTable.createdByLegacyUserId, unlinkedUserId));
    }
    await db.delete(familyNeedsTable).where(eq(familyNeedsTable.familyId, familyId));
    await db.delete(familyNeedsTable).where(eq(familyNeedsTable.familyId, otherFamilyId));
    await db.delete(familyNeedsTable).where(eq(familyNeedsTable.familyId, archivedFamilyId));
    await db.delete(needStatusHistoryTable).where(eq(needStatusHistoryTable.needId, existingNeedId));
    await db.delete(familyMembersTable).where(eq(familyMembersTable.familyId, familyId));
    await db.delete(familyMembersTable).where(eq(familyMembersTable.familyId, otherFamilyId));
    await db.delete(familiesTable).where(eq(familiesTable.id, familyId));
    await db.delete(familiesTable).where(eq(familiesTable.id, otherFamilyId));
    await db.delete(familiesTable).where(eq(familiesTable.id, archivedFamilyId));
    if (userId) await db.delete(usersTable).where(eq(usersTable.id, userId));
    if (otherUserId) await db.delete(usersTable).where(eq(usersTable.id, otherUserId));
    if (unlinkedUserId) await db.delete(usersTable).where(eq(usersTable.id, unlinkedUserId));
    await db.delete(campSectorsTable).where(eq(campSectorsTable.id, sectorId));
    await db.delete(campsTable).where(eq(campsTable.id, campId));
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});