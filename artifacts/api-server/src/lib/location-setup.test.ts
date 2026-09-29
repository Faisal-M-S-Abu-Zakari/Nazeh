import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLocationName, trimLocationNameInput } from "./location-setup";

test("trims location names and enforces a nonblank 160-character limit", () => {
  assert.equal(normalizeLocationName("  North Camp  "), "North Camp");
  assert.equal(normalizeLocationName(" \t "), undefined);
  assert.equal(normalizeLocationName("a".repeat(160)), "a".repeat(160));
  assert.equal(normalizeLocationName("a".repeat(161)), undefined);
  assert.deepEqual(trimLocationNameInput({ name: `  ${"a".repeat(160)}  ` }), { name: "a".repeat(160) });
  assert.equal((trimLocationNameInput({ name: " \t " }) as { name: string }).name, "");
});