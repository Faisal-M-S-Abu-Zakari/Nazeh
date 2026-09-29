import assert from "node:assert/strict";
import test from "node:test";
import {
  bootstrapInitialManager,
  parseInitialManagerConfig,
  type InitialManagerRepository,
} from "./initialManager";

const validEnvironment = (): NodeJS.ProcessEnv => ({
  NODE_ENV: "production",
  INITIAL_MANAGER_EMAIL: "  FIRST.Manager@Example.COM ",
  INITIAL_MANAGER_PASSWORD: "Strong-Password-2026!",
});

type SyntheticPrivilegedAccount = {
  active: boolean;
  isDevelopmentDemo: boolean;
  email: string;
};

function syntheticRepository(
  initialAccounts: SyntheticPrivilegedAccount[] = [],
): InitialManagerRepository & {
  rows: Array<{ email: string; passwordHash: string }>;
} {
  const privilegedAccounts = [...initialAccounts];
  let lock = Promise.resolve();
  const rows: Array<{ email: string; passwordHash: string }> = [];
  return {
    rows,
    async bootstrap(manager) {
      let release!: () => void;
      const previous = lock;
      lock = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        if (privilegedAccounts.some((account) =>
          account.active &&
          !account.isDevelopmentDemo &&
          !account.email.toLowerCase().endsWith("@alaqsa.local")
        )) return "already-exists";
        if (privilegedAccounts.length > 0) return "privileged-accounts-unavailable";
        if (!manager) return "no-privileged-manager";
        rows.push(manager);
        privilegedAccounts.push({
          active: true,
          isDevelopmentDemo: false,
          email: manager.email,
        });
        return "created";
      } finally {
        release();
      }
    },
  };
}

test("initial manager email is normalized and configuration remains non-production inert", async () => {
  const parsed = parseInitialManagerConfig(validEnvironment());
  assert.deepEqual(parsed, {
    email: "first.manager@example.com",
    password: "Strong-Password-2026!",
  });

  const repository = syntheticRepository();
  assert.equal(
    await bootstrapInitialManager(
      { ...validEnvironment(), NODE_ENV: "development" },
      repository,
      async () => "synthetic-hash",
    ),
    "not-production",
  );
  assert.equal(repository.rows.length, 0);
});

test("invalid and incomplete bootstrap configuration fails without persistence", async () => {
  const repository = syntheticRepository();
  for (const environment of [
    { NODE_ENV: "production", INITIAL_MANAGER_EMAIL: "no-at-symbol" },
    {
      ...validEnvironment(),
      INITIAL_MANAGER_PASSWORD: "weak",
    },
    {
      NODE_ENV: "production",
      INITIAL_MANAGER_EMAIL: "manager@example.test",
    },
  ]) {
    await assert.rejects(
      bootstrapInitialManager(
        environment,
        repository,
        async () => "synthetic-hash",
      ),
    );
  }
  assert.equal(repository.rows.length, 0);
});

test("production without credentials accepts an active real manager but fails on a fresh database", async () => {
  const repository = syntheticRepository([{
    active: true,
    isDevelopmentDemo: false,
    email: "manager@example.test",
  }]);
  assert.equal(
    await bootstrapInitialManager(
      { NODE_ENV: "production" },
      repository,
      async () => "synthetic-hash",
    ),
    "already-exists",
  );

  await assert.rejects(
    bootstrapInitialManager(
      { NODE_ENV: "production" },
      syntheticRepository(),
      async () => "synthetic-hash",
    ),
    /No privileged staff account exists/,
  );
});

test("concurrent production starts create no more than one initial manager", async () => {
  const repository = syntheticRepository();
  const environment = validEnvironment();
  const results = await Promise.all([
    bootstrapInitialManager(environment, repository, async () => "hash-a"),
    bootstrapInitialManager(environment, repository, async () => "hash-b"),
  ]);

  assert.equal(repository.rows.length, 1);
  assert.equal(repository.rows[0]?.email, "first.manager@example.com");
  assert.equal(results.filter((result) => result === "created").length, 1);
  assert.equal(results.filter((result) => result === "already-exists").length, 1);
});

test("an existing active real manager is left untouched with bootstrap config", async () => {
  const repository = syntheticRepository([{
    active: true,
    isDevelopmentDemo: false,
    email: "manager@example.test",
  }]);
  let hashCalls = 0;
  assert.equal(
    await bootstrapInitialManager(validEnvironment(), repository, async () => {
      hashCalls += 1;
      return "synthetic-hash";
    }),
    "already-exists",
  );
  assert.equal(hashCalls, 1);
  assert.equal(repository.rows.length, 0);
});

test("demo-only and inactive-only privileged states fail closed without replacement", async (context) => {
  for (const account of [
    { active: true, isDevelopmentDemo: true, email: "demo@example.test" },
    { active: false, isDevelopmentDemo: false, email: "manager@example.test" },
  ]) {
    await context.test(
      account.isDevelopmentDemo ? "demo-only state" : "inactive-only state",
      async () => {
        const repository = syntheticRepository([account]);
        await assert.rejects(
          bootstrapInitialManager(validEnvironment(), repository, async () => "synthetic-hash"),
          /none is active and eligible for production login/,
        );
        assert.equal(repository.rows.length, 0);
      },
    );
  }
});