import cloudinaryDefault from "cloudinary"
import { Cloudinary } from "cloudinary"
import { eq, isNotNull } from "drizzle-orm"
import { getDb } from "../db/index.js"
import * as schema from "../db/schema/index.js"
import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"
import {
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_CONFIGURED,
  MEDIA_ORPHAN_AGE_HOURS,
  MEDIA_UPLOAD_MAX_BYTES,
  MEDIA_UPLOAD_TTL_SECONDS,
} from "../config/env.js"

/**
 * Media service (Phase 10) — the single boundary between the application and
 * the Cloudinary provider. Controllers and property/CMS services call these
 * small operations; they never touch the SDK directly.
 *
 * Upload flow — signed direct uploads:
 *   1. ADMIN requests authorization → this service signs a restricted,
 *      short-lived parameter set (folder, formats, max bytes, tags, TTL).
 *      Only the cloud name + API key (public identifiers) leave the server.
 *   2. The browser uploads bytes straight to Cloudinary with those params.
 *   3. The app API later stores the returned `publicId` + `secure_url`.
 *
 * Orphan strategy: every signed upload is tagged `estate-pending`; the tag is
 * removed after the asset is successfully attached to a property/CMS record.
 * `listOrphanAssets`/`destroyOrphanAssets` sweep pending uploads older than
 * the cutoff that are not referenced anywhere in the database (explicit
 * cleanup endpoint — no scheduler on the free render tier).
 */

const { propertyImages, siteContent } = schema

const PENDING_TAG = "estate-pending"

export const MEDIA_PURPOSES = Object.freeze({
  property: { folder: "estate/property", tag: "estate-property" },
  cms: { folder: "estate/cms", tag: "estate-cms" },
})

export const ALLOWED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "avif"]

/** Thrown when the provider rejects/misbehaves (keeps SDK noise out). */
class ProviderError extends Error {}

/** Path-safe references: cloudinary instance + a tiny command surface. */
function createRealClient() {
  const config = {
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  }
  const instance = new Cloudinary(config)
  return {
    sign: (params) =>
      cloudinaryDefault.utils.api_sign_request(params, config.api_secret),
    destroy: (publicId) =>
      instance.uploader.destroy(publicId, { invalidate: true }),
    removeTag: (publicIds) =>
      instance.uploader.remove_tag(PENDING_TAG, publicIds, {
        resource_type: "image",
      }),
    listPending: async () => {
      const res = await instance.api.resources_by_tag(PENDING_TAG, {
        resource_type: "image",
        max_results: 500,
      })
      return res?.resources ?? []
    },
    destroyMany: (publicIds) =>
      instance.api.delete_resources(publicIds, {
        resource_type: "image",
        invalidate: true,
      }),
  }
}

/** Test seam — swap in a stub client that never touches the network. */
let overrideClient = null
export function setMediaClientForTests(client) {
  overrideClient = client
}

/**
 * The cloud name in effect for this process. The override client supplies it
 * under tests; production reads it from env. Lazy so zod refinements can
 * enforce the managed-image host with the seam in place.
 */
export function getMediaCloudName() {
  return overrideClient?.cloudName ?? CLOUDINARY_CLOUD_NAME ?? null
}

export function mediaConfigured() {
  return overrideClient !== null || CLOUDINARY_CONFIGURED
}

function getClient() {
  if (overrideClient) return overrideClient
  if (!CLOUDINARY_CONFIGURED) {
    throw new HttpError(
      "Media provider is not configured",
      503,
      ErrorCodes.MEDIA_NOT_CONFIGURED,
    )
  }
  return createRealClient()
}

/** Translate any provider failure into the canonical MEDIA_PROVIDER_ERROR. */
async function withProvider(fn) {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof HttpError) throw err
    console.error("[media] provider failure:", err)
    throw new HttpError(
      "Media provider request failed",
      502,
      ErrorCodes.MEDIA_PROVIDER_ERROR,
    )
  }
}

/**
 * Short-lived, restricted upload authorization for the admin browser.
 * `purpose` decides the destination folder — never an arbitrary client value.
 */
