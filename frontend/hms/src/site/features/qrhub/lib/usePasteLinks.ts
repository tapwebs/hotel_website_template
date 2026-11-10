import { useMemo, useState } from 'react'
import { parsePastedLinks } from './pasteLinks'
import type { LinkInput } from './types'

/** State for the paste box: text, parsed rows, the valid links and how many rows are invalid. */
export function usePasteLinks() {
  const [text, setText] = useState('')
  const rows = useMemo(() => parsePastedLinks(text), [text])
  const links: LinkInput[] = rows.flatMap((r) => (r.link ? [r.link] : []))
  const invalid = rows.filter((r) => r.error).length
  return { text, setText, rows, links, invalid }
}
