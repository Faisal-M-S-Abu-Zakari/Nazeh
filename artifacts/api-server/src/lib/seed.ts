import { eq } from "drizzle-orm";
import { aidRecipientsTable, aidsTable, complaintsTable, contentPostsTable, db, displacedPersonsTable, notificationsTable, securityTasksTable, usersTable } from "@workspace/db";
import { hashPassword } from "./security";
import { logger } from "./logger";

let seeded: Promise<void> | undefined;
/** Minimal, idempotent local data only. It is deliberately never callable in production. */
export function seedDevelopmentData(): Promise<void> {
  if (process.env.NODE_ENV !== "development") return Promise.resolve();
  seeded ??= (async () => {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, "staff@alaqsa.local"));
    if (existing) return;
    const passwordHash = await hashPassword("123456");
    const add = async (name: string, email: string, role: "MANAGER" | "DELEGATE" | "SECURITY" | "DISPLACED", identity: string) =>
      (await db.insert(usersTable).values({ name, email, role, rank: role, identity, passwordHash, active: true }).returning())[0];
    const manager = await add("Camp Manager", "staff@alaqsa.local", "MANAGER", "dev-manager");
    const delegate = await add("Field Delegate", "delegate@local.invalid", "DELEGATE", "dev-delegate");
    const security = await add("Security Officer", "security@local.invalid", "SECURITY", "dev-security");
    const displaced = await add("Displaced Resident", "resident@local.invalid", "DISPLACED", "dev-resident");
    const [person] = await db.insert(displacedPersonsTable).values({ userId: displaced.id, delegateUserId: delegate.id, familyNumber: 4, tentName: "Tent A-12" }).returning();
    const [aid] = await db.insert(aidsTable).values({ title: "Food parcels", type: "Food", targetFamilies: 50, status: "ACTIVE", createdBy: manager.id }).returning();
    await db.insert(aidRecipientsTable).values({ aidId: aid.id, displacedPersonId: person.id, assignedBy: delegate.id });
    await db.insert(aidsTable).values({ title: "Hygiene kits", type: "Hygiene", targetFamilies: 30, status: "ACTIVE", createdBy: manager.id });
    await db.insert(complaintsTable).values({ authorUserId: displaced.id, type: "GENERAL", subject: "Water supply", body: "Please review water access." });
    await db.insert(notificationsTable).values({ recipientUserId: delegate.id, actorUserId: manager.id, type: "SYSTEM", action: "WELCOME", title: "Welcome", body: "You have been assigned residents." });
    await db.insert(securityTasksTable).values({ title: "Evening perimeter check", body: "Check all access points.", dueAt: new Date(), createdBy: security.id });
    await db.insert(contentPostsTable).values({ title: "Camp update", body: "Latest camp update.", type: "BLOG", status: "PUBLISHED", authorUserId: manager.id, publishedAt: new Date() });
    logger.info({ displacedPersonId: person.id }, "Development data seeded");
  })().catch((error: unknown) => { seeded = undefined; logger.warn({ error }, "Development seed unavailable"); });
  return seeded;
}