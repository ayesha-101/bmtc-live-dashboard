import bcrypt from "bcryptjs";

const ROUNDS = 12;

// A valid dummy hash to compare against when an account doesn't exist or
// is inactive, so login always spends the same bcrypt time regardless of
// whether the username is real — no timing side-channel for enumeration.
// Computed once at module load so it's a genuine, well-formed bcrypt hash
// (comparing against a malformed string would return early and defeat the
// whole point).
export const DUMMY_HASH = bcrypt.hashSync("timing-safe-dummy-value", ROUNDS);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * The password every new account starts on. The user is forced to replace
 * it the first time they sign in (mustChangePassword), and the change form
 * refuses to accept this same value again.
 *
 * Because it is the same for everyone, it is only safe for the short gap
 * between creating an account and the person signing in — create accounts
 * as you hand them over, not in advance. Admin -> Security lists anyone
 * still sitting on it.
 */
export const INITIAL_PASSWORD = process.env.INITIAL_PASSWORD || "BMTC@2026";
