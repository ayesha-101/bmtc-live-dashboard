"use client";

import { useActionState, useEffect, useRef } from "react";
import { createLpoAction, type CreateLpoResult } from "./actions";

const initial: CreateLpoResult = {};

export default function NewLpoForm() {
  const [state, formAction, pending] = useActionState(createLpoAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form action={formAction} ref={formRef}>
      {state.error && <div className="note error">{state.error}</div>}
      {state.success && <div className="note success">LPO saved.</div>}

      <div className="field">
        <label htmlFor="projectName">Project name</label>
        <input id="projectName" name="projectName" required maxLength={200} placeholder="e.g. Marina Tower — external lighting" />
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="amount">Amount (AED)</label>
          <input id="amount" name="amount" type="number" step="0.01" min="0" required placeholder="0.00" />
        </div>
        <div className="field">
          <label htmlFor="margin">Margin (AED) — visible to managers only</label>
          <input id="margin" name="margin" type="number" step="0.01" min="0" placeholder="optional" />
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="customerLpoRef">Customer LPO reference</label>
          <input id="customerLpoRef" name="customerLpoRef" maxLength={120} placeholder="optional" />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue="quoted">
            <option value="quoted">Quoted</option>
            <option value="converted_lpo">Converted (LPO)</option>
          </select>
        </div>
      </div>

      <button type="submit" className="btn primary" disabled={pending}>
        {pending ? "Saving…" : "Save LPO"}
      </button>
    </form>
  );
}
