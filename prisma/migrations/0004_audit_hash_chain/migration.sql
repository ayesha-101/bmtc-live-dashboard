-- Blockchain-style tamper evidence for the audit trail. Each entry stores
-- the hash of the previous entry plus its own hash over (id, time, actor,
-- action, lpo, department, note, prevHash) — so any edit, deletion, or
-- reordering of a past row breaks the chain from that point on and the
-- integrity check reports exactly where.
ALTER TABLE "audit_log" ADD COLUMN "prev_hash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "audit_log" ADD COLUMN "hash" TEXT NOT NULL DEFAULT '';
