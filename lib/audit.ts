import type { Department, Prisma } from "@prisma/client";

// Write one append-only audit entry. Always called with the SAME
// transaction client as the business change it records, so the change and
// its log entry commit together or not at all (plan Phase 3, item 2).
export function writeAudit(
  tx: Prisma.TransactionClient,
  entry: {
    lpoId: number;
    actorId: number;
    department: Department;
    action: string;
    note?: string | null;
  }
) {
  return tx.auditLog.create({
    data: {
      lpoId: entry.lpoId,
      actorId: entry.actorId,
      department: entry.department,
      action: entry.action,
      note: entry.note ?? null,
    },
  });
}
