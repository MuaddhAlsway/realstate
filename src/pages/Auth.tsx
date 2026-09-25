import { useState, type FormEvent } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useReveal } from "../hooks/useReveal"

type Mode = "login" | "register"

function input(
  label: string,
  type: string,
  value: string,
  onChange: (v: string) => void,
  required = true,
  autoComplete?: string,
) {
  return (
    <div key={label} className="flex flex-col">
      <label className="eyebrow mb-3" style={{ color: "#A09890" }}>
        {label}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-b pb-3 text-sm font-light outline-none bg-transparent"
        style={{ borderColor: "rgba(15,15,13,0.15)", color: "#0F0F0D" }}
      />
    </div>
  )
}

export default function Auth() {
  const ref = useReveal<HTMLDivElement>()
  const { user, login, register, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: string } | null)?.from ?? "/dashboard"

  const [mode, setMode] = useState<Mode>("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return (
      <div
        style={{ minHeight: "80vh", paddingTop: "180px" }}
        className="max-w-[1440px] mx-auto px-6 lg:px-16 text-center"
      >
        <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
          Welcome back
        </p>
        <h1 className="text-heading-xl mb-8">
          You're signed in as {user.name}.
        </h1>
        <Link to="/dashboard" className="btn-primary">
          Go to Dashboard
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === "login") await login(email, password)
      else await register(name, email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div ref={ref} style={{ backgroundColor: "#F5F0E8", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          backgroundColor: "#0F0F0D",
          paddingTop: "140px",
          paddingBottom: "100px",
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16">
          <p className="eyebrow mb-4" style={{ color: "#C9A96E" }} data-reveal>
            Account
          </p>
          <h1
            className="text-display-lg"
            style={{ color: "#F5F0E8" }}
            data-reveal
          >
            {mode === "login" ? "Welcome back" : "Join Estate"}
          </h1>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-7" data-reveal>
            <h2 className="text-heading-md mb-6" style={{ color: "#0F0F0D" }}>
              {mode === "login"
                ? "Sign in to manage your saved properties and account."
                : "Create an account to save properties and track your journey."}
            </h2>

            <div
              className="flex border mb-10"
              style={{
                width: "fit-content",
                borderColor: "rgba(15,15,13,0.15)",
              }}
            >
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m)
                    setError(null)
                  }}
                  className="px-6 py-3 text-xs tracking-[0.2em] uppercase font-light transition-colors"
                  style={{
                    backgroundColor: mode === m ? "#0F0F0D" : "transparent",
                    color: mode === m ? "#F5F0E8" : "#6B6560",
                  }}
                >
                  {m === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            <form
              onSubmit={handleSubmit}
              className="max-w-lg flex flex-col gap-8"
            >
              {mode === "register" &&
                input("Full Name", "text", name, setName, true, "name")}
              {input("Email Address", "email", email, setEmail, true, "email")}
              {input(
                "Password",
                "password",
                password,
                setPassword,
                true,
                mode === "login" ? "current-password" : "new-password",
              )}

              {error && (
                <p
                  className="text-sm font-light"
                  role="alert"
                  style={{ color: "#B4432E" }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || loading}
                className="w-full py-4 text-xs tracking-[0.3em] uppercase font-light transition-colors disabled:opacity-60"
                style={{ backgroundColor: "#0F0F0D", color: "#F5F0E8" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#C9A96E"
                  e.currentTarget.style.color = "#0F0F0D"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#0F0F0D"
                  e.currentTarget.style.color = "#F5F0E8"
                }}
              >
                {submitting || loading
                  ? "Please wait…"
                  : mode === "login"
                    ? "Sign In"
                    : "Create Account"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-4 lg:col-start-9" data-reveal>
            <div
              className="p-10 border"
              style={{ borderColor: "rgba(15,15,13,0.1)" }}
            >
              <p className="eyebrow mb-6" style={{ color: "#C9A96E" }}>
                Why an account?
              </p>
              <ul
                className="flex flex-col gap-5 text-sm font-light"
                style={{ color: "#6B6560" }}
              >
                <li>· Save properties to revisit anytime</li>
                <li>· Track viewing requests in one place</li>
                <li>· Your private dashboard, always at hand</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
