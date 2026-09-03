"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createDealAction, type DealResult } from "./actions";

const initial: DealResult = {};
const today = () => new Date().toISOString().slice(0, 10);

export default function NewDealForm() {
  const [state, formAction, pending] = useActionState(createDealAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [withQuote, setWithQuote] = useState(false);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setWithQuote(false);
    }
  }, [state.success]);

  return (
    <form action={formAction} ref={formRef}>
      {state.error && <div className="note error">{state.error}</div>}
      {state.success && <div className="note success">Saved.</div>}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="enquiryDate">Enquiry received date</label>
          <input id="enquiryDate" name="enquiryDate" type="date" defaultValue={today()} required />
        </div>
        <div className="field">
          <label htmlFor="customer">Customer</label>
          <input id="customer" name="customer" required maxLength={160} placeholder="e.g. Al Naboodah Contracting" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="projectName">Project name</label>
        <input id="projectName" name="projectName" required maxLength={200} placeholder="e.g. Marina Tower — external lighting" />
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="salesPerson">Sales person</label>
          <input id="salesPerson" name="salesPerson" maxLength={120} placeholder="optional" />
        </div>
        <div className="field">
          <label htmlFor="deResponsible">D&amp;E responsible</label>
          <input id="deResponsible" name="deResponsible" maxLength={120} placeholder="optional" />
        </div>
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, margin: "4px 0 14px" }}>
        <input
          type="checkbox"
          checked={withQuote}
          onChange={(e) => setWithQuote(e.target.checked)}
          style={{ width: "auto" }}
        />
        Quotation already issued — add it now
      </label>

      {withQuote && (
        <div style={{ borderLeft: "3px solid var(--brand)", paddingLeft: 14, marginBottom: 14 }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="quoteRef">Quote ref #</label>
              <input id="quoteRef" name="quoteRef" maxLength={120} placeholder="e.g. BMTC-Q-2026-114" />
            </div>
            <div className="field">
              <label htmlFor="quoteDate">Quote date</label>
              <input id="quoteDate" name="quoteDate" type="date" defaultValue={today()} />
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="quoteValue">Quote value (AED)</label>
              <input id="quoteValue" name="quoteValue" type="number" step="0.01" min="0" placeholder="0.00" />
            </div>
            <div className="field">
              <label htmlFor="quoteGp">Quote GP (AED)</label>
              <input id="quoteGp" name="quoteGp" type="number" step="0.01" min="0" placeholder="0.00" />
            </div>
          </div>
        </div>
      )}

      <button type="submit" className="btn primary" disabled={pending}>
        {pending ? "Saving…" : "Save enquiry"}
      </button>
    </form>
  );
}
