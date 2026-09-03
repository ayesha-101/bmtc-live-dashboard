import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, toActor } from "@/lib/auth";
import { canViewManagerDashboard } from "@/lib/permissions";
import { buildReport, isPeriodKey } from "@/lib/overview";

// Programmatic manager overview. Same server-side guard as the dashboard:
// non-managers get 403, never data. Shares buildReport() with the page so
// the two can never drift. ?period=month|year|todate (default month).
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewManagerDashboard(toActor(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = request.nextUrl.searchParams.get("period") ?? undefined;
  const period = isPeriodKey(raw) ? raw : "month";
  const report = await buildReport(period);

  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
