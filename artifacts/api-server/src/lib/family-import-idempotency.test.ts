import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalFamilyImportDigest,
  isMatchingFamilyImportReplay,
} from "./family-import-idempotency";

test("canonical import digest ignores object key order but binds all request content", () => {
  const first = {
    campId: "camp-one",
    families: [{ headName: "Synthetic", members: [{ nationalId: "TEST-1", birthDate: new Date("2012-01-01T00:00:00.000Z") }] }],
  };
  const reordered = {
    families: [{ members: [{ birthDate: new Date("2012-01-01T00:00:00.000Z"), nationalId: "TEST-1" }], headName: "Synthetic" }],
    campId: "camp-one",
  };
  const changed = { ...reordered, campId: "camp-two" };

  assert.equal(canonicalFamilyImportDigest(first), canonicalFamilyImportDigest(reordered));
  assert.notEqual(canonicalFamilyImportDigest(first), canonicalFamilyImportDigest(changed));
});

test("cached import responses replay only when they contain the same request digest", () => {
  const digest = canonicalFamilyImportDigest({ campId: "camp-one", families: [] });
  assert.equal(isMatchingFamilyImportReplay({ inputDigest: digest, importedCount: 3 }, digest), true);
  assert.equal(isMatchingFamilyImportReplay({ inputDigest: "different", importedCount: 3 }, digest), false);
  assert.equal(isMatchingFamilyImportReplay({ inputDigest: digest, error: "validation" }, digest), false);
});