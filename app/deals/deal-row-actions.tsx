"use client";

import { useState, useTransition } from "react";
import type { DealStage } from "@prisma/client";
import { quoteDealAction, recordLpoAction, sendToInvoicingAction, markLostAction } from "./actions";

type Panel = null | "quote" | "lpo" | "lost";
const today = () => new Date().toISOString().slice(0, 10);

export default function DealRowActions({ id, stage }: { id: number; stage: DealStage }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [reason, setReason] = useState("");

  function submit(fn: (id: number, fd: FormData) => Promise<DealResultLike>) {
    return (formData: FormData) => {
      setError(null);
      startTransition(async () => {
        const res = await fn(id, formData);
        if (res.error) setError(res.error);
        else setPanel(null);
      });
    };
  }

  function simple(fn: () => Promise<DealResultLike>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else setPanel(null);
    });
  }

  if (panel === "quote") {
    return (
      <form action={submit(quoteDealAction)} style={{ minWidth: 240 }}>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Quote ref #</label>
          <input name="quoteRef" required maxLength={120} autoFocus />
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Quote date</label>
          <input name="quoteDate" type="date" defaultValue={today()} required />
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Quote value (AED)</label>
          <input name="quoteValue" type="number" step="0.01" min="0" required />
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Quote GP (AED)</label>
          <input name="quoteGp" type="number" step="0.01" min="0" />
        </div>
        <Buttons pending={pending} onCancel={() => setPanel(null)} label="Save quotation" />
        {error && <div className="note error" style={{ marginTop: 8, marginBottom: 0 }}>{error}</div>}
      </form>
    );
  }

  if (panel === "lpo") {
    return (
      <form action={submit(recordLpoAction)} style={{ minWidth: 240 }}>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>LPO ref #</label>
          <input name="lpoRef" required maxLength={120} autoFocus />
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>LPO date</label>
          <input name="lpoDate" type="date" defaultValue={today()} required />
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>LPO value (AED)</label>
          <input name="lpoValue" type="number" step="0.01" min="0" required />
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>LPO GP (AED)</label>
          <input name="lpoGp" type="number" step="0.01" min="0" />
        </div>
        <Buttons pending={pending} onCancel={() => setPanel(null)} label="Record LPO" />
        {error && <div className="note error" style={{ marginTop: 8, marginBottom: 0 }}>{error}</div>}
      </form>
    );
  }

  if (panel === "lost") {
    return (
      <div style={{ minWidth: 220 }}>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Reason for loss</label>
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn danger" disabled={pending} onClick={() => simple(() => markLostAction(id, reason))}>
            {pending ? "Saving…" : "Confirm lost"}
          </button>
          <button className="btn" disabled={pending} onClick={() => setPanel(null)}>Cancel</button>
        </div>
        {error && <div className="note error" style={{ marginTop: 8, marginBottom: 0 }}>{error}</div>}
      </div>
    );
  }

  const buttons: React.ReactNode[] = [];
  if (stage === "enquiry") {
    buttons.push(<button key="q" className="btn primary" disabled={pending} onClick={() => setPanel("quote")}>Add quotation</button>);
  }
  if (stage === "quoted") {
    buttons.push(<button key="l" className="btn primary" disabled={pending} onClick={() => setPanel("lpo")}>Record LPO</button>);
  }
  if (stage === "lpo_received") {
    buttons.push(
      <button key="s" className="btn primary" disabled={pending} onClick={() => simple(() => sendToInvoicingAction(id))}>
        Send to invoicing
      </button>
    );
  }
  if (stage === "enquiry" || stage === "quoted") {
    buttons.push(<button key="x" className="btn danger" disabled={pending} onClick={() => setPanel("lost")}>Lost</button>);
  }
  if (buttons.length === 0) return <span className="muted">—</span>;

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {buttons}
      {error && <div className="note error" style={{ width: "100%", margin: 0 }}>{error}</div>}
    </div>
  );
}

interface DealResultLike { error?: string; success?: boolean }

function Buttons({ pending, onCancel, label }: { pending: boolean; onCancel: () => void; label: string }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button type="submit" className="btn primary" disabled={pending}>{pending ? "Saving…" : label}</button>
      <button type="button" className="btn" disabled={pending} onClick={onCancel}>Cancel</button>
    </div>
  );
}
