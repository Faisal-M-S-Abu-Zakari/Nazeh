import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db, sessions, staffUsers } from "@workspace/db";
import app from "./app";
import { hashToken } from "./middlewares/auth";

test("staff management keeps ADMIN and MANAGER roles singleton and lists the manager", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const employeeId = randomUUID();
  const historicalManagerId = randomUUID();
  const secondHistoricalManagerId = randomUUID();
  const token = `staff-regression-${randomUUID()}`;
  const tokenHash = hashToken(token);
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  try {
    const [manager] = await db.select().from(staffUsers)
      .where(eq(staffUsers.email, "manager@alaqsa.local")).limit(1);
    assert(manager?.active);
    assert.equal(manager.role, "MANAGER");

    await db.insert(staffUsers).values([
      {
        id: employeeId,
        email: `employee-${employeeId}@example.invalid`,
        name: "Regression employee",
        passwordHash: "not-used",
        role: "DELEGATE",
        active: true,
      },
      {
        id: historicalManagerId,
        email: `historical-manager-${historicalManagerId}@example.invalid`,
        name: "Historical manager",
        passwordHash: "not-used",
        role: "ADMIN",
        active: false,
        passwordSetAt: null,
      },
      {
        id: secondHistoricalManagerId,
        email: `historical-manager-${secondHistoricalManagerId}@example.invalid`,
        name: "Second historical manager",
        passwordHash: "not-used",
        role: "MANAGER",
        active: false,
        passwordSetAt: null,
      },
    ]);
    await db.insert(sessions).values({
      userId: manager.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const listed = await fetch(`${baseUrl}/staff`, { headers });
    assert.equal(listed.status, 200);
    const listedBody = await listed.json() as { items: Array<{ id: string; role: string }> };
    assert(listedBody.items.some((staff) => staff.id === manager.id && staff.role === "MANAGER"));

    for (const role of ["ADMIN", "MANAGER"]) {
      const created = await fetch(`${baseUrl}/staff`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: `${role.toLowerCase()}-attempt-${randomUUID()}@example.invalid`,
          name: `Attempted ${role}`,
          role,
        }),
      });
      assert.equal(created.status, 400);
    }

    for (const role of ["ADMIN", "MANAGER"]) {
      const updated = await fetch(`${baseUrl}/staff/${employeeId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ role }),
      });
      assert.equal(updated.status, 400);
    }
    const [employee] = await db.select({ role: staffUsers.role })
      .from(staffUsers).where(eq(staffUsers.id, employeeId));
    assert.equal(employee.role, "DELEGATE");

    const reactivated = await fetch(`${baseUrl}/staff/${historicalManagerId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ active: true }),
    });
    assert.equal(reactivated.status, 409);

    const invited = await fetch(`${baseUrl}/staff/${historicalManagerId}/invite`, {
      method: "POST",
      headers,
    });
    assert.equal(invited.status, 409);

    const directActivations = await Promise.allSettled([
      db.update(staffUsers).set({ active: true }).where(eq(staffUsers.id, historicalManagerId)),
      db.update(staffUsers).set({ active: true }).where(eq(staffUsers.id, secondHistoricalManagerId)),
    ]);
    assert(directActivations.every((result) => result.status === "rejected"));
    const activePrivileged = await db.select({ id: staffUsers.id }).from(staffUsers)
      .where(and(
        inArray(staffUsers.role, ["ADMIN", "MANAGER"]),
        eq(staffUsers.active, true),
      ));
    assert.deepEqual(activePrivileged, [{ id: manager.id }]);
  } finally {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    await db.delete(staffUsers).where(inArray(staffUsers.id, [
      employeeId,
      historicalManagerId,
      secondHistoricalManagerId,
    ]));
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});