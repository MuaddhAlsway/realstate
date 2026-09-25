import { z } from "zod"
import { MEDIA_PURPOSES } from "../services/mediaService.js"

/**
 * Phase 10 — media API request validation. The upload-authorization request
 * only allows a closed set of destinations/purposes; the client never gets to
 * choose provider options (folder, formats, size limits) — those are decided
 * server-side inside mediaService.createUploadAuthorization().
 */
export const uploadAuthorizationSchema = z.object({
  purpose: z.enum(Object.keys(MEDIA_PURPOSES)),
})
