import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface SegLen {
  min: number
  max: number | null  // null = no limit (∞)
}

type Color = { bg: string; text: string; ring: string; border: string; dimText: string }
type Mode = 'named' | 'exact' | 'range'

const PRESETS: { label: string; min: number; max: number | null }[] = [
  { label: '1 letter',   min: 1, max: 1    },
  { label: '1+ letters', min: 1, max: null },
  { label: '0+ letters', min: 0, max: null },
]

export const SEG_COLORS: Color[] = [
  { bg: 'bg-rose-100',    text: 'text-rose-700',    ring: 'ring-rose-200',    border: 'border-rose-200',    dimText: 'text-rose-400'    },
  { bg: 'bg-amber-100',   text: 'text-amber-700',   ring: 'ring-amber-200',   border: 'border-amber-200',   dimText: 'text-amber-400'   },
  { bg: 'bg-sky-100',     text: 'text-sky-700',     ring: 'ring-sky-200',     border: 'border-sky-200',     dimText: 'text-sky-400'     },
  { bg: 'bg-violet-100',  text: 'text-violet-700',  ring: 'ring-violet-200',  border: 'border-violet-200',  dimText: 'text-violet-400'  },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200', border: 'border-emerald-200', dimText: 'text-emerald-400' },
  { bg: 'bg-pink-100',    text: 'text-pink-700',    ring: 'ring-pink-200',    border: 'border-pink-200',    dimText: 'text-pink-400'    },
  { bg: 'bg-orange-100',  text: 'text-orange-700',  ring: 'ring-orange-200',  border: 'border-orange-200',  dimText: 'text-orange-400'  },
  { bg: 'bg-teal-100',    text: 'text-teal-700',    ring: 'ring-teal-200',    border: 'border-teal-200',    dimText: 'text-teal-400'    },
]

const NEUTRAL: Color = {
  bg: 'bg-slate-50', text: 'text-slate-700', ring: 'ring-slate-300',
  border: 'border-slate-300', dimText: 'text-slate-400',
}

export function segColor(i: number): Color {
  return SEG_COLORS[i % SEG_COLORS.length]
}

const SEGMENT_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function fmtRange(s: SegLen): string {
  if (s.max === null) return `${s.min}+`
  if (s.min === s.max) return String(s.min)
  return `${s.min}–${s.max}`
}

function PresetChip({ label, active, color, onClick }: {
  label: string; active: boolean; color: Color; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-9 px-3 rounded-full text-xs font-bold border-2 transition-all active:scale-95 whitespace-nowrap',
        active ? [color.bg, color.text, color.border] : 'bg-white text-slate-500 border-slate-200',
      )}
    >{label}</button>
  )
}

