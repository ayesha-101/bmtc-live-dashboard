import crypto from "crypto";
import type { Department, Prisma } from "@prisma/client";

// Blockchain-style tamper evidence for the audit trail.
//
// Every entry stores the previous entry's hash, and its own hash covers
// its whole payload including that prevHash. That makes the log a chain:
// change one past row — an amount, an actor, a timestamp — or delete one,
// and every hash after it stops matching. verifyChain() finds the exact
// entry where the chain first breaks.
//
// The hashes are computed here on the SERVER and never accepted from a
// client, so a browser can't forge a "valid-looking" entry.

export const GENESIS_HASH = "0".repeat(64);

export interface ChainPayload {
  id: number;
  createdAt: string;
  actorId: number;
  lpoId: number;
  department: string;
  action: string;
  note: string;
  prevHash: string;
}

export function hashEntry(p: ChainPayload): string {
  return crypto.createHash("sha256").update(JSON.stringify(p)).digest("hex");
}

/**
 * Append one audit entry, chained to the previous one. Always called with
 * the SAME transaction client as the business change it records, so the
 * change and its log entry commit together or not at all.
 */
export async function writeAudit(
  tx: Prisma.TransactionClient,
  entry: {
    lpoId: number;
    actorId: number;
    department: Department;
    action: string;
    note?: string | null;
  }
) {
  const last = await tx.auditLog.findFirst({
    orderBy: { id: "desc" },
    select: { hash: true },
  });
  const prevHash = last?.hash || GENESIS_HASH;

  // Insert first to obtain the row's real id and timestamp, then stamp the
  // hash computed over those exact stored values — so what we hash is
  // precisely what a later verification will re-read.
  const created = await tx.auditLog.create({
    data: {
      lpoId: entry.lpoId,
      actorId: entry.actorId,
      department: entry.department,
      action: entry.action,
      note: entry.note ?? null,
      prevHash,
      hash: "",
    },
  });

  const hash = hashEntry({
    id: created.id,
    createdAt: created.createdAt.toISOString(),
    actorId: created.actorId,
    lpoId: created.lpoId,
    department: created.department,
    action: created.action,
    note: created.note ?? "",
    prevHash,
  });

  return tx.auditLog.update({ where: { id: created.id }, data: { hash } });
}

export interface ChainVerifyResult {
  valid: boolean;
  total: number;
  checked: number;
  brokenAtId: number | null;
  reason: string | null;
}

/**
 * Walk the whole chain in id order and re-derive every hash. Returns the
 * first entry that doesn't match, if any.
 */
export async function verifyChain(
  db: Prisma.TransactionClient | { auditLog: Prisma.TransactionClient["auditLog"] }
): Promise<ChainVerifyResult> {
  const rows = await db.auditLog.findMany({ orderBy: { id: "asc" } });

  let prevHash = GENESIS_HASH;
  let checked = 0;

  for (const r of rows) {
    if (r.prevHash !== prevHash) {
      return {
        valid: false,
        total: rows.length,
        checked,
        brokenAtId: r.id,
        reason: "An entry is missing or was reordered (previous-hash mismatch).",
      };
    }
    const expected = hashEntry({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      actorId: r.actorId,
      lpoId: r.lpoId,
      department: r.department,
      action: r.action,
      note: r.note ?? "",
      prevHash: r.prevHash,
    });
    if (expected !== r.hash) {
      return {
        valid: false,
        total: rows.length,
        checked,
        brokenAtId: r.id,
        reason: "An entry's contents were changed after it was written.",
      };
    }
    prevHash = r.hash;
    checked += 1;
  }

  return { valid: true, total: rows.length, checked, brokenAtId: null, reason: null };
}
