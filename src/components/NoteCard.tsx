import { useEffect, useState, type ReactNode } from 'react'
import { signedUrl, type Note } from '../lib/notes'
import { copyImage, copyText } from '../lib/clipboard'

type Props = {
  note: Note
  onPin: (n: Note) => void
  onDelete: (n: Note) => void
  toast: (text: string, error?: boolean) => void
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g

function linkify(text: string): ReactNode[] {
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  )
}

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  if (s < 7 * 86400) return `${Math.round(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function NoteCard({ note, onPin, onDelete, toast }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (note.kind !== 'image' || !note.file_path) return
    let cancelled = false
    signedUrl(note.file_path)
      .then((u) => !cancelled && setPreview(u))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [note.kind, note.file_path])

  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), 3000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  async function copy() {
    try {
      if (note.kind === 'text') await copyText(note.content ?? '')
      else if (note.kind === 'image') await copyImage(await signedUrl(note.file_path!))
      toast('Copied')
    } catch (e) {
      toast(`Couldn't copy: ${(e as Error).message}`, true)
    }
  }

  async function download() {
    try {
      const a = document.createElement('a')
      a.href = await signedUrl(note.file_path!, note.file_name ?? 'download')
      a.rel = 'noreferrer'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      toast((e as Error).message, true)
    }
  }

  const text = note.content ?? ''
  const long = text.length > 600 || text.split('\n').length > 12

  return (
    <li className={`card ${note.pinned ? 'pinned' : ''}`}>
      {note.kind === 'text' && (
        <div className={`card-text ${long && !expanded ? 'clamped' : ''}`}>{linkify(text)}</div>
      )}
      {long && note.kind === 'text' && (
        <button className="link-btn small" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {note.kind === 'image' && (
        <a className="card-image" href={preview ?? undefined} target="_blank" rel="noreferrer">
          {preview ? <img src={preview} alt={note.file_name ?? ''} loading="lazy" /> : <div className="img-ph" />}
        </a>
      )}

      {note.kind === 'file' && (
        <button className="card-file" onClick={download}>
          <span className="file-icon">📄</span>
          <span className="file-meta">
            <span className="file-name">{note.file_name}</span>
            <span className="muted small">{formatSize(note.size)}</span>
          </span>
        </button>
      )}

      <div className="card-foot">
        <span className="muted small" title={new Date(note.created_at).toLocaleString()}>
          {note.pinned && '📌 '}
          {timeAgo(note.created_at)}
          {note.kind === 'image' && note.size ? ` · ${formatSize(note.size)}` : ''}
        </span>
        <div className="card-actions">
          {note.kind !== 'file' && (
            <button className="btn primary" onClick={copy}>
              Copy
            </button>
          )}
          {note.kind !== 'text' && (
            <button className="btn" onClick={download} aria-label="Download">
              ⬇
            </button>
          )}
          <button className="btn" onClick={() => onPin(note)} aria-label={note.pinned ? 'Unpin' : 'Pin'}>
            {note.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            className={`btn ${confirmDelete ? 'danger' : ''}`}
            onClick={() => (confirmDelete ? onDelete(note) : setConfirmDelete(true))}
            aria-label="Delete"
          >
            {confirmDelete ? 'Sure?' : '🗑'}
          </button>
        </div>
      </div>
    </li>
  )
}
