import type { Rule } from './rules'

// Maps word → score for O(1) lookup
export type WordMap = Map<string, number>

export interface MatchResult {
  word: string
  score: number
  compositeScore: number
  segments: string[]
  isWordMatches: string[]
}

export interface SegBounds {
  min: number[]
  max: number[]
  suffixMin: number[]
  suffixMax: number[]
}

/** Derive per-segment length bounds from rules whose ref is a single bare segment. */
export function computeSegBounds(rules: Rule[], n: number): SegBounds {
  const min = new Array<number>(n).fill(0)
  const max = new Array<number>(n).fill(Infinity)

  const singleSegIdx = (rule: Rule): number | null => {
    if (rule.ref.length !== 1) return null
    const p = rule.ref[0]
    if (p.kind !== 'segment') return null
    const idx = p.letter.charCodeAt(0) - 65
    return idx >= 0 && idx < n ? idx : null
  }

  for (const rule of rules) {
    const i = singleSegIdx(rule)
    if (i === null) continue
    switch (rule.type) {
      case 'length_eq':  if (rule.value > min[i]) min[i] = rule.value; if (rule.value < max[i]) max[i] = rule.value; break
      case 'length_gte': if (rule.value > min[i]) min[i] = rule.value; break
      case 'length_lte': if (rule.value < max[i]) max[i] = rule.value; break
      case 'length_neq': if (rule.value === 0 && min[i] < 1) min[i] = 1; break
      case 'literal': {
        const l = rule.value.length
        if (l > min[i]) min[i] = l
        if (l < max[i]) max[i] = l
        break
      }
      case 'anagram': {
        const l = rule.value.length
        if (l > min[i]) min[i] = l
        if (l < max[i]) max[i] = l
        break
      }
    }
  }

  const suffixMin = new Array<number>(n + 1).fill(0)
  const suffixMax = new Array<number>(n + 1).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    suffixMin[i] = suffixMin[i + 1] + min[i]
    suffixMax[i] = suffixMax[i + 1] + max[i]
  }
  return { min, max, suffixMin, suffixMax }
}
