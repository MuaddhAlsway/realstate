import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  adminApi,
  type AdminAgent,
} from "../../services/admin"
import { useToast } from "../Toast"
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  Spinner,
  Table,
  TextInput,
  formatDate,
} from "../ui"

interface AgentForm {
  name: string
  role: string
  languages: string
  experienceYears: string
  phone: string
  email: string
  imageUrl: string
}

export default function Agents() {
  const [rows, setRows] = useState<AdminAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminAgent | null>(null)
  const [form, setForm] = useState<AgentForm>({
    name: "", role: "", languages: "", experienceYears: "0", phone: "", email: "", imageUrl: "",
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { toast } = useToast()

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    adminApi
      .agents()
      .then((items) => setRows(items))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load agents")
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openEdit = (agent: AdminAgent) => {
    setEditing(agent)
    setForm({
      name: agent.name,
      role: agent.role ?? "",
      languages: agent.languages ?? "",
      experienceYears: String(agent.experienceYears),
      phone: agent.phone ?? "",
      email: agent.email ?? "",
      imageUrl: agent.imageUrl ?? "",
    })
    setFormError(null)
  }

  const save = async () => {
    if (!editing) return
    if (!form.name.trim()) {
      setFormError("Name is required.")
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const updated = await adminApi.updateAgent(editing.id, {
        name: form.name.trim(),
        role: form.role.trim() === "" ? null : form.role.trim(),
        languages: form.languages.trim() === "" ? null : form.languages.trim(),
        experienceYears: Math.max(0, Math.round(Number(form.experienceYears) || 0)),
        phone: form.phone.trim() === "" ? null : form.phone.trim(),
        email: form.email.trim() === "" ? null : form.email.trim(),
        imageUrl: form.imageUrl.trim() === "" ? null : form.imageUrl.trim(),
      })
      toast("Agent updated")
      setRows((current) =>
        current.map((agent) => (agent.id === updated.id ? updated : agent)),
      )
      setEditing(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not update agent")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-light" style={{ fontFamily: "var(--font-display)" }}>
        Agents
      </h1>
      <p className="text-sm font-light text-[#6B6560] mt-1 mb-8">
        {rows.length} team members with public profiles
      </p>

      {error ? (
        <EmptyState message={error} />
      ) : loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No agents found." />
      ) : (
        <Table headers={["", "Name", "Role", "Account", "Experience", "Contact", ""]}>
          {rows.map((agent) => (
            <tr
              key={agent.id}
              className="border-b border-[#0F0F0D]/8 hover:bg-[#EDE6D6]/60 transition-colors"
            >
              <td className="px-4 py-3 w-14">
                {agent.imageUrl ? (
                  <img src={agent.imageUrl} alt="" className="w-10 h-10 object-cover rounded-full" loading="lazy" />
                ) : (
                  <span className="block w-10 h-10 rounded-full bg-[#EDE6D6]" />
                )}
              </td>
              <td className="px-4 py-3">
                <Link
                  to={`/agents`}
                  className="text-sm font-light text-[#0F0F0D] hover:text-[#8a6d38]"
                >
                  {agent.name}
                </Link>
                <p className="text-xs font-light text-[#A09890]">{agent.phone ?? ""}</p>
              </td>
              <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                {agent.role ?? "—"}
              </td>
              <td className="px-4 py-3">
                <Badge tone={agent.user?.role === "ADMIN" ? "dark" : "gold"}>
                  {agent.user?.role ?? "no account"}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                {agent.experienceYears} yrs
              </td>
              <td className="px-4 py-3 text-xs font-light text-[#A09890]">
                {agent.email ?? "—"}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => openEdit(agent)}
                  className="text-xs tracking-[0.15em] uppercase font-light text-[#8a6d38] cursor-pointer"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit agent"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Name">
            <TextInput value={form.name} onChange={(name) => setForm({ ...form, name })} />
          </Field>
          <Field label="Role">
            <TextInput
              value={form.role}
              onChange={(role) => setForm({ ...form, role })}
              placeholder="e.g. Senior Advisor"
            />
          </Field>
          <Field label="Languages">
            <TextInput
              value={form.languages}
              onChange={(languages) => setForm({ ...form, languages })}
              placeholder="e.g. Arabic, English"
            />
          </Field>
          <Field label="Experience (years)">
            <TextInput
              value={form.experienceYears}
              onChange={(experienceYears) => setForm({ ...form, experienceYears })}
              type="number"
            />
          </Field>
          <Field label="Phone">
            <TextInput
              value={form.phone}
              onChange={(phone) => setForm({ ...form, phone })}
              placeholder="+966 ..."
            />
          </Field>
          <Field label="Email">
            <TextInput
              value={form.email}
              onChange={(email) => setForm({ ...form, email })}
              placeholder="agent@estate.sa"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Profile image URL">
              <TextInput
                value={form.imageUrl}
                onChange={(imageUrl) => setForm({ ...form, imageUrl })}
                placeholder="https://..."
              />
            </Field>
          </div>
        </div>

        {formError && (
          <p
            className="mt-6 text-sm font-light px-4 py-3"
            style={{ backgroundColor: "#A03A2E18", color: "#A03A2E", border: "1px solid #A03A2E40" }}
            role="alert"
          >
            {formError}
          </p>
        )}

        <div className="mt-8 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="gold" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save agent"}
          </Button>
        </div>
      </Modal>
    </div>
  )
}