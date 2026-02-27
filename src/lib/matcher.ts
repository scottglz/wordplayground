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

function resolveRef(ref: string[], segments: string[]): string {
  return ref.map(letter => segments[letter.charCodeAt(0) - 65] ?? '').join('')
}

function evaluateRule(rule: Rule, segments: string[], wordMap: WordMap): boolean {
  const val = resolveRef(rule.ref, segments)
  switch (rule.type) {
    case 'length_gte': return val.length >= rule.value
    case 'length_lte': return val.length <= rule.value
    case 'length_eq':  return val.length === rule.value
    case 'is_word':    return wordMap.has(val)
    case 'literal':    return val === rule.value
    case 'anagram':    return val.split('').sort().join('') === rule.value
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

// Backtracking search: try all ways to split `word` into `n` non-empty segments.
// Returns the first winning split, or null.
function findSplit(
  word: string,
  pos: number,
  segIdx: number,
  n: number,
  segments: string[],
  rules: Rule[],
  wordMap: WordMap,
): string[] | null {
  if (segIdx === n - 1) {
    const seg = word.slice(pos)
    if (seg.length === 0) return null
    segments[segIdx] = seg
    return rules.every(r => evaluateRule(r, segments, wordMap)) ? [...segments] : null
  }

  const remaining = n - segIdx - 1
  for (let len = 1; len <= word.length - pos - remaining; len++) {
    segments[segIdx] = word.slice(pos, pos + len)
    const result = findSplit(word, pos + len, segIdx + 1, n, segments, rules, wordMap)
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

  for (const { word, score } of words) {
    if (word.length < n) continue
    const winning = findSplit(word, 0, 0, n, segments, rules, wordMap)
    if (winning) {
      const { matches, bonus } = collectIsWordMatches(rules, winning, wordMap)
      results.push({ word, score, compositeScore: score + bonus, segments: winning, isWordMatches: matches })
    }
  }

  results.sort((a, b) => b.compositeScore - a.compositeScore)

  return results.slice(0, limit)
}
