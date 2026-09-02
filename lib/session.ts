import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { Department, UserRole } from "@prisma/client";

export const SESSION_COOKIE = "bmtc_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours
const MIN_SECRET_LENGTH = 32;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `AUTH_SECRET is missing or too short (need >= ${MIN_SECRET_LENGTH} chars). Set it in the environment.`
    );
  }
  return new TextEncoder().encode(secret);
}

// The session carries only identity + coarse role/department. Every
// permission decision still re-reads the live user row from the DB — the
// cookie is never the source of truth for access (see lib/auth.ts).
export interface SessionPayload extends JWTPayload {
  userId: number;
  role: UserRole;
  department: Department;
  name: string;
}

export async function createSession(data: {
  userId: number;
  role: UserRole;
  department: Department;
  name: string;
}): Promise<void> {
  const token = await new SignJWT({
    userId: data.userId,
    role: data.role,
    department: data.department,
    name: data.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
