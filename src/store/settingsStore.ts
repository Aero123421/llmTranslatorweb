import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type LLMProvider = 'groq' | 'gemini' | 'cerebras' | 'openai' | 'grok'

export type Language = 'japanese' | 'english' | 'russian' | 'chinese' | 'korean' | 'spanish'

export type OutputFormat = 'word' | 'sentence' | 'full' | 'custom'

export interface RoutingStep {
  provider: LLMProvider
  model: string
}

export interface TranslationSettings {
  sourceLanguage: Language
  targetLanguage: Language
  explanationLanguage: Language | 'auto'
  provider: LLMProvider
  model?: string
  routingSteps: RoutingStep[]
  routingCount: number
  apiKeys: Record<LLMProvider, string>
  customEndpoint?: string
  temperature?: number
  speechRate: number
  speechPitch: number
  // Voice preferences
  voicePreferences: Record<Language, string | undefined>
  englishUkVoiceName?: string // Special case for UK English
  showWordList: boolean
  showDetailedExplanation: boolean
  showNuanceExplanation: boolean
  outputFormat: OutputFormat
}

interface SettingsStore extends TranslationSettings {
  setSourceLanguage: (language: Language) => void
  setTargetLanguage: (language: Language) => void
  setExplanationLanguage: (language: Language | 'auto') => void
  setProvider: (provider: LLMProvider) => void
  setModel: (model?: string) => void
  setRoutingCount: (count: number) => void
  setRoutingStep: (index: number, step: Partial<RoutingStep>) => void
  setApiKey: (apiKey: string) => void
  setApiKeys: (apiKeys: Record<LLMProvider, string>) => void
  setCustomEndpoint: (endpoint?: string) => void
  setTemperature: (temperature?: number) => void
  setSpeechRate: (rate: number) => void
  setSpeechPitch: (pitch: number) => void
  setVoicePreference: (lang: Language, voiceName?: string) => void
  setEnglishUkVoice: (voiceName?: string) => void
  setShowWordList: (show: boolean) => void
  setShowDetailedExplanation: (show: boolean) => void
  setShowNuanceExplanation: (show: boolean) => void
  setOutputFormat: (format: OutputFormat) => void
  reset: () => void
  getApiKey: () => string
}

const defaultApiKeys: Record<LLMProvider, string> = {
  groq: '', gemini: '', cerebras: '', openai: '', grok: '',
}

const defaultRoutingSteps: RoutingStep[] = [
  { provider: 'gemini', model: 'gemini-2.5-flash' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { provider: 'openai', model: 'gpt-4o' },
  { provider: 'grok', model: 'grok-beta' },
  { provider: 'cerebras', model: 'gpt-oss-120b' },
]

const defaultSettings: TranslationSettings = {
  sourceLanguage: 'japanese',
  targetLanguage: 'english',
  explanationLanguage: 'auto',
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  routingSteps: [...defaultRoutingSteps],
  routingCount: 1,
  apiKeys: { ...defaultApiKeys },
  customEndpoint: undefined,
  temperature: 0.7,
  speechRate: 1.0,
  speechPitch: 1.0,
  voicePreferences: {
    japanese: undefined,
    english: undefined,
    russian: undefined,
    chinese: undefined,
    korean: undefined,
    spanish: undefined,
  },
  englishUkVoiceName: undefined,
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
  if (typeof window === 'undefined') return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  return window.localStorage
})

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...defaultSettings,
      setSourceLanguage: (sourceLanguage) => set({ sourceLanguage }),
      setTargetLanguage: (targetLanguage) => set({ targetLanguage }),
      setExplanationLanguage: (explanationLanguage) => set({ explanationLanguage }),
      setProvider: (provider) => set((state) => {
        const newSteps = [...state.routingSteps]
        newSteps[0] = { ...newSteps[0], provider }
        return { provider, routingSteps: newSteps }
      }),
      setModel: (model) => set((state) => {
        const newSteps = [...state.routingSteps]
        if (model) newSteps[0] = { ...newSteps[0], model }
        return { model, routingSteps: newSteps }
      }),
      setRoutingCount: (routingCount) => set({ routingCount }),
      setRoutingStep: (index, step) => set((state) => {
        const newSteps = [...state.routingSteps]
        newSteps[index] = { ...newSteps[index], ...step }
        if (index === 0) return { routingSteps: newSteps, provider: newSteps[0].provider, model: newSteps[0].model }
        return { routingSteps: newSteps }
      }),
      setApiKey: (apiKey) => set((state) => ({ apiKeys: { ...state.apiKeys, [state.provider]: apiKey } })),
      setApiKeys: (apiKeys) => set(() => ({ apiKeys: { ...defaultApiKeys, ...apiKeys } })),
      setCustomEndpoint: (customEndpoint) => set({ customEndpoint }),
      setTemperature: (temperature) => set({ temperature }),
      setSpeechRate: (speechRate) => set({ speechRate }),
      setSpeechPitch: (speechPitch) => set({ speechPitch }),
      setVoicePreference: (lang, voiceName) => set((state) => ({
        voicePreferences: { ...state.voicePreferences, [lang]: voiceName }
      })),
      setEnglishUkVoice: (voiceName) => set({ englishUkVoiceName: voiceName }),
      setShowWordList: (showWordList) => set((state) => ({ showWordList, outputFormat: computeOutputFormat(showWordList, state.showDetailedExplanation, state.showNuanceExplanation) })),
      setShowDetailedExplanation: (showDetailedExplanation) => set((state) => ({ showDetailedExplanation, outputFormat: computeOutputFormat(state.showWordList, showDetailedExplanation, state.showNuanceExplanation) })),
      setShowNuanceExplanation: (showNuanceExplanation) => set((state) => ({ showNuanceExplanation, outputFormat: computeOutputFormat(state.showWordList, state.showDetailedExplanation, showNuanceExplanation) })),
      setOutputFormat: (outputFormat) => set((state) => {
        if (outputFormat === 'word') return { outputFormat, showWordList: true, showDetailedExplanation: false, showNuanceExplanation: false }
        if (outputFormat === 'sentence') return { outputFormat, showWordList: false, showDetailedExplanation: true, showNuanceExplanation: false }
        if (outputFormat === 'full') return { outputFormat, showWordList: true, showDetailedExplanation: true, showNuanceExplanation: true }
        return { outputFormat }
      }),
      reset: () => set(defaultSettings),
      getApiKey: () => get().apiKeys[get().provider] || '',
    }),
    {
      name: 'translation-settings',
      storage: safeStorage,
    }
  )
)
