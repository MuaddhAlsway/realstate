import { asyncHandler } from "../../middleware/error.js"
import * as propertyService from "../../services/propertyService.js"
import {
  serializePropertyList,
  serializePropertyDetail,
} from "../../serializers/properties.js"

/**
 * Controllers are deliberately thin: they translate HTTP → service calls
 * and serialize service results into the response envelope. All business
 * logic, database access and error translation live in the service layer.
 */

export const listProperties = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await propertyService.listProperties(req.parsedQuery)
  res.json({
    success: true,
    data: serializePropertyList(items),
    meta: { page, limit, total, totalPages },
  })
})

export const getProperty = asyncHandler(async (req, res) => {
  const row = await propertyService.getPropertyById(req.params.id)
  res.json({ success: true, data: serializePropertyDetail(row) })
})

export const createProperty = asyncHandler(async (req, res) => {
  const row = await propertyService.createProperty(req.body)
  res.status(201).json({ success: true, data: serializePropertyDetail(row) })
})

export const updateProperty = asyncHandler(async (req, res) => {
  const row = await propertyService.updateProperty(req.params.id, req.body)
  res.json({ success: true, data: serializePropertyDetail(row) })
})

// 204 No Content — nothing to return after a delete (envelope skipped as
// HTTP semantics allow no body on 204). Consistent across all deletes.
export const deleteProperty = asyncHandler(async (req, res) => {
  await propertyService.deleteProperty(req.params.id)
  res.status(204).end()
})
