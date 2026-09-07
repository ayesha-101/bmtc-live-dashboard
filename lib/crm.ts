import type { Department } from "@prisma/client";

/**
 * Turning one CRM record into one of our deals.
 *
 * Everything in this file is pure — no database, no network — so the two
 * decisions that actually matter (is this an Abu Dhabi project? whose row
 * is it?) can be tested directly, and so the same logic serves a webhook,
 * a scheduled pull, or a file import without being rewritten.
 */

// ---------------------------------------------------------------------------
// Reading whatever shape the CRM sends
// ---------------------------------------------------------------------------

export type Raw = Record<string, unknown>;

function normKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * A field's value may not be a plain string. Zoho, Salesforce and Dynamics
 * all send lookup fields — an owner, an account — as a small object, and
 * naively stringifying one yields "[object Object]" rather than a name.
 */
function toText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as Raw;
    for (const key of ["name", "full_name", "fullName", "display_name", "label", "value", "email", "id"]) {
      const inner = o[key];
      if (inner !== null && inner !== undefined && typeof inner !== "object") {
        const s = String(inner).trim();
        if (s) return s;
      }
    }
    return "";
  }
  return String(v).trim();
}

/**
 * Pull a field by any of its known names. CRMs disagree on what to call
 * the same thing — amount / value / grand_total — and they disagree on
 * punctuation and case too, so keys are compared with everything but
 * letters and digits stripped.
 */
export function pick(raw: Raw, ...names: string[]): string {
  const flat = new Map<string, unknown>();
  for (const [k, v] of Object.entries(raw)) flat.set(normKey(k), v);
  for (const n of names) {
    const s = toText(flat.get(normKey(n)));
    if (s) return s;
  }
  return "";
}

/**
 * Reach inside a lookup object for one of its own fields.
 *
 * Zoho sends the record owner as `{"name": "Nelson", "email": "..."}` — the
 * email is in there, but under no top-level key, and email is the one
 * reliable way to tie an LPO to the right account. toText() takes the name
 * and stops, so the email needs asking for by hand.
 */
export function pickSub(raw: Raw, parents: string[], sub: string): string {
  const flat = new Map<string, unknown>();
  for (const [k, v] of Object.entries(raw)) flat.set(normKey(k), v);
  for (const p of parents) {
    const parent = flat.get(normKey(p));
    if (!parent || typeof parent !== "object" || Array.isArray(parent)) continue;
    const inner = new Map<string, unknown>();
    for (const [k, v] of Object.entries(parent as Raw)) inner.set(normKey(k), v);
    const got = inner.get(normKey(sub));
    if (got !== null && got !== undefined && typeof got !== "object") {
      const str = String(got).trim();
      if (str) return str;
    }
  }
  return "";
}

