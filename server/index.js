import { fileURLToPath } from "node:url"
import { createApp } from "./src/app.js"
import { APP_NAME, PORT } from "./src/config/env.js"
import { closeDatabase } from "./src/db/index.js"

const isEntry =
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === process.argv[1]

if (isEntry) {
  const app = createApp()

  const server = app.listen(PORT, () => {
    const base = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`
    // eslint-disable-next-line no-console
    console.log(`${APP_NAME} → ${base}/api/health`)
  })

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} received — closing gracefully`)
    server.close()
    await closeDatabase().catch(() => {})
    process.exit(0)
    // Safety net: force-exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 10_000).unref()
  }

  process.on("SIGINT", () => shutdown("SIGINT"))
  process.on("SIGTERM", () => shutdown("SIGTERM"))
}

export default createApp
