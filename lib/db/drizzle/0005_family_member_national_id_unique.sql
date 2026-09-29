BEGIN;

LOCK TABLE "family_members" IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "family_members"
    WHERE "national_id" IS NOT NULL
      AND btrim("national_id") <> ''
    GROUP BY lower(btrim("national_id"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add normalized national ID uniqueness: duplicate records exist';
  END IF;
END;
$$;

CREATE UNIQUE INDEX "family_members_national_id_normalized_unique"
  ON "family_members" (lower(btrim("national_id")))
  WHERE "national_id" IS NOT NULL
    AND btrim("national_id") <> '';

COMMIT;