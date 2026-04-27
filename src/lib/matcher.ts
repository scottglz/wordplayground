import type { Rule } from './rules'
import type { WordEntry } from '../hooks/useWordList'

// Maps word → score for O(1) lookup
export type WordMap = Map<string, number>

export interface MatchResult {
  word: string
  score: number
  compositeScore: number
  segments: string[]    // the winning split
  isWordMatches: string[] // values that satisfied an is-word rule
}

export interface SegBounds {
  min: number[]        // segMin[i] — minimum length segment i can have
  max: number[]        // segMax[i] — maximum length segment i can have (Infinity if unbounded)
  suffixMin: number[]  // sum of segMin[j] for j >= i; length n+1, suffixMin[n]=0
  suffixMax: number[]  // sum of segMax[j] for j >= i (Infinity-aware); length n+1
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
      case 'length_eq': if (rule.value > min[i]) min[i] = rule.value; if (rule.value < max[i]) max[i] = rule.value; break
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

function resolveRef(ref: import('./rules').SegmentRef, segments: string[]): string {
  return ref.map(part => {
    if (part.kind === 'segment') return segments[part.letter.charCodeAt(0) - 65] ?? ''
    if (part.kind === 'reverse') return resolveRef(part.inner, segments).split('').reverse().join('')
    return part.value
  }).join('')
}

function evaluateRule(rule: Rule, segments: string[], wordMap: WordMap): boolean {
  const val = resolveRef(rule.ref, segments)
  switch (rule.type) {
    case 'length_gte': return val.length >= rule.value
    case 'length_lte': return val.length <= rule.value
    case 'length_eq':  return val.length === rule.value
    case 'is_word':     return wordMap.has(val)
    case 'literal':     return val === rule.value
    case 'not_literal': return val !== rule.value
    case 'length_neq':  return val.length !== rule.value
    case 'len_ref_eq':  return val.length === resolveRef(rule.other, segments).length
    case 'len_ref_neq': return val.length !== resolveRef(rule.other, segments).length
    case 'len_ref_gte': return val.length >= resolveRef(rule.other, segments).length
    case 'len_ref_lte': return val.length <= resolveRef(rule.other, segments).length
    case 'seg_eq':      return val === resolveRef(rule.other, segments)
    case 'seg_neq':     return val !== resolveRef(rule.other, segments)
    case 'anagram':     return val.split('').sort().join('') === rule.value
    case 'anagram_ref': return val.split('').sort().join('') === resolveRef(rule.other, segments).split('').sort().join('')
  }
}

function collectIsWordMatches(
  rules: Rule[],
  segments: string[],
  wordMap: WordMap,
): { matches: string[]; bonus: number } {
  const matches: string[] = []
  let bonus = 0
  for (const rule of rules) {
    if (rule.type === 'is_word') {
      const val = resolveRef(rule.ref, segments)
      const wordScore = wordMap.get(val) ?? 0
      matches.push(val)
      bonus += wordScore
    }
  }
  return { matches, bonus }
}

// Backtracking search: try all ways to split `word` into `n` segments (empty allowed).
// Returns the first winning split, or null.
function findSplit(
  word: string,
  pos: number,
  segIdx: number,
  n: number,
  segments: string[],
  rules: Rule[],
  wordMap: WordMap,
  bounds: SegBounds,
): string[] | null {
  const remaining = word.length - pos

  if (segIdx === n - 1) {
    if (remaining < bounds.min[segIdx] || remaining > bounds.max[segIdx]) return null
    segments[segIdx] = word.slice(pos)
    return rules.every(r => evaluateRule(r, segments, wordMap)) ? [...segments] : null
  }

  // len must satisfy: segMin[i] ≤ len ≤ segMax[i]
  //                   remaining - len ≤ suffixMax[i+1]  (enough room for rest at their max)
  //                   remaining - len ≥ suffixMin[i+1]  (enough chars left for rest's minimums)
  const lenMin = Math.max(bounds.min[segIdx], remaining - bounds.suffixMax[segIdx + 1])
  const lenMax = Math.min(bounds.max[segIdx], remaining - bounds.suffixMin[segIdx + 1])

  for (let len = lenMin; len <= lenMax; len++) {
    segments[segIdx] = word.slice(pos, pos + len)
    const result = findSplit(word, pos + len, segIdx + 1, n, segments, rules, wordMap, bounds)
    if (result) return result
  }
  return null
}

export function filterWords(
  words: WordEntry[],
  n: number,
  rules: Rule[],
  wordMap: WordMap,
  limit = 500,
): MatchResult[] {
  const results: MatchResult[] = []
  const segments = new Array<string>(n)
  const bounds = computeSegBounds(rules, n)

  for (const { word, score } of words) {
    if (word.length < bounds.suffixMin[0] || word.length > bounds.suffixMax[0]) continue
    const winning = findSplit(word, 0, 0, n, segments, rules, wordMap, bounds)
    if (winning) {
      const { matches, bonus } = collectIsWordMatches(rules, winning, wordMap)
      results.push({ word, score, compositeScore: score + bonus, segments: winning, isWordMatches: matches })
    }
  }

  results.sort((a, b) => b.compositeScore - a.compositeScore)

  return results.slice(0, limit)
}
