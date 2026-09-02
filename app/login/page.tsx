import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function LoginPage() {
  // Already signed in? Skip the form.
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="brand-mark" style={{ fontSize: 22 }}>BMTC</div>
          <div className="brand-sub">Quotation &amp; LPO Live Control</div>
        </div>
        <div className="card">
          <h2 style={{ textAlign: "center" }}>Sign in</h2>
          <LoginForm />
        </div>
        <p className="muted" style={{ textAlign: "center", marginTop: 16 }}>
          Accounts are created by a manager. There is no public sign-up.
        </p>
      </div>
    </div>
  );
}
