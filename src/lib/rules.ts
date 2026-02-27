// Each part of a ref is either a segment letter or an inline literal
export type RefPart =
  | { kind: 'segment'; letter: string }  // e.g. A, B
  | { kind: 'literal'; value: string }   // e.g. "te", "pre"

// A ref is an ordered sequence of parts, resolved by concatenation
// e.g. "B+te" → [segment B, literal "te"]
export type SegmentRef = RefPart[]

export type Rule =
  | { type: 'length_gte'; ref: SegmentRef; value: number }
  | { type: 'length_lte'; ref: SegmentRef; value: number }
  | { type: 'length_eq';  ref: SegmentRef; value: number }
  | { type: 'length_neq'; ref: SegmentRef; value: number }
  | { type: 'is_word';    ref: SegmentRef }
  | { type: 'literal';    ref: SegmentRef; value: string }
  | { type: 'not_literal';ref: SegmentRef; value: string }
  | { type: 'seg_eq';     ref: SegmentRef; other: SegmentRef }
  | { type: 'seg_neq';    ref: SegmentRef; other: SegmentRef }
  | { type: 'anagram';    ref: SegmentRef; value: string } // pre-sorted canonical form

export type ParseError = { type: 'error'; line: string; message: string }
export type ParsedRule = Rule | ParseError

export function isError(r: ParsedRule): r is ParseError {
  return r.type === 'error'
}

/** Returns true if val is a pure segment reference (e.g. "C" or "A+B") */
function isPureSegmentRef(val: string): boolean {
  return /^[A-Z](\+[A-Z])*$/.test(val)
}

function parseRef(refStr: string): SegmentRef | null {
  const parts = refStr.split('+').filter(Boolean)
  if (parts.length === 0) return null
  return parts.map(part =>
    /^[A-Z]$/.test(part)
      ? { kind: 'segment' as const, letter: part }
      : { kind: 'literal' as const, value: part.toLowerCase() }
  )
}

export function parseRules(text: string): ParsedRule[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.map(line => {
    const match = line.match(/^([A-Za-z0-9+]+)\s*(.+)$/)
    // Note: uppercase = segment (A-Z), lowercase = literal — do NOT normalise case here
    if (!match) return { type: 'error' as const, line, message: 'Could not parse — expected: SEGMENT CONDITION' }

    const refStr = match[1]
    const condition = match[2].trim()

    const ref = parseRef(refStr)
    if (!ref) return { type: 'error' as const, line, message: `Invalid ref "${refStr}"` }

    const gteMatch = condition.match(/^>=\s*(\d+)$/)
    if (gteMatch) return { type: 'length_gte', ref, value: parseInt(gteMatch[1], 10) }

    const lteMatch = condition.match(/^<=\s*(\d+)$/)
    if (lteMatch) return { type: 'length_lte', ref, value: parseInt(lteMatch[1], 10) }

    const neqMatch = condition.match(/^!=\s*(.+)$/)
    if (neqMatch) {
      const val = neqMatch[1].trim()
      if (isPureSegmentRef(val)) return { type: 'seg_neq', ref, other: parseRef(val)! }
      if (/^\d+$/.test(val)) return { type: 'length_neq', ref, value: parseInt(val, 10) }
      return { type: 'not_literal', ref, value: val.toLowerCase() }
    }

    const eqMatch = condition.match(/^=\s*(.+)$/)
    if (eqMatch) {
      const val = eqMatch[1].trim()
      const quotedMatch = val.match(/^"([^"]*)"$/)
      if (quotedMatch) return { type: 'literal', ref, value: quotedMatch[1].toLowerCase() }
      if (isPureSegmentRef(val)) return { type: 'seg_eq', ref, other: parseRef(val)! }
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
  function checkRef(ref: SegmentRef) {
    for (const part of ref) {
      if (part.kind === 'segment') {
        const idx = part.letter.charCodeAt(0) - 65
        if (idx >= n) errors.push(`Segment "${part.letter}" is out of range — only ${n} segment(s) defined`)
      }
    }
  }
  for (const rule of rules) {
    checkRef(rule.ref)
    if (rule.type === 'seg_eq' || rule.type === 'seg_neq') checkRef(rule.other)
  }
  return errors
}
