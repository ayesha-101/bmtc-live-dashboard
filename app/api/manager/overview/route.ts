import { NextResponse } from "next/server";
import { getCurrentUser, toActor } from "@/lib/auth";
import { canViewManagerDashboard } from "@/lib/permissions";
import { computeOverview } from "@/lib/overview";

// Programmatic manager overview (plan Phase 4/5). Same server-side guard as
// the dashboard page: non-managers get 403, never data. Kept in sync with
// the dashboard via the shared computeOverview().
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewManagerDashboard(toActor(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const overview = await computeOverview();
  return NextResponse.json(overview, {
    headers: { "Cache-Control": "no-store" },
  });
}
