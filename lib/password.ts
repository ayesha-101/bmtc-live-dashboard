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

// A reasonably strong one-time password for a freshly created account.
// Shown once in the admin UI; the user is forced to change it on first
// login.
export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
