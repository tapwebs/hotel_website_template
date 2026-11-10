import { useState } from 'react'
import { Button } from '@/site/features/qrhub/components/ui/button'
import { Checkbox, Label } from '@/site/features/qrhub/components/ui/field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/site/features/qrhub/components/ui/dialog'
import { Notice } from '@/site/features/qrhub/components/common'
import { PasteLinksBox } from '@/site/features/qrhub/components/PasteLinks'
import { usePasteLinks } from '@/site/features/qrhub/lib/usePasteLinks'
import { ApiError, api } from '@/site/features/qrhub/lib/api'
import { errMsg } from '@/site/features/qrhub/lib/utils'
import type { RowError } from '@/site/features/qrhub/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** One organization (paste into its links) ... */
  slug?: string
  /** ... or pick many. */
  choices?: { slug: string; name: string }[]
  preselected?: string[]
  onDone: () => void
}

/** Paste many links, preview them with per-row errors, then save all-or-nothing to one or many organizations. */
export function PasteLinksDialog({ open, onOpenChange, slug, choices, preselected = [], onDone }: Props) {
  const paste = usePasteLinks()
  const [picked, setPicked] = useState<Set<string>>(new Set(preselected))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<RowError[]>([])
  const many = !slug

  const canSave = paste.links.length > 0 && paste.invalid === 0 && (!many || picked.size > 0) && !busy

  const save = async () => {
    setBusy(true)
    setError('')
    setRows([])
    try {
      if (slug) await api.bulkLinks(slug, paste.links)
      else await api.bulkLinksToOrganizations([...picked], paste.links)
      paste.setText('')
      onOpenChange(false)
      onDone()
    } catch (e) {
      setError(errMsg(e))
      if (e instanceof ApiError) setRows(e.rows)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{many ? 'Add links to many organizations' : 'Paste links'}</DialogTitle>
          <DialogDescription>
            {many ? 'The same links are added to every organization you pick.' : 'Add several links at once.'} All rows are saved together
            or not at all.
          </DialogDescription>
        </DialogHeader>
        {many && choices && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold text-walnut">Organizations</legend>
            <div className="grid max-h-40 gap-1 overflow-auto rounded-md border p-2 sm:grid-cols-2">
              {choices.map((c) => (
                <div key={c.slug} className="flex items-center gap-2">
                  <Checkbox
                    id={`pick-${c.slug}`}
                    checked={picked.has(c.slug)}
                    onChange={(e) =>
                      setPicked((s) => {
                        const n = new Set(s)
                        if (e.target.checked) n.add(c.slug)
                        else n.delete(c.slug)
                        return n
                      })
                    }
                  />
                  <Label htmlFor={`pick-${c.slug}`} className="font-normal">
                    {c.name}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>
        )}
        <PasteLinksBox state={paste} serverRows={rows} />
        {error && <Notice kind="error">{error}</Notice>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={save}>
            {busy ? 'Saving…' : `Add ${paste.links.length || ''} link${paste.links.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
