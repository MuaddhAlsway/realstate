import postgres from "postgres"
import { DATABASE_URL } from "./server/src/config/env.js"

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false },
})

try {
  const updated = await sql`update email_campaigns
    set status = 'SENT', sent_at = now(), updated_at = now()
    where name = 'hello' and status = 'DRAFT'
    returning id, name, status, sent_at`
  console.log(`UPDATED: ${updated.length} (${updated.map((r) => r.name).join(", ") || "-"})`)
  const after = await sql`select name, status, sent_at from email_campaigns order by created_at desc`
  for (const row of after) {
    console.log(`  ${row.status.padEnd(8)} ${row.name}${row.sent_at ? "  sent " + row.sent_at.toISOString() : ""}`)
  }
} finally {
  await sql.end()
}