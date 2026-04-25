import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface SegLen {
  min: number
  max: number | null  // null = no limit (∞)
}

type Color = { bg: string; text: string; ring: string; ringSelected: string; border: string; dimText: string }
type Mode = 'named' | 'exact' | 'gte' | 'range'

const PRESETS: { label: string; min: number; max: number | null }[] = [
  { label: '1 letter', min: 1, max: 1    },
  { label: '0+',       min: 0, max: null },
  { label: '1+',       min: 1, max: null },
]

export const SEG_COLORS: Color[] = [
  { bg: 'bg-rose-100',    text: 'text-rose-700',    ring: 'ring-rose-200',    ringSelected: 'ring-rose-500',    border: 'border-rose-200',    dimText: 'text-rose-400'    },
  { bg: 'bg-amber-100',   text: 'text-amber-700',   ring: 'ring-amber-200',   ringSelected: 'ring-amber-500',   border: 'border-amber-200',   dimText: 'text-amber-400'   },
  { bg: 'bg-sky-100',     text: 'text-sky-700',     ring: 'ring-sky-200',     ringSelected: 'ring-sky-500',     border: 'border-sky-200',     dimText: 'text-sky-400'     },
  { bg: 'bg-violet-100',  text: 'text-violet-700',  ring: 'ring-violet-200',  ringSelected: 'ring-violet-500',  border: 'border-violet-200',  dimText: 'text-violet-400'  },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200', ringSelected: 'ring-emerald-500', border: 'border-emerald-200', dimText: 'text-emerald-400' },
  { bg: 'bg-pink-100',    text: 'text-pink-700',    ring: 'ring-pink-200',    ringSelected: 'ring-pink-500',    border: 'border-pink-200',    dimText: 'text-pink-400'    },
  { bg: 'bg-orange-100',  text: 'text-orange-700',  ring: 'ring-orange-200',  ringSelected: 'ring-orange-500',  border: 'border-orange-200',  dimText: 'text-orange-400'  },
  { bg: 'bg-teal-100',    text: 'text-teal-700',    ring: 'ring-teal-200',    ringSelected: 'ring-teal-500',    border: 'border-teal-200',    dimText: 'text-teal-400'    },
]

const NEUTRAL: Color = {
  bg: 'bg-slate-50', text: 'text-slate-700', ring: 'ring-slate-300', ringSelected: 'ring-slate-500',
  border: 'border-slate-300', dimText: 'text-slate-400',
}

export function segColor(i: number): Color {
  return SEG_COLORS[i % SEG_COLORS.length]
}

const SEGMENT_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function fmtRange(s: SegLen): string {
  if (s.max === null) return `${s.min}+`
  if (s.min === s.max) return String(s.min)
  return `${s.min}-${s.max}`
}

function PresetChip({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onPointerDown={e => { e.preventDefault(); onClick() }}
      className={cn(
        'h-9 px-3 rounded-full text-xs font-bold border-2 transition-all active:brightness-90 whitespace-nowrap',
        active ? 'bg-slate-200 text-slate-700 border-slate-400' : 'bg-white text-slate-500 border-slate-200',
      )}
    >{label}</button>
  )
}

