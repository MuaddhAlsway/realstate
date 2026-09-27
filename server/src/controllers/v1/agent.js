import { asyncHandler } from "../../middleware/error.js"
import * as inquiryService from "../../services/inquiryService.js"
import { serializePropertyList } from "../../serializers/properties.js"
import {
  serializeAgentDashboard,
  serializeInquiryDetail,
  serializeInquiryListMany,
  serializeMessage,
  serializeNotificationList,
} from "../../serializers/inquiries.js"

/**
 * Agent-portal controllers (Phase 11). Every route is AGENT|ADMIN-gated at
 * the router; the service resolves the caller's agent profile and scopes all
 * reads to their assigned properties/inquiries + their own notifications.
 */

export const dashboard = asyncHandler(async (req, res) => {
  const result = await inquiryService.agentDashboard(req.user.id)
  res.json({ success: true, data: serializeAgentDashboard(result) })
})

export const listProperties = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await inquiryService.listAgentProperties(req.user.id, req.parsedQuery)
  res.json({
    success: true,
    data: serializePropertyList(items),
    meta: { page, limit, total, totalPages },
  })
})

export const listInquiries = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await inquiryService.listMyInquiries(req.user.id, req.user.role, req.parsedQuery)
  res.json({
    success: true,
    data: serializeInquiryListMany(items),
    meta: { page, limit, total, totalPages },
  })
})

export const getInquiry = asyncHandler(async (req, res) => {
  const row = await inquiryService.getInquiry(
    req.params.id,
    req.user.id,
    req.user.role,
  )
  res.json({ success: true, data: serializeInquiryDetail(row) })
})

export const listMessages = asyncHandler(async (req, res) => {
  const rows = await inquiryService.listMessages(
    req.params.id,
    req.user.id,
    req.user.role,
  )
  res.json({ success: true, data: rows.map(serializeMessage) })
})

export const sendMessage = asyncHandler(async (req, res) => {
  const row = await inquiryService.sendMessage(
    req.params.id,
    req.user.id,
    req.user.role,
    req.body,
  )
  res.status(201).json({ success: true, data: serializeMessage(row) })
})

export const updateStatus = asyncHandler(async (req, res) => {
  const row = await inquiryService.updateInquiryStatus(
    req.params.id,
    req.user.id,
    req.user.role,
    req.body,
  )
  res.json({ success: true, data: serializeInquiryDetail(row) })
})

export const listNotifications = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await inquiryService.listNotifications(req.user.id, req.parsedQuery)
  res.json({
    success: true,
    data: serializeNotificationList(items),
    meta: { page, limit, total, totalPages },
  })
})

export const markNotificationsRead = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await inquiryService.markNotificationsRead(req.user.id, req.body)
  res.json({
    success: true,
    data: serializeNotificationList(items),
    meta: { page: 1, limit, total, totalPages },
  })
})