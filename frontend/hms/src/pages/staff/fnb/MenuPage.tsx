import React, { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Download, FolderCog, ImagePlus, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { fnbService } from '../../../services/fnbService';
import { useAuthStore } from '../../../stores/authStore';
import type { MenuItemInput } from '../../../types/fnb';
import type { MenuItem } from '../../../types/pms';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { LoadingState } from '../../../components/common/LoadingState';
import { DietDot, ErrorNote, MenuAction, MoreMenu, rupees, titleCase } from './fnbUi';
import { smartSearch } from './search';

const field = 'min-h-10 rounded-lg border border-input bg-card px-3 text-sm font-normal text-ink';
const TAGS = ['bestseller', 'chef', 'trending', 'spicy', 'new'];
const TAG_LABEL: Record<string, string> = { bestseller: 'Bestseller', chef: "Chef's special", trending: 'Trending', spicy: 'Spicy', new: 'New' };
type Opt = { id?: string; name: string; price: string; isDefault?: boolean };
const blank = {
  name: '', category: 'MAINS', description: '', price: '', originalPrice: '', kcal: '', dietaryType: 'veg' as NonNullable<MenuItem['dietaryType']>,
  isAvailable: true, station: 'MAIN_KITCHEN' as MenuItem['station'], prep: '15', imageUrl: '' as string, tags: [] as string[], variants: [] as Opt[], addOns: [] as Opt[], taxPercent: '' as string, // '' = restaurant default
};
type Form = typeof blank;
const paise = (s: string) => Math.round(Number(s) * 100);

const toForm = (i: MenuItem): Form => ({
  name: i.name, category: i.category, description: i.description ?? '', price: String(i.pricePaise / 100),
  originalPrice: i.originalPricePaise ? String(i.originalPricePaise / 100) : '', kcal: i.kcal ? String(i.kcal) : '',
  dietaryType: i.dietaryType ?? (i.isVeg ? 'veg' : 'non-veg'), isAvailable: i.isAvailable, station: i.station, prep: String(i.preparationTimeMinutes),
  imageUrl: i.imageUrl ?? '', tags: i.tags ?? [], taxPercent: i.taxPercent == null ? '' : String(i.taxPercent),
  variants: (i.variants ?? []).map((v) => ({ id: v.id, name: v.name, price: String(v.pricePaise / 100), isDefault: v.isDefault })),
  addOns: (i.addOns ?? []).map((a) => ({ id: a.id, name: a.name, price: String(a.pricePaise / 100) })),
});
const toInput = (f: Form): MenuItemInput => ({
  name: f.name.trim(), category: f.category.trim(), description: f.description.trim(), pricePaise: paise(f.price),
  isVeg: f.dietaryType === 'veg' || f.dietaryType === 'vegan', dietaryType: f.dietaryType, isAvailable: f.isAvailable, station: f.station,
  preparationTimeMinutes: Number(f.prep), imageUrl: f.imageUrl || null, tags: f.tags,
  originalPricePaise: f.originalPrice ? paise(f.originalPrice) : null, kcal: f.kcal ? Number(f.kcal) : null,
  taxPercent: f.taxPercent === '' ? null : Number(f.taxPercent),
  variants: f.variants.filter((v) => v.name.trim()).map((v) => ({ id: v.id, name: v.name.trim(), pricePaise: paise(v.price || '0'), isDefault: !!v.isDefault })),
  addOns: f.addOns.filter((a) => a.name.trim()).map((a) => ({ id: a.id, name: a.name.trim(), pricePaise: paise(a.price || '0') })),
});

/** Shrinks an uploaded photo to at most 800px and JPEG so it can be stored with the dish. */
async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const scale = Math.min(1, 800 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}

const invalidateMenu = (qc: ReturnType<typeof useQueryClient>) =>
  Promise.all([qc.invalidateQueries({ queryKey: ['fnb', 'menu'] }), qc.invalidateQueries({ queryKey: ['fnb', 'categories'] })]);
type Editing = { id?: string; form: Form; seq: number };
let editSeq = 0;
/** Menu management: categories, dishes with photos/tags/sizes/add-ons, sold-out (86) switch and JSON import/export. */
export const MenuPage: React.FC = () => {
  const qc = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission)('MANAGE_SETTINGS');
  const menu = useQuery({ queryKey: ['fnb', 'menu'], queryFn: fnbService.menu });
  const cats = useQuery({ queryKey: ['fnb', 'categories'], queryFn: fnbService.categories });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [category, setCategory] = useState('ALL');
  const [showCats, setShowCats] = useState(false);
  const [showIo, setShowIo] = useState(false);
  // Optimistic sold-out switch: flip the cached row at once, roll back if the server refuses.
  const toggle = useMutation({
    mutationFn: (i: MenuItem) => fnbService.updateMenuItem(i.id, { isAvailable: !i.isAvailable }),
    onMutate: async (i: MenuItem) => {
      await qc.cancelQueries({ queryKey: ['fnb', 'menu'] });
      const prev = qc.getQueryData<MenuItem[]>(['fnb', 'menu']);
      qc.setQueryData<MenuItem[]>(['fnb', 'menu'], (old) => old?.map((x) => (x.id === i.id ? { ...x, isAvailable: !i.isAvailable } : x)));
      return { prev };
    },
    onError: (_e, _i, ctx) => { if (ctx?.prev) qc.setQueryData(['fnb', 'menu'], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['fnb', 'menu'] }),
  });
  const remove = useMutation({ mutationFn: (id: string) => fnbService.deleteMenuItem(id), onSuccess: () => invalidateMenu(qc) });
  const filtered = useMemo(() => smartSearch((menu.data ?? []).filter((i) => category === 'ALL' || i.category === category), deferredSearch), [menu.data, category, deferredSearch]);
  const groups = useMemo(() => {
    const m = new Map<string, MenuItem[]>();
    filtered.forEach((i) => m.set(i.category, [...(m.get(i.category) ?? []), i]));
    return deferredSearch ? [['Results', filtered] as [string, MenuItem[]]] : [...m.entries()];
  }, [filtered, deferredSearch]);
  const categoryNames = useMemo(() => (cats.data ?? []).map((c) => c.name), [cats.data]);
  const toggleMutate = toggle.mutate;
  const removeMutate = remove.mutate;
  const onToggle = useCallback((i: MenuItem) => toggleMutate(i), [toggleMutate]);
  const onEdit = useCallback((i: MenuItem) => setEditing({ id: i.id, form: toForm(i), seq: ++editSeq }), []);
  const onRemove = useCallback((i: MenuItem) => { if (window.confirm(`Remove ${i.name} from the menu?`)) removeMutate(i.id); }, [removeMutate]);
  const closeEditor = useCallback(() => setEditing(null), []);
  const togglingId = toggle.isPending ? toggle.variables?.id : undefined;
  if (menu.isLoading) return <LoadingState message="Loading menu…" subtext="" />;
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Search dishes</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dishes (typos and cravings work)" className="min-h-10 w-full rounded-full border border-input bg-card pr-3 pl-9 text-sm" />
        </label>
        {canEdit && (
          <MoreMenu label="Menu tools">
            <MenuAction icon={<FolderCog className="size-4" />} onClick={() => setShowCats(true)}>Edit categories</MenuAction>
            <MenuAction icon={<Upload className="size-4" />} onClick={() => setShowIo(true)}>Import / export</MenuAction>
          </MoreMenu>
        )}
        {canEdit && <Button onClick={() => setEditing({ form: { ...blank, category: category !== 'ALL' ? category : categoryNames[0] ?? 'MAINS' }, seq: ++editSeq })}><Plus className="size-4" /> Add dish</Button>}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2.5 pt-1 md:mx-0 md:px-0" role="group" aria-label="Categories">
        {['ALL', ...categoryNames].map((c) => (
          <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}
            className={`min-h-9 rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${category === c ? 'border-burgundy bg-burgundy text-ivory' : 'border-border bg-ivory text-walnut'}`}>
            {c === 'ALL' ? 'All' : titleCase(c)}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Ran out? Flip the switch and guests and the POS stop offering the dish straight away.</p>
      <ErrorNote error={menu.error ?? toggle.error ?? remove.error} />
      {groups.map(([group, items]) => (
        <section key={group} aria-label={titleCase(group)} className="grid gap-2">
          <h2 className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">{titleCase(group)}</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-ivory">
            {items.map((i) => (
              <DishRow key={i.id} item={i} canEdit={canEdit} toggling={togglingId === i.id} onToggle={onToggle} onEdit={onEdit} onRemove={onRemove} />
            ))}
          </ul>
        </section>
      ))}
      {!filtered.length && <p className="py-10 text-center text-sm text-muted-foreground">No dishes match.</p>}
      <Modal isOpen={!!editing} onClose={closeEditor} title={editing?.id ? 'Edit dish' : 'Add dish'} maxWidth="2xl">
        {editing && <DishEditor key={editing.seq} initial={editing} categoryNames={categoryNames} onClose={closeEditor} />}
      </Modal>
      <CategoriesModal open={showCats} onClose={() => setShowCats(false)} />
      <ImportExportModal open={showIo} onClose={() => setShowIo(false)} />
    </div>
  );
};
type DishRowProps = { item: MenuItem; canEdit: boolean; toggling: boolean; onToggle: (i: MenuItem) => void; onEdit: (i: MenuItem) => void; onRemove: (i: MenuItem) => void };
/** One dish in the list. Memoized so typing in search or flipping another dish does not re-render every row. */
const DishRow = memo<DishRowProps>(({ item: i, canEdit, toggling, onToggle, onEdit, onRemove }) => (
  <li className="flex flex-wrap items-center gap-3 px-4 py-3 [content-visibility:auto] [contain-intrinsic-size:auto_72px]">
    {i.imageUrl ? <img src={i.imageUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" loading="lazy" /> : <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-gold-soft/30"><DietDot type={i.dietaryType} veg={i.isVeg} /></span>}
    <div className="min-w-0 flex-1 basis-48">
      <p className={`flex flex-wrap items-center gap-1.5 font-semibold ${i.isAvailable ? 'text-ink' : 'text-muted-foreground line-through'}`}>
        {i.imageUrl && <DietDot type={i.dietaryType} veg={i.isVeg} />}{i.name}
        {(i.tags ?? []).map((t) => <Badge key={t} size="sm" variant="gold">{TAG_LABEL[t] ?? t}</Badge>)}
      </p>
      <p className="truncate text-xs text-muted-foreground">
        {i.preparationTimeMinutes} min{i.kcal ? ` · ${i.kcal} kcal` : ''}
        {i.variants?.length ? ` · ${i.variants.length} sizes` : ''}{i.addOns?.length ? ` · ${i.addOns.length} add-ons` : ''}
      </p>
    </div>
    <span className="text-right font-semibold tabular-nums text-burgundy">
      {i.originalPricePaise && i.originalPricePaise > i.pricePaise ? <s className="mr-1 text-xs font-normal text-muted-foreground">{rupees(i.originalPricePaise)}</s> : null}
      {rupees(i.pricePaise)}
    </span>
    <button role="switch" aria-checked={i.isAvailable} aria-label={`${i.name} available`} disabled={toggling} onClick={() => onToggle(i)}
      className={`relative h-6 w-11 shrink-0 rounded-full outline-none pointer-coarse:before:absolute pointer-coarse:before:-inset-x-1 pointer-coarse:before:-inset-y-2.5 pointer-coarse:before:content-[''] transition-colors focus-visible:ring-[3px] focus-visible:ring-burgundy/40 ${i.isAvailable ? 'bg-emerald-600' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${i.isAvailable ? 'translate-x-5' : ''}`} />
    </button>
    <span className="w-16 text-xs whitespace-nowrap">{i.isAvailable ? <span className="text-emerald-800">On menu</span> : <Badge variant="destructive" size="sm">Sold out</Badge>}</span>
    {canEdit && (
      <span className="flex gap-1">
        <Button size="icon" variant="ghost" aria-label={`Edit ${i.name}`} onClick={() => onEdit(i)}><Pencil className="size-4" /></Button>
        <Button size="icon" variant="ghost" aria-label={`Remove ${i.name}`} onClick={() => onRemove(i)}><Trash2 className="size-4" /></Button>
      </span>
    )}
  </li>
));
DishRow.displayName = 'DishRow';
/** Add/edit dish form. Owns its own state so typing here never re-renders the dish list. */
const DishEditor: React.FC<{ initial: Editing; categoryNames: string[]; onClose: () => void }> = ({ initial, categoryNames, onClose }) => {
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(initial.form);
  const save = useMutation({
    mutationFn: ({ id, form }: { id?: string; form: Form }) => (id ? fnbService.updateMenuItem(id, toInput(form)) : fnbService.createMenuItem(toInput(form))),
    onSuccess: () => { onClose(); void invalidateMenu(qc); },
  });
  const categoryOptions = useMemo(() => {
    const list = [...categoryNames];
    if (f.category && !list.includes(f.category)) {
      list.unshift(f.category);
    }
    return list.length > 0 ? list : ['MAINS', 'STARTERS', 'BEVERAGES', 'DESSERTS', 'BREADS'];
  }, [categoryNames, f.category]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((e) => ({ ...e, [k]: v }));
  const valid = f.name.trim() && f.category.trim() && Number(f.price) >= 0 && f.price !== '' && Number(f.prep) >= 1;
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate({ id: initial.id, form: f }); }}>
      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <div className="grid content-start gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-gold-soft/20 text-xs text-walnut hover:border-burgundy/40 transition-colors" aria-label="Upload photo">
            {f.imageUrl ? <img src={f.imageUrl} alt="" className="size-full object-cover" /> : <span className="grid justify-items-center gap-1"><ImagePlus className="size-6" /> Photo</span>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file) set('imageUrl', await shrinkImage(file)); e.target.value = ''; }} />
          {f.imageUrl && <button type="button" className="text-xs text-rose-700 hover:underline" onClick={() => set('imageUrl', '')}>Remove photo</button>}
        </div>
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-semibold text-walnut">Name<input required maxLength={150} value={f.name} onChange={(e) => set('name', e.target.value)} className={field} /></label>
          <label className="grid gap-1.5 text-sm font-semibold text-walnut">Photo link (optional)<input value={f.imageUrl.startsWith('data:') ? '' : f.imageUrl} placeholder={f.imageUrl.startsWith('data:') ? 'Uploaded photo' : 'https://…'} onChange={(e) => set('imageUrl', e.target.value)} className={field} /></label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="col-span-2 sm:col-span-1 grid gap-1.5 text-sm font-semibold text-walnut">
          Category
          <select
            required
            value={f.category}
            onChange={(e) => set('category', e.target.value)}
            className={`${field} cursor-pointer`}
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {titleCase(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-1 grid gap-1.5 text-sm font-semibold text-walnut">
          Price (₹)
          <input required type="number" min={0} step="0.5" inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)} className={field} />
        </label>
        <label className="col-span-1 grid gap-1.5 text-sm font-semibold text-walnut">
          MRP (₹)
          <input type="number" min={0} step="0.5" inputMode="decimal" value={f.originalPrice} onChange={(e) => set('originalPrice', e.target.value)} placeholder="Strike-through" className={field} />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm font-semibold text-walnut">Description<textarea maxLength={500} rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} className={`${field} py-2`} /></label>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1.2fr_0.9fr_0.9fr_1.2fr]">
        <label className="grid gap-1.5 text-sm font-semibold text-walnut">
          Diet
          <select value={f.dietaryType} onChange={(e) => set('dietaryType', e.target.value as Form['dietaryType'])} className={`${field} cursor-pointer`}>
            <option value="veg">Veg</option><option value="non-veg">Non-veg</option><option value="egg">Egg</option><option value="vegan">Vegan</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-walnut">
          Prep (min)
          <input type="number" min={1} max={240} value={f.prep} onChange={(e) => set('prep', e.target.value)} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-walnut">
          kcal
          <input type="number" min={0} value={f.kcal} onChange={(e) => set('kcal', e.target.value)} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-walnut">
          GST rate
          <select value={f.taxPercent} onChange={(e) => set('taxPercent', e.target.value)} className={`${field} cursor-pointer`}>
            <option value="">Restaurant default</option>
            {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-sm font-semibold text-walnut">Tags</legend>
        {TAGS.map((t) => (
          <button key={t} type="button" aria-pressed={f.tags.includes(t)} onClick={() => set('tags', f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t])}
            className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${f.tags.includes(t) ? 'border-burgundy bg-burgundy text-ivory' : 'border-border bg-ivory text-walnut'}`}>{TAG_LABEL[t]}</button>
        ))}
      </fieldset>
      <OptionList title="Sizes / portions" hint="Each size has its own price, e.g. Half ₹220, Full ₹380." rows={f.variants} withDefault onChange={(v) => set('variants', v)} />
      <OptionList title="Add-ons" hint="Paid extras the guest can pick, e.g. Extra cheese +₹60." rows={f.addOns} onChange={(v) => set('addOns', v)} />
      <ErrorNote error={save.error} />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={!valid} isLoading={save.isPending}>{initial.id ? 'Save changes' : 'Add to menu'}</Button>
      </div>
    </form>
  );
};
const OptionList: React.FC<{ title: string; hint: string; rows: Opt[]; withDefault?: boolean; onChange: (rows: Opt[]) => void }> = ({ title, hint, rows, withDefault, onChange }) => (
  <fieldset className="grid gap-2 rounded-lg border border-border p-3">
    <legend className="px-1 text-sm font-semibold text-walnut">{title}</legend>
    <p className="text-xs text-muted-foreground">{hint}</p>
    {rows.map((r, n) => (
      <div key={n} className="flex items-center gap-2">
        <input aria-label={`${title} name`} value={r.name} onChange={(e) => onChange(rows.map((x, i) => (i === n ? { ...x, name: e.target.value } : x)))} placeholder="Name" className={`${field} flex-1`} />
        <input aria-label={`${title} price`} type="number" min={0} step="0.5" value={r.price} onChange={(e) => onChange(rows.map((x, i) => (i === n ? { ...x, price: e.target.value } : x)))} placeholder="₹" className={`${field} w-24`} />
        {withDefault && <label className="flex items-center gap-1 text-xs"><input type="radio" checked={!!r.isDefault} onChange={() => onChange(rows.map((x, i) => ({ ...x, isDefault: i === n })))} /> Default</label>}
        <Button type="button" size="icon" variant="ghost" aria-label="Remove" onClick={() => onChange(rows.filter((_, i) => i !== n))}><X className="size-4" /></Button>
      </div>
    ))}
    <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={() => onChange([...rows, { name: '', price: '' }])}><Plus className="size-3.5" /> Add</Button>
  </fieldset>
);

const CategoriesModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ['fnb', 'categories'], queryFn: fnbService.categories, enabled: open });
  const [name, setName] = useState('');
  const done = () => invalidateMenu(qc);
  const add = useMutation({ mutationFn: () => fnbService.addCategory(name), onSuccess: () => { setName(''); done(); } });
  const rename = useMutation({ mutationFn: (v: { id: string; name: string }) => fnbService.renameCategory(v.id, v.name), onSuccess: done });
  const del = useMutation({ mutationFn: (id: string) => fnbService.deleteCategory(id), onSuccess: done });
  const reorder = useMutation({ mutationFn: (ids: string[]) => fnbService.reorderCategories(ids), onSuccess: done });
  const list = cats.data ?? [];
  const move = (n: number, by: number) => {
    const ids = list.map((c) => c.id);
    const [x] = ids.splice(n, 1);
    ids.splice(n + by, 0, x);
    reorder.mutate(ids);
  };
  return (
    <Modal isOpen={open} onClose={onClose} title="Menu categories" maxWidth="md">
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">The order here is the order guests and the POS see. Renaming moves every dish with it.</p>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {list.map((c, n) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="flex-1 font-semibold text-ink">{titleCase(c.name)} <span className="font-normal text-muted-foreground">· {c.itemCount}</span></span>
              <Button size="icon" variant="ghost" aria-label={`Move ${c.name} up`} disabled={n === 0 || reorder.isPending} onClick={() => move(n, -1)}><ArrowUp className="size-4" /></Button>
              <Button size="icon" variant="ghost" aria-label={`Move ${c.name} down`} disabled={n === list.length - 1 || reorder.isPending} onClick={() => move(n, 1)}><ArrowDown className="size-4" /></Button>
              <Button size="icon" variant="ghost" aria-label={`Rename ${c.name}`} onClick={() => { const v = window.prompt('New name', titleCase(c.name)); if (v?.trim()) rename.mutate({ id: c.id, name: v }); }}><Pencil className="size-4" /></Button>
              <Button size="icon" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => window.confirm(`Delete ${titleCase(c.name)}?`) && del.mutate(c.id)}><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }}>
          <input aria-label="New category" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" maxLength={50} className={`${field} flex-1`} />
          <Button type="submit" isLoading={add.isPending}>Add</Button>
        </form>
        <ErrorNote error={add.error ?? rename.error ?? del.error ?? reorder.error} />
      </div>
    </Modal>
  );
};

const ImportExportModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [error, setError] = useState<string | null>(null);
  const imp = useMutation({
    mutationFn: () => fnbService.importMenu(JSON.parse(text), mode),
    onSuccess: () => { setText(''); void invalidateMenu(qc); },
  });
  const download = async () => {
    const data = await fnbService.exportMenu();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `menu-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
  };
  const run = () => {
    setError(null);
    try { JSON.parse(text); } catch { setError('That is not valid JSON.'); return; }
    if (mode === 'replace' && !window.confirm('Replace the whole menu? Dishes not in the file will be removed.')) return;
    imp.mutate();
  };
  return (
    <Modal isOpen={open} onClose={onClose} title="Import or export the menu" maxWidth="lg">
      <div className="grid gap-3">
        <Button variant="outline" className="justify-self-start" onClick={download}><Download className="size-4" /> Download menu JSON</Button>
        <p className="text-sm text-muted-foreground">Import uses the TapMenu format: <code>{'{"categories":[{"name":"Starters","items":[{"name":"…","price":280}]}]}'}</code>. Prices are in rupees.</p>
        <input type="file" accept="application/json,.json" aria-label="Choose JSON file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} className="text-sm" />
        <textarea aria-label="Menu JSON" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="…or paste JSON here" className={`${field} py-2 font-mono text-xs`} />
        <div role="radiogroup" aria-label="Import mode" className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Merge (update by dish name)</label>
          <label className="flex items-center gap-2"><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace the menu</label>
        </div>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <ErrorNote error={imp.error} />
        {imp.data && <p role="status" className="text-sm text-emerald-800">Imported: {imp.data.created} new, {imp.data.updated} updated.</p>}
        <Button disabled={!text.trim()} isLoading={imp.isPending} onClick={run}><Upload className="size-4" /> Import</Button>
      </div>
    </Modal>
  );
};
