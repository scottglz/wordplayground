# WordPlayground

A UI-driven word filtering tool for word games (Wordle, crosswords, etc.). Users split words into named segments and write rules against those segments; the app shows which words in a ~150k-entry dictionary match.

## Stack

- Vite + React + TypeScript
- Tailwind v4 (`@tailwindcss/vite` plugin, no config file, `@import "tailwindcss"` in CSS)
- shadcn/ui v3 (alias `@/` → `src/`, set in both `tsconfig.json` and `tsconfig.app.json`)
- Dev server: `npm run dev` → http://localhost:5173

## Word List

`public/wordlist.txt` — ~150k entries, format `word;score` (score 0–50, multiples of 10), all lowercase, no spaces. Fetched at runtime by `useWordList`, encoded into a `SharedArrayBuffer` by `buildWordBuffer` for zero-copy sharing with workers.

## Core Concepts

Words are split into N named segments (A, B, C … up to 26). A word matches if *any* valid split satisfies *all* active rules. All possible splits are tried via backtracking with pruning.

**Rule syntax** (one rule per line in the textarea):

| Rule | Meaning |
|------|---------|
| `A >= 2` | segment length ≥ N |
| `A <= 5` | segment length ≤ N |
| `A = 3` | segment length = N |
| `A = pre` | segment equals literal string (case-insensitive input) |
| `A is word` | segment exists in word list |
| `A+C is word` | concatenation of segments exists in word list |
| `reverse(A) is word` | reverse of segment exists in word list |
| `A = reverse(C)` | segment equals another reversed |
| `length(A) = length(C)` | segment lengths equal (works with =, !=, >=, <=) |
| `length(A+B) >= length(C)` | composite refs work inside `length()` |
| `anagram(A) is word` | anagram of segment exists in word list |

`reverse()` wraps any ref part; `length()` wraps an entire LHS ref. Uppercase letters = segment labels; lowercase = literals.

## Architecture

```
src/
├── App.tsx                        # UI, state, orchestration
├── components/
│   └── SegmentLengthControl.tsx   # Segment chips UI (drag-reorder, length picker, 8 colors)
├── hooks/
│   ├── useWordList.ts             # Fetches/parses wordlist.txt → WordEntry[]
│   └── useFilterWorker.ts         # Spawns N workers, chunks words, merges results
├── lib/
│   ├── rules.ts                   # Rule parser, Rule types, validateRefs
│   ├── matcher.ts                 # SegBounds computation (pruning)
│   ├── wordBuffer.ts              # SharedArrayBuffer encode + binary search
│   └── utils.ts                   # cn() (clsx + tailwind-merge)
└── workers/
    └── matcher.worker.ts          # Per-word split search + rule evaluation
```

### Data flow

1. `useWordList` fetches and parses `wordlist.txt` → `WordEntry[]`
2. `buildWordBuffer` encodes sorted list into `SharedArrayBuffer` (offsets, scores, null-terminated strings)
3. User configures segments (count + per-segment length bounds) and writes rules in the textarea
4. On Run: `useFilterWorker.run()` divides words across `min(8, cores-1)` workers, sending rules + the shared buffer (zero-copy)
5. Each worker: `computeSegBounds()` for pruning → `findSplit()` backtracking per word → `evaluateRule()` per rule → posts progress every 10k words
6. Main thread merges worker results, re-sorts by composite score (word score + "is word" bonus), caps at 500 results

### Key types

```ts
// UI state per segment
type SegLen = { min: number; max: number | null }  // null = unlimited

// Rule union (length_*, literal, is_word, seg_eq, anagram, anagram_ref, …)
type Rule = { type: string; ref: RefPart[]; … }

// Per-word result
type MatchResult = { word, score, compositeScore, segments: string[], isWordMatches: number[] }

// Pruning bounds (pre-computed per run)
type SegBounds = { min[], max[], suffixMin[], suffixMax[] }
```

## UI Structure

- **Segments card** — segment chips with length ranges; click to edit, drag to reorder/delete
- **Rules card** — quick-insert buttons (segment labels, operators, functions) + multi-line textarea; live parse/ref errors shown inline
- **Run/progress** — Run button, progress bar, cancel; disabled when errors or word list not ready
- **Results** — match count, word list with color-coded segment badges and green "✓ word" badges for scoring matches