function PickerRow({ label, numSelected, infSelected, includeInf, onPick, onPickInf, color }: {
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
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 w-7 flex-shrink-0">
        {label}
      </span>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-1 -mr-1 pr-1">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            onClick={() => onPick(n)}
            className={cn(
              'h-10 min-w-[36px] rounded-lg text-sm font-bold flex-shrink-0 border-2 transition-all active:scale-95',
              numSelected === n
                ? [color.bg, color.text, color.border]
                : 'bg-white text-slate-500 border-slate-200',
            )}
          >{n}</button>
        ))}
        {includeInf && (
          <button
            onClick={onPickInf}
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

interface Props {
  segmentCount: number
  lengths: SegLen[]
  onChange: (lengths: SegLen[]) => void
}

export function SegmentLengthControl({ segmentCount, lengths, onChange }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [mode, setMode] = useState<Mode>('named')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelected(prev => {
      const next = new Set([...prev].filter(i => i < segmentCount))
      return next.size === prev.size ? prev : next
    })
  }, [segmentCount])

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setSelected(new Set())
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function toggle(i: number) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })
  }

  function applyLen(min: number, max: number | null) {
    onChange(lengths.map((s, i) => selected.has(i) ? { min, max } : s))
  }

  function applyMin(min: number) {
    onChange(lengths.map((s, i) => {
      if (!selected.has(i)) return s
      const max = s.max !== null ? Math.max(min, s.max) : null
      return { min, max }
    }))
  }

  function applyMax(max: number | null) {
    onChange(lengths.map((s, i) => {
      if (!selected.has(i)) return s
      const min = max !== null ? Math.min(s.min, max) : s.min
      return { min, max }
    }))
  }

  const indices = [...selected].sort()
  const hasSelection = indices.length > 0
  const primary = hasSelection ? lengths[indices[0]] : null
  const allSameMin = indices.every(i => lengths[i]?.min === primary?.min)
  const allSameMax = indices.every(i => lengths[i]?.max === primary?.max)

  const isPresetActive = (p: typeof PRESETS[0]) =>
    hasSelection && indices.every(i => lengths[i]?.min === p.min && lengths[i]?.max === p.max)

  const c = indices.length === 1 ? segColor(indices[0]) : NEUTRAL
  const selectionLabel = indices.length === 1
    ? `Segment ${SEGMENT_LABELS[indices[0]]}`
    : `Segments ${indices.map(i => SEGMENT_LABELS[i]).join(', ')}`

  const allExact = allSameMin && allSameMax && primary != null
    && primary.min === primary.max && primary.max !== null
  const exactCurrent = (mode === 'exact' && allExact) ? primary!.min : null

  const rangeMinSelected = allSameMin && primary != null ? primary.min : null
  const rangeMaxNumSelected = allSameMax && primary != null && primary.max !== null ? primary.max : null
  const rangeMaxInfSelected = allSameMax && primary != null && primary.max === null

  return (
    <div className="relative" ref={rootRef}>
      {/* Chip row */}
      <div className="flex items-center gap-4 flex-wrap pb-0.5">
        {Array.from({ length: segmentCount }, (_, i) => {
          const col = segColor(i)
          const isSelected = selected.has(i)
          const s = lengths[i] ?? { min: 1, max: null }
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={cn(
                'transition-all duration-150',
                isSelected ? 'scale-110' : 'opacity-90',
              )}
            >
              <span className={cn(
                'h-10 w-10 rounded-xl flex flex-col items-center justify-between pt-2 pb-1 ring-2 transition-all',
                col.bg, col.text, col.ring,
                isSelected && 'ring-4 shadow-md',
              )}>
                <span className="text-sm font-black leading-none">{SEGMENT_LABELS[i]}</span>
                <span className={cn('text-[8px] font-bold leading-none tabular-nums', col.dimText)}>{fmtRange(s)}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Floating popup */}
      {hasSelection && (
        <div className={cn(
          'absolute left-0 top-full mt-3 z-20 bg-white rounded-2xl shadow-2xl border-2 p-4 space-y-3 w-max',
          c.border,
        )}>
          <div className={cn('absolute -top-[9px] left-5 w-4 h-4 rotate-45 rounded-sm border-l-2 border-t-2 bg-white', c.border)} />

          <div className="flex items-center justify-between gap-3">
            <p className={cn('text-sm font-black', c.text)}>{selectionLabel}</p>
            <button
              onClick={() => setSelected(new Set(Array.from({ length: segmentCount }, (_, i) => i)))}
              className={cn('text-[11px] font-semibold px-2 py-1 rounded-md border transition-colors hover:bg-slate-100', c.border, c.text)}
            >
              Select all
            </button>
          </div>

          <div className="flex gap-1.5">
            {PRESETS.map(p => (
              <PresetChip
                key={p.label}
                label={p.label}
                active={mode === 'named' && isPresetActive(p)}
                color={c}
                onClick={() => { applyLen(p.min, p.max); setMode('named') }}
              />
            ))}
            <PresetChip label="n letters"   active={mode === 'exact'} color={c} onClick={() => setMode('exact')} />
            <PresetChip label="m–n letters" active={mode === 'range'} color={c} onClick={() => setMode('range')} />
          </div>

          {mode === 'exact' && (
            <>
              <div className={cn('border-t', c.border)} />
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
              <div className={cn('border-t', c.border)} />
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
        </div>
      )}
    </div>
  )
}
