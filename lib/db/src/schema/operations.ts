import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffUsers, usersTable } from "./auth";
import { displacedPersonsTable } from "./people";
import { familyNeedsTable, familiesTable } from "./camp-operations";
export const aidStatusEnum = pgEnum("aid_status", ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]);
export const allocationStatusEnum = pgEnum("allocation_status", [
  "ASSIGNED",
  "RECEIVED",
  "CANCELLED",
]);
export const complaintStatusEnum = pgEnum("complaint_status", [
  "PENDING",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
]);
export const taskStatusEnum = pgEnum("security_task_status", [
  "UPCOMING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const aidsTable = pgTable(
  "aids",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 240 }).notNull(),
    type: varchar("type", { length: 100 }).notNull(),
    description: text("description"),
    status: aidStatusEnum("status").notNull().default("ACTIVE"),
    targetFamilies: integer("target_families").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdBy: integer("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("aids_status_idx").on(table.status), index("aids_type_idx").on(table.type)],
);

export const aidRecipientsTable = pgTable(
  "aid_recipients",
  {
    aidId: integer("aid_id")
      .notNull()
      .references(() => aidsTable.id, { onDelete: "cascade" }),
    displacedPersonId: integer("displaced_person_id")
      .notNull()
      .references(() => displacedPersonsTable.id, { onDelete: "cascade" }),
    assignedBy: integer("assigned_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    portion: integer("portion").notNull().default(1),
    status: allocationStatusEnum("status").notNull().default("ASSIGNED"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.aidId, table.displacedPersonId] }),
    index("aid_recipients_status_idx").on(table.status),
  ],
);

export const complaintsTable = pgTable(
  "complaints",
  {
    id: serial("id").primaryKey(),
    authorUserId: integer("author_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    recipientUserId: integer("recipient_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    type: varchar("type", { length: 80 }).notNull(),
    subject: varchar("subject", { length: 240 }).notNull(),
    body: text("body").notNull(),
    status: complaintStatusEnum("status").notNull().default("PENDING"),
    reply: text("reply"),
    repliedBy: integer("replied_by").references(() => usersTable.id, { onDelete: "set null" }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("complaints_author_idx").on(table.authorUserId),
    index("complaints_status_idx").on(table.status),
  ],
);

export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    recipientUserId: integer("recipient_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    actorUserId: integer("actor_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    type: varchar("type", { length: 80 }).notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    body: text("body").notNull(),
    entityType: varchar("entity_type", { length: 80 }),
    entityId: integer("entity_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_recipient_idx").on(table.recipientUserId),
    index("notifications_unread_idx").on(table.recipientUserId, table.readAt),
  ],
);

export const securityTasksTable = pgTable(
  "security_tasks",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 240 }).notNull(),
    body: text("body").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    status: taskStatusEnum("status").notNull().default("UPCOMING"),
    createdBy: integer("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("security_tasks_status_idx").on(table.status)],
);

