import { asyncHandler } from "../../middleware/error.js"
import { describeIssues } from "../../middleware/validate.js"
import { HttpError } from "../../errors/index.js"
import { ErrorCodes } from "../../errors/error-codes.js"
import * as adminService from "../../services/adminService.js"
import * as propertyService from "../../services/propertyService.js"
import * as viewingService from "../../services/viewingService.js"
import * as contentService from "../../services/contentService.js"
import { serializePropertyList } from "../../serializers/properties.js"
import { serializeViewingList } from "../../serializers/viewings.js"
import {
  serializeAdminAgent,
  serializeAdminAgentList,
  serializeAdminUserList,
  serializeAmenityOption,
  serializeNeighborhoodOption,
} from "../../serializers/admin.js"
import { CONTENT_SCHEMAS } from "../../schemas/content.js"

/**
 * Admin controllers — every route on the /api/v1/admin router is gated by
 * requireAuth + requireRole("ADMIN") at the router level, so handlers can
 * assume an authenticated admin. They stay thin: HTTP → service → envelope.
 */

export const dashboard = asyncHandler(async (req, res) => {
  const data = await adminService.getDashboard()
  res.json({ success: true, data })
})

export const listProperties = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await propertyService.listAdminProperties(req.parsedQuery)
  res.json({
    success: true,
    data: serializePropertyList(items),
    meta: { page, limit, total, totalPages },
  })
})

export const listViewings = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await viewingService.listViewings(req.user.id, "ADMIN", req.parsedQuery)
  res.json({
    success: true,
    data: serializeViewingList(items),
    meta: { page, limit, total, totalPages },
  })
})

export const listAgents = asyncHandler(async (req, res) => {
  const rows = await adminService.listAdminAgents()
  res.json({ success: true, data: serializeAdminAgentList(rows) })
})

export const updateAgent = asyncHandler(async (req, res) => {
  const row = await adminService.updateAdminAgent(req.params.id, req.body)
  res.json({ success: true, data: serializeAdminAgent(row) })
})

export const listUsers = asyncHandler(async (req, res) => {
  const { items, total } = await adminService.listAdminUsers(
    req.parsedQuery.search ? { search: req.parsedQuery.search } : {},
  )
  res.json({ success: true, data: serializeAdminUserList(items), meta: { total } })
})

export const listAmenities = asyncHandler(async (req, res) => {
  const rows = await adminService.listAmenityOptions()
  res.json({ success: true, data: rows.map(serializeAmenityOption) })
})

export const listNeighborhoods = asyncHandler(async (req, res) => {
  const rows = await adminService.listNeighborhoodOptions()
  res.json({ success: true, data: rows.map(serializeNeighborhoodOption) })
})

export const replaceContent = asyncHandler(async (req, res) => {
  const schema = CONTENT_SCHEMAS[req.params.section]
  if (!schema) {
    throw new HttpError("Content section not found", 404, ErrorCodes.NOT_FOUND)
  }
  const result = schema.safeParse(req.body)
  if (!result.success) {
    throw new HttpError(
      describeIssues(result.error.issues),
      422,
      ErrorCodes.VALIDATION_ERROR,
    )
  }
  const values = await contentService.replaceSectionContent(
    req.params.section,
    result.data,
  )
  res.json({ success: true, data: values })
})