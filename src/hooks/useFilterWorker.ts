import { useEffect, useRef, useState } from 'react'
import type { Rule } from '../lib/rules'
import type { WordEntry } from './useWordList'
import type { MatchResult } from '../lib/matcher'

export type FilterStatus = 'idle' | 'running' | 'done'

interface FilterState {
  status: FilterStatus
  results: MatchResult[]
  matchCount: number
  processed: number
  total: number
}

interface WorkerSlot {
  results: MatchResult[]
  matchCount: number
  processed: number
  total: number
  done: boolean
}

function workerCount(): number {
  return Math.max(1, Math.min(8, (navigator.hardwareConcurrency ?? 4) - 1))
}

export function useFilterWorker() {
  const [state, setState] = useState<FilterState>({
    status: 'idle', results: [], matchCount: 0, processed: 0, total: 0,
  })

  const workersRef = useRef<Worker[]>([])
  const slotsRef   = useRef<WorkerSlot[]>([])

  function terminateAll() {
    workersRef.current.forEach(w => w.terminate())
    workersRef.current = []
    slotsRef.current   = []
  }

  function run(words: WordEntry[], n: number, rules: Rule[], wordBuffer: SharedArrayBuffer) {
    terminateAll()

    const N = workerCount()
    const chunkSize = Math.ceil(words.length / N)
    const slots: WorkerSlot[] = Array.from({ length: N }, (_, i) => ({
      results: [], matchCount: 0, processed: 0, total: Math.min(chunkSize, words.length - i * chunkSize), done: false,
    }))
    slotsRef.current = slots

    setState({ status: 'running', results: [], matchCount: 0, processed: 0, total: words.length })

    const workers = Array.from({ length: N }, (_, i) => {
      const worker = new Worker(
        new URL('../workers/matcher.worker.ts', import.meta.url),
        { type: 'module' },
      )

      worker.onmessage = (e: MessageEvent) => {
        const { type, results, matchCount, processed, total } = e.data
        slots[i] = { results, matchCount, processed, total, done: type === 'done' }

        // Merge all workers' current top results and re-sort globally
        const merged = slots.flatMap(s => s.results)
        merged.sort((a, b) => b.compositeScore - a.compositeScore)

        const totalProcessed = slots.reduce((s, w) => s + w.processed, 0)
        const totalMatchCount = slots.reduce((s, w) => s + w.matchCount, 0)
        const allDone = slots.every(s => s.done)

        setState({
          status: allDone ? 'done' : 'running',
          results: merged.slice(0, 500),
          matchCount: totalMatchCount,
          processed: totalProcessed,
          total: words.length,
        })

        if (allDone) terminateAll()
      }

      // wordBuffer is a SharedArrayBuffer — sent by reference, not copied
      worker.postMessage({
        words: words.slice(i * chunkSize, (i + 1) * chunkSize),
        n,
        rules,
        wordBuffer,
      })

      return worker
    })

    workersRef.current = workers
  }

  function cancel() {
    terminateAll()
    setState(s => ({ ...s, status: 'idle' }))
  }

  useEffect(() => () => terminateAll(), [])

  return { ...state, run, cancel }
}
