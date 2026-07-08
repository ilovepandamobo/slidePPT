import { PrismaClient } from "@prisma/client";

/** schema 变更后递增，避免 dev 热更新仍用旧的 PrismaClient 缓存 */
const PRISMA_SCHEMA_VERSION = 4;

type PrismaGlobal = {
  prisma?: PrismaClient;
  prismaSchemaVersion?: number;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getPrisma(): PrismaClient {
  const g = globalThis as PrismaGlobal;
  if (
    g.prisma &&
    (process.env.NODE_ENV === "production" ||
      g.prismaSchemaVersion === PRISMA_SCHEMA_VERSION)
  ) {
    return g.prisma;
  }

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    g.prisma = client;
    g.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
  }
  return client;
}

export const prisma = getPrisma();
