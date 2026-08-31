import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
export const userRoleEnum = pgEnum("user_role", [
  "MANAGER",
  "DELEGATE",
  "DISPLACED",
  "SECURITY",
]);

export const userRankEnum = pgEnum("user_rank", [
  "MANAGER",
  "DELEGATE",
  "DISPLACED",
  "SECURITY",
  "SECURITY_OFFICER",
]);

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull(),
    rank: userRankEnum("rank").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    identity: varchar("identity", { length: 64 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 40 }),
    alternativePhone: varchar("alternative_phone", { length: 40 }),
    profileImage: text("profile_image"),
    gender: varchar("gender", { length: 32 }),
    nationality: varchar("nationality", { length: 80 }),
    socialStatus: varchar("social_status", { length: 80 }),
    education: varchar("education", { length: 120 }),
    age: integer("age"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_identity_unique").on(table.identity),
    index("users_role_idx").on(table.role),
  ],
);

export const sessionsTable = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
  createdAt: true,
});

export type UserRecord = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SessionRecord = typeof sessionsTable.$inferSelect;

export const staffRole = pgEnum("staff_role", [
  "ADMIN",
  "MANAGER",
  "DELEGATE",
  "SECURITY_OFFICER",
  "SECURITY_MEMBER",
]);

export type StaffRole = (typeof staffRole.enumValues)[number];

export const staffUsers = pgTable("staff_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: staffRole("role").notNull(),
  active: boolean("active").notNull().default(true),
  // defaultNow preserves existing password-bearing accounts when this column is
  // introduced; invite creation explicitly stores null until setup completes.
  passwordSetAt: timestamp("password_set_at", { withTimezone: true }).defaultNow(),
  isDevelopmentDemo: boolean("is_development_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sessions = pgTable(
  "staff_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("staff_sessions_token_hash_idx").on(table.tokenHash)],
);

export const credentialTokenKind = pgEnum("credential_token_kind", [
  "INVITE",
  "PASSWORD_RESET",
]);

export const credentialTokens = pgTable(
  "staff_credential_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    kind: credentialTokenKind("kind").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("staff_credential_tokens_hash_unique").on(table.tokenHash),
    index("staff_credential_tokens_user_idx").on(table.userId),
    index("staff_credential_tokens_expiry_idx").on(table.expiresAt),
  ],
);
