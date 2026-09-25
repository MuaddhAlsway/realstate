import { useEffect, useState } from "react"
import {
  contentApi,
  type ContentSectionName,
} from "../../services/admin"
import { CONTENT_DEFAULTS, type SiteContent } from "../../services/siteContent"
import { MediaUploader } from "../MediaUploader"
import { mediaThumb, type UploadResult } from "../../services/media"
import { useToast } from "../Toast"
import { Button, Spinner, TextInput, Textarea } from "../ui"

/*
 * CMS editor. The server is the single source of truth for section shape and
 * validation (.strict() per-section Zod schema): unknown keys and invalid
 * payloads are rejected with a clear message, which we surface verbatim.
 */

type AnyRecord = Record<string, unknown>

const TABS: Array<{ name: ContentSectionName, label: string, inHero: boolean }> = [
  { name: "home", label: "Home", inHero: true },
  { name: "about", label: "About", inHero: true },
  { name: "contact", label: "Contact", inHero: true },
  { name: "footer", label: "Footer", inHero: true },
  { name: "seo", label: "SEO", inHero: true },
]

function TextField({ label, value, onChange }: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <span className="block text-[11px] tracking-[0.18em] uppercase font-light mb-2 text-[#6B6560]">
        {label}
      </span>
      <TextInput value={value} onChange={onChange} />
    </div>
  )
}

function TextAreaField({ label, value, onChange }: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <span className="block text-[11px] tracking-[0.18em] uppercase font-light mb-2 text-[#6B6560]">
        {label}
      </span>
      <Textarea value={value} onChange={onChange} rows={4} />
    </div>
  )
}

