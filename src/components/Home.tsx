import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  addFile,
  addText,
  deleteNote,
  listNotes,
  setPinned,
  sortNotes,
  subscribeNotes,
  type Note,
} from '../lib/notes'
import { fromDataTransfer, type ClipboardContents } from '../lib/clipboard'
import { clearShareFlag, hasPendingShare, takeSharedItems } from '../lib/shared'
import QuickAdd from './QuickAdd'
import NoteList from './NoteList'

type Toast = { id: number; text: string; error?: boolean }

function isEditable(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLElement &&
    (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  )
}

export default function Home({ userId, email }: { userId: string; email: string }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [filter, setFilter] = useState('')
  const dragDepth = useRef(0)
  const menu = useRef<HTMLDetailsElement>(null)

  // Close the account menu on any click outside it (or after picking an item).
  useEffect(() => {
    const close = (e: PointerEvent) => {
      const el = menu.current
      const target = e.target as Element
      if (!el?.open || el.querySelector('summary')!.contains(target)) return
      // Deferred so a menu button's click still fires before the menu hides.
      if (!el.contains(target) || target.closest('button')) setTimeout(() => (el.open = false))
    }
    document.addEventListener('pointerup', close)
    return () => document.removeEventListener('pointerup', close)
  }, [])

  const toast = useCallback((text: string, error = false) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, error }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), error ? 5000 : 2200)
  }, [])

  const upsert = useCallback((n: Note) => {
    setNotes((prev) => {
      const i = prev.findIndex((p) => p.id === n.id)
      if (i === -1) return [n, ...prev]
      const next = [...prev]
      next[i] = n
      return next
    })
  }, [])

  const remove = useCallback((id: string) => setNotes((prev) => prev.filter((p) => p.id !== id)), [])

  const refresh = useCallback(async () => {
    try {
      setNotes(await listNotes())
    } catch (e) {
      toast((e as Error).message, true)
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Initial load + realtime. Reload when the app comes back to the foreground,
  // because phones drop the websocket while the app is in the background.
  useEffect(() => {
    refresh()
    const unsubscribe = subscribeNotes(userId, { onUpsert: upsert, onDelete: remove, onStatus: setLive })
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, refresh, upsert, remove])

  const save = useCallback(
    async ({ text, files }: ClipboardContents): Promise<boolean> => {
      const trimmed = text.trim()
      if (!trimmed && files.length === 0) {
        toast('Nothing to add — clipboard is empty', true)
        return false
      }
      let ok = true
      if (trimmed) {
        try {
          upsert(await addText(trimmed))
        } catch (e) {
          ok = false
          toast((e as Error).message, true)
        }
      }
      if (files.length) {
        setUploading((n) => n + files.length)
        await Promise.all(
          files.map(async (f) => {
            try {
              upsert(await addFile(f, userId))
            } catch (e) {
              ok = false
              toast(`${f.name}: ${(e as Error).message}`, true)
            } finally {
              setUploading((n) => n - 1)
            }
          }),
        )
      }
      if (ok) toast(files.length ? `Added ${files.length + (trimmed ? 1 : 0)} item(s)` : 'Added')
      return ok
    },
    [toast, upsert, userId],
  )

  // Things shared from other Android apps via the share sheet.
  useEffect(() => {
    if (!hasPendingShare()) return
    clearShareFlag()
    takeSharedItems()
      .then((items) => items && save(items))
      .catch((e) => toast((e as Error).message, true))
  }, [save, toast])

  // Ctrl+V anywhere on the page saves straight away. Pasting text into the
  // text box behaves normally so you can edit before saving.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const data = fromDataTransfer(e.clipboardData)
      if (data.files.length) {
        e.preventDefault()
        save({ text: '', files: data.files })
      } else if (!isEditable(e.target) && data.text.trim()) {
        e.preventDefault()
        save(data)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [save])

  // Drag & drop files (or text) anywhere on the window.
  useEffect(() => {
    const hasPayload = (e: DragEvent) =>
      Boolean(e.dataTransfer?.types.some((t) => t === 'Files' || t === 'text/plain'))
    const onEnter = (e: DragEvent) => {
      if (!hasPayload(e)) return
      dragDepth.current++
      setDragging(true)
    }
    const onLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    }
    const onOver = (e: DragEvent) => hasPayload(e) && e.preventDefault()
    const onDrop = (e: DragEvent) => {
      dragDepth.current = 0
      setDragging(false)
      if (isEditable(e.target) && !e.dataTransfer?.files.length) return
      e.preventDefault()
      save(fromDataTransfer(e.dataTransfer))
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [save])

  const onPin = useCallback(
    async (n: Note) => {
      upsert({ ...n, pinned: !n.pinned })
      try {
        await setPinned(n.id, !n.pinned)
      } catch (e) {
        upsert(n)
        toast((e as Error).message, true)
      }
    },
    [toast, upsert],
  )

  const onDelete = useCallback(
    async (n: Note) => {
      remove(n.id)
      try {
        await deleteNote(n)
      } catch (e) {
        upsert(n)
        toast((e as Error).message, true)
      }
    },
    [remove, toast, upsert],
  )

  const q = filter.trim().toLowerCase()
  const visible = sortNotes(notes).filter(
    (n) => !q || (n.content ?? '').toLowerCase().includes(q) || (n.file_name ?? '').toLowerCase().includes(q),
  )

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.svg" alt="" width={28} height={28} />
          <span>Note Buddy</span>
          <span className={`dot ${live ? 'on' : ''}`} title={live ? 'Live sync on' : 'Connecting…'} />
        </div>
        <details className="menu" ref={menu}>
          <summary aria-label="Account">⋯</summary>
          <div className="menu-pop">
            <div className="muted small">{email}</div>
            <button className="btn" onClick={() => refresh()}>
              Refresh
            </button>
            <button className="btn" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </div>
        </details>
      </header>

      <QuickAdd onSave={save} uploading={uploading} onError={(m) => toast(m, true)} />

      {notes.length > 5 && (
        <input
          className="search"
          type="search"
          placeholder="Search notes…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}

      <NoteList notes={visible} loading={loading} onPin={onPin} onDelete={onDelete} toast={toast} />

      {dragging && <div className="dropzone">Drop to add</div>}

      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.error ? 'error' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}
