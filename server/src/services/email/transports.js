import { createConnection } from "node:net"
import { connect as tlsConnect } from "node:tls"
import {
  EMAIL_PROVIDER,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
} from "../../config/env.js"

/**
 * Email transports (Phase 10) — one function per provider, each resolving to
 * `{ messageId: string|null }` or throwing.
 *
 * `log` (default): prints a printable receipt to stdout and resolves. This is
 * the transport used in development and under test — the API pipeline
 * (delivery ledger, failure recording, unsubscribe flows) stays fully
 * exercisable without touching the network.
 *
 * `smtp`: a compact SMTP client over node:net/node:tls (EHLO → STARTTLS →
 * AUTH PLAIN → MAIL/RCPT/DATA). No third-party dependency, so no supply-chain
 * risk for a single outbound relay. The server `250` response id is captured
 * as the provider message id. Certificate verification stays on.
 *
 * Tests can force a specific transport (e.g. one that always rejects) with
 * `setTransportOverride`.
 */

let override = null

export function setTransportOverride(transport) {
  override = transport
}

export function getTransport() {
  if (override) return override
  if (EMAIL_PROVIDER === "smtp") return smtpTransport
  return logTransport
}

/** Log transport — prints a receipt for ops/tests, never leaves the box. */
export async function logTransport(payload) {
  const { to, subject } = payload
  // eslint-disable-next-line no-console
  console.log(
    `[email:log] To=${to} Subject="${subject}" (no delivery in dev/test)`,
  )
  return { messageId: null }
}

/** Line reader over any duplex stream with a shared continuation buffer. */
function makeLineReader(socket, bufferRef) {
  return (timeoutMs = 15000) =>
    new Promise((resolve, reject) => {
      const startedAt = Date.now()
      const timer = setTimeout(() => {
        reject(new Error("SMTP read timeout"))
      }, timeoutMs)

      const drain = () => {
        const idx = bufferRef.value.indexOf("\n")
        if (idx === -1) return false
        const line = bufferRef.value.slice(0, idx).replace(/\r$/, "")
        bufferRef.value = bufferRef.value.slice(idx + 1)
        clearTimeout(timer)
        resolve(line)
        return true
      }
      if (drain()) return

      const onData = (chunk) => {
        bufferRef.value += chunk.toString("utf8")
        if (drain()) {
          socket.off("data", onData)
        }
      }
      socket.on("data", onData)
    })
}

function responseCode(line) {
  return line.slice(0, 3)
}

/** Open the cleartext or TLS socket, return it plus a line reader. */
function openSocket() {
  const bufferRef = { value: "" }
  const socket = SMTP_SECURE
    ? tlsConnect({ host: SMTP_HOST, port: SMTP_PORT, servername: SMTP_HOST })
    : createConnection({ host: SMTP_HOST, port: SMTP_PORT })
  return new Promise((resolve, reject) => {
    socket.once("error", reject)
    socket.once("connect", () =>
      resolve({ socket, readLine: makeLineReader(socket, bufferRef) }),
    )
  })
}

function upgradeToTls(socket, readLine) {
  return new Promise((resolve, reject) => {
    const bufferRef = { value: "" }
    const tls = tlsConnect({ socket, servername: SMTP_HOST })
    tls.once("error", reject)
    tls.once("secureConnect", () =>
      resolve({ socket: tls, readLine: makeLineReader(tls, bufferRef) }),
    )
    void readLine // previous reader is dropped with the cleartext socket
  })
}

async function expectCode(line, accepted, label = "response") {
  const code = responseCode(line)
  if (!accepted.some((c) => String(c) === code)) {
    throw new Error(`SMTP ${label} failed: ${line}`)
  }
  return code
}

/** Minimal SMTP client. Resolves `{ messageId }` or throws. */
export async function smtpTransport(payload) {
  if (!SMTP_HOST) throw new Error("smtpTransport requires SMTP_HOST")
  const { to, from, subject, html, text } = payload

  let { socket, readLine } = await openSocket()
  try {
    await expectCode(await readLine(), [220], "greeting")

    for (const line of [`EHLO ${SMTP_HOST.replace(/:\d+$/, "")}`]) {
      socket.write(`${line}\r\n`)
      // EHLO may be multiline (250-… many) — just read until the last one.
      let reply
      do {
        reply = await readLine()
        await expectCode(reply, [250])
      } while (/^250-/.test(reply))
    }

    if (!SMTP_SECURE) {
      socket.write("STARTTLS\r\n")
      const starttls = await readLine()
      const startCode = await expectCode(starttls, [220])
      if (startCode === "220") {
        ;({ socket, readLine } = await upgradeToTls(socket, readLine))
        socket.write(`EHLO ${SMTP_HOST.replace(/:\d+$/, "")}\r\n`)
        let reply
        do {
          reply = await readLine()
          await expectCode(reply, [250])
        } while (/^250-/.test(reply))
      }
    }

    if (SMTP_USER && SMTP_PASS) {
      socket.write(
        `AUTH PLAIN ${Buffer.from(`\0${SMTP_USER}\0${SMTP_PASS}`).toString("base64")}\r\n`,
      )
      await expectCode(await readLine(), [235], "auth")
    }

    const envelopeFrom = from ?? "no-reply@localhost"
    socket.write(`MAIL FROM:<${envelopeFrom}>\r\n`)
    await expectCode(await readLine(), [250], "mail from")
    socket.write(`RCPT TO:<${to}>\r\n`)
    await expectCode(await readLine(), [250, 251], "rcpt to")
    socket.write("DATA\r\n")
    await expectCode(await readLine(), [354], "data")

    const dataLines = [
      `From: ${from ?? "Estate <no-reply@localhost>"}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(html || text || "").toString("base64"),
    ]
    socket.write(`${dataLines.join("\r\n")}\r\n.\r\n`)
    const finalLine = await readLine()
    await expectCode(finalLine, [250], "message accepted")

    socket.write("QUIT\r\n")
    void readLine()
    const match = /(?:id|message-id)=([A-Za-z0-9._-]+)/i.exec(finalLine)
    socket.destroy()
    return { messageId: match ? match[1] : null }
  } catch (err) {
    socket.destroy()
    throw err instanceof Error ? err : new Error(String(err))
  }
}
