BEGIN;

LOCK TABLE "staff_users" IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE "_retired_privileged_staff" ON COMMIT DROP AS
WITH canonical AS (
  SELECT "id"
  FROM "staff_users"
  WHERE "active" = true
    AND "role" IN ('ADMIN', 'MANAGER')
  ORDER BY
    (lower("email") = 'manager@alaqsa.local') DESC,
    ("role" = 'MANAGER') DESC,
    "created_at" ASC,
    "id" ASC
  LIMIT 1
)
SELECT "id"
FROM "staff_users"
WHERE "active" = true
  AND "role" IN ('ADMIN', 'MANAGER')
  AND "id" IS DISTINCT FROM (SELECT "id" FROM canonical);

UPDATE "staff_users"
SET "active" = false,
    "updated_at" = now()
WHERE "id" IN (SELECT "id" FROM "_retired_privileged_staff");

UPDATE "staff_sessions"
SET "revoked_at" = COALESCE("revoked_at", now())
WHERE "user_id" IN (SELECT "id" FROM "_retired_privileged_staff");

UPDATE "staff_credential_tokens"
SET "consumed_at" = COALESCE("consumed_at", now())
WHERE "user_id" IN (SELECT "id" FROM "_retired_privileged_staff");

CREATE UNIQUE INDEX IF NOT EXISTS "staff_users_single_active_manager"
  ON "staff_users" ("active")
  WHERE "active" = true AND "role" IN ('ADMIN', 'MANAGER');

COMMIT;