import { useEffect, type ReactNode } from "react"

/* Admin UI primitives — minimal, Tailwind-based, shared by every admin page. */

const styles = {
  label: "block text-[11px] tracking-[0.18em] uppercase font-light mb-2 text-[#6B6560]",
  input:
    "w-full bg-transparent text-sm font-light border px-3 py-2.5 outline-none focus:border-[#C9A96E] transition-colors text-[#0F0F0D]",
  muted: "text-xs font-light text-[#6B6560]",
  btnPrimary:
    "inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-light px-5 py-3 transition-colors cursor-pointer",
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`py-20 flex items-center justify-center ${className}`} role="status">
      <span className="inline-block w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "dark",
  disabled,
  className = "",
}: {
  children: ReactNode
  onClick?: () => void
  type?: "button" | "submit"
  variant?: "dark" | "gold" | "ghost" | "danger"
  disabled?: boolean
  className?: string
}) {
  const palette = {
    dark: "bg-[#0F0F0D] text-[#F5F0E8] hover:opacity-85 disabled:opacity-40",
    gold: "bg-[#C9A96E] text-[#0F0F0D] hover:opacity-85 disabled:opacity-40",
    ghost: "border border-[#0F0F0D]/25 text-[#0F0F0D] hover:bg-[#EDE6D6] disabled:opacity-40",
    danger: "bg-[#A03A2E] text-[#F5F0E8] hover:opacity-85 disabled:opacity-40",
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${styles.btnPrimary} ${palette} ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className={styles.label}>{label}</span>
      {children}
      {hint ? <span className={`${styles.muted} block mt-1`}>{hint}</span> : null}
    </label>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  onBlur,
  className = "",
}: {
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  onBlur?: () => void
  className?: string
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onBlur={onBlur}
      onChange={(e) => onChange(e.target.value)}
      className={`${styles.input} ${className}`}
    />
  )
}

export function Textarea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${styles.input} resize-y`}
    />
  )
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string, label: string }>
  placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${styles.input} appearance-none cursor-pointer bg-no-repeat`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B6560' fill='none'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 12px center",
        paddingRight: "28px",
      }}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="w-10 h-6 rounded-full relative transition-colors"
        style={{ backgroundColor: checked ? "#C9A96E" : "#D8D2C2" }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(20px)" : "translateX(2px)" }}
        />
      </button>
      <span className={styles.muted}>{label}</span>
    </label>
  )
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "gold" | "green" | "red" | "neutral" | "dark"
}) {
  const colors: Record<string, string> = {
    gold: "bg-[#C9A96E]/15 text-[#8a6d38] border-[#C9A96E]/40",
    green: "bg-[#4CAF50]/12 text-[#2e7d32] border-[#4CAF50]/40",
    red: "bg-[#A03A2E]/12 text-[#A03A2E] border-[#A03A2E]/40",
    neutral: "bg-[#EDE6D6] text-[#6B6560] border-[#0F0F0D]/10",
    dark: "bg-[#0F0F0D] text-[#F5F0E8] border-[#0F0F0D]",
  }
  return (
    <span
      className={`inline-block text-[11px] tracking-[0.15em] uppercase font-light px-3 py-1 border ${colors[tone]}`}
    >
      {children}
    </span>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#0F0F0D]/60 p-4 md:p-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#F5F0E8] w-full max-w-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#0F0F0D]/10">
          <h2 className="text-lg font-light tracking-wide text-[#0F0F0D]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[#6B6560] hover:text-[#0F0F0D] text-xl leading-none cursor-pointer"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm font-light text-[#6B6560] mb-8">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm font-light text-[#6B6560]">{message}</p>
    </div>
  )
}

export function Table({ headers, children }: { headers: string[], children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[#0F0F0D]/15">
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-4 py-3 text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] whitespace-nowrap"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function formatPrice(n: number): string {
  if (n >= 1_000_000) return `SAR ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `SAR ${(n / 1_000).toFixed(0)}K`
  return `SAR ${n}`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  })
}