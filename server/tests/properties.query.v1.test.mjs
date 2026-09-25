import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import {
  app,
  cleanDatabase,
  uniqueSlug,
  adminToken,
  bearer,
} from "./helpers.mjs"

/**
 * Phase 04 — /api/v1/properties advanced querying: filters, word-boundary
 * search, sort, offset pagination with metadata, and query-param validation.
 *
 * Runs against the isolated estate_test database. Fixtures use the
 * `query-test-` slug family and a unique token (74qz) so assertions never
 * collide with the concurrently-running Phase 03 suite. Phase 05: fixture
 * creation is an AGENT/ADMIN mutation, so it authenticates with the seeded
 * admin's Bearer token.
 */

const URL = "/api/v1/properties"

const makeProperty = (props) => ({
  title: `74qz ${props.name} Villa`,
  slug: uniqueSlug("query-test"),
  propertyType: "VILLA",
  price: props.price,
  city: props.city,
  district: `74qz-district-${props.name.toLowerCase()}`,
  bedrooms: props.bedrooms ?? 4,
  bathrooms: props.bathrooms ?? 4,
  description: "Created by the Phase 04 test suite.",
  ...props.extra,
})

let alpha
let beta
let gamma

beforeAll(async () => {
  const token = await adminToken()
  const post = (body) => request(app).post(URL).set(bearer(token)).send(body)

  const alphaRes = await post(
    makeProperty({
      name: "Alpha",
      price: 1000000,
      city: "Jeddah",
      bedrooms: 5,
      bathrooms: 6,
      extra: { featured: true },
    }),
  ).expect(201)

  const betaRes = await post(
    makeProperty({
      name: "Beta",
      price: 3000000,
      city: "Jeddah",
      bedrooms: 6,
      bathrooms: 7,
    }),
  ).expect(201)

  const gammaRes = await post(
    makeProperty({
      name: "Gamma",
      price: 120000,
      city: "Riyadh",
      bedrooms: 2,
      bathrooms: 2,
      extra: { propertyType: "APARTMENT", purpose: "RENT", featured: true },
    }),
  ).expect(201)

  alpha = alphaRes.body.data
  beta = betaRes.body.data
  gamma = gammaRes.body.data
})

afterAll(async () => {
  await cleanDatabase("query-test-")
})

describe("GET /api/v1/properties — defaults & envelope", () => {
  it("no query returns page 1 with metadata and the default sort", async () => {
    const res = await request(app).get(URL).expect(200)
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 12,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    })
    expect(res.body.meta.total).toBeGreaterThanOrEqual(6)
    expect(res.body.data.length).toBe(Math.min(12, res.body.meta.total))
    // Default sort is featured-first.
    expect(res.body.data[0].featured).toBe(true)
  })

  it("invalid query parameters return 422 INVALID_QUERY", async () => {
    const bad = [
      "page=0",
      "page=-1",
      "page=abc",
      "limit=999",
      "limit=0",
      "sort=bogus",
      "minPrice=abc",
      "minPrice=100&maxPrice=50",
      "bedrooms=x",
    ]
    for (const qs of bad) {
      const res = await request(app).get(`${URL}?${qs}`).expect(422)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe("INVALID_QUERY")
    }
  })
})

describe("GET /api/v1/properties — filters", () => {
  it("purpose=RENT returns only rental listings", async () => {
    const res = await request(app).get(`${URL}?purpose=RENT`).expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(2)
    for (const p of res.body.data) expect(p.purpose).toBe("RENT")
    expect(res.body.data.map((p) => p.id)).toContain(gamma.id)
  })

  it("combines propertyType and city", async () => {
    const res = await request(app)
      .get(`${URL}?propertyType=VILLA&city=Jeddah`)
      .expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(4)
    for (const p of res.body.data) {
      expect(p.propertyType).toBe("VILLA")
      expect(p.city).toBe("Jeddah")
    }
    expect(res.body.data.map((p) => p.id)).toEqual(
      expect.arrayContaining([alpha.id, beta.id]),
    )
  })

  it("price range bounds the results", async () => {
    const res = await request(app)
      .get(`${URL}?minPrice=900000&maxPrice=3500000&sort=price-asc`)
      .expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(2)
    for (const p of res.body.data) {
      expect(p.price).toBeGreaterThanOrEqual(900000)
      expect(p.price).toBeLessThanOrEqual(3500000)
    }
    expect(res.body.data.map((p) => p.id)).toEqual(
      expect.arrayContaining([alpha.id, beta.id]),
    )
  })

  it("minBedrooms filters on bedrooms", async () => {
    const res = await request(app)
      .get(`${URL}?propertyType=VILLA&minBedrooms=6`)
      .expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(2)
    for (const p of res.body.data) {
      expect(p.propertyType).toBe("VILLA")
      expect(p.bedrooms).toBeGreaterThanOrEqual(6)
    }
    expect(res.body.data.map((p) => p.id)).toContain(beta.id)
  })
})

