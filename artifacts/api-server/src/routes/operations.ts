import { Router, type IRouter } from "express";
import { and, count, desc, eq, inArray, isNull, sql, sum } from "drizzle-orm";
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
  ApproveFamilyBody,
  ApproveFamilyParams,
  ApproveFamilyResponse,
  ArchiveFamilyBody,
  ArchiveFamilyParams,
  ArchiveFamilyResponse,
  ArchiveNeedBody,
  ArchiveNeedParams,
  ArchiveNeedResponse,
  ArchiveShelterBody,
  ArchiveShelterParams,
  ArchiveShelterResponse,
  CreateCampBody,
  CreateCampResponse,
  CreateFamilyBody,
  CreateFamilyResponse,
  ImportFamiliesBody,
  ImportFamiliesResponse,
  CreateNeedBody,
  CreateNeedResponse,
  CreateShelterBody,
  CreateShelterResponse,
  CreateSectorBody,
  CreateSectorResponse,
  GetFamilyParams,
  GetFamilyResponse,
  ListCampsResponse,
  ListFamiliesResponse,
  ListNeedsResponse,
  ListSecurityMembersResponse,
  ListSectorsResponse,
  ListSheltersResponse,
  UpdateFamilyBody,
  UpdateFamilyParams,
  UpdateFamilyResponse,
  UpdateNeedBody,
  UpdateNeedParams,
  UpdateNeedResponse,
  UpdateShelterBody,
  UpdateShelterParams,
  UpdateShelterResponse,
  SubmitTaskBody,
  SubmitTaskParams,
  SubmitTaskResponse,
  ApproveTaskBody,
  ApproveTaskParams,
  ApproveTaskResponse,
  CreateAidDistributionBody,
  CreateAidDistributionParams,
  CreateAidDistributionResponse,
  ListAidDistributionsParams,
  ListAidDistributionsResponse,
  ReceiveAidDistributionBody,
  ReceiveAidDistributionParams,
  ReceiveAidDistributionResponse,
  CancelAidDistributionParams,
  CancelAidDistributionResponse,
} from "@workspace/api-zod";
import {
  aids,
  aidDistributionsTable,
  complaints,
  db,
  people,
  staffUsers,
  syncAuditEvents,
  tasks,
  type StaffRole,
  campSectorsTable,
  campsTable,
  familyAssignmentHistoryTable,
  familyMembersTable,
  familyNeedsTable,
  familiesTable,
  needStatusHistoryTable,
  shelterUnitsTable,
} from "@workspace/db";
import { allowRoles, requireAuth } from "../middlewares/auth";
import { withIdempotency } from "../lib/idempotency";
import { parseRequest } from "../lib/validation";
import { canonicalFamilyImportDigest, isMatchingFamilyImportReplay } from "../lib/family-import-idempotency";
import { normalizeLocationName, trimLocationNameInput } from "../lib/location-setup";
import {
  hasExistingNationalIds,
  isNationalIdUniqueViolation,
  lockShelterRows,
  normalizeNationalId,
  uniqueNormalizedNationalIds,
} from "../lib/family-write-guards";

const router: IRouter = Router();
const recordManagers: StaffRole[] = ["ADMIN", "MANAGER", "DELEGATE"];
const complaintReaders: StaffRole[] = [...recordManagers, "SECURITY_OFFICER", "SECURITY_MEMBER"];
const taskManagers: StaffRole[] = ["ADMIN", "MANAGER", "SECURITY_OFFICER"];
const taskReaders: StaffRole[] = [...taskManagers, "SECURITY_MEMBER"];

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
    code: "VERSION_CONFLICT",
    currentVersion: current.version,
  },
});

async function assigneeValidationError(
  tx: any,
  assignedToId: string | null | undefined,
): Promise<{ statusCode: 400 | 404; responseBody: { error: string } } | undefined> {
  if (assignedToId == null) return undefined;
  const [staff] = await tx
  .select({ role: staffUsers.role, active: staffUsers.active })
    .from(staffUsers)
    .where(eq(staffUsers.id, assignedToId))
    .limit(1);
  if (!staff) {
    return { statusCode: 404, responseBody: { error: "Assigned staff member not found" } };
  }
  if (!staff.active || (staff.role !== "SECURITY_OFFICER" && staff.role !== "SECURITY_MEMBER")) {
    return { statusCode: 400, responseBody: { error: "Tasks may only be assigned to security staff" } };
  }
  return undefined;
}

router.get("/aids", allowRoles(...recordManagers, "SECURITY_OFFICER"), async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: aids.id,
      title: aids.title,
      type: aids.type,
      quantity: aids.quantity,
      unit: aids.unit,
      location: aids.location,
      distributionDate: aids.distributionDate,
      notes: aids.notes,
      createdById: aids.createdById,
      createdAt: aids.createdAt,
      updatedAt: aids.updatedAt,
      archivedAt: aids.archivedAt,
      version: aids.version,
      distributionCount: sql<number>`(
        SELECT COUNT(*)::int FROM aid_distributions d
        WHERE d.aid_id = ${aids.id} AND d.status <> 'CANCELLED'
      )`,
      receivedDistributionCount: sql<number>`(
        SELECT COUNT(*)::int FROM aid_distributions d
        WHERE d.aid_id = ${aids.id} AND d.status = 'RECEIVED'
      )`,
    })
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

router.get("/complaints", allowRoles(...complaintReaders), async (_req, res): Promise<void> => {
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

router.get("/tasks", allowRoles(...taskReaders), async (_req, res): Promise<void> => {
  const staff = res.locals["staff"] as { id: string; role: StaffRole };
  const scope = staff.role === "SECURITY_MEMBER" ? eq(tasks.assignedToId, staff.id) : undefined;
  const rows = await db.select().from(tasks).where(and(isNull(tasks.archivedAt), scope)).orderBy(desc(tasks.createdAt));
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

router.patch("/tasks/:taskId", allowRoles(...taskReaders), async (req, res): Promise<void> => {
  const params = parseRequest(UpdateTaskStatusParams, req.params, res);
  const body = parseRequest(UpdateTaskStatusBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const staff = res.locals["staff"] as { id: string; role: StaffRole };
  const { expectedVersion, ...changes } = body;
  if (staff.role === "SECURITY_MEMBER" && changes.status === "COMPLETED") {
    res.status(403).json({ error: "Security members must submit results for officer approval" });
    return;
  }
  const changedFields = Object.keys(changes);
  const auditAction =
    changedFields.length === 1 && changedFields[0] === "status" ? "STATUS" : "UPDATE";
  const result = await withIdempotency<unknown>(req, res, `updateTaskStatus:${params.taskId}`, async (tx) => {
    const assigneeError = await assigneeValidationError(tx, changes.assignedToId);
    if (assigneeError) return assigneeError;
    const taskScope = staff.role === "SECURITY_MEMBER" ? eq(tasks.assignedToId, staff.id) : undefined;
    const [updated] = await tx.update(tasks).set({
      ...changes, version: sql`${tasks.version} + 1`, updatedAt: new Date(),
    }).where(and(eq(tasks.id, params.taskId), eq(tasks.version, expectedVersion), isNull(tasks.archivedAt), taskScope)).returning();
    if (updated) {
      await audit(tx, actorId, auditAction, "TASK", updated.id, {
        expectedVersion, changedFields,
      });
      return { statusCode: 200, responseBody: UpdateTaskStatusResponse.parse(updated) };
    }
    const [current] = await tx.select().from(tasks)
      .where(and(eq(tasks.id, params.taskId), taskScope, isNull(tasks.archivedAt))).limit(1);
    if (!current) return { statusCode: 404, responseBody: { error: "Task not found" } };
    return conflict("Task", current);
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/tasks/:taskId/submit", allowRoles("SECURITY_MEMBER"), async (req, res): Promise<void> => {
  const params = parseRequest(SubmitTaskParams, req.params, res);
  const body = parseRequest(SubmitTaskBody, req.body, res);
  if (!params || !body) return;
  const staff = res.locals["staff"] as { id: string; role: StaffRole };
  const result = await withIdempotency<unknown>(req, res, `submitTask:${params.taskId}`, async (tx) => {
    const [updated] = await tx.update(tasks).set({
      status: "COMPLETED",
      result: body.result,
      completedById: staff.id,
      submittedAt: new Date(),
      approvedById: null,
      approvedAt: null,
      version: sql`${tasks.version} + 1`,
      updatedAt: new Date(),
    }).where(and(
      eq(tasks.id, params.taskId),
      eq(tasks.assignedToId, staff.id),
      eq(tasks.version, body.expectedVersion),
      isNull(tasks.archivedAt),
    )).returning();
    if (!updated) {
      const [current] = await tx.select({ version: tasks.version }).from(tasks).where(and(
        eq(tasks.id, params.taskId),
        eq(tasks.assignedToId, staff.id),
        isNull(tasks.archivedAt),
      )).limit(1);
      if (!current) return { statusCode: 404, responseBody: { error: "Assigned task not found" } };
      if (current.version !== body.expectedVersion) return conflict("Task", current);
      return { statusCode: 404, responseBody: { error: "Assigned task not found" } };
    }
    await audit(tx, staff.id, "SUBMIT", "TASK", updated.id, { expectedVersion: body.expectedVersion });
    return { statusCode: 200, responseBody: SubmitTaskResponse.parse(updated) };
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/tasks/:taskId/approve", allowRoles(...taskManagers), async (req, res): Promise<void> => {
  const params = parseRequest(ApproveTaskParams, req.params, res);
  const body = parseRequest(ApproveTaskBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency<unknown>(req, res, `approveTask:${params.taskId}`, async (tx) => {
    const [updated] = await tx.update(tasks).set({
      approvedById: actorId,
      approvedAt: new Date(),
      version: sql`${tasks.version} + 1`,
      updatedAt: new Date(),
    }).where(and(
      eq(tasks.id, params.taskId),
      eq(tasks.status, "COMPLETED"),
      isNull(tasks.approvedAt),
      eq(tasks.version, body.expectedVersion),
      isNull(tasks.archivedAt),
    )).returning();
    if (!updated) {
      const [current] = await tx.select({ version: tasks.version }).from(tasks).where(and(
        eq(tasks.id, params.taskId),
        isNull(tasks.archivedAt),
      )).limit(1);
      if (!current) return { statusCode: 404, responseBody: { error: "Submitted task not found" } };
      if (current.version !== body.expectedVersion) return conflict("Task", current);
      return { statusCode: 404, responseBody: { error: "Submitted task not found" } };
    }
    await audit(tx, actorId, "APPROVE", "TASK", updated.id, { note: body.note ?? null });
    return { statusCode: 200, responseBody: ApproveTaskResponse.parse(updated) };
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

const familyManagers: StaffRole[] = ["ADMIN", "MANAGER", "DELEGATE"];
const familyApprovers: StaffRole[] = ["ADMIN", "MANAGER"];
const securityLeads: StaffRole[] = ["ADMIN", "MANAGER", "SECURITY_OFFICER"];

const familyScope = (staff: { id: string; role: StaffRole }) =>
  staff.role === "DELEGATE" ? eq(familiesTable.delegateId, staff.id) : undefined;

async function getFamilyDetail(tx: any, familyId: string) {
  const [family] = await tx.select().from(familiesTable).where(eq(familiesTable.id, familyId)).limit(1);
  if (!family) return undefined;
  const members = await tx
    .select()
    .from(familyMembersTable)
    .where(eq(familyMembersTable.familyId, familyId))
    .orderBy(familyMembersTable.createdAt);
  return { ...family, members };
}

async function validatePlacement(
  tx: any,
  campId: string,
  sectorId: string,
  shelterId: string | null | undefined,
  familyId?: string,
  checkCapacity = true,
) {
  const [sector] = await tx
    .select()
    .from(campSectorsTable)
    .where(and(eq(campSectorsTable.id, sectorId), eq(campSectorsTable.campId, campId)))
    .limit(1);
  if (!sector) return "Sector does not belong to the selected camp";
  if (!shelterId) return undefined;
  const [shelter] = await tx
    .select()
    .from(shelterUnitsTable)
    .where(and(eq(shelterUnitsTable.id, shelterId), eq(shelterUnitsTable.sectorId, sectorId)))
    .limit(1);
  if (!shelter || shelter.archivedAt) return "Shelter does not belong to the selected sector";
  if (checkCapacity) {
    const assigned = await tx
      .select({ value: count() })
      .from(familiesTable)
      .where(and(eq(familiesTable.shelterId, shelterId), isNull(familiesTable.archivedAt), familyId ? sql`${familiesTable.id} <> ${familyId}` : undefined));
    if (Number(assigned[0]?.value ?? 0) >= shelter.capacity) return "Shelter has reached its capacity";
  }
  return undefined;
}

router.get("/camps", allowRoles(...familyManagers, ...securityLeads), async (_req, res): Promise<void> => {
  res.json(ListCampsResponse.parse(await db.select().from(campsTable).where(eq(campsTable.active, true))));
});

router.post("/camps", allowRoles("ADMIN", "MANAGER"), async (req, res): Promise<void> => {
  const body = parseRequest(CreateCampBody, trimLocationNameInput(req.body), res);
  if (!body) return;
  const name = normalizeLocationName(body.name);
  if (!name) {
    res.status(400).json({ error: "Camp name must contain 1 to 160 characters" });
    return;
  }
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency<unknown>(req, res, "createCamp", async (tx) => {
    // Serialize the name check even when campsTable is empty, where row locks cannot prevent races.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(734201, 1)`);
    const [duplicate] = await tx
      .select({ id: campsTable.id })
      .from(campsTable)
      .where(and(
        eq(campsTable.active, true),
        sql`lower(btrim(${campsTable.name})) = lower(${name})`,
      ))
      .limit(1);
    if (duplicate) {
      return { statusCode: 409, responseBody: { error: "An active camp with this name already exists" } };
    }
    const [created] = await tx.insert(campsTable).values({ name }).returning();
    await audit(tx, actorId, "CREATE", "CAMP", created.id, { name });
    return { statusCode: 201, responseBody: CreateCampResponse.parse(created) };
  });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.get("/sectors", allowRoles(...familyManagers, ...securityLeads), async (_req, res): Promise<void> => {
  res.json(ListSectorsResponse.parse(await db.select().from(campSectorsTable).orderBy(campSectorsTable.name)));
});

router.post("/sectors", allowRoles("ADMIN", "MANAGER"), async (req, res): Promise<void> => {
  const body = parseRequest(CreateSectorBody, trimLocationNameInput(req.body), res);
  if (!body) return;
  const name = normalizeLocationName(body.name);
  if (!name) {
    res.status(400).json({ error: "Sector name must contain 1 to 160 characters" });
    return;
  }
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency<unknown>(req, res, "createSector", async (tx) => {
    const [camp] = await tx
      .select()
      .from(campsTable)
      .where(and(eq(campsTable.id, body.campId), eq(campsTable.active, true)))
      .for("update")
      .limit(1);
    if (!camp) return { statusCode: 404, responseBody: { error: "Active camp not found" } };

    const [duplicate] = await tx
      .select({ id: campSectorsTable.id })
      .from(campSectorsTable)
      .where(and(
        eq(campSectorsTable.campId, body.campId),
        sql`lower(btrim(${campSectorsTable.name})) = lower(${name})`,
      ))
      .limit(1);
    if (duplicate) {
      return { statusCode: 409, responseBody: { error: "A sector with this name already exists in this camp" } };
    }

    const [created] = await tx.insert(campSectorsTable).values({ campId: camp.id, name }).returning();
    await audit(tx, actorId, "CREATE", "SECTOR", created.id, { campId: camp.id, name });
    return { statusCode: 201, responseBody: CreateSectorResponse.parse(created) };
  });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.get("/shelters", allowRoles(...familyManagers, ...securityLeads), async (_req, res): Promise<void> => {
  res.json(ListSheltersResponse.parse(await db.select().from(shelterUnitsTable).where(isNull(shelterUnitsTable.archivedAt)).orderBy(shelterUnitsTable.code)));
});

router.post("/shelters", allowRoles(...familyApprovers), async (req, res): Promise<void> => {
  const body = parseRequest(CreateShelterBody, req.body, res);
  if (!body) return;
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency<unknown>(req, res, "createShelter", async (tx) => {
    const [sector] = await tx.select().from(campSectorsTable).where(eq(campSectorsTable.id, body.sectorId)).limit(1);
    if (!sector) return { statusCode: 400, responseBody: { error: "Sector not found" } };
    const [created] = await tx.insert(shelterUnitsTable).values({
      sectorId: body.sectorId,
      code: body.code,
      capacity: body.capacity,
      status: body.status ?? "AVAILABLE",
    }).returning();
    await audit(tx, actorId, "CREATE", "SHELTER", created.id, { version: created.version });
    return { statusCode: 201, responseBody: CreateShelterResponse.parse(created) };
  });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/shelters/:shelterId", allowRoles(...familyApprovers), async (req, res): Promise<void> => {
  const params = parseRequest(UpdateShelterParams, req.params, res);
  const body = parseRequest(UpdateShelterBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const { expectedVersion, ...changes } = body;
  const result = await withIdempotency<unknown>(req, res, `updateShelter:${params.shelterId}`, async (tx) => {
    await lockShelterRows(tx, [params.shelterId]);
    if (changes.capacity !== undefined) {
      const [assigned] = await tx
        .select({ value: count() })
        .from(familiesTable)
        .where(and(eq(familiesTable.shelterId, params.shelterId), isNull(familiesTable.archivedAt)));
      if (Number(assigned?.value ?? 0) > changes.capacity) {
        return { statusCode: 409, responseBody: { error: "Shelter capacity cannot be lower than its current assignments" } };
      }
    }
    const [updated] = await tx.update(shelterUnitsTable).set({
      ...changes,
      version: sql`${shelterUnitsTable.version} + 1`,
      updatedAt: new Date(),
    }).where(and(eq(shelterUnitsTable.id, params.shelterId), eq(shelterUnitsTable.version, expectedVersion), isNull(shelterUnitsTable.archivedAt))).returning();
    if (!updated) {
      const [current] = await tx.select().from(shelterUnitsTable).where(eq(shelterUnitsTable.id, params.shelterId)).limit(1);
      return current ? conflict("Shelter", current) : { statusCode: 404, responseBody: { error: "Shelter not found" } };
    }
    await audit(tx, actorId, "UPDATE", "SHELTER", updated.id, { expectedVersion, changedFields: Object.keys(changes) });
    return { statusCode: 200, responseBody: UpdateShelterResponse.parse(updated) };
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/shelters/:shelterId/archive", allowRoles(...familyApprovers), async (req, res): Promise<void> => {
  const params = parseRequest(ArchiveShelterParams, req.params, res);
  const body = parseRequest(ArchiveShelterBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency<unknown>(req, res, `archiveShelter:${params.shelterId}`, async (tx) => {
    await lockShelterRows(tx, [params.shelterId]);
    const [updated] = await tx.update(shelterUnitsTable).set({
      archivedAt: new Date(), version: sql`${shelterUnitsTable.version} + 1`, updatedAt: new Date(),
    }).where(and(eq(shelterUnitsTable.id, params.shelterId), eq(shelterUnitsTable.version, body.expectedVersion), isNull(shelterUnitsTable.archivedAt))).returning();
    if (!updated) return { statusCode: 404, responseBody: { error: "Shelter not found" } };
    await audit(tx, actorId, "ARCHIVE", "SHELTER", updated.id, { expectedVersion: body.expectedVersion });
    return { statusCode: 200, responseBody: ArchiveShelterResponse.parse(updated) };
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.get("/families", allowRoles(...familyManagers), async (req, res): Promise<void> => {
  const staff = res.locals["staff"] as { id: string; role: StaffRole };
  const rows = await db
    .select()
    .from(familiesTable)
    .where(and(isNull(familiesTable.archivedAt), familyScope(staff)))
    .orderBy(desc(familiesTable.createdAt));
  res.json(ListFamiliesResponse.parse(rows));
});

router.post("/families/import", allowRoles("ADMIN", "MANAGER"), async (req, res): Promise<void> => {
  const sourceFileKey = req.get("Idempotency-Key") ?? "";
  if (!/^sha256-[a-f0-9]{64}$/.test(sourceFileKey)) {
    res.status(400).json({ error: "مفتاح الاستيراد يجب أن يكون بصمة SHA-256 للملف كاملاً." });
    return;
  }
  const parsed = ImportFamiliesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ملف الاستيراد لا يطابق البنية المطلوبة أو يتجاوز الحد المسموح." });
    return;
  }
  if (parsed.data.families.reduce((total, family) => total + family.members.length, 0) > 500) {
    res.status(400).json({ error: "الحد الأقصى هو 500 فرد في طلب الاستيراد." });
    return;
  }
  const actorId = res.locals["staff"].id as string;
  const families = parsed.data.families.map((family, index) => {
    const validated = CreateFamilyBody.safeParse(family);
    if (!validated.success) return { row: index + 1, error: true as const };
    return { row: index + 1, error: false as const, family: validated.data };
  });
  const invalidRow = families.find((entry) => entry.error);
  if (invalidRow?.error) {
    res.status(400).json({ error: `بيانات الأسرة رقم ${invalidRow.row} غير صالحة.` });
    return;
  }
  const validFamilies = families.flatMap((entry) => entry.error ? [] : [entry.family]);
  if (validFamilies.some((family) => family.campId !== parsed.data.campId)) {
    res.status(400).json({ error: "يجب أن تنتمي جميع الأسر إلى المخيم المختار." });
    return;
  }
  const memberIds = validFamilies.flatMap((family) => family.members
    .map((member) => member.nationalId ?? "")
    .filter(Boolean));
  const normalizedMemberIds = memberIds.map(normalizeNationalId).filter(Boolean);
  if (uniqueNormalizedNationalIds(memberIds).length !== normalizedMemberIds.length) {
    res.status(400).json({ error: "يوجد رقم هوية مكرر بين أفراد الملف." });
    return;
  }
  const inputDigest = canonicalFamilyImportDigest(parsed.data);

  let result: { statusCode: number; responseBody: unknown } | undefined;
  try {
    result = await withIdempotency<{ inputDigest?: string; importedCount?: number; error?: string }>(
      req,
      res,
      `importFamilies:${parsed.data.campId}`,
      async (tx) => {
    const lockedShelters = await lockShelterRows(tx, validFamilies.map((family) => family.shelterId));
    const shelterById = new Map<string, typeof shelterUnitsTable.$inferSelect>(
      lockedShelters.map((shelter: typeof shelterUnitsTable.$inferSelect) => [shelter.id, shelter] as [string, typeof shelterUnitsTable.$inferSelect]),
    );

    const demandByShelter = new Map<string, number>();
    for (const [index, family] of validFamilies.entries()) {
      const placementError = await validatePlacement(tx, family.campId, family.sectorId, family.shelterId, undefined, false);
      if (placementError) return { statusCode: 400, responseBody: { error: `الأسرة رقم ${index + 1}: ${placementError}` } };
      if (family.shelterId) {
        const shelter = shelterById.get(family.shelterId);
        if (!shelter || shelter.archivedAt) {
          return { statusCode: 400, responseBody: { error: `وحدة الإيواء للأسرة رقم ${index + 1} غير متاحة.` } };
        }
        demandByShelter.set(family.shelterId, (demandByShelter.get(family.shelterId) ?? 0) + 1);
      }
    }

    if (await hasExistingNationalIds(tx, memberIds)) {
      return { statusCode: 409, responseBody: { error: "يوجد رقم هوية مسجل مسبقًا في النظام." } };
    }

    for (const [shelterId, demand] of demandByShelter) {
      const shelter = shelterById.get(shelterId)!;
      const [assigned] = await tx
        .select({ value: count() })
        .from(familiesTable)
        .where(and(eq(familiesTable.shelterId, shelterId), isNull(familiesTable.archivedAt)));
      if (Number(assigned?.value ?? 0) + demand > shelter.capacity) {
        return { statusCode: 400, responseBody: { error: "عدد الأسر المحدد يتجاوز السعة المتاحة لوحدة إيواء." } };
      }
    }

    for (const family of validFamilies) {
      const [created] = await tx.insert(familiesTable).values({
        campId: family.campId,
        sectorId: family.sectorId,
        shelterId: family.shelterId ?? null,
        headName: family.headName,
        headPhone: family.headPhone ?? null,
        delegateId: null,
        criticalNotes: family.criticalNotes ?? null,
        createdById: actorId,
      }).returning();
      await tx.insert(familyMembersTable).values(family.members.map((member) => ({
        familyId: created.id,
        ...member,
        birthDate: member.birthDate ? member.birthDate.toISOString().slice(0, 10) : null,
        nationalId: normalizeNationalId(member.nationalId ?? "") || null,
        criticalCase: member.criticalCase ?? false,
        criticalNotes: member.criticalNotes ?? null,
      })));
      await audit(tx, actorId, "CREATE", "FAMILY", created.id, { status: created.status, version: created.version });
    }
      return { statusCode: 201, responseBody: { inputDigest, importedCount: validFamilies.length } };
      },
      { cacheErrorResponses: false },
    );
  } catch (error) {
    if (isNationalIdUniqueViolation(error)) {
      res.status(409).json({ error: "يوجد رقم هوية مسجل مسبقًا في النظام." });
      return;
    }
    req.log.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "Family import transaction failed");
    res.status(500).json({ error: "تعذر إكمال الاستيراد؛ لم تُحفظ بيانات جزئية." });
    return;
  }
  if (!result) return;
  if (result.statusCode === 201) {
    if (!isMatchingFamilyImportReplay(result.responseBody, inputDigest)) {
      res.status(409).json({ error: "مفتاح الملف مستخدم مع محتوى مختلف." });
      return;
    }
    res.status(201).json(ImportFamiliesResponse.parse({ importedCount: result.responseBody.importedCount }));
    return;
  }
  res.status(result.statusCode).json(result.responseBody);
});

router.post("/families", allowRoles(...familyManagers), async (req, res): Promise<void> => {
  const body = parseRequest(CreateFamilyBody, req.body, res);
  if (!body) return;
  const nationalIds = body.members.map((member) => member.nationalId ?? "").filter(Boolean);
  const normalizedIds = nationalIds.map(normalizeNationalId).filter(Boolean);
  if (uniqueNormalizedNationalIds(nationalIds).length !== normalizedIds.length) {
    res.status(409).json({ error: "يوجد رقم هوية مكرر بين أفراد الأسرة." });
    return;
  }
  const actorId = res.locals["staff"].id as string;
  const staff = res.locals["staff"] as { id: string; role: StaffRole };
  if (staff.role === "DELEGATE" && body.delegateId !== undefined && body.delegateId !== actorId) {
    res.status(403).json({ error: "Delegates may only create families assigned to themselves" });
    return;
  }
  let result: { statusCode: number; responseBody: unknown } | undefined;
  try {
    result = await withIdempotency<unknown>(req, res, "createFamily", async (tx) => {
    await lockShelterRows(tx, [body.shelterId]);
    const placementError = await validatePlacement(tx, body.campId, body.sectorId, body.shelterId);
    if (placementError) return { statusCode: 400, responseBody: { error: placementError } };
    if (await hasExistingNationalIds(tx, nationalIds)) {
      return { statusCode: 409, responseBody: { error: "يوجد رقم هوية مسجل مسبقًا في النظام." } };
    }
    const delegateId = staff.role === "DELEGATE" ? actorId : body.delegateId ?? null;
    const [created] = await tx.insert(familiesTable).values({
      campId: body.campId,
      sectorId: body.sectorId,
      shelterId: body.shelterId ?? null,
      headName: body.headName,
      headPhone: body.headPhone ?? null,
      delegateId,
      criticalNotes: body.criticalNotes ?? null,
      createdById: actorId,
    }).returning();
    await tx.insert(familyMembersTable).values(body.members.map((member) => ({
      familyId: created.id,
      ...member,
      birthDate: member.birthDate ? member.birthDate.toISOString().slice(0, 10) : null,
      nationalId: normalizeNationalId(member.nationalId ?? "") || null,
      criticalCase: member.criticalCase ?? false,
      criticalNotes: member.criticalNotes ?? null,
    })));
    await audit(tx, actorId, "CREATE", "FAMILY", created.id, { status: created.status, version: created.version });
    const detail = await getFamilyDetail(tx, created.id);
    return { statusCode: 201, responseBody: CreateFamilyResponse.parse(detail) };
    }, { cacheErrorResponses: false });
  } catch (error) {
    if (isNationalIdUniqueViolation(error)) {
      res.status(409).json({ error: "يوجد رقم هوية مسجل مسبقًا في النظام." });
      return;
    }
    req.log.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "Family creation failed");
    res.status(500).json({ error: "تعذر حفظ الأسرة." });
    return;
  }
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.get("/families/:familyId", allowRoles(...familyManagers), async (req, res): Promise<void> => {
  const params = parseRequest(GetFamilyParams, req.params, res);
  if (!params) return;
  const staff = res.locals["staff"] as { id: string; role: StaffRole };
  const detail = await getFamilyDetail(db, params.familyId);
  if (!detail || (staff.role === "DELEGATE" && detail.delegateId !== staff.id)) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  res.json(GetFamilyResponse.parse(detail));
});

router.patch("/families/:familyId", allowRoles(...familyManagers), async (req, res): Promise<void> => {
  const params = parseRequest(UpdateFamilyParams, req.params, res);
  const body = parseRequest(UpdateFamilyBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const staff = res.locals["staff"] as { id: string; role: StaffRole };
  const result = await withIdempotency<unknown>(req, res, `updateFamily:${params.familyId}`, async (tx) => {
    const [current] = await tx.select().from(familiesTable).where(eq(familiesTable.id, params.familyId)).limit(1);
    if (!current || (staff.role === "DELEGATE" && current.delegateId !== actorId)) {
      return { statusCode: 404, responseBody: { error: "Family not found" } };
    }
    if (staff.role === "DELEGATE" && (body.delegateId !== undefined || body.sectorId !== undefined || body.shelterId !== undefined)) {
      return { statusCode: 403, responseBody: { error: "Delegates cannot reassign family responsibility or shelter" } };
    }
    const sectorId = body.sectorId ?? current.sectorId;
    const targetShelterId = body.shelterId === undefined ? current.shelterId : body.shelterId;
    await lockShelterRows(tx, [current.shelterId, targetShelterId]);
    const placementError = await validatePlacement(tx, current.campId, sectorId, targetShelterId, current.id);
    if (placementError) return { statusCode: 400, responseBody: { error: placementError } };
    const changes = {
      ...(body.sectorId !== undefined ? { sectorId: body.sectorId } : {}),
      ...(body.shelterId !== undefined ? { shelterId: body.shelterId } : {}),
      ...(body.delegateId !== undefined ? { delegateId: body.delegateId } : {}),
      ...(body.headName !== undefined ? { headName: body.headName } : {}),
      ...(body.headPhone !== undefined ? { headPhone: body.headPhone } : {}),
      ...(body.criticalNotes !== undefined ? { criticalNotes: body.criticalNotes } : {}),
      version: sql`${familiesTable.version} + 1`,
      updatedAt: new Date(),
    };
    const [updated] = await tx.update(familiesTable).set(changes).where(and(
      eq(familiesTable.id, params.familyId),
      eq(familiesTable.version, body.expectedVersion),
      isNull(familiesTable.archivedAt),
    )).returning();
    if (!updated) {
      const [latest] = await tx.select().from(familiesTable).where(eq(familiesTable.id, params.familyId)).limit(1);
      return latest ? conflict("Family", latest) : { statusCode: 404, responseBody: { error: "Family not found" } };
    }
    if (body.delegateId !== undefined || body.shelterId !== undefined || body.sectorId !== undefined) {
      await tx.insert(familyAssignmentHistoryTable).values({
        familyId: updated.id,
        fromDelegateId: current.delegateId,
        toDelegateId: updated.delegateId,
        fromShelterId: current.shelterId,
        toShelterId: updated.shelterId,
        changedById: actorId,
        reason: "Operational reassignment",
      });
    }
    await audit(tx, actorId, "UPDATE", "FAMILY", updated.id, {
      expectedVersion: body.expectedVersion,
      changedFields: Object.keys(body).filter((field) => field !== "expectedVersion"),
    });
    return { statusCode: 200, responseBody: UpdateFamilyResponse.parse(await getFamilyDetail(tx, updated.id)) };
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/families/:familyId/approve", allowRoles(...familyApprovers), async (req, res): Promise<void> => {
  const params = parseRequest(ApproveFamilyParams, req.params, res);
  const body = parseRequest(ApproveFamilyBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency<unknown>(req, res, `approveFamily:${params.familyId}`, async (tx) => {
    const [updated] = await tx.update(familiesTable).set({
      status: "ACTIVE",
      approvedById: actorId,
      approvedAt: new Date(),
      updatedAt: new Date(),
      version: sql`${familiesTable.version} + 1`,
    }).where(and(eq(familiesTable.id, params.familyId), eq(familiesTable.status, "PENDING_APPROVAL"))).returning();
    if (!updated) return { statusCode: 404, responseBody: { error: "Pending family not found" } };
    await audit(tx, actorId, "APPROVE", "FAMILY", updated.id, { note: body.note ?? null });
    return { statusCode: 200, responseBody: ApproveFamilyResponse.parse(await getFamilyDetail(tx, updated.id)) };
  });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/families/:familyId/archive", allowRoles(...familyApprovers), async (req, res): Promise<void> => {
  const params = parseRequest(ArchiveFamilyParams, req.params, res);
  const body = parseRequest(ArchiveFamilyBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency<unknown>(req, res, `archiveFamily:${params.familyId}`, async (tx) => {
    const [current] = await tx.select({ shelterId: familiesTable.shelterId }).from(familiesTable)
      .where(eq(familiesTable.id, params.familyId)).limit(1);
    await lockShelterRows(tx, [current?.shelterId]);
    const [updated] = await tx.update(familiesTable).set({
      status: "ARCHIVED",
      archivedAt: new Date(),
      updatedAt: new Date(),
      version: sql`${familiesTable.version} + 1`,
    }).where(and(eq(familiesTable.id, params.familyId), eq(familiesTable.version, body.expectedVersion), isNull(familiesTable.archivedAt))).returning();
    if (!updated) {
      const [latest] = await tx.select({ version: familiesTable.version }).from(familiesTable)
        .where(eq(familiesTable.id, params.familyId)).limit(1);
      return latest && latest.version !== body.expectedVersion
        ? conflict("Family", latest)
        : { statusCode: 404, responseBody: { error: "Family not found" } };
    }
    await audit(tx, actorId, "ARCHIVE", "FAMILY", updated.id, { expectedVersion: body.expectedVersion });
    return { statusCode: 200, responseBody: ArchiveFamilyResponse.parse(await getFamilyDetail(tx, updated.id)) };
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.get("/needs", allowRoles(...familyManagers, ...securityLeads), async (req, res): Promise<void> => {
  const staff = res.locals["staff"] as { id: string; role: StaffRole };
  const familyIds = staff.role === "DELEGATE"
    ? db.select({ id: familiesTable.id }).from(familiesTable).where(eq(familiesTable.delegateId, staff.id))
    : undefined;
  const rows = await db.select().from(familyNeedsTable).where(and(
    isNull(familyNeedsTable.archivedAt),
    familyIds ? inArray(familyNeedsTable.familyId, familyIds) : undefined,
  )).orderBy(desc(familyNeedsTable.createdAt));
  res.json(ListNeedsResponse.parse(rows));
});

router.post("/needs", allowRoles(...familyManagers), async (req, res): Promise<void> => {
  const body = parseRequest(CreateNeedBody, req.body, res);
  if (!body) return;
  const actorId = res.locals["staff"].id as string;
  const staff = res.locals["staff"] as { id: string; role: StaffRole };
  const result = await withIdempotency<unknown>(req, res, "createNeed", async (tx) => {
    const [family] = await tx.select().from(familiesTable).where(eq(familiesTable.id, body.familyId)).limit(1);
    if (!family || (staff.role === "DELEGATE" && family.delegateId !== actorId)) {
      return { statusCode: 404, responseBody: { error: "Family not found" } };
    }
    const [created] = await tx.insert(familyNeedsTable).values({
      familyId: body.familyId,
      category: body.category,
      title: body.title,
      description: body.description ?? null,
      priority: body.priority,
      createdById: actorId,
    }).returning();
    await tx.insert(needStatusHistoryTable).values({
      needId: created.id,
      fromStatus: null,
      toStatus: "REQUIRED",
      changedById: actorId,
    });
    await audit(tx, actorId, "CREATE", "FAMILY_NEED", created.id, { status: created.status });
    return { statusCode: 201, responseBody: CreateNeedResponse.parse(created) };
  });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/needs/:needId", allowRoles(...familyManagers, ...securityLeads), async (req, res): Promise<void> => {
  const params = parseRequest(UpdateNeedParams, req.params, res);
  const body = parseRequest(UpdateNeedBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const staff = res.locals["staff"] as { id: string; role: StaffRole };
  const result = await withIdempotency<unknown>(req, res, `updateNeed:${params.needId}`, async (tx) => {
    const [current] = await tx.select({
      need: familyNeedsTable,
      family: familiesTable,
    }).from(familyNeedsTable).innerJoin(familiesTable, eq(familyNeedsTable.familyId, familiesTable.id))
      .where(eq(familyNeedsTable.id, params.needId)).limit(1);
    if (!current || (staff.role === "DELEGATE" && current.family.delegateId !== actorId)) {
      return { statusCode: 404, responseBody: { error: "Need not found", code: "NEED_NOT_FOUND" } };
    }
    const allowedTransitions: Record<string, string[]> = {
      REQUIRED: ["APPROVED", "CANCELLED"],
      APPROVED: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["FULFILLED", "CANCELLED"],
      FULFILLED: [],
      CANCELLED: [],
    };
    if (body.status && body.status !== current.need.status && !allowedTransitions[current.need.status]?.includes(body.status)) {
      return { statusCode: 400, responseBody: { error: "Invalid need status transition", code: "NEED_INVALID_TRANSITION" } };
    }
    const [updated] = await tx.update(familyNeedsTable).set({
      ...(body.status !== undefined ? { status: body.status, ...(body.status === "FULFILLED" ? { fulfilledAt: new Date() } : {}) } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.assignedToId !== undefined ? { assignedToId: body.assignedToId } : {}),
      version: sql`${familyNeedsTable.version} + 1`,
      updatedAt: new Date(),
    }).where(and(eq(familyNeedsTable.id, params.needId), eq(familyNeedsTable.version, body.expectedVersion), isNull(familyNeedsTable.archivedAt))).returning();
    if (!updated) {
      const [latest] = await tx.select().from(familyNeedsTable).where(eq(familyNeedsTable.id, params.needId)).limit(1);
      return latest ? conflict("Need", latest) : { statusCode: 404, responseBody: { error: "Need not found", code: "NEED_NOT_FOUND" } };
    }
    if (body.status && body.status !== current.need.status) {
      await tx.insert(needStatusHistoryTable).values({
        needId: updated.id,
        fromStatus: current.need.status,
        toStatus: body.status,
        changedById: actorId,
        note: body.note ?? null,
      });
    }
    await audit(tx, actorId, body.status ? "STATUS" : "UPDATE", "FAMILY_NEED", updated.id, {
      expectedVersion: body.expectedVersion,
      changedFields: Object.keys(body),
    });
    return { statusCode: 200, responseBody: UpdateNeedResponse.parse(updated) };
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/needs/:needId/archive", allowRoles(...familyApprovers), async (req, res): Promise<void> => {
  const params = parseRequest(ArchiveNeedParams, req.params, res);
  const body = parseRequest(ArchiveNeedBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const result = await withIdempotency<unknown>(req, res, `archiveNeed:${params.needId}`, async (tx) => {
    const [updated] = await tx.update(familyNeedsTable).set({
      archivedAt: new Date(), version: sql`${familyNeedsTable.version} + 1`, updatedAt: new Date(),
    }).where(and(eq(familyNeedsTable.id, params.needId), eq(familyNeedsTable.version, body.expectedVersion), isNull(familyNeedsTable.archivedAt))).returning();
    if (!updated) return { statusCode: 404, responseBody: { error: "Need not found" } };
    await audit(tx, actorId, "ARCHIVE", "FAMILY_NEED", updated.id, { expectedVersion: body.expectedVersion });
    return { statusCode: 200, responseBody: ArchiveNeedResponse.parse(updated) };
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.get("/aids/:aidId/distributions", allowRoles(...familyManagers, ...securityLeads), async (req, res): Promise<void> => {
  const params = parseRequest(ListAidDistributionsParams, req.params, res);
  if (!params) return;
  const staff = res.locals["staff"] as { id: string; role: StaffRole };
  const [aid] = await db.select({ id: aids.id }).from(aids).where(and(eq(aids.id, params.aidId), isNull(aids.archivedAt))).limit(1);
  if (!aid) {
    res.status(404).json({ error: "Aid not found" });
    return;
  }
  const distributions = await db
    .select({ distribution: aidDistributionsTable })
    .from(aidDistributionsTable)
    .innerJoin(familiesTable, eq(aidDistributionsTable.familyId, familiesTable.id))
    .where(and(
      eq(aidDistributionsTable.aidId, params.aidId),
      isNull(familiesTable.archivedAt),
      staff.role === "DELEGATE" ? eq(familiesTable.delegateId, staff.id) : undefined,
    ))
    .orderBy(desc(aidDistributionsTable.createdAt));
  res.json(ListAidDistributionsResponse.parse(distributions.map(({ distribution }) => distribution)));
});

router.post("/aids/:aidId/distributions", allowRoles(...familyManagers), async (req, res): Promise<void> => {
  const params = parseRequest(CreateAidDistributionParams, req.params, res);
  const body = parseRequest(CreateAidDistributionBody, req.body, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const staff = res.locals["staff"] as { id: string; role: StaffRole };
  const result = await withIdempotency<unknown>(req, res, `createAidDistribution:${params.aidId}`, async (tx) => {
    const [aid] = await tx
      .select()
      .from(aids)
      .where(and(eq(aids.id, params.aidId), isNull(aids.archivedAt)))
      .limit(1);
    if (!aid) return { statusCode: 404, responseBody: { error: "Aid not found", code: "AID_NOT_FOUND" } };
    const [need] = await tx
      .select({ need: familyNeedsTable, family: familiesTable })
      .from(familyNeedsTable)
      .innerJoin(familiesTable, eq(familyNeedsTable.familyId, familiesTable.id))
      .where(and(
        eq(familyNeedsTable.id, body.needId),
        eq(familyNeedsTable.familyId, body.familyId),
        eq(familiesTable.id, body.familyId),
        eq(familiesTable.status, "ACTIVE"),
        isNull(familiesTable.archivedAt),
        isNull(familyNeedsTable.archivedAt),
      ))
      .limit(1);
    if (!need) return { statusCode: 404, responseBody: { error: "Active family or need not found", code: "NEED_NOT_FOUND" } };
    if (need.need.status !== "APPROVED") {
      return { statusCode: 400, responseBody: { error: "Only approved needs can receive an aid distribution", code: "NEED_NOT_APPROVED" } };
    }
    if (staff.role === "DELEGATE" && need.family.delegateId !== actorId) {
      return { statusCode: 404, responseBody: { error: "Active family or need not found", code: "NEED_NOT_FOUND" } };
    }

    const [existing] = await tx
      .select()
      .from(aidDistributionsTable)
      .where(and(
        eq(aidDistributionsTable.aidId, params.aidId),
        eq(aidDistributionsTable.familyId, body.familyId),
      ))
      .limit(1);
    if (existing) {
      await audit(tx, actorId, "DUPLICATE_ATTEMPT", "AID_DISTRIBUTION", existing.id, {
        aidId: params.aidId,
        familyId: body.familyId,
        needId: body.needId,
      });
      return {
        statusCode: 409,
        responseBody: { error: "This family already has a distribution in this aid cycle", code: "AID_DISTRIBUTION_DUPLICATE", distributionId: existing.id },
      };
    }

    const [assigned] = await tx
      .select({ quantity: sum(aidDistributionsTable.quantity) })
      .from(aidDistributionsTable)
      .where(and(
        eq(aidDistributionsTable.aidId, params.aidId),
        inArray(aidDistributionsTable.status, ["ASSIGNED", "RECEIVED"]),
      ));
    const assignedQuantity = Number(assigned?.quantity ?? 0);
    if (assignedQuantity + body.quantity > aid.quantity) {
      return { statusCode: 400, responseBody: { error: "Aid quantity is insufficient for this distribution", code: "AID_STOCK_INSUFFICIENT" } };
    }

    const [created] = await tx.insert(aidDistributionsTable).values({
      aidId: params.aidId,
      needId: body.needId,
      familyId: body.familyId,
      quantity: body.quantity,
      unit: aid.unit,
      executedById: actorId,
    }).onConflictDoNothing({
      target: [aidDistributionsTable.aidId, aidDistributionsTable.familyId],
    }).returning();
    if (!created) {
      const [concurrent] = await tx.select({ id: aidDistributionsTable.id })
        .from(aidDistributionsTable)
        .where(and(eq(aidDistributionsTable.aidId, params.aidId), eq(aidDistributionsTable.familyId, body.familyId)))
        .limit(1);
      if (concurrent) {
        await audit(tx, actorId, "DUPLICATE_ATTEMPT", "AID_DISTRIBUTION", concurrent.id, {
          aidId: params.aidId,
          familyId: body.familyId,
          needId: body.needId,
          concurrent: true,
        });
      }
      return { statusCode: 409, responseBody: { error: "This family already has a distribution in this aid cycle", code: "AID_DISTRIBUTION_DUPLICATE" } };
    }
    await audit(tx, actorId, "ASSIGN", "AID_DISTRIBUTION", created.id, {
      aidId: params.aidId,
      needId: body.needId,
      familyId: body.familyId,
      quantity: body.quantity,
    });
    return { statusCode: 201, responseBody: CreateAidDistributionResponse.parse(created) };
  });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.post("/distributions/:distributionId/receive", allowRoles(...familyManagers, ...securityLeads), async (req, res): Promise<void> => {
  const params = parseRequest(ReceiveAidDistributionParams, req.params, res);
  const body = parseRequest(ReceiveAidDistributionBody, req.body ?? {}, res);
  if (!params || !body) return;
  const actorId = res.locals["staff"].id as string;
  const staff = res.locals["staff"] as { id: string; role: StaffRole };
  const result = await withIdempotency<unknown>(req, res, `receiveAidDistribution:${params.distributionId}`, async (tx) => {
    const [current] = await tx
      .select({ distribution: aidDistributionsTable, family: familiesTable, need: familyNeedsTable })
      .from(aidDistributionsTable)
      .innerJoin(familiesTable, eq(aidDistributionsTable.familyId, familiesTable.id))
      .innerJoin(familyNeedsTable, eq(aidDistributionsTable.needId, familyNeedsTable.id))
      .where(eq(aidDistributionsTable.id, params.distributionId))
      .limit(1);
    if (!current || current.family.status !== "ACTIVE" || current.family.archivedAt) {
      return { statusCode: 404, responseBody: { error: "Distribution not found", code: "AID_DISTRIBUTION_NOT_FOUND" } };
    }
    if (staff.role === "DELEGATE" && current.family.delegateId !== actorId) {
      return { statusCode: 404, responseBody: { error: "Distribution not found", code: "AID_DISTRIBUTION_NOT_FOUND" } };
    }
    if (current.distribution.status !== "ASSIGNED") {
      await audit(tx, actorId, "DUPLICATE_RECEIVE_ATTEMPT", "AID_DISTRIBUTION", current.distribution.id, {
        currentStatus: current.distribution.status,
      });
      return { statusCode: 409, responseBody: { error: "This distribution has already been processed", code: "AID_DISTRIBUTION_ALREADY_RECEIVED", status: current.distribution.status } };
    }

    const [updated] = await tx.update(aidDistributionsTable).set({
      status: "RECEIVED",
      deliveredById: actorId,
      deliveredAt: body.deliveredAt ?? new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(aidDistributionsTable.id, params.distributionId),
      eq(aidDistributionsTable.status, "ASSIGNED"),
    )).returning();
    if (!updated) {
      const [processed] = await tx
        .select({ status: aidDistributionsTable.status })
        .from(aidDistributionsTable)
        .where(eq(aidDistributionsTable.id, params.distributionId))
        .limit(1);
      await audit(tx, actorId, "DUPLICATE_RECEIVE_ATTEMPT", "AID_DISTRIBUTION", params.distributionId, {
        currentStatus: processed?.status ?? "UNKNOWN",
      });
      return {
        statusCode: 409,
        responseBody: {
          error: "This distribution has already been processed",
          code: "AID_DISTRIBUTION_ALREADY_RECEIVED",
          status: processed?.status,
        },
      };
    }
    if (current.need.status !== "FULFILLED" && current.need.status !== "CANCELLED") {
      const [fulfilledNeed] = await tx.update(familyNeedsTable).set({
        status: "FULFILLED",
        fulfilledAt: updated.deliveredAt,
        version: sql`${familyNeedsTable.version} + 1`,
        updatedAt: new Date(),
      }).where(and(
        eq(familyNeedsTable.id, current.need.id),
        isNull(familyNeedsTable.archivedAt),
      )).returning();
      if (fulfilledNeed) {
        await tx.insert(needStatusHistoryTable).values({
          needId: fulfilledNeed.id,
          fromStatus: current.need.status,
          toStatus: "FULFILLED",
          changedById: actorId,
          note: "Aid distribution received",
        });
      }
    }
    await audit(tx, actorId, "RECEIVE", "AID_DISTRIBUTION", updated.id, {
      aidId: updated.aidId,
      familyId: updated.familyId,
      needId: updated.needId,
      deliveredAt: updated.deliveredAt,
    });
    return { statusCode: 200, responseBody: ReceiveAidDistributionResponse.parse(updated) };
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.patch("/distributions/:distributionId/cancel", allowRoles(...familyManagers, ...securityLeads), async (req, res): Promise<void> => {
  const params = parseRequest(CancelAidDistributionParams, req.params, res);
  if (!params) return;
  const actorId = res.locals["staff"].id as string;
  const staff = res.locals["staff"] as { id: string; role: StaffRole };
  const result = await withIdempotency<unknown>(req, res, `cancelAidDistribution:${params.distributionId}`, async (tx) => {
    const [current] = await tx
      .select({ distribution: aidDistributionsTable, family: familiesTable })
      .from(aidDistributionsTable)
      .innerJoin(familiesTable, eq(aidDistributionsTable.familyId, familiesTable.id))
      .where(eq(aidDistributionsTable.id, params.distributionId))
      .limit(1);
    if (!current || current.family.status !== "ACTIVE" || current.family.archivedAt) {
      return { statusCode: 404, responseBody: { error: "Distribution not found", code: "AID_DISTRIBUTION_NOT_FOUND" } };
    }
    if (staff.role === "DELEGATE" && current.family.delegateId !== actorId) {
      return { statusCode: 404, responseBody: { error: "Distribution not found", code: "AID_DISTRIBUTION_NOT_FOUND" } };
    }
    if (current.distribution.status === "CANCELLED") {
      await audit(tx, actorId, "DUPLICATE_CANCEL_ATTEMPT", "AID_DISTRIBUTION", current.distribution.id, {
        currentStatus: current.distribution.status,
      });
      return {
        statusCode: 409,
        responseBody: {
          error: "This distribution has already been cancelled",
          code: "AID_DISTRIBUTION_ALREADY_CANCELLED",
          status: current.distribution.status,
        },
      };
    }

    const [updated] = await tx.update(aidDistributionsTable).set({
      status: "CANCELLED",
      deliveredById: null,
      deliveredAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(aidDistributionsTable.id, params.distributionId),
      inArray(aidDistributionsTable.status, ["ASSIGNED", "RECEIVED"]),
    )).returning();
    if (!updated) {
      const [processed] = await tx
        .select({ status: aidDistributionsTable.status })
        .from(aidDistributionsTable)
        .where(eq(aidDistributionsTable.id, params.distributionId))
        .limit(1);
      await audit(tx, actorId, "DUPLICATE_CANCEL_ATTEMPT", "AID_DISTRIBUTION", params.distributionId, {
        currentStatus: processed?.status ?? "UNKNOWN",
      });
      return {
        statusCode: 409,
        responseBody: {
          error: "This distribution has already been cancelled",
          code: "AID_DISTRIBUTION_ALREADY_CANCELLED",
          status: processed?.status,
        },
      };
    }
    await audit(tx, actorId, "CANCEL", "AID_DISTRIBUTION", updated.id, {
      previousStatus: current.distribution.status,
      clearedDeliveryConfirmation: Boolean(current.distribution.deliveredAt || current.distribution.deliveredById),
    });
    return { statusCode: 200, responseBody: CancelAidDistributionResponse.parse(updated) };
  }, { required: false });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.get("/security-members", allowRoles(...securityLeads), async (_req, res): Promise<void> => {
  const rows = await db.select({
    id: staffUsers.id,
    name: staffUsers.name,
    email: staffUsers.email,
    role: staffUsers.role,
    active: staffUsers.active,
  }).from(staffUsers).where(inArray(staffUsers.role, ["SECURITY_OFFICER", "SECURITY_MEMBER"])).orderBy(staffUsers.name);
  res.json(ListSecurityMembersResponse.parse(rows));
});

export default router;