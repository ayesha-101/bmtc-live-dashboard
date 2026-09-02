"use client";

import { useState, useTransition } from "react";
import { toggleActiveAction, resetPasswordAction } from "./actions";

export default function UserRowActions({
  userId,
  isActive,
  isSelf,
}: {
  userId: number;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [temp, setTemp] = useState<string | null>(null);

  if (isSelf) return <span className="muted">— you —</span>;

  function toggle() {
    setError(null);
    setTemp(null);
    startTransition(async () => {
      const res = await toggleActiveAction(userId);
      if (res.error) setError(res.error);
    });
  }

  function reset() {
    if (!confirm("Reset this user's password? Their current password stops working immediately.")) return;
    setError(null);
    setTemp(null);
    startTransition(async () => {
      const res = await resetPasswordAction(userId);
      if (res.error) setError(res.error);
      else if (res.tempPassword) setTemp(res.tempPassword);
    });
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button className="btn" disabled={pending} onClick={toggle}>
        {isActive ? "Deactivate" : "Reactivate"}
      </button>
      <button className="btn" disabled={pending} onClick={reset}>
        Reset password
      </button>
      {temp && (
        <div className="note success" style={{ width: "100%", margin: 0 }}>
          New one-time password: <b className="mono">{temp}</b>
        </div>
      )}
      {error && <div className="note error" style={{ width: "100%", margin: 0 }}>{error}</div>}
    </div>
  );
}