export const securityTaskAssigneesTable = pgTable(
  "security_task_assignees",
  {
    taskId: integer("task_id")
      .notNull()
      .references(() => securityTasksTable.id, { onDelete: "cascade" }),
    securityUserId: integer("security_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.securityUserId] }),
    index("task_assignees_security_idx").on(table.securityUserId),
  ],
);

export const auditEventsTable = pgTable(
  "audit_events",
  {
    id: serial("id").primaryKey(),
    actorUserId: integer("actor_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: integer("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_entity_idx").on(table.entityType, table.entityId)],
);

export const insertAidSchema = createInsertSchema(aidsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertComplaintSchema = createInsertSchema(complaintsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertSecurityTaskSchema = createInsertSchema(securityTasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AidRecord = typeof aidsTable.$inferSelect;
export type AidDistributionRecord = typeof aidDistributionsTable.$inferSelect;
export type ComplaintRecord = typeof complaintsTable.$inferSelect;
export type SecurityTaskRecord = typeof securityTasksTable.$inferSelect;
export type InsertAid = z.infer<typeof insertAidSchema>;
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type InsertSecurityTask = z.infer<typeof insertSecurityTaskSchema>;

export const aidType = pgEnum("sync_aid_type", [
  "FOOD",
  "WATER",
  "MEDICAL",
  "SHELTER",
  "HYGIENE",
  "OTHER",
]);

export const gender = pgEnum("sync_gender", ["MALE", "FEMALE"]);

export const complaintStatus = pgEnum("sync_complaint_status", [
  "OPEN",
  "IN_REVIEW",
  "RESOLVED",
  "REJECTED",
]);

export const taskStatus = pgEnum("sync_task_status", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const taskPriority = pgEnum("sync_task_priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

export const aids = pgTable("sync_aids", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  type: aidType("type").notNull(),
  quantity: integer("quantity").notNull(),
  unit: text("unit").notNull(),
  location: text("location").notNull(),
  distributionDate: date("distribution_date").notNull(),
  notes: text("notes"),
  createdById: uuid("created_by_id").notNull().references(() => staffUsers.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
});

export const aidDistributionStatusEnum = pgEnum("aid_distribution_status", [
  "ASSIGNED",
  "RECEIVED",
  "CANCELLED",
]);

export const aidDistributionsTable = pgTable(
  "aid_distributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aidId: uuid("aid_id").notNull().references(() => aids.id, { onDelete: "cascade" }),
    needId: uuid("need_id").notNull().references(() => familyNeedsTable.id, { onDelete: "restrict" }),
    familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unit: text("unit").notNull(),
    status: aidDistributionStatusEnum("status").notNull().default("ASSIGNED"),
    executedById: uuid("executed_by_id").notNull().references(() => staffUsers.id, { onDelete: "restrict" }),
    deliveredById: uuid("delivered_by_id").references(() => staffUsers.id, { onDelete: "set null" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("aid_distributions_cycle_family_unique").on(table.aidId, table.familyId),
    index("aid_distributions_aid_idx").on(table.aidId),
    index("aid_distributions_family_idx").on(table.familyId),
    index("aid_distributions_need_idx").on(table.needId),
    index("aid_distributions_status_idx").on(table.status),
  ],
);

export const tasks = pgTable("sync_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  priority: taskPriority("priority").notNull().default("MEDIUM"),
  status: taskStatus("status").notNull().default("PENDING"),
  result: text("result"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  completedById: uuid("completed_by_id").references(() => staffUsers.id),
  approvedById: uuid("approved_by_id").references(() => staffUsers.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  assignedToId: uuid("assigned_to_id").references(() => staffUsers.id),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdById: uuid("created_by_id").notNull().references(() => staffUsers.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const complaints = pgTable("sync_complaints", {
  id: uuid("id").primaryKey().defaultRandom(),
  complainantName: text("complainant_name").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: complaintStatus("status").notNull().default("OPEN"),
  version: integer("version").notNull().default(1),
  location: text("location"),
  reply: text("reply"),
  repliedById: uuid("replied_by_id").references(() => staffUsers.id),
  repliedAt: timestamp("replied_at", { withTimezone: true }),
  createdById: uuid("created_by_id").notNull().references(() => staffUsers.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const people = pgTable("sync_people", {
  id: uuid("id").primaryKey().defaultRandom(),
  nationalId: text("national_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  gender: gender("gender").notNull(),
  birthDate: date("birth_date").notNull(),
  phone: text("phone"),
  tentNumber: text("tent_number").notNull(),
  familySize: integer("family_size").notNull(),
  notes: text("notes"),
  createdById: uuid("created_by_id").notNull().references(() => staffUsers.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
});

export const syncAuditEvents = pgTable(
  "sync_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorStaffId: uuid("actor_staff_id")
      .notNull()
      .references(() => staffUsers.id),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sync_audit_entity_idx").on(table.entityType, table.entityId)],
);

