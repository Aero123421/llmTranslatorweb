import { LLMProvider } from '@/store/settingsStore'

export interface LLMResponse {
  translation: string
  words?: Array<{
    original: string
    translated: string
    meaning?: string
  }>
  detailedExplanation?: string
  nuanceExplanation?: string
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMConfig {
  apiKey: string
  model?: string
  customEndpoint?: string
  temperature?: number
}

const API_TIMEOUT = 30000

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

// Fallback models for rate limit handling (in priority order)
// These providers support automatic routing when rate limited
const FALLBACK_MODELS: Record<string, string[]> = {
  // Gemini: try different flash variants
  gemini: ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  // Groq: try different models (only valid Groq models)
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-70b-8192'],
  // Cerebras: try different models
  cerebras: ['llama-3.3-70b', 'llama3.1-8b'],
}

const MAX_RATE_LIMIT_RETRIES = 2
const RATE_LIMIT_RETRY_DELAY = 1000 // 1 second base delay

export class LLMProviderBase {
  protected config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    showWordList: boolean,
    showDetailedExplanation: boolean,
    showNuanceExplanation: boolean,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    throw new Error('Method not implemented')
  }

  protected generateSystemPrompt(
    sourceLanguage: string,
    targetLanguage: string,
    showWordList: boolean,
    showDetailedExplanation: boolean,
    showNuanceExplanation: boolean
  ): string {
    const fromLabel = formatLanguageLabel(sourceLanguage)
    const toLabel = formatLanguageLabel(targetLanguage)
    let prompt = `You are a professional translator. Translate the following text from ${fromLabel} to ${toLabel}.`

    if (showWordList || showDetailedExplanation || showNuanceExplanation) {
      const parts: string[] = [
        '"translation": "the translated text"',
      ]

      if (showWordList) {
        parts.push(
          `"words": [
    {
      "original": "original word",
      "translated": "translated word",
      "meaning": "brief meaning of the word (optional)"
    }
  ]`
        )
      }

      if (showDetailedExplanation) {
        parts.push('"detailedExplanation": "detailed explanation of the translation choices, grammar notes, and cultural context"')
      }

      if (showNuanceExplanation) {
        parts.push('"nuanceExplanation": "explanation of subtle meanings, tone, and connotations in both languages"')
      }

      prompt += ' Provide the response in JSON format with the following structure. Return only valid JSON with no extra commentary:'
      prompt += `
{
  ${parts.join(',\n  ')}
}`
    }

    return prompt
  }

  protected createAbortController(): AbortController {
    return new AbortController()
  }

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number = API_TIMEOUT,
    externalSignal?: AbortSignal
  ): Promise<Response> {
    const controller = this.createAbortController()
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
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
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
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (externalSignal?.aborted) {
          throw error
        }
        throw new Error('Request timeout. Please try again.')
      }
      throw error
    }
  }

  protected parseResponse(
    content: string
  ): LLMResponse {
    try {
      const parsed = JSON.parse(content)

      if (!parsed.translation) {
        console.warn('Parsed response missing translation field:', parsed)
        return { translation: content }
      }

      return parsed
    } catch (error) {
      console.warn('Failed to parse JSON response:', error)
      if (!content) {
        throw new Error('Empty response received from API')
      }
      return { translation: content }
    }
  }

  protected handleAPIError(
    response: Response,
    providerName: string
  ): never {
    let errorMessage = `${providerName} API error`

    if (response.status === 401) {
      errorMessage = 'Invalid API key. Please check your settings.'
    } else if (response.status === 429) {
      errorMessage = 'Rate limit exceeded. Please try again later.'
    } else if (response.status >= 500) {
      errorMessage = 'Server error. Please try again later.'
    } else {
      errorMessage = `${providerName} API error: ${response.status} ${response.statusText}`
    }

    throw new Error(errorMessage)
  }

  protected async getResponseBody(response: Response): Promise<any> {
    try {
      return await response.json()
    } catch {
      const text = await response.text()
      console.error('Failed to parse response as JSON:', text)
      throw new Error('Invalid response format')
    }
  }
}

