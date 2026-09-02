import { PrismaClient } from "@prisma/client";

// One Prisma client per process. In dev, Next.js hot-reload would
// otherwise open a new pool on every reload and exhaust Neon's
// connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
