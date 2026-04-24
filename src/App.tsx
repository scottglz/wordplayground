import { useMemo, useRef, useState } from 'react'
import { useWordList } from './hooks/useWordList'
import { useFilterWorker } from './hooks/useFilterWorker'
import { parseRules, validateRefs, isError, type Rule } from './lib/rules'
import { buildWordBuffer } from './lib/wordBuffer'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SegmentLengthControl, type SegLen, segColor } from '@/components/SegmentLengthControl'

const SEGMENT_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function segLengthsToRules(lengths: SegLen[], n: number): Rule[] {
  const rules: Rule[] = []
  for (let i = 0; i < n; i++) {
    const { min, max } = lengths[i]
    const ref = [{ kind: 'segment' as const, letter: SEGMENT_LABELS[i] }]
    if (max !== null && min === max) {
      rules.push({ type: 'length_eq', ref, value: min })
    } else {
      if (min > 0) rules.push({ type: 'length_gte', ref, value: min })
      if (max !== null) rules.push({ type: 'length_lte', ref, value: max })
    }
  }
  return rules
}

function App() {
  const { words, status: wordStatus, error: wordError } = useWordList()
  const { status, results, matchCount, processed, total, run, cancel } = useFilterWorker()

  const [segmentCount, setSegmentCount] = useState(3)
  const [segmentLengths, setSegmentLengths] = useState<SegLen[]>(
    Array.from({ length: 3 }, () => ({ min: 1, max: null })),
  )
  const [rulesText, setRulesText] = useState('')

  const wordBuffer = useMemo(
    () => words.length > 0 ? buildWordBuffer(words) : null,
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
  const canRun = wordStatus === 'ready' && validRules.length > 0 && !hasErrors && wordBuffer !== null

  function handleRun() {
    if (!wordBuffer) return
    run(words, segmentCount, [...segLengthsToRules(segmentLengths, segmentCount), ...validRules], wordBuffer)
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function insertAtCursor(text: string, spaceBefore = false) {
    const ta = textareaRef.current
    const start = ta?.selectionStart ?? rulesText.length
    const end   = ta?.selectionEnd   ?? rulesText.length
    const before = rulesText.slice(0, start)
    const after  = rulesText.slice(end)
    const insert = (spaceBefore && before.length > 0 && !/\s$/.test(before))
      ? ' ' + text : text
    setRulesText(before + insert + after)
    const pos = start + insert.length
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(pos, pos) })
  }

  function handleRulesChange(val: string) {
    setRulesText(val)
    if (status === 'running') cancel()
  }

  function handleSegmentChange(val: number) {
    setSegmentLengths(prev => {
      if (val > prev.length) return [...prev, ...Array.from({ length: val - prev.length }, () => ({ min: 1, max: null }))]
      return prev.slice(0, val)
    })
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
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Segments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleSegmentChange(Math.max(1, segmentCount - 1))}
                >−</Button>
                <span className="w-8 text-center font-bold text-lg tabular-nums">{segmentCount}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleSegmentChange(Math.min(26, segmentCount + 1))}
                >+</Button>
              </div>
              <SegmentLengthControl
                segmentCount={segmentCount}
                lengths={segmentLengths}
                onChange={setSegmentLengths}
              />
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              word = {SEGMENT_LABELS.slice(0, segmentCount).split('').join(' + ')}
            </p>
          </CardContent>
        </Card>

        {/* Rules */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {SEGMENT_LABELS.slice(0, segmentCount).split('').map((letter, i) => {
                const col = segColor(i)
                return (
                  <button
                    key={letter}
                    onPointerDown={e => { e.preventDefault(); insertAtCursor(letter) }}
                    className={cn('text-xs font-bold px-2.5 py-1 rounded-md border-2 cursor-pointer transition-all active:scale-95', col.bg, col.text, col.border)}
                  >{letter}</button>
                )
              })}
              {([
                { label: '+',        text: '+' },
                { label: 'is word',  text: 'is word',  spaceBefore: true },
                { label: '=',        text: '= ',       spaceBefore: true },
                { label: '!=',       text: '!= ',      spaceBefore: true },
                { label: '>=',       text: '>= ',      spaceBefore: true },
                { label: '<=',       text: '<= ',      spaceBefore: true },
                { label: 'reverse(', text: 'reverse(' },
                { label: 'length(',  text: 'length('  },
                { label: 'anagram(', text: 'anagram(' },
                { label: '↵',        text: '\n' },
              ] as { label: string; text: string; spaceBefore?: boolean }[]).map(({ label, text, spaceBefore }) => (
                <button
                  key={label}
                  onPointerDown={e => { e.preventDefault(); insertAtCursor(text, spaceBefore) }}
                  className="text-xs font-medium px-2.5 py-1 rounded-md border bg-white text-slate-600 border-slate-200 cursor-pointer transition-all active:scale-95 hover:bg-slate-50 font-mono"
                >{label}</button>
              ))}
            </div>
            <Textarea
              ref={textareaRef}
              className="font-mono text-sm min-h-[140px]"
              value={rulesText}
              onChange={e => handleRulesChange(e.target.value)}
              spellCheck={false}
            />
            {(parseErrors.length > 0 || refErrors.length > 0) && (
              <ul className="space-y-1">
                {parseErrors.map((e, i) => (
                  <li key={i} className="text-xs text-destructive flex gap-1.5">
                    <span>✗</span>
                    <span><code className="font-mono">{e.line}</code> — {e.message}</span>
                  </li>
                ))}
                {refErrors.map((e, i) => (
                  <li key={i} className="text-xs text-destructive">✗ {e}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Run / Cancel + Progress */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleRun}
              disabled={!canRun || status === 'running'}
              className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Run
            </Button>
            {status === 'running' && (
              <Button variant="outline" onClick={cancel}>
                Cancel
              </Button>
            )}
          </div>

          {status === 'running' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Checking {processed.toLocaleString()} / {total.toLocaleString()} words</span>
                <span className="font-mono">{progressPct}%</span>
              </div>
              <Progress value={progressPct} />
            </div>
          )}
        </div>

        {/* Results */}
        {(showResults || (status === 'done' && results.length === 0)) && (
          <div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Results</span>
              <span className="text-sm font-semibold text-slate-600">
                {status === 'running'
                  ? <>{matchCount.toLocaleString()} found so far…</>
                  : results.length === 0
                    ? 'No matches found.'
                    : matchCount > 500
                      ? <>showing top 500 of {matchCount.toLocaleString()} matches</>
                      : <>{matchCount.toLocaleString()} match{matchCount === 1 ? '' : 'es'}</>
                }
              </span>
            </div>

            {results.length > 0 && (
              <Card>
                <CardContent className="px-0 py-0">
                  <div className="divide-y">
                    {results.map(({ word, segments, isWordMatches }) => (
                      <div key={word} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/50 transition-colors">
                        <span className="font-bold font-mono text-sm min-w-[8rem]">{word}</span>
                        <span className="flex gap-1 flex-wrap">
                          {segments.map((seg, i) => {
                            const col = segColor(i)
                            return (
                              <Badge
                                key={i}
                                variant="outline"
                                className={cn(col.bg, col.text, 'ring-1', col.ring, 'font-mono font-semibold')}
                              >
                                {seg || '-'}
                              </Badge>
                            )
                          })}
                        </span>
                        {isWordMatches.length > 0 && (
                          <span className="flex gap-1 flex-wrap ml-auto">
                            {isWordMatches.map((w, i) => (
                              <Badge key={i} variant="outline" className="bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 font-mono">
                                ✓ {w}
                              </Badge>
                            ))}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default App
