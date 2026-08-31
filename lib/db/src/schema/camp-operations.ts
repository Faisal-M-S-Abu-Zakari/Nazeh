import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffUsers, usersTable } from "./auth";

export const familyStatusEnum = pgEnum("family_status", [
  "PENDING_APPROVAL",
  "ACTIVE",
  "ARCHIVED",
]);
export const shelterStatusEnum = pgEnum("shelter_status", [
  "AVAILABLE",
  "OCCUPIED",
  "MAINTENANCE",
]);
export const memberGenderEnum = pgEnum("family_member_gender", ["MALE", "FEMALE", "OTHER"]);
export const needCategoryEnum = pgEnum("need_category", [
  "FOOD",
  "WATER",
  "MEDICAL",
  "SHELTER",
  "HYGIENE",
  "OTHER",
]);
export const needStatusEnum = pgEnum("need_status", [
  "REQUIRED",
  "IN_PROGRESS",
  "FULFILLED",
  "CANCELLED",
]);
export const needPriorityEnum = pgEnum("need_priority", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const campsTable = pgTable("camps", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 160 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campSectorsTable = pgTable(
  "camp_sectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campId: uuid("camp_id").notNull().references(() => campsTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("camp_sectors_camp_idx").on(table.campId)],
);

export const shelterUnitsTable = pgTable(
  "shelter_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectorId: uuid("sector_id").notNull().references(() => campSectorsTable.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 80 }).notNull(),
    capacity: integer("capacity").notNull().default(1),
    status: shelterStatusEnum("status").notNull().default("AVAILABLE"),
    version: integer("version").notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("shelter_units_sector_code_unique").on(table.sectorId, table.code),
    index("shelter_units_status_idx").on(table.status),
  ],
);

export const familiesTable = pgTable(
  "families",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campId: uuid("camp_id").notNull().references(() => campsTable.id, { onDelete: "restrict" }),
    sectorId: uuid("sector_id").notNull().references(() => campSectorsTable.id, { onDelete: "restrict" }),
    shelterId: uuid("shelter_id").references(() => shelterUnitsTable.id, { onDelete: "set null" }),
    headName: varchar("head_name", { length: 200 }).notNull(),
    headPhone: varchar("head_phone", { length: 40 }),
    headLegacyUserId: integer("head_legacy_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    delegateId: uuid("delegate_id").references(() => staffUsers.id, { onDelete: "set null" }),
    status: familyStatusEnum("status").notNull().default("PENDING_APPROVAL"),
    criticalNotes: text("critical_notes"),
    createdById: uuid("created_by_id").references(() => staffUsers.id, { onDelete: "restrict" }),
    createdByLegacyUserId: integer("created_by_legacy_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    approvedById: uuid("approved_by_id").references(() => staffUsers.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("families_camp_idx").on(table.campId),
    index("families_delegate_idx").on(table.delegateId),
    index("families_status_idx").on(table.status),
    index("families_shelter_idx").on(table.shelterId),
  ],
);

export const familyMembersTable = pgTable(
  "family_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    nationalId: varchar("national_id", { length: 80 }),
    gender: memberGenderEnum("gender").notNull(),
    birthDate: date("birth_date", { mode: "string" }),
    relationship: varchar("relationship", { length: 80 }).notNull(),
    criticalCase: boolean("critical_case").notNull().default(false),
    criticalNotes: text("critical_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("family_members_family_idx").on(table.familyId)],
);

export const familyAssignmentHistoryTable = pgTable(
  "family_assignment_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
    fromDelegateId: uuid("from_delegate_id").references(() => staffUsers.id, { onDelete: "set null" }),
    toDelegateId: uuid("to_delegate_id").references(() => staffUsers.id, { onDelete: "set null" }),
    fromShelterId: uuid("from_shelter_id").references(() => shelterUnitsTable.id, { onDelete: "set null" }),
    toShelterId: uuid("to_shelter_id").references(() => shelterUnitsTable.id, { onDelete: "set null" }),
    changedById: uuid("changed_by_id").references(() => staffUsers.id, { onDelete: "restrict" }),
    changedByLegacyUserId: integer("changed_by_legacy_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    reason: text("reason"),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("family_assignment_history_family_idx").on(table.familyId)],
);

export const familyNeedsTable = pgTable(
  "family_needs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
    category: needCategoryEnum("category").notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description"),
    priority: needPriorityEnum("priority").notNull().default("MEDIUM"),
    status: needStatusEnum("status").notNull().default("REQUIRED"),
    createdById: uuid("created_by_id").references(() => staffUsers.id, { onDelete: "restrict" }),
    createdByLegacyUserId: integer("created_by_legacy_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    assignedToId: uuid("assigned_to_id").references(() => staffUsers.id, { onDelete: "set null" }),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("family_needs_family_idx").on(table.familyId),
    index("family_needs_status_idx").on(table.status),
    index("family_needs_priority_idx").on(table.priority),
  ],
);

export const needStatusHistoryTable = pgTable(
  "need_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    needId: uuid("need_id").notNull().references(() => familyNeedsTable.id, { onDelete: "cascade" }),
    fromStatus: needStatusEnum("from_status"),
    toStatus: needStatusEnum("to_status").notNull(),
    changedById: uuid("changed_by_id").references(() => staffUsers.id, { onDelete: "restrict" }),
    changedByLegacyUserId: integer("changed_by_legacy_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    note: text("note"),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("need_status_history_need_idx").on(table.needId)],
);

export const insertCampSchema = createInsertSchema(campsTable).omit({ id: true, createdAt: true });
export const insertSectorSchema = createInsertSchema(campSectorsTable).omit({ id: true, createdAt: true });
export const insertShelterSchema = createInsertSchema(shelterUnitsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFamilySchema = createInsertSchema(familiesTable).omit({
  id: true, createdAt: true, updatedAt: true, approvedAt: true, approvedById: true, archivedAt: true, version: true,
});
export const insertFamilyMemberSchema = createInsertSchema(familyMembersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFamilyNeedSchema = createInsertSchema(familyNeedsTable).omit({
  id: true, createdAt: true, updatedAt: true, fulfilledAt: true, archivedAt: true, version: true,
});

export type CampRecord = typeof campsTable.$inferSelect;
export type SectorRecord = typeof campSectorsTable.$inferSelect;
export type ShelterRecord = typeof shelterUnitsTable.$inferSelect;
export type FamilyRecord = typeof familiesTable.$inferSelect;
export type FamilyMemberRecord = typeof familyMembersTable.$inferSelect;
export type FamilyAssignmentHistoryRecord = typeof familyAssignmentHistoryTable.$inferSelect;
export type FamilyNeedRecord = typeof familyNeedsTable.$inferSelect;
export type NeedStatusHistoryRecord = typeof needStatusHistoryTable.$inferSelect;
export type InsertCamp = z.infer<typeof insertCampSchema>;
export type InsertSector = z.infer<typeof insertSectorSchema>;
export type InsertShelter = z.infer<typeof insertShelterSchema>;
export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type InsertFamilyNeed = z.infer<typeof insertFamilyNeedSchema>;