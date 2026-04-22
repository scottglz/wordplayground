# WordPlayground — App Notes

## Goal
A UI-centric word/phrase filtering tool. Users apply complex filters against a list of words and phrases, and the app shows which entries match.

## Core Concepts
- **Word list**: a collection of words and/or phrases (source TBD)
- **Filters**: user-defined, composable, UI-driven (not raw text/regex entry)
- **Results**: filtered subset of the word list that matches all active filters

## Open Questions
- [ ] Specific filter types beyond positional/pattern (user has ideas, TBD)
- [ ] AND / OR / NOT logic between rules?

## Decisions
- **Word list source**: static built-in list (standard dictionary/word list bundled with app)
- **Primary use case**: word games (Wordle, crossword, etc.) — positional constraints, letter inclusion/exclusion
- **Filter direction**: pattern/positional filters confirmed; more filter types to be defined by user

## Filter System (implemented)
- Words are split into N named segments (A, B, C … up to Z)
- Word must equal segments concatenated: word = A+B+C+…
- All possible splits are tried via backtracking; a word matches if any split satisfies all rules
- Rule syntax (one per line):
  - `A >= 2`  — segment length ≥ N
  - `A <= 5`  — segment length ≤ N
  - `A = 3`   — segment length = N
  - `A = en`  — segment equals literal string (case-insensitive input)
  - `A is word` — segment exists in the word list
  - `A+C is word` — concatenation of segments exists in the word list
  - `reverse(A) is word` — reverse of segment A exists in word list
  - `A = reverse(C)` — segment A equals segment C reversed
  - `reverse(C)+reverse(A) is word` — concat of reversed segments exists in word list
  - `length(A) = length(C)` — segment lengths equal (works with =, !=, >=, <=)
  - `length(A) = 3` — equivalent to `A = 3`
  - `length(A+B) >= length(C)` — composite refs work inside length()
- `reverse()` can wrap any ref part; `length()` wraps an entire LHS ref
- Results show: score | word | segment breakdown (e.g. `50  garden  gar·den`)
- Results capped at 500; Run button triggers filter

## Decisions
- Stack: Vite + React + TypeScript + Tailwind v4 + shadcn/ui v3
- Frontend only for now
- **Word list**: spreadthewordlist.txt — 311,482 entries, format `word;score`, score 0–50 (multiples of 10)
  - Source file: C:\Users\scottg\Downloads\spreadthewordlist.txt
  - Served from public/wordlist.txt, fetched at runtime, parsed into `{word: string, score: number}[]`
  - All lowercase, no spaces (concatenated phrases included, e.g. "zztop", "aaateam")
