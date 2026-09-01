import assert from "node:assert/strict";
import test from "node:test";
import { loginRateLimit } from "./loginRateLimit";

test("blocks repeated failures and resets after a successful login", () => {
  const keys = ["test-ip", "test-account"];
  const start = 1_000_000;
  for (let i = 0; i < 4; i += 1) {
    loginRateLimit.failure(keys, start + i);
    assert.equal(loginRateLimit.check(keys, start + i).allowed, true);
  }
  loginRateLimit.failure(keys, start + 4);
  const blocked = loginRateLimit.check(keys, start + 5);
  assert.equal(blocked.allowed, false);
  assert(blocked.retryAfterSeconds > 0);

  loginRateLimit.success(keys);
  assert.equal(loginRateLimit.check(keys, start + 6).allowed, true);
});