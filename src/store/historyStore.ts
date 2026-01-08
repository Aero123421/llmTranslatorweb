import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface Word {
  original: string
  translated: string
  meaning?: string
}

export interface TranslationHistoryItem {
  id: string
  sourceText: string
  targetText: string
  sourceLanguage: string
  targetLanguage: string
  words?: Word[]
  detailedExplanation?: string
  nuanceExplanation?: string
  provider: string
  model?: string
  timestamp: number
}

interface HistoryStore {
  history: TranslationHistoryItem[]
  addHistoryItem: (item: Omit<TranslationHistoryItem, 'id' | 'timestamp'>) => void
  deleteHistoryItem: (id: string) => void
  clearHistory: () => void
  getHistoryItem: (id: string) => TranslationHistoryItem | undefined
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}-${performance.now().toString(36)}`
}

const MAX_HISTORY_SIZE = 100
const MAX_STORAGE_SIZE = 5 * 1024 * 1024 // 5MB

const safeStorage = createJSONStorage(() => {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }
  }

  const storage = window.localStorage

  return {
    getItem: (name: string) => {
      try {
        return storage.getItem(name)
      } catch (error) {
        console.error('Error reading from localStorage:', error)
        return null
      }
    },
    setItem: (name: string, value: string) => {
      try {
        if (value.length > MAX_STORAGE_SIZE) {
          console.warn('Data too large for localStorage')
          return
        }

        storage.setItem(name, value)
      } catch (error) {
        console.error('Error writing to localStorage:', error)
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.warn('Storage quota exceeded, clearing old history')
          try {
            const existing = storage.getItem(name)
            if (existing) {
              const parsed = JSON.parse(existing) as { state?: { history?: TranslationHistoryItem[] } }
              const currentHistory = parsed.state?.history ?? []
              const trimmed = currentHistory.slice(0, Math.max(1, Math.floor(currentHistory.length / 2)))
              storage.setItem(
                name,
                JSON.stringify({
                  ...parsed,
                  state: {
                    ...parsed.state,
                    history: trimmed,
                  },
                })
              )
            } else {
              storage.removeItem(name)
            }
          } catch (e) {
            console.error('Failed to clear history:', e)
            try {
              storage.removeItem(name)
            } catch (removeError) {
              console.error('Failed to remove storage key:', removeError)
            }
          }
        }
      }
    },
    removeItem: (name: string) => {
      try {
        storage.removeItem(name)
      } catch (error) {
        console.error('Error removing from localStorage:', error)
      }
    },
  }
})

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      history: [],
      addHistoryItem: (item) => {
        const newItem: TranslationHistoryItem = {
          ...item,
          id: generateId(),
          timestamp: Date.now(),
        }
        
        set((state) => {
          const newHistory = [newItem, ...state.history].slice(0, MAX_HISTORY_SIZE)
          
          if (newHistory.length === MAX_HISTORY_SIZE) {
            console.warn('History limit reached, oldest item removed')
          }

          return { history: newHistory }
        })
      },
      deleteHistoryItem: (id) => {
        set((state) => ({
          history: state.history.filter((item) => item.id !== id),
        }))
      },
      clearHistory: () => {
        set({ history: [] })
      },
      getHistoryItem: (id) => {
        return get().history.find((item) => item.id === id)
      },
    }),
    {
      name: 'translation-history',
      storage: safeStorage,
      partialize: (state) => ({
        history: state.history,
      }),
    }
  )
)
