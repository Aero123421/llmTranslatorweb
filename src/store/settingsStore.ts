import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type LLMProvider = 'groq' | 'gemini' | 'cerebras' | 'openai' | 'grok'

export type Language = 'japanese' | 'english' | 'russian' | 'chinese' | 'korean' | 'spanish'

export type OutputFormat = 'word' | 'sentence' | 'full' | 'custom'

export interface TranslationSettings {
  sourceLanguage: Language
  targetLanguage: Language
  provider: LLMProvider
  // Provider-specific API keys
  apiKeys: Record<LLMProvider, string>
  customEndpoint?: string
  model?: string
  temperature?: number
  showWordList: boolean
  showDetailedExplanation: boolean
  showNuanceExplanation: boolean
  outputFormat: OutputFormat
}

interface SettingsStore extends TranslationSettings {
  setSourceLanguage: (language: Language) => void
  setTargetLanguage: (language: Language) => void
  setProvider: (provider: LLMProvider) => void
  setApiKey: (apiKey: string) => void  // Sets API key for the current provider
  setCustomEndpoint: (endpoint?: string) => void
  setModel: (model?: string) => void
  setTemperature: (temperature?: number) => void
  setShowWordList: (show: boolean) => void
  setShowDetailedExplanation: (show: boolean) => void
  setShowNuanceExplanation: (show: boolean) => void
  setOutputFormat: (format: OutputFormat) => void
  reset: () => void
  // Helper getter for current provider's API key
  getApiKey: () => string
}

const defaultApiKeys: Record<LLMProvider, string> = {
  groq: '',
  gemini: '',
  cerebras: '',
  openai: '',
  grok: '',
}

const defaultSettings: TranslationSettings = {
  sourceLanguage: 'japanese',
  targetLanguage: 'english',
  provider: 'groq',
  apiKeys: { ...defaultApiKeys },
  customEndpoint: undefined,
  model: undefined,
  temperature: 0.7,
  showWordList: true,
  showDetailedExplanation: true,
  showNuanceExplanation: true,
  outputFormat: 'full',
}

export function computeOutputFormat(
  showWordList: boolean,
  showDetailedExplanation: boolean,
  showNuanceExplanation: boolean
): OutputFormat {
  if (showWordList && !showDetailedExplanation && !showNuanceExplanation) return 'word'
  if (!showWordList && showDetailedExplanation && !showNuanceExplanation) return 'sentence'
  if (showWordList && showDetailedExplanation && showNuanceExplanation) return 'full'
  return 'custom'
}

const safeStorage = createJSONStorage(() => {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => { },
      removeItem: () => { },
    }
  }

  const storage = window.localStorage
  const MAX_SIZE = 5 * 1024 * 1024 // 5MB

  return {
    getItem: (name: string) => {
      try {
        const value = storage.getItem(name)
        if (!value) return null

        // Migration: convert old apiKey to apiKeys
        try {
          const parsed = JSON.parse(value)
          if (parsed.state && typeof parsed.state.apiKey === 'string' && !parsed.state.apiKeys) {
            // Old format detected, migrate to new format
            const oldApiKey = parsed.state.apiKey
            const provider = parsed.state.provider || 'groq'
            parsed.state.apiKeys = { ...defaultApiKeys, [provider]: oldApiKey }
            delete parsed.state.apiKey
            const migratedValue = JSON.stringify(parsed)
            storage.setItem(name, migratedValue)
            return migratedValue
          }
        } catch {
          // JSON parse failed, return original
        }

        return value
      } catch (error) {
        console.error('Error reading from localStorage:', error)
        return null
      }
    },
    setItem: (name: string, value: string) => {
      try {
        if (value.length > MAX_SIZE) {
          console.warn('Data too large for localStorage')
          return
        }

        storage.setItem(name, value)
      } catch (error) {
        console.error('Error writing to localStorage:', error)
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.warn('Storage quota exceeded, clearing history')
          try {
            storage.removeItem(name)
          } catch (e) {
            console.error('Failed to clear history:', e)
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

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...defaultSettings,
      setSourceLanguage: (sourceLanguage) => set({ sourceLanguage }),
      setTargetLanguage: (targetLanguage) => set({ targetLanguage }),
      setProvider: (provider) => set({ provider }),
      setApiKey: (apiKey) =>
        set((state) => ({
          apiKeys: {
            ...state.apiKeys,
            [state.provider]: apiKey,
          },
        })),
      setCustomEndpoint: (customEndpoint) => set({ customEndpoint }),
      setModel: (model) => set({ model }),
      setTemperature: (temperature) => set({ temperature }),
      setShowWordList: (showWordList) =>
        set((state) => ({
          showWordList,
          outputFormat: computeOutputFormat(
            showWordList,
            state.showDetailedExplanation,
            state.showNuanceExplanation
          ),
        })),
      setShowDetailedExplanation: (showDetailedExplanation) =>
        set((state) => ({
          showDetailedExplanation,
          outputFormat: computeOutputFormat(
            state.showWordList,
            showDetailedExplanation,
            state.showNuanceExplanation
          ),
        })),
      setShowNuanceExplanation: (showNuanceExplanation) =>
        set((state) => ({
          showNuanceExplanation,
          outputFormat: computeOutputFormat(
            state.showWordList,
            state.showDetailedExplanation,
            showNuanceExplanation
          ),
        })),
      setOutputFormat: (outputFormat) =>
        set(() => {
          if (outputFormat === 'word') {
            return {
              outputFormat,
              showWordList: true,
              showDetailedExplanation: false,
              showNuanceExplanation: false,
            }
          }
          if (outputFormat === 'sentence') {
            return {
              outputFormat,
              showWordList: false,
              showDetailedExplanation: true,
              showNuanceExplanation: false,
            }
          }
          if (outputFormat === 'full') {
            return {
              outputFormat,
              showWordList: true,
              showDetailedExplanation: true,
              showNuanceExplanation: true,
            }
          }
          return { outputFormat }
        }),
      reset: () => set(defaultSettings),
      getApiKey: () => {
        const state = get()
        return state.apiKeys[state.provider] || ''
      },
    }),
    {
      name: 'translation-settings',
      storage: safeStorage,
      partialize: (state) => ({
        sourceLanguage: state.sourceLanguage,
        targetLanguage: state.targetLanguage,
        provider: state.provider,
        apiKeys: state.apiKeys,
        customEndpoint: state.customEndpoint,
        model: state.model,
        temperature: state.temperature,
        showWordList: state.showWordList,
        showDetailedExplanation: state.showDetailedExplanation,
        showNuanceExplanation: state.showNuanceExplanation,
        outputFormat: state.outputFormat,
      }),
    }
  )
)

// Convenience function for getting API key from settings object
export function getApiKeyForProvider(settings: TranslationSettings): string {
  return settings.apiKeys[settings.provider] || ''
}
