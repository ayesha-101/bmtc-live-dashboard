import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ingestCrmLpo, type IngestResult } from "@/lib/crm-ingest";
import type { Raw } from "@/lib/crm";

/**
 * The CRM feed's front door.
 *
 * The CRM POSTs here the moment an LPO is created or changed, and the
 * record is on the dashboard seconds later. It is a one-way street: this
 * endpoint only ever reads what is sent and writes to our own database —
 * nothing in the codebase calls back into the CRM or modifies it.
 *
 * Accepts one record or an array of them, under a few common envelopes,
 * because CRMs differ on all of that and none of it is worth a config
 * screen.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A webhook body is small. Anything larger is either a misconfiguration or
// someone probing, and is refused before it is parsed.
const MAX_BODY_BYTES = 1_000_000;
const MAX_RECORDS = 500;

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Compare a fixed-length digest of each side, so the comparison itself
  // leaks neither the length nor the content of the expected secret.
  const ah = crypto.createHash("sha256").update(ab).digest();
  const bh = crypto.createHash("sha256").update(bb).digest();
  return crypto.timingSafeEqual(ah, bh);
}

/**
 * Two ways to prove the request really came from the CRM:
 *
 *  1. An HMAC-SHA256 signature over the exact raw body. Preferred — it
 *     also proves the body wasn't altered in transit, and a captured
 *     request can't be edited and replayed.
 *  2. A static bearer token, for the many CRMs whose webhook UI can only
 *     add a fixed header.
 *
 * Fails closed: with no secret configured the endpoint refuses everything
 * rather than standing open.
 */
function authorize(request: NextRequest, rawBody: string): { ok: boolean; status: number; error?: string } {
  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (!secret || secret.length < 16) {
    return { ok: false, status: 503, error: "Feed is not configured." };
  }

  const signature =
    request.headers.get("x-bmtc-signature") ||
    request.headers.get("x-webhook-signature") ||
    request.headers.get("x-signature") ||
    "";

  if (signature) {
    const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const given = signature.replace(/^sha256=/i, "").trim();
    return timingSafeEqual(expected, given)
      ? { ok: true, status: 200 }
      : { ok: false, status: 401, error: "Bad signature." };
  }

  const auth = request.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : request.headers.get("x-api-key") || "";

  if (!token) return { ok: false, status: 401, error: "Missing signature or token." };
  return timingSafeEqual(secret, token)
    ? { ok: true, status: 200 }
    : { ok: false, status: 401, error: "Bad token." };
}

/** Dig the records out of whatever the CRM wrapped them in. */
function extractRecords(parsed: unknown): Raw[] {
  if (Array.isArray(parsed)) return parsed.filter(isRaw);
  if (!isRaw(parsed)) return [];
  for (const key of ["data", "records", "items", "results", "payload", "lpos"]) {
    const v = (parsed as Raw)[key];
    if (Array.isArray(v)) return v.filter(isRaw);
  }
  return [parsed];
}

function isRaw(v: unknown): v is Raw {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Body too large." }, { status: 413 });
  }

  const auth = authorize(request, rawBody);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Body is not valid JSON." }, { status: 400 });
  }

  const records = extractRecords(parsed);
  if (records.length === 0) {
    return NextResponse.json({ error: "No records found in the body." }, { status: 400 });
  }
  if (records.length > MAX_RECORDS) {
    return NextResponse.json(
      { error: `Too many records in one request (max ${MAX_RECORDS}).` },
      { status: 413 }
    );
  }

  const source = (request.headers.get("x-bmtc-source") || "crm").slice(0, 40);

  // Sequential on purpose: the audit log is a hash chain, so entries must
  // be appended one at a time. A webhook batch is small; correctness of
  // the chain matters more than the milliseconds.
  const results: IngestResult[] = [];
  for (const record of records) {
    try {
      results.push(await ingestCrmLpo(record, source));
    } catch (err) {
      console.error("CRM ingest failed", err);
      results.push({
        status: "rejected",
        externalId: "",
        reason: "The record could not be processed.",
        dealId: null,
      });
    }
  }

  const summary = {
    received: results.length,
    created: results.filter((r) => r.status === "created").length,
    updated: results.filter((r) => r.status === "updated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    rejected: results.filter((r) => r.status === "rejected").length,
  };

  return NextResponse.json({ ok: true, ...summary, results }, { headers: { "Cache-Control": "no-store" } });
}

// A GET is how most CRM webhook screens "test" a URL, and how a human
// checks the endpoint is alive. It reveals nothing.
export async function GET() {
  const configured = Boolean(process.env.CRM_WEBHOOK_SECRET);
  return NextResponse.json(
    { endpoint: "BMTC LPO feed", method: "POST", configured, scope: "Abu Dhabi projects only" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
