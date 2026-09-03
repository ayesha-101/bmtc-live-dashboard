import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEPARTMENT_LABELS, PRODUCING_DEPARTMENTS, formatAED } from "@/lib/format";
import AppShell from "@/app/components/app-shell";
import TargetRow from "./target-row";

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const user = await requireManager();
  const { year: rawYear } = await searchParams;
  const thisYear = new Date().getFullYear();
  const parsed = Number(rawYear);
  const year = Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : thisYear;

  const targets = await prisma.target.findMany({ where: { year } });
  const byDept = new Map(targets.map((t) => [t.department, t]));

  const totalRevenue = targets.reduce((s, t) => s + Number(t.revenueTarget), 0);
  const totalGp = targets.reduce((s, t) => s + Number(t.gpTarget), 0);

  return (
    <AppShell user={user} active="targets">
      <div className="section-gap">
        <h1>Targets — {year}</h1>
        <p className="muted">
          Set each department&apos;s annual revenue and GP target. The dashboard
          compares actuals against the full figure for the year view, and
          against one twelfth of it for the month view.
        </p>
      </div>

      <div className="grid kpi-grid section-gap">
        <div className="card">
          <div className="kpi-label">Company revenue target</div>
          <div className="kpi-value">{formatAED(totalRevenue)}</div>
          <div className="kpi-sub">{year}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Company GP target</div>
          <div className="kpi-value">{formatAED(totalGp)}</div>
          <div className="kpi-sub">
            {totalRevenue > 0 ? `${((totalGp / totalRevenue) * 100).toFixed(1)}% margin` : "—"}
          </div>
        </div>
      </div>

      {PRODUCING_DEPARTMENTS.map((d) => {
        const t = byDept.get(d);
        return (
          <TargetRow
            key={d}
            department={d}
            label={DEPARTMENT_LABELS[d]}
            year={year}
            revenueTarget={t ? Number(t.revenueTarget) : null}
            gpTarget={t ? Number(t.gpTarget) : null}
          />
        );
      })}
    </AppShell>
  );
}
