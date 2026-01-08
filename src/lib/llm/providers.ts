import { LLMProvider } from '@/store/settingsStore'

export interface LLMResponse {
  translation: string
  words?: Array<{ 
    original: string
    translated: string
    meaning?: string
  }> 
  detailedExplanation?: {
    structure_diagram?: string
    key_points?: Array<{ 
      point: string, 
      segment: string, // Exact phrase being explained
      explanation: string 
    }>
    politeness_level?: string
  }
  nuanceExplanation?: {
    tone?: string
    cultural_context?: string
    better_choices?: Array<{ 
      phrase: string, 
      original_segment: string, // The current phrase being improved
      reason: string 
    }>
  }
}

export interface LLMAnalysis {
  words?: Array<{ 
    original: string
    translated: string
    meaning?: string
  }>
  detailedExplanation?: {
    structure_diagram?: string
    key_points?: Array<{ 
      point: string, 
      segment: string, 
      explanation: string 
    }>
    politeness_level?: string
  }
  nuanceExplanation?: {
    tone?: string
    cultural_context?: string
    better_choices?: Array<{ 
      phrase: string, 
      original_segment: string, 
      reason: string 
    }>
  }
}

export interface LLMConfig {
  apiKey: string
  model?: string
  customEndpoint?: string
  temperature?: number
}

const API_TIMEOUT = 60000 // Extended timeout for analysis

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
}

const LANGUAGE_LABELS: Record<string, string> = {
  japanese: 'Japanese',
  english: 'English',
  russian: 'Russian',
  chinese: 'Chinese',
  korean: 'Korean',
  spanish: 'Spanish',
}

function formatLanguageLabel(language: string): string {
  return LANGUAGE_LABELS[language] ?? language
}

function extractJsonObject(text: string): string | null {
  const startIndex = text.indexOf('{')
  const lastIndex = text.lastIndexOf('}')
  if (startIndex === -1 || lastIndex === -1) return null
  return text.slice(startIndex, lastIndex + 1)
}

export class LLMError extends Error {
  status?: number
  provider: string

  constructor(message: string, provider: string, status?: number) {
    super(message)
    this.name = 'LLMError'
    this.provider = provider
    this.status = status
  }
}