/** Amounts arrive as "1,234.50", "AED 1,234.50", 1234.5, or "-" for none. */
export function parseMoney(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** ISO, or the day-first formats every UAE system produces. */
export function parseDate(s: string): Date | null {
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // 16/01/2026, 16-01-2026, 16.01.2026 — day first, as used locally.
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(s);
  if (dmy) {
    const year = +dmy[3] < 100 ? 2000 + +dmy[3] : +dmy[3];
    const d = new Date(Date.UTC(year, +dmy[2] - 1, +dmy[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Abu Dhabi only
// ---------------------------------------------------------------------------

// The emirate itself, its airport code, and the towns inside it. A CRM
// rarely writes "Abu Dhabi" — it writes the site: Mussafah, Al Ain, Ruwais.
const ABU_DHABI = [
  "abu dhabi", "abudhabi", "abu-dhabi", "abu_dhabi", "auh", "ad", "adh",
  "abu dabi", "abudabi", "أبوظبي", "أبو ظبي", "ابوظبي", "ابو ظبي",
  "al ain", "alain", "al-ain", "العين",
  "al dhafra", "aldhafra", "western region", "الظفرة",
  "mussafah", "musaffah", "mussafa", "مصفح",
  "ruwais", "الرويس", "madinat zayed", "مدينة زايد", "liwa", "ليوا",
  "ghayathi", "sila", "silaa", "yas island", "saadiyat", "khalifa city",
  "khalifa industrial", "kizad", "shahama", "bani yas", "baniyas",
  "mirfa", "delma", "sweihan", "shamkha", "reem island", "masdar",
];

// Named so an out-of-scope project is rejected outright rather than left
// as "unknown" and quietly held back.
const OTHER_EMIRATES = [
  "dubai", "دبي", "dxb", "sharjah", "الشارقة", "shj",
  "ajman", "عجمان", "fujairah", "الفجيرة", "fuj",
  "ras al khaimah", "rasalkhaimah", "rak", "رأس الخيمة", "راس الخيمة",
  "umm al quwain", "ummalquwain", "uaq", "أم القيوين",
  "jebel ali", "jafza", "deira", "bur dubai", "al quoz",
  "oman", "muscat", "saudi", "riyadh", "jeddah", "dammam", "qatar", "doha",
  "kuwait", "bahrain", "منام",
];

export type LocationVerdict = "abu_dhabi" | "other_emirate" | "unknown";

/**
 * Decide whether a CRM location is an Abu Dhabi project.
 *
 * Three answers, not two, on purpose. Treating an unrecognised location as
 * "not Abu Dhabi" would silently drop real work the first time the CRM
 * writes a site name we haven't seen; treating it as Abu Dhabi would
 * quietly inflate the numbers. So an unknown value is neither — it is held
 * out and shown in the sync log, where adding the name here is a one-line
 * fix.
 */
export function classifyLocation(location: string): LocationVerdict {
  const s = " " + location.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() + " ";
  if (s.trim() === "") return "unknown";
  // Abu Dhabi wins a tie: "Abu Dhabi office, delivering to Dubai" is ours.
  for (const a of ABU_DHABI) if (s.includes(" " + a + " ")) return "abu_dhabi";
  for (const o of OTHER_EMIRATES) if (s.includes(" " + o + " ")) return "other_emirate";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

const DEPT_ALIASES: Array<[Department, string[]]> = [
  ["electrical", ["electrical", "electric", "elec", "es", "electrical solution"]],
  ["urban", ["urban", "urban solution", "infra", "infrastructure"]],
  ["lightning", ["lighting", "lightning", "light", "ls", "lighting solution"]],
  ["water", ["water", "plumbing", "ws", "water solution"]],
  ["showroom", ["showroom", "retail", "counter", "shop"]],
];

/** Map a CRM division/business-unit label onto our department enum. */
export function mapDepartment(value: string): Department | null {
  const s = value.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  for (const [dept, aliases] of DEPT_ALIASES) {
    if (aliases.some((a) => s === a)) return dept;
  }
  for (const [dept, aliases] of DEPT_ALIASES) {
    if (aliases.some((a) => s.includes(a))) return dept;
  }
  return null;
}

/** Compare people's names tolerantly: "  nelson  " === "Nelson". */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// The record itself
// ---------------------------------------------------------------------------

export interface CrmLpo {
  externalId: string;
  lpoRef: string;
  quoteRef: string;
  customer: string;
  projectName: string;
  salesPerson: string;
  salesEmail: string;
  department: Department | null;
  brand: string;
  location: string;
  lpoValue: number | null;
  lpoGp: number | null;
  lpoDate: Date | null;
}

/**
 * Read one CRM record into our shape, accepting the field names the common
 * CRMs use. Unrecognised extra fields are ignored, not an error — a CRM
 * adding a column must never break the feed.
 */
export function readCrmLpo(raw: Raw): CrmLpo {
  // Some CRMs wrap the record in an envelope.
  const inner = (raw.data ?? raw.record ?? raw.payload ?? raw) as Raw;
  const body = typeof inner === "object" && inner !== null ? inner : raw;

  const value = parseMoney(
    pick(body, "lpo_value", "lpoValue", "value", "amount", "grand_total", "total", "net_amount", "order_value", "Amount", "Grand_Total", "Sub_Total")
  );
  const gp = parseMoney(
    pick(body, "lpo_gp", "gp_value", "gp", "gross_profit", "margin", "margin_value", "profit", "GP_Value", "GP")
  );

  return {
    // Zoho's own names are listed alongside the generic ones throughout:
    // its webhook builder lets you choose the parameter name, but a
    // straight module payload arrives with these.
    externalId: pick(body, "external_id", "id", "record_id", "lpo_id", "order_id", "entity_id", "Deal_Id", "Sales_Order_Id", "Purchase_Order_Id", "entityId"),
    lpoRef: pick(body, "lpo_ref", "lpo_number", "lpo_no", "po_number", "po_no", "purchase_order", "reference", "order_number", "subject", "PO_Number", "Subject", "SO_Number"),
    quoteRef: pick(body, "quote_ref", "quotation_number", "quote_number", "quote_no", "quotation_ref", "Quote_Number", "Quote_Name"),
    customer: pick(body, "customer", "customer_name", "account", "account_name", "client", "client_name", "company", "Account_Name", "Contact_Name"),
    projectName: pick(body, "project_name", "project", "deal_name", "opportunity", "opportunity_name", "job_name", "description", "Deal_Name", "Potential_Name"),
    salesPerson: pick(body, "sales_person", "salesperson", "sales_rep", "owner", "owner_name", "sales_owner", "assigned_to", "created_by", "Owner", "Deal_Owner", "Sales_Person"),
    salesEmail:
      pick(body, "sales_email", "owner_email", "salesperson_email", "assigned_to_email", "Owner_Email") ||
      pickSub(body, ["owner", "deal_owner", "sales_person", "assigned_to", "created_by"], "email") ||
      pick(body, "email"),
    department: mapDepartment(
      pick(body, "department", "division", "business_unit", "bu", "product_line", "segment", "Department", "Division")
    ),
    brand: pick(body, "brand", "brands", "manufacturer", "make", "supplier", "Brand", "Vendor_Name"),
    location: pick(body, "location", "site_location", "city", "emirate", "region", "area", "site", "project_location", "billing_city", "shipping_city", "Billing_City", "Shipping_City", "Mailing_City"),
    lpoValue: value,
    lpoGp: gp,
    lpoDate: parseDate(
      pick(body, "lpo_date", "order_date", "po_date", "date", "closing_date", "close_date", "won_date", "created_time", "Closing_Date", "PO_Date", "Created_Time")
    ),
  };
}

export type RejectReason =
  | "missing_external_id"
  | "missing_value"
  | "outside_abu_dhabi"
  | "unknown_location"
  | "unknown_sales_person"
  | "unknown_department";

/**
 * Everything that can be judged without touching the database. Returning
 * the reason (rather than a bare false) is what makes the sync log useful.
 */
export function validateCrmLpo(r: CrmLpo): RejectReason | null {
  if (!r.externalId) return "missing_external_id";
  if (r.lpoValue === null) return "missing_value";
  const verdict = classifyLocation(r.location);
  if (verdict === "other_emirate") return "outside_abu_dhabi";
  if (verdict === "unknown") return "unknown_location";
  return null;
}

export const REJECT_EXPLANATION: Record<RejectReason, string> = {
  missing_external_id: "The record carried no id, so it could not be tracked or de-duplicated.",
  missing_value: "The record carried no LPO value.",
  outside_abu_dhabi: "Not an Abu Dhabi project — this feed is Abu Dhabi only.",
  unknown_location: "The location was empty or unrecognised, so it was held back rather than guessed.",
  unknown_sales_person: "No active account matches this salesperson. Create the account, then replay.",
  unknown_department: "The department could not be determined from the record or the salesperson's account.",
};
