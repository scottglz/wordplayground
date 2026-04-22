import type { Rule } from '../lib/rules'
import type { WordEntry } from '../hooks/useWordList'
import { computeSegBounds, type MatchResult, type SegBounds } from '../lib/matcher'

const BATCH_SIZE = 10_000
const RESULT_LIMIT = 500

// ── SharedArrayBuffer lookup ──────────────────────────────────────────────────

let _u32: Uint32Array
let _u8:  Uint8Array
let _N:           number
let _scoresStart: number
let _stringsStart: number

function initBuffer(buf: SharedArrayBuffer) {
  _u32 = new Uint32Array(buf)
  _u8  = new Uint8Array(buf)
  _N           = _u32[0]
  _scoresStart  = 4 + _N * 4
  _stringsStart = _scoresStart + _N
}

/** Returns score (0-50) if found, -1 if not. */
function lookupWord(target: string): number {
  let lo = 0, hi = _N - 1
  while (lo <= hi) {
    const mid  = (lo + hi) >>> 1
    const base = _stringsStart + _u32[1 + mid]
    let cmp = 0
    for (let i = 0; ; i++) {
      const a = i < target.length ? target.charCodeAt(i) : 0
      const b = _u8[base + i]
      if (a === b) { if (a === 0) break; continue }
      cmp = a - b; break
    }
    if (cmp === 0) return _u8[_scoresStart + mid]
    if (cmp < 0) hi = mid - 1; else lo = mid + 1
  }
  return -1
}

// ── Rule evaluation ───────────────────────────────────────────────────────────

function resolveRef(ref: import('../lib/rules').SegmentRef, segments: string[]): string {
  return ref.map(part => {
    if (part.kind === 'segment') return segments[part.letter.charCodeAt(0) - 65] ?? ''
    if (part.kind === 'reverse') return resolveRef(part.inner, segments).split('').reverse().join('')
    return part.value
  }).join('')
}

function evaluateRule(rule: Rule, segments: string[]): boolean {
  const val = resolveRef(rule.ref, segments)
  switch (rule.type) {
    case 'length_gte': return val.length >= rule.value
    case 'length_lte': return val.length <= rule.value
    case 'length_eq':  return val.length === rule.value
    case 'is_word':     return lookupWord(val) >= 0
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
  }
}

function collectIsWordMatches(rules: Rule[], segments: string[]): { matches: string[]; bonus: number } {
  const matches: string[] = []
  let bonus = 0
  for (const rule of rules) {
    if (rule.type === 'is_word') {
      const val = resolveRef(rule.ref, segments)
      const score = lookupWord(val)
      if (score >= 0) { matches.push(val); bonus += score }
    }
  }
  return { matches, bonus }
}

function findSplit(
  word: string, pos: number, segIdx: number, n: number,
  segments: string[], rules: Rule[], bounds: SegBounds,
): string[] | null {
  const remaining = word.length - pos
  if (segIdx === n - 1) {
    if (remaining < bounds.min[segIdx] || remaining > bounds.max[segIdx]) return null
    segments[segIdx] = word.slice(pos)
    return rules.every(r => evaluateRule(r, segments)) ? [...segments] : null
  }
  const lenMin = Math.max(bounds.min[segIdx], remaining - bounds.suffixMax[segIdx + 1])
  const lenMax = Math.min(bounds.max[segIdx], remaining - bounds.suffixMin[segIdx + 1])
  for (let len = lenMin; len <= lenMax; len++) {
    segments[segIdx] = word.slice(pos, pos + len)
    const result = findSplit(word, pos + len, segIdx + 1, n, segments, rules, bounds)
    if (result) return result
  }
  return null
}

// ── Main message handler ──────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
  const { words, n, rules, wordBuffer }: {
    words: WordEntry[]
    n: number
    rules: Rule[]
    wordBuffer: SharedArrayBuffer
  } = e.data

  initBuffer(wordBuffer)

  const allResults: MatchResult[] = []
  const segments = new Array<string>(n)
  const total = words.length
  const bounds = computeSegBounds(rules, n)

  for (let i = 0; i < total; i++) {
    const { word, score } = words[i]

    if (word.length >= bounds.suffixMin[0] && word.length <= bounds.suffixMax[0]) {
      const winning = findSplit(word, 0, 0, n, segments, rules, bounds)
      if (winning) {
        const { matches, bonus } = collectIsWordMatches(rules, winning)
        allResults.push({ word, score, compositeScore: score + bonus, segments: winning, isWordMatches: matches })
      }
    }

    if ((i + 1) % BATCH_SIZE === 0) {
      const sorted = allResults.slice().sort((a, b) => b.compositeScore - a.compositeScore).slice(0, RESULT_LIMIT)
      self.postMessage({ type: 'progress', results: sorted, matchCount: allResults.length, processed: i + 1, total })
    }
  }

  allResults.sort((a, b) => b.compositeScore - a.compositeScore)
  self.postMessage({ type: 'done', results: allResults.slice(0, RESULT_LIMIT), matchCount: allResults.length, processed: total, total })
}
