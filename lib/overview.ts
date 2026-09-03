import type { Department } from "@prisma/client";
import { prisma } from "./db";
import { PRODUCING_DEPARTMENTS } from "./format";

// Reporting periods the BM asked for.
export type PeriodKey = "month" | "year" | "todate";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  month: "This Month",
  year: "This Year",
  todate: "To Date",
};

export function isPeriodKey(v: string | undefined): v is PeriodKey {
  return v === "month" || v === "year" || v === "todate";
}

/**
 * Date window for a period, plus the fraction of the annual target that
 * window represents:
 *   month  — the current calendar month, 1/12 of the annual target
 *   year   — 1 Jan to now, the full annual target
 *   todate — everything ever recorded; no single-year target applies
 */
export function periodRange(period: PeriodKey, now = new Date()) {
  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { from, to, targetFraction: 1 / 12, comparable: true };
  }
  if (period === "year") {
    const from = new Date(now.getFullYear(), 0, 1);
    const to = new Date(now.getFullYear() + 1, 0, 1);
    return { from, to, targetFraction: 1, comparable: true };
  }
  return { from: null, to: null, targetFraction: 0, comparable: false };
}

export interface DeptReport {
  department: Department;
  // Recognised revenue — invoiced only (the accounting-correct figure).
  revenue: number;
  gp: number;
  gpPercent: number;
  invoiceCount: number;
  // Booked — customer has awarded the LPO but it isn't billed yet.
  booked: number;
  bookedCount: number;
  // Pipeline — quoted and still open.
  pipeline: number;
  pipelineCount: number;
  lostCount: number;
  // Targets for this window (annual figure × the period fraction).
  revenueTarget: number;
  gpTarget: number;
  revenueAchieved: number; // %
  gpAchieved: number; // %
}

export interface Report {
  period: PeriodKey;
  comparable: boolean;
  // The exact window on screen, so the page can label it unambiguously.
  from: Date | null;
  to: Date | null;
  byDepartment: DeptReport[];
  totals: Omit<DeptReport, "department">;
}

function pct(actual: number, target: number): number {
  if (target <= 0) return 0;
  return (actual / target) * 100;
}

/**
 * The single source of truth for every headline number. Each stage is
 * counted on ITS OWN date — revenue on the invoice date, bookings on the
 * LPO date, pipeline on the quote date — so a job quoted in January and
 * invoiced in March lands in the right month for each measure.
 */
export async function buildReport(period: PeriodKey, now = new Date()): Promise<Report> {
  const { from, to, targetFraction, comparable } = periodRange(period, now);
  const inWindow = from && to ? { gte: from, lt: to } : undefined;

  const [invoiced, booked, pipeline, lost, targets] = await Promise.all([
    prisma.deal.groupBy({
      by: ["department"],
      // Showroom sales are recognised the same way: their form mirrors the
      // LPO figures into the invoice_* columns, so one query covers both.
      where: {
        stage: { in: ["invoiced", "sold"] },
        ...(inWindow ? { invoiceDate: inWindow } : {}),
      },
      _sum: { invoiceValue: true, invoiceGp: true },
      _count: { _all: true },
    }),
    prisma.deal.groupBy({
      by: ["department"],
      where: {
        stage: { in: ["lpo_received", "pending_invoice"] },
        ...(inWindow ? { lpoDate: inWindow } : {}),
      },
      _sum: { lpoValue: true },
      _count: { _all: true },
    }),
    prisma.deal.groupBy({
      by: ["department"],
      where: { stage: "quoted", ...(inWindow ? { quoteDate: inWindow } : {}) },
      _sum: { quoteValue: true },
      _count: { _all: true },
    }),
    prisma.deal.groupBy({
      by: ["department"],
      where: { stage: "lost", ...(inWindow ? { updatedAt: inWindow } : {}) },
      _count: { _all: true },
    }),
    prisma.target.findMany({ where: { year: now.getFullYear() } }),
  ]);

  const byDept = new Map<Department, DeptReport>();
  for (const d of PRODUCING_DEPARTMENTS) {
    byDept.set(d, {
      department: d,
      revenue: 0, gp: 0, gpPercent: 0, invoiceCount: 0,
      booked: 0, bookedCount: 0,
      pipeline: 0, pipelineCount: 0, lostCount: 0,
      revenueTarget: 0, gpTarget: 0, revenueAchieved: 0, gpAchieved: 0,
    });
  }

  for (const r of invoiced) {
    const d = byDept.get(r.department);
    if (!d) continue;
    d.revenue = Number(r._sum.invoiceValue ?? 0);
    d.gp = Number(r._sum.invoiceGp ?? 0);
    d.invoiceCount = r._count._all;
  }
  for (const r of booked) {
    const d = byDept.get(r.department);
    if (!d) continue;
    d.booked = Number(r._sum.lpoValue ?? 0);
    d.bookedCount = r._count._all;
  }
  for (const r of pipeline) {
    const d = byDept.get(r.department);
    if (!d) continue;
    d.pipeline = Number(r._sum.quoteValue ?? 0);
    d.pipelineCount = r._count._all;
  }
  for (const r of lost) {
    const d = byDept.get(r.department);
    if (d) d.lostCount = r._count._all;
  }
  for (const t of targets) {
    const d = byDept.get(t.department);
    if (!d) continue;
    d.revenueTarget = Number(t.revenueTarget) * targetFraction;
    d.gpTarget = Number(t.gpTarget) * targetFraction;
  }

  const list = PRODUCING_DEPARTMENTS.map((d) => {
    const r = byDept.get(d)!;
    r.gpPercent = r.revenue > 0 ? (r.gp / r.revenue) * 100 : 0;
    r.revenueAchieved = pct(r.revenue, r.revenueTarget);
    r.gpAchieved = pct(r.gp, r.gpTarget);
    return r;
  });

  const totals = list.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      gp: acc.gp + r.gp,
      gpPercent: 0,
      invoiceCount: acc.invoiceCount + r.invoiceCount,
      booked: acc.booked + r.booked,
      bookedCount: acc.bookedCount + r.bookedCount,
      pipeline: acc.pipeline + r.pipeline,
      pipelineCount: acc.pipelineCount + r.pipelineCount,
      lostCount: acc.lostCount + r.lostCount,
      revenueTarget: acc.revenueTarget + r.revenueTarget,
      gpTarget: acc.gpTarget + r.gpTarget,
      revenueAchieved: 0,
      gpAchieved: 0,
    }),
    {
      revenue: 0, gp: 0, gpPercent: 0, invoiceCount: 0, booked: 0, bookedCount: 0,
      pipeline: 0, pipelineCount: 0, lostCount: 0, revenueTarget: 0, gpTarget: 0,
      revenueAchieved: 0, gpAchieved: 0,
    }
  );
  totals.gpPercent = totals.revenue > 0 ? (totals.gp / totals.revenue) * 100 : 0;
  totals.revenueAchieved = pct(totals.revenue, totals.revenueTarget);
  totals.gpAchieved = pct(totals.gp, totals.gpTarget);

  return { period, comparable, from, to, byDepartment: list, totals };
}
