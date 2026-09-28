import { asyncHandler } from "../../middleware/error.js"
import { baseUrlFromRequest } from "../../services/email/index.js"
import * as newsletterService from "../../services/newsletterService.js"
import {
  serializeCampaign,
  serializeCampaignList,
  serializeDeliveryList,
  serializeNewsletterStats,
  serializeSubscriber,
  serializeSubscriberList,
} from "../../serializers/newsletter.js"

/**
 * Newsletter controllers (Phase 10).
 *
 * The public edge only exposes subscribe (POST) and unsubscribe (GET with a
 * token that is hash-verified). Everything admin-side rides the /api/v1/admin
 * router's ADMIN gate in routes/v1/admin.js.
 */

// ── Public ─────────────────────────────────────────────────────────────

export const subscribe = asyncHandler(async (req, res) => {
  const baseUrl = baseUrlFromRequest(req)
  const { subscriber, created } = await newsletterService.subscribe(req.body.email, {
    baseUrl,
  })
  res.status(created ? 201 : 200).json({
    success: true,
    data: serializeSubscriber(subscriber),
  })
})

export const unsubscribe = asyncHandler(async (req, res) => {
  const subscriber = await newsletterService.unsubscribeToken(req.parsedQuery.token)
  res.json({ success: true, data: serializeSubscriber(subscriber) })
})

// ── Admin ──────────────────────────────────────────────────────────────

export const listSubscribers = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await newsletterService.listSubscribers(req.parsedQuery)
  res.json({
    success: true,
    data: serializeSubscriberList(items),
    meta: { page, limit, total, totalPages },
  })
})

export const stats = asyncHandler(async (_req, res) => {
  const stats = await newsletterService.newsletterStats()
  res.json({ success: true, data: serializeNewsletterStats(stats) })
})

export const listCampaigns = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await newsletterService.listCampaigns(req.parsedQuery)
  res.json({
    success: true,
    data: serializeCampaignList(items),
    meta: { page, limit, total, totalPages },
  })
})

export const createCampaign = asyncHandler(async (req, res) => {
  const campaign = await newsletterService.createCampaign(req.user.id, req.body)
  res.status(201).json({ success: true, data: serializeCampaign(campaign) })
})

export const sendTestCampaign = asyncHandler(async (req, res) => {
  const baseUrl = baseUrlFromRequest(req)
  const results = await newsletterService.sendTestCampaign(
    req.params.id,
    req.body.testEmails,
    { baseUrl },
  )
  res.status(202).json({ success: true, data: serializeDeliveryList(results) })
})

export const sendCampaign = asyncHandler(async (req, res) => {
  const baseUrl = baseUrlFromRequest(req)
  const result = await newsletterService.sendCampaignToSubscribers(req.params.id, {
    baseUrl,
  })
  res.status(202).json({ success: true, data: result })
})

export const listDeliveries = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await newsletterService.listDeliveries(req.parsedQuery)
  res.json({
    success: true,
    data: serializeDeliveryList(items),
    meta: { page, limit, total, totalPages },
  })
})