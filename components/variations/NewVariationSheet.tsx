/**
 * NewVariationSheet.tsx
 *
 * New variation form. Labour and materials are both composer → committed line item:
 * you fill in a composer, press Add, and it becomes a finished line with an edit cog
 * and a red cross. Nothing half-entered ever sits in the list.
 *
 * Behaviour spec: new-variation-redesign.html · rationale: variation-form-upgrade-guide.md
 * Written for the React/TypeScript web app. SwiftUI mapping is in the guide.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  rankMaterialRecords,
  variationCustomLineError,
  variationLineTotal,
  variationMaterialQuantityError,
  variationSubcontractorLineError,
} from '@/lib/canonical';
import { evidenceFileAllowed } from '@/lib/variations/variationModel';

/* ------------------------------------------------------------------ types */

export type Unit = 'no' | 'm' | 'box' | 'kg';

export interface LabourLine {
  id: string;
  trade: string;
  operatives: number; // >= 1
  hoursEach: number; // > 0
}

export interface MaterialLine {
  id: string;
  name: string;
  quantity: string;
  unit: Unit;
  /** Rulebook 1.52.0: a stored text that is not a quantity ("1-"). Shown as stored; editing it asks for a number. */
  legacyText?: string;
}

/** Rulebook 1.52.0: a custom line (quantity × cost). */
export interface CustomLineDraft {
  id: string;
  name: string;
  description: string;
  quantity: string;
  cost: string;
}

/** Rulebook 1.52.0: a subcontractor line (firm from the Subcontractors list or typed, quote number, cost × quantity). */
export interface SubcontractorLineDraft {
  id: string;
  subcontractorId: string;
  name: string;
  quoteNumber: string;
  quantity: string;
  cost: string;
}

/** One attachment. A variation holds up to MAX_EVIDENCE of these, not a single file. */
export interface EvidenceFile {
  id: string;
  file: File;
  name: string;
}

export interface CatalogueItem {
  name: string;
  defaultUnit: Unit;
}

export interface VariationDraft {
  voNumber: string;
  heading: string;
  description: string;
  /** hours on the saved document = operatives × hoursEach, see toPayload() */
  labour: LabourLine[];
  materials: MaterialLine[];
  customLines: CustomLineDraft[];
  subcontractorLines: SubcontractorLineDraft[];
  /** zero or more attachments, up to MAX_EVIDENCE */
  evidence: EvidenceFile[];
}

export interface NewVariationSheetProps {
  parentName: string;
  defaultVoNumber: string;
  voNumberLocked?: boolean;
  trades: string[];
  /** most-used trades for this org, in order; falls back to the first five */
  recentTrades?: string[];
  materialCatalogue?: CatalogueItem[];
  /** hours presets from the org's working-hours settings; defaults to 4 / 8 / 10 */
  hourPresets?: { label: string; hours: number }[];
  /** called when someone types a trade that is not in the list — persist it to the org's trade list */
  onCustomTrade?: (trade: string) => void;
  onSave: (draft: VariationDraft) => Promise<void> | void;
  onCancel: () => void;
  initialHeading?: string;
  initialDescription?: string;
  initialLabour?: LabourLine[];
  initialMaterials?: MaterialLine[];
  initialCustomLines?: CustomLineDraft[];
  initialSubcontractorLines?: SubcontractorLineDraft[];
  /** The organisation's Subcontractors list, for the subcontractor line picker. */
  subcontractors?: { id: string; name: string }[];
  /** Organisation currency symbol, and the money formatter (`formatMoney`). */
  currencySymbol?: string;
  formatCost?: (amount: number) => string;
  /** Files already stored on this variation. New picks share the same ten-file limit. */
  savedEvidenceCount?: number;
  title?: string;
}

const UNITS: Unit[] = ['no', 'm', 'box', 'kg'];
const DEFAULT_PRESETS = [
  { label: 'Half day', hours: 4 },
  { label: 'Full day', hours: 8 },
  { label: 'Day + 2', hours: 10 },
];
const UNDO_MS = 5000;
/** A variation carries a SET of evidence — before shots, after shots, the client's email,
 *  the revised drawing. Several files can be picked at once and more added later. */
export const MAX_EVIDENCE = 10;

const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1));
export const lineHours = (l: LabourLine) => (l.operatives || 1) * (l.hoursEach || 0);

/** Flattens to the shape the existing Firestore document expects. */
export const toPayload = (draft: VariationDraft) => ({
  ...draft,
  labour: draft.labour.map((l) => ({ trade: l.trade, hours: lineHours(l) })),
});

/* ------------------------------------------------------------- composers */

interface LabourComposer {
  open: boolean;
  trade: string;
  operatives: number;
  hoursEach: number;
  editId: string | null;
  duplicateOf: string | null;
}

const emptyLabourComposer = (open: boolean): LabourComposer => ({
  open,
  trade: '',
  operatives: 1,
  hoursEach: 8,
  editId: null,
  duplicateOf: null,
});

interface PendingUndo {
  message: string;
  restore: () => void;
}

/* ------------------------------------------------------------- component */