describe("GET /api/v1/properties — search", () => {
  it("matches the unique fixture token only", async () => {
    const res = await request(app)
      .get(`${URL}?search=74qz&sort=price-asc&limit=50`)
      .expect(200)
    expect(res.body.meta.total).toBe(3)
    expect(res.body.data.map((p) => p.id).sort()).toEqual(
      [alpha.id, beta.id, gamma.id].sort(),
    )
  })

  it("matches whole words, not substrings (word boundaries)", async () => {
    const res = await request(app).get(`${URL}?search=ham`).expect(200)
    // "Al Hamra" exists in the seed, but "ham" is not a whole word in it.
    expect(res.body.meta.total).toBe(0)
  })

  it("matches an existing whole word across the seed data", async () => {
    const res = await request(app).get(`${URL}?search=shati`).expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(2)
    for (const p of res.body.data) {
      expect([p.title, p.city, p.district].join(" ").toLowerCase()).toMatch(
        /shati/,
      )
    }
  })
})

describe("GET /api/v1/properties — sort", () => {
  it("price-asc orders fixtures ascending", async () => {
    const res = await request(app)
      .get(`${URL}?search=74qz&sort=price-asc&limit=50`)
      .expect(200)
    expect(res.body.data.map((p) => p.id)).toEqual([
      gamma.id,
      alpha.id,
      beta.id,
    ])
  })

  it("price-desc orders fixtures descending", async () => {
    const res = await request(app)
      .get(`${URL}?search=74qz&sort=price-desc&limit=50`)
      .expect(200)
    expect(res.body.data.map((p) => p.id)).toEqual([
      beta.id,
      alpha.id,
      gamma.id,
    ])
  })

  it("newest is non-increasing by createdAt", async () => {
    const res = await request(app)
      .get(`${URL}?search=74qz&sort=newest&limit=50`)
      .expect(200)
    expect(res.body.data.length).toBe(3)
    const stamps = res.body.data.map((p) => new Date(p.createdAt).getTime())
    for (let i = 1; i < stamps.length; i += 1) {
      expect(stamps[i]).toBeLessThanOrEqual(stamps[i - 1])
    }
  })
})

describe("GET /api/v1/properties — pagination", () => {
  it("page+limit slice with accurate total metadata", async () => {
    const page1 = await request(app)
      .get(`${URL}?search=74qz&sort=price-asc&limit=2&page=1`)
      .expect(200)
    expect(page1.body.data.map((p) => p.id)).toEqual([gamma.id, alpha.id])
    expect(page1.body.meta).toMatchObject({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    })

    const page2 = await request(app)
      .get(`${URL}?search=74qz&sort=price-asc&limit=2&page=2`)
      .expect(200)
    expect(page2.body.data.map((p) => p.id)).toEqual([beta.id])
    expect(page2.body.meta).toMatchObject({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    })

    const page3 = await request(app)
      .get(`${URL}?search=74qz&sort=price-asc&limit=2&page=3`)
      .expect(200)
    expect(page3.body.data).toEqual([])
    expect(page3.body.meta).toMatchObject({ page: 3, total: 3, totalPages: 2 })
  })

  it("empty result sets report zero pages", async () => {
    const res = await request(app)
      .get(`${URL}?city=NonExistentCity1974`)
      .expect(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta).toMatchObject({ total: 0, totalPages: 0 })
  })
})
