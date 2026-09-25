import argon2 from "argon2"

/**
 * Password hashing — Argon2id via the argon2 package (argon2id is the OWASP
 * recommendation as of the latest guidance: memory-hard, resistant to GPU
 * cracking, default parameters are already sensible — no tuning needed).
 *
 * Phase 05 replaces the clearly-labelled placeholder hashes from the seed
 * with real Argon2 hashes (see server/src/db/seed.js).
 */

export async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id })
}

/**
 * Constant-time verification. A malformed or truncated stored hash never
 * throws — it simply fails verification.
 */
export async function verifyPassword(password, storedHash) {
  try {
    return await argon2.verify(storedHash, password)
  } catch {
    return false
  }
}
