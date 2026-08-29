import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  ArchiveAidBody,
  ArchiveAidParams,
  ArchiveAidResponse,
  ArchivePersonBody,
  ArchivePersonParams,
  ArchivePersonResponse,
  ArchiveSyncComplaintBody,
  ArchiveSyncComplaintParams,
  ArchiveSyncComplaintResponse,
  ArchiveSyncTaskBody,
  ArchiveSyncTaskParams,
  ArchiveSyncTaskResponse,
  CreateAidBody,
  CreateAidResponse,
  CreatePersonBody,
  CreatePersonResponse,
  CreateSyncComplaintBody,
  CreateSyncComplaintResponse,
  CreateSyncTaskBody,
  CreateSyncTaskResponse,
  ListAidsResponse,
  ListComplaintsResponse,
  ListPeopleResponse,
  ListSecurityOfficersResponse,
  ListTasksResponse,
  UpdatePersonBody,
  UpdatePersonParams,
  UpdatePersonResponse,
  UpdateSyncAidBody,
  UpdateSyncAidParams,
  UpdateSyncAidResponse,
  UpdateComplaintStatusBody,
  UpdateComplaintStatusParams,
  UpdateComplaintStatusResponse,
  UpdateTaskStatusBody,
  UpdateTaskStatusParams,
  UpdateTaskStatusResponse,
} from "@workspace/api-zod";
import {
  aids,
  complaints,
  db,
  people,
  staffUsers,
  syncAuditEvents,
  tasks,
  type StaffRole,
} from "@workspace/db";
import { allowRoles, requireAuth } from "../middlewares/auth";
import { withIdempotency } from "../lib/idempotency";
import { parseRequest } from "../lib/validation";

const router: IRouter = Router();
const recordManagers: StaffRole[] = ["ADMIN", "MANAGER", "DELEGATE"];
const taskManagers: StaffRole[] = ["ADMIN", "MANAGER", "SECURITY_OFFICER"];

router.use(requireAuth);

const audit = (
  tx: any,
  actorStaffId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
) =>
  tx.insert(syncAuditEvents).values({
    actorStaffId,
    action,
    entityType,
    entityId,
    metadata,
  });

const conflict = (label: string, current: { version: number }) => ({
  statusCode: 409,
  responseBody: {
    error: `${label} has been updated; refresh and retry with the current version`,
    currentVersion: current.version,
    currentRecord: current,
  },
});

async function assigneeValidationError(
  tx: any,
  assignedToId: string | null | undefined,
): Promise<{ statusCode: 400 | 404; responseBody: { error: string } } | undefined> {
  if (assignedToId == null) return undefined;
  const [staff] = await tx
    .select({ role: staffUsers.role })
    .from(staffUsers)
    .where(eq(staffUsers.id, assignedToId))
    .limit(1);
  if (!staff) {
    return { statusCode: 404, responseBody: { error: "Assigned staff member not found" } };
  }
  if (staff.role !== "SECURITY_OFFICER") {
    return { statusCode: 400, responseBody: { error: "Tasks may only be assigned to security officers" } };
  }
  return undefined;
}

router.get("/aids", allowRoles(...recordManagers), async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(aids)
    .where(isNull(aids.archivedAt))
    .orderBy(desc(aids.createdAt));
  res.json(ListAidsResponse.parse(rows));
});

