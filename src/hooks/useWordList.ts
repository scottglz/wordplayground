import { useEffect, useState } from 'react'

export interface WordEntry {
  word: string
  score: number
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface WordListState {
  words: WordEntry[]
  status: Status
  error: string | null
}

export function useWordList() {
  const [state, setState] = useState<WordListState>({
    words: [],
    status: 'idle',
    error: null,
  })

  useEffect(() => {
    setState(s => ({ ...s, status: 'loading' }))

    fetch('/wordlist.txt')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch word list: ${res.status}`)
        return res.text()
      })
      .then(text => {
        const words: WordEntry[] = []
        for (const line of text.split('\n')) {
          const semi = line.indexOf(';')
          if (semi === -1) continue
          const word = line.slice(0, semi).trim()
          const score = parseInt(line.slice(semi + 1).trim(), 10)
          if (word && !isNaN(score)) {
            words.push({ word, score })
          }
        }
        setState({ words, status: 'ready', error: null })
      })
      .catch(err => {
        setState({ words: [], status: 'error', error: String(err) })
      })
  }, [])

  return state
}
