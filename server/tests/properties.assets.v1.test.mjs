import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import { app, cleanDatabase, uniqueSlug, adminToken, bearer } from "./helpers.mjs"

/**
 * Phase 09 — property images + amenity associations, written transactionally
 * through the shared /api/v1/properties routes. Runs against the isolated
 * estate_test database only; fixtures use the `assets-` slug family.
 */

const PROPERTIES = "/api/v1/properties"

let token
beforeAll(async () => {
  token = await adminToken()
})
afterAll(async () => {
  await cleanDatabase("assets-")
})

const basePayload = (slug) => ({
  title: "Assets Test Residence",
  slug,
  propertyType: "APARTMENT",
  price: 3200000,
  city: "Jeddah",
  district: "Al Shati",
  bedrooms: 4,
  bathrooms: 5,
})

describe("POST with images + amenities", () => {
  it("persists images and resolves amenity names", async () => {
    const slug = uniqueSlug("assets")
    const create = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send({
        ...basePayload(slug),
        images: [
          { url: "https://images.example.com/a.jpg", altText: "Living room", isCover: true },
          { url: "https://images.example.com/b.jpg", displayOrder: 3 },
        ],
        amenities: ["Private Pool", "Smart Home", "Concierge"],
      })
      .expect(201)

    const detail = create.body.data
    expect(detail.images).toEqual([
      expect.objectContaining({ url: "https://images.example.com/a.jpg", isCover: true }),
      expect.objectContaining({ url: "https://images.example.com/b.jpg", displayOrder: 3, isCover: false }),
    ])
    expect(detail.amenities).toEqual(["Concierge", "Private Pool", "Smart Home"].sort())
  })

  it("flags the first image as cover when none is marked", async () => {
    const slug = uniqueSlug("assets")
    const create = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send({
        ...basePayload(slug),
        images: [
          { url: "https://images.example.com/first.jpg" },
          { url: "https://images.example.com/second.jpg" },
        ],
      })
      .expect(201)
    const cover = create.body.data.images.filter((img) => img.isCover)
    expect(cover).toHaveLength(1)
    expect(cover[0].url).toBe("https://images.example.com/first.jpg")
  })

  it("works without any images or amenities (scalar-only create)", async () => {
    const slug = uniqueSlug("assets")
    const create = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send(basePayload(slug))
      .expect(201)
    expect(create.body.data.images).toEqual([])
    expect(create.body.data.amenities).toEqual([])
  })
})

describe("Transactional integrity + validation", () => {
  it("rolls the whole bundle back when asset defaults are invalid", async () => {
    const slug = uniqueSlug("assets")
    const res = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send({
        ...basePayload(slug),
        images: [
          { url: "https://images.example.com/a.jpg", isCover: true },
          { url: "https://images.example.com/b.jpg", isCover: true },
        ],
      })
      .expect(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
    expect(res.body.error.message).toMatch(/one image.*cover/i)

    const read = await request(app)
      .get(`${PROPERTIES}?search=${slug}`)
      .expect(200)
    expect(read.body.meta.total).toBe(0)
  })

  it("rejects a malformed image payload with 422", async () => {
    const res = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send({ ...basePayload(uniqueSlug("assets")), images: [{ url: "" }] })
      .expect(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("rejects more than 30 images with 422", async () => {
    const images = Array.from({ length: 31 }, (_, i) => ({
      url: `https://images.example.com/${i}.jpg`,
    }))
    const res = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send({ ...basePayload(uniqueSlug("assets")), images })
      .expect(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })
})

describe("PATCH with images + amenities", () => {
  it("replaces the image set and amenity set together", async () => {
    const slug = uniqueSlug("assets")
    const created = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send({
        ...basePayload(slug),
        images: [{ url: "https://images.example.com/old.jpg" }],
        amenities: ["Gym"],
      })
      .expect(201)
    const id = created.body.data.id

    const res = await request(app)
      .patch(`${PROPERTIES}/${id}`)
      .set(bearer(token))
      .send({
        price: 3300000,
        images: [
          { url: "https://images.example.com/new.jpg" },
          { url: "https://images.example.com/new2.jpg" },
        ],
        amenities: ["Concierge", "Helipad"],
      })
      .expect(200)

    expect(res.body.data.price).toBe(3300000)
    expect(res.body.data.images.map((img) => img.url)).toEqual([
      "https://images.example.com/new.jpg",
      "https://images.example.com/new2.jpg",
    ])
    expect(res.body.data.amenities).toEqual(["Concierge", "Helipad"].sort())
  })

  it("leaves images untouched when only scalar fields change", async () => {
    const slug = uniqueSlug("assets")
    const created = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send({
        ...basePayload(slug),
        images: [{ url: "https://images.example.com/keep.jpg", isCover: true }],
      })
      .expect(201)
    const id = created.body.data.id

    const res = await request(app)
      .patch(`${PROPERTIES}/${id}`)
      .set(bearer(token))
      .send({ featured: true })
      .expect(200)
    expect(res.body.data.images).toHaveLength(1)
    expect(res.body.data.images[0].url).toBe("https://images.example.com/keep.jpg")
  })
})