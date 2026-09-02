"use client";

import { useState, useTransition } from "react";
import { verifyChainAction } from "./actions";

type State =
  | { kind: "idle" }
  | { kind: "ok"; total: number }
  | { kind: "broken"; id: number; reason: string; total: number }
  | { kind: "error"; message: string };

export default function ChainCard({ total }: { total: number }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<State>({ kind: "idle" });

  function verify() {
    startTransition(async () => {
      const res = await verifyChainAction();
      if (res.error) setState({ kind: "error", message: res.error });
      else if (res.valid) setState({ kind: "ok", total: res.total ?? 0 });
      else
        setState({
          kind: "broken",
          id: res.brokenAtId ?? 0,
          reason: res.reason ?? "Unknown mismatch.",
          total: res.total ?? 0,
        });
    });
  }

  return (
    <div className="card section-gap">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Audit chain integrity</h2>
        <button className="btn primary" disabled={pending} onClick={verify}>
          {pending ? "Verifying…" : "Verify chain"}
        </button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Every audit entry is hash-linked to the one before it, like a
        blockchain. Editing or deleting any past entry — even directly in the
        database — breaks the chain, and this check reports exactly where.
        Currently <b>{total}</b> linked entr{total === 1 ? "y" : "ies"}.
      </p>

      {state.kind === "ok" && (
        <div className="note success" style={{ marginBottom: 0 }}>
          ✓ Chain intact — all {state.total} entries re-hashed and matched. No
          record has been altered.
        </div>
      )}
      {state.kind === "broken" && (
        <div className="note error" style={{ marginBottom: 0 }}>
          ✗ TAMPERING DETECTED at entry #{state.id} of {state.total}. {state.reason}
        </div>
      )}
      {state.kind === "error" && (
        <div className="note error" style={{ marginBottom: 0 }}>{state.message}</div>
      )}
    </div>
  );
}
