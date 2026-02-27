/**
 * Encodes the word list into a SharedArrayBuffer for zero-copy sharing across workers.
 *
 * Layout:
 *   [0..3]               uint32  N (word count)
 *   [4..4+N*4-1]         uint32  offsets[i] — byte offset of word i in the strings section
 *   [4+N*4..4+N*5-1]     uint8   scores[i]
 *   [4+N*5..]            bytes   null-terminated word strings, concatenated
 *
 * Words are stored in sorted order so workers can binary-search for is-word lookups.
 */

export function buildWordBuffer(words: { word: string; score: number }[]): SharedArrayBuffer {
  const sorted = words.slice().sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0))
  const N = sorted.length
  const totalStringBytes = sorted.reduce((s, { word }) => s + word.length + 1, 0)

  // [4] + [N*4 offsets] + [N scores] + [string bytes], padded to multiple of 4
  const rawSize = 4 + N * 4 + N + totalStringBytes
  const buf = new SharedArrayBuffer((rawSize + 3) & ~3)
  const u32 = new Uint32Array(buf)
  const u8  = new Uint8Array(buf)

  u32[0] = N

  const scoresStart  = 4 + N * 4
  const stringsStart = scoresStart + N
  let strOffset = 0

  for (let i = 0; i < N; i++) {
    const { word, score } = sorted[i]
    u32[1 + i] = strOffset
    u8[scoresStart + i] = score
    for (let j = 0; j < word.length; j++) u8[stringsStart + strOffset + j] = word.charCodeAt(j)
    // null terminator already 0 (SharedArrayBuffer is zero-initialised)
    strOffset += word.length + 1
  }

  return buf
}

/**
 * Binary-searches the buffer for `target`.
 * Returns the word's score (0–50) if found, or -1 if not found.
 */
export function lookupWord(buf: SharedArrayBuffer, target: string): number {
  const u32 = new Uint32Array(buf)
  const u8  = new Uint8Array(buf)
  const N   = u32[0]
  const scoresStart  = 4 + N * 4
  const stringsStart = scoresStart + N

  let lo = 0, hi = N - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const base = stringsStart + u32[1 + mid]

    let cmp = 0
    for (let i = 0; ; i++) {
      const a = i < target.length ? target.charCodeAt(i) : 0
      const b = u8[base + i]
      if (a === b) { if (a === 0) break; continue }
      cmp = a - b
      break
    }

    if (cmp === 0) return u8[scoresStart + mid]
    if (cmp < 0) hi = mid - 1
    else lo = mid + 1
  }
  return -1
}
