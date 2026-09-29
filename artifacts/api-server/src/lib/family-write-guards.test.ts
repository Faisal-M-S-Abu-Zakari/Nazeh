import assert from "node:assert/strict";
import test from "node:test";
import {
  FAMILY_NATIONAL_ID_INDEX,
  isNationalIdUniqueViolation,
  lockShelterRows,
  normalizeNationalId,
  sortedUniqueShelterIds,
  uniqueNormalizedNationalIds,
} from "./family-write-guards";

function createMutex() {
  let locked = false;
  let waiting: Array<() => void> = [];
  return {
    async acquire() {
      if (locked) {
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
      locked = true;
      return () => {
        const next = waiting.shift();
        if (next) next();
        else locked = false;
      };
    },
  };
}

test("normalizes national IDs consistently and sorts/deduplicates shelter lock keys", () => {
  assert.equal(normalizeNationalId("  AB\t 123 "), "ab 123");
  assert.deepEqual(uniqueNormalizedNationalIds(["AB 123", " AB\t 123 "]), ["ab 123"]);
  assert.deepEqual(sortedUniqueShelterIds(["b", "a", null, "b", undefined]), ["a", "b"]);
});

test("shelter placement writers serialize at the shared FOR UPDATE lock", async () => {
  const mutex = createMutex();
  const shelterLocks = new Map<string, () => void>();
  let occupied = 0;
  let maximumObserved = 0;
  const makeTx = () => {
    let shelterId = "";
    const query = {
      from() { return query; },
      where() { shelterId = "shelter-one"; return query; },
      orderBy() { return query; },
      async for(mode: string) {
        assert.equal(mode, "update");
        const release = await mutex.acquire();
        shelterLocks.set(shelterId, release);
        return [];
      },
    };
    return {
      select() { return query; },
      release() { shelterLocks.get("shelter-one")?.(); },
    };
  };
  const reserveCapacity = async () => {
    const tx = makeTx();
    await lockShelterRows(tx, ["shelter-one"]);
    try {
      const observed = occupied;
      maximumObserved = Math.max(maximumObserved, observed);
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (observed < 1) occupied += 1;
    } finally {
      tx.release();
    }
  };

  await Promise.all([reserveCapacity(), reserveCapacity()]);
  assert.equal(occupied, 1, "capacity cannot be oversubscribed by concurrent placement writers");
  assert.equal(maximumObserved, 1);
});

test("recognizes only the national-ID unique-index conflict without needing identifier values", () => {
  assert.equal(isNationalIdUniqueViolation({ code: "23505", constraint: FAMILY_NATIONAL_ID_INDEX }), true);
  assert.equal(isNationalIdUniqueViolation({ code: "23505", constraint: "another_unique_index" }), false);
  assert.equal(isNationalIdUniqueViolation({ cause: { code: "23505", constraint: FAMILY_NATIONAL_ID_INDEX } }), true);
});