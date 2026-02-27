import type { Rule } from '../lib/rules'
import type { WordEntry } from '../hooks/useWordList'
import type { MatchResult } from '../lib/matcher'

const BATCH_SIZE = 10_000
const RESULT_LIMIT = 500

function resolveRef(ref: string[], segments: string[]): string {
  return ref.map(letter => segments[letter.charCodeAt(0) - 65] ?? '').join('')
}

function evaluateRule(rule: Rule, segments: string[], wordMap: Map<string, number>): boolean {
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

function findSplit(
  word: string,
  pos: number,
  segIdx: number,
  n: number,
  segments: string[],
  rules: Rule[],
  wordMap: Map<string, number>,
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

function collectIsWordMatches(
  rules: Rule[],
  segments: string[],
  wordMap: Map<string, number>,
): { matches: string[]; bonus: number } {
  const matches: string[] = []
  let bonus = 0
  for (const rule of rules) {
    if (rule.type === 'is_word') {
      const val = resolveRef(rule.ref, segments)
      matches.push(val)
      bonus += wordMap.get(val) ?? 0
    }
  }
  return { matches, bonus }
}

self.onmessage = (e: MessageEvent) => {
  const { words, n, rules, wordMap }: {
    words: WordEntry[]
    n: number
    rules: Rule[]
    wordMap: Map<string, number>
  } = e.data

  const allResults: MatchResult[] = []
  const segments = new Array<string>(n)
  const total = words.length

  for (let i = 0; i < total; i++) {
    const { word, score } = words[i]

    if (word.length >= n) {
      const winning = findSplit(word, 0, 0, n, segments, rules, wordMap)
      if (winning) {
        const { matches, bonus } = collectIsWordMatches(rules, winning, wordMap)
        allResults.push({
          word,
          score,
          compositeScore: score + bonus,
          segments: winning,
          isWordMatches: matches,
        })
      }
    }

    if ((i + 1) % BATCH_SIZE === 0) {
      const sorted = allResults
        .slice()
        .sort((a, b) => b.compositeScore - a.compositeScore)
        .slice(0, RESULT_LIMIT)
      self.postMessage({ type: 'progress', results: sorted, processed: i + 1, total })
    }
  }

  allResults.sort((a, b) => b.compositeScore - a.compositeScore)
  self.postMessage({
    type: 'done',
    results: allResults.slice(0, RESULT_LIMIT),
    processed: total,
    total,
  })
}
