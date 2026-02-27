import { useMemo, useState } from 'react'
import { useWordList } from './hooks/useWordList'
import { useFilterWorker } from './hooks/useFilterWorker'
import { parseRules, validateRefs, isError } from './lib/rules'
import type { WordMap } from './lib/matcher'

const SEGMENT_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const SEGMENT_COLORS = [
  { pill: 'bg-rose-100 text-rose-700 ring-rose-200',    dot: 'bg-rose-400'    },
  { pill: 'bg-amber-100 text-amber-700 ring-amber-200', dot: 'bg-amber-400'   },
  { pill: 'bg-sky-100 text-sky-700 ring-sky-200',       dot: 'bg-sky-400'     },
  { pill: 'bg-violet-100 text-violet-700 ring-violet-200', dot: 'bg-violet-400' },
  { pill: 'bg-emerald-100 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-400' },
  { pill: 'bg-pink-100 text-pink-700 ring-pink-200',    dot: 'bg-pink-400'    },
  { pill: 'bg-orange-100 text-orange-700 ring-orange-200', dot: 'bg-orange-400' },
  { pill: 'bg-teal-100 text-teal-700 ring-teal-200',    dot: 'bg-teal-400'    },
]

function segColor(i: number) {
  return SEGMENT_COLORS[i % SEGMENT_COLORS.length]
}

function App() {
  const { words, status: wordStatus, error: wordError } = useWordList()
  const { status, results, processed, total, run, cancel } = useFilterWorker()

  const [segmentCount, setSegmentCount] = useState(3)
  const [rulesText, setRulesText] = useState('')

  const wordMap = useMemo<WordMap>(
    () => new Map(words.map(w => [w.word, w.score])),
    [words],
  )

  const parsedRules = useMemo(() => parseRules(rulesText), [rulesText])
  const parseErrors = parsedRules.filter(isError)
  const validRules = parsedRules.filter(r => !isError(r))
  const refErrors = useMemo(
    () => validateRefs(validRules, segmentCount),
    [validRules, segmentCount],
  )
  const hasErrors = parseErrors.length > 0 || refErrors.length > 0
  const canRun = wordStatus === 'ready' && validRules.length > 0 && !hasErrors

  const segmentLabels = SEGMENT_LABELS.slice(0, segmentCount).split('')

  function handleRun() {
    run(words, segmentCount, validRules, wordMap)
  }

  function handleRulesChange(val: string) {
    setRulesText(val)
    if (status === 'running') cancel()
  }

  function handleSegmentChange(val: number) {
    setSegmentCount(val)
    if (status === 'running') cancel()
  }

  const progressPct = total > 0 ? Math.round((processed / total) * 100) : 0
  const showResults = (status === 'running' || status === 'done') && results.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-violet-600 via-pink-500 to-amber-400 bg-clip-text text-transparent pb-1">
            WordPlayground
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {wordStatus === 'loading' && 'Loading word list…'}
            {wordStatus === 'error' && <span className="text-destructive">Failed to load word list: {wordError}</span>}
            {wordStatus === 'ready' && <>{words.length.toLocaleString()} words ready</>}
          </p>
        </div>

        {/* Segment count */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
            Segments
          </label>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleSegmentChange(Math.max(1, segmentCount - 1))}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-lg leading-none transition-colors flex items-center justify-center"
              >−</button>
              <span className="w-8 text-center font-bold text-lg tabular-nums">{segmentCount}</span>
              <button
                onClick={() => handleSegmentChange(Math.min(26, segmentCount + 1))}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-lg leading-none transition-colors flex items-center justify-center"
              >+</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {segmentLabels.map((letter, i) => (
                <span
                  key={letter}
                  className={`${segColor(i).pill} ring-1 font-bold text-sm w-8 h-8 rounded-lg flex items-center justify-center`}
                >
                  {letter}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 font-mono">
            word = {segmentLabels.join(' + ')}
          </p>
        </div>

        {/* Rules */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
            Rules
          </label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(['A >= 2', 'B is word', 'C = en', 'A+C is word', 'A anagram(meat)'] as const).map(ex => (
              <code key={ex} className="bg-slate-50 border border-slate-200 text-slate-500 text-xs px-2 py-0.5 rounded-md">
                {ex}
              </code>
            ))}
          </div>
          <textarea
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono bg-slate-50 focus:bg-white focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100 resize-y min-h-[140px] transition-colors placeholder:text-slate-300"
            placeholder={'A >= 2\nB >= 3\nB is word\nC = en\nA+C is word'}
            value={rulesText}
            onChange={e => handleRulesChange(e.target.value)}
            spellCheck={false}
          />
          {(parseErrors.length > 0 || refErrors.length > 0) && (
            <ul className="mt-3 space-y-1">
              {parseErrors.map((e, i) => (
                <li key={i} className="text-xs text-rose-500 flex gap-1.5">
                  <span>✗</span>
                  <span><code className="font-mono">{e.line}</code> — {e.message}</span>
                </li>
              ))}
              {refErrors.map((e, i) => (
                <li key={i} className="text-xs text-rose-500">✗ {e}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Run / Cancel + Progress */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={handleRun}
              disabled={!canRun || status === 'running'}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white text-sm font-bold shadow-md shadow-violet-200 hover:shadow-lg hover:shadow-violet-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100 transition-all"
            >
              Run
            </button>
            {status === 'running' && (
              <button
                onClick={cancel}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {status === 'running' && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>Checking {processed.toLocaleString()} / {total.toLocaleString()} words</span>
                <span className="font-mono">{progressPct}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-400 to-pink-400 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {(showResults || (status === 'done' && results.length === 0)) && (
          <div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Results</span>
              <span className="text-sm font-semibold text-slate-600">
                {status === 'running'
                  ? <>{results.length.toLocaleString()} found so far…</>
                  : results.length === 0
                    ? 'No matches found.'
                    : <>{results.length.toLocaleString()} match{results.length === 1 ? '' : 'es'}{results.length === 500 ? ' (top 500)' : ''}</>
                }
              </span>
            </div>

            {results.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-50">
                {results.map(({ word, segments, isWordMatches }) => (
                  <div key={word} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 transition-colors">
                    <span className="font-bold font-mono text-sm text-slate-800 min-w-[8rem]">{word}</span>
                    <span className="flex gap-1 flex-wrap">
                      {segments.map((seg, i) => (
                        <span
                          key={i}
                          className={`${segColor(i).pill} ring-1 text-xs font-mono px-2 py-0.5 rounded-md font-semibold`}
                        >
                          {seg}
                        </span>
                      ))}
                    </span>
                    {isWordMatches.length > 0 && (
                      <span className="flex gap-1 flex-wrap ml-auto">
                        {isWordMatches.map((w, i) => (
                          <span key={i} className="bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 text-xs font-mono px-2 py-0.5 rounded-full font-semibold">
                            ✓ {w}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default App
