import { redirect } from "next/navigation";
import { requireReadyUser, toActor } from "@/lib/auth";
import { isAdmin, isManager, isSalesAdmin } from "@/lib/permissions";

// Landing route: send each user to the one home that fits their job.
export default async function Home() {
  const user = await requireReadyUser();
  const actor = toActor(user);
  if (isAdmin(actor)) redirect("/admin/users");
  if (isManager(actor)) redirect("/dashboard");
  if (isSalesAdmin(actor)) redirect("/invoices");
  redirect("/lpos");
}
