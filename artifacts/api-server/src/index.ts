import app from "./app";
import { logger } from "./lib/logger";
import { bootstrapInitialManager } from "./lib/initialManager";
import {
  assertFamilyNationalIdIndex,
  FAMILY_NATIONAL_ID_INDEX_NAME,
  FAMILY_NATIONAL_ID_INDEX_QUERY,
  pool,
  type FamilyNationalIdIndexCatalogRow,
} from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  const { rows } = await pool.query<FamilyNationalIdIndexCatalogRow>(
    FAMILY_NATIONAL_ID_INDEX_QUERY,
    [FAMILY_NATIONAL_ID_INDEX_NAME],
  );
  assertFamilyNationalIdIndex(rows);
  await bootstrapInitialManager();
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

start().catch((err: unknown) => {
  logger.error({ err }, "API startup failed");
  process.exit(1);
});
