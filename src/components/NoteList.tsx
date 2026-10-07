import type { Note } from '../lib/notes'
import NoteCard from './NoteCard'

type Props = {
  notes: Note[]
  loading: boolean
  onPin: (n: Note) => void
  onDelete: (n: Note) => void
  toast: (text: string, error?: boolean) => void
}

export default function NoteList({ notes, loading, onPin, onDelete, toast }: Props) {
  if (loading) return <p className="empty muted">Loading notes…</p>
  if (!notes.length) {
    return (
      <div className="empty">
        <p>Nothing here yet.</p>
        <p className="muted small">
          Copy something, then press <kbd>Ctrl</kbd>+<kbd>V</kbd> here or tap <b>Paste clipboard</b>.
          On Android you can also share to Note Buddy from any app.
        </p>
      </div>
    )
  }
  return (
    <ul className="notes">
      {notes.map((n) => (
        <NoteCard key={n.id} note={n} onPin={onPin} onDelete={onDelete} toast={toast} />
      ))}
    </ul>
  )
}
