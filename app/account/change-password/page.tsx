import { requireUser } from "@/lib/auth";
import ChangePasswordForm from "./change-password-form";

export default async function ChangePasswordPage() {
  const user = await requireUser();
  const forced = user.mustChangePassword;

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="brand-mark" style={{ fontSize: 22 }}>BMTC</div>
          <div className="brand-sub">Account security</div>
        </div>
        <div className="card">
          <h2 style={{ textAlign: "center" }}>{forced ? "Set your password" : "Change password"}</h2>
          {forced && (
            <div className="note info">
              This is your first sign-in. Choose a new password before you continue.
            </div>
          )}
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
