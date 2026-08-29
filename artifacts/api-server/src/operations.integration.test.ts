import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import {
  aids,
  complaints,
  db,
  idempotencyKeys,
  sessions,
  staffUsers,
  tasks,
} from "@workspace/db";
import app from "./app";
import { hashToken } from "./middlewares/auth";

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
    }).returning({ id: complaints.id });
    complaintId = complaint.id;
    const [task] = await db.insert(tasks).values({
      title: "Conflict",
      description: "Task conflict test",
      location: "integration-test",
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
    await db.delete(staffUsers).where(eq(staffUsers.id, userId));
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});