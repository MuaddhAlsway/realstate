import { describe, expect, it } from "vitest"
import request from "supertest"
import { app } from "./helpers.mjs"

describe("GET / — service root", () => {
  it("returns a 200 service-info envelope instead of a 404", async () => {
    const res = await request(app).get("/").expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.data.service).toBe("estate-api")
    expect(res.body.data.version).toBe("v1")
    expect(res.body.data.status).toBe("ok")
    expect(res.body.data.endpoints).toEqual({
      health: "/api/health",
      api: "/api/v1",
    })
  })

  it("still 404s unknown paths through the error envelope", async () => {
    const res = await request(app).get("/nope").expect(404)

    expect(res.body.error.code).toBe("NOT_FOUND")
  })
})