export class LLMProviderBase {
  protected config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  // Phase 1: Pure Translation
  async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    signal?: AbortSignal
  ): Promise<string> {
    throw new Error('Method not implemented.')
  }

  // Phase 2: Deep Analysis (Granular)
  async analyzeSpecific(
    sourceText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string,
    explanationLanguage: string,
    type: 'vocabulary' | 'grammar' | 'nuance',
    signal?: AbortSignal
  ): Promise<LLMAnalysis> {
    throw new Error('Method not implemented.')
  }

  // Phase 2: Deep Analysis (Full) - For compatibility
  async analyzeTranslation(
    sourceText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string,
    explanationLanguage: string,
    signal?: AbortSignal
  ): Promise<LLMAnalysis> {
    throw new Error('Method not implemented.')
  }

  // Legacy compatibility wrapper
  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    showWordList: boolean,
    showDetailedExplanation: boolean,
    showNuanceExplanation: boolean,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const translation = await this.translateText(text, sourceLanguage, targetLanguage, signal)
    return { translation }
  }

  protected generateTranslationPrompt(
    sourceLanguage: string,
    targetLanguage: string
  ): string {
    const from = formatLanguageLabel(sourceLanguage)
    const to = formatLanguageLabel(targetLanguage)
    return `You are an expert professional translator. Translate the user's text from ${from} to ${to}.
    
Rules:
1. Preserve the original tone, style, and formatting (line breaks).
2. Do not add any introductory or concluding remarks. Output ONLY the translation.
3. Ensure natural, native-level phrasing in ${to}.`
  }

  protected generateSpecificAnalysisPrompt(
    sourceLanguage: string,
    targetLanguage: string,
    explanationLanguage: string,
    type: 'vocabulary' | 'grammar' | 'nuance'
  ): string {
    const from = formatLanguageLabel(sourceLanguage)
    const to = formatLanguageLabel(targetLanguage)
    const explanationLang = formatLanguageLabel(explanationLanguage)
    
    let instruction = ''
    let jsonStructure = ''

    if (type === 'vocabulary') {
      instruction = `Extract 10-20 key lexical items (nouns, verbs in base form, adjectives, or fixed idioms) strictly from the source text.
      Rules for 'words' array:
      - 'original': The exact word or idiom from the source text. Do NOT include surrounding context, particles, or punctuation.
      - 'translated': The most accurate direct translation of the 'original' word into ${to}. 
      - 'meaning': A brief explanation in ${explanationLang} of how this word is being used in this specific context.
      Ensure the list is clean and contains no duplicates or full phrases.`
      
      jsonStructure = `"words": [ { "original": "isolated_source_word", "translated": "direct_translation", "meaning": "contextual explanation in ${explanationLang}" } ]`
    } else if (type === 'grammar') {
      instruction = `Provide an essential linguistic and syntactic analysis of the text.
      1. 'structure_diagram': A clear syntactic map showing how the source sentence is logically constructed (e.g., S-V-O mapping or head-initial/final structure).
      2. 'key_points': Analyze actual grammatical rules. Quote the **${from} (Source Text)** in 'segment'. Explain its linguistic role (e.g., tense, case marking, clause subordination, or part-of-speech function) and how that logic is mapped into ${explanationLang}. Do not explain your translation choices; explain the grammar of the languages.
      3. 'politeness_level': Define the specific socio-linguistic register (e.g., honorary, humble, peer-to-peer, professional).
      Provide all explanations in ${explanationLang}.`
      
      jsonStructure = `"detailedExplanation": {
        "structure_diagram": "logical syntax map",
        "key_points": [ { "point": "grammatical concept", "segment": "quote from source", "explanation": "linguistic rule explanation in ${explanationLang}" } ],
        "politeness_level": "register description in ${explanationLang}"
      }`
    } else if (type === 'nuance') {
      instruction = `Perform a high-fidelity contextual and emotional decoding.
      1. 'tone': Identify the specific emotional frequency and speaker's intent within the context of the situation described in the text.
      2. 'cultural_context': Decode the setting and situational norms of the **SOURCE text**. Focus on the world of the original author.
      3. 'better_choices': Suggest 1-2 refinements that better capture the original's 'soul'. Quote the 'original_segment' and explain the precise atmospheric difference in 'reason'.
      Provide all explanations in ${explanationLang}.`
      
      jsonStructure = `"nuanceExplanation": {
        "tone": "contextual intent analysis in ${explanationLang}",
        "cultural_context": "situational decoding based on source setting in ${explanationLang}",
        "better_choices": [ { "phrase": "refined alternative", "original_segment": "part of current result", "reason": "why this fits the specific situation better in ${explanationLang}" } ]
      }`
    }

    return `You are a linguistic expert. Analyze the translation from ${from} to ${to}.
    
Task: ${instruction}

Provide the output in strict JSON format:
{
  ${jsonStructure}
}

Return ONLY valid JSON.`
  }

  protected generateAnalysisPrompt(
    sourceLanguage: string,
    targetLanguage: string
  ): string {
    const from = formatLanguageLabel(sourceLanguage)
    const to = formatLanguageLabel(targetLanguage)
    return `Analyze the translation from ${from} to ${to}. Provide words, detailedExplanation, and nuanceExplanation in JSON.`
  }

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number = API_TIMEOUT,
    externalSignal?: AbortSignal
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    const handleAbort = () => controller.abort()

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort()
      } else {
        externalSignal.addEventListener('abort', handleAbort, { once: true })
      }
    }

    try {
      const response = await fetch(url,
        {
          ...options,
          signal: controller.signal,
        }
      )
      clearTimeout(timeoutId)
      if (externalSignal) {
        externalSignal.removeEventListener('abort', handleAbort)
      }
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      if (externalSignal) {
        externalSignal.removeEventListener('abort', handleAbort)
      }
      throw error
    }
  }

  protected parseAnalysisResponse(content: string): LLMAnalysis {
    try {
      let cleaned = content.trim()
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
      }
      return JSON.parse(cleaned)
    } catch (e) {
      const extracted = extractJsonObject(content)
      if (extracted) {
        try { return JSON.parse(extracted) } catch { }
      }
      return {}
    }
  }

  protected async handleAPIError(response: Response, providerName: string): Promise<never> {
    let details = ''
    try { details = await response.text() } catch { }
    const message = `${providerName} API Error: ${response.status} ${response.statusText} - ${details}`
    throw new LLMError(message, providerName, response.status)
  }
}

