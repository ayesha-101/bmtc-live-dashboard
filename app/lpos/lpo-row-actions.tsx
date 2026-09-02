"use client";

import { useState, useTransition } from "react";
import type { LpoStatus } from "@prisma/client";
import { convertToLpoAction, sendToInvoicingAction, markLostAction } from "./actions";

export default function LpoRowActions({ id, status }: { id: number; status: LpoStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: (id: number) => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn(id);
      if (res.error) setError(res.error);
    });
  }

  const buttons: React.ReactNode[] = [];
  if (status === "quoted") {
    buttons.push(
      <button key="c" className="btn" disabled={pending} onClick={() => run(convertToLpoAction)}>
        Convert to LPO
      </button>
    );
  }
  if (status === "converted_lpo") {
    buttons.push(
      <button key="s" className="btn primary" disabled={pending} onClick={() => run(sendToInvoicingAction)}>
        Send to invoicing
      </button>
    );
  }
  if (status === "quoted" || status === "converted_lpo") {
    buttons.push(
      <button key="l" className="btn danger" disabled={pending} onClick={() => run(markLostAction)}>
        Lost
      </button>
    );
  }

  if (buttons.length === 0) return <span className="muted">—</span>;

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {buttons}
      {error && <div className="note error" style={{ margin: 0, width: "100%" }}>{error}</div>}
    </div>
  );
}
