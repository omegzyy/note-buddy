export type ClipboardContents = { text: string; files: File[] }

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image conversion failed'))), 'image/png'),
  )
}

/** Browsers only allow PNG on the clipboard, so other formats are converted first. */
export async function copyImage(url: string): Promise<void> {
  const png = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`Download failed (${r.status})`)
      return r.blob()
    })
    .then(toPng)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

/** Reads the system clipboard (asks for permission the first time). */
export async function readClipboard(): Promise<ClipboardContents> {
  const out: ClipboardContents = { text: '', files: [] }
  if (navigator.clipboard.read) {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          out.files.push(new File([blob], 'image.png', { type: imageType }))
        } else if (item.types.includes('text/plain')) {
          out.text += await (await item.getType('text/plain')).text()
        }
      }
      return out
    } catch (e) {
      // Some browsers only allow readText(); try that before giving up.
      if ((e as DOMException).name === 'NotAllowedError') throw e
    }
  }
  out.text = await navigator.clipboard.readText()
  return out
}

/** Pulls text and files out of a paste or drop event. */
export function fromDataTransfer(dt: DataTransfer | null): ClipboardContents {
  if (!dt) return { text: '', files: [] }
  return { text: dt.getData('text/plain'), files: Array.from(dt.files) }
}
