import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  sessions,
  sessionsTable,
  staffUsers,
  usersTable,
} from "@workspace/db";
import app from "./app";
import { hashToken } from "./middlewares/auth";

const jsonHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
});

test("staff avatar routes update only the authenticated staff account", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const staffId = randomUUID();
  const otherStaffId = randomUUID();
  const token = `avatar-staff-${randomUUID()}`;
  const otherToken = `avatar-other-staff-${randomUUID()}`;
  const objectPath = `/objects/avatars/${randomUUID()}`;

  try {
    await db.insert(staffUsers).values([
      {
        id: staffId,
        email: `avatar-staff-${staffId}@example.invalid`,
        name: "Avatar staff",
        passwordHash: "not-used",
        role: "DELEGATE",
      },
      {
        id: otherStaffId,
        email: `avatar-other-staff-${otherStaffId}@example.invalid`,
        name: "Other avatar staff",
        passwordHash: "not-used",
        role: "DELEGATE",
      },
    ]);
    await db.insert(sessions).values([
      {
        userId: staffId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60_000),
      },
      {
        userId: otherStaffId,
        tokenHash: hashToken(otherToken),
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);

    for (const body of [
      { name: "too-large.png", size: 5 * 1024 * 1024 + 1, contentType: "image/png" },
      { name: "avatar.gif", size: 1024, contentType: "image/gif" },
    ]) {
      const response = await fetch(`${baseUrl}/auth/avatar/upload-url`, {
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
    }

    for (const invalidPath of [
      `/objects/documents/${randomUUID()}`,
      `/objects/avatars/${randomUUID()}/extra`,
      `https://example.invalid/objects/avatars/${randomUUID()}`,
    ]) {
      const response = await fetch(`${baseUrl}/auth/avatar`, {
        method: "PATCH",
        headers: jsonHeaders(token),
        body: JSON.stringify({ objectPath: invalidPath, staffId: otherStaffId }),
      });
      assert.equal(response.status, 400);
    }

    const update = await fetch(`${baseUrl}/auth/avatar`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ objectPath, staffId: otherStaffId }),
    });
    assert.equal(update.status, 200);
    const updateBody = await update.json() as { id: string; profileImage: string | null };
    assert.equal(updateBody.id, staffId);
    assert.equal(updateBody.profileImage, objectPath);

    const profile = await fetch(`${baseUrl}/auth/me`, { headers: jsonHeaders(token) });
    assert.equal(profile.status, 200);
    const profileBody = await profile.json() as { id: string; profileImage: string | null };
    assert.equal(profileBody.id, staffId);
    assert.equal(profileBody.profileImage, objectPath);

    const [otherStaff] = await db.select({
      profileImage: staffUsers.profileImage,
    }).from(staffUsers).where(eq(staffUsers.id, otherStaffId));
    assert.equal(otherStaff.profileImage, null);
  } finally {
    await db.delete(sessions).where(inArray(sessions.userId, [staffId, otherStaffId]));
    await db.delete(staffUsers).where(inArray(staffUsers.id, [staffId, otherStaffId]));
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
});

test("family avatar routes update only the authenticated family account", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const token = `avatar-family-${randomUUID()}`;
  const otherToken = `avatar-other-family-${randomUUID()}`;
  const objectPath = `/objects/avatars/${randomUUID()}`;
  let userId: number | undefined;
  let otherUserId: number | undefined;

  try {
    const [user, otherUser] = await db.insert(usersTable).values([
      {
        email: `avatar-family-${randomUUID()}@example.invalid`,
        passwordHash: "not-used",
        role: "DISPLACED",
        rank: "DISPLACED",
        name: "Avatar family",
        identity: `avatar-family-${randomUUID()}`,
      },
      {
        email: `avatar-other-family-${randomUUID()}@example.invalid`,
        passwordHash: "not-used",
        role: "DISPLACED",
        rank: "DISPLACED",
        name: "Other avatar family",
        identity: `avatar-other-family-${randomUUID()}`,
      },
    ]).returning({ id: usersTable.id });
    userId = user.id;
    otherUserId = otherUser.id;
    await db.insert(sessionsTable).values([
      {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60_000),
      },
      {
        userId: otherUserId,
        tokenHash: hashToken(otherToken),
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);

    for (const body of [
      { name: "too-large.webp", size: 5 * 1024 * 1024 + 1, contentType: "image/webp" },
      { name: "avatar.svg", size: 1024, contentType: "image/svg+xml" },
    ]) {
      const response = await fetch(`${baseUrl}/family/me/avatar/upload-url`, {
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
    }

    for (const invalidPath of [
      `/private/avatars/${randomUUID()}`,
      `/objects/files/${randomUUID()}`,
      `/objects/avatars/not-a-uuid`,
    ]) {
      const response = await fetch(`${baseUrl}/family/me/avatar`, {
        method: "PATCH",
        headers: jsonHeaders(token),
        body: JSON.stringify({ objectPath: invalidPath, userId: otherUserId }),
      });
      assert.equal(response.status, 400);
    }

    const update = await fetch(`${baseUrl}/family/me/avatar`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ objectPath, userId: otherUserId }),
    });
    assert.equal(update.status, 200);
    assert.deepEqual(await update.json(), { profileImage: objectPath });

    const [savedUser, otherSavedUser] = await Promise.all([
      db.select({ profileImage: usersTable.profileImage })
        .from(usersTable).where(eq(usersTable.id, userId)).then((rows) => rows[0]),
      db.select({ profileImage: usersTable.profileImage })
        .from(usersTable).where(eq(usersTable.id, otherUserId)).then((rows) => rows[0]),
    ]);
    assert.equal(savedUser.profileImage, objectPath);
    assert.equal(otherSavedUser.profileImage, null);
  } finally {
    if (userId !== undefined) {
      await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    }
    if (otherUserId !== undefined) {
      await db.delete(sessionsTable).where(eq(sessionsTable.userId, otherUserId));
    }
    if (userId !== undefined) await db.delete(usersTable).where(eq(usersTable.id, userId));
    if (otherUserId !== undefined) await db.delete(usersTable).where(eq(usersTable.id, otherUserId));
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
});