"use client";

import { useActionState, useEffect, useRef } from "react";
import { createShowroomSaleAction, type DealResult } from "./actions";

const initial: DealResult = {};
const today = () => new Date().toISOString().slice(0, 10);

// Showroom has no quotation and no invoicing step — one form, one step.
export default function NewShowroomForm() {
  const [state, formAction, pending] = useActionState(createShowroomSaleAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form action={formAction} ref={formRef}>
      {state.error && <div className="note error">{state.error}</div>}
      {state.success && <div className="note success">Sale recorded.</div>}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="lpoDate">Date</label>
          <input id="lpoDate" name="lpoDate" type="date" defaultValue={today()} required />
        </div>
        <div className="field">
          <label htmlFor="customer">Customer</label>
          <input id="customer" name="customer" required maxLength={160} placeholder="e.g. Gulf Interiors" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="projectName">Description / items</label>
        <input id="projectName" name="projectName" required maxLength={200} placeholder="e.g. Indoor lighting fixtures — 40 pcs" />
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="lpoRef">LPO reference</label>
          <input id="lpoRef" name="lpoRef" required maxLength={120} placeholder="customer LPO / PO number" />
        </div>
        <div className="field">
          <label htmlFor="salesPerson">Sales person</label>
          <input id="salesPerson" name="salesPerson" maxLength={120} placeholder="optional" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="brand">Brand(s)</label>
        <input id="brand" name="brand" maxLength={160} placeholder="e.g. Philips, Schneider" />
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="lpoValue">Value (AED)</label>
          <input id="lpoValue" name="lpoValue" type="number" step="0.01" min="0" required placeholder="0.00" />
        </div>
        <div className="field">
          <label htmlFor="lpoGp">GP (AED)</label>
          <input id="lpoGp" name="lpoGp" type="number" step="0.01" min="0" placeholder="0.00" />
        </div>
      </div>

      <button type="submit" className="btn primary" disabled={pending}>
        {pending ? "Saving…" : "Record sale"}
      </button>
    </form>
  );
}
