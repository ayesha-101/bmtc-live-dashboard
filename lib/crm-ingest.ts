import type { DealStage, Department, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { writeAudit } from "./audit";
import { nextReference } from "./reference";
import {
  readCrmLpo,
  validateCrmLpo,
  normalizeName,
  REJECT_EXPLANATION,
  type CrmLpo,
  type Raw,
  type RejectReason,
} from "./crm";

export type IngestStatus = "created" | "updated" | "skipped" | "rejected";

export interface IngestResult {
  status: IngestStatus;
  externalId: string;
  reason: string | null;
  dealId: number | null;
}

// Only these stages may be advanced by an incoming LPO. Once Sales Admin
// has taken a deal into billing, the CRM feed updates its figures but must
// not drag its stage backwards — the invoice is the later truth.
const ADVANCEABLE: readonly DealStage[] = ["enquiry", "quoted"];

/**
 * Record what happened to one incoming record.
 *
 * Deliberately non-fatal. The deal is the truth; this log is observability
 * on top of it. If the log write failed and we let it throw, a deal that
 * was created successfully would be reported back to the CRM as rejected —
 * so the CRM would retry, and an operator would go hunting for a problem
 * that does not exist.
 */
async function log(entry: {
  source: string;
  externalId: string;
  status: IngestStatus;
  reason: string | null;
  location: string;
  salesPerson: string;
  dealId: number | null;
  payload: Raw;
}) {
  try {
    await prisma.crmSyncLog.create({
    data: {
      source: entry.source,
      externalId: entry.externalId,
      status: entry.status,
      reason: entry.reason,
      location: entry.location,
      salesPerson: entry.salesPerson,
      dealId: entry.dealId,
      payload: entry.payload as Prisma.InputJsonValue,
    },
    });
  } catch (err) {
    console.error("CRM sync log write failed", err);
  }
}

function reject(
  r: CrmLpo,
  raw: Raw,
  source: string,
  reason: RejectReason
): Promise<IngestResult> {
  // An out-of-scope emirate is a normal, expected outcome of an
  // Abu-Dhabi-only feed, so it is recorded as "skipped" rather than
  // "rejected" — the sync page shouldn't cry wolf over it.
  const status: IngestStatus = reason === "outside_abu_dhabi" ? "skipped" : "rejected";
  const explanation = REJECT_EXPLANATION[reason];
  return log({
    source,
    externalId: r.externalId,
    status,
    reason: explanation,
    location: r.location,
    salesPerson: r.salesPerson,
    dealId: null,
    payload: raw,
  }).then(() => ({ status, externalId: r.externalId, reason: explanation, dealId: null }));
}

/**
 * Take one record from the CRM and make it a deal.
 *
 * Read-only towards the CRM: nothing here ever calls back or writes to it.
 * Idempotent: the CRM's own id is UNIQUE on the deal, so a retried webhook
 * or an edit updates the row it already created. Every outcome — accepted,
 * skipped, rejected — is written to crm_sync_log with its reason, so the
 * feed can be answered for without guesswork.
 */
export async function ingestCrmLpo(raw: Raw, source: string): Promise<IngestResult> {
  const r = readCrmLpo(raw);

  const invalid = validateCrmLpo(r);
  if (invalid) return reject(r, raw, source, invalid);

  // Whose row is this? Email is the reliable key; the display name is the
  // fallback, because most CRMs send only a name. We deliberately do NOT
  // fall back to some catch-all account: attributing a colleague's LPO to
  // the wrong person would corrupt the very thing this system exists to
  // measure, so an unmatched name is held back instead.
  const candidates = await prisma.user.findMany({
    where: { isActive: true, role: "employee", department: { not: "sales_admin" } },
    select: { id: true, email: true, fullName: true, department: true },
  });

  const byEmail = r.salesEmail
    ? candidates.find((u) => u.email === r.salesEmail.toLowerCase())
    : undefined;
  const wanted = normalizeName(r.salesPerson);
  const byName = wanted
    ? candidates.find((u) => normalizeName(u.fullName) === wanted) ??
      // "Nelson" should match "Nelson Fernandes" — but only when exactly
      // one account starts with that name, never when it's ambiguous.
      (() => {
        const starts = candidates.filter((u) => normalizeName(u.fullName).startsWith(wanted + " "));
        return starts.length === 1 ? starts[0] : undefined;
      })()
    : undefined;

  const owner = byEmail ?? byName;
  if (!owner) return reject(r, raw, source, "unknown_sales_person");

  // The CRM's own division wins; otherwise the row belongs to whatever
  // department its salesperson works in.
  const department: Department = r.department ?? owner.department;
  if (department === "sales_admin") return reject(r, raw, source, "unknown_department");

  const lpoDate = r.lpoDate ?? new Date();
  const lpoRef = r.lpoRef || r.quoteRef || r.externalId;

  // Prefer the CRM id; failing that, adopt a deal already entered by hand
  // for the same quotation instead of creating a second row for one job.
  const existing =
    (await prisma.deal.findUnique({ where: { externalId: r.externalId } })) ??
    (r.quoteRef ? await prisma.deal.findFirst({ where: { quoteRef: r.quoteRef } }) : null);

  const result = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.deal.update({
        where: { id: existing.id },
        data: {
          externalId: r.externalId,
          externalSource: source,
          lpoRef,
          lpoValue: r.lpoValue,
          lpoGp: r.lpoGp ?? null,
          lpoDate,
          location: r.location,
          ...(r.brand ? { brand: r.brand } : {}),
          ...(r.customer ? { customer: r.customer } : {}),
          ...(r.projectName ? { projectName: r.projectName } : {}),
          ...(r.salesPerson ? { salesPerson: r.salesPerson } : {}),
          ...(ADVANCEABLE.includes(existing.stage) ? { stage: "lpo_received" as const } : {}),
        },
      });
      await writeAudit(tx, {
        dealId: existing.id,
        actorId: owner.id,
        department,
        action: "crm_lpo_updated",
        note: `${source}: LPO ${lpoRef}`,
      });
      return { id: existing.id, status: "updated" as const };
    }

    const reference = await nextReference(tx);
    const deal = await tx.deal.create({
      data: {
        reference,
        department,
        createdById: owner.id,
        externalId: r.externalId,
        externalSource: source,
        // The CRM feed starts at the award, so the enquiry date is the best
        // date we have for it.
        enquiryDate: lpoDate,
        customer: r.customer || "—",
        projectName: r.projectName || lpoRef,
        salesPerson: r.salesPerson,
        brand: r.brand,
        location: r.location,
        quoteRef: r.quoteRef || null,
        lpoRef,
        lpoValue: r.lpoValue,
        lpoGp: r.lpoGp ?? null,
        lpoDate,
        stage: "lpo_received",
      },
    });
    await writeAudit(tx, {
      dealId: deal.id,
      actorId: owner.id,
      department,
      action: "crm_lpo_received",
      note: `${source}: LPO ${lpoRef} — ${r.customer}`,
    });
    return { id: deal.id, status: "created" as const };
  });

  await log({
    source,
    externalId: r.externalId,
    status: result.status,
    reason: null,
    location: r.location,
    salesPerson: r.salesPerson,
    dealId: result.id,
    payload: raw,
  });

  return { status: result.status, externalId: r.externalId, reason: null, dealId: result.id };
}
