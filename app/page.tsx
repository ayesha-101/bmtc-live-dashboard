import { redirect } from "next/navigation";
import { requireReadyUser, toActor } from "@/lib/auth";
import { isManager, isSalesAdmin } from "@/lib/permissions";

// Landing route: send each user to the home that fits their access.
export default async function Home() {
  const user = await requireReadyUser();
  const actor = toActor(user);
  if (isManager(actor)) redirect("/dashboard");
  if (isSalesAdmin(actor)) redirect("/invoices");
  redirect("/lpos");
}
