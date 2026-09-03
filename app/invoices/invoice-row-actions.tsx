"use client";

import { useState, useTransition } from "react";
import { markInvoicedAction } from "./actions";

const today = () => new Date().toISOString().slice(0, 10);

export default function InvoiceRowActions({
  dealId,
  suggestedValue,
  suggestedGp,
}: {
  dealId: number;
  suggestedValue: number | null;
  suggestedGp: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await markInvoicedAction(dealId, formData);
      if (res.error) setError(res.error);
      else setOpen(false);
    });
  }

  if (!open) {
    return (
      <div>
        <button className="btn primary" disabled={pending} onClick={() => setOpen(true)}>
          Invoice ✓
        </button>
        {error && <div className="note error" style={{ marginTop: 6, marginBottom: 0 }}>{error}</div>}
      </div>
    );
  }

  return (
    <form action={submit} style={{ minWidth: 230 }}>
      <div className="field" style={{ marginBottom: 8 }}>
        <label>Invoice number</label>
        <input name="invoiceRef" required maxLength={120} autoFocus />
      </div>
      <div className="field" style={{ marginBottom: 8 }}>
        <label>Invoice date</label>
        <input name="invoiceDate" type="date" defaultValue={today()} required />
      </div>
      <div className="field" style={{ marginBottom: 8 }}>
        <label>Invoice value (AED)</label>
        <input
          name="invoiceValue"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={suggestedValue ?? undefined}
        />
      </div>
      <div className="field" style={{ marginBottom: 8 }}>
        <label>Invoice GP (AED)</label>
        <input name="invoiceGp" type="number" step="0.01" min="0" defaultValue={suggestedGp ?? undefined} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "Saving…" : "Confirm invoice"}
        </button>
        <button type="button" className="btn" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error && <div className="note error" style={{ marginTop: 8, marginBottom: 0 }}>{error}</div>}
    </form>
  );
}