export function createLLMProvider(provider: LLMProvider, config: LLMConfig): LLMProviderBase {
  switch (provider) {
    case 'groq':
      return new GroqProvider(config)
    case 'gemini':
      return new GeminiProvider(config)
    case 'cerebras':
      return new CerebrasProvider(config)
    case 'openai':
      return new OpenAIProvider(config)
    case 'grok':
      return new GrokProvider(config)
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

class GroqProvider extends LLMProviderBase {
  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    showWordList: boolean,
    showDetailedExplanation: boolean,
    showNuanceExplanation: boolean,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const endpoint = this.config.customEndpoint || 'https://api.groq.com/openai/v1/chat/completions'
    const requestedModel = this.config.model || 'llama-3.3-70b-versatile'

    const systemPrompt = this.generateSystemPrompt(
      sourceLanguage,
      targetLanguage,
      showWordList,
      showDetailedExplanation,
      showNuanceExplanation
    )

    // Build model fallback list for rate limiting
    const fallbackModels = FALLBACK_MODELS.groq.filter(m => m !== requestedModel)
    const modelsToTry = [requestedModel, ...fallbackModels]

    let lastError: Error | null = null

    for (let i = 0; i < modelsToTry.length && i <= MAX_RATE_LIMIT_RETRIES; i++) {
      const model = modelsToTry[i]

      try {
        const response = await this.fetchWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: {
              ...DEFAULT_HEADERS,
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'system',
                  content: systemPrompt,
                },
                {
                  role: 'user',
                  content: text,
                },
              ],
              temperature: this.config.temperature ?? 0.7,
              response_format: showWordList || showDetailedExplanation || showNuanceExplanation ? { type: 'json_object' } : undefined,
            }),
          },
          API_TIMEOUT,
          signal
        )

        if (response.status === 429 && i < modelsToTry.length - 1) {
          // Rate limited, try next model after a short delay
          console.warn(`Groq rate limited on ${model}, trying fallback...`)
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_RETRY_DELAY * (i + 1)))
          continue
        }

        if (!response.ok) {
          this.handleAPIError(response, 'Groq')
        }

        const data = await this.getResponseBody(response)
        const content = data.choices?.[0]?.message?.content || ''

        if (!content) {
          throw new Error('No content received from API')
        }

        return this.parseResponse(content)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (i >= modelsToTry.length - 1 || i >= MAX_RATE_LIMIT_RETRIES) {
          throw lastError
        }
      }
    }

    throw lastError || new Error('All Groq models failed')
  }
}

class GeminiProvider extends LLMProviderBase {
  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    showWordList: boolean,
    showDetailedExplanation: boolean,
    showNuanceExplanation: boolean,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const requestedModel = this.config.model || 'gemini-2.0-flash-exp'

    const systemPrompt = this.generateSystemPrompt(
      sourceLanguage,
      targetLanguage,
      showWordList,
      showDetailedExplanation,
      showNuanceExplanation
    )

    // Build model fallback list for rate limiting
    const fallbackModels = FALLBACK_MODELS.gemini.filter(m => m !== requestedModel)
    const modelsToTry = [requestedModel, ...fallbackModels]

    let lastError: Error | null = null

    for (let i = 0; i < modelsToTry.length && i <= MAX_RATE_LIMIT_RETRIES; i++) {
      const model = modelsToTry[i]
      const endpoint = this.config.customEndpoint || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

      const body: Record<string, any> = {
        contents: [
          {
            parts: [
              {
                text,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: this.config.temperature ?? 0.7,
          responseMimeType: showWordList || showDetailedExplanation || showNuanceExplanation ? 'application/json' : 'text/plain',
        },
      }

      // Add system instruction if available
      if (systemPrompt) {
        body.systemInstruction = {
          parts: [
            {
              text: systemPrompt,
            },
          ],
        }
      }

      const url = new URL(endpoint)
      url.searchParams.set('key', this.config.apiKey)

      try {
        const response = await this.fetchWithTimeout(
          url.toString(),
          {
            method: 'POST',
            headers: DEFAULT_HEADERS,
            body: JSON.stringify(body),
          },
          API_TIMEOUT,
          signal
        )

        if (response.status === 429 && i < modelsToTry.length - 1) {
          // Rate limited, try next model after a short delay
          console.warn(`Gemini rate limited on ${model}, trying fallback...`)
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_RETRY_DELAY * (i + 1)))
          continue
        }

        if (!response.ok) {
          this.handleAPIError(response, 'Gemini')
        }

        const data = await this.getResponseBody(response)
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        if (!content) {
          throw new Error('No content received from API')
        }

        return this.parseResponse(content)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (i >= modelsToTry.length - 1 || i >= MAX_RATE_LIMIT_RETRIES) {
          throw lastError
        }
      }
    }

    throw lastError || new Error('All Gemini models failed')
  }
}

