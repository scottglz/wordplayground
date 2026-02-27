import { useEffect, useRef, useState } from 'react'
import type { Rule } from '../lib/rules'
import type { WordEntry } from './useWordList'
import type { MatchResult, WordMap } from '../lib/matcher'

export type FilterStatus = 'idle' | 'running' | 'done'

interface FilterState {
  status: FilterStatus
  results: MatchResult[]
  processed: number
  total: number
}

export function useFilterWorker() {
  const [state, setState] = useState<FilterState>({
    status: 'idle',
    results: [],
    processed: 0,
    total: 0,
  })
  const workerRef = useRef<Worker | null>(null)

  function run(words: WordEntry[], n: number, rules: Rule[], wordMap: WordMap) {
    workerRef.current?.terminate()
    setState({ status: 'running', results: [], processed: 0, total: words.length })

    const worker = new Worker(
      new URL('../workers/matcher.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const { type, results, processed, total } = e.data
      setState(s => ({ ...s, results, processed, total }))
      if (type === 'done') {
        setState(s => ({ ...s, status: 'done' }))
        worker.terminate()
        workerRef.current = null
      }
    }

    worker.postMessage({ words, n, rules, wordMap })
  }

  function cancel() {
    workerRef.current?.terminate()
    workerRef.current = null
    setState(s => ({ ...s, status: 'idle' }))
  }

  // Clean up on unmount
  useEffect(() => () => { workerRef.current?.terminate() }, [])

  return { ...state, run, cancel }
}
