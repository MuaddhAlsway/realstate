import { http } from "./http"
import { REMOTE, type ApiError } from "./http"

/**
 * Phase 10 — media client.
 *
 * The browser never streams bytes through our Express server: the admin
 * requests a short-lived signed authorization, then uploads directly to
 * Cloudinary with XHR (so progress is observable). Only the cloud name and
 * API key (public identifiers) reach the browser; the API secret only ever
 * lives server-side. There is deliberately no mock layer — media requires
 * the live backend, so any upload attempt in the local preview surface
 * fails with a clear message.
 */

export type MediaPurpose = "property" | "cms"

export interface UploadAuthorization {
  cloudName: string
  apiKey: string
  uploadUrl: string
  signature: string
  params: {
    timestamp: number
    expires_at: number
    folder: string
    allowed_formats: string[]
    max_bytes: number
    tags: string[]
  }
}

/** What Cloudinary returns after a successful `POST .../image/upload`. */
export interface UploadedMedia {
  public_id: string
  secure_url: string
  width?: number
  height?: number
  format?: string
}

export interface UploadResult {
  url: string
  publicId: string
}

const ACCEPTED_MIME: Record<string, boolean> = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
  "image/avif": true,
}

export class MediaClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MediaClientError"
  }
}

/** Reject in the preview (no live backend) before any network call. */
function requireRemote() {
  if (!REMOTE) {
    throw new MediaClientError(
      "Media uploads need the live backend — start the API server and set VITE_API_URL.",
    )
  }
}

/**
 * Request a short-lived signed upload authorization for one purpose.
 * Server-side rate limiting protects this endpoint.
 */
export async function authorizeUpload(
  purpose: MediaPurpose,
): Promise<UploadAuthorization> {
  requireRemote()
  try {
    return await http.post<UploadAuthorization>(
      "/api/v1/admin/media/upload-authorize",
      { purpose },
    )
  } catch (err) {
    const e = err as ApiError
    throw new MediaClientError(
      e.message || `Could not authorize upload (${e.status ?? "network"})`,
    )
  }
}

/**
 * Upload one image file straight to Cloudinary using a signed
 * authorization. `onProgress` receives 0–1. Returns Cloudinary's response
 * (which contains the public_id + secure_url to persist on the record).
 */
export function uploadFile(
  auth: UploadAuthorization,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<UploadedMedia> {
  return new Promise((resolve, reject) => {
    const { params } = auth

    const typeOk = ACCEPTED_MIME[file.type]
    if (!typeOk) {
      reject(
        new MediaClientError(
          `Unsupported file type (${file.type || "unknown"}) — use JPG, PNG, WEBP or AVIF.`,
        ),
      )
      return
    }
    if (file.size > params.max_bytes) {
      reject(
        new MediaClientError(
          `File is too large (${Math.ceil(file.size / 1024 / 1024)} MiB) — the limit is ${Math.round(
            params.max_bytes / 1024 / 1024,
          )} MiB per image.`,
        ),
      )
      return
    }

    const body = new FormData()
    body.set("api_key", auth.apiKey)
    body.set("timestamp", String(params.timestamp))
    body.set("expires_at", String(params.expires_at))
    body.set("folder", params.folder)
    body.set("allowed_formats", params.allowed_formats.join(","))
    body.set("tags", params.tags.join(","))
    body.set("signature", auth.signature)
    body.set("file", file)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", auth.uploadUrl)
    xhr.responseType = "json"

    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(event.loaded / event.total)
        }
      })
    }

    xhr.addEventListener("load", () => {
      const payload = xhr.response as
        | (Partial<UploadedMedia> & { error?: { message?: string } })
        | null
      if (xhr.status >= 200 && xhr.status < 300 && payload?.public_id) {
        const media = payload as UploadedMedia
        resolve({
          public_id: media.public_id,
          secure_url:
            media.secure_url ||
            `https://res.cloudinary.com/${auth.cloudName}/image/upload/${media.public_id}`,
          width: media.width,
          height: media.height,
          format: media.format,
        })
        return
      }
      reject(
        new MediaClientError(
          payload?.error?.message ||
            `Upload failed (${xhr.status || "provider unreachable"})`,
        ),
      )
    })

    xhr.addEventListener("error", () => {
      reject(
        new MediaClientError(
          "Upload failed — check your connection / CORS and try again.",
        ),
      )
    })

    xhr.send(body)
  })
}

/**
 * Optimized delivery URL for provider-hosted images: injects a transform
 * segment (width, auto quality/format) into res.cloudinary.com URLs.
 * Legacy free-form URLs (Unsplash etc.) pass through untouched.
 */
export function mediaUrl(
  url: string | null | undefined,
  options: { width?: number } = {},
): string {
  if (!url || !url.includes("res.cloudinary.com/")) return url ?? ""
  const transforms: string[] = []
  if (options.width) transforms.push(`w_${options.width}`)
  transforms.push("q_auto", "f_auto")
  return url.replace("/image/upload/", `/image/upload/${transforms.join(",")}/`)
}

/** Small optimized thumbnail suitable for admin previews. */
export function mediaThumb(url: string | null | undefined): string {
  return mediaUrl(url, { width: 480 })
}