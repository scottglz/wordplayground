// A segment ref is an ordered list of segment letters, e.g. ["A"] or ["A","C"]
export type SegmentRef = string[]

export type Rule =
  | { type: 'length_gte'; ref: SegmentRef; value: number }
  | { type: 'length_lte'; ref: SegmentRef; value: number }
  | { type: 'length_eq';  ref: SegmentRef; value: number }
  | { type: 'is_word';    ref: SegmentRef }
  | { type: 'literal';    ref: SegmentRef; value: string }
  | { type: 'anagram';    ref: SegmentRef; value: string } // pre-sorted canonical form

export type ParseError = { type: 'error'; line: string; message: string }
export type ParsedRule = Rule | ParseError

export function isError(r: ParsedRule): r is ParseError {
  return r.type === 'error'
}

function parseRef(refStr: string): SegmentRef | null {
  const parts = refStr.split('+')
  if (parts.some(p => !/^[A-Z]$/.test(p))) return null
  return parts
}

export function parseRules(text: string): ParsedRule[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.map(line => {
    const match = line.match(/^([A-Za-z+]+)\s*(.+)$/)
    if (!match) return { type: 'error' as const, line, message: 'Could not parse — expected: SEGMENT CONDITION' }

    const refStr = match[1].toUpperCase()
    const condition = match[2].trim()

    const ref = parseRef(refStr)
    if (!ref) return { type: 'error' as const, line, message: `Invalid segment ref "${refStr}" — use letters A-Z joined by +` }

    const gteMatch = condition.match(/^>=\s*(\d+)$/)
    if (gteMatch) return { type: 'length_gte', ref, value: parseInt(gteMatch[1], 10) }

    const lteMatch = condition.match(/^<=\s*(\d+)$/)
    if (lteMatch) return { type: 'length_lte', ref, value: parseInt(lteMatch[1], 10) }

    const eqMatch = condition.match(/^=\s*(.+)$/)
    if (eqMatch) {
      const val = eqMatch[1].trim()
      const quotedMatch = val.match(/^"([^"]*)"$/)
      if (quotedMatch) return { type: 'literal', ref, value: quotedMatch[1].toLowerCase() }
      if (/^\d+$/.test(val)) return { type: 'length_eq', ref, value: parseInt(val, 10) }
      return { type: 'literal', ref, value: val.toLowerCase() }
    }

    if (/^is\s+word$/i.test(condition)) return { type: 'is_word', ref }

    const anagramMatch = condition.match(/^anagram\(([^)]+)\)$/i)
    if (anagramMatch) {
      const sorted = anagramMatch[1].toLowerCase().split('').sort().join('')
      return { type: 'anagram', ref, value: sorted }
    }

    return { type: 'error' as const, line, message: `Unknown condition "${condition}"` }
  })
}

export function validateRefs(rules: Rule[], n: number): string[] {
  const errors: string[] = []
  for (const rule of rules) {
    for (const letter of rule.ref) {
      const idx = letter.charCodeAt(0) - 65
      if (idx >= n) {
        errors.push(`Segment "${letter}" is out of range — only ${n} segment(s) defined`)
      }
    }
  }
  return errors
}
