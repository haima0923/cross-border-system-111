import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";

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

if (!process.env["JWT_SECRET"]) {
  throw new Error("JWT_SECRET environment variable is required but was not provided.");
}

const SYSTEM_USERS = [
  { employeeId: "1", name: "张小凡", role: "product_specialist" },
  { employeeId: "2", name: "赵总监", role: "product_manager" },
  { employeeId: "admin", name: "管理员", role: "admin" },
];
const SYSTEM_PASSWORD = process.env["SYSTEM_USER_PASSWORD"] || "xborder2024";

async function ensureSystemUsers(): Promise<void> {
  const hash = await bcrypt.hash(SYSTEM_PASSWORD, 10);

  for (const u of SYSTEM_USERS) {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.employeeId, u.employeeId));

    if (!existing) {
      await db.insert(usersTable).values({
        id: randomUUID(),
        employeeId: u.employeeId,
        name: u.name,
        role: u.role,
        passwordHash: hash,
      });
      logger.info({ employeeId: u.employeeId, name: u.name }, "System user initialized");
    }
  }
}

ensureSystemUsers()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to initialize system users");
    process.exit(1);
  });