router.post("/aids", allowRoles(...recordManagers), async (req, res): Promise<void> => {
  const body = parseRequest(CreateAidBody, req.body, res);
  if (!body) return;
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency(req, res, "createAid", async (tx) => {
    const [created] = await tx
      .insert(aids)
      .values({
        ...body,
        distributionDate: body.distributionDate.toISOString().slice(0, 10),
        createdById: actorId,
      })
      .returning();
    await audit(tx, actorId, "CREATE", "AID", created.id, { version: created.version });
    return { statusCode: 201, responseBody: CreateAidResponse.parse(created) };
  });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/aids/:aidId", allowRoles(...recordManagers), async (req, res): Promise<void> => {
  const params = parseRequest(UpdateSyncAidParams, req.params, res);
  const body = parseRequest(UpdateSyncAidBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const { expectedVersion, distributionDate, ...changes } = body;
  const result = await withIdempotency<unknown>(req, res, `updateSyncAid:${params.aidId}`, async (tx) => {
    const [updated] = await tx
      .update(aids)
      .set({
        ...changes,
        ...(distributionDate
          ? { distributionDate: distributionDate.toISOString().slice(0, 10) }
          : {}),
        version: sql`${aids.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(aids.id, params.aidId), eq(aids.version, expectedVersion), isNull(aids.archivedAt)))
      .returning();
    if (updated) {
      await audit(tx, actorId, "UPDATE", "AID", updated.id, {
        expectedVersion,
        changedFields: Object.keys(changes).concat(distributionDate ? ["distributionDate"] : []),
      });
      return { statusCode: 200, responseBody: UpdateSyncAidResponse.parse(updated) };
    }
    const [current] = await tx.select().from(aids).where(eq(aids.id, params.aidId)).limit(1);
    if (!current) return { statusCode: 404, responseBody: { error: "Aid not found" } };
    return conflict("Aid", current);
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/aids/:aidId/archive", allowRoles(...recordManagers), async (req, res): Promise<void> => {
  const params = parseRequest(ArchiveAidParams, req.params, res);
  const body = parseRequest(ArchiveAidBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency<unknown>(req, res, `archiveAid:${params.aidId}`, async (tx) => {
    const [updated] = await tx.update(aids).set({
      archivedAt: new Date(), updatedAt: new Date(), version: sql`${aids.version} + 1`,
    }).where(and(eq(aids.id, params.aidId), eq(aids.version, body.expectedVersion), isNull(aids.archivedAt))).returning();
    if (updated) {
      await audit(tx, actorId, "ARCHIVE", "AID", updated.id, { expectedVersion: body.expectedVersion });
      return { statusCode: 200, responseBody: ArchiveAidResponse.parse(updated) };
    }
    const [current] = await tx.select().from(aids).where(eq(aids.id, params.aidId)).limit(1);
    if (!current) return { statusCode: 404, responseBody: { error: "Aid not found" } };
    return conflict("Aid", current);
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.get("/people", allowRoles(...recordManagers), async (_req, res): Promise<void> => {
  const rows = await db.select().from(people).where(isNull(people.archivedAt)).orderBy(desc(people.createdAt));
  res.json(ListPeopleResponse.parse(rows));
});

router.post("/people", allowRoles(...recordManagers), async (req, res): Promise<void> => {
  const body = parseRequest(CreatePersonBody, req.body, res);
  if (!body) return;
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency(req, res, "createPerson", async (tx) => {
    const [created] = await tx.insert(people).values({
      ...body,
      birthDate: body.birthDate.toISOString().slice(0, 10),
      createdById: actorId,
    }).returning();
    await audit(tx, actorId, "CREATE", "PERSON", created.id, { version: created.version });
    return { statusCode: 201, responseBody: CreatePersonResponse.parse(created) };
  });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/people/:personId", allowRoles(...recordManagers), async (req, res): Promise<void> => {
  const params = parseRequest(UpdatePersonParams, req.params, res);
  const body = parseRequest(UpdatePersonBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const { expectedVersion, birthDate, ...changes } = body;
  const result = await withIdempotency<unknown>(req, res, `updatePerson:${params.personId}`, async (tx) => {
    const [updated] = await tx.update(people).set({
      ...changes,
      ...(birthDate ? { birthDate: birthDate.toISOString().slice(0, 10) } : {}),
      updatedAt: new Date(),
      version: sql`${people.version} + 1`,
    }).where(and(eq(people.id, params.personId), eq(people.version, expectedVersion), isNull(people.archivedAt))).returning();
    if (updated) {
      await audit(tx, actorId, "UPDATE", "PERSON", updated.id, {
        expectedVersion,
        changedFields: Object.keys(changes).concat(birthDate ? ["birthDate"] : []),
      });
      return { statusCode: 200, responseBody: UpdatePersonResponse.parse(updated) };
    }
    const [current] = await tx.select().from(people).where(eq(people.id, params.personId)).limit(1);
    if (!current) return { statusCode: 404, responseBody: { error: "Person not found" } };
    return conflict("Person", current);
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/people/:personId/archive", allowRoles(...recordManagers), async (req, res): Promise<void> => {
  const params = parseRequest(ArchivePersonParams, req.params, res);
  const body = parseRequest(ArchivePersonBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency<unknown>(req, res, `archivePerson:${params.personId}`, async (tx) => {
    const [updated] = await tx.update(people).set({
      archivedAt: new Date(), updatedAt: new Date(), version: sql`${people.version} + 1`,
    }).where(and(eq(people.id, params.personId), eq(people.version, body.expectedVersion), isNull(people.archivedAt))).returning();
    if (updated) {
      await audit(tx, actorId, "ARCHIVE", "PERSON", updated.id, { expectedVersion: body.expectedVersion });
      return { statusCode: 200, responseBody: ArchivePersonResponse.parse(updated) };
    }
    const [current] = await tx.select().from(people).where(eq(people.id, params.personId)).limit(1);
    if (!current) return { statusCode: 404, responseBody: { error: "Person not found" } };
    return conflict("Person", current);
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.get("/complaints", allowRoles(...recordManagers), async (_req, res): Promise<void> => {
  const rows = await db.select().from(complaints).where(isNull(complaints.archivedAt)).orderBy(desc(complaints.createdAt));
  res.json(ListComplaintsResponse.parse(rows));
});

router.post("/complaints", allowRoles(...recordManagers), async (req, res): Promise<void> => {
  const body = parseRequest(CreateSyncComplaintBody, req.body, res);
  if (!body) return;
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency(req, res, "createSyncComplaint", async (tx) => {
    const [created] = await tx.insert(complaints).values({ ...body, createdById: actorId }).returning();
    await audit(tx, actorId, "CREATE", "COMPLAINT", created.id, { version: created.version });
    return { statusCode: 201, responseBody: CreateSyncComplaintResponse.parse(created) };
  });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/complaints/:complaintId", allowRoles(...recordManagers), async (req, res): Promise<void> => {
  const params = parseRequest(UpdateComplaintStatusParams, req.params, res);
  const body = parseRequest(UpdateComplaintStatusBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const { expectedVersion, ...changes } = body;
  const replyChanged = Object.prototype.hasOwnProperty.call(changes, "reply");
  const changedFields = Object.keys(changes);
  const auditAction =
    changedFields.length === 1 && changedFields[0] === "status"
      ? "STATUS"
      : changedFields.length === 1 && changedFields[0] === "reply"
        ? "REPLY"
        : "UPDATE";
  const result = await withIdempotency<unknown>(req, res, `updateComplaintStatus:${params.complaintId}`, async (tx) => {
    const [updated] = await tx.update(complaints).set({
      ...changes,
      ...(replyChanged ? { repliedById: actorId, repliedAt: new Date() } : {}),
      version: sql`${complaints.version} + 1`,
      updatedAt: new Date(),
    }).where(and(eq(complaints.id, params.complaintId), eq(complaints.version, expectedVersion), isNull(complaints.archivedAt))).returning();
    if (updated) {
      await audit(tx, actorId, auditAction, "COMPLAINT", updated.id, {
        expectedVersion, changedFields,
      });
      return { statusCode: 200, responseBody: UpdateComplaintStatusResponse.parse(updated) };
    }
    const [current] = await tx.select().from(complaints).where(eq(complaints.id, params.complaintId)).limit(1);
    if (!current) return { statusCode: 404, responseBody: { error: "Complaint not found" } };
    return conflict("Complaint", current);
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/complaints/:complaintId/archive", allowRoles(...recordManagers), async (req, res): Promise<void> => {
  const params = parseRequest(ArchiveSyncComplaintParams, req.params, res);
  const body = parseRequest(ArchiveSyncComplaintBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency<unknown>(req, res, `archiveSyncComplaint:${params.complaintId}`, async (tx) => {
    const [updated] = await tx.update(complaints).set({
      archivedAt: new Date(), updatedAt: new Date(), version: sql`${complaints.version} + 1`,
    }).where(and(eq(complaints.id, params.complaintId), eq(complaints.version, body.expectedVersion), isNull(complaints.archivedAt))).returning();
    if (updated) {
      await audit(tx, actorId, "ARCHIVE", "COMPLAINT", updated.id, { expectedVersion: body.expectedVersion });
      return { statusCode: 200, responseBody: ArchiveSyncComplaintResponse.parse(updated) };
    }
    const [current] = await tx.select().from(complaints).where(eq(complaints.id, params.complaintId)).limit(1);
    if (!current) return { statusCode: 404, responseBody: { error: "Complaint not found" } };
    return conflict("Complaint", current);
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.get("/tasks", allowRoles(...taskManagers), async (_req, res): Promise<void> => {
  const rows = await db.select().from(tasks).where(isNull(tasks.archivedAt)).orderBy(desc(tasks.createdAt));
  res.json(ListTasksResponse.parse(rows));
});

router.get("/security-officers", allowRoles(...taskManagers), async (_req, res): Promise<void> => {
  const officers = await db
    .select({
      id: staffUsers.id,
      email: staffUsers.email,
      name: staffUsers.name,
      role: staffUsers.role,
    })
    .from(staffUsers)
    .where(eq(staffUsers.role, "SECURITY_OFFICER"))
    .orderBy(staffUsers.name);
  res.json(ListSecurityOfficersResponse.parse(officers));
});

router.post("/tasks", allowRoles(...taskManagers), async (req, res): Promise<void> => {
  const body = parseRequest(CreateSyncTaskBody, req.body, res);
  if (!body) return;
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency<unknown>(req, res, "createSyncTask", async (tx) => {
    const assigneeError = await assigneeValidationError(tx, body.assignedToId);
    if (assigneeError) return assigneeError;
    const [created] = await tx.insert(tasks).values({ ...body, createdById: actorId }).returning();
    await audit(tx, actorId, "CREATE", "TASK", created.id, { version: created.version });
    return { statusCode: 201, responseBody: CreateSyncTaskResponse.parse(created) };
  });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/tasks/:taskId", allowRoles(...taskManagers), async (req, res): Promise<void> => {
  const params = parseRequest(UpdateTaskStatusParams, req.params, res);
  const body = parseRequest(UpdateTaskStatusBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const { expectedVersion, ...changes } = body;
  const changedFields = Object.keys(changes);
  const auditAction =
    changedFields.length === 1 && changedFields[0] === "status" ? "STATUS" : "UPDATE";
  const result = await withIdempotency<unknown>(req, res, `updateTaskStatus:${params.taskId}`, async (tx) => {
    const assigneeError = await assigneeValidationError(tx, changes.assignedToId);
    if (assigneeError) return assigneeError;
    const [updated] = await tx.update(tasks).set({
      ...changes, version: sql`${tasks.version} + 1`, updatedAt: new Date(),
    }).where(and(eq(tasks.id, params.taskId), eq(tasks.version, expectedVersion), isNull(tasks.archivedAt))).returning();
    if (updated) {
      await audit(tx, actorId, auditAction, "TASK", updated.id, {
        expectedVersion, changedFields,
      });
      return { statusCode: 200, responseBody: UpdateTaskStatusResponse.parse(updated) };
    }
    const [current] = await tx.select().from(tasks).where(eq(tasks.id, params.taskId)).limit(1);
    if (!current) return { statusCode: 404, responseBody: { error: "Task not found" } };
    return conflict("Task", current);
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/tasks/:taskId/archive", allowRoles(...taskManagers), async (req, res): Promise<void> => {
  const params = parseRequest(ArchiveSyncTaskParams, req.params, res);
  const body = parseRequest(ArchiveSyncTaskBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency<unknown>(req, res, `archiveSyncTask:${params.taskId}`, async (tx) => {
    const [updated] = await tx.update(tasks).set({
      archivedAt: new Date(), updatedAt: new Date(), version: sql`${tasks.version} + 1`,
    }).where(and(eq(tasks.id, params.taskId), eq(tasks.version, body.expectedVersion), isNull(tasks.archivedAt))).returning();
    if (updated) {
      await audit(tx, actorId, "ARCHIVE", "TASK", updated.id, { expectedVersion: body.expectedVersion });
      return { statusCode: 200, responseBody: ArchiveSyncTaskResponse.parse(updated) };
    }
    const [current] = await tx.select().from(tasks).where(eq(tasks.id, params.taskId)).limit(1);
    if (!current) return { statusCode: 404, responseBody: { error: "Task not found" } };
    return conflict("Task", current);
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

export default router;