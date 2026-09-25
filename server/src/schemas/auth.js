import { z } from "zod"

/**
 * Authentication request validation. `.strict()` here (unlike the property
 * body schemas) is deliberate: a stray `role` or `password2` field must not
 * be silently ignored — auth input is a security boundary.
 */

const email = () =>
  z.string()
    .trim()
    .toLowerCase()
    .email("must be a valid email address")
    .max(254)

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "name is required").max(100),
    email: email(),
    password: z
      .string()
      .min(8, "password must be at least 8 characters")
      .max(128, "password must be at most 128 characters")
      .regex(/[A-Za-z]/, "password must contain a letter")
      .regex(/\d/, "password must contain a number"),
  })
  .strict()

export const loginSchema = z
  .object({
    email: email(),
    password: z.string().min(1, "password is required").max(128),
  })
  .strict()

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1, "refreshToken is required").max(512),
  })
  .strict()
