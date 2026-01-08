'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSettingsStore, LLMProvider, Language } from '@/store/settingsStore'
import { useHistoryStore } from '@/store/historyStore'
import { createLLMProvider, LLMError, LLMProviderBase } from '@/lib/llm/providers'
import { Loader2, Sparkles, Copy, Check, ArrowRightLeft, Type, BookOpen, MessageSquare, ListMusic, Send, Globe2, Clipboard, Trash2, X, Activity, ArrowDown, Volume2 } from 'lucide-react'
import { LLMResponse } from '@/lib/llm/providers'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const languages: { value: Language; label: string }[] = [
  { value: 'japanese', label: '日本語' },
  { value: 'english', label: '英語' },
  { value: 'russian', label: 'ロシア語' },
  { value: 'chinese', label: '中国語' },
  { value: 'korean', label: '韓国語' },
  { value: 'spanish', label: 'スペイン語' },
]

const langMap: Record<string, string> = {
  japanese: 'ja-JP',
  english: 'en-US',
  russian: 'ru-RU',
  chinese: 'zh-CN',
  korean: 'ko-KR',
  spanish: 'es-ES',
}

export default function TranslationInterface() {
  type TranslationResult = LLMResponse & { original: string }

  const [sourceText, setSourceText] = useState('')
  const [targetText, setTargetText] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<TranslationResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [wordCopied, setWordCopied] = useState<string | null>(null)
  const [localSourceLanguage, setLocalSourceLanguage] = useState<Language>('japanese')
  const [localTargetLanguage, setLocalTargetLanguage] = useState<Language>('english')
  const [mounted, setMounted] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [analyzingType, setAnalyzingType] = useState<'vocabulary' | 'grammar' | 'nuance' | null>(null)
  const [activeProvider, setActiveProvider] = useState<LLMProvider | null>(null)
  const [speakingText, setSpeakingText] = useState<string | null>(null)
  const [activeVariant, setActiveVariant] = useState<string | null>(null)
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const translationControllerRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelHeightClass = "h-[65vh] md:h-[70vh] min-h-[380px] md:min-h-[520px]"

  const settings = useSettingsStore()
  const addHistoryItem = useHistoryStore((state) => state.addHistoryItem)

  useEffect(() => {
    isMountedRef.current = true
    setMounted(true)
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices()
    }
    return () => {
      isMountedRef.current = false
      if (translationControllerRef.current) translationControllerRef.current.abort()
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    }
  }, [])

  useEffect(() => {
    setLocalSourceLanguage(settings.sourceLanguage)
    setLocalTargetLanguage(settings.targetLanguage)
  }, [settings.sourceLanguage, settings.targetLanguage])

  const handleCopy = (text: string, field: string) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field || 'main')
      toast.success('コピーしました')
      setTimeout(() => setCopiedField(null), 2000)
    })
  }

  const handleSpeak = (text: string, lang: Language, variant?: 'us' | 'uk') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    const key = variant ? `${text}-${variant}` : text

    // CASE 1: Clicking the EXACT SAME button that is already playing -> STOP
    if (window.speechSynthesis.speaking && speakingText === key) {
      window.speechSynthesis.cancel()
      setSpeakingText(null)
      setActiveVariant(null)
      return
    }

    // CASE 2: Clicking a DIFFERENT button or starting fresh -> INTERRUPT & START
    window.speechSynthesis.cancel() // Always cancel previous speech immediately

    // Small delay to ensure the browser's speech engine has cleared the queue
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text)
      const langCode = langMap[lang] || lang
      utterance.lang = langCode

      const voices = window.speechSynthesis.getVoices()
      let preferredVoiceName = settings.voicePreferences[lang]
      if (lang === 'english' && variant === 'uk') {
        preferredVoiceName = settings.englishUkVoiceName
      }

      const voice =
        voices.find(v => v.name === preferredVoiceName) ||
        voices.find(v => v.name.includes(variant === 'uk' ? 'Great Britain' : variant === 'us' ? 'United States' : '')) ||
        voices.find(v => v.lang.startsWith(langCode.split('-')[0]))

      if (voice) utterance.voice = voice
      utterance.rate = settings.speechRate
      utterance.pitch = settings.speechPitch

      utterance.onstart = () => {
        setSpeakingText(key)
        setActiveVariant(variant || null)
      }
      utterance.onend = () => {
        setSpeakingText(null)
        setActiveVariant(null)
      }
      utterance.onerror = () => {
        setSpeakingText(null)
        setActiveVariant(null)
      }

      window.speechSynthesis.speak(utterance)
    }, 10) // Minimal 10ms delay for robustness
  }

  const performRouting = async <T,>(
    signal: AbortSignal,
    action: (provider: LLMProviderBase) => Promise<T>
  ): Promise<{ result: T, providerUsed: LLMProvider, modelUsed?: string }> => {
    const stepsToTry = settings.routingSteps.slice(0, settings.routingCount)
    let lastError: any

    for (let i = 0; i < stepsToTry.length; i++) {
      const step = stepsToTry[i]
      const providerApiKey = settings.apiKeys[step.provider]
      if (!providerApiKey) continue

      setActiveProvider(step.provider)
      const provider = createLLMProvider(step.provider, {
        apiKey: providerApiKey,
        model: step.model,
        customEndpoint: step.provider === settings.provider ? settings.customEndpoint : undefined,
        temperature: settings.temperature,
      })

      try {
        const result = await action(provider)
        return { result, providerUsed: step.provider, modelUsed: step.model }
      } catch (error: any) {
        lastError = error
        const statusCode = error.status || (error instanceof LLMError ? error.status : null)
        if ((statusCode === 429 || statusCode === 503) && i < stepsToTry.length - 1) {
          toast.warning(`${step.provider} が混雑しています...`)
          continue
        }
        throw error
      }
    }
    throw lastError || new Error('有効なAPIキーが設定されていません。設定画面で追加してください。')
  }

  const handleTranslate = async () => {
    if (!sourceText.trim() || loading) return
    setIsSubmitted(true)
    setLoading(true)
    setResponse(null)
    setTargetText('')
    if (translationControllerRef.current) translationControllerRef.current.abort()
    const controller = new AbortController()
    translationControllerRef.current = controller

    try {
      const { result: translatedText, providerUsed, modelUsed } = await performRouting(controller.signal, (p) =>
        p.translateText(sourceText, localSourceLanguage, localTargetLanguage, controller.signal)
      )
      if (!isMountedRef.current) return
      setTargetText(translatedText.trim())
      setResponse({ translation: translatedText.trim(), original: sourceText })
      setLoading(false)

      const historyId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      setCurrentHistoryId(historyId)

      addHistoryItem({
        id: historyId,
        sourceText, targetText: translatedText.trim(),
        sourceLanguage: localSourceLanguage, targetLanguage: localTargetLanguage,
        provider: providerUsed, model: modelUsed,
      } as any)
    } catch (error) {
      if (!isMountedRef.current || (error instanceof DOMException && error.name === 'AbortError')) return
      toast.error('翻訳エラー', { description: error instanceof Error ? error.message : '不明' })
      setLoading(false)
    } finally {
      setActiveProvider(null)
    }
  }

  const handleGranularAnalyze = async (type: 'vocabulary' | 'grammar' | 'nuance') => {
    if (!response?.translation || analyzingType) return
    setAnalyzingType(type)
    const controller = new AbortController()
    translationControllerRef.current = controller
    const preferredLang = settings.explanationLanguage === 'auto' ? localTargetLanguage : settings.explanationLanguage

    try {
      const { result: analysis } = await performRouting(controller.signal, (p) =>
        p.analyzeSpecific(response.original, response.translation, localSourceLanguage, localTargetLanguage, preferredLang, type, controller.signal)
      )
      if (isMountedRef.current) {
        setResponse(prev => prev ? ({ ...prev, ...analysis }) : null)
        if (currentHistoryId) {
          useHistoryStore.getState().updateHistoryItem(currentHistoryId, analysis)
        }
      }
    } catch (error) {
      console.warn(error)
      toast.error('分析失敗')
    } finally {
      if (isMountedRef.current) setAnalyzingType(null)
      setActiveProvider(null)
    }
  }

  const handleClear = () => {
    setSourceText('')
    setTargetText('')
    setResponse(null)
    setIsSubmitted(false)
  }

  const handleSwapLanguages = () => {
    const newSource = localTargetLanguage
    const newTarget = localSourceLanguage
    setLocalSourceLanguage(newSource)
    setLocalTargetLanguage(newTarget)
    settings.setSourceLanguage(newSource)
    settings.setTargetLanguage(newTarget)
  }

  const SpeakerButtons = ({ text, lang, size = 'md' }: { text: string, lang: Language, size?: 'sm' | 'md' }) => {
    const isEnglish = lang === 'english'
    const baseClass = size === 'sm' ? 'h-7 px-2 text-[8px]' : 'h-8 px-3 text-[10px]'
    const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'

    if (isEnglish) {
      return (
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className={`${baseClass} rounded-full font-black uppercase tracking-tighter transition-all ${speakingText === `${text}-us` ? 'bg-primary/20 text-primary animate-pulse' : 'bg-muted/20 text-muted-foreground hover:text-primary'}`} onClick={() => handleSpeak(text, lang, 'us')}>
            <Volume2 className={`${iconSize} mr-1`} /> US
          </Button>
          <Button variant="ghost" size="sm" className={`${baseClass} rounded-full font-black uppercase tracking-tighter transition-all ${speakingText === `${text}-uk` ? 'bg-blue-500/20 text-blue-600 animate-pulse' : 'bg-muted/20 text-muted-foreground hover:text-blue-500'}`} onClick={() => handleSpeak(text, lang, 'uk')}>
            <Volume2 className={`${iconSize} mr-1`} /> UK
          </Button>
        </div>
      )
    }

    return (
      <Button variant="ghost" size="icon" className={`${size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'} rounded-full transition-all ${speakingText === text ? 'bg-primary/10 text-primary animate-pulse' : 'text-muted-foreground hover:text-primary bg-muted/20'}`} onClick={() => handleSpeak(text, lang)}>
        <Volume2 className={iconSize} />
      </Button>
    )
  }

  if (!mounted) return null

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden" aria-busy={loading}>
      <ScrollArea className="flex-1 w-full min-h-0">
        <div className="pt-2 px-4 pb-32 md:p-12 w-full max-w-[1600px] mx-auto flex flex-col gap-12">

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-4 lg:gap-10">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="px-4 py-1.5 bg-primary/5 text-primary border-primary/20 rounded-full font-bold text-[10px] uppercase">翻訳中</Badge>
            </div>
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-1.5 p-2 rounded-2xl bg-muted/20 border border-border/40 shadow-inner backdrop-blur-sm scale-125 transition-transform">
                <Select value={localSourceLanguage} onValueChange={(val: Language) => val === localTargetLanguage ? handleSwapLanguages() : setLocalSourceLanguage(val)}>
                  <SelectTrigger className="h-10 rounded-xl border-none shadow-none font-black px-4 text-[11px] min-w-[110px] uppercase tracking-widest hover:bg-background/50 transition-colors"><SelectValue /></SelectTrigger>
                  <SelectContent>{languages.map(l => <SelectItem key={l.value} value={l.value} className="text-xs font-bold">{l.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={handleSwapLanguages} className="h-8 w-8 rounded-lg hover:text-primary transition-all active:scale-90"><ArrowRightLeft className="w-3.5 h-3.5" /></Button>
                <Select value={localTargetLanguage} onValueChange={(val: Language) => val === localSourceLanguage ? handleSwapLanguages() : setLocalTargetLanguage(val)}>
                  <SelectTrigger className="h-10 rounded-xl border-none shadow-none font-black px-4 text-[11px] min-w-[110px] text-primary uppercase tracking-widest hover:bg-background/50 transition-colors"><SelectValue /></SelectTrigger>
                  <SelectContent>{languages.map(l => <SelectItem key={l.value} value={l.value} className="text-xs font-bold">{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-muted/20 hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={handleClear} aria-label="Clear"><Trash2 className="w-4.5 h-4.5" /></Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_80px_1fr] items-start gap-1 lg:gap-10">
            <div className="space-y-4">
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground/60"><Type className="w-3 h-3" /> 原文 (Source)</div>
                {sourceText.trim() && <SpeakerButtons text={sourceText} lang={localSourceLanguage} />}
              </div>
              <div className={`relative rounded-[2.5rem] border transition-all duration-500 bg-card border-primary/20 shadow-xl shadow-primary/5 ${panelHeightClass} overflow-hidden`}>
                <Textarea ref={textareaRef} value={sourceText} onChange={(e) => setSourceText(e.target.value)} placeholder="翻訳したいテキストを入力してください..." className="w-full h-full bg-transparent border-none focus-visible:ring-0 resize-none font-medium p-6 md:p-10 text-base md:text-lg leading-relaxed overflow-y-auto" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleTranslate(); } }} />
                <div className="absolute bottom-6 right-8 md:bottom-8 md:right-10 text-[10px] font-black text-muted-foreground/20 uppercase tracking-widest">{sourceText.length} 文字</div>
              </div>
            </div>

            {/* Middle Action Bridge */}
            <div className="flex lg:flex-col items-center justify-center py-0 my-[-2rem] translate-y-12 lg:translate-y-0 lg:my-0 lg:py-0 h-full lg:min-h-[300px] z-10 relative pointer-events-none lg:sticky lg:top-1/2 lg:-translate-y-1/2">
              <div className="relative group pointer-events-auto">
                {/* Decorative background glow */}
                <div className={`absolute -inset-4 bg-gradient-to-tr from-primary/40 to-blue-400/40 rounded-full blur-2xl opacity-0 transition-all duration-1000 group-hover:opacity-100 ${sourceText.trim() && !loading ? 'opacity-50 animate-pulse' : ''}`} />

                <Button
                  size="lg"
                  onClick={handleTranslate}
                  disabled={!sourceText.trim() || loading}
                  className={`relative rounded-full w-14 h-14 md:w-16 md:h-16 lg:w-24 lg:h-24 p-0 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] transition-all duration-500 hover:scale-110 active:scale-95 border-4 border-background/20 backdrop-blur-sm overflow-hidden ${sourceText.trim()
                    ? 'bg-gradient-to-tr from-primary via-primary to-blue-400 text-primary-foreground shadow-primary/40'
                    : 'bg-muted text-muted-foreground/40'
                    }`}
                >
                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.div key="loading" initial={{ opacity: 0, rotate: -180 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 180 }}>
                        <Loader2 className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 animate-spin" />
                      </motion.div>
                    ) : (
                      <motion.div key="idle" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.5 }} className="relative">
                        <Send className="w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 translate-x-0.5" />
                        {/* Shimmer effect overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[200%] animate-[shimmer_3s_infinite] group-hover:translate-x-[200%] transition-transform duration-1000" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </div>

            <div className="space-y-4 pt-2 md:pt-0">
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase text-primary/80"><Sparkles className="w-3 h-3" /> 翻訳結果 (Result)</div>
                <div className="flex items-center gap-1">
                  {targetText && <SpeakerButtons text={targetText} lang={localTargetLanguage} />}
                  {targetText && <Button variant="ghost" size="sm" onClick={() => handleCopy(targetText, 'main')} className="h-8 px-4 rounded-full text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary bg-muted/20"><Copy className="w-3.5 h-3.5 mr-2" /> コピー</Button>}
                </div>
              </div>
              <div className={`relative rounded-[2.5rem] bg-card border border-primary/10 shadow-2xl ${panelHeightClass} overflow-hidden`}>
                <div className="h-full w-full p-8 md:p-10 overflow-y-auto break-words whitespace-pre-wrap">
                  <p className="text-base md:text-lg font-black leading-loose text-foreground tracking-tight">{targetText || (loading ? '' : '...')}</p>
                </div>
                {loading && <div className="absolute inset-0 flex items-center justify-center bg-card/60 backdrop-blur-md rounded-[2.5rem] z-10"><div className="flex flex-col items-center gap-4 text-center"><div className="relative"><Loader2 className="w-14 h-14 animate-spin text-primary opacity-40" /><Activity className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" /></div>{activeProvider && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-black px-4 py-1 rounded-full uppercase tracking-widest">Routing {activeProvider}</Badge>}</div></div>}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isSubmitted && !loading && response && (settings.showWordList || settings.showDetailedExplanation || settings.showNuanceExplanation) && (
              <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="pt-16 border-t border-border/20">
                <Tabs defaultValue={settings.showWordList ? "words" : settings.showDetailedExplanation ? "grammar" : "nuance"} className="w-full">
                  <div className="flex justify-center mb-12">
                    <TabsList className="bg-muted/30 p-2 rounded-[2rem] inline-flex shadow-inner border border-border/40">
                      {settings.showWordList && <TabsTrigger value="words" className="rounded-[1.5rem] px-12 py-4 font-black text-xs tracking-widest uppercase data-[state=active]:bg-card data-[state=active]:shadow-2xl transition-all">単語・熟語</TabsTrigger>}
                      {settings.showDetailedExplanation && <TabsTrigger value="grammar" className="rounded-[1.5rem] px-12 py-4 font-black text-xs tracking-widest uppercase data-[state=active]:bg-card data-[state=active]:shadow-2xl">文法構造</TabsTrigger>}
                      {settings.showNuanceExplanation && <TabsTrigger value="nuance" className="rounded-[1.5rem] px-12 py-4 font-black text-xs tracking-widest uppercase data-[state=active]:bg-card data-[state=active]:shadow-2xl">ニュアンス</TabsTrigger>}
                    </TabsList>
                  </div>

                  <TabsContent value="words" className="outline-none">
                    {analyzingType === 'vocabulary' ? (
                      <div className="flex flex-col items-center justify-center py-24 space-y-6"><Loader2 className="w-12 h-12 animate-spin text-primary/30" /><p className="text-xs font-black tracking-[0.4em] uppercase text-muted-foreground/40 animate-pulse">{activeProvider} で抽出中...</p></div>
                    ) : response.words ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {response.words.map((word, i) => (
                          <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="p-6 bg-card border border-border/40 hover:border-primary/20 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                            <div className="absolute top-6 right-6"><button className="text-muted-foreground/40 hover:text-primary transition-colors" onClick={() => navigator.clipboard.writeText(word.translated).then(() => toast.success('コピーしました'))} aria-label="訳語をコピー"><Copy className="w-4 h-4" /></button></div>
                            <div className="flex items-center gap-2.5 mb-1">
                              <span className="font-serif text-2xl font-medium text-foreground">{word.original}</span>
                              <SpeakerButtons text={word.original} lang={localSourceLanguage} size="sm" />
                            </div>
                            <div className="h-px w-8 bg-primary/30 my-4 rounded-full" />
                            <div className="flex items-center gap-2 mb-2">
                              <div className="text-lg font-black text-primary uppercase">{word.translated}</div>
                              <SpeakerButtons text={word.translated} lang={localTargetLanguage} size="sm" />
                            </div>
                            <div className="text-sm text-muted-foreground font-medium leading-relaxed">{word.meaning}</div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 bg-muted/5 rounded-[3rem] border border-dashed border-border/60"><Button onClick={() => handleGranularAnalyze('vocabulary')} className="h-14 px-12 rounded-full font-black tracking-widest uppercase shadow-2xl">ボキャブラリーを抽出</Button></div>
                    )}
                  </TabsContent>

                  <TabsContent value="grammar" className="outline-none">
                    {analyzingType === 'grammar' ? (
                      <div className="flex flex-col items-center justify-center py-24 space-y-6"><Loader2 className="w-12 h-12 animate-spin text-primary/30" /><p className="text-xs font-black tracking-[0.4em] uppercase text-muted-foreground/40 animate-pulse">{activeProvider} で解析中...</p></div>
                    ) : (response.detailedExplanation && typeof response.detailedExplanation !== 'string') ? (
                      <div className="space-y-8">
                        <div className="flex items-center justify-between px-4">
                          <div className="flex items-center gap-3"><Activity className="w-4 h-4 text-primary opacity-60" /><h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest">文法・構文解析</h4></div>
                          <Badge variant="outline" className="px-4 py-1 rounded-full font-black text-[10px] uppercase">{response.detailedExplanation.politeness_level}</Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          {response.detailedExplanation.key_points?.map((point, i) => (
                            <div key={i} className="p-6 bg-card border border-border/40 rounded-[2rem] space-y-4 shadow-sm">
                              <h5 className="font-black text-xl tracking-tight">{point.point}</h5>
                              {point.segment && (
                                <div className="flex items-center justify-start gap-3">
                                  <div className="pl-6 border-l-2 border-primary/20 italic font-serif text-lg opacity-80">"{point.segment}"</div>
                                  <SpeakerButtons text={point.segment} lang={localSourceLanguage} size="sm" />
                                </div>
                              )}
                              <p className="text-base leading-relaxed font-medium opacity-70">{point.explanation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 bg-muted/5 rounded-[3rem] border border-dashed border-border/60"><Button onClick={() => handleGranularAnalyze('grammar')} className="h-14 px-12 rounded-full font-black tracking-widest uppercase shadow-2xl">文法構造を解析</Button></div>
                    )}
                  </TabsContent>

                  <TabsContent value="nuance" className="outline-none">
                    {analyzingType === 'nuance' ? (
                      <div className="flex flex-col items-center justify-center py-24 space-y-6"><Loader2 className="w-12 h-12 animate-spin text-primary/30" /><p className="text-xs font-black tracking-[0.4em] uppercase text-muted-foreground/40 animate-pulse">{activeProvider} で分析中...</p></div>
                    ) : (response.nuanceExplanation && typeof response.nuanceExplanation !== 'string') ? (
                      <div className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="p-8 rounded-[2.5rem] bg-amber-500/5 border border-amber-500/10 flex flex-col gap-4 shadow-sm">
                            <div className="flex items-center gap-3"><MessageSquare className="w-5 h-5 text-amber-600 opacity-60" /><h4 className="text-[10px] font-black uppercase text-amber-600/60 tracking-widest">トーン・感情</h4></div>
                            <p className="text-xl font-black text-amber-950 dark:text-amber-50 italic leading-tight">{response.nuanceExplanation.tone}</p>
                          </div>
                          <div className="p-8 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/10 flex flex-col gap-4 shadow-sm">
                            <div className="flex items-center gap-3"><Globe2 className="w-5 h-5 text-indigo-600 opacity-60" /><h4 className="text-[10px] font-black uppercase text-indigo-600/60 tracking-widest">文脈・背景</h4></div>
                            <p className="text-base leading-relaxed opacity-80 font-medium">{response.nuanceExplanation.cultural_context}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                          {response.nuanceExplanation.better_choices?.map((choice, i) => (
                            <div key={i} className="p-8 bg-card border border-border/40 rounded-[3rem] shadow-sm">
                              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-10 mb-6">
                                <div className="p-6 rounded-[2rem] bg-muted/20 border border-dashed border-border/60 opacity-50 line-through text-lg italic">{choice.original_segment}</div>
                                <ArrowRightLeft className="w-6 h-6 text-primary opacity-40" />
                                <div className="p-6 rounded-[2rem] bg-primary/5 border border-primary/30 text-primary font-black text-2xl">{choice.phrase}</div>
                              </div>
                              <div className="p-6 bg-muted/10 rounded-[1.5rem] italic text-base opacity-70 leading-relaxed">"{choice.reason}"</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 bg-muted/5 rounded-[4rem] border border-dashed border-border/60"><Button onClick={() => handleGranularAnalyze('nuance')} className="h-14 px-12 rounded-full font-black tracking-widest uppercase shadow-2xl">ニュアンスを深掘り</Button></div>
                    )}
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  )
}
