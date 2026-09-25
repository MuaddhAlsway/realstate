import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import { randomUUID } from "node:crypto"
import { app, adminToken, bearer, cleanAuthUsers } from "./helpers.mjs"
import { DEFAULT_CONTENT } from "../src/content/defaults.js"

/**
 * Phase 09 — public CMS reads (/api/v1/content) + admin CMS writes
 * (/api/v1/admin/content/:section). Runs against the isolated estate_test
 * database only, which the seed populates with the default content.
 */

const CONTENT = "/api/v1/content"
const ADMIN_CONTENT = "/api/v1/admin/content"

const uniqueEmail = (tag) =>
  `content-test-${tag}-${randomUUID().slice(0, 8)}@estate.test`

let token
let userToken

const putSection = (section, payload, auth) =>
  request(app)
    .put(`${ADMIN_CONTENT}/${section}`)
    .set(bearer(auth))
    .send(payload)

beforeAll(async () => {
  token = await adminToken()
  const reg = await request(app)
    .post("/api/v1/auth/register")
    .send({ name: "Content Test User", email: uniqueEmail("user"), password: "ContentTest-123" })
  expect(reg.status).toBe(201)
  userToken = reg.body.data.accessToken
})

// The seeded defaults are the source of truth — restore edited sections so
// concurrent/other suites still read the pristine seed.
afterAll(async () => {
  for (const section of ["seo", "footer"]) {
    await putSection(section, DEFAULT_CONTENT[section], token).expect(200)
  }
  await cleanAuthUsers("content-test-")
})

describe("GET /api/v1/content (public reads)", () => {
  it("lists all sections with the seeded values", async () => {
    const res = await request(app).get(CONTENT).expect(200)
    expect(res.body.success).toBe(true)
    for (const section of ["home", "about", "contact", "footer", "seo"]) {
      expect(res.body.data[section]).toBeTypeOf("object")
    }
    expect(res.body.data.home.heroLine1).toBe("Find a place")
    expect(res.body.data.home.stats).toHaveLength(4)
    expect(res.body.data.footer.copyright).toContain("2026")
  })

  it("serves one section on demand", async () => {
    const res = await request(app).get(`${CONTENT}/home`).expect(200)
    expect(res.body.data.ctaTitle).toBe("Your next chapter starts here.")
    expect(res.body.data.whyUs).toHaveLength(5)
  })

  it("404s NOT_FOUND for an unknown section", async () => {
    const res = await request(app).get(`${CONTENT}/nope`).expect(404)
    expect(res.body.error.code).toBe("NOT_FOUND")
  })
})

describe("PUT /api/v1/admin/content/:section (admin writes)", () => {
  it("replaces a section and persists it for public reads", async () => {
    const updated = { ...DEFAULT_CONTENT.seo, title: "Estate — Admin CMS Test" }
    const res = await putSection("seo", updated, token).expect(200)
    expect(res.body.data.title).toBe("Estate — Admin CMS Test")

    const read = await request(app).get(`${CONTENT}/seo`).expect(200)
    expect(read.body.data.title).toBe("Estate — Admin CMS Test")
  })

  it("fully replaces: keys absent from the payload are removed", async () => {
    const initial = await request(app).get(`${CONTENT}/footer`).expect(200)
    expect(initial.body.data.socials).toBeTypeOf("object")

    const trimmed = {
      ...DEFAULT_CONTENT.footer,
      copyright: "© 2026 Estate. All rights reserved.",
      socials: [{ label: "Instagram", href: "https://instagram.com" }],
    }
    await putSection("footer", trimmed, token).expect(200)
    const read = await request(app).get(`${CONTENT}/footer`).expect(200)
    expect(read.body.data.socials).toEqual([
      { label: "Instagram", href: "https://instagram.com" },
    ])
  })

  it("rejects unknown keys with 422 VALIDATION_ERROR", async () => {
    const res = await putSection(
      "seo",
      { ...DEFAULT_CONTENT.seo, heroTitle: "typo" },
      token,
    ).expect(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
    expect(res.body.error.message).toMatch(/heroTitle/i)
  })

  it("rejects structurally invalid payloads with 422", async () => {
    const res = await putSection(
      "home",
      { ...DEFAULT_CONTENT.home, stats: [{ label: "broken" }] },
      token,
    ).expect(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("404s for an unknown section on the admin route", async () => {
    const res = await putSection("nope", {}, token).expect(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("403s for a non-admin token", async () => {
    const res = await putSection("seo", DEFAULT_CONTENT.seo, userToken)
      .expect(403)
    expect(res.body.error.code).toBe("FORBIDDEN")
  })

  it("401s without a token", async () => {
    await request(app)
      .put(`${ADMIN_CONTENT}/seo`)
      .send(DEFAULT_CONTENT.seo)
      .expect(401)
  })
})