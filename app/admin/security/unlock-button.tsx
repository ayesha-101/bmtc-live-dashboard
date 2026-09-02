"use client";

import { useState, useTransition } from "react";
import { unlockAccountAction } from "./actions";

export default function UnlockButton({ userId }: { userId: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function unlock() {
    setError(null);
    startTransition(async () => {
      const res = await unlockAccountAction(userId);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div>
      <button className="btn" disabled={pending} onClick={unlock}>
        {pending ? "Unlocking…" : "Unlock / reset"}
      </button>
      {error && <div className="note error" style={{ marginTop: 6, marginBottom: 0 }}>{error}</div>}
    </div>
  );
}
