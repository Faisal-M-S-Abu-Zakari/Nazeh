DO $$ BEGIN
  ALTER TYPE "need_status" ADD VALUE IF NOT EXISTS 'APPROVED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "aid_distribution_status" AS ENUM ('ASSIGNED', 'RECEIVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aid_distributions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "aid_id" uuid NOT NULL REFERENCES "sync_aids"("id") ON DELETE CASCADE,
  "need_id" uuid NOT NULL REFERENCES "family_needs"("id") ON DELETE RESTRICT,
  "family_id" uuid NOT NULL REFERENCES "families"("id") ON DELETE RESTRICT,
  "quantity" integer NOT NULL,
  "unit" text NOT NULL,
  "status" "aid_distribution_status" DEFAULT 'ASSIGNED' NOT NULL,
  "executed_by_id" uuid NOT NULL REFERENCES "staff_users"("id") ON DELETE RESTRICT,
  "delivered_by_id" uuid REFERENCES "staff_users"("id") ON DELETE SET NULL,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aid_distributions_cycle_family_unique"
  ON "aid_distributions" ("aid_id", "family_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aid_distributions_aid_idx" ON "aid_distributions" ("aid_id");
CREATE INDEX IF NOT EXISTS "aid_distributions_family_idx" ON "aid_distributions" ("family_id");
CREATE INDEX IF NOT EXISTS "aid_distributions_need_idx" ON "aid_distributions" ("need_id");
CREATE INDEX IF NOT EXISTS "aid_distributions_status_idx" ON "aid_distributions" ("status");