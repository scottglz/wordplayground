import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const SEGMENTS = ['A', 'B', 'C']

const SEG_COLORS = [
  { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-300', border: 'border-rose-200', dimText: 'text-rose-400' },
  { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-300', border: 'border-amber-200', dimText: 'text-amber-400' },
  { bg: 'bg-sky-100',   text: 'text-sky-700',   ring: 'ring-sky-300',   border: 'border-sky-200',   dimText: 'text-sky-400' },
]

const NEUTRAL = { bg: 'bg-slate-50', text: 'text-slate-700', ring: 'ring-slate-300', border: 'border-slate-300', dimText: 'text-slate-400' }

type Color = typeof SEG_COLORS[0]
type SegLen = { min: number; max: number | null }
type Mode = 'named' | 'exact' | 'range'

const PRESETS: { label: string; min: number; max: number | null }[] = [
  { label: '1 letter',   min: 1, max: 1    },
  { label: '1+ letters', min: 1, max: null },
  { label: '0+ letters', min: 0, max: null },
]

const INF_THRESHOLD = 10

function fmtMax(max: number | null) { return max === null ? '∞' : String(max) }

function fmtRange(s: SegLen): string {
  if (s.max === null) return `${s.min}+`
  if (s.min === s.max) return String(s.min)
  return `${s.min}–${s.max}`
}

function clampMin(n: number, delta: number) { return Math.max(0, n + delta) }

function stepMaxWrap(max: number | null, delta: number, min: number): number | null {
  if (delta > 0) {
    if (max === null) return null
    if (max >= INF_THRESHOLD) return null
    return max + 1
  }
  if (max === null) return INF_THRESHOLD
  return Math.max(min, max - 1)
}

// ─── State hook ───────────────────────────────────────────────────────────────

function useSegmentState() {
  const [lengths, setLengths] = useState<SegLen[]>(SEGMENTS.map(() => ({ min: 1, max: null })))
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const toggle = (i: number) => setSelected(prev => {
    const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n
  })

  // Set both min and max for all selected segments
  const applyLen = (min: number, max: number | null) =>
    setLengths(prev => prev.map((s, i) => selected.has(i) ? { min, max } : s))

  // Set only min, keeping max >= new min
  const applyMin = (min: number) =>
    setLengths(prev => prev.map((s, i) => {
      if (!selected.has(i)) return s
      const max = s.max !== null ? Math.max(min, s.max) : null
      return { min, max }
    }))

  // Set only max, keeping min <= new max
  const applyMax = (max: number | null) =>
    setLengths(prev => prev.map((s, i) => {
      if (!selected.has(i)) return s
      const min = max !== null ? Math.min(s.min, max) : s.min
      return { min, max }
    }))

  const updateMin = (delta: number) =>
    setLengths(prev => prev.map((s, i) => {
      if (!selected.has(i)) return s
      const min = clampMin(s.min, delta)
      const max = s.max !== null ? Math.max(min, s.max) : null
      return { min, max }
    }))

  const updateMax = (delta: number) =>
    setLengths(prev => prev.map((s, i) => {
      if (!selected.has(i)) return s
      return { ...s, max: stepMaxWrap(s.max, delta, s.min) }
    }))

  const indices = [...selected].sort()
  const hasSelection = indices.length > 0
  const primary = hasSelection ? lengths[indices[0]] : null
  const allSameMin = indices.every(i => lengths[i].min === primary?.min)
  const allSameMax = indices.every(i => lengths[i].max === primary?.max)
  const displayMin = allSameMin && primary != null ? String(primary.min) : '·'
  const displayMax = allSameMax && primary != null ? fmtMax(primary.max) : '·'
  const panelColor = indices.length === 1 ? SEG_COLORS[indices[0]] : NEUTRAL
  const selectionLabel = indices.length === 1
    ? `Segment ${SEGMENTS[indices[0]]}`
    : `Segments ${indices.map(i => SEGMENTS[i]).join(', ')}`
  const isPresetActive = (p: typeof PRESETS[0]) =>
    hasSelection && indices.every(i => lengths[i].min === p.min && lengths[i].max === p.max)
  const isAnyPresetActive = PRESETS.some(p => isPresetActive(p))

  return {
    lengths, selected, toggle,
    applyLen, applyMin, applyMax, updateMin, updateMax,
    indices, hasSelection, primary,
    allSameMin, allSameMax,
    displayMin, displayMax,
    panelColor, selectionLabel, isPresetActive, isAnyPresetActive,
  }
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ChipRow({ lengths, selected, onToggle }: { lengths: SegLen[]; selected: Set<number>; onToggle: (i: number) => void }) {
  return (
    <div className="flex items-end gap-4 flex-wrap pb-0.5">
      {SEGMENTS.map((letter, i) => {
        const c = SEG_COLORS[i]
        const isSelected = selected.has(i)
        return (
          <button key={letter} onClick={() => onToggle(i)}
            className={cn('flex flex-col items-center gap-1 transition-all duration-150', isSelected ? 'scale-110' : 'opacity-90')}
          >
            <span className={cn('h-10 w-10 rounded-xl flex items-center justify-center text-base font-black ring-2 transition-all', c.bg, c.text, c.ring, isSelected && 'ring-4 shadow-md')}>
              {letter}
            </span>
            <span className={cn('text-[10px] font-semibold tabular-nums leading-none', c.dimText)}>
              {fmtRange(lengths[i])}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function PresetChip({ label, active, color, onClick }: { label: string; active: boolean; color: Color; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn(
        'h-9 px-3 rounded-full text-xs font-bold border-2 transition-all active:scale-95 whitespace-nowrap',
        active ? [color.bg, color.text, color.border] : 'bg-white text-slate-500 border-slate-200',
      )}
    >{label}</button>
  )
}

// A scrollable row of number buttons 0–10, with an optional ∞ at the end
function PickerRow({
  label,
  numSelected,   // which number button is highlighted (null = none)
  infSelected,   // whether the ∞ button is highlighted
  includeInf,
  onPick,
  onPickInf,
  color,
}: {
  label: string
  numSelected: number | null
  infSelected?: boolean
  includeInf?: boolean
  onPick: (n: number) => void
  onPickInf?: () => void
  color: Color
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 w-7 flex-shrink-0">{label}</span>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-1 -mr-1 pr-1">
        {Array.from({ length: 11 }, (_, n) => (
          <button key={n} onClick={() => onPick(n)}
            className={cn(
              'h-10 min-w-[36px] rounded-lg text-sm font-bold flex-shrink-0 border-2 transition-all active:scale-95',
              numSelected === n
                ? [color.bg, color.text, color.border]
                : 'bg-white text-slate-500 border-slate-200',
            )}
          >{n}</button>
        ))}
        {includeInf && (
          <button onClick={onPickInf}
            className={cn(
              'h-10 min-w-[44px] px-2 rounded-lg text-sm font-bold flex-shrink-0 border-2 transition-all active:scale-95',
              infSelected
                ? [color.bg, color.text, color.border]
                : 'bg-white text-slate-500 border-slate-200',
            )}
          >∞</button>
        )}
      </div>
    </div>
  )
}

function RowStepper({ label, value, onDec, onInc, color }: { label: string; value: string; onDec: () => void; onInc: () => void; color: Color }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 w-7 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1.5">
        <button onClick={onDec} className={cn('h-11 w-11 rounded-lg flex items-center justify-center text-lg font-bold select-none border-2 bg-white active:scale-95 transition-transform', color.border, color.text)}>−</button>
        <span className={cn('w-9 text-center text-lg font-black tabular-nums', color.text)}>{value}</span>
        <button onClick={onInc} className={cn('h-11 w-11 rounded-lg flex items-center justify-center text-lg font-bold select-none border-2 bg-white active:scale-95 transition-transform', color.border, color.text)}>+</button>
      </div>
    </div>
  )
}

function MaxStepper({ displayMax, primary, onUpdate, color }: { displayMax: string; primary: SegLen | null; onUpdate: (d: number) => void; color: Color }) {
  const atThreshold = primary?.max !== null && (primary?.max ?? 0) >= INF_THRESHOLD
  const alreadyInf = primary?.max === null
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 w-7 flex-shrink-0">max</span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onUpdate(-1)} className={cn('h-11 w-11 rounded-lg flex items-center justify-center text-lg font-bold select-none border-2 bg-white active:scale-95 transition-transform', color.border, color.text)}>−</button>
        <span className={cn('w-9 text-center text-lg font-black tabular-nums', color.text)}>{displayMax}</span>
        <button onClick={() => onUpdate(+1)} disabled={alreadyInf ?? false}
          className={cn(
            'h-11 w-11 rounded-lg flex items-center justify-center text-base font-bold select-none border-2 active:scale-95 transition-all',
            atThreshold ? [color.bg, color.text, color.border] : ['bg-white', color.text, color.border],
            (alreadyInf ?? false) && 'opacity-25 cursor-not-allowed',
          )}
        >{atThreshold ? '∞' : '+'}</button>
      </div>
    </div>
  )
}

function Divider({ color }: { color: Color }) {
  return <div className={cn('border-t', color.border)} />
}

function PopupShell({ color, children }: { color: Color; children: React.ReactNode }) {
  return (
    <div className={cn('absolute left-0 top-full mt-3 z-20 bg-white rounded-2xl shadow-2xl border-2 p-4 space-y-3 min-w-[260px]', color.border)}>
      <div className={cn('absolute -top-[9px] left-5 w-4 h-4 rotate-45 rounded-sm border-l-2 border-t-2 bg-white', color.border)} />
      {children}
    </div>
  )
}

// ─── Option B: presets + wrap-to-∞ spinners ──────────────────────────────────

function SegmentsB() {
  const s = useSegmentState()
  const { lengths, selected, toggle, hasSelection, primary, displayMin, displayMax, updateMin, updateMax, applyLen, panelColor, selectionLabel, isPresetActive } = s
  const c = panelColor

  return (
    <div className="space-y-3">
      <div className="relative">
        <ChipRow lengths={lengths} selected={selected} onToggle={toggle} />
        {hasSelection && (
          <PopupShell color={c}>
            <p className={cn('text-sm font-black', c.text)}>{selectionLabel}</p>
            <div className="flex gap-1.5 flex-wrap">
              {PRESETS.map(p => (
                <PresetChip key={p.label} label={p.label} active={isPresetActive(p)} color={c} onClick={() => applyLen(p.min, p.max)} />
              ))}
            </div>
            <Divider color={c} />
            <RowStepper label="min" value={displayMin} onDec={() => updateMin(-1)} onInc={() => updateMin(+1)} color={c} />
            <MaxStepper displayMax={displayMax} primary={primary} onUpdate={updateMax} color={c} />
          </PopupShell>
        )}
      </div>
      <p className="text-xs text-muted-foreground font-mono">word = {SEGMENTS.join(' + ')}</p>
    </div>
  )
}

// ─── Option C: named presets + n letters + m–n letters ───────────────────────

function SegmentsC() {
  const s = useSegmentState()
  const [mode, setMode] = useState<Mode>('named')
  const { lengths, selected, toggle, hasSelection, primary, allSameMin, allSameMax, panelColor, selectionLabel, isPresetActive, applyLen, applyMin, applyMax } = s
  const c = panelColor

  function handleNamedPreset(min: number, max: number | null) {
    applyLen(min, max)
    setMode('named')
  }

  // Exact mode: highlight when all selected agree on a single min===max value
  const allExact = allSameMin && allSameMax && primary != null
    && primary.min === primary.max && primary.max !== null
  const exactCurrent = (mode === 'exact' && allExact) ? primary!.min : null

  // Range mode highlights
  const rangeMinSelected = allSameMin && primary != null ? primary.min : null
  const rangeMaxNumSelected = allSameMax && primary != null && primary.max !== null ? primary.max : null
  const rangeMaxInfSelected = allSameMax && primary != null && primary.max === null

  return (
    <div className="space-y-3">
      <div className="relative">
        <ChipRow lengths={lengths} selected={selected} onToggle={toggle} />
        {hasSelection && (
          <PopupShell color={c}>
            <p className={cn('text-sm font-black', c.text)}>{selectionLabel}</p>
            <div className="flex gap-1.5 flex-wrap">
              {PRESETS.map(p => (
                <PresetChip
                  key={p.label}
                  label={p.label}
                  active={mode === 'named' && isPresetActive(p)}
                  color={c}
                  onClick={() => handleNamedPreset(p.min, p.max)}
                />
              ))}
              <PresetChip label="n letters"   active={mode === 'exact'} color={c} onClick={() => setMode('exact')} />
              <PresetChip label="m–n letters" active={mode === 'range'} color={c} onClick={() => setMode('range')} />
            </div>

            {mode === 'exact' && (
              <>
                <Divider color={c} />
                <PickerRow
                  label="n"
                  numSelected={exactCurrent}
                  onPick={n => applyLen(n, n)}
                  color={c}
                />
              </>
            )}

            {mode === 'range' && (
              <>
                <Divider color={c} />
                <PickerRow
                  label="min"
                  numSelected={rangeMinSelected}
                  onPick={n => applyMin(n)}
                  color={c}
                />
                <PickerRow
                  label="max"
                  numSelected={rangeMaxNumSelected}
                  infSelected={rangeMaxInfSelected}
                  includeInf
                  onPick={v => applyMax(v)}
                  onPickInf={() => applyMax(null)}
                  color={c}
                />
              </>
            )}
          </PopupShell>
        )}
      </div>
      <p className="text-xs text-muted-foreground font-mono">word = {SEGMENTS.join(' + ')}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SegCard({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <div className="mb-16">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</CardTitle>
          <p className="text-xs text-slate-400">{note}</p>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      <Card className="mt-3 opacity-40 pointer-events-none">
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Rules</CardTitle>
        </CardHeader>
        <CardContent><div className="h-16 rounded-lg bg-slate-100" /></CardContent>
      </Card>
    </div>
  )
}

export default function SegmentLengthMockup() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-violet-600 via-pink-500 to-amber-400 bg-clip-text text-transparent pb-1">
            WordPlayground
          </h1>
          <p className="text-sm text-slate-400 mt-1">Segment length popup — mockup options</p>
        </div>

        <SegCard
          label="Option B — presets + spinners"
          note="Spinners always shown. Tap + past 10 on max to wrap to ∞."
        >
          <SegmentsB />
        </SegCard>

        <SegCard
          label="Option C — presets + n letters + m–n letters"
          note="'n letters' shows a single row 0–10. 'm–n letters' shows two picker rows (min and max)."
        >
          <SegmentsC />
        </SegCard>
      </div>
    </div>
  )
}
