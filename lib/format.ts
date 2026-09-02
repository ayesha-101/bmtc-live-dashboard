import type { Department, LpoStatus } from "@prisma/client";

export function formatAED(n: number): string {
  return "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// The four producing units shown as dashboard cards (Sales Admin is a
// function, not a producing unit, so it's excluded from those cards).
export const PRODUCING_DEPARTMENTS: Department[] = ["electrical", "urban", "lightning", "water"];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  electrical: "Electrical",
  urban: "Urban",
  lightning: "Lightning",
  water: "Water",
  sales_admin: "Sales Admin",
};

export const STATUS_LABELS: Record<LpoStatus, string> = {
  quoted: "Quoted",
  converted_lpo: "Converted (LPO)",
  pending_invoice: "Pending Invoice",
  invoiced: "Invoiced",
  lost: "Lost",
};

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
