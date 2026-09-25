import { asyncHandler } from "../../middleware/error.js"
import * as contentService from "../../services/contentService.js"

/**
 * Public content controllers — read-only CMS access. Sections are served
 * as plain, validated-value objects; when nothing is stored yet the
 * service returns `{}` and the frontend falls back to its built-in
 * defaults, so the site never depends on an admin having published.
 */

export const listContent = asyncHandler(async (req, res) => {
  const data = await contentService.listAllContent()
  res.json({ success: true, data })
})

export const getContent = asyncHandler(async (req, res) => {
  const data = await contentService.getSectionContent(req.params.section)
  res.json({ success: true, data })
})