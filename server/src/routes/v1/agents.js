import { Router } from "express"
import * as agentsController from "../../controllers/v1/agents.js"

/**
 * /api/v1/agents — public advisor directory (read-only, Phase 11).
 *
 * Request flow: Route → Controller → Service → Drizzle → PostgreSQL, then
 * Service → Serializer → HTTP response. Agents are part of the catalog and
 * require no authentication; mutations stay on the /api/v1/admin router.
 */
const router = Router()

router.get("/", agentsController.listAgents)

export default router