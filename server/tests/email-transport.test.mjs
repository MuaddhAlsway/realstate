import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import request from "supertest"
import { randomUUID } from "node:crypto"
import { app, getTestDb } from "./helpers.mjs"

/**
 * Email transport configuration tests (Phase 13).
 *
 * Locks the provider contract that production delivery depends on:
 *   - SMTP_SECURE must parse to a BOOLEAN (the `Boolean("false") === true`
 *     trap) — "false"/empty/unset all mean STARTTLS on 587,
 *   - SMTP_PORT defaults to 587 and parses numerically,
 *   - provider selection resolves the right transport for `log`/`smtp`/
 *     `resend` (+ the override hook),
 *   - the Resend HTTPS transport posts to api.resend.com with the key only in
 *     the Authorization header, resolves Resend's `id` as messageId, throws a
 *     sanitized error on non-2xx, and never leaks the key,
 *   - the delivery pipeline persists SENT with the provider message id and
 *     FAILED with the error when the transport rejects/fails.
 *
 * No real email ever leaves the process: the Resend transport drives a mocked
 * global fetch, and the pipeline runs through the transport override.
 *
 * NOTE on module registry: the app + its transport singleton are captured from
 * `helpers.mjs` FIRST (above, at file scope). The env-parsing tests re-import
 * modules via `vi.resetModules()`; the pipeline tests must keep using the
 * captured `setTransportOverride` so they still control the app's singleton.
 */

const { setTransportOverride } = await import(
  "../src/services/email/transports.js"
)

const ENV_VARS = [
  "EMAIL_PROVIDER",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM_EMAIL",
  "SMTP_FROM_NAME",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_FROM_NAME",
]

const originalEnv = {}

beforeAll(async () => {
  for (const key of ENV_VARS) originalEnv[key] = process.env[key]
  // Keep the shared IP rate-limit bucket from throttling the subscription
  // assertions in this file (same relaxation the newsletter suite applies).
  app.locals.rateLimitOptions = { windowMs: 60_000, max: 1000 }
  await cleanupTransportRows()
})

