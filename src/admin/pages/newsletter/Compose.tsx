import { useState } from "react"
import { Link } from "react-router-dom"
import {
  newsletterAdminApi,
  type NewsletterCampaign,
  type NewsletterDelivery,
} from "../../../services/newsletter"
import { Button, EmptyState, Field, TextInput, Textarea } from "../../ui"
import { useToast } from "../../Toast"

const PLACEHOLDER_HTML = `<p>Hello {{EMAIL}},</p>

<p>Follow the latest listings before anyone else does — new properties, open
days and market notes from the Estate team.</p>

<p><a href="{{UNSUBSCRIBE_URL}}">Unsubscribe</a></p>`

export default function NewsletterCompose() {
  const { toast } = useToast()

  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [html, setHtml] = useState(PLACEHOLDER_HTML)
  const [text, setText] = useState("")

  const [draft, setDraft] = useState<NewsletterCampaign | null>(null)
  const [saving, setSaving] = useState(false)
  const [testInput, setTestInput] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<NewsletterDelivery[]>([])
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{
    sent: number, failed: number, total: number, status: string,
  } | null>(null)

  const valid = name.trim() && subject.trim() && html.trim() && text.trim()

  const saveDraft = async () => {
    if (!valid) return
    setSaving(true)
    try {
      const created = await newsletterAdminApi.createCampaign({
        name: name.trim(),
        subject: subject.trim(),
        htmlContent: html.trim(),
        textContent: text.trim(),
      })
      setDraft(created)
      setTestResults([])
      setBroadcastResult(null)
      toast("Draft saved")
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save draft", "error")
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async () => {
    if (!draft) {
      toast("Save the draft first", "error")
      return
    }
    const emails = testInput
      .split(/[\s,;]+/)
      .map((email) => email.trim())
      .filter(Boolean)
    if (emails.length === 0) {
      toast("Add at least one test email", "error")
      return
    }
    setTesting(true)
    try {
      const results = await newsletterAdminApi.sendTest(draft.id, emails)
      setTestResults(results)
      toast(`Test sent to ${results.length} address(es)`)
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not send test", "error")
    } finally {
      setTesting(false)
    }
  }

  const broadcast = async () => {
    if (!draft) return
    if (!window.confirm("Broadcast this campaign to all active subscribers?")) return
    setBroadcasting(true)
    try {
      const result = await newsletterAdminApi.sendCampaign(draft.id)
      setBroadcastResult(result)
      setDraft((current) => (current ? { ...current, status: result.status } : current))
      toast(
        result.total === 0
          ? "No active subscribers to broadcast to"
          : result.failed > 0
            ? `Broadcast finished: ${result.sent} of ${result.total} sent — ${result.failed} failed`
            : `Campaign sent to ${result.sent} subscriber(s)`,
      )
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not broadcast", "error")
    } finally {
      setBroadcasting(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-light" style={{ fontFamily: "var(--font-display)" }}>
            Compose email
          </h1>
          <p className="text-sm font-light text-[#6B6560] mt-1">
            Draft → test to your own inbox → broadcast to subscribers.
          </p>
        </div>
        <Link
          to="/admin/newsletter/campaigns"
          className="text-xs tracking-[0.2em] uppercase font-light border border-[#0F0F0D]/25 px-5 py-3 cursor-pointer hover:bg-[#EDE6D6]"
        >
          View campaigns
        </Link>
      </div>

      <div className="flex flex-col gap-6 mb-10">
        <div className="p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,15,13,0.1)" }}>
          <h2 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-4">
            Campaign
          </h2>
          <div className="flex flex-col gap-4">
            <Field label="Name">
              <TextInput value={name} onChange={setName} placeholder="May newsletter" />
            </Field>
            <Field label="Subject">
              <TextInput value={subject} onChange={setSubject} placeholder="Fresh picks from Estate" />
            </Field>
            <Field label="HTML body" hint="You may use {{EMAIL}} and {{UNSUBSCRIBE_URL}} per recipient.">
              <Textarea value={html} onChange={setHtml} rows={10} />
            </Field>
            <Field label="Plain-text body">
              <Textarea value={text} onChange={setText} rows={5} />
            </Field>
            <div className="flex justify-end">
              <Button variant="gold" disabled={saving || !valid} onClick={saveDraft}>
                {draft ? "Update draft" : "Create draft"}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,15,13,0.1)" }}>
          <h2 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-4">
            Test {draft ? `— ${draft.name}` : " (save the draft first)"}
          </h2>
          <div className="flex flex-col gap-4">
            <Field label="Test addresses" hint="Comma or line separated — up to 10.">
              <Textarea
                value={testInput}
                onChange={setTestInput}
                rows={2}
                placeholder="you@example.com"
              />
            </Field>
            <div className="flex justify-end">
              <Button variant="ghost" disabled={testing || !draft} onClick={sendTest}>
                {testing ? "Sending…" : "Send test"}
              </Button>
            </div>
            {testResults.length > 0 ? (
              <div className="mb-0">
                {testResults.map((result) => (
                  <p key={result.id} className="text-xs font-light text-[#6B6560]">
                    {result.recipientEmail} —{" "}
                    <span className={result.status === "FAILED" ? "text-[#A03A2E]" : "text-[#2e7d32]"}>
                      {result.status}
                    </span>
                    {result.errorMessage ? ` (${result.errorMessage})` : ""}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,15,13,0.1)" }}>
          <h2 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-4">
            Broadcast {draft ? `— ${draft.status}` : ""}
          </h2>
          <p className="text-sm font-light text-[#6B6560] mb-6">
            Sends one personalized email to every active subscriber, excluding anyone who
            unsubscribed. This cannot be undone.
          </p>
          <div className="flex justify-end">
            <Button
              variant="danger"
              disabled={broadcasting || !draft || draft.status !== "DRAFT"}
              onClick={broadcast}
            >
              {broadcasting ? "Broadcasting…" : "Broadcast to subscribers"}
            </Button>
          </div>
          {broadcastResult ? (
            <div className="mt-6 pt-4 border-t border-[#0F0F0D]/10">
              {broadcastResult.status === "FAILED" ? (
                <EmptyState message="Broadcast recorded as failed — check the delivery history." />
              ) : (
                <p className="text-sm font-light text-[#2e7d32]">
                  Sent to {broadcastResult.sent} of {broadcastResult.total} subscriber
                  {broadcastResult.total === 1 ? "" : "s"} ({broadcastResult.failed} failed).
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}