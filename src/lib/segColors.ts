export type SegColor = { bg: string; text: string; ring: string; ringSelected: string; border: string; dimText: string }

export const SEG_COLORS: SegColor[] = [
  { bg: 'bg-rose-100',    text: 'text-rose-700',    ring: 'ring-rose-200',    ringSelected: 'ring-rose-500',    border: 'border-rose-200',    dimText: 'text-rose-400'    },
  { bg: 'bg-amber-100',   text: 'text-amber-700',   ring: 'ring-amber-200',   ringSelected: 'ring-amber-500',   border: 'border-amber-200',   dimText: 'text-amber-400'   },
  { bg: 'bg-sky-100',     text: 'text-sky-700',     ring: 'ring-sky-200',     ringSelected: 'ring-sky-500',     border: 'border-sky-200',     dimText: 'text-sky-400'     },
  { bg: 'bg-violet-100',  text: 'text-violet-700',  ring: 'ring-violet-200',  ringSelected: 'ring-violet-500',  border: 'border-violet-200',  dimText: 'text-violet-400'  },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200', ringSelected: 'ring-emerald-500', border: 'border-emerald-200', dimText: 'text-emerald-400' },
  { bg: 'bg-pink-100',    text: 'text-pink-700',    ring: 'ring-pink-200',    ringSelected: 'ring-pink-500',    border: 'border-pink-200',    dimText: 'text-pink-400'    },
  { bg: 'bg-orange-100',  text: 'text-orange-700',  ring: 'ring-orange-200',  ringSelected: 'ring-orange-500',  border: 'border-orange-200',  dimText: 'text-orange-400'  },
  { bg: 'bg-teal-100',    text: 'text-teal-700',    ring: 'ring-teal-200',    ringSelected: 'ring-teal-500',    border: 'border-teal-200',    dimText: 'text-teal-400'    },
]

export const NEUTRAL: SegColor = {
  bg: 'bg-slate-50', text: 'text-slate-700', ring: 'ring-slate-300', ringSelected: 'ring-slate-500',
  border: 'border-slate-300', dimText: 'text-slate-400',
}

export function segColor(i: number): SegColor {
  return SEG_COLORS[i % SEG_COLORS.length]
}
