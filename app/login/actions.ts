"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { verifyPassword, DUMMY_HASH } from "@/lib/password";
import { loginSchema } from "@/lib/validation";
import { rateLimit, sweepRateLimiter } from "@/lib/ratelimit";

export interface LoginResult {
  error?: string;
}

const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;

// One deliberately vague message for every failure — wrong user, wrong
// password, or locked account all look identical, so the form can't be
// used to discover which usernames exist.
const GENERIC_ERROR = "Incorrect email or password.";

export async function loginAction(_prev: LoginResult, formData: FormData): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: GENERIC_ERROR };
  const { email, password } = parsed.data;

  // Per-instance throttle in front of the DB lockout.
  sweepRateLimiter();
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const limit = rateLimit(`login:${ip}`);
  if (!limit.ok) {
    return { error: `Too many attempts. Try again in ${limit.retryAfterSec}s.` };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Account currently locked? Still burn a bcrypt compare so the timing
  // matches the normal path, then return the same generic error.
  const now = new Date();
  const isLocked = !!user?.lockedUntil && user.lockedUntil > now;

  // Always run bcrypt (against a dummy hash when there's no usable
  // account) so response time doesn't reveal whether the user exists.
  const hashToCheck = user && user.isActive && !isLocked ? user.passwordHash : DUMMY_HASH;
  const passwordOk = await verifyPassword(password, hashToCheck);

  if (!user || !user.isActive || isLocked || !passwordOk) {
    // Count the failure against a real, active, unlocked account only.
    if (user && user.isActive && !isLocked) {
      const failed = user.failedAttempts + 1;
      const lock = failed >= LOCK_THRESHOLD;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
    }
    return { error: GENERIC_ERROR };
  }

  // Success — clear the failure counters and open a session.
  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null },
  });
  await createSession({
    userId: user.id,
    role: user.role,
    department: user.department,
    name: user.fullName,
  });

  redirect(user.mustChangePassword ? "/account/change-password" : "/");
}
