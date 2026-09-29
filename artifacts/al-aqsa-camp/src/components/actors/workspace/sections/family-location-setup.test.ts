import assert from "node:assert/strict";
import test from "node:test";
import { getLocationIdempotencyAttempt } from "./family-location-setup";

test("reuses a location idempotency key for retries and rotates after input changes or success", () => {
  let keyNumber = 0;
  const createKey = () => `attempt-${++keyNumber}`;
  const first = getLocationIdempotencyAttempt("North Camp", null, createKey);
  const retry = getLocationIdempotencyAttempt("North Camp", first, createKey);
  assert.equal(retry.key, first.key);

  const changedInput = getLocationIdempotencyAttempt("South Camp", first, createKey);
  assert.notEqual(changedInput.key, first.key);

  const nextSubmission = getLocationIdempotencyAttempt("South Camp", null, createKey);
  assert.notEqual(nextSubmission.key, changedInput.key);
});