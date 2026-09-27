import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useFavorites } from "../context/FavoritesContext"
import { properties, type ViewingRequest } from "../data/properties"
import { api } from "../services/api"
import { REMOTE } from "../services/http"
import { getStore } from "../services/mock"
import { inquiryApi, type InquiryListItem } from "../services/inquiry"
import { useReveal } from "../hooks/useReveal"

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

const INQUIRY_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

export default function Dashboard() {
  const ref = useReveal<HTMLDivElement>()
  const { user, logout } = useAuth()
  const { favorites } = useFavorites()
  const navigate = useNavigate()

  const [viewings, setViewings] = useState<ViewingRequest[]>([])
  const [inquiries, setInquiries] = useState<InquiryListItem[]>([])
  const [inquiriesLoaded, setInquiriesLoaded] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate("/auth", { replace: true })
      return
    }
    if (REMOTE) {
      let cancelled = false
      api
        .fetchViewings()
        .then((list) => {
          if (!cancelled) setViewings(list)
        })
        .catch(() => {
          /* keep empty on transient failures */
        })
      return () => {
        cancelled = true
      }
    }
    setViewings(getStore().viewings)
  }, [user, navigate])

  useEffect(() => {
    if (!user || !REMOTE) return
    let cancelled = false
    inquiryApi
      .myInquiries()
      .then((result) => {
        if (!cancelled) {
          setInquiries(result.items)
          setInquiriesLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setInquiriesLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  if (!user) return null

  const savedCount = favorites.length
  const displayName = user.name.split(" ")[0]

  return (
    <div ref={ref} style={{ backgroundColor: "#F5F0E8", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          backgroundColor: "#0F0F0D",
          paddingTop: "120px",
          paddingBottom: "80px",
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16 flex items-end justify-between">
          <div>
            <p
              className="eyebrow mb-4"
              style={{ color: "#C9A96E" }}
              data-reveal
            >
              Dashboard
            </p>
            <h1
              className="text-display-lg"
              style={{ color: "#F5F0E8" }}
              data-reveal
            >
              Hello, {displayName}.
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              logout()
              navigate("/")
            }}
            className="text-xs tracking-[0.25em] uppercase font-light transition-colors hover:text-[#C9A96E]"
            style={{ color: "rgba(245,240,232,0.6)" }}
            data-reveal
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-24">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          <div
            className="p-10"
            style={{ backgroundColor: "#EDE6D6" }}
            data-reveal
          >
            <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
              Saved
            </p>
            <p className="text-display-lg" style={{ color: "#0F0F0D" }}>
              {savedCount}
            </p>
            <Link
              to="/saved"
              className="inline-block mt-6 text-xs tracking-[0.25em] uppercase font-light transition-colors hover:text-[#C9A96E]"
              style={{ color: "#0F0F0D" }}
            >
              View Saved →
            </Link>
          </div>
          <div
            className="p-10 border"
            style={{ borderColor: "rgba(15,15,13,0.1)" }}
            data-reveal
          >
            <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
              Viewing Requests
            </p>
            <p className="text-display-lg" style={{ color: "#0F0F0D" }}>
              {viewings.length}
            </p>
            <p className="mt-6 text-xs font-light" style={{ color: "#6B6560" }}>
              Requests submitted through the platform
            </p>
          </div>
          {REMOTE ? (
            <div
              className="p-10 border"
              style={{ borderColor: "rgba(15,15,13,0.1)" }}
              data-reveal
            >
              <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
                Inquiries
              </p>
              <p className="text-display-lg" style={{ color: "#0F0F0D" }}>
                {inquiriesLoaded ? inquiries.length : "…"}
              </p>
              <Link
                to={
                  inquiriesLoaded && inquiries.length > 0
                    ? `/dashboard/inquiries/${inquiries[0].id}`
                    : "/properties"
                }
                className="inline-block mt-6 text-xs tracking-[0.25em] uppercase font-light transition-colors hover:text-[#C9A96E]"
                style={{ color: "#0F0F0D" }}
              >
                {inquiriesLoaded && inquiries.length > 0
                  ? "Open latest →"
                  : "Ask About a Property →"}
              </Link>
            </div>
          ) : null}
        </div>

        {REMOTE ? (
          <div className="mb-20">
            <p
              className="eyebrow mb-8"
              style={{ color: "#C9A96E" }}
              data-reveal
            >
              Your Inquiries
            </p>
            {inquiries.length === 0 ? (
              <div
                className="p-10 border"
                style={{ borderColor: "rgba(15,15,13,0.1)" }}
                data-reveal
              >
                <p
                  className="text-sm font-light mb-6"
                  style={{ color: "#6B6560" }}
                >
                  No inquiries yet. Ask about a property you&apos;re interested
                  in and track the conversation here.
                </p>
                <Link to="/properties" className="btn-primary">
                  Browse Properties
                </Link>
              </div>
            ) : (
              <div
                className="flex flex-col divide-y"
                style={{ borderColor: "rgba(15,15,13,0.08)" }}
                data-reveal
              >
                {inquiries.map((inq) => (
                  <div
                    key={inq.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 items-center"
                  >
                    <div className="md:col-span-5">
                      <Link
                        to={`/dashboard/inquiries/${inq.id}`}
                        className="text-sm font-light hover:text-[#8a6d38]"
                        style={{ color: "#0F0F0D" }}
                      >
                        {inq.property?.title ?? "Property inquiry"}
                      </Link>
                      <p
                        className="text-xs font-light"
                        style={{ color: "#6B6560" }}
                      >
                        Reference {inq.id}
                      </p>
                    </div>
                    <div className="md:col-span-3">
                      <p
                        className="text-sm font-light"
                        style={{ color: "#0F0F0D" }}
                      >
                        {new Date(inq.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="md:col-span-3">
                      <span
                        className="inline-block text-[11px] tracking-[0.15em] uppercase font-light px-3 py-1"
                        style={{
                          color: "#0F0F0D",
                          backgroundColor: "#EDE6D6",
                          border: "1px solid rgba(15,15,13,0.15)",
                        }}
                      >
                        {INQUIRY_STATUS_LABEL[inq.status] ?? inq.status}
                      </span>
                    </div>
                    <div className="md:col-span-1 text-right">
                      <Link
                        to={`/dashboard/inquiries/${inq.id}`}
                        className="text-xs tracking-[0.2em] uppercase font-light transition-colors hover:text-[#C9A96E]"
                        style={{ color: "#0F0F0D" }}
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Viewings */}
        <div className="mb-20">
          <p className="eyebrow mb-8" style={{ color: "#C9A96E" }} data-reveal>
            Your Requests
          </p>
          {viewings.length === 0 ? (
            <div
              className="p-10 border"
              style={{ borderColor: "rgba(15,15,13,0.1)" }}
              data-reveal
            >
              <p
                className="text-sm font-light mb-6"
                style={{ color: "#6B6560" }}
              >
                No viewing requests yet. Find a property you love and schedule a
                viewing.
              </p>
              <Link to="/properties" className="btn-primary">
                Browse Properties
              </Link>
            </div>
          ) : (
            <div
              className="flex flex-col divide-y"
              style={{ borderColor: "rgba(15,15,13,0.08)" }}
              data-reveal
            >
              {viewings.map((v) => {
                const prop = properties.find((p) => p.id === v.propertyId)
                const name = v.propertyName ?? prop?.name ?? "Property"
                const date = new Date(v.date).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
                return (
                  <div
                    key={v.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 items-center"
                  >
                    <div className="md:col-span-5">
                      <p
                        className="text-sm font-light"
                        style={{ color: "#0F0F0D" }}
                      >
                        {name}
                      </p>
                      <p
                        className="text-xs font-light"
                        style={{ color: "#6B6560" }}
                      >
                        Reference {v.id}
                      </p>
                      {v.status && (
                        <span
                          className="inline-block mt-2 text-[11px] tracking-[0.15em] uppercase font-light px-3 py-1"
                          style={{
                            color: "#0F0F0D",
                            backgroundColor: "#EDE6D6",
                            border: "1px solid rgba(15,15,13,0.15)",
                          }}
                        >
                          {STATUS_LABEL[v.status] ?? v.status}
                        </span>
                      )}
                    </div>
                    <div className="md:col-span-3">
                      <p
                        className="text-sm font-light"
                        style={{ color: "#0F0F0D" }}
                      >
                        {date}
                      </p>
                    </div>
                    <div className="md:col-span-3">
                      <p
                        className="text-sm font-light"
                        style={{ color: "#6B6560" }}
                      >
                        {v.name}
                      </p>
                    </div>
                    <div className="md:col-span-1 text-right">
                      {v.propertyId ? (
                        <Link
                          to={`/properties/${v.propertyId}`}
                          className="text-xs tracking-[0.2em] uppercase font-light transition-colors hover:text-[#C9A96E]"
                          style={{ color: "#0F0F0D" }}
                        >
                          View
                        </Link>
                      ) : (
                        <span
                          className="text-xs font-light"
                          style={{ color: "#A09890" }}
                        >
                          —
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Saved snapshot */}
        {savedCount > 0 && (
          <div className="mb-8 flex items-center justify-between" data-reveal>
            <p className="eyebrow" style={{ color: "#C9A96E" }}>
              Saved Snapshot
            </p>
            <Link
              to="/saved"
              className="text-xs tracking-[0.25em] uppercase font-light transition-colors hover:text-[#C9A96E]"
              style={{ color: "#0F0F0D" }}
            >
              Manage →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