class CerebrasProvider extends LLMProviderBase {
  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    showWordList: boolean,
    showDetailedExplanation: boolean,
    showNuanceExplanation: boolean,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const endpoint = this.config.customEndpoint || 'https://api.cerebras.ai/v1/chat/completions'
    const requestedModel = this.config.model || 'llama-3.3-70b'

    const systemPrompt = this.generateSystemPrompt(
      sourceLanguage,
      targetLanguage,
      showWordList,
      showDetailedExplanation,
      showNuanceExplanation
    )

    // Build model fallback list for rate limiting
    const fallbackModels = FALLBACK_MODELS.cerebras.filter(m => m !== requestedModel)
    const modelsToTry = [requestedModel, ...fallbackModels]

    let lastError: Error | null = null

    for (let i = 0; i < modelsToTry.length && i <= MAX_RATE_LIMIT_RETRIES; i++) {
      const model = modelsToTry[i]

      try {
        const response = await this.fetchWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: {
              ...DEFAULT_HEADERS,
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'system',
                  content: systemPrompt,
                },
                {
                  role: 'user',
                  content: text,
                },
              ],
              temperature: this.config.temperature ?? 0.7,
            }),
          },
          API_TIMEOUT,
          signal
        )

        if (response.status === 429 && i < modelsToTry.length - 1) {
          // Rate limited, try next model after a short delay
          console.warn(`Cerebras rate limited on ${model}, trying fallback...`)
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_RETRY_DELAY * (i + 1)))
          continue
        }

        if (!response.ok) {
          this.handleAPIError(response, 'Cerebras')
        }

        const data = await this.getResponseBody(response)
        const content = data.choices?.[0]?.message?.content || ''

        if (!content) {
          throw new Error('No content received from API')
        }

        return this.parseResponse(content)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (i >= modelsToTry.length - 1 || i >= MAX_RATE_LIMIT_RETRIES) {
          throw lastError
        }
      }
    }

    throw lastError || new Error('All Cerebras models failed')
  }
}

class OpenAIProvider extends LLMProviderBase {
  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    showWordList: boolean,
    showDetailedExplanation: boolean,
    showNuanceExplanation: boolean,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const endpoint = this.config.customEndpoint || 'https://api.openai.com/v1/chat/completions'
    const model = this.config.model || 'gpt-4o-mini'

    const systemPrompt = this.generateSystemPrompt(
      sourceLanguage,
      targetLanguage,
      showWordList,
      showDetailedExplanation,
      showNuanceExplanation
    )

    const response = await this.fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          ...DEFAULT_HEADERS,
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: text,
            },
          ],
          temperature: this.config.temperature ?? 0.7,
          response_format: showWordList || showDetailedExplanation || showNuanceExplanation ? { type: 'json_object' } : undefined,
        }),
      },
      API_TIMEOUT,
      signal
    )

    if (!response.ok) {
      this.handleAPIError(response, 'OpenAI')
    }

    const data = await this.getResponseBody(response)
    const content = data.choices?.[0]?.message?.content || ''

    if (!content) {
      throw new Error('No content received from API')
    }

    return this.parseResponse(content)
  }
}

class GrokProvider extends LLMProviderBase {
  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    showWordList: boolean,
    showDetailedExplanation: boolean,
    showNuanceExplanation: boolean,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const endpoint = this.config.customEndpoint || 'https://api.x.ai/v1/chat/completions'
    const model = this.config.model || 'grok-beta'

    const systemPrompt = this.generateSystemPrompt(
      sourceLanguage,
      targetLanguage,
      showWordList,
      showDetailedExplanation,
      showNuanceExplanation
    )

    const response = await this.fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          ...DEFAULT_HEADERS,
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: text,
            },
          ],
          temperature: this.config.temperature ?? 0.7,
        }),
      },
      API_TIMEOUT,
      signal
    )

    if (!response.ok) {
      this.handleAPIError(response, 'Grok')
    }

    const data = await this.getResponseBody(response)
    const content = data.choices?.[0]?.message?.content || ''

    if (!content) {
      throw new Error('No content received from API')
    }

    return this.parseResponse(content)
  }
}
