import { describe, expect, it } from "vitest"
import request from "supertest"
import { app } from "./helpers.mjs"

/**
 * Phase 11 — /api/v1/agents: the public advisor directory. Read-only and
 * unauthenticated; names, contact fields and profile data must come from the
 * agents table only (no user/identity leakage).
 */

const URL = "/api/v1/agents"

describe("public agents directory", () => {
  it("200: lists seeded agents without authentication", async () => {
    const res = await request(app).get(URL)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThan(0)
  })

  it("exposes id, name and contact details but never user identity", async () => {
    const res = await request(app).get(URL)
    const first = res.body.data?.[0]
    expect(first).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      role: expect.any(String),
      experienceYears: expect.any(Number),
    })
    expect(Object.keys(first)).not.toContain("userId")
    expect(Object.keys(first)).not.toContain("user")
  })

  it("is ordered by agent name", async () => {
    const res = await request(app).get(URL)
    const names = res.body.data.map((a) => a.name)
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    expect(names).toEqual(sorted)
  })

  it("filters out null contact fields as nulls, but agents keep their own phone/email keys", async () => {
    const res = await request(app).get(URL)
    for (const agent of res.body.data) {
      expect(Object.prototype.hasOwnProperty.call(agent, "phone")).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(agent, "email")).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(agent, "imageUrl")).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(agent, "languages")).toBe(true)
    }
  })
})