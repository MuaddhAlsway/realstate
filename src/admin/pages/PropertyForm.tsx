import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  adminApi,
  type AdminImageInput,
  type AdminPropertyDetail,
  type AdminPropertyInput,
  type AgentOption,
  type AmenityOption,
  type NeighborhoodOption,
  type PropertyPurpose,
  type PropertyStatus,
  type PropertyType,
} from "../../services/admin"
import { useToast } from "../Toast"
import {
  Button,
  EmptyState,
  Field,
  SelectInput,
  Spinner,
  TextInput,
  Textarea,
  Toggle,
} from "../ui"

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const TYPE_OPTIONS = [
  { value: "VILLA", label: "Villa" },
  { value: "APARTMENT", label: "Apartment" },
  { value: "PENTHOUSE", label: "Penthouse" },
  { value: "DUPLEX", label: "Duplex" },
]

const PURPOSE_OPTIONS = [
  { value: "SALE", label: "For sale" },
  { value: "RENT", label: "For rent" },
]

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Available" },
  { value: "PENDING", label: "Pending" },
  { value: "SOLD", label: "Sold" },
  { value: "RENTED", label: "Rented" },
  { value: "DRAFT", label: "Draft" },
]

interface FormState {
  title: string
  slug: string
  slugTouched: boolean
  description: string
  propertyType: PropertyType
  purpose: PropertyPurpose
  status: PropertyStatus
  price: string
  currency: string
  bedrooms: string
  bathrooms: string
  area: string
  city: string
  district: string
  address: string
  latitude: string
  longitude: string
  featured: boolean
  agentId: string
  neighborhoodId: string
  images: AdminImageInput[]
  amenities: string[]
}

function emptyForm(): FormState {
  return {
    title: "", slug: "", slugTouched: false, description: "",
    propertyType: "VILLA", purpose: "SALE", status: "DRAFT",
    price: "", currency: "SAR", bedrooms: "2", bathrooms: "2", area: "",
    city: "", district: "", address: "", latitude: "", longitude: "",
    featured: false, agentId: "", neighborhoodId: "", images: [], amenities: [],
  }
}

function formFromDetail(d: AdminPropertyDetail): FormState {
  return {
    title: d.title,
    slug: d.slug,
    slugTouched: true,
    description: d.description ?? "",
    propertyType: d.propertyType,
    purpose: d.purpose,
    status: d.status,
    price: String(d.price),
    currency: d.currency,
    bedrooms: String(d.bedrooms),
    bathrooms: String(d.bathrooms),
    area: d.area != null ? String(d.area) : "",
    city: d.city,
    district: d.district ?? "",
    address: d.address ?? "",
    latitude: d.latitude != null ? String(d.latitude) : "",
    longitude: d.longitude != null ? String(d.longitude) : "",
    featured: d.featured,
    agentId: d.agent?.id ?? "",
    neighborhoodId: d.neighborhood?.id ?? "",
    images: d.images.map((image) => ({
      url: image.url,
      altText: image.altText,
      displayOrder: image.displayOrder,
      isCover: image.isCover,
    })),
    amenities: [...d.amenities],
  }
}

