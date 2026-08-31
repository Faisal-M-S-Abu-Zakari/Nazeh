import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import {
  aids,
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

test("idempotent response-loss retries and optimistic status conflicts", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const userId = randomUUID();
  const token = `task10-${randomUUID()}`;
  const title = `task10-aid-${randomUUID()}`;
  let complaintId: string | undefined;
  let taskId: string | undefined;

  await db.insert(staffUsers).values({
    id: userId,
    email: `task10-${randomUUID()}@example.invalid`,
    name: "Task 10 integration",
    passwordHash: "not-used",
    role: "ADMIN",
  });
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  try {
    const key = randomUUID();
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
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.userId, userId));
    await db.delete(aids).where(eq(aids.createdById, userId));
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.delete(syncAuditEvents).where(eq(syncAuditEvents.actorStaffId, userId));
    await db.delete(staffUsers).where(eq(staffUsers.id, userId));
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("family workflow stays isolated and security completion requires approval", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const ids = {
    manager: randomUUID(), delegateOne: randomUUID(), delegateTwo: randomUUID(),
    securityOfficer: randomUUID(), securityMember: randomUUID(), family: randomUUID(), task: randomUUID(),
  };
  const tokens = Object.fromEntries(Object.entries(ids).map(([key]) => [key, `${key}-${randomUUID()}`]));
  const campId = "70000000-0000-4000-8000-000000000001";
  const sectorId = "71000000-0000-4000-8000-000000000001";
  const headers = (key: keyof typeof tokens) => ({
    authorization: `Bearer ${tokens[key]}`,
    "content-type": "application/json",
  });
  const staff = [
    [ids.manager, "manager", "MANAGER"],
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
      headers: { ...headers("delegateOne"), "Idempotency-Key": randomUUID() },
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
      method: "PATCH", headers: { ...headers("manager"), "Idempotency-Key": randomUUID() }, body: "{}",
    });
    assert.equal(approved.status, 200);
    const need = await fetch(`${baseUrl}/sync/needs`, {
      method: "POST", headers: { ...headers("delegateOne"), "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ familyId: family.id, category: "MEDICAL", title: "احتياج اختبار", priority: "CRITICAL" }),
    });
    assert.equal(need.status, 201);
    const needRecord = await need.json() as { id: string; version: number };
    needId = needRecord.id;
    const archivedNeed = await fetch(`${baseUrl}/sync/needs/${needRecord.id}/archive`, {
      method: "PATCH", headers: { ...headers("manager"), "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ expectedVersion: needRecord.version }),
    });
    assert.equal(archivedNeed.status, 200);
    const deniedNeed = await fetch(`${baseUrl}/sync/needs`, {
      method: "POST", headers: { ...headers("delegateTwo"), "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ familyId: family.id, category: "FOOD", title: "تسريب اختبار", priority: "LOW" }),
    });
    assert.equal(deniedNeed.status, 404);
    const hiddenFamiliesForSecurity = await fetch(`${baseUrl}/sync/families`, { headers: headers("securityMember") });
    assert.equal(hiddenFamiliesForSecurity.status, 403);
    const shelterCode = `IT-${randomUUID().slice(0, 8)}`;
    const createdShelter = await fetch(`${baseUrl}/sync/shelters`, {
      method: "POST", headers: { ...headers("manager"), "Idempotency-Key": randomUUID() },
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
    const archivedShelter = await fetch(`${baseUrl}/sync/shelters/${shelter.id}/archive`, {
      method: "PATCH", headers: headers("manager"),
      body: JSON.stringify({ expectedVersion: shelter.version + 1 }),
    });
    assert.equal(archivedShelter.status, 200);
    await db.insert(tasks).values({
      id: ids.task, title: "مهمة اختبار", description: "نتيجة اختبار", location: "القطاع الشمالي",
      assignedToId: ids.securityMember, createdById: ids.manager,
    });
    const memberTasks = await fetch(`${baseUrl}/sync/tasks`, { headers: headers("securityMember") });
    assert.equal(memberTasks.status, 200);
    assert((await memberTasks.text()).includes(ids.task));
    const submitted = await fetch(`${baseUrl}/sync/tasks/${ids.task}/submit`, {
      method: "PATCH", headers: { ...headers("securityMember"), "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ result: "تم التنفيذ", expectedVersion: 1 }),
    });
    assert.equal(submitted.status, 200);
    const completion = await fetch(`${baseUrl}/sync/tasks/${ids.task}/approve`, {
      method: "PATCH", headers: { ...headers("securityOfficer"), "Idempotency-Key": randomUUID() },
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
    for (const id of Object.values(ids)) {
      if (id === ids.family || id === ids.task) continue;
      await db.delete(idempotencyKeys).where(eq(idempotencyKeys.userId, id));
      await db.delete(sessions).where(eq(sessions.userId, id));
      await db.delete(syncAuditEvents).where(eq(syncAuditEvents.actorStaffId, id));
      await db.delete(staffUsers).where(eq(staffUsers.id, id));
    }
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
  const campId = randomUUID();
  const sectorId = randomUUID();
  const familyId = randomUUID();
  const otherFamilyId = randomUUID();
  const archivedFamilyId = randomUUID();
  const existingNeedId = randomUUID();
  let userId: number | undefined;
  let otherUserId: number | undefined;
  let token: string | undefined;

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
        headLegacyUserId: userId,
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
      familyId: otherFamilyId,
      category: "FOOD",
      title: "Private other-family need",
      priority: "CRITICAL",
      status: "REQUIRED",
      createdByLegacyUserId: otherUserId,
    });

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
  } finally {
    if (token) {
      await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(token)));
    }
    if (userId) {
      await db.delete(needStatusHistoryTable).where(eq(needStatusHistoryTable.changedByLegacyUserId, userId));
      await db.delete(familyNeedsTable).where(eq(familyNeedsTable.createdByLegacyUserId, userId));
    }
    if (otherUserId) {
      await db.delete(familyNeedsTable).where(eq(familyNeedsTable.createdByLegacyUserId, otherUserId));
    }
    await db.delete(familyNeedsTable).where(eq(familyNeedsTable.familyId, familyId));
    await db.delete(familyNeedsTable).where(eq(familyNeedsTable.familyId, otherFamilyId));
    await db.delete(needStatusHistoryTable).where(eq(needStatusHistoryTable.needId, existingNeedId));
    await db.delete(familyMembersTable).where(eq(familyMembersTable.familyId, familyId));
    await db.delete(familyMembersTable).where(eq(familyMembersTable.familyId, otherFamilyId));
    await db.delete(familiesTable).where(eq(familiesTable.id, familyId));
    await db.delete(familiesTable).where(eq(familiesTable.id, otherFamilyId));
    await db.delete(familiesTable).where(eq(familiesTable.id, archivedFamilyId));
    if (userId) await db.delete(usersTable).where(eq(usersTable.id, userId));
    if (otherUserId) await db.delete(usersTable).where(eq(usersTable.id, otherUserId));
    await db.delete(campSectorsTable).where(eq(campSectorsTable.id, sectorId));
    await db.delete(campsTable).where(eq(campsTable.id, campId));
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});