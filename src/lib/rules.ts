// Each part of a ref is either a segment letter, an inline literal, or a reverse() wrapper
export type RefPart =
  | { kind: 'segment'; letter: string }  // e.g. A, B
  | { kind: 'literal'; value: string }   // e.g. "te", "pre"
  | { kind: 'reverse'; inner: SegmentRef } // e.g. reverse(A), reverse(A+B)

// A ref is an ordered sequence of parts, resolved by concatenation
// e.g. "B+te" → [segment B, literal "te"]
export type SegmentRef = RefPart[]

export type Rule =
  | { type: 'length_gte'; ref: SegmentRef; value: number }
  | { type: 'length_lte'; ref: SegmentRef; value: number }
  | { type: 'length_eq';  ref: SegmentRef; value: number }
  | { type: 'length_neq'; ref: SegmentRef; value: number }
  | { type: 'len_ref_eq';  ref: SegmentRef; other: SegmentRef } // length(A) = length(C)
  | { type: 'len_ref_neq'; ref: SegmentRef; other: SegmentRef } // length(A) != length(C)
  | { type: 'len_ref_gte'; ref: SegmentRef; other: SegmentRef } // length(A) >= length(C)
  | { type: 'len_ref_lte'; ref: SegmentRef; other: SegmentRef } // length(A) <= length(C)
  | { type: 'is_word';    ref: SegmentRef }
  | { type: 'literal';    ref: SegmentRef; value: string }
  | { type: 'not_literal';ref: SegmentRef; value: string }
  | { type: 'seg_eq';     ref: SegmentRef; other: SegmentRef }
  | { type: 'seg_neq';    ref: SegmentRef; other: SegmentRef }
  | { type: 'anagram';     ref: SegmentRef; value: string }     // pre-sorted canonical form
  | { type: 'anagram_ref'; ref: SegmentRef; other: SegmentRef } // anagram of another segment

export type ParseError = { type: 'error'; line: string; message: string }
export type ParsedRule = Rule | ParseError

export function isError(r: ParsedRule): r is ParseError {
  return r.type === 'error'
}

/** Returns true if val is a pure segment reference (e.g. "C" or "A+B") */
function isPureSegmentRef(val: string): boolean {
  return /^[A-Z](\+[A-Z])*$/.test(val)
}

/** Split string by + respecting parentheses */
function splitByPlus(s: string): string[] {
  const parts: string[] = []
  let depth = 0, start = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') depth--
    else if (s[i] === '+' && depth === 0) {
      parts.push(s.slice(start, i))
      start = i + 1
    }
  }
  parts.push(s.slice(start))
  return parts.filter(Boolean)
}

/** True if ref contains at least one segment part (recursing through reverse()). */
function refHasSegment(ref: SegmentRef): boolean {
  return ref.some(p =>
    p.kind === 'segment' ? true :
    p.kind === 'reverse' ? refHasSegment(p.inner) :
    false
  )
}

function parseRef(refStr: string): SegmentRef | null {
  const parts = splitByPlus(refStr)
  if (parts.length === 0) return null
  const result: RefPart[] = []
  for (const part of parts) {
    const revMatch = part.match(/^reverse\((.+)\)$/i)
    if (revMatch) {
      const inner = parseRef(revMatch[1])
      if (!inner) return null
      result.push({ kind: 'reverse' as const, inner })
    } else if (/^[A-Z]$/.test(part)) {
      result.push({ kind: 'segment' as const, letter: part })
    } else {
      result.push({ kind: 'literal' as const, value: part.toLowerCase() })
    }
  }
  return result
}

/** Try to parse val as a segment ref expression (for RHS of = / !=) */
function tryParseAsSegRef(val: string): SegmentRef | null {
  if (isPureSegmentRef(val)) return parseRef(val)
  if (/reverse\(/i.test(val)) return parseRef(val)
  return null
}

export function parseRules(text: string): ParsedRule[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.map(line => {
    // ── length(REF) on LHS ─────────────────────────────────────────────
    const lengthLhsMatch = line.match(/^length\(([A-Za-z0-9+]+)\)\s*(.+)$/i)
    if (lengthLhsMatch) {
      const ref = parseRef(lengthLhsMatch[1])
      if (!ref) return { type: 'error' as const, line, message: `Invalid ref inside length()` }
      if (!refHasSegment(ref)) return { type: 'error' as const, line, message: `Ref must reference at least one segment (uppercase A–Z)` }
      const cond = lengthLhsMatch[2].trim()

      // length(A) >= length(B)  or  length(A) >= 3
      const gteM = cond.match(/^>=\s*(.+)$/)
      if (gteM) {
        const rhs = gteM[1].trim()
        const rhsLen = rhs.match(/^length\(([A-Za-z0-9+]+)\)$/i)
        if (rhsLen) { const o = parseRef(rhsLen[1]); return o ? { type: 'len_ref_gte', ref, other: o } : { type: 'error' as const, line, message: 'Invalid ref in RHS length()' } }
        if (/^\d+$/.test(rhs)) return { type: 'length_gte', ref, value: parseInt(rhs, 10) }
        return { type: 'error' as const, line, message: `Expected number or length() after >=` }
      }
      // length(A) <= length(B)  or  length(A) <= 3
      const lteM = cond.match(/^<=\s*(.+)$/)
      if (lteM) {
        const rhs = lteM[1].trim()
        const rhsLen = rhs.match(/^length\(([A-Za-z0-9+]+)\)$/i)
        if (rhsLen) { const o = parseRef(rhsLen[1]); return o ? { type: 'len_ref_lte', ref, other: o } : { type: 'error' as const, line, message: 'Invalid ref in RHS length()' } }
        if (/^\d+$/.test(rhs)) return { type: 'length_lte', ref, value: parseInt(rhs, 10) }
        return { type: 'error' as const, line, message: `Expected number or length() after <=` }
      }
      // length(A) != length(B)  or  length(A) != 3
      const neqM = cond.match(/^!=\s*(.+)$/)
      if (neqM) {
        const rhs = neqM[1].trim()
        const rhsLen = rhs.match(/^length\(([A-Za-z0-9+]+)\)$/i)
        if (rhsLen) { const o = parseRef(rhsLen[1]); return o ? { type: 'len_ref_neq', ref, other: o } : { type: 'error' as const, line, message: 'Invalid ref in RHS length()' } }
        if (/^\d+$/.test(rhs)) return { type: 'length_neq', ref, value: parseInt(rhs, 10) }
        return { type: 'error' as const, line, message: `Expected number or length() after !=` }
      }
      // length(A) = length(B)  or  length(A) = 3
      const eqM = cond.match(/^=\s*(.+)$/)
      if (eqM) {
        const rhs = eqM[1].trim()
        const rhsLen = rhs.match(/^length\(([A-Za-z0-9+]+)\)$/i)
        if (rhsLen) { const o = parseRef(rhsLen[1]); return o ? { type: 'len_ref_eq', ref, other: o } : { type: 'error' as const, line, message: 'Invalid ref in RHS length()' } }
        if (/^\d+$/.test(rhs)) return { type: 'length_eq', ref, value: parseInt(rhs, 10) }
        return { type: 'error' as const, line, message: `Expected number or length() after =` }
      }
      return { type: 'error' as const, line, message: `length() requires a comparison operator (=, !=, >=, <=)` }
    }

    // ── Normal ref on LHS (supports reverse() wrappers) ────────────────
    const REF_PART = String.raw`(?:reverse\([A-Za-z0-9+]+\)|[A-Za-z0-9]+)`
    const match = line.match(new RegExp(`^(${REF_PART}(?:\\+${REF_PART})*)\\s*(.+)$`, 'i'))
    // Note: uppercase = segment (A-Z), lowercase = literal — do NOT normalise case here
    if (!match) return { type: 'error' as const, line, message: 'Could not parse — expected: SEGMENT CONDITION' }

    const refStr = match[1]
    const condition = match[2].trim()

    const ref = parseRef(refStr)
    if (!ref) return { type: 'error' as const, line, message: `Invalid ref "${refStr}"` }
    if (!refHasSegment(ref)) return { type: 'error' as const, line, message: `Ref must reference at least one segment (uppercase A–Z)` }

    const gteMatch = condition.match(/^>=\s*(\d+)$/)
    if (gteMatch) return { type: 'length_gte', ref, value: parseInt(gteMatch[1], 10) }

    const lteMatch = condition.match(/^<=\s*(\d+)$/)
    if (lteMatch) return { type: 'length_lte', ref, value: parseInt(lteMatch[1], 10) }

    const neqMatch = condition.match(/^!=\s*(.+)$/)
    if (neqMatch) {
      const val = neqMatch[1].trim()
      const neqRef = tryParseAsSegRef(val)
      if (neqRef) return { type: 'seg_neq', ref, other: neqRef }
      if (/^\d+$/.test(val)) return { type: 'length_neq', ref, value: parseInt(val, 10) }
      return { type: 'not_literal', ref, value: val.toLowerCase() }
    }

    const eqMatch = condition.match(/^=\s*(.+)$/)
    if (eqMatch) {
      const val = eqMatch[1].trim()
      const quotedMatch = val.match(/^"([^"]*)"$/)
      if (quotedMatch) return { type: 'literal', ref, value: quotedMatch[1].toLowerCase() }
      const eqRef = tryParseAsSegRef(val)
      if (eqRef) return { type: 'seg_eq', ref, other: eqRef }
      if (/^\d+$/.test(val)) return { type: 'length_eq', ref, value: parseInt(val, 10) }
      return { type: 'literal', ref, value: val.toLowerCase() }
    }

    if (/^is\s+word$/i.test(condition)) return { type: 'is_word', ref }

    const anagramMatch = condition.match(/^anagram\(([^)]+)\)$/i)
    if (anagramMatch) {
      const inner = anagramMatch[1].trim()
      const innerRef = parseRef(inner)
      if (innerRef && refHasSegment(innerRef)) {
        return { type: 'anagram_ref', ref, other: innerRef }
      }
      const sorted = inner.toLowerCase().split('').sort().join('')
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
      } else if (part.kind === 'reverse') {
        checkRef(part.inner)
      }
    }
  }
  for (const rule of rules) {
    checkRef(rule.ref)
    if ('other' in rule) checkRef(rule.other)
  }
  return errors
}