export function createLLMProvider(provider: LLMProvider, config: LLMConfig): LLMProviderBase {
  switch (provider) {
    case 'groq': return new GroqProvider(config)
    case 'gemini': return new GeminiProvider(config)
    case 'cerebras': return new CerebrasProvider(config)
    case 'openai': return new OpenAIProvider(config)
    case 'grok': return new GrokProvider(config)
    default: throw new Error(`Unsupported provider: ${provider}`)
  }
}

class GroqProvider extends LLMProviderBase {
  private endpoint = 'https://api.groq.com/openai/v1/chat/completions'

  async translateText(text: string, source: string, target: string, signal?: AbortSignal): Promise<string> {
    const model = this.config.model || 'llama-3.3-70b-versatile'
    const prompt = this.generateTranslationPrompt(source, target)
    const res = await this.callApi(model, [{ role: 'system', content: prompt }, { role: 'user', content: text }], false, signal)
    return res.choices?.[0]?.message?.content || ''
  }

  async analyzeSpecific(sourceText: string, translatedText: string, source: string, target: string, explanationLanguage: string, type: 'vocabulary' | 'grammar' | 'nuance', signal?: AbortSignal): Promise<LLMAnalysis> {
    const model = this.config.model || 'llama-3.3-70b-versatile'
    const prompt = this.generateSpecificAnalysisPrompt(source, target, explanationLanguage, type)
    const content = `Source:\n${sourceText}\n\nTranslation:\n${translatedText}`
    const res = await this.callApi(model, [{ role: 'system', content: prompt }, { role: 'user', content }], true, signal)
    return this.parseAnalysisResponse(res.choices?.[0]?.message?.content || '{}')
  }

  async analyzeTranslation(sourceText: string, translatedText: string, source: string, target: string, explanationLanguage: string, signal?: AbortSignal): Promise<LLMAnalysis> {
    const model = this.config.model || 'llama-3.3-70b-versatile'
    const prompt = this.generateAnalysisPrompt(source, target)
    const content = `Source:\n${sourceText}\n\nTranslation:\n${translatedText}`
    const res = await this.callApi(model, [{ role: 'system', content: prompt }, { role: 'user', content }], true, signal)
    return this.parseAnalysisResponse(res.choices?.[0]?.message?.content || '{}')
  }