afterAll(async () => {
  delete app.locals.rateLimitOptions
  await cleanupTransportRows()
  for (const key of ENV_VARS) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

async function cleanupTransportRows() {
  const db = getTestDb()
  if (!db) return
  const { newsletterSubscribers, emailDeliveries } = await import(
    "../src/db/schema/index.js"
  )
  const { ilike } = await import("drizzle-orm")
  await db
    .delete(newsletterSubscribers)
    .where(ilike(newsletterSubscribers.email, "transport-test-%"))
  await db
    .delete(emailDeliveries)
    .where(ilike(emailDeliveries.recipientEmail, "transport-test-%"))
}

const uniqueEmail = (name) =>
  `transport-test-${name}-${randomUUID().slice(0, 8)}@estate.test`

/** Import env.js fresh with the current process.env values. */
async function loadEnv() {
  vi.resetModules()
  const mod = await import("../src/config/env.js")
  return mod
}

/** Import env.js + transports.js fresh with the current process.env values. */
async function loadTransports() {
  await loadEnv()
  const mod = await import("../src/services/email/transports.js")
  return mod
}

function setEnv(overrides) {
  for (const key of ENV_VARS) delete process.env[key]
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

// ── Phase 3 — boolean/port parsing ──────────────────────────────

describe("env parsing — SMTP_SECURE must be a boolean", () => {
  it("parses SMTP_SECURE=false to the boolean false (STARTTLS on 587)", async () => {
    setEnv({ EMAIL_PROVIDER: "smtp", SMTP_SECURE: "false", SMTP_PORT: "587" })
    const env = await loadEnv()
    expect(env.SMTP_SECURE).toBe(false)
    expect(env.SMTP_PORT).toBe(587)
  })

  it("parses SMTP_SECURE=true to the boolean true (implicit TLS on 465)", async () => {
    setEnv({ EMAIL_PROVIDER: "smtp", SMTP_SECURE: "true", SMTP_PORT: "465" })
    const env = await loadEnv()
    expect(env.SMTP_SECURE).toBe(true)
    expect(env.SMTP_PORT).toBe(465)
  })

  it("is case-insensitive for the literal true", async () => {
    setEnv({ EMAIL_PROVIDER: "smtp", SMTP_SECURE: "TRUE" })
    const env = await loadEnv()
    expect(env.SMTP_SECURE).toBe(true)
  })

  it("treats an empty/unset SMTP_SECURE as false (587)", async () => {
    setEnv({ EMAIL_PROVIDER: "smtp" })
    const env = await loadEnv()
    expect(env.SMTP_SECURE).toBe(false)
    expect(env.SMTP_PORT).toBe(587)
  })

  it("reads SMTP_PORT numerically and defaults to 587", async () => {
    setEnv({ EMAIL_PROVIDER: "smtp", SMTP_PORT: "465" })
    const env = await loadEnv()
    expect(env.SMTP_PORT).toBe(465)
    setEnv({ EMAIL_PROVIDER: "smtp" })
    const env2 = await loadEnv()
    expect(env2.SMTP_PORT).toBe(587)
  })
})

describe("env parsing — provider selection", () => {
  it("defaults to the log provider", async () => {
    setEnv({})
    const env = await loadEnv()
    expect(env.EMAIL_PROVIDER).toBe("log")
    expect(env.EMAIL_CONFIGURED).toBe(false)
    expect(env.EMAIL_LOG_TRANSPORT).toBe(true)
  })

  it("marks smtp as an active, configured provider", async () => {
    setEnv({ EMAIL_PROVIDER: "smtp", SMTP_HOST: "smtp.gmail.com" })
    const env = await loadEnv()
    expect(env.EMAIL_PROVIDER).toBe("smtp")
    expect(env.EMAIL_CONFIGURED).toBe(true)
    expect(env.EMAIL_LOG_TRANSPORT).toBe(false)
    expect(env.SMTP_HOST).toBe("smtp.gmail.com")
  })

  it("marks resend as an active, configured provider and reads its vars", async () => {
    setEnv({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM_EMAIL: "onboarding@resend.dev",
    })
    const env = await loadEnv()
    expect(env.EMAIL_PROVIDER).toBe("resend")
    expect(env.EMAIL_CONFIGURED).toBe(true)
    expect(env.EMAIL_LOG_TRANSPORT).toBe(false)
    expect(env.RESEND_API_KEY).toBe("re_test_key")
  })
})

// ── Phase 10 — provider transport selection ─────────────────────

describe("getTransport provider selection", () => {
  it("returns the log transport when unset", async () => {
    setEnv({})
    const { getTransport, logTransport } = await loadTransports()
    expect(getTransport()).toBe(logTransport)
  })

  it("returns the Nodemailer transport for EMAIL_PROVIDER=smtp", async () => {
    setEnv({ EMAIL_PROVIDER: "smtp", SMTP_HOST: "smtp.gmail.com" })
    const { getTransport, smtpTransport } = await loadTransports()
    expect(getTransport()).toBe(smtpTransport)
  })

  it("returns the Resend transport for EMAIL_PROVIDER=resend", async () => {
    setEnv({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test_key" })
    const { getTransport, resendTransport } = await loadTransports()
    expect(getTransport()).toBe(resendTransport)
  })

  it("lets the override win over any configured provider", async () => {
    setEnv({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test_key" })
    const { getTransport, setTransportOverride: freshOverride } =
      await loadTransports()
    const fake = async () => ({ messageId: null })
    try {
      freshOverride(fake)
      expect(getTransport()).toBe(fake)
    } finally {
      freshOverride(null)
    }
  })
})

// ── Phase 10 — Resend HTTPS transport (mocked fetch) ─────────────

const RESEND_URL = "https://api.resend.com/emails"

function stubResendFetch(response) {
  const spy = vi.fn().mockResolvedValue(response)
  vi.stubGlobal("fetch", spy)
  return spy
}

describe("resendTransport (mocked fetch)", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("posts to api.resend.com and resolves Resend's message id", async () => {
    const key = "re_secret_test_key"
    const from = "onboarding@resend.dev"
    setEnv({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: key,
      RESEND_FROM_EMAIL: from,
      RESEND_FROM_NAME: "Estate",
    })
    const { resendTransport } = await loadTransports()
    const spy = stubResendFetch({
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_resend_test_1" }),
    })

    const result = await resendTransport({
      to: "recipient@estate.test",
      subject: "Test",
      html: "<p>hi</p>",
      text: "hi",
    })

    expect(result.messageId).toBe("msg_resend_test_1")
    expect(spy).toHaveBeenCalledTimes(1)
    const [url, options] = spy.mock.calls[0]
    expect(url).toBe(RESEND_URL)
    expect(options.method).toBe("POST")
    expect(options.headers.Authorization).toBe(`Bearer ${key}`)
    const sent = JSON.parse(options.body)
    expect(sent.from).toBe('"Estate" <onboarding@resend.dev>')
    expect(sent.to).toBe("recipient@estate.test")
    expect(sent.subject).toBe("Test")
    expect(sent.html).toBe("<p>hi</p>")
    expect(sent.text).toBe("hi")
    expect(options.body).not.toContain(key)
  })

  it("throws a sanitized error on a non-2xx response", async () => {
    const key = "re_secret_test_key"
    setEnv({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: key,
      RESEND_FROM_EMAIL: "onboarding@resend.dev",
    })
    const { resendTransport } = await loadTransports()
    stubResendFetch({
      ok: false,
      status: 401,
      json: async () => ({ message: "invalid api key" }),
    })

    await expect(
      resendTransport({ to: "x@estate.test", subject: "T", html: "<p>x</p>" }),
    ).rejects.toThrow(/resend HTTP 401: invalid api key/)
  })

  it("throws a bounded timeout error instead of hanging on a dead endpoint", async () => {
    setEnv({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_secret_test_key",
      RESEND_FROM_EMAIL: "onboarding@resend.dev",
    })
    const { resendTransport } = await loadTransports()
    const abortError = new Error("aborted")
    abortError.name = "AbortError"
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError))

    await expect(
      resendTransport({ to: "x@estate.test", subject: "T", html: "<p>x</p>" }),
    ).rejects.toThrow(/ETIMEDOUT/)
  })

  it("requires RESEND_API_KEY and RESEND_FROM_EMAIL", async () => {
    setEnv({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: undefined })
    let { resendTransport } = await loadTransports()
    await expect(
      resendTransport({ to: "x@estate.test", subject: "T", html: "<p>x</p>" }),
    ).rejects.toThrow(/requires RESEND_API_KEY/)

    setEnv({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_secret_test_key",
      RESEND_FROM_EMAIL: undefined,
    })
    ;({ resendTransport } = await loadTransports())
    await expect(
      resendTransport({ to: "x@estate.test", subject: "T", html: "<p>x</p>" }),
    ).rejects.toThrow(/requires RESEND_FROM_EMAIL/)
  })
})

// ── Pipeline — status/messageId persistence through sendEmail ────

describe("delivery pipeline persistence", () => {
  it("records SENT with the provider message id", async () => {
    const email = uniqueEmail("sent")
    const db = getTestDb()
    const { emailDeliveries } = await import("../src/db/schema/index.js")
    const { eq } = await import("drizzle-orm")

    setTransportOverride(async () => ({ messageId: "provider-msg-123" }))
    try {
      const res = await request(app)
        .post("/api/v1/newsletter/subscribe")
        .send({ email })
      expect(res.status).toBe(201)

      const rows = await db
        .select()
        .from(emailDeliveries)
        .where(eq(emailDeliveries.recipientEmail, email.toLowerCase()))
      expect(rows.length).toBe(1)
      expect(rows[0].kind).toBe("WELCOME")
      expect(rows[0].status).toBe("SENT")
      expect(rows[0].providerMessageId).toBe("provider-msg-123")
      expect(rows[0].errorMessage).toBeNull()
      expect(rows[0].sentAt).not.toBeNull()
    } finally {
      setTransportOverride(null)
    }
  })

  it("records FAILED with a sanitized error when the transport rejects", async () => {
    const email = uniqueEmail("failed")
    const db = getTestDb()
    const { emailDeliveries } = await import("../src/db/schema/index.js")
    const { eq } = await import("drizzle-orm")

    setTransportOverride(async () => {
      throw new Error("resend HTTP 401: invalid api key")
    })
    try {
      const res = await request(app)
        .post("/api/v1/newsletter/subscribe")
        .send({ email })
      expect(res.status).toBe(201) // a transport outage never blocks subscribe

      const rows = await db
        .select()
        .from(emailDeliveries)
        .where(eq(emailDeliveries.recipientEmail, email.toLowerCase()))
      expect(rows[0].kind).toBe("WELCOME")
      expect(rows[0].status).toBe("FAILED")
      expect(rows[0].errorMessage).toContain("401")
      expect(rows[0].providerMessageId).toBeNull()
      expect(rows[0].sentAt).toBeNull()
    } finally {
      setTransportOverride(null)
    }
  })
})