export function NewVariationSheet({
  parentName,
  defaultVoNumber,
  voNumberLocked = false,
  trades,
  recentTrades,
  materialCatalogue = [],
  hourPresets = DEFAULT_PRESETS,
  onCustomTrade,
  onSave,
  onCancel,
  initialHeading = '',
  initialDescription = '',
  initialLabour = [],
  initialMaterials = [],
  initialCustomLines = [],
  initialSubcontractorLines = [],
  subcontractors = [],
  currencySymbol = '£',
  formatCost = (amount: number) => `${currencySymbol}${amount.toFixed(2)}`,
  savedEvidenceCount = 0,
  title = 'New variation',
}: NewVariationSheetProps) {
  const [voNumber, setVoNumber] = useState(defaultVoNumber);
  const [heading, setHeading] = useState(initialHeading);
  const [description, setDescription] = useState(initialDescription);
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  const [labour, setLabour] = useState<LabourLine[]>(initialLabour);
  const [materials, setMaterials] = useState<MaterialLine[]>(initialMaterials);
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [customLines, setCustomLines] = useState<CustomLineDraft[]>(initialCustomLines);
  const [subLines, setSubLines] = useState<SubcontractorLineDraft[]>(initialSubcontractorLines);
  const [customDraft, setCustomDraft] = useState<CustomLineDraft | null>(null);
  const [subDraft, setSubDraft] = useState<SubcontractorLineDraft | null>(null);
  const [lineError, setLineError] = useState<string | null>(null);
  const [mError, setMError] = useState<string | null>(null);

  const [lc, setLc] = useState<LabourComposer>(emptyLabourComposer(false));
  const [tradeSheetOpen, setTradeSheetOpen] = useState(false);
  const [tradeQuery, setTradeQuery] = useState('');
  const [customTradeOpen, setCustomTradeOpen] = useState(false);
  const [customTrade, setCustomTrade] = useState('');
  /** trades added by hand in this session; persist these to the org's trade list on save */
  const [extraTrades, setExtraTrades] = useState<string[]>([]);

  const [mName, setMName] = useState('');
  const [mQty, setMQty] = useState('');
  const [mUnit, setMUnit] = useState<Unit>('no');
  const [mEditId, setMEditId] = useState<string | null>(null);

  const [undo, setUndo] = useState<PendingUndo | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoursRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalHours = useMemo(() => labour.reduce((s, l) => s + lineHours(l), 0), [labour]);
  const chips = [...extraTrades, ...(recentTrades?.length ? recentTrades : trades.slice(0, 5))].slice(0, 6);
  const composerTotal = lc.operatives * lc.hoursEach;
  const canCommitLabour = Boolean(lc.trade) && lc.operatives >= 1 && lc.hoursEach > 0;

  const suggestions = useMemo(() => {
    if (!mName.trim()) return [];
    return rankMaterialRecords(
      mName,
      materialCatalogue.map((item) => ({ name: item.name })),
      12
    ).map((hit) => materialCatalogue[hit.index]);
  }, [mName, materialCatalogue]);

  const allTrades = useMemo(() => [...extraTrades, ...trades], [extraTrades, trades]);

  const filteredTrades = useMemo(() => {
    const q = tradeQuery.trim().toLowerCase();
    return q ? allTrades.filter((t) => t.toLowerCase().includes(q)) : allTrades;
  }, [tradeQuery, allTrades]);

  const commitCustomTrade = () => {
    const name = customTrade.trim();
    if (!name) return;
    if (!allTrades.some((t) => t.toLowerCase() === name.toLowerCase())) {
      setExtraTrades((prev) => [name, ...prev]);
      onCustomTrade?.(name);
    }
    setCustomTrade('');
    setCustomTradeOpen(false);
    chooseTrade(name);
  };

  const showUndo = useCallback((message: string, restore?: () => void) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(restore ? { message, restore } : { message, restore: () => {} });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }, []);

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  /* ------------------------------------------------------------- labour */

  const chooseTrade = (trade: string) => {
    setLc((c) => ({ ...c, open: true, trade, duplicateOf: null }));
    setTradeSheetOpen(false);
    setTradeQuery('');
    requestAnimationFrame(() => hoursRef.current?.focus());
  };

  const commitLabour = (mode: 'new' | 'merge' | 'separate' = 'new') => {
    if (!canCommitLabour) return;

    // merge into the line that already uses this trade
    if (mode === 'merge' && lc.duplicateOf) {
      const target = labour.find((l) => l.id === lc.duplicateOf);
      if (target) {
        const merged = lineHours(target) + composerTotal;
        setLabour((prev) =>
          prev.map((l) => (l.id === target.id ? { ...l, operatives: 1, hoursEach: merged } : l)),
        );
        showUndo(`${target.trade} merged — ${fmt(merged)} hrs`);
      }
      setLc(emptyLabourComposer(false));
      return;
    }

    // update an existing line
    if (lc.editId) {
      setLabour((prev) =>
        prev.map((l) =>
          l.id === lc.editId
            ? { ...l, trade: lc.trade, operatives: lc.operatives, hoursEach: lc.hoursEach }
            : l,
        ),
      );
      showUndo(`${lc.trade} updated`);
      setLc(emptyLabourComposer(false));
      return;
    }

    // first press on a trade that is already on the variation → ask, don't guess
    if (mode === 'new') {
      const dupe = labour.find((l) => l.trade === lc.trade);
      if (dupe) {
        setLc((c) => ({ ...c, duplicateOf: dupe.id }));
        return;
      }
    }

    setLabour((prev) => [
      ...prev,
      { id: uid(), trade: lc.trade, operatives: lc.operatives, hoursEach: lc.hoursEach },
    ]);
    setLc(emptyLabourComposer(true)); // stay open, ready for the next trade
  };

  const editLabour = (id: string) => {
    const l = labour.find((x) => x.id === id);
    if (!l) return;
    setLc({
      open: true,
      trade: l.trade,
      operatives: l.operatives,
      hoursEach: l.hoursEach,
      editId: l.id,
      duplicateOf: null,
    });
  };

  const removeLabour = (id: string) => {
    const index = labour.findIndex((l) => l.id === id);
    if (index < 0) return;
    const removed = labour[index];
    setLabour((prev) => prev.filter((l) => l.id !== id));
    if (lc.editId === id) setLc(emptyLabourComposer(false));
    showUndo(`${removed.trade} removed`, () =>
      setLabour((prev) => {
        const next = [...prev];
        next.splice(index, 0, removed);
        return next;
      }),
    );
  };

  /* ---------------------------------------------------------- materials */

  const commitMaterial = () => {
    const name = mName.trim();
    if (!name) return;
    // Rulebook 1.52.0: the quantity is a number (`variationMaterialQuantityError`); the unit is its own field.
    const qty = (mQty.trim() || '1').replace(',', '.');
    const qtyError = variationMaterialQuantityError(qty);
    if (qtyError) {
      setMError(qtyError);
      requestAnimationFrame(() => qtyRef.current?.focus());
      return;
    }
    setMError(null);
    if (mEditId) {
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === mEditId ? { ...m, name, quantity: qty, unit: mUnit, legacyText: undefined } : m,
        ),
      );
      showUndo(`${name} updated`);
      setMEditId(null);
    } else {
      setMaterials((prev) => [
        ...prev,
        { id: uid(), name, quantity: qty, unit: mUnit },
      ]);
    }
    setMName('');
    setMQty('');
    requestAnimationFrame(() => nameRef.current?.focus());
  };

  const editMaterial = (id: string) => {
    const m = materials.find((x) => x.id === id);
    if (!m) return;
    setMName(m.name);
    setMQty(m.legacyText ? '' : m.quantity);
    setMUnit(m.unit);
    setMEditId(m.id);
    requestAnimationFrame(() => qtyRef.current?.focus());
  };

  const removeMaterial = (id: string) => {
    const index = materials.findIndex((m) => m.id === id);
    if (index < 0) return;
    const removed = materials[index];
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    if (mEditId === id) {
      setMEditId(null);
      setMName('');
      setMQty('');
    }
    showUndo(`${removed.name} removed`, () =>
      setMaterials((prev) => {
        const next = [...prev];
        next.splice(index, 0, removed);
        return next;
      }),
    );
  };

  const onComposerKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitMaterial();
    }
  };

  /* ----------------------------------------------------- evidence, save */

  /** Accepts any number of files at once, and can be called again to add more. */
  const onFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    if (fileRef.current) fileRef.current.value = '';
    const blocked = picked.find((file) => evidenceFileAllowed(file));
    if (blocked) {
      setError(evidenceFileAllowed(blocked));
      return;
    }
    setError(null);
    setEvidence((prev) => {
      const room = MAX_EVIDENCE - savedEvidenceCount - prev.length;
      if (room <= 0) {
        showUndo(`Up to ${MAX_EVIDENCE} files per variation`);
        return prev;
      }
      const incoming = picked.map((file) => ({ id: uid(), file, name: file.name }));
      if (incoming.length > room) {
        showUndo(`Only ${room} more file${room === 1 ? '' : 's'} fit on this variation`);
      }
      return [...prev, ...incoming.slice(0, room)];
    });
  };

  const evidenceTotal = savedEvidenceCount + evidence.length;
  const canSave = heading.trim().length > 0 && !saving && !customDraft && !subDraft;

  /* ------------------------------------------------ custom and subcontractor lines */

  const commitCustom = () => {
    if (!customDraft) return;
    const problem = variationCustomLineError(customDraft);
    if (problem) return setLineError(problem);
    setLineError(null);
    setCustomLines((prev) => (prev.some((l) => l.id === customDraft.id) ? prev.map((l) => (l.id === customDraft.id ? customDraft : l)) : [...prev, customDraft]));
    setCustomDraft(null);
  };

  const commitSub = () => {
    if (!subDraft) return;
    const problem = variationSubcontractorLineError(subDraft);
    if (problem) return setLineError(problem);
    setLineError(null);
    setSubLines((prev) => (prev.some((l) => l.id === subDraft.id) ? prev.map((l) => (l.id === subDraft.id ? subDraft : l)) : [...prev, subDraft]));
    setSubDraft(null);
  };

  const removeCustom = (id: string) => {
    const index = customLines.findIndex((l) => l.id === id);
    if (index < 0) return;
    const removed = customLines[index];
    setCustomLines((prev) => prev.filter((l) => l.id !== id));
    showUndo(`${removed.name} removed`, () => setCustomLines((prev) => { const next = [...prev]; next.splice(index, 0, removed); return next; }));
  };

  const removeSub = (id: string) => {
    const index = subLines.findIndex((l) => l.id === id);
    if (index < 0) return;
    const removed = subLines[index];
    setSubLines((prev) => prev.filter((l) => l.id !== id));
    showUndo(`${removed.name} removed`, () => setSubLines((prev) => { const next = [...prev]; next.splice(index, 0, removed); return next; }));
  };

  const amount = (value: string) => {
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  // Rulebook 1.52.0 `variationLineTotal`: the same line total the reader, the totals and the export use.
  const draftTotal = (line: { quantity: string; cost: string }) => variationLineTotal(line);
  const costTotal = [...customLines, ...subLines].reduce((sum, line) => sum + draftTotal(line), 0);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        voNumber,
        heading: heading.trim(),
        description: description.trim(),
        labour,
        materials,
        customLines,
        subcontractorLines: subLines,
        evidence,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the variation.');
      setSaving(false);
    }
  };

  /* -------------------------------------------------------------- icons */

  const CogIcon = () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );

  const XIcon = () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );

  /* ------------------------------------------------------ shared classes */

  const card = 'mb-3 rounded-3xl border border-(--line) bg-(--card) shadow-xs';
  const headRow = 'flex items-center gap-2 px-4 pb-2 pt-4';
  const pill = (on: boolean) =>
    `ml-auto rounded-full px-3 py-1 font-semibold text-sm font-extrabold tabular-nums ${
      on ? 'bg-(--proj-t) text-(--proj)' : 'bg-(--soft) text-(--ink2)'
    }`;
  const cogBtn = 'grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-(--line) bg-(--card) text-(--ink2)';
  const delBtn = 'grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-(--red)/25 bg-(--red-t) text-(--red)';
  const fieldBox = 'rounded-2xl bg-(--card) p-2.5 shadow-xs';
  const microLabel = 'mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-(--ink3)';
  const stepBtn = 'h-9 w-9 rounded-xl bg-(--soft) text-lg font-bold text-(--blue) disabled:opacity-30';

  return (
    <div className="relative flex h-full flex-col bg-(--bg) text-(--ink)">
      <header className="flex items-center justify-between gap-2 px-4 py-2">
        <button type="button" onClick={onCancel} className="p-1 font-semibold text-(--blue)">Cancel</button>
        <span className="font-semibold text-base font-bold">{title}</span>
        <button type="button" onClick={handleSave} disabled={!canSave} className="p-1 font-semibold text-(--blue) disabled:opacity-40">Save</button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {/* details */}
        <section className={card}>
          <div className="px-4 pb-4 pt-4">
            <button
              type="button"
              disabled={voNumberLocked}
              onClick={() => { const n = window.prompt('VO number', voNumber); if (n) setVoNumber(n); }}
              className="inline-flex items-center gap-2 rounded-full bg-(--rep-t) px-3 py-1 text-xs font-extrabold text-(--rep) disabled:opacity-70"
            >
              {voNumber} · {voNumberLocked ? 'from tracker' : 'auto'}
            </button>
            <input
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="Heading"
              className="w-full bg-transparent pb-1 pt-3 font-semibold text-xl font-bold tracking-tight outline-hidden placeholder:font-semibold placeholder:text-(--ink3)"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What changed, who asked for it, and where."
              rows={descriptionOpen ? 8 : 3}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-(--ink2) outline-hidden"
            />
            <button type="button" onClick={() => setDescriptionOpen((v) => !v)} className="py-1 text-sm font-bold text-(--blue)">
              {descriptionOpen ? 'Less' : 'More detail'}
            </button>
          </div>
        </section>

        {/* labour */}
        <section className={card}>
          <div className={headRow}>
            <h3 className="font-semibold text-base font-extrabold">Labour</h3>
            <span className={pill(totalHours > 0)}>{fmt(totalHours)} hrs</span>
          </div>

          <div className="px-4 pb-4">
            {labour.length === 0 && !lc.open && (
              <p className="pb-1 pt-1 text-[13px] text-(--ink3)">No labour added yet.</p>
            )}

            {labour.map((l) => (
              <div
                key={l.id}
                className={`flex items-center gap-2 border-b border-(--line) py-3 last:border-b-0 ${
                  lc.editId === l.id ? '-mx-2.5 rounded-2xl border-b-0 bg-(--blue-t) px-2.5' : ''
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{l.trade}</span>
                  {l.operatives > 1 && (
                    <span className="block text-xs text-(--ink3)">
                      {l.operatives} operatives × {fmt(l.hoursEach)} hrs each
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap rounded-lg bg-(--soft) px-2.5 py-1 font-semibold text-[15px] font-extrabold tabular-nums">
                  {fmt(lineHours(l))} hrs
                </span>
                <button type="button" className={cogBtn} aria-label={`Edit ${l.trade}`} onClick={() => editLabour(l.id)}>
                  <CogIcon />
                </button>
                <button type="button" className={delBtn} aria-label={`Remove ${l.trade}`} onClick={() => removeLabour(l.id)}>
                  <XIcon />
                </button>
              </div>
            ))}

            {lc.open ? (
              <div className={`mt-1 rounded-2xl border p-3 ${lc.editId ? 'border-(--blue)/30 bg-(--blue-t)' : 'border-(--line) bg-(--soft)'}`}>
                <span className={microLabel}>{lc.editId ? 'Editing line item' : 'New labour item'}</span>

                <button
                  type="button"
                  onClick={() => setTradeSheetOpen(true)}
                  className="flex w-full items-center gap-2 rounded-2xl bg-(--card) p-3 text-left text-base font-semibold shadow-xs"
                >
                  {lc.trade ? <span>{lc.trade}</span> : <span className="font-normal text-(--ink3)">Choose a trade</span>}
                  <span className="ml-auto text-[13px] text-(--ink3)">Change ›</span>
                </button>

                {!lc.trade && (
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 pt-2.5 scrollbar-none [&::-webkit-scrollbar]:hidden">
                    {chips.map((t) => (
                      <button key={t} type="button" onClick={() => chooseTrade(t)} className="shrink-0 whitespace-nowrap rounded-full border border-(--line) bg-(--card) px-3.5 py-2 text-[13px] font-semibold">
                        {t}
                      </button>
                    ))}
                    <button type="button" onClick={() => setTradeSheetOpen(true)} className="shrink-0 whitespace-nowrap rounded-full border border-(--line) bg-(--card) px-3.5 py-2 text-[13px] font-bold text-(--blue)">
                      All trades
                    </button>
                  </div>
                )}

                <div className="mt-2.5 grid grid-cols-1 gap-2.5">
                  <div className={fieldBox}>
                    <span className={microLabel}>Operatives</span>
                    <div className="flex items-center gap-0.5">
                      <button type="button" aria-label="Fewer operatives" disabled={lc.operatives <= 1} onClick={() => setLc((c) => ({ ...c, operatives: Math.max(1, c.operatives - 1) }))} className={stepBtn}>−</button>
                      <input
                        value={lc.operatives}
                        onChange={(e) => setLc((c) => ({ ...c, operatives: Math.min(999, Math.max(1, parseInt(e.target.value || '1', 10) || 1)) }))}
                        inputMode="numeric"
                        aria-label="Number of operatives"
                        className="min-w-0 flex-1 bg-transparent text-center font-semibold text-[17px] font-extrabold tabular-nums outline-hidden"
                      />
                      <button type="button" aria-label="More operatives" onClick={() => setLc((c) => ({ ...c, operatives: Math.min(999, c.operatives + 1) }))} className={stepBtn}>+</button>
                    </div>
                  </div>

                  <div className={fieldBox}>
                    <span className={microLabel}>Hours each</span>
                    <div className="flex items-center gap-0.5">
                      <button type="button" aria-label="Fewer hours" disabled={lc.hoursEach <= 0} onClick={() => setLc((c) => ({ ...c, hoursEach: Math.max(0, Math.round((c.hoursEach - 0.5) * 2) / 2) }))} className={stepBtn}>−</button>
                      <input
                        ref={hoursRef}
                        value={lc.hoursEach || ''}
                        onChange={(e) => setLc((c) => ({ ...c, hoursEach: Math.min(10000, Math.max(0, Number(e.target.value.replace(',', '.')) || 0)) }))}
                        inputMode="decimal"
                        placeholder="0"
                        aria-label="Hours per operative"
                        className="min-w-0 flex-1 bg-transparent text-center font-semibold text-[17px] font-extrabold tabular-nums outline-hidden"
                      />
                      <button type="button" aria-label="More hours" onClick={() => setLc((c) => ({ ...c, hoursEach: Math.min(10000, Math.round((c.hoursEach + 0.5) * 2) / 2) }))} className={stepBtn}>+</button>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {hourPresets.map((p) => (
                    <button key={p.label} type="button" onClick={() => setLc((c) => ({ ...c, hoursEach: p.hours }))} className="rounded-xl bg-(--card) px-3 py-2 text-xs font-bold text-(--blue) shadow-xs">
                      {p.label}
                    </button>
                  ))}
                </div>

                {lc.duplicateOf && (
                  <p role="status" className="mt-2.5 rounded-xl bg-(--warn-t) px-3 py-2.5 text-xs leading-snug text-(--ink2)">
                    <b className="text-(--warn)">{lc.trade} is already on this variation.</b> Merge them into one
                    line, or add a second line if this was a separate visit.
                  </p>
                )}

                <div className="mt-2.5 flex gap-2">
                  {lc.duplicateOf ? (
                    <>
                      <button type="button" onClick={() => commitLabour('separate')} className="flex-1 rounded-2xl bg-(--card) py-3 text-sm font-bold text-(--ink2) shadow-xs">Add separate</button>
                      <button type="button" onClick={() => commitLabour('merge')} className="flex-1 rounded-2xl bg-(--blue) py-3 text-sm font-bold text-white">Merge</button>
                    </>
                  ) : (
                    <>
                      {(lc.editId || lc.trade) && (
                        <button type="button" onClick={() => setLc(emptyLabourComposer(false))} className="flex-1 rounded-2xl bg-(--card) py-3 text-sm font-bold text-(--ink2) shadow-xs">Cancel</button>
                      )}
                      <button type="button" onClick={() => commitLabour('new')} disabled={!canCommitLabour} className="flex-1 rounded-2xl bg-(--blue) py-3 text-sm font-bold text-white disabled:opacity-40">
                        {lc.editId ? 'Update line item' : `Add${composerTotal > 0 ? ` · ${fmt(composerTotal)} hrs` : ''}`}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setLc(emptyLabourComposer(true))} className="mt-2.5 w-full rounded-2xl border-[1.5px] border-dashed border-(--line2) bg-(--card) py-3 text-sm font-bold text-(--blue)">
                + Add labour item
              </button>
            )}
          </div>
        </section>

        {/* materials */}
        <section className={card}>
          <div className={headRow}>
            <h3 className="font-semibold text-base font-extrabold">Materials</h3>
            <span className={pill(materials.length > 0)}>
              {materials.length} line{materials.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="px-4 pb-4">
            {materials.length === 0 && <p className="pb-1 text-[13px] text-(--ink3)">No materials added yet.</p>}

            {materials.map((m) => (
              <div key={m.id} className={`flex items-center gap-2 border-b border-(--line) py-3 last:border-b-0 ${mEditId === m.id ? '-mx-2.5 rounded-2xl border-b-0 bg-(--blue-t) px-2.5' : ''}`}>
                <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{m.name}</span>
                <span className="whitespace-nowrap rounded-lg bg-(--soft) px-2.5 py-1 font-semibold text-[15px] font-extrabold tabular-nums">
                  {m.legacyText ?? `${m.quantity} ${m.unit}`}
                </span>
                <button type="button" className={cogBtn} aria-label={`Edit ${m.name}`} onClick={() => editMaterial(m.id)}><CogIcon /></button>
                <button type="button" className={delBtn} aria-label={`Remove ${m.name}`} onClick={() => removeMaterial(m.id)}><XIcon /></button>
              </div>
            ))}

            <div className={`mt-2.5 rounded-2xl border p-3 ${mEditId ? 'border-(--blue)/30 bg-(--blue-t)' : 'border-(--line) bg-(--soft)'}`}>
              <span className={microLabel}>{mEditId ? 'Editing line item' : 'New material'}</span>
              <div className="flex items-center gap-2">
                <input ref={nameRef} value={mName} onChange={(e) => setMName(e.target.value)} onKeyDown={onComposerKey} placeholder="Material name" aria-label="Material name" className="min-w-0 flex-1 rounded-2xl bg-(--card) p-3 text-base shadow-xs outline-hidden" />
                <input ref={qtyRef} value={mQty} onChange={(e) => setMQty(e.target.value)} onKeyDown={onComposerKey} placeholder="Qty" inputMode="decimal" aria-label="Quantity or length" className="w-20 rounded-2xl bg-(--card) p-3 text-center text-base font-bold tabular-nums shadow-xs outline-hidden" />
              </div>

              <div className="mt-2 flex gap-1 rounded-xl bg-(--card) p-1 shadow-xs" role="group" aria-label="Unit">
                {UNITS.map((u) => (
                  <button key={u} type="button" aria-pressed={mUnit === u} onClick={() => setMUnit(u)} className={`flex-1 rounded-lg px-1 py-2 text-[13px] font-bold ${mUnit === u ? 'bg-(--blue) text-white' : 'text-(--ink2)'}`}>{u}</button>
                ))}
              </div>

              {suggestions.length > 0 && (
                <ul className="mt-2 overflow-hidden rounded-xl bg-(--card) shadow-xs">
                  {suggestions.map((s) => (
                    <li key={s.name}>
                      <button type="button" onClick={() => { setMName(s.name); setMUnit(s.defaultUnit); requestAnimationFrame(() => qtyRef.current?.focus()); }} className="flex w-full items-center gap-2 border-b border-(--line) px-3 py-2.5 text-left text-[15px] last:border-b-0">
                        {s.name}
                        <small className="ml-auto text-xs font-semibold text-(--ink3)">{s.defaultUnit}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {mError ? <p role="alert" className="mt-2 text-xs font-semibold text-(--red)">{mError}</p> : null}
              <div className="mt-2.5 flex gap-2">
                {mEditId && (
                  <button type="button" onClick={() => { setMEditId(null); setMName(''); setMQty(''); setMError(null); }} className="flex-1 rounded-2xl bg-(--card) py-3 text-sm font-bold text-(--ink2) shadow-xs">Cancel</button>
                )}
                <button type="button" onClick={commitMaterial} disabled={!mName.trim()} className="flex-1 rounded-2xl bg-(--blue) py-3 text-sm font-bold text-white disabled:opacity-40">
                  {mEditId ? 'Update line item' : 'Add material'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* custom lines (1.52.0) */}
        <section className={card}>
          <div className={headRow}>
            <h3 className="font-semibold text-base font-extrabold">Custom items</h3>
            <span className={pill(customLines.length > 0)}>{customLines.length} line{customLines.length === 1 ? '' : 's'}</span>
          </div>
          <div className="px-4 pb-4">
            {customLines.length === 0 && !customDraft && <p className="pb-1 text-[13px] text-(--ink3)">Anything else this variation costs: skip hire, access equipment, a fee.</p>}
            {customLines.map((l) => (
              <div key={l.id} className="flex items-center gap-2 border-b border-(--line) py-3 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{l.name}</span>
                  <span className="block truncate text-xs text-(--ink3)">
                    {l.quantity || '1'} × {formatCost(amount(l.cost))}{l.description ? ` · ${l.description}` : ''}
                  </span>
                </span>
                <span className="whitespace-nowrap rounded-lg bg-(--soft) px-2.5 py-1 font-semibold text-[15px] font-extrabold tabular-nums">{formatCost(draftTotal(l))}</span>
                <button type="button" className={cogBtn} aria-label={`Edit ${l.name}`} onClick={() => setCustomDraft({ ...l })}><CogIcon /></button>
                <button type="button" className={delBtn} aria-label={`Remove ${l.name}`} onClick={() => removeCustom(l.id)}><XIcon /></button>
              </div>
            ))}
            {customDraft ? (
              <div className="mt-2.5 rounded-2xl border border-(--line) bg-(--soft) p-3">
                <span className={microLabel}>Custom item</span>
                <input value={customDraft.name} onChange={(e) => setCustomDraft({ ...customDraft, name: e.target.value })} placeholder="Name" aria-label="Custom item name" className="w-full rounded-2xl bg-(--card) p-3 text-base shadow-xs outline-hidden" />
                <textarea value={customDraft.description} onChange={(e) => setCustomDraft({ ...customDraft, description: e.target.value })} placeholder="Description (optional)" aria-label="Custom item description" rows={2} className="mt-2 w-full resize-none rounded-2xl bg-(--card) p-3 text-sm shadow-xs outline-hidden" />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className={fieldBox}><span className={microLabel}>Quantity</span><input value={customDraft.quantity} onChange={(e) => setCustomDraft({ ...customDraft, quantity: e.target.value })} inputMode="decimal" aria-label="Custom item quantity" className="w-full bg-transparent text-[17px] font-extrabold tabular-nums outline-hidden" /></label>
                  <label className={fieldBox}><span className={microLabel}>Cost each ({currencySymbol})</span><input value={customDraft.cost} onChange={(e) => setCustomDraft({ ...customDraft, cost: e.target.value })} inputMode="decimal" placeholder="0.00" aria-label="Custom item cost each" className="w-full bg-transparent text-[17px] font-extrabold tabular-nums outline-hidden" /></label>
                </div>
                <p className="mt-2 text-xs text-(--ink2)">Line total {formatCost(draftTotal(customDraft))}</p>
                {lineError ? <p role="alert" className="mt-2 text-xs font-semibold text-(--red)">{lineError}</p> : null}
                <div className="mt-2.5 flex gap-2">
                  <button type="button" onClick={() => { setCustomDraft(null); setLineError(null); }} className="flex-1 rounded-2xl bg-(--card) py-3 text-sm font-bold text-(--ink2) shadow-xs">Cancel</button>
                  <button type="button" onClick={commitCustom} className="flex-1 rounded-2xl bg-(--blue) py-3 text-sm font-bold text-white">{customLines.some((l) => l.id === customDraft.id) ? 'Update line item' : 'Add item'}</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => { setSubDraft(null); setCustomDraft({ id: uid(), name: '', description: '', quantity: '1', cost: '' }); }} className="mt-2.5 w-full rounded-2xl border-[1.5px] border-dashed border-(--line2) bg-(--card) py-3 text-sm font-bold text-(--blue)">
                + Add custom item
              </button>
            )}
          </div>
        </section>

        {/* subcontractor lines (1.52.0) */}
        <section className={card}>
          <div className={headRow}>
            <h3 className="font-semibold text-base font-extrabold">Subcontractors</h3>
            <span className={pill(subLines.length > 0)}>{subLines.length} line{subLines.length === 1 ? '' : 's'}</span>
          </div>
          <div className="px-4 pb-4">
            {subLines.length === 0 && !subDraft && <p className="pb-1 text-[13px] text-(--ink3)">A subcontractor&rsquo;s quote for this variation.</p>}
            {subLines.map((l) => (
              <div key={l.id} className="flex items-center gap-2 border-b border-(--line) py-3 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{l.name}</span>
                  <span className="block truncate text-xs text-(--ink3)">
                    {l.quoteNumber ? `Quote ${l.quoteNumber} · ` : ''}{l.quantity || '1'} × {formatCost(amount(l.cost))}
                  </span>
                </span>
                <span className="whitespace-nowrap rounded-lg bg-(--soft) px-2.5 py-1 font-semibold text-[15px] font-extrabold tabular-nums">{formatCost(draftTotal(l))}</span>
                <button type="button" className={cogBtn} aria-label={`Edit ${l.name}`} onClick={() => setSubDraft({ ...l })}><CogIcon /></button>
                <button type="button" className={delBtn} aria-label={`Remove ${l.name}`} onClick={() => removeSub(l.id)}><XIcon /></button>
              </div>
            ))}
            {subDraft ? (
              <div className="mt-2.5 rounded-2xl border border-(--line) bg-(--soft) p-3">
                <span className={microLabel}>Subcontractor</span>
                <select
                  value={subDraft.subcontractorId || (subDraft.name ? '__typed' : '')}
                  onChange={(e) => {
                    const pick = subcontractors.find((s) => s.id === e.target.value);
                    setSubDraft({ ...subDraft, subcontractorId: pick ? pick.id : '', name: pick ? pick.name : e.target.value === '__typed' ? subDraft.name : '' });
                  }}
                  aria-label="Pick a subcontractor"
                  className="w-full rounded-2xl bg-(--card) p-3 text-base shadow-xs outline-hidden"
                >
                  <option value="">Choose from Subcontractors…</option>
                  {subcontractors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="__typed">Not listed — type the name</option>
                </select>
                {!subDraft.subcontractorId ? (
                  <input value={subDraft.name} onChange={(e) => setSubDraft({ ...subDraft, name: e.target.value })} placeholder="Subcontractor name" aria-label="Subcontractor name" className="mt-2 w-full rounded-2xl bg-(--card) p-3 text-base shadow-xs outline-hidden" />
                ) : null}
                <input value={subDraft.quoteNumber} onChange={(e) => setSubDraft({ ...subDraft, quoteNumber: e.target.value })} placeholder="Quote number" aria-label="Quote number" className="mt-2 w-full rounded-2xl bg-(--card) p-3 text-base shadow-xs outline-hidden" />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className={fieldBox}><span className={microLabel}>Cost ({currencySymbol})</span><input value={subDraft.cost} onChange={(e) => setSubDraft({ ...subDraft, cost: e.target.value })} inputMode="decimal" placeholder="0.00" aria-label="Subcontractor cost" className="w-full bg-transparent text-[17px] font-extrabold tabular-nums outline-hidden" /></label>
                  <label className={fieldBox}><span className={microLabel}>Quantity</span><input value={subDraft.quantity} onChange={(e) => setSubDraft({ ...subDraft, quantity: e.target.value })} inputMode="decimal" aria-label="Subcontractor quantity" className="w-full bg-transparent text-[17px] font-extrabold tabular-nums outline-hidden" /></label>
                </div>
                <p className="mt-2 text-xs text-(--ink2)">Line total {formatCost(draftTotal(subDraft))}</p>
                {lineError ? <p role="alert" className="mt-2 text-xs font-semibold text-(--red)">{lineError}</p> : null}
                <div className="mt-2.5 flex gap-2">
                  <button type="button" onClick={() => { setSubDraft(null); setLineError(null); }} className="flex-1 rounded-2xl bg-(--card) py-3 text-sm font-bold text-(--ink2) shadow-xs">Cancel</button>
                  <button type="button" onClick={commitSub} className="flex-1 rounded-2xl bg-(--blue) py-3 text-sm font-bold text-white">{subLines.some((l) => l.id === subDraft.id) ? 'Update line item' : 'Add subcontractor'}</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => { setCustomDraft(null); setSubDraft({ id: uid(), subcontractorId: '', name: '', quoteNumber: '', quantity: '1', cost: '' }); }} className="mt-2.5 w-full rounded-2xl border-[1.5px] border-dashed border-(--line2) bg-(--card) py-3 text-sm font-bold text-(--blue)">
                + Add subcontractor
              </button>
            )}
          </div>
        </section>

        {/* evidence */}
        <section className={card}>
          <div className={headRow}>
            <h3 className="font-semibold text-base font-extrabold">Evidence</h3>
            <span className={pill(evidenceTotal > 0)}>
              {evidenceTotal} file{evidenceTotal === 1 ? '' : 's'}
            </span>
          </div>
          <div
            className="px-4 pb-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
          >
            {/* multiple: several files in one go, and the picker can be reopened to add more */}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.heic,.heif"
              className="sr-only"
              onChange={(e) => onFiles(e.target.files)}
            />

            {evidence.length === 0 ? (
              <div className="rounded-2xl border-[1.5px] border-dashed border-(--line2) p-4 text-center">
                <p className="mb-3 text-sm text-(--ink2)">Please upload any supporting evidence here</p>
                <button type="button" onClick={() => fileRef.current?.click()} className="w-full rounded-2xl bg-(--soft2) py-3 text-sm font-bold">
                  Take photos or choose files
                </button>
                <p className="pt-2 text-xs text-(--ink3)">
                  Add as many as you need — up to {MAX_EVIDENCE} photos or PDFs per variation.
                </p>
              </div>
            ) : (
              <>
                <ul className="flex flex-col gap-2">
                  {evidence.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 rounded-xl bg-(--soft) px-3 py-2 text-sm">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-(--blue-t) text-[10px] font-extrabold text-(--blue)">
                        {f.name.split('.').pop()?.slice(0, 4).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <button type="button" className={delBtn} aria-label={`Remove ${f.name}`} onClick={() => setEvidence((prev) => prev.filter((x) => x.id !== f.id))}><XIcon /></button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={evidenceTotal >= MAX_EVIDENCE}
                  className="mt-2.5 w-full rounded-2xl border-[1.5px] border-dashed border-(--line2) bg-(--card) py-3 text-sm font-bold text-(--blue) disabled:opacity-45"
                >
                  + Add more evidence
                </button>
                <p className="pt-2 text-center text-xs text-(--ink3)">
                  {evidenceTotal} of {MAX_EVIDENCE} added
                  {evidenceTotal >= MAX_EVIDENCE ? ' — that is the limit' : '. Photos, PDFs, anything that proves the work.'}
                </p>
              </>
            )}
          </div>
        </section>
      </div>

      {/* footer */}
      <footer className="border-t border-(--line) bg-(--bg)/90 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-sm">
        <div className="mb-2 flex flex-wrap justify-center gap-1.5 text-xs font-bold">
          <span className={`rounded-full border border-(--line) px-3 py-1 ${totalHours ? 'bg-(--proj-t) text-(--proj)' : 'bg-(--card) text-(--ink2)'}`}>{fmt(totalHours)} hrs</span>
          <span className={`rounded-full border border-(--line) px-3 py-1 ${materials.length ? 'bg-(--proj-t) text-(--proj)' : 'bg-(--card) text-(--ink2)'}`}>{materials.length} material{materials.length === 1 ? '' : 's'}</span>
          {costTotal > 0 ? <span className="rounded-full border border-(--line) bg-(--proj-t) px-3 py-1 text-(--proj)">{formatCost(costTotal)}</span> : null}
          <span className={`rounded-full border border-(--line) px-3 py-1 ${evidenceTotal ? 'bg-(--proj-t) text-(--proj)' : 'bg-(--card) text-(--ink2)'}`}>{evidenceTotal} evidence file{evidenceTotal === 1 ? '' : 's'}</span>
        </div>
        {error ? <p className="mb-2 text-center text-sm font-semibold text-(--red)">{error}</p> : null}
        <button type="button" onClick={handleSave} disabled={!canSave} className="w-full rounded-[17px] bg-(--blue) py-4 text-base font-bold text-white shadow-lg disabled:opacity-40 disabled:shadow-none">
          {saving ? 'Saving…' : 'Save variation'}
        </button>
        <p className="pt-2 text-center text-xs text-(--ink3)">
          {customDraft || subDraft ? 'Add or cancel the open line first. ' : ''}Saves as Open on {parentName}. Evidence uploads after the variation is saved.
        </p>
      </footer>

      {/* all trades */}
      {tradeSheetOpen && (
        <>
          <div className="absolute inset-0 z-30 bg-black/45" onClick={() => { setTradeSheetOpen(false); setCustomTradeOpen(false); }} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="All trades" className="absolute inset-x-0 bottom-0 z-40 flex max-h-[78%] flex-col rounded-t-3xl bg-(--bg) shadow-2xl">
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-(--line2)" />
            <h4 className="px-5 pb-2 pt-2 font-semibold text-[17px] font-extrabold">All trades</h4>
            <div className="mx-4 mb-2 rounded-2xl border border-(--line) bg-(--card) px-3.5 py-3">
              <input autoFocus value={tradeQuery} onChange={(e) => setTradeQuery(e.target.value)} placeholder="Search trades" aria-label="Search trades" className="w-full bg-transparent text-[15px] outline-hidden" />
            </div>
            <ul className="flex-1 overflow-y-auto px-3 pb-2">
              {filteredTrades.map((t) => (
                <li key={t}>
                  <button type="button" onClick={() => chooseTrade(t)} className="w-full border-b border-(--line) px-2 py-3.5 text-left text-[15px]">{t}</button>
                </li>
              ))}
            </ul>

            <div className="border-t border-(--line) bg-(--card) px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {customTradeOpen ? (
                <>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={customTrade}
                      onChange={(e) => setCustomTrade(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitCustomTrade(); } }}
                      placeholder="Trade name"
                      aria-label="Custom trade name"
                      className="min-w-0 flex-1 rounded-2xl border border-(--line) bg-(--soft) p-3 text-base outline-hidden"
                    />
                    <button type="button" onClick={commitCustomTrade} disabled={!customTrade.trim()} className="rounded-2xl bg-(--blue) px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Add</button>
                  </div>
                  <p className="pt-2 text-center text-xs text-(--ink3)">Saved to your organisation&rsquo;s trade list for next time.</p>
                </>
              ) : (
                <button type="button" onClick={() => setCustomTradeOpen(true)} className="w-full rounded-2xl border-[1.5px] border-dashed border-(--line2) bg-(--card) py-3 text-sm font-bold text-(--blue)">
                  + Custom trade
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* undo */}
      {undo && (
        <div role="status" className="absolute inset-x-3 bottom-24 z-50 flex items-center gap-3 rounded-2xl bg-(--ink) px-4 py-3 text-sm text-white">
          <span>{undo.message}</span>
          <button type="button" onClick={() => { undo.restore(); setUndo(null); }} className="ml-auto font-bold text-[#7FB0FF]">Undo</button>
        </div>
      )}
    </div>
  );
}