  private async callApi(model: string, messages: any[], jsonMode: boolean, signal?: AbortSignal) {
    const url = this.config.customEndpoint || this.endpoint
    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { ...DEFAULT_HEADERS, 'Authorization': `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({
        model, messages, temperature: this.config.temperature ?? 0.3,
        response_format: jsonMode ? { type: 'json_object' } : undefined
      })
    }, API_TIMEOUT, signal)
    if (!res.ok) await this.handleAPIError(res, 'Groq')
    return await res.json()
  }
}

class GeminiProvider extends LLMProviderBase {
  async translateText(text: string, source: string, target: string, signal?: AbortSignal): Promise<string> {
    const model = this.config.model || 'gemini-2.5-flash'
    const systemPrompt = this.generateTranslationPrompt(source, target)
    return await this.callGemini(model, systemPrompt, text, false, signal)
  }

  async analyzeSpecific(sourceText: string, translatedText: string, source: string, target: string, explanationLanguage: string, type: 'vocabulary' | 'grammar' | 'nuance', signal?: AbortSignal): Promise<LLMAnalysis> {
    const model = this.config.model || 'gemini-2.5-flash'
    const systemPrompt = this.generateSpecificAnalysisPrompt(source, target, explanationLanguage, type)
    const content = `Source:\n${sourceText}\n\nTarget:\n${translatedText}`
    const result = await this.callGemini(model, systemPrompt, content, true, signal)
    return this.parseAnalysisResponse(result)
  }

  async analyzeTranslation(sourceText: string, translatedText: string, source: string, target: string, explanationLanguage: string, signal?: AbortSignal): Promise<LLMAnalysis> {
    const model = this.config.model || 'gemini-2.5-flash'
    const systemPrompt = this.generateAnalysisPrompt(source, target)
    const content = `Source:\n${sourceText}\n\nTarget:\n${translatedText}`
    const result = await this.callGemini(model, systemPrompt, content, true, signal)
    return this.parseAnalysisResponse(result)
  }

  private async callGemini(model: string, systemPrompt: string, userText: string, jsonMode: boolean, signal?: AbortSignal) {
    const endpoint = this.config.customEndpoint || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const url = new URL(endpoint)
    url.searchParams.set('key', this.config.apiKey)
    const body = {
      contents: [{ parts: [{ text: userText }] }],
      system_instruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: this.config.temperature ?? 0.3,
        responseMimeType: jsonMode ? 'application/json' : 'text/plain'
      }
    }
    const res = await this.fetchWithTimeout(url.toString(), {
      method: 'POST', headers: DEFAULT_HEADERS, body: JSON.stringify(body)
    }, API_TIMEOUT, signal)
    if (!res.ok) await this.handleAPIError(res, 'Gemini')
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }
}

class CerebrasProvider extends LLMProviderBase {
  private endpoint = 'https://api.cerebras.ai/v1/chat/completions'
  async translateText(text: string, source: string, target: string, signal?: AbortSignal): Promise<string> {
    const model = this.config.model || 'gpt-oss-120b'
    const prompt = this.generateTranslationPrompt(source, target)
    const res = await this.callApi(model, [{ role: 'system', content: prompt }, { role: 'user', content: text }], false, signal)
    return res.choices?.[0]?.message?.content || ''
  }
  async analyzeSpecific(sourceText: string, translatedText: string, source: string, target: string, explanationLanguage: string, type: 'vocabulary' | 'grammar' | 'nuance', signal?: AbortSignal): Promise<LLMAnalysis> {
    const model = this.config.model || 'gpt-oss-120b'
    const prompt = this.generateSpecificAnalysisPrompt(source, target, explanationLanguage, type)
    const content = `Source:\n${sourceText}\n\nTarget:\n${translatedText}`
    const res = await this.callApi(model, [{ role: 'system', content: prompt }, { role: 'user', content }], true, signal)
    return this.parseAnalysisResponse(res.choices?.[0]?.message?.content || '{}')
  }
  async analyzeTranslation(sourceText: string, translatedText: string, source: string, target: string, explanationLanguage: string, signal?: AbortSignal): Promise<LLMAnalysis> {
    const model = this.config.model || 'gpt-oss-120b'
    const prompt = this.generateAnalysisPrompt(source, target)
    const content = `Source:\n${sourceText}\n\nTarget:\n${translatedText}`
    const res = await this.callApi(model, [{ role: 'system', content: prompt }, { role: 'user', content }], true, signal)
    return this.parseAnalysisResponse(res.choices?.[0]?.message?.content || '{}')
  }
  private async callApi(model: string, messages: any[], jsonMode: boolean, signal?: AbortSignal) {
    const url = this.config.customEndpoint || this.endpoint
    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { ...DEFAULT_HEADERS, 'Authorization': `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({
        model, messages, temperature: this.config.temperature ?? 0.3,
        response_format: jsonMode ? { type: 'json_object' } : undefined
      })
    }, API_TIMEOUT, signal)
    if (!res.ok) await this.handleAPIError(res, 'Cerebras')
    return await res.json()
  }
}