function StringsEditor({ label, value, onChange }: {
  label: string
  value: string[]
  onChange: (value: string[]) => void
}) {
  const update = (index: number, next: string) => {
    onChange(value.map((item, i) => (i === index ? next : item)))
  }
  return (
    <div>
      <span className="block text-[11px] tracking-[0.18em] uppercase font-light mb-2 text-[#6B6560]">
        {label}
      </span>
      <div className="flex flex-col gap-2">
        {value.length === 0 && (
          <p className="text-xs font-light text-[#A09890]">No items.</p>
        )}
        {value.map((item, index) => (
          <div key={index} className="flex gap-2 items-center">
            <div className="flex-1">
              <TextInput value={item} onChange={(next) => update(index, next)} />
            </div>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label="Remove"
              className="text-[#A03A2E] text-xl cursor-pointer"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <Button variant="ghost" className="mt-3" onClick={() => onChange([...value, ""])}>
        + Add line
      </Button>
    </div>
  )
}

interface RowField {
  key: string
  label: string
  type: "text" | "number"
}

function RowArrayEditor({ label, fields, value, onChange }: {
  label: string
  fields: RowField[]
  value: AnyRecord[]
  onChange: (value: AnyRecord[]) => void
}) {
  const update = (index: number, patch: AnyRecord) => {
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }
  const empty = (): AnyRecord =>
    Object.fromEntries(fields.map((field) => [field.key, field.type === "number" ? 0 : ""]))
  return (
    <div>
      <span className="block text-[11px] tracking-[0.18em] uppercase font-light mb-2 text-[#6B6560]">
        {label}
      </span>
      <div className="flex flex-col gap-4">
        {value.length === 0 && (
          <p className="text-xs font-light text-[#A09890]">No items.</p>
        )}
        {value.map((item, index) => (
          <div
            key={index}
            className="p-4 flex flex-col gap-3"
            style={{ backgroundColor: "#EDE6D6" }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fields.map((field) => (
                <div key={field.key}>
                  <span className="block text-[10px] tracking-[0.18em] uppercase font-light mb-1 text-[#6B6560]">
                    {field.label}
                  </span>
                  <TextInput
                    type={field.type === "number" ? "number" : "text"}
                    value={String(item[field.key] ?? "")}
                    onChange={(next) =>
                      update(index, {
                        [field.key]: field.type === "number" ? Number(next) : next,
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              className="self-end text-xs tracking-[0.15em] uppercase font-light text-[#A03A2E] cursor-pointer"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <Button variant="ghost" className="mt-3" onClick={() => onChange([...value, empty()])}>
        + Add item
      </Button>
    </div>
  )
}

const STAT_FIELDS: RowField[] = [
  { key: "label", label: "Label", type: "text" },
  { key: "sub", label: "Subtitle", type: "text" },
  { key: "prefix", label: "Prefix", type: "text" },
  { key: "suffix", label: "Suffix", type: "text" },
  { key: "val", label: "Value", type: "number" },
  { key: "decimals", label: "Decimals", type: "number" },
]

const NUMBERED_FIELDS: RowField[] = [
  { key: "num", label: "Number", type: "text" },
  { key: "title", label: "Title", type: "text" },
  { key: "text", label: "Text", type: "text" },
]

const LINK_FIELDS: RowField[] = [
  { key: "label", label: "Label", type: "text" },
  { key: "href", label: "Href", type: "text" },
]

type FieldSpec =
  | { type: "string"; key: string; label: string }
  | { type: "textarea"; key: string; label: string }
  | { type: "strings"; key: string; label: string }
  | { type: "stats"; key: string; label: string }
  | { type: "numbered"; key: string; label: string }
  | { type: "links"; key: string; label: string }
  | { type: "image"; key: string; publicIdKey: string; label: string }

const SECTION_FIELDS: Record<ContentSectionName, FieldSpec[]> = {
  home: [
    { type: "string", key: "heroEyebrow", label: "Hero eyebrow" },
    { type: "string", key: "heroLine1", label: "Hero line 1" },
    { type: "string", key: "heroLine2", label: "Hero line 2" },
    { type: "string", key: "heroLine3", label: "Hero line 3" },
    { type: "string", key: "heroDescription", label: "Hero description" },
    { type: "image", key: "heroImage", publicIdKey: "heroImagePublicId", label: "Hero image" },
    { type: "string", key: "heroImageAlt", label: "Hero image alt" },
    { type: "string", key: "showcaseEyebrow", label: "Showcase eyebrow" },
    { type: "string", key: "showcaseHint", label: "Showcase hint" },
    { type: "string", key: "featuredEyebrow", label: "Featured eyebrow" },
    { type: "string", key: "featuredTitle", label: "Featured title" },
    { type: "string", key: "featuredCta", label: "Featured CTA" },
    { type: "string", key: "discoveryEyebrow", label: "Discovery eyebrow" },
    { type: "string", key: "discoveryTitle", label: "Discovery title" },
    { type: "stats", key: "stats", label: "Stats" },
    { type: "string", key: "whyUsEyebrow", label: "Why-us eyebrow" },
    { type: "string", key: "whyUsTitle", label: "Why-us title" },
    { type: "numbered", key: "whyUs", label: "Why-us items" },
    { type: "textarea", key: "archStatement", label: "Architectural statement" },
    { type: "string", key: "ctaEyebrow", label: "CTA eyebrow" },
    { type: "string", key: "ctaTitle", label: "CTA title" },
    { type: "string", key: "ctaPrimaryLabel", label: "CTA primary label" },
    { type: "string", key: "ctaSecondaryLabel", label: "CTA secondary label" },
  ],
  about: [
    { type: "string", key: "eyebrow", label: "Eyebrow" },
    { type: "string", key: "heading", label: "Heading" },
    { type: "textarea", key: "intro", label: "Intro" },
    { type: "textarea", key: "body1", label: "Body 1" },
    { type: "textarea", key: "body2", label: "Body 2" },
    { type: "image", key: "image", publicIdKey: "imagePublicId", label: "Image" },
    { type: "string", key: "imageAlt", label: "Image alt" },
    { type: "string", key: "valuesEyebrow", label: "Values eyebrow" },
    { type: "numbered", key: "values", label: "Values" },
    { type: "string", key: "teamEyebrow", label: "Team eyebrow" },
    { type: "string", key: "ctaTitle", label: "CTA title" },
    { type: "string", key: "ctaPrimaryLabel", label: "CTA primary label" },
    { type: "string", key: "ctaSecondaryLabel", label: "CTA secondary label" },
  ],
  contact: [
    { type: "string", key: "eyebrow", label: "Eyebrow" },
    { type: "string", key: "heading", label: "Heading" },
    { type: "string", key: "officesEyebrow", label: "Offices eyebrow" },
    { type: "string", key: "officeName", label: "Office name" },
    { type: "strings", key: "addressLines", label: "Address lines" },
    { type: "string", key: "directEyebrow", label: "Direct eyebrow" },
    { type: "string", key: "salesLabel", label: "Sales label" },
    { type: "string", key: "salesPhone", label: "Sales phone" },
    { type: "string", key: "emailLabel", label: "Email label" },
    { type: "string", key: "email", label: "Email" },
    { type: "string", key: "hoursEyebrow", label: "Hours eyebrow" },
    { type: "strings", key: "hoursLines", label: "Hours lines" },
    { type: "string", key: "successTitle", label: "Success title" },
    { type: "textarea", key: "successText", label: "Success text" },
    { type: "string", key: "sendAnotherLabel", label: "Send-another label" },
  ],
  footer: [
    { type: "string", key: "brandName", label: "Brand name" },
    { type: "textarea", key: "tagline", label: "Tagline" },
    { type: "string", key: "propertiesTitle", label: "Properties heading" },
    { type: "string", key: "companyTitle", label: "Company heading" },
    { type: "string", key: "contactTitle", label: "Contact heading" },
    { type: "strings", key: "addressLines", label: "Address lines" },
    { type: "string", key: "phone", label: "Phone" },
    { type: "string", key: "email", label: "Email" },
    { type: "string", key: "newsletterTitle", label: "Newsletter title" },
    { type: "string", key: "newsletterPlaceholder", label: "Newsletter placeholder" },
    { type: "links", key: "socials", label: "Socials" },
    { type: "links", key: "propertyLinks", label: "Property links" },
    { type: "links", key: "companyLinks", label: "Company links" },
    { type: "links", key: "legalLinks", label: "Legal links" },
    { type: "string", key: "copyright", label: "Copyright" },
  ],
  seo: [
    { type: "string", key: "title", label: "Title" },
    { type: "textarea", key: "description", label: "Description" },
    { type: "string", key: "ogTitle", label: "OpenGraph title" },
    { type: "textarea", key: "ogDescription", label: "OpenGraph description" },
  ],
}

function ImageField({ label, value, onChange }: {
  label: string
  value: {
    url: string
    publicIdKey: string
    publicId: string
  }
  onChange: (patch: AnyRecord) => void
}) {
  return (
    <div>
      <span className="block text-[11px] tracking-[0.18em] uppercase font-light mb-2 text-[#6B6560]">
        {label}
      </span>
      {value.url && (
        <img
          src={mediaThumb(value.url)}
          alt=""
          className="h-40 w-full object-cover mb-3"
          loading="lazy"
        />
      )}
      <TextInput
        value={value.url}
        onChange={(url) =>
          // Pasting a URL is always an explicit switch to a legacy (non-
          // managed) image — clear the provider ref so the old uploaded
          // asset is retired on the next publish.
          onChange({ [value.publicIdKey]: "", url })
        }
        placeholder="Image URL"
      />
      <div className="mt-3">
        <MediaUploader
          purpose="cms"
          multiple={false}
          label="Upload an image"
          onComplete={(results: UploadResult[]) => {
            const result = results[0]
            if (!result) return
            onChange({
              url: result.url,
              [value.publicIdKey]: result.publicId,
            })
          }}
        />
      </div>
    </div>
  )
}

function EditorField({ spec, value, onChange }: {
  spec: FieldSpec
  value: AnyRecord
  onChange: (patch: AnyRecord) => void
}) {
  const current = value[spec.key]
  switch (spec.type) {
    case "string":
      return (
        <TextField
          label={spec.label}
          value={typeof current === "string" ? current : String(current ?? "")}
          onChange={(next) => onChange({ [spec.key]: next })}
        />
      )
    case "textarea":
      return (
        <TextAreaField
          label={spec.label}
          value={typeof current === "string" ? current : String(current ?? "")}
          onChange={(next) => onChange({ [spec.key]: next })}
        />
      )
    case "strings":
      return (
        <StringsEditor
          label={spec.label}
          value={Array.isArray(current) ? (current as string[]) : []}
          onChange={(next) => onChange({ [spec.key]: next })}
        />
      )
    case "stats":
      return (
        <RowArrayEditor
          label={spec.label}
          fields={STAT_FIELDS}
          value={Array.isArray(current) ? (current as AnyRecord[]) : []}
          onChange={(next) => onChange({ [spec.key]: next })}
        />
      )
    case "numbered":
      return (
        <RowArrayEditor
          label={spec.label}
          fields={NUMBERED_FIELDS}
          value={Array.isArray(current) ? (current as AnyRecord[]) : []}
          onChange={(next) => onChange({ [spec.key]: next })}
        />
      )
    case "links":
      return (
        <RowArrayEditor
          label={spec.label}
          fields={LINK_FIELDS}
          value={Array.isArray(current) ? (current as AnyRecord[]) : []}
          onChange={(next) => onChange({ [spec.key]: next })}
        />
      )
    case "image":
      return (
        <ImageField
          label={spec.label}
          value={{
            url: typeof current === "string" ? current : "",
            publicIdKey: spec.publicIdKey,
            publicId:
              typeof value[spec.publicIdKey] === "string"
                ? (value[spec.publicIdKey] as string)
                : "",
          }}
          onChange={onChange}
        />
      )
  }
}

export default function Content() {
  const { toast } = useToast()
  const [active, setActive] = useState<ContentSectionName>("home")
  const [values, setValues] = useState<Record<ContentSectionName, AnyRecord>>(() => {
    const seeded: Record<ContentSectionName, AnyRecord> = {
      home: { ...CONTENT_DEFAULTS.home } as unknown as AnyRecord,
      about: { ...CONTENT_DEFAULTS.about } as unknown as AnyRecord,
      contact: { ...CONTENT_DEFAULTS.contact } as unknown as AnyRecord,
      footer: { ...CONTENT_DEFAULTS.footer } as unknown as AnyRecord,
      seo: { ...CONTENT_DEFAULTS.seo } as unknown as AnyRecord,
    }
    return seeded
  })
  const [syncedFromLive, setSyncedFromLive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    contentApi
      .all()
      .then((live) => {
        if (cancelled) return
        const next = { ...values }
        ;(Object.keys(live) as ContentSectionName[]).forEach((name) => {
          next[name] = { ...(live[name] ?? {}) }
        })
        setValues(next)
      })
      .catch(() => {
        /* defaults already in place */
      })
      .finally(() => {
        if (!cancelled) setSyncedFromLive(true)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!syncedFromLive) return <Spinner />

  const sectionFile = values[active]
  const patchSection = (patch: AnyRecord) =>
    setValues((v) => ({ ...v, [active]: { ...v[active], ...patch } }))

  const save = async () => {
    setError(null)
    setSaving(true)
    try {
      await contentApi.updateSection(active, values[active])
      toast("Content published")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish content")
    } finally {
      setSaving(false)
    }
  }

  const reset = () =>
    setValues((v) => ({
      ...v,
      [active]: { ...(CONTENT_DEFAULTS[active] as unknown as AnyRecord) },
    }))

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-light" style={{ fontFamily: "var(--font-display)" }}>
        Content
      </h1>
      <p className="text-sm font-light text-[#6B6560] mt-1 mb-8">
        Edit the copy shown on the public site. Publishing replaces the whole section — any key
        omitted is removed from the live section.
      </p>

      <div className="flex gap-1 mb-10 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.name}
            type="button"
            onClick={() => setActive(tab.name)}
            className="px-5 py-2.5 text-xs tracking-[0.2em] uppercase font-light transition-colors cursor-pointer"
            style={{
              backgroundColor: active === tab.name ? "#0F0F0D" : "transparent",
              color: active === tab.name ? "#F5F0E8" : "#6B6560",
              border: "1px solid rgba(15,15,13,0.2)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <p
          className="mb-6 text-sm font-light px-4 py-3"
          style={{ backgroundColor: "#A03A2E18", color: "#A03A2E", border: "1px solid #A03A2E40" }}
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-8">
        {SECTION_FIELDS[active].map((spec) => (
          <EditorField
            key={spec.key}
            spec={spec}
            value={sectionFile}
            onChange={patchSection}
          />
        ))}
      </div>

      <div className="sticky bottom-0 mt-12 py-4 flex justify-end gap-3 bg-[#F5F0E8]/90 backdrop-blur">
        <Button variant="ghost" onClick={reset} disabled={saving}>
          Reset to defaults
        </Button>
        <Button variant="gold" onClick={save} disabled={saving}>
          {saving ? "Publishing…" : "Publish changes"}
        </Button>
      </div>
    </div>
  )
}