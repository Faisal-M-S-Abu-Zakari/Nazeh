import assert from "node:assert/strict";
import test from "node:test";
import {
  assertFamilyNationalIdIndex,
  FAMILY_NATIONAL_ID_INDEX_NAME,
  type FamilyNationalIdIndexCatalogRow,
} from "./verify-family-national-id-index";

const validIndex: FamilyNationalIdIndexCatalogRow = {
  index_name: FAMILY_NATIONAL_ID_INDEX_NAME,
  is_unique: true,
  is_valid: true,
  is_ready: true,
  attribute_count: 1,
  access_method: "btree",
  operator_class: "text_ops",
  expression: "((lower(btrim((national_id)::text)))::text)",
  predicate: "(((national_id)::text IS NOT NULL) AND (btrim((national_id)::text) <> (''::text)))",
};

test("accepts the exact normalized national-ID unique expression and nonblank predicate", () => {
  assert.doesNotThrow(() => assertFamilyNationalIdIndex([validIndex]));
});

test("fails closed when the index is missing or has a different expression/predicate", () => {
  assert.throws(() => assertFamilyNationalIdIndex([]), /not ready/);
  assert.throws(
    () => assertFamilyNationalIdIndex([{ ...validIndex, is_unique: false }]),
    /not ready/,
  );
  assert.throws(
    () => assertFamilyNationalIdIndex([{ ...validIndex, expression: "lower(national_id)" }]),
    /not ready/,
  );
  assert.throws(
    () => assertFamilyNationalIdIndex([{ ...validIndex, predicate: "national_id IS NOT NULL" }]),
    /not ready/,
  );
});