ALTER TABLE "sync_aids"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sync_people"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sync_complaints"
  ADD COLUMN IF NOT EXISTS "reply" text,
  ADD COLUMN IF NOT EXISTS "replied_by_id" uuid,
  ADD COLUMN IF NOT EXISTS "replied_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "created_by_id" uuid,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "sync_complaints"
SET "created_by_id" = (SELECT "id" FROM "staff_users" ORDER BY "created_at" LIMIT 1)
WHERE "created_by_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "sync_complaints" ALTER COLUMN "created_by_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "sync_tasks"
  ADD COLUMN IF NOT EXISTS "created_by_id" uuid,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "sync_tasks"
SET "created_by_id" = (SELECT "id" FROM "staff_users" ORDER BY "created_at" LIMIT 1)
WHERE "created_by_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "sync_tasks" ALTER COLUMN "created_by_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sync_complaints" ADD CONSTRAINT "sync_complaints_replied_by_id_staff_users_id_fk"
 FOREIGN KEY ("replied_by_id") REFERENCES "public"."staff_users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sync_complaints" ADD CONSTRAINT "sync_complaints_created_by_id_staff_users_id_fk"
 FOREIGN KEY ("created_by_id") REFERENCES "public"."staff_users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sync_tasks" ADD CONSTRAINT "sync_tasks_created_by_id_staff_users_id_fk"
 FOREIGN KEY ("created_by_id") REFERENCES "public"."staff_users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_staff_id" uuid NOT NULL REFERENCES "staff_users"("id"),
  "action" varchar(100) NOT NULL,
  "entity_type" varchar(80) NOT NULL,
  "entity_id" uuid NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_audit_entity_idx"
ON "sync_audit_events" USING btree ("entity_type", "entity_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "login_rate_limit_counters" (
  "key" text PRIMARY KEY NOT NULL,
  "failures" integer DEFAULT 0 NOT NULL,
  "blocked_until" timestamp with time zone,
  "last_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);