"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createUserAction, type CreateUserResult } from "./actions";
import { ALL_DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/format";
import { INITIAL_PASSWORD } from "@/lib/password";

const initial: CreateUserResult = {};


export default function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<"employee" | "manager" | "admin">("employee");

  useEffect(() => {
    if (state.email) {
      formRef.current?.reset();
      setRole("employee");
    }
  }, [state.email]);

  return (
    <form action={formAction} ref={formRef}>
      {state.error && <div className="note error">{state.error}</div>}
      {state.email && (
        <div className="note success">
          Account <b>{state.email}</b> created. They sign in with the standard
          first password <b className="mono">{INITIAL_PASSWORD}</b> and are asked
          to choose their own straight away.
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="email">Email (this is what they sign in with)</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="e.g. ahmed@bmtc.com"
          />
        </div>
        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <input id="fullName" name="fullName" required placeholder="e.g. Ahmed Hassan" />
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="role">Role</label>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="employee">Employee — creates LPOs / invoices</option>
            <option value="manager">Manager (BM) — read-only dashboard</option>
            <option value="admin">Admin — accounts &amp; security only</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="department">
            Department {role !== "employee" && <span className="muted">(not used for this role)</span>}
          </label>
          <select id="department" name="department" defaultValue="electrical">
            {ALL_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 4, marginBottom: 12 }}>
        Everyone starts on <b className="mono">{INITIAL_PASSWORD}</b> and must
        replace it at first sign-in. Create the account when you hand it over,
        not in advance — Security lists anyone still on it.
      </p>
      <button type="submit" className="btn primary" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