class OpenAIProvider extends LLMProviderBase {
  private endpoint = 'https://api.openai.com/v1/chat/completions'
  async translateText(text: string, source: string, target: string, signal?: AbortSignal): Promise<string> {
    const model = this.config.model || 'gpt-4o'
    const prompt = this.generateTranslationPrompt(source, target)
    const res = await this.callApi(model, [{ role: 'system', content: prompt }, { role: 'user', content: text }], false, signal)
    return res.choices?.[0]?.message?.content || ''
  }
  async analyzeSpecific(sourceText: string, translatedText: string, source: string, target: string, explanationLanguage: string, type: 'vocabulary' | 'grammar' | 'nuance', signal?: AbortSignal): Promise<LLMAnalysis> {
    const model = this.config.model || 'gpt-4o'
    const prompt = this.generateSpecificAnalysisPrompt(source, target, explanationLanguage, type)
    const content = `Source:\n${sourceText}\n\nTarget:\n${translatedText}`
    const res = await this.callApi(model, [{ role: 'system', content: prompt }, { role: 'user', content }], true, signal)
    return this.parseAnalysisResponse(res.choices?.[0]?.message?.content || '{}')
  }
  async analyzeTranslation(sourceText: string, translatedText: string, source: string, target: string, explanationLanguage: string, signal?: AbortSignal): Promise<LLMAnalysis> {
    const model = this.config.model || 'gpt-4o'
    const prompt = this.generateAnalysisPrompt(source, target)
    const content = `Source:\n${sourceText}\n\nTarget:\n${translatedText}`
    const res = await this.callApi(model, [{ role: 'system', content: prompt }, { role: 'user', content }], true, signal)
    return this.parseAnalysisResponse(res.choices?.[0]?.message?.content || '{}')
  }
  private async callApi(model: string, messages: any[], jsonMode: boolean, signal?: AbortSignal) {
    const url = this.config.customEndpoint || this.endpoint
    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { ...DEFAULT_HEADERS, 'Authorization': `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({
        model, messages, temperature: this.config.temperature ?? 0.3,
        response_format: jsonMode ? { type: 'json_object' } : undefined
      })
    }, API_TIMEOUT, signal)
    if (!res.ok) await this.handleAPIError(res, 'OpenAI')
    return await res.json()
  }
}

class GrokProvider extends LLMProviderBase {
  private endpoint = 'https://api.x.ai/v1/chat/completions'
  async translateText(text: string, source: string, target: string, signal?: AbortSignal): Promise<string> {
    const model = this.config.model || 'grok-beta'
    const prompt = this.generateTranslationPrompt(source, target)
    const res = await this.callApi(model, [{ role: 'system', content: prompt }, { role: 'user', content: text }], false, signal)
    return res.choices?.[0]?.message?.content || ''
  }
  async analyzeSpecific(sourceText: string, translatedText: string, source: string, target: string, explanationLanguage: string, type: 'vocabulary' | 'grammar' | 'nuance', signal?: AbortSignal): Promise<LLMAnalysis> {
    const model = this.config.model || 'grok-beta'
    const prompt = this.generateSpecificAnalysisPrompt(source, target, explanationLanguage, type)
    const content = `Source:\n${sourceText}\n\nTarget:\n${translatedText}`
    const res = await this.callApi(model, [{ role: 'system', content: prompt }, { role: 'user', content }], true, signal)
    return this.parseAnalysisResponse(res.choices?.[0]?.message?.content || '{}')
  }
  async analyzeTranslation(sourceText: string, translatedText: string, source: string, target: string, explanationLanguage: string, signal?: AbortSignal): Promise<LLMAnalysis> {
    const model = this.config.model || 'grok-beta'
    const prompt = this.generateAnalysisPrompt(source, target)
    const content = `Source:\n${sourceText}\n\nTarget:\n${translatedText}`
    const res = await this.callApi(model, [{ role: 'system', content: prompt }, { role: 'user', content }], true, signal)
    return this.parseAnalysisResponse(res.choices?.[0]?.message?.content || '{}')
  }
  private async callApi(model: string, messages: any[], jsonMode: boolean, signal?: AbortSignal) {
    const url = this.config.customEndpoint || this.endpoint
    const body: any = { model, messages, temperature: this.config.temperature ?? 0.3 }
    if (jsonMode) body.response_format = { type: 'json_object' }
    const res = await this.fetchWithTimeout(url, {
      method: 'POST', headers: { ...DEFAULT_HEADERS, 'Authorization': `Bearer ${this.config.apiKey}` },
      body: JSON.stringify(body)
    }, API_TIMEOUT, signal)
    if (!res.ok) await this.handleAPIError(res, 'Grok')
    return await res.json()
  }
}
