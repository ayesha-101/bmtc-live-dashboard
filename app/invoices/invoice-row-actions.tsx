"use client";

import { useState, useTransition } from "react";
import { markInvoicedAction } from "./actions";

export default function InvoiceRowActions({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function done() {
    setError(null);
    startTransition(async () => {
      const res = await markInvoicedAction(id);
      if (res.error) {
        setError(res.error);
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="btn primary" disabled={pending} onClick={done}>
          {pending ? "Saving…" : "Confirm"}
        </button>
        <button className="btn" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div>
      <button className="btn primary" disabled={pending} onClick={() => setConfirming(true)}>
        Done ✓
      </button>
      {error && <div className="note error" style={{ marginTop: 6, marginBottom: 0 }}>{error}</div>}
    </div>
  );
}
