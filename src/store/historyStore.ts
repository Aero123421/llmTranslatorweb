import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface Word {
  original: string
  translated: string
  meaning?: string
}

export interface GrammarPoint {
  point: string
  segment: string
  explanation: string
}

export interface NuanceChoice {
  phrase: string
  original_segment: string
  reason: string
}

export interface TranslationHistoryItem {
  id: string
  sourceText: string
  targetText: string
  sourceLanguage: string
  targetLanguage: string
  words?: Word[]
  detailedExplanation?: {
    key_points?: GrammarPoint[]
    politeness_level?: string
  }
  nuanceExplanation?: {
    tone?: string
    cultural_context?: string
    better_choices?: NuanceChoice[]
  }
  provider: string
  model?: string
  timestamp: number
}

interface HistoryStore {
  history: TranslationHistoryItem[]
  addHistoryItem: (item: Omit<TranslationHistoryItem, 'id' | 'timestamp'> & { id?: string }) => void
  updateHistoryItem: (id: string, updates: Partial<TranslationHistoryItem>) => void
  deleteHistoryItem: (id: string) => void
  clearHistory: () => void
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

const MAX_HISTORY_SIZE = 100

const safeStorage = createJSONStorage(() => {
  if (typeof window === 'undefined') return { getItem: () => null, setItem: () => { }, removeItem: () => { } }
  return window.localStorage
})

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      history: [],
      addHistoryItem: (item) => {
        const newItem: TranslationHistoryItem = {
          ...item,
          id: (item as any).id || generateId(),
          timestamp: Date.now(),
        }
        set((state) => ({
          history: [newItem, ...state.history].slice(0, MAX_HISTORY_SIZE)
        }))
      },
      updateHistoryItem: (id, updates) => {
        set((state) => ({
          history: state.history.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          )
        }))
      },
      deleteHistoryItem: (id) => {
        set((state) => ({
          history: state.history.filter((item) => item.id !== id),
        }))
      },
      clearHistory: () => {
        set({ history: [] })
      },
    }),
    {
      name: 'translation-history',
      storage: safeStorage,
    }
  )
)