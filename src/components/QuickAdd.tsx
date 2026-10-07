import { useRef, useState } from 'react'
import { readClipboard, type ClipboardContents } from '../lib/clipboard'

type Props = {
  onSave: (c: ClipboardContents) => Promise<boolean>
  onError: (message: string) => void
  uploading: number
}

export default function QuickAdd({ onSave, onError, uploading }: Props) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function saveText() {
    if (!text.trim()) return
    setSaving(true)
    if (await onSave({ text, files: [] })) setText('')
    setSaving(false)
  }

  async function pasteFromClipboard() {
    try {
      await onSave(await readClipboard())
    } catch (e) {
      const err = e as DOMException
      onError(
        err.name === 'NotAllowedError'
          ? 'Clipboard access was blocked. Allow it in site settings, or paste into the box.'
          : err.message,
      )
    }
  }

  return (
    <section className="quickadd">
      <textarea
        placeholder="Type or paste here… (Ctrl+V anywhere on the page saves instantly)"
        value={text}
        rows={text.includes('\n') ? Math.min(8, text.split('\n').length) : 2}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            saveText()
          }
        }}
      />
      <div className="quickadd-actions">
        <button className="btn primary big" onClick={pasteFromClipboard} title="Save whatever is on your clipboard">
          📋 Paste clipboard
        </button>
        <button className="btn big" onClick={() => fileInput.current?.click()}>
          📎 Add file
        </button>
        {text.trim() && (
          <button className="btn big" onClick={saveText} disabled={saving}>
            Save text
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length) onSave({ text: '', files })
          }}
        />
      </div>
      {uploading > 0 && <div className="uploading">Uploading {uploading} file(s)…</div>}
    </section>
  )
}
