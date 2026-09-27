import { asyncHandler } from "../../middleware/error.js"
import * as inquiryService from "../../services/inquiryService.js"
import {
  serializeInquiryDetail,
  serializeInquiryListMany,
  serializeMessage,
  serializeNotificationList,
} from "../../serializers/inquiries.js"

/**
 * Inquiry / client-workflow controllers (Phase 11).
 *
 * `createInquiry` is public (optionalAuth) so `req.user` may be absent — the
 * service links signed-in customers to their account. Everything else sits
 * behind `requireAuth`; scope checks (own rows / assigned agent / admin) live
 * in the service, never here.
 */

export const createInquiry = asyncHandler(async (req, res) => {
  const row = await inquiryService.createInquiry(
    { ...req.body, propertyId: req.params.id },
    { userId: req.user?.id ?? null, role: req.user?.role ?? null },
  )
  res.status(201).json({ success: true, data: serializeInquiryDetail(row) })
})

export const listMyInquiries = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await inquiryService.listMyInquiries(req.user.id, req.user.role, req.parsedQuery)
  res.json({
    success: true,
    data: serializeInquiryListMany(items),
    meta: { page, limit, total, totalPages },
  })
})

export const getMyInquiry = asyncHandler(async (req, res) => {
  const row = await inquiryService.getInquiry(
    req.params.id,
    req.user.id,
    req.user.role,
  )
  res.json({ success: true, data: serializeInquiryDetail(row) })
})

export const listInquiryMessages = asyncHandler(async (req, res) => {
  const rows = await inquiryService.listMessages(
    req.params.id,
    req.user.id,
    req.user.role,
  )
  res.json({ success: true, data: rows.map(serializeMessage) })
})

export const sendInquiryMessage = asyncHandler(async (req, res) => {
  const row = await inquiryService.sendMessage(
    req.params.id,
    req.user.id,
    req.user.role,
    req.body,
  )
  res.status(201).json({ success: true, data: serializeMessage(row) })
})

export const updateInquiryStatus = asyncHandler(async (req, res) => {
  const row = await inquiryService.updateInquiryStatus(
    req.params.id,
    req.user.id,
    req.user.role,
    req.body,
  )
  res.json({ success: true, data: serializeInquiryDetail(row) })
})

export const listMyNotifications = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await inquiryService.listNotifications(req.user.id, req.parsedQuery)
  res.json({
    success: true,
    data: serializeNotificationList(items),
    meta: { page, limit, total, totalPages },
  })
})

export const markMyNotificationsRead = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await inquiryService.markNotificationsRead(req.user.id, req.body)
  res.json({
    success: true,
    data: serializeNotificationList(items),
    meta: { page: 1, limit, total, totalPages },
  })
})