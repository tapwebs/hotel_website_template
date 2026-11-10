import { Textarea } from '@/site/features/qrhub/components/ui/textarea'
import { Notice } from '@/site/features/qrhub/components/common'
import type { usePasteLinks } from '@/site/features/qrhub/lib/usePasteLinks'
import type { RowError } from '@/site/features/qrhub/lib/types'

export function PasteLinksBox({ state, serverRows }: { state: ReturnType<typeof usePasteLinks>; serverRows?: RowError[] }) {
  const { text, setText, rows, invalid } = state
  const serverBy = new Map<number, string>()
  serverRows?.forEach((r) => serverBy.set(r.index, r.message))
  return (
    <div className="grid gap-3">
      <label htmlFor="paste-links" className="text-sm font-semibold text-walnut">
        Links
      </label>
      <Textarea
        id="paste-links"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={'Book a Stay | https://example.com/book | Booking\nCall us | tel:+919876543210 | Connect'}
        className="font-mono text-xs"
        spellCheck={false}
      />
      <p className="text-xs text-muted-foreground">
        One per line: Title | URL | category (optional) | Hindi title (optional). Or paste a JSON array.
      </p>
      {rows.length > 0 && (
        <div className="max-h-60 overflow-auto rounded-md border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="p-2">#</th>
                <th className="p-2">Title</th>
                <th className="p-2">URL</th>
                <th className="p-2">Category</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const msg = r.error ?? serverBy.get(i)
                return (
                  <tr key={i} className="border-t align-top">
                    <td className="p-2">{r.line}</td>
                    <td className="p-2">{r.link?.title ?? ''}</td>
                    <td className="max-w-[12rem] p-2 break-all">{r.link?.destination_url ?? ''}</td>
                    <td className="p-2">{r.link?.category ?? ''}</td>
                    <td className={msg ? 'p-2 font-semibold text-destructive' : 'p-2 text-walnut'}>{msg ?? 'OK'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {invalid > 0 && (
        <Notice kind="error">{invalid} row(s) need fixing before you can save. Nothing is saved until every row is valid.</Notice>
      )}
    </div>
  )
}