function PickerRow({ numSelected, infSelected, includeInf, toLabel, compact, onPick, onPickInf }: {
  numSelected: number | null
  infSelected?: boolean
  includeInf?: boolean
  toLabel?: boolean
  compact?: boolean
  onPick: (n: number) => void
  onPickInf?: () => void
}) {
  const btnW = compact ? 'min-w-[26px]' : 'min-w-[30px]'
  return (
    <div className="flex gap-1 overflow-x-auto pb-0.5 -mr-1 pr-1">
      {toLabel && (
        <span className={cn('h-8 flex-shrink-0 flex items-center justify-center text-xs font-semibold text-slate-400', btnW)}>
          to
        </span>
      )}
      {Array.from({ length: toLabel ? 10 : 11 }, (_, i) => {
        const n = toLabel ? i + 1 : i
        return (
          <button
            key={n}
            onPointerDown={e => { e.preventDefault(); onPick(n) }}
            className={cn(
              'h-8 rounded-md text-xs font-bold flex-shrink-0 border-2 transition-all active:brightness-90',
              btnW,
              numSelected === n
                ? 'bg-slate-200 text-slate-700 border-slate-400'
                : 'bg-white text-slate-500 border-slate-200',
            )}
          >{n}</button>
        )
      })}
      {includeInf && (
        <button
          onPointerDown={e => { e.preventDefault(); onPickInf?.() }}
          className={cn(
            'h-8 min-w-[28px] px-1 rounded-md text-xs font-bold flex-shrink-0 border-2 transition-all active:brightness-90',
            infSelected
              ? 'bg-slate-200 text-slate-700 border-slate-400'
              : 'bg-white text-slate-500 border-slate-200',
          )}
        >∞</button>
      )}
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

  const allGte = allSameMin && allSameMax && primary != null && primary.max === null
  const gteCurrent = (mode === 'gte' && allGte) ? primary!.min : null

  const rangeMinSelected = allSameMin && primary != null ? primary.min : null
  const rangeMaxNumSelected = allSameMax && primary != null && primary.max !== null ? primary.max : null
  const rangeMaxInfSelected = allSameMax && primary != null && primary.max === null

  return (
    <div className="relative" ref={rootRef}>
      {/* Chip row */}
      <div className="flex items-center gap-1 flex-wrap pb-0.5">
        {Array.from({ length: segmentCount }, (_, i) => {
          const col = segColor(i)
          const isSelected = selected.has(i)
          const s = lengths[i] ?? { min: 1, max: null }
          return (
            <button
              key={i}
              onPointerDown={e => { e.preventDefault(); toggle(i) }}
              className={cn(
                'transition-all duration-150',
                !isSelected && 'opacity-90',
              )}
            >
              <span className={cn(
                'h-10 w-10 rounded-xl flex flex-col items-center justify-between pt-2 pb-1 ring-2 ring-inset transition-all',
                col.bg, col.text,
                isSelected ? [col.ringSelected, 'ring-4'] : col.ring,
              )}>
                <span className="text-sm font-black leading-none">{SEGMENT_LABELS[i]}</span>
                <span className="text-[11px] font-bold leading-tight text-slate-500">{fmtRange(s)}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Floating popup */}
      {hasSelection && (
        <div className={cn(
          'absolute -left-3 sm:left-0 top-full mt-3 z-20 bg-white rounded-2xl shadow-2xl border-2 p-4 space-y-3 w-max',
          c.border,
        )}>
          <div className={cn('absolute -top-[9px] left-8 sm:left-5 w-4 h-4 rotate-45 rounded-sm border-l-2 border-t-2 bg-white', c.border)} />

          <div className="flex items-center justify-between gap-3">
            <p className={cn('text-sm font-black', c.text)}>{selectionLabel}</p>
            <button
              onPointerDown={e => { e.preventDefault(); setSelected(new Set(Array.from({ length: segmentCount }, (_, i) => i))) }}
              className={cn('text-[11px] font-semibold px-2 py-1 rounded-md border border-slate-200 transition-colors hover:bg-slate-100', c.text)}
            >
              all
            </button>
          </div>

          <div className="flex gap-1.5">
            {PRESETS.map(p => (
              <PresetChip
                key={p.label}
                label={p.label}
                active={mode === 'named' && isPresetActive(p)}
                               onClick={() => { applyLen(p.min, p.max); setMode('named') }}
              />
            ))}
            <PresetChip label="n"   active={mode === 'exact'} onClick={() => setMode('exact')} />
            <PresetChip label="n+"  active={mode === 'gte'}   onClick={() => setMode('gte')} />
            <PresetChip label="n-m" active={mode === 'range'} onClick={() => setMode('range')} />
          </div>

          {mode === 'exact' && (
            <>
              <div className={cn('border-t', c.border)} />
              <PickerRow numSelected={exactCurrent} onPick={n => applyLen(n, n)} />
            </>
          )}

          {mode === 'gte' && (
            <>
              <div className={cn('border-t', c.border)} />
              <PickerRow numSelected={gteCurrent} onPick={n => applyLen(n, null)} />
            </>
          )}

          {mode === 'range' && (
            <>
              <div className={cn('border-t', c.border)} />
              <PickerRow compact numSelected={rangeMinSelected} onPick={n => applyMin(n)} />
              <PickerRow compact toLabel numSelected={rangeMaxNumSelected} infSelected={rangeMaxInfSelected} includeInf onPick={v => applyMax(v)} onPickInf={() => applyMax(null)} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
