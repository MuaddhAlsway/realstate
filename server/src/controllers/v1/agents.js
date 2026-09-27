import { asyncHandler } from "../../middleware/error.js"
import * as agentsService from "../../services/agentsService.js"
import { serializePublicAgentList } from "../../serializers/agents.js"

/**
 * Public agents controller — thin HTTP → service → envelope translation.
 */

export const listAgents = asyncHandler(async (_req, res) => {
  const rows = await agentsService.listPublicAgents()
  res.json({ success: true, data: serializePublicAgentList(rows) })
})