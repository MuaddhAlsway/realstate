import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import {
  app,
  cleanDatabase,
  uniqueSlug,
  adminToken,
  bearer,
} from "./helpers.mjs"
import { setMediaClientForTests } from "../src/services/mediaService.js"

/**
 * Phase 09 — property images + amenity associations, written transactionally
 * through the shared /api/v1/properties routes. Runs against the isolated
 * estate_test database only; fixtures use the `assets-` slug family.
 *
 * Phase 10 — managed (provider) images: publicId round-trips through the
 * API, unchanged images keep their rows (diff-based sync), and detached
 * managed assets are destroyed at the provider after commit.
 */

const PROPERTIES = "/api/v1/properties"

// Cloudinary-style URLs for managed fixtures (host matches the provider
// schema when CLOUDINARY_CLOUD_NAME is set; the schema is lenient otherwise).
const managedUrl = (id) =>
  `https://res.cloudinary.com/test-cloud/image/upload/v1/${id}`

let token
let client

beforeAll(async () => {
  token = await adminToken()
  client = {
    calls: { destroy: [], removeTag: [] },
    cloudName: "test-cloud",
    apiKey: "test-key",
    sign: () => "sig-test-only",
    destroy: async (publicId) => {
      client.calls.destroy.push(publicId)
      return { result: "ok" }
    },
    removeTag: async (publicIds) => {
      client.calls.removeTag.push(publicIds)
      return { result: "ok" }
    },
    destroyMany: async () => ({}),
    listPending: async () => [],
  }
  setMediaClientForTests(client)
})

afterAll(async () => {
  setMediaClientForTests(null)
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
          {
            url: "https://images.example.com/a.jpg",
            altText: "Living room",
            isCover: true,
          },
          { url: "https://images.example.com/b.jpg", displayOrder: 3 },
        ],
        amenities: ["Private Pool", "Smart Home", "Concierge"],
      })
      .expect(201)

    const detail = create.body.data
    expect(detail.images).toEqual([
      expect.objectContaining({
        url: "https://images.example.com/a.jpg",
        isCover: true,
      }),
      expect.objectContaining({
        url: "https://images.example.com/b.jpg",
        displayOrder: 3,
        isCover: false,
      }),
    ])
    expect(detail.amenities).toEqual(
      ["Concierge", "Private Pool", "Smart Home"].sort(),
    )
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
    expect(res.body.data.images[0].url).toBe(
      "https://images.example.com/keep.jpg",
    )
  })
})

describe("Phase 10 — managed (provider) images", () => {
  it("persists and exposes the publicId of uploaded assets", async () => {
    const slug = uniqueSlug("assets")
    const create = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send({
        ...basePayload(slug),
        images: [
          {
            url: managedUrl("estate/property/villa-hero"),
            publicId: "estate/property/villa-hero",
            altText: "Managed hero",
            isCover: true,
          },
          { url: "https://images.example.com/legacy.jpg" },
        ],
      })
      .expect(201)
    const images = create.body.data.images
    expect(images[0]).toMatchObject({
      url: managedUrl("estate/property/villa-hero"),
      publicId: "estate/property/villa-hero",
      isCover: true,
    })
    expect(images[1].publicId).toBeNull()
    // Post-commit reconciliation: new managed assets are no longer pending.
    expect(client.calls.removeTag.flat()).toContain(
      "estate/property/villa-hero",
    )
  })

  it("round-trips stable ids: unchanged images keep their rows and refs", async () => {
    const slug = uniqueSlug("assets")
    const created = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send({
        ...basePayload(slug),
        images: [
          {
            url: managedUrl("estate/property/keep-a"),
            publicId: "estate/property/keep-a",
            altText: "A",
          },
          {
            url: managedUrl("estate/property/keep-b"),
            publicId: "estate/property/keep-b",
            altText: "B",
          },
        ],
      })
      .expect(201)
    const id = created.body.data.id
    const before = created.body.data.images
    const destroysBefore = client.calls.destroy.length

    // Same images returned with their ids and reordered/edited — the rows
    // must be preserved (no destroy of still-referenced assets on PATCH).
    const patched = await request(app)
      .patch(`${PROPERTIES}/${id}`)
      .set(bearer(token))
      .send({
        images: [
          { ...before[1], displayOrder: 0, altText: "B renamed" },
          { ...before[0], displayOrder: 1 },
        ],
      })
      .expect(200)
    expect(patched.body.data.images[0].publicId).toBe("estate/property/keep-b")
    expect(patched.body.data.images[0].altText).toBe("B renamed")
    expect(patched.body.data.images[1].publicId).toBe("estate/property/keep-a")
    // Cover was explicitly assigned to keep-a at create; reordering does not
    // silently move it.
    expect(patched.body.data.images.filter((img) => img.isCover)).toHaveLength(
      1,
    )
    expect(patched.body.data.images[1].isCover).toBe(true)
    expect(client.calls.destroy).toHaveLength(destroysBefore)
  })

  it("destroys detached managed assets after the DB commit", async () => {
    const slug = uniqueSlug("assets")
    const created = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send({
        ...basePayload(slug),
        images: [
          {
            url: managedUrl("estate/property/soon-gone"),
            publicId: "estate/property/soon-gone",
          },
        ],
      })
      .expect(201)
    const id = created.body.data.id

    const res = await request(app)
      .patch(`${PROPERTIES}/${id}`)
      .set(bearer(token))
      .send({
        images: [
          {
            url: managedUrl("estate/property/the-replacement"),
            publicId: "estate/property/the-replacement",
          },
        ],
      })
      .expect(200)

    expect(res.body.data.images).toHaveLength(1)
    expect(res.body.data.images[0].publicId).toBe(
      "estate/property/the-replacement",
    )
    // The old managed asset was detached → destroyed at the provider.
    expect(client.calls.destroy).toContain("estate/property/soon-gone")
  })

  it("promotes the first ordered image when the cover is deleted", async () => {
    const slug = uniqueSlug("assets")
    const created = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send({
        ...basePayload(slug),
        images: [
          { url: managedUrl("estate/property/cover-old") },
          {
            url: managedUrl("estate/property/second"),
            publicId: "estate/property/second",
          },
        ],
      })
      .expect(201)
    const id = created.body.data.id
    expect(created.body.data.images[0].isCover).toBe(true)

    // Remove the first (cover) image, keeping the second by id.
    const res = await request(app)
      .patch(`${PROPERTIES}/${id}`)
      .set(bearer(token))
      .send({ images: [{ ...created.body.data.images[1] }] })
      .expect(200)
    expect(res.body.data.images).toHaveLength(1)
    expect(res.body.data.images[0].publicId).toBe("estate/property/second")
    expect(res.body.data.images[0].isCover).toBe(true)
  })

  it("rejects more than one cover even with managed images", async () => {
    const slug = uniqueSlug("assets")
    const res = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send({
        ...basePayload(slug),
        images: [
          { url: managedUrl("a"), publicId: "a", isCover: true },
          { url: managedUrl("b"), publicId: "b", isCover: true },
        ],
      })
      .expect(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("rejects a non-provider host for a managed asset", async () => {
    const slug = uniqueSlug("assets")
    const res = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send({
        ...basePayload(slug),
        images: [{ url: "https://evil.example.com/x.jpg", publicId: "a" }],
      })
      .expect(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })
})
