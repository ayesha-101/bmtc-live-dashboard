import type { Department, DealStage } from "@prisma/client";

export function formatAED(n: number): string {
  return "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Units that generate revenue, and so get a dashboard card and a target.
// Sales Admin is a back-office function, not a producing unit, so it is
// excluded.
export const PRODUCING_DEPARTMENTS: Department[] = [
  "electrical", "urban", "lightning", "water", "showroom",
];

// Every department, for the admin's account pickers.
export const ALL_DEPARTMENTS: Department[] = [
  "electrical", "urban", "lightning", "water", "showroom", "sales_admin",
];

// Display names. The stored enum values stay as they are (changing them
// would mean migrating every existing row for no user-visible gain) — note
// the `lightning` value is a historic typo for Lighting, corrected here.
export const DEPARTMENT_LABELS: Record<Department, string> = {
  electrical: "Electrical Solution",
  urban: "Urban Solution",
  lightning: "Lighting Solution",
  water: "Water Solution",
  showroom: "Showroom",
  sales_admin: "Sales Admin",
};

// Short form for tight spaces (table cells, pills).
export const DEPARTMENT_SHORT: Record<Department, string> = {
  electrical: "Electrical",
  urban: "Urban",
  lightning: "Lighting",
  water: "Water",
  showroom: "Showroom",
  sales_admin: "Sales Admin",
};

export const STAGE_LABELS: Record<DealStage, string> = {
  enquiry: "Enquiry",
  quoted: "Quoted",
  lpo_received: "LPO Received",
  pending_invoice: "Pending Invoice",
  invoiced: "Invoiced",
  sold: "Sold",
  lost: "Lost",
};

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// Short money for dense cards: AED 1.2M / 850K.
export function compactAED(n: number): string {
  if (Math.abs(n) >= 1_000_000) return "AED " + (n / 1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 1_000) return "AED " + Math.round(n / 1_000) + "K";
  return "AED " + n.toFixed(0);
}

export function timeAgo(iso: string | Date): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
