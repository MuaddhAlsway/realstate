import { asyncHandler } from "../../middleware/error.js"
import * as mediaService from "../../services/mediaService.js"

/**
 * Phase 10 — admin media controller. Thin translation layer: HTTP → service.
 * Every route sits behind the admin router's requireAuth + requireRole gate
 * plus a rate limiter, so unauthenticated/non-admin callers never reach here.
 */

/** Signed, short-lived direct-upload authorization (ADMIN only). */
export const uploadAuthorization = asyncHandler(async (req, res) => {
  const authz = await mediaService.createUploadAuthorization(req.body.purpose)
  res.json({ success: true, data: authz })
})

/** List provider assets that are pending, old and referenced nowhere. */
export const listOrphans = asyncHandler(async (req, res) => {
  const resources = await mediaService.listOrphanAssets()
  res.json({
    success: true,
    data: {
      count: resources.length,
      items: resources.map((resource) => ({
        publicId: resource.public_id,
        createdAt: resource.created_at ?? null,
        url: resource.secure_url ?? resource.url ?? null,
      })),
    },
  })
})

/** Destroy the orphaned uploads (explicit cleanup — no reflection of secrets). */
export const cleanOrphans = asyncHandler(async (req, res) => {
  const result = await mediaService.destroyOrphanAssets()
  res.json({ success: true, data: result })
})
