"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordResult } from "./actions";

const initial: ChangePasswordResult = {};

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={formAction}>
      {state.error && <div className="note error">{state.error}</div>}
      <div className="field">
        <label htmlFor="currentPassword">Current password</label>
        <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="newPassword">New password (at least 10 characters)</label>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required />
      </div>
      <div className="field">
        <label htmlFor="confirmPassword">Confirm new password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </div>
      <button type="submit" className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