export async function createUploadAuthorization(purpose) {
  const flavor = MEDIA_PURPOSES[purpose]
  if (!flavor) {
    throw new HttpError(
      "Unknown media purpose",
      422,
      ErrorCodes.VALIDATION_ERROR,
    )
  }
  const client = getClient()
  // Public identifiers always travel with the client (the stub client in
  // tests carries test values; production reads them from env).
  const cloudName = client.cloudName ?? CLOUDINARY_CLOUD_NAME
  const apiKey = client.apiKey ?? CLOUDINARY_API_KEY
  const timestamp = Math.floor(Date.now() / 1000)
  const expiresAt = timestamp + MEDIA_UPLOAD_TTL_SECONDS
  const params = {
    timestamp,
    expires_at: expiresAt,
    folder: flavor.folder,
    allowed_formats: ALLOWED_IMAGE_FORMATS.join(","),
    max_bytes: MEDIA_UPLOAD_MAX_BYTES,
    tags: [flavor.tag, PENDING_TAG].join(","),
  }
  const signature = client.sign(params)
  return {
    cloudName,
    apiKey,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    signature,
    params: {
      timestamp,
      expires_at: expiresAt,
      folder: flavor.folder,
      allowed_formats: [...ALLOWED_IMAGE_FORMATS],
      max_bytes: MEDIA_UPLOAD_MAX_BYTES,
      tags: [flavor.tag, PENDING_TAG],
    },
  }
}

/** Destroy one provider asset (used when an image is detached/replaced). */
export async function deleteAsset(publicId) {
  if (!publicId) return
  if (!mediaConfigured()) return
  const client = getClient()
  await withProvider(() => client.destroy(publicId))
}

/**
 * Best-effort: an attached asset is no longer pending. Runs AFTER the DB
 * commit so a failed commit leaves the tag in place (asset stays collectible
 * by the orphan sweep).
 */
export async function markAssetsAttached(publicIds) {
  const ids = (publicIds ?? []).filter(Boolean)
  if (ids.length === 0 || !mediaConfigured()) return
  const client = getClient()
  try {
    await client.removeTag(ids)
  } catch (err) {
    console.error("[media] failed to mark assets attached:", err)
  }
}

/** Every public_id the application currently references (property + CMS). */
async function getReferencedPublicIds() {
  const db = getDb()
  if (!db) return new Set()

  const imageRows = await db
    .select({ publicId: propertyImages.publicId })
    .from(propertyImages)
    .where(isNotNull(propertyImages.publicId))
  const contentRows = await db.select().from(siteContent)

  const referenced = new Set(imageRows.map((row) => row.publicId))
  for (const row of contentRows) {
    if (!row.value || typeof row.value !== "object") continue
    for (const [key, value] of Object.entries(row.value)) {
      if (/PublicId$/i.test(key) && typeof value === "string" && value) {
        referenced.add(value)
      }
    }
  }
  return referenced
}

/** Pending uploads older than `olderThanHours` that nothing references. */
export async function listOrphanAssets({
  olderThanHours = MEDIA_ORPHAN_AGE_HOURS,
} = {}) {
  const client = getClient()
  const cutoff = Date.now() - olderThanHours * 3600 * 1000
  const [resources, referenced] = await Promise.all([
    withProvider(() => client.listPending()),
    getReferencedPublicIds(),
  ])
  return (resources ?? []).filter((resource) => {
    const createdAt = Date.parse(resource.created_at ?? "")
    if (!Number.isFinite(createdAt) || createdAt > cutoff) return false
    return !referenced.has(resource.public_id)
  })
}

/** Destroy the orphan candidates returned by `listOrphanAssets`. */
export async function destroyOrphanAssets({ olderThanHours } = {}) {
  const candidates = await listOrphanAssets({ olderThanHours })
  const ids = candidates.map((item) => item.public_id)
  if (ids.length === 0) return { destroyed: 0, publicIds: [] }
  await withProvider(() => getClient().destroyMany(ids))
  return { destroyed: ids.length, publicIds: ids }
}

/**
 * Delivery URL for a provider asset: injects a transformation segment
 * (width/quality/format) into res.cloudinary.com URLs. Legacy non-provider
 * URLs are returned untouched so existing production images keep working.
 */
export function buildDeliveryUrl(url, { width } = {}) {
  if (!url || !url.includes("res.cloudinary.com/")) return url
  const transforms = []
  if (width) transforms.push(`w_${width}`)
  transforms.push("q_auto", "f_auto")
  const segment = transforms.join(",")
  return url.replace("/image/upload/", `/image/upload/${segment}/`)
}