function buildInput(form: FormState): AdminPropertyInput {
  const num = (value: string): number | undefined => {
    if (value.trim() === "") return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return {
    title: form.title.trim(),
    slug: form.slug.trim() || slugify(form.title),
    description: form.description.trim() === "" ? null : form.description.trim(),
    propertyType: form.propertyType,
    price: num(form.price) ?? 0,
    city: form.city.trim(),
    purpose: form.purpose,
    status: form.status,
    currency: form.currency.trim() || "SAR",
    bedrooms: num(form.bedrooms) ?? 0,
    bathrooms: num(form.bathrooms) ?? 0,
    area: num(form.area) ?? null,
    district: form.district.trim() === "" ? null : form.district.trim(),
    address: form.address.trim() === "" ? null : form.address.trim(),
    latitude: num(form.latitude) ?? null,
    longitude: num(form.longitude) ?? null,
    featured: form.featured,
    agentId: form.agentId || null,
    neighborhoodId: form.neighborhoodId || null,
    images: form.images.map((image, index) => ({
      url: image.url.trim(),
      altText: image.altText?.trim() === "" ? null : image.altText?.trim(),
      displayOrder: image.displayOrder ?? index,
      isCover: image.isCover ?? false,
    })),
    amenities: form.amenities,
  }
}

/** Only include keys whose value differs from the initial payload (PATCH semantics). */
function diffInput(
  initial: AdminPropertyInput,
  current: AdminPropertyInput,
): Partial<AdminPropertyInput> {
  const patch: Partial<AdminPropertyInput> = {}
  const keys = new Set([
    ...(Object.keys(initial) as (keyof AdminPropertyInput)[]),
    ...(Object.keys(current) as (keyof AdminPropertyInput)[]),
  ])
  for (const key of keys) {
    const a = initial[key]
    const b = current[key]
    const equal = Array.isArray(a) && Array.isArray(b)
      ? JSON.stringify(a) === JSON.stringify(b)
      : a === b
    if (!equal) (patch as Record<keyof AdminPropertyInput, unknown>)[key] = b
  }
  return patch
}

function ImageManager({
  images,
  onChange,
}: {
  images: AdminImageInput[]
  onChange: (images: AdminImageInput[]) => void
}) {
  const update = (index: number, patch: Partial<AdminImageInput>) => {
    const next = images.map((image, i) => (i === index ? { ...image, ...patch } : image))
    onChange(next)
  }
  const remove = (index: number) => onChange(images.filter((_, i) => i !== index))
  const cover = (index: number) =>
    onChange(images.map((image, i) => ({ ...image, isCover: i === index })))

  return (
    <div className="flex flex-col gap-3">
      {images.length === 0 && (
        <p className="text-xs font-light text-[#A09890]">
          No images yet — add at least one before saving.
        </p>
      )}
      {images.map((image, index) => (
        <div
          key={index}
          className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 items-center p-3"
          style={{ backgroundColor: "#EDE6D6" }}
        >
          <button
            type="button"
            onClick={() => cover(index)}
            title={image.isCover ? "Cover image" : "Set as cover"}
            className="w-9 h-9 flex items-center justify-center text-lg cursor-pointer"
            style={{
              backgroundColor: image.isCover ? "#C9A96E28" : "transparent",
              color: image.isCover ? "#8a6d38" : "#A09890",
            }}
          >
            {image.isCover ? "★" : "☆"}
          </button>
          <TextInput
            value={image.url}
            onChange={(url) => update(index, { url })}
            placeholder="Image URL"
          />
          <TextInput
            value={image.altText ?? ""}
            onChange={(altText) => update(index, { altText })}
            placeholder="Alt text"
          />
          <button
            type="button"
            onClick={() => remove(index)}
            aria-label="Remove image"
            className="text-[#A03A2E] text-xl cursor-pointer"
          >
            ×
          </button>
        </div>
      ))}
      <Button
        variant="ghost"
        onClick={() => onChange([...images, { url: "", isCover: images.length === 0 }])}
      >
        + Add image
      </Button>
      {images.filter((image) => image.isCover).length > 1 ? (
        <p className="text-xs font-light text-[#A03A2E]">
          Only one image can be the cover — the server rejects multiple covers.
        </p>
      ) : null}
    </div>
  )
}

export default function PropertyForm({ mode }: { mode: "new" | "edit" }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [form, setFormState] = useState<FormState>(emptyForm)
  const [initial, setInitial] = useState<AdminPropertyInput | null>(null)
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodOption[]>([])
  const [amenityOptions, setAmenityOptions] = useState<AmenityOption[]>([])
  const [selectedAmenities, setSelectedAmenities] = useState<Set<string>>(new Set())
  const [customAmenity, setCustomAmenity] = useState("")
  const [loading, setLoading] = useState(mode === "edit")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setForm = (patch: Partial<FormState>) => setFormState((f) => ({ ...f, ...patch }))

  const applySlug = () => {
    if (!form.slugTouched && form.title.trim()) {
      setForm({ slug: slugify(form.title) })
    }
  }

  useEffect(() => {
    adminApi.agents().then(setAgents).catch(() => setAgents([]))
    adminApi.neighborhoods().then(setNeighborhoods).catch(() => setNeighborhoods([]))
    adminApi.amenities().then(setAmenityOptions).catch(() => setAmenityOptions([]))
  }, [])

  useEffect(() => {
    if (mode !== "edit" || !id) return
    let cancelled = false
    adminApi
      .fetchProperty(id)
      .then((detail) => {
        if (cancelled) return
        const f = formFromDetail(detail)
        setFormState(f)
        setSelectedAmenities(new Set(f.amenities))
        setInitial(buildInput(f))
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Could not load property")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mode, id])

  if (loading) return <Spinner />
  if (error && mode === "edit") return <EmptyState message={error} />

  const save = async () => {
    setError(null)
    const input = buildInput(form)
    input.amenities = [...selectedAmenities]
    const images = input.images ?? []
    if (!input.title.trim()) {
      setError("Title is required.")
      return
    }
    if (!(input.price > 0)) {
      setError("Enter a valid price greater than 0.")
      return
    }
    if (images.length === 0) {
      setError("Add at least one image before saving.")
      return
    }
    if (images.filter((image) => image.isCover).length > 1) {
      setError("Only one image may be marked as the cover.")
      return
    }

    setSaving(true)
    try {
      if (mode === "new") {
        const created = await adminApi.createProperty(input)
        toast("Property created")
        navigate(`/admin/properties/${created.id}/edit`)
      } else if (id) {
        const patch = initial ? diffInput(initial, input) : input
        await adminApi.updateProperty(id, patch)
        toast("Property updated")
        setInitial(input)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save property")
    } finally {
      setSaving(false)
    }
  }

  const heading = mode === "new" ? "New property" : form.title || "Edit property"

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light" style={{ fontFamily: "var(--font-display)" }}>
            {heading}
          </h1>
          <p className="text-sm font-light text-[#6B6560] mt-1">
            {mode === "edit" ? form.slug : "Publish a new listing"}
          </p>
        </div>
        <Button variant="gold" onClick={save} disabled={saving}>
          {saving ? "Saving…" : mode === "new" ? "Create property" : "Save changes"}
        </Button>
      </div>

      {error && (
        <p
          className="mb-8 text-sm font-light px-4 py-3"
          style={{ backgroundColor: "#A03A2E18", color: "#A03A2E", border: "1px solid #A03A2E40" }}
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
        <div>
          <Field label="Title" hint="The listing headline shown across the site.">
            <TextInput
              value={form.title}
              onChange={(title) => setForm({ title })}
              onBlur={applySlug}
              placeholder="e.g. Coastal Villa in Al Shati"
            />
          </Field>
        </div>
        <div>
          <Field
            label="Slug"
            hint="URL segment. Auto-generated from the title; edit only if you know what you're doing."
          >
            <TextInput
              value={form.slug}
              onChange={(slug) => setForm({ slug, slugTouched: true })}
              placeholder="coastal-villa-in-al-shati"
            />
          </Field>
        </div>

        <div>
          <Field label="Type">
            <SelectInput
              value={form.propertyType}
              onChange={(propertyType) => setForm({ propertyType: propertyType as PropertyType })}
              options={TYPE_OPTIONS}
            />
          </Field>
        </div>
        <div>
          <Field label="Purpose">
            <SelectInput
              value={form.purpose}
              onChange={(purpose) => setForm({ purpose: purpose as PropertyPurpose })}
              options={PURPOSE_OPTIONS}
            />
          </Field>
        </div>

        <div>
          <Field label="Price (SAR)">
            <TextInput
              value={form.price}
              onChange={(price) => setForm({ price })}
              type="number"
              placeholder="2200000"
            />
          </Field>
        </div>
        <div>
          <Field label="Currency">
            <TextInput
              value={form.currency}
              onChange={(currency) => setForm({ currency })}
              placeholder="SAR"
            />
          </Field>
        </div>

        <div>
          <Field label="Bedrooms">
            <TextInput
              value={form.bedrooms}
              onChange={(bedrooms) => setForm({ bedrooms })}
              type="number"
            />
          </Field>
        </div>
        <div>
          <Field label="Bathrooms">
            <TextInput
              value={form.bathrooms}
              onChange={(bathrooms) => setForm({ bathrooms })}
              type="number"
            />
          </Field>
        </div>

        <div>
          <Field label="Area (m²)">
            <TextInput value={form.area} onChange={(area) => setForm({ area })} type="number" />
          </Field>
        </div>
        <div>
          <Field label="Status">
            <SelectInput
              value={form.status}
              onChange={(status) => setForm({ status: status as PropertyStatus })}
              options={STATUS_OPTIONS}
            />
          </Field>
        </div>

        <div>
          <Field label="City">
            <TextInput value={form.city} onChange={(city) => setForm({ city })} placeholder="Jeddah" />
          </Field>
        </div>
        <div>
          <Field label="District">
            <TextInput
              value={form.district}
              onChange={(district) => setForm({ district })}
              placeholder="Al Shati"
            />
          </Field>
        </div>

        <div>
          <Field label="Street address">
            <TextInput
              value={form.address}
              onChange={(address) => setForm({ address })}
              placeholder="King Abdulaziz Road"
            />
          </Field>
        </div>
        <div>
          <Field label="Assigned agent">
            <SelectInput
              value={form.agentId}
              onChange={(agentId) => setForm({ agentId })}
              options={agents.map((agent) => ({ value: agent.id, label: agent.name }))}
              placeholder="No agent"
            />
          </Field>
        </div>

        <div>
          <Field label="Neighborhood">
            <SelectInput
              value={form.neighborhoodId}
              onChange={(neighborhoodId) => setForm({ neighborhoodId })}
              options={neighborhoods.map((neighborhood) => ({
                value: neighborhood.id,
                label: neighborhood.name,
              }))}
              placeholder="No neighborhood"
            />
          </Field>
        </div>
        <div>
          <Field label="Featured listing" hint="Featured properties are highlighted across the homepage and directory.">
            <Toggle
              checked={form.featured}
              onChange={(featured) => setForm({ featured })}
              label={form.featured ? "Featured" : "Not featured"}
            />
          </Field>
        </div>

        <div className="lg:col-span-2">
          <Field label="Latitude">
            <TextInput
              value={form.latitude}
              onChange={(latitude) => setForm({ latitude })}
              type="number"
              placeholder="21.5433"
            />
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="Longitude">
            <TextInput
              value={form.longitude}
              onChange={(longitude) => setForm({ longitude })}
              type="number"
              placeholder="39.1728"
            />
          </Field>
        </div>

        <div className="lg:col-span-2">
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(description) => setForm({ description })}
              rows={4}
            />
          </Field>
        </div>

        <div>
          <Field label="Images" hint="Mark a cover with the star. The first image becomes the cover when none is marked.">
            <ImageManager images={form.images} onChange={(images) => setForm({ images })} />
          </Field>
        </div>

        <div>
          <Field label="Amenities" hint="Select from the catalog or type a new one and press Add.">
            <div className="flex flex-wrap gap-2 mb-4">
              {amenityOptions.map((option) => {
                const active = selectedAmenities.has(option.name)
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      const next = new Set(selectedAmenities)
                      if (active) next.delete(option.name)
                      else next.add(option.name)
                      setSelectedAmenities(next)
                    }}
                    className="text-[11px] tracking-[0.12em] uppercase font-light px-3 py-1.5 cursor-pointer border transition-colors"
                    style={{
                      backgroundColor: active ? "#0F0F0D" : "transparent",
                      color: active ? "#F5F0E8" : "#6B6560",
                      borderColor: active ? "#0F0F0D" : "rgba(15,15,13,0.2)",
                    }}
                  >
                    {option.name}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <TextInput
                value={customAmenity}
                onChange={setCustomAmenity}
                placeholder="e.g. Private Beach"
              />
              <Button
                variant="ghost"
                onClick={() => {
                  const name = customAmenity.trim()
                  if (!name) return
                  const next = new Set(selectedAmenities)
                  next.add(name)
                  setSelectedAmenities(next)
                  setCustomAmenity("")
                }}
              >
                Add
              </Button>
            </div>
            <p className="text-xs font-light text-[#A09890] mt-3">
              {selectedAmenities.size
                ? `Selected: ${[...selectedAmenities].sort().join(" · ")}`
                : "No amenities selected."}
            </p>
          </Field>
        </div>
      </div>

      <div className="sticky bottom-0 mt-12 py-4 flex justify-end gap-3 bg-[#F5F0E8]/90 backdrop-blur">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button variant="gold" onClick={save} disabled={saving}>
          {saving ? "Saving…" : mode === "new" ? "Create property" : "Save changes"}
        </Button>
      </div>
    </div>
  )
}