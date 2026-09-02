import type { Department, LpoStatus } from "@prisma/client";
import { prisma } from "./db";
import { PRODUCING_DEPARTMENTS } from "./format";

// A won sale: an LPO that closed and is at or past conversion.
const WON: LpoStatus[] = ["converted_lpo", "pending_invoice", "invoiced"];

export interface DeptOverview {
  department: Department;
  sales: number;
  margin: number;
  lpos: number;
  invoiced: number;
  pending: number;
}

export interface Overview {
  totals: {
    sales: number;
    margin: number;
    lpos: number;
    invoiced: number;
    quoted: number;
    lost: number;
    pending: number;
  };
  byDepartment: DeptOverview[];
}

// Single source of truth for the manager overview numbers — used by both
// the dashboard page and GET /api/manager/overview so they can never
// drift. One groupBy query folded in memory.
export async function computeOverview(): Promise<Overview> {
  const groups = await prisma.lpo.groupBy({
    by: ["department", "status"],
    _sum: { amount: true, margin: true },
    _count: { _all: true },
  });

  const totals = { sales: 0, margin: 0, lpos: 0, invoiced: 0, quoted: 0, lost: 0, pending: 0 };
  const byDept = new Map<Department, DeptOverview>();
  for (const d of PRODUCING_DEPARTMENTS) {
    byDept.set(d, { department: d, sales: 0, margin: 0, lpos: 0, invoiced: 0, pending: 0 });
  }

  for (const g of groups) {
    const amount = Number(g._sum.amount ?? 0);
    const margin = Number(g._sum.margin ?? 0);
    const count = g._count._all;
    const won = WON.includes(g.status);

    if (won) {
      totals.sales += amount;
      totals.margin += margin;
      totals.lpos += count;
    }
    if (g.status === "invoiced") totals.invoiced += count;
    if (g.status === "quoted") totals.quoted += amount;
    if (g.status === "lost") totals.lost += count;
    if (g.status === "pending_invoice") totals.pending += count;

    const dept = byDept.get(g.department);
    if (dept) {
      if (won) {
        dept.sales += amount;
        dept.margin += margin;
        dept.lpos += count;
      }
      if (g.status === "invoiced") dept.invoiced += count;
      if (g.status === "pending_invoice") dept.pending += count;
    }
  }

  return { totals, byDepartment: PRODUCING_DEPARTMENTS.map((d) => byDept.get(d)!) };
}
