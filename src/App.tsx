import { useMemo, useState } from 'react'
import { useWordList } from './hooks/useWordList'
import { useFilterWorker } from './hooks/useFilterWorker'
import { parseRules, validateRefs, isError } from './lib/rules'
import { buildWordBuffer } from './lib/wordBuffer'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const SEGMENT_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const SEGMENT_COLORS = [
  'bg-rose-100 text-rose-700 ring-rose-200',
  'bg-amber-100 text-amber-700 ring-amber-200',
  'bg-sky-100 text-sky-700 ring-sky-200',
  'bg-violet-100 text-violet-700 ring-violet-200',
  'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'bg-pink-100 text-pink-700 ring-pink-200',
  'bg-orange-100 text-orange-700 ring-orange-200',
  'bg-teal-100 text-teal-700 ring-teal-200',
]

function segColor(i: number) {
  return SEGMENT_COLORS[i % SEGMENT_COLORS.length]
}

function App() {
  const { words, status: wordStatus, error: wordError } = useWordList()
  const { status, results, matchCount, processed, total, run, cancel } = useFilterWorker()

  const [segmentCount, setSegmentCount] = useState(3)
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

  const segmentLabels = SEGMENT_LABELS.slice(0, segmentCount).split('')

  function handleRun() {
    if (!wordBuffer) return
    run(words, segmentCount, validRules, wordBuffer)
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
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Segments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
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
              <div className="flex flex-wrap gap-1.5">
                {segmentLabels.map((letter, i) => (
                  <Badge
                    key={letter}
                    variant="outline"
                    className={cn(segColor(i), 'ring-1 font-bold w-8 h-8 text-sm justify-center')}
                  >
                    {letter}
                  </Badge>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              word = {segmentLabels.join(' + ')}
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
              {(['A >= 2', 'B is word', 'C = en', 'reverse(A) is word', 'length(A)=length(C)'] as const).map(ex => (
                <code key={ex} className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-md border">
                  {ex}
                </code>
              ))}
            </div>
            <Textarea
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
                          {segments.map((seg, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className={cn(segColor(i), 'ring-1 font-mono font-semibold')}
                            >
                              {seg || '-'}
                            </Badge>
                          ))}
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
