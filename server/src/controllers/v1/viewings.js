import { asyncHandler } from "../../middleware/error.js"
import * as viewingService from "../../services/viewingService.js"
import {
  serializeViewingDetail,
  serializeViewingList,
} from "../../serializers/viewings.js"

/**
 * Viewing-request controllers — thin HTTP translation over viewingService.
 * Every route is behind requireAuth so `req.user.id`/`req.user.role` are
 * always present. Ownership and status-transition rules live in the service.
 */

export const createViewing = asyncHandler(async (req, res) => {
  const row = await viewingService.createViewing(req.user.id, req.body)
  res.status(201).json({ success: true, data: serializeViewingDetail(row) })
})

export const listViewings = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await viewingService.listViewings(
      req.user.id,
      req.user.role,
      req.parsedQuery,
    )
  res.json({
    success: true,
    data: serializeViewingList(items),
    meta: { page, limit, total, totalPages },
  })
})

export const updateViewingStatus = asyncHandler(async (req, res) => {
  const row = await viewingService.updateViewingStatus(
    req.params.id,
    req.user.id,
    req.user.role,
    req.body,
  )
  res.json({ success: true, data: serializeViewingDetail(row) })
})

export const deleteViewing = asyncHandler(async (req, res) => {
  await viewingService.deleteViewing(req.params.id, req.user.id, req.user.role)
  res.status(204).end()
})
