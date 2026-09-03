"use client";

import { useState, useTransition } from "react";
import type { Department, UserRole } from "@prisma/client";
import { toggleActiveAction, resetPasswordAction, updateUserAction, deleteUserAction } from "./actions";
import { ALL_DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/format";
import { INITIAL_PASSWORD } from "@/lib/password";



export default function UserRowActions({
  userId,
  isActive,
  isSelf,
  role,
  department,
  email,
  fullName,
}: {
  userId: number;
  isActive: boolean;
  isSelf: boolean;
  role: UserRole;
  department: Department;
  email: string;
  fullName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [didReset, setDidReset] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftRole, setDraftRole] = useState<UserRole>(role);

  function toggle() {
    setError(null);
    setDidReset(false);
    startTransition(async () => {
      const res = await toggleActiveAction(userId);
      if (res.error) setError(res.error);
    });
  }

  function reset() {
    if (!confirm(`Reset this user's password back to ${INITIAL_PASSWORD}? Their current password stops working immediately.`)) return;
    setError(null);
    setDidReset(false);
    startTransition(async () => {
      const res = await resetPasswordAction(userId);
      if (res.error) setError(res.error);
      else if (res.reset) setDidReset(true);
    });
  }

  function save(formData: FormData) {
    setError(null);
    setDidReset(false);
    startTransition(async () => {
      const res = await updateUserAction(userId, formData);
      if (res.error) setError(res.error);
      else setEditing(false);
    });
  }

  function remove() {
    if (!confirm("Permanently delete this account? This cannot be undone.")) return;
    setError(null);
    setDidReset(false);
    startTransition(async () => {
      const res = await deleteUserAction(userId);
      if (res.error) setError(res.error);
    });
  }

  if (editing) {
    return (
      <form action={save} style={{ minWidth: 260 }}>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Full name</label>
          <input name="fullName" defaultValue={fullName} required maxLength={120} />
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Email (used to sign in)</label>
          <input name="email" type="email" defaultValue={email} required />
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Role</label>
          {/* A disabled control is not submitted by the browser, which would
              send role=null. On your own row the picker is disabled for
              safety, so the current role travels in a hidden field. */}
          <select
            name={isSelf ? undefined : "role"}
            value={draftRole}
            disabled={isSelf}
            onChange={(e) => setDraftRole(e.target.value as UserRole)}
          >
            <option value="employee">Employee</option>
            <option value="manager">Manager (BM) — dashboard only</option>
            <option value="admin">Admin — accounts &amp; security</option>
          </select>
          {isSelf && <input type="hidden" name="role" value={role} />}
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>
            Department{" "}
            {draftRole !== "employee" && <span className="muted">(unused for this role)</span>}
          </label>
          <select name="department" defaultValue={department}>
            {ALL_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
            ))}
          </select>
        </div>
        {isSelf && (
          <p className="muted" style={{ marginTop: 0, marginBottom: 8 }}>
            You can correct your own email, but not your own role.
          </p>
        )}
        {draftRole === "employee" && (
          <p className="muted" style={{ marginTop: 0, marginBottom: 8 }}>
            Pick <b>Sales Admin</b> as the department to give this person the
            Pending Invoices queue.
          </p>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn" disabled={pending} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
        {error && <div className="note error" style={{ marginTop: 8, marginBottom: 0 }}>{error}</div>}
      </form>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button className="btn" disabled={pending} onClick={() => { setDraftRole(role); setEditing(true); }}>
        Edit
      </button>
      {!isSelf && (
        <>
          <button className="btn" disabled={pending} onClick={toggle}>
            {isActive ? "Deactivate" : "Reactivate"}
          </button>
          <button className="btn" disabled={pending} onClick={reset}>
            Reset password
          </button>
          <button className="btn danger" disabled={pending} onClick={remove}>
            Delete
          </button>
        </>
      )}
      {didReset && (
        <div className="note success" style={{ width: "100%", margin: 0 }}>
          Password reset to <b className="mono">{INITIAL_PASSWORD}</b> — they
          must change it at next sign-in.
        </div>
      )}
      {error && <div className="note error" style={{ width: "100%", margin: 0 }}>{error}</div>}
    </div>
  );
}
