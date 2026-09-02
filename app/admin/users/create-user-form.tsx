"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUserAction, type CreateUserResult } from "./actions";
import { DEPARTMENT_LABELS } from "@/lib/format";

const initial: CreateUserResult = {};
const DEPARTMENTS = ["electrical", "urban", "lightning", "water", "sales_admin"] as const;

export default function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.tempPassword) formRef.current?.reset();
  }, [state.tempPassword]);

  return (
    <form action={formAction} ref={formRef}>
      {state.error && <div className="note error">{state.error}</div>}
      {state.tempPassword && (
        <div className="note success">
          Account <b>{state.username}</b> created. One-time password (shown once):{" "}
          <b className="mono">{state.tempPassword}</b>. Share it securely — they must
          change it at first sign-in.
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="username">Username</label>
          <input id="username" name="username" required placeholder="e.g. a.hassan" />
        </div>
        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <input id="fullName" name="fullName" required placeholder="e.g. Ahmed Hassan" />
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="department">Department</label>
          <select id="department" name="department" defaultValue="electrical">
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue="employee">
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
          </select>
        </div>
      </div>

      <button type="submit" className="btn primary" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
