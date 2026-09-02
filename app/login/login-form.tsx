"use client";

import { useActionState } from "react";
import { loginAction, type LoginResult } from "./actions";

const initial: LoginResult = {};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction}>
      {state.error && <div className="note error">{state.error}</div>}
      <div className="field">
        <label htmlFor="email">Email</label>
        {/* type="text", not "email": the browser must not block sign-in for
            an account created before the email switch. */}
        <input
          id="email"
          name="email"
          type="text"
          inputMode="email"
          autoComplete="email"
          autoFocus
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button type="submit" className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
