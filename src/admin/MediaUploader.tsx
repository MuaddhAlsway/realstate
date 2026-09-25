import { useMemo, useRef, useState } from "react"
import {
  authorizeUpload,
  uploadFile,
  mediaThumb,
  type MediaPurpose,
  type UploadResult,
} from "../services/media"
import { Button } from "./ui"

/**
 * Phase 10 — admin media uploader.
 *
 * Multi-select, drag-and-drop input that uploads straight to Cloudinary via
 * a signed authorization and reports each file's lifecycle (queue → uploading
 * with a live progress bar → done / failed with retry). On success each
 * entry reports `{ url, publicId }`; the parent is responsible for folding
 * that into whatever record is being edited (property images or CMS fields).
 */

interface Task {
  id: string
  file: File
  previewUrl: string | null
  state: "uploading" | "done" | "error"
  progress: number
  error?: string
  result?: UploadResult
}

let nextTaskId = 0

function makeTask(file: File): Task {
  return {
    id: `media-task-${++nextTaskId}`,
    file,
    previewUrl: URL.createObjectURL(file),
    state: "uploading",
    progress: 0,
  }
}

interface MediaUploaderProps {
  purpose: MediaPurpose
  multiple?: boolean
  onComplete: (results: UploadResult[]) => void
  label?: string
  hint?: string
}

export function MediaUploader({
  purpose,
  multiple = true,
  onComplete,
  label = "Upload images",
  hint,
}: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [dragging, setDragging] = useState(false)
  const activeCount = useMemo(
    () => tasks.filter((task) => task.state === "uploading").length,
    [tasks],
  )

  const patchTask = (id: string, patch: Partial<Task>) =>
    setTasks((list) => list.map((task) => (task.id === id ? { ...task, ...patch } : task)))

  const enqueue = (files: File[]) => {
    const fresh = files.map(makeTask)
    setTasks((list) => [...list, ...fresh])
    if (fresh.length === 0) return
    handleBatch(fresh)
  }

  const handleBatch = async (batch: Task[]) => {
    let auth: Awaited<ReturnType<typeof authorizeUpload>> | null = null
    try {
      auth = await authorizeUpload(purpose)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not authorize upload"
      for (const task of batch) {
        patchTask(task.id, { state: "error", error: message, previewUrl: releasePreview(task) })
      }
      return
    }

    const completed: UploadResult[] = []
    for (const task of batch) {
      try {
        const media = await uploadFile(auth, task.file, (fraction) =>
          patchTask(task.id, { progress: fraction }),
        )
        const result = { url: media.secure_url, publicId: media.public_id }
        completed.push(result)
        patchTask(task.id, {
          state: "done",
          progress: 1,
          previewUrl: releasePreview(task),
          result,
        })
      } catch (err) {
        patchTask(task.id, {
          state: "error",
          error: err instanceof Error ? err.message : "Upload failed",
          previewUrl: releasePreview(task),
        })
      }
    }
    if (completed.length > 0) onComplete(completed)
  }

  const retry = (task: Task) => {
    patchTask(task.id, { state: "uploading", progress: 0, error: undefined })
    handleBatch([{ ...task, previewUrl: URL.createObjectURL(task.file) }])
  }

  const onFiles = (files: FileList | File[]) => {
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"))
    if (list.length === 0) return
    if (!multiple) {
      // Replace any in-flight single-field upload (CMS image fields).
      setTasks((current) => {
        for (const task of current) {
          if (task.previewUrl) URL.revokeObjectURL(task.previewUrl)
        }
        return []
      })
      enqueue(list.slice(0, 1))
      return
    }
    enqueue(list)
  }

  const tasksDone = tasks.filter((task) => task.state === "done").length
  const summary = hints({ tasksDone, tasks, activeCount })

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (e.dataTransfer?.files) onFiles(e.dataTransfer.files)
        }}
        className="border border-dashed px-4 py-6 text-center cursor-pointer transition-colors"
        style={{
          borderColor: dragging ? "#C9A96E" : "rgba(15,15,13,0.25)",
          backgroundColor: dragging ? "#C9A96E12" : "transparent",
        }}
      >
        <p className="text-sm font-light" style={{ color: "#0F0F0D" }}>
          {label}
        </p>
        <p className="text-xs font-light mt-1" style={{ color: "#A09890" }}>
          Drop {multiple ? "images" : "an image"} here or click to browse — JPG, PNG, WEBP, AVIF
          (max 10 MiB each)
        </p>
        {hint && (
          <p className="text-[11px] font-light mt-1" style={{ color: "#8a6d38" }}>
            {hint}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {tasks.length > 0 && (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="grid grid-cols-[auto_1fr_auto] gap-3 items-center p-2"
              style={{ backgroundColor: "#EDE6D6" }}
            >
              {(task.previewUrl || task.result) && (
                <img
                  src={mediaThumb(task.result?.url) || task.previewUrl || ""}
                  alt=""
                  className="w-10 h-10 object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="text-xs font-light truncate" style={{ color: "#0F0F0D" }}>
                  {task.file.name}
                </p>
                {task.state === "uploading" && (
                  <div
                    className="h-1 mt-1 rounded-full overflow-hidden"
                    style={{ backgroundColor: "rgba(15,15,13,0.12)" }}
                  >
                    <div
                      className="h-full transition-[width] duration-200"
                      style={{ width: `${Math.round(task.progress * 100)}%`, backgroundColor: "#C9A96E" }}
                    />
                  </div>
                )}
                {task.state === "error" && (
                  <p className="text-[11px] font-light mt-1" style={{ color: "#A03A2E" }}>
                    {task.error}
                  </p>
                )}
                {task.state === "done" && (
                  <p className="text-[11px] font-light mt-1" style={{ color: "#6B6560" }}>
                    Uploaded
                  </p>
                )}
              </div>
              {task.state === "error" && (
                <Button variant="ghost" onClick={() => retry(task)} disabled={activeCount > 0}>
                  Retry
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {summary && (
        <p className="text-xs font-light" style={{ color: "#6B6560" }}>
          {summary}
        </p>
      )}
    </div>
  )
}

function releasePreview(task: Task): null {
  if (task.previewUrl) URL.revokeObjectURL(task.previewUrl)
  return null
}

function hints({ tasksDone, tasks, activeCount }: {
  tasksDone: number
  tasks: Task[]
  activeCount: number
}): string | null {
  if (activeCount > 0) return `Uploading… ${activeCount} remaining in this batch`
  if (tasks.length === 0) return null
  if (tasksDone === tasks.length) {
    return tasksDone === 1 ? "1 image uploaded." : `${tasksDone} images uploaded.`
  }
  const failed = tasks.length - tasksDone
  return `${tasksDone} uploaded${failed > 0 ? `, ${failed} failed` : ""}.`
}