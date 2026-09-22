ALTER TABLE "aid_distributions"
  ADD CONSTRAINT "aid_distributions_delivery_fields_check"
  CHECK (
    ("status" = 'RECEIVED' AND "delivered_by_id" IS NOT NULL AND "delivered_at" IS NOT NULL)
    OR
    ("status" IN ('ASSIGNED', 'CANCELLED') AND "delivered_by_id" IS NULL AND "delivered_at" IS NULL)
  );