import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  CreateAidBody,
  CreatePersonBody,
  UpdateComplaintStatusBody,
  UpdateComplaintStatusParams,
  UpdateTaskStatusBody,
  UpdateTaskStatusParams,
} from "@workspace/api-zod";
import { aids, complaints, db, people, tasks, type StaffRole } from "@workspace/db";
import { allowRoles, requireAuth } from "../middlewares/auth";
import { withIdempotency } from "../lib/idempotency";
import { parseRequest } from "../lib/validation";

const router: IRouter = Router();
const managers: StaffRole[] = ["ADMIN", "MANAGER"];

router.use(requireAuth);

router.get("/aids", async (_req, res) => {
  res.json(await db.select().from(aids).orderBy(desc(aids.createdAt)));
});

router.post("/aids", allowRoles(...managers, "DELEGATE"), async (req, res) => {
  const body = parseRequest(CreateAidBody, req.body, res);
  if (!body) return;
  const result = await withIdempotency(req, res, "createAid", async (tx) => {
    const [created] = await tx
      .insert(aids)
      .values({
        ...body,
        distributionDate: body.distributionDate.toISOString().slice(0, 10),
        createdById: res.locals["staff"].id,
      })
      .returning();
    return { statusCode: 201, responseBody: created };
  });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.get("/people", async (_req, res) => {
  res.json(await db.select().from(people).orderBy(desc(people.createdAt)));
});

router.post("/people", allowRoles(...managers, "DELEGATE"), async (req, res) => {
  const body = parseRequest(CreatePersonBody, req.body, res);
  if (!body) return;
  const result = await withIdempotency(req, res, "createPerson", async (tx) => {
    const [created] = await tx
      .insert(people)
      .values({
        ...body,
        birthDate: body.birthDate.toISOString().slice(0, 10),
        createdById: res.locals["staff"].id,
      })
      .returning();
    return { statusCode: 201, responseBody: created };
  });
  if (result) res.status(result.statusCode).json(result.responseBody);
});

router.get("/complaints", async (_req, res) => {
  res.json(await db.select().from(complaints).orderBy(desc(complaints.createdAt)));
});

router.patch(
  "/complaints/:complaintId",
  allowRoles(...managers, "DELEGATE"),
  async (req, res) => {
    const params = parseRequest(UpdateComplaintStatusParams, req.params, res);
    const body = parseRequest(UpdateComplaintStatusBody, req.body, res);
    if (!params || !body) return;
    const result = await withIdempotency(
      req,
      res,
      `updateComplaintStatus:${params.complaintId}`,
      async (tx) => {
        const [updated] = await tx
          .update(complaints)
          .set({
            status: body.status,
            version: sql`${complaints.version} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(complaints.id, params.complaintId),
              eq(complaints.version, body.expectedVersion),
            ),
          )
          .returning();
        if (updated) return { statusCode: 200, responseBody: updated };

        const [current] = await tx
          .select()
          .from(complaints)
          .where(eq(complaints.id, params.complaintId))
          .limit(1);
        if (!current) return { statusCode: 404, responseBody: { error: "Complaint not found" } };
        return {
          statusCode: 409,
          responseBody: {
            error: "Complaint has been updated; refresh and retry with the current version",
            currentVersion: current.version,
            currentRecord: current,
          },
        };
      },
      { required: false },
    );
    if (result) res.status(result.statusCode).json(result.responseBody);
  },
);

router.get("/tasks", async (_req, res) => {
  res.json(await db.select().from(tasks).orderBy(desc(tasks.createdAt)));
});

router.patch(
  "/tasks/:taskId",
  allowRoles(...managers, "SECURITY_OFFICER"),
  async (req, res) => {
    const params = parseRequest(UpdateTaskStatusParams, req.params, res);
    const body = parseRequest(UpdateTaskStatusBody, req.body, res);
    if (!params || !body) return;
    const result = await withIdempotency(
      req,
      res,
      `updateTaskStatus:${params.taskId}`,
      async (tx) => {
        const [updated] = await tx
          .update(tasks)
          .set({
            status: body.status,
            version: sql`${tasks.version} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(eq(tasks.id, params.taskId), eq(tasks.version, body.expectedVersion)),
          )
          .returning();
        if (updated) return { statusCode: 200, responseBody: updated };

        const [current] = await tx
          .select()
          .from(tasks)
          .where(eq(tasks.id, params.taskId))
          .limit(1);
        if (!current) return { statusCode: 404, responseBody: { error: "Task not found" } };
        return {
          statusCode: 409,
          responseBody: {
            error: "Task has been updated; refresh and retry with the current version",
            currentVersion: current.version,
            currentRecord: current,
          },
        };
      },
      { required: false },
    );
    if (result) res.status(result.statusCode).json(result.responseBody);
  },
);

export default router;