import { supabase } from './supabase'

export type NoteKind = 'text' | 'image' | 'file'

export type Note = {
  id: string
  user_id: string
  kind: NoteKind
  content: string | null
  file_path: string | null
  file_name: string | null
  mime: string | null
  size: number | null
  pinned: boolean
  created_at: string
}

const BUCKET = 'attachments'
export const MAX_FILE_BYTES = 50 * 1024 * 1024

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at),
  )
}

export async function listNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return data as Note[]
}

export async function addText(content: string): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert({ kind: 'text', content })
    .select()
    .single()
  if (error) throw error
  return data as Note
}

/** Gives clipboard images (always called "image.png") a useful, unique name. */
export function nameForFile(file: File): string {
  if (file.name && file.name !== 'image.png' && file.name !== 'blob') return file.name
  const ext = file.type.split('/')[1]?.split('+')[0] || 'bin'
  const stamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')
  return `pasted_${stamp}.${ext}`
}

export async function addFile(file: File, userId: string): Promise<Note> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name} is larger than 50 MB`)
  }
  const fileName = nameForFile(file)
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-120)
  const path = `${userId}/${crypto.randomUUID()}-${safe}`
  const mime = file.type || 'application/octet-stream'

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: mime, upsert: false })
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('notes')
    .insert({
      kind: mime.startsWith('image/') ? 'image' : 'file',
      file_path: path,
      file_name: fileName,
      mime,
      size: file.size,
    })
    .select()
    .single()
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
  return data as Note
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from('notes').update({ pinned }).eq('id', id)
  if (error) throw error
}

export async function deleteNote(note: Note): Promise<void> {
  if (note.file_path) {
    const { error } = await supabase.storage.from(BUCKET).remove([note.file_path])
    if (error) throw error
  }
  const { error } = await supabase.from('notes').delete().eq('id', note.id)
  if (error) throw error
}

// Signed URLs last an hour; cache them so re-renders don't refetch.
const urlCache = new Map<string, { url: string; expires: number }>()

export async function signedUrl(path: string, downloadAs?: string): Promise<string> {
  const key = `${path}|${downloadAs ?? ''}`
  const hit = urlCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.url
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600, downloadAs ? { download: downloadAs } : undefined)
  if (error) throw error
  urlCache.set(key, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 })
  return data.signedUrl
}

export type NoteEvents = {
  onUpsert: (note: Note) => void
  onDelete: (id: string) => void
  onStatus?: (connected: boolean) => void
}

/** Live updates from other devices. Returns an unsubscribe function. */
export function subscribeNotes(userId: string, ev: NoteEvents): () => void {
  const channel = supabase
    .channel(`notes-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
      (p) => ev.onUpsert(p.new as Note),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
      (p) => ev.onUpsert(p.new as Note),
    )
    // DELETE events can't be filtered; we only get the id, which is all we need.
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notes' }, (p) => {
      const id = (p.old as Partial<Note>).id
      if (id) ev.onDelete(id)
    })
    .subscribe((status) => ev.onStatus?.(status === 'SUBSCRIBED'))

  return () => {
    supabase.removeChannel(channel)
  }
}
