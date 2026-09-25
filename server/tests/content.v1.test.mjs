import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import { randomUUID } from "node:crypto"
import { app, adminToken, bearer, cleanAuthUsers } from "./helpers.mjs"
import { DEFAULT_CONTENT } from "../src/content/defaults.js"
import { setMediaClientForTests } from "../src/services/mediaService.js"

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
    .send({
      name: "Content Test User",
      email: uniqueEmail("user"),
      password: "ContentTest-123",
    })
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
    const res = await putSection("seo", DEFAULT_CONTENT.seo, userToken).expect(
      403,
    )
    expect(res.body.error.code).toBe("FORBIDDEN")
  })

  it("401s without a token", async () => {
    await request(app)
      .put(`${ADMIN_CONTENT}/seo`)
      .send(DEFAULT_CONTENT.seo)
      .expect(401)
  })
})

describe("Phase 10 — CMS managed media references", () => {
  const managedUrl = (id) =>
    `https://res.cloudinary.com/test-cloud/image/upload/v1/${id}`
  let client

  beforeAll(async () => {
    client = {
      calls: { destroy: [], removeTag: [] },
      cloudName: "test-cloud",
      apiKey: "test-key",
      sign: () => "sig-test-only",
      destroy: async (publicId) => {
        client.calls.destroy.push(publicId)
        return { result: "ok" }
      },
      removeTag: async () => ({ result: "ok" }),
      destroyMany: async () => ({}),
      listPending: async () => [],
    }
    setMediaClientForTests(client)
  })

  afterAll(async () => {
    // Restore the sections this suite edited so the seed stays pristine.
    await putSection("home", DEFAULT_CONTENT.home, token).expect(200)
    await putSection("about", DEFAULT_CONTENT.about, token).expect(200)
    setMediaClientForTests(null)
  })

  it("stores a provider ref on home but never exposes it publicly", async () => {
    const managed = {
      ...DEFAULT_CONTENT.home,
      heroImage: managedUrl("estate/cms/hero"),
      heroImagePublicId: "estate/cms/hero",
    }
    const saved = await putSection("home", managed, token).expect(200)
    // The admin response is stripped too (refs are private).
    expect(saved.body.data.heroImagePublicId).toBeUndefined()
    expect(saved.body.data.heroImage).toBe(managedUrl("estate/cms/hero"))

    const pub = await request(app).get(`${CONTENT}/home`).expect(200)
    expect(pub.body.data.heroImagePublicId).toBeUndefined()
    expect(pub.body.data.heroImage).toBe(managedUrl("estate/cms/hero"))
  })

  it("destroys the retired managed asset when a CMS image is replaced", async () => {
    await putSection(
      "about",
      {
        ...DEFAULT_CONTENT.about,
        image: managedUrl("estate/cms/about-old"),
        imagePublicId: "estate/cms/about-old",
      },
      token,
    ).expect(200)

    const destroysBefore = client.calls.destroy.length
    // Replacing with a plain URL retires the managed asset.
    await putSection("about", DEFAULT_CONTENT.about, token).expect(200)
    expect(client.calls.destroy).toContain("estate/cms/about-old")
    expect(client.calls.destroy.length).toBeGreaterThan(destroysBefore)

    const pub = await request(app).get(`${CONTENT}/about`).expect(200)
    expect(pub.body.data.image).toBe(DEFAULT_CONTENT.about.image)
    expect(pub.body.data.imagePublicId).toBeUndefined()
  })

  it("rejects a managed ref whose URL is not on the provider host", async () => {
    const res = await putSection(
      "home",
      {
        ...DEFAULT_CONTENT.home,
        heroImage: "https://evil.example.com/x.jpg",
        heroImagePublicId: "estate/cms/evil",
      },
      token,
    ).expect(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })
})
