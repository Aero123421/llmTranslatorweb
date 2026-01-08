'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSettingsStore, Language } from '@/store/settingsStore'
import { useHistoryStore } from '@/store/historyStore'
import { createLLMProvider } from '@/lib/llm/providers'
import { Loader2, Sparkles, Copy, Check, ArrowRightLeft, Type, BookOpen, MessageSquare, ListMusic, Send, Globe2 } from 'lucide-react'
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

export default function TranslationInterface() {
  // Extended type to include the original text snapshot
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
  const translationControllerRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const settings = useSettingsStore()
  const addHistoryItem = useHistoryStore((state) => state.addHistoryItem)

  const isInitial = !targetText && !loading

  useEffect(() => {
    setMounted(true)
    return () => {
      isMountedRef.current = false
      if (translationControllerRef.current) {
        translationControllerRef.current.abort()
      }
    }
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(200, Math.max(56, textareaRef.current.scrollHeight))}px`
    }
  }, [sourceText])

  useEffect(() => {
    setLocalSourceLanguage(settings.sourceLanguage)
    setLocalTargetLanguage(settings.targetLanguage)
  }, [settings.sourceLanguage, settings.targetLanguage])

  const handleTranslate = async () => {
    if (!sourceText.trim()) return

    const apiKey = settings.getApiKey()
    if (!apiKey.trim()) {
      toast.error('APIキーが設定されていません', {
        description: '設定パネルからAPIキーを入力してください。',
        action: {
          label: '設定を開く',
          onClick: () => {
            const settingsBtn = document.querySelector('[data-nav="settings"]') as HTMLButtonElement
            settingsBtn?.click()
          }
        }
      })
      return
    }

    if (loading) return

    setLoading(true)
    setResponse(null)
    setTargetText('')

    if (translationControllerRef.current) {
      translationControllerRef.current.abort()
    }

    const controller = new AbortController()
    translationControllerRef.current = controller

    try {
      const provider = createLLMProvider(settings.provider, {
        apiKey,
        model: settings.model,
        customEndpoint: settings.customEndpoint,
        temperature: settings.temperature,
      })

      const result = await provider.translate(
        sourceText,
        localSourceLanguage,
        localTargetLanguage,
        settings.showWordList,
        settings.showDetailedExplanation,
        settings.showNuanceExplanation,
        controller.signal
      )

      if (isMountedRef.current) {
        setResponse({ ...result, original: sourceText })
        setTargetText(result.translation)

        addHistoryItem({
          sourceText,
          targetText: result.translation,
          sourceLanguage: localSourceLanguage,
          targetLanguage: localTargetLanguage,
          words: result.words,
          detailedExplanation: result.detailedExplanation,
          nuanceExplanation: result.nuanceExplanation,
          provider: settings.provider,
          model: settings.model,
        })
      }
    } catch (error) {
      if (!isMountedRef.current) return
      if (error instanceof DOMException && error.name === 'AbortError') return

      console.error('翻訳エラー:', error)
      const errorMessage = error instanceof Error ? error.message : '不明なエラー'

      if (errorMessage.includes('Rate limit')) {
        toast.error('レートリミット超過', { description: 'APIのレートリミットに達しました。' })
      } else if (errorMessage.includes('Invalid API key')) {
        toast.error('APIキー無効', { description: 'APIキーが無効です。' })
      } else {
        toast.error('翻訳エラー', { description: errorMessage })
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
      translationControllerRef.current = null
    }
  }

  const handleSwapLanguages = () => {
    // Only swap languages, not text, because input text is now in the input bar
    const newSource = localTargetLanguage
    const newTarget = localSourceLanguage

    setLocalSourceLanguage(newSource)
    setLocalTargetLanguage(newTarget)
    settings.setSourceLanguage(newSource)
    settings.setTargetLanguage(newTarget)

    // Clear previous results on swap to avoid confusion? Or keep them? 
    // Keeping them is better UX sometimes, but language mismatch.
    // Let's keep the text but clear the response detail as it might be invalid context.
    // setResponse(null) // Optional: decided to keep for reference until new translation
  }

  const handleCopy = (text: string, type: 'main' | 'word', wordId?: string) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'main') {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        setWordCopied(wordId || null)
        setTimeout(() => setWordCopied(null), 2000)
      }
      toast.success('クリップボードにコピーしました', { duration: 1500 })
    }).catch(err => {
      console.error('Copy failed', err)
      toast.error('コピーに失敗しました')
    })
  }

  if (!mounted) return null

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Main Content Area */}
      <ScrollArea className="flex-1 w-full">
        <div className="p-6 md:p-12 pb-48 w-full max-w-6xl mx-auto flex flex-col gap-8">

          {/* Header Controls - Simplified */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="px-4 py-1.5 bg-primary/5 text-primary border-primary/20 flex gap-2.5 rounded-full">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="font-bold tracking-wider text-[10px] uppercase">Neural Bridge Active</span>
              </Badge>
              <div className="hidden lg:flex items-center gap-2.5 text-[10px] font-black text-muted-foreground/40 tracking-[0.2em] uppercase">
                <Globe2 className="w-3.5 h-3.5" />
                {settings.provider} <Separator orientation="vertical" className="h-3 mx-1 bg-border/40" /> {settings.model || 'AUTO'}
              </div>
            </div>
          </div>

          {/* Results Area */}
          <AnimatePresence mode="wait">
            {isInitial ? null : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-12"
              >
                {/* Split View */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
                  {/* Source Side */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground/60 px-2">
                      <Type className="w-3 h-3" /> Source Text
                    </div>
                    <div className="p-6 md:p-8 rounded-[2rem] bg-muted/10 border border-transparent hover:border-border/40 transition-colors">
                      <p className="text-lg md:text-xl font-medium leading-relaxed whitespace-pre-wrap text-foreground/80">
                        {response ? response.original : sourceText}
                      </p>
                    </div>
                  </div>

                  {/* Target Side */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase text-primary">
                        <Sparkles className="w-3 h-3" /> Translation
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(targetText, 'main')} className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary">
                          {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />} Copy
                        </Button>
                      </div>
                    </div>
                    <div className="relative p-6 md:p-8 rounded-[2rem] bg-card border border-primary/10 shadow-lg shadow-primary/5 min-h-[160px] flex items-start">
                      {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-card/50 backdrop-blur-sm rounded-[2rem] z-10">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                      ) : null}
                      <p className="text-xl md:text-2xl font-bold leading-relaxed whitespace-pre-wrap text-foreground">
                        {targetText}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Insights Section */}
                {(response?.words || response?.detailedExplanation || response?.nuanceExplanation) && !loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="pt-8 border-t border-border/20"
                  >
                    <Tabs defaultValue="words" className="w-full">
                      <div className="flex items-center justify-center mb-10">
                        <div className="bg-muted/30 p-1.5 rounded-2xl inline-flex shadow-inner">
                          <TabsTrigger value="words" disabled={!response.words} className="rounded-xl px-8 py-2.5 font-black text-[10px] tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-lg transition-all">TERMINOLOGY</TabsTrigger>
                          <TabsTrigger value="grammar" disabled={!response.detailedExplanation} className="rounded-xl px-8 py-2.5 font-black text-[10px] tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-lg transition-all">STRUCTURE</TabsTrigger>
                          <TabsTrigger value="nuance" disabled={!response.nuanceExplanation} className="rounded-xl px-8 py-2.5 font-black text-[10px] tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-lg transition-all">NUANCE</TabsTrigger>
                        </div>
                      </div>

                      <TabsContent value="words" className="mt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {response.words?.map((word, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.05 }}
                              className="p-6 bg-card border border-border/40 hover:border-primary/20 rounded-[2rem] shadow-sm hover:shadow-md transition-all group relative"
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-4 right-4 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={() => handleCopy(word.translated, 'word', word.original)}
                                aria-label={`「${word.original}」をコピー`}
                              >
                                {wordCopied === word.original ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              </Button>
                              <div className="mb-3">
                                <span className="font-serif text-2xl font-medium text-foreground">{word.original}</span>
                              </div>
                              <div className="h-px w-8 bg-primary/20 mb-3" />
                              <div className="text-base font-bold text-primary mb-1">{word.translated}</div>
                              <div className="text-xs text-muted-foreground font-medium leading-relaxed">{word.meaning}</div>
                            </motion.div>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="grammar" className="mt-0">
                        <Card className="p-8 md:p-12 bg-muted/10 border-border/20 rounded-[2.5rem]">
                          <div className="prose prose-sm dark:prose-invert max-w-none font-medium text-foreground/80 leading-loose text-lg whitespace-pre-wrap">
                            {response.detailedExplanation || ''}
                          </div>
                        </Card>
                      </TabsContent>

                      <TabsContent value="nuance" className="mt-0">
                        <div className="relative p-8 md:p-12 bg-amber-500/5 border border-amber-500/10 rounded-[2.5rem] overflow-hidden">
                          <div className="absolute top-0 right-0 p-12 opacity-5">
                            <MessageSquare className="w-48 h-48" />
                          </div>
                          <div className="relative z-10 prose prose-sm dark:prose-invert max-w-none font-medium text-foreground/80 leading-loose text-lg whitespace-pre-wrap">
                            {response.nuanceExplanation || ''}
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </motion.div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Input Bar (Adaptive Position) */}
      <motion.div
        layout
        className={
          isInitial
            ? "absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95 p-6"
            : "absolute bottom-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-t border-border/20 px-4 py-6 md:px-6 md:pb-10"
        }
        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
      >
        <motion.div
          layout
          className={
            isInitial
              ? "w-full max-w-3xl relative"
              : "w-full max-w-4xl mx-auto relative"
          }
        >
          {/* Logo/Title for Initial State */}
          {isInitial && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute bottom-[130%] left-0 right-0 text-center space-y-4"
            >
              <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-primary/10 mb-4 ring-1 ring-primary/20 shadow-lg shadow-primary/10">
                <Sparkles className="w-12 h-12 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
                Neural Bridge
              </h1>
              <p className="text-muted-foreground font-medium text-lg">
                Context-Aware AI Translation
              </p>
            </motion.div>
          )}

          <div className={`relative transition-all duration-300 rounded-[2rem] border overflow-hidden group ${loading ? 'opacity-80' :
            isInitial
              ? 'bg-background/5 border-primary/20 shadow-lg shadow-primary/5 hover:border-primary/40 hover:bg-background/10'
              : 'bg-background/40 border-primary/10 hover:border-primary/20 hover:shadow-primary/5 focus-within:border-primary/30 focus-within:bg-background/60 focus-within:shadow-primary/10'
            }`}>

            <Textarea
              ref={textareaRef}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={isInitial ? "Enter text seamlessly..." : "What would you like to translate?"}
              disabled={loading}
              className={`w-full bg-transparent border-none focus-visible:ring-0 resize-none font-medium placeholder:text-muted-foreground/30 transition-all duration-200 ease-out [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]
                ${isInitial
                  ? "min-h-[200px] max-h-[600px] py-6 pl-8 pr-20 text-lg md:text-xl leading-relaxed"
                  : "min-h-[64px] max-h-[300px] py-5 pl-6 pr-20 text-base"
                }`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  handleTranslate()
                }
              }}
            />

            <div className="absolute right-4 bottom-4">
              <Button
                size={isInitial ? "lg" : "icon"}
                onClick={handleTranslate}
                disabled={!sourceText.trim() || loading}
                aria-label="翻訳する"
                className={`rounded-full transition-all duration-300 shadow-md hover:scale-105 active:scale-95
                  ${isInitial ? "h-12 w-12" : "h-10 w-10"}
                  ${sourceText.trim() ? 'bg-primary text-primary-foreground shadow-primary/20' : 'bg-muted/50 text-muted-foreground/50'}`}
              >
                {loading ? <Loader2 className={`${isInitial ? "w-5 h-5" : "w-5 h-5"} animate-spin`} /> : <Send className={`${isInitial ? "w-5 h-5 ml-0.5" : "w-4 h-4 ml-0.5"}`} />}
              </Button>
            </div>
          </div>

          {/* Char Counter */}
          <div className="absolute -bottom-8 left-8 flex items-center gap-4 text-[10px] font-bold text-muted-foreground/30 tracking-[0.2em] uppercase">
            <span>{sourceText.length} CHARS</span>
            <span className="w-1 h-1 rounded-full bg-current opacity-30" />
            <span>ENTER TO SEND</span>
          </div>

          {/* Controls Bar (Languages + Quick Actions) */}
          <motion.div
            layout
            className="absolute bottom-full mb-6 left-0 right-0 flex flex-col md:flex-row items-center justify-between gap-4 px-2"
          >
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-background/50 border border-border/40 backdrop-blur-md shadow-sm">
              <Select value={localSourceLanguage} onValueChange={(val: Language) => {
                if (val === localTargetLanguage) handleSwapLanguages()
                else { setLocalSourceLanguage(val); settings.setSourceLanguage(val); }
              }}>
                <SelectTrigger className="h-8 rounded-full border-none shadow-none font-bold bg-transparent hover:bg-foreground/5 focus:ring-0 transition-colors px-3 text-xs min-w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10 shadow-xl min-w-[120px]">
                  <div className="p-1">{languages.map(l => <SelectItem key={l.value} value={l.value} className="rounded-lg text-xs font-medium cursor-pointer">{l.label}</SelectItem>)}</div>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwapLanguages}
                className="h-7 w-7 rounded-full text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-all hover:rotate-180"
                aria-label="言語を入れ替える"
              >
                <ArrowRightLeft className="w-3 h-3" />
              </Button>

              <Select value={localTargetLanguage} onValueChange={(val: Language) => {
                if (val === localSourceLanguage) handleSwapLanguages()
                else { setLocalTargetLanguage(val); settings.setTargetLanguage(val); }
              }}>
                <SelectTrigger className="h-8 rounded-full border-none shadow-none font-bold bg-transparent hover:bg-foreground/5 focus:ring-0 transition-colors px-3 text-xs min-w-[100px] text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10 shadow-xl min-w-[120px]">
                  <div className="p-1">{languages.map(l => <SelectItem key={l.value} value={l.value} className="rounded-lg text-xs font-medium cursor-pointer">{l.label}</SelectItem>)}</div>
                </SelectContent>
              </Select>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <TooltipProvider>
                {[
                  { id: 'word', icon: ListMusic, active: settings.showWordList, label: 'Vocabulary', toggle: () => settings.setShowWordList(!settings.showWordList) },
                  { id: 'grammar', icon: BookOpen, active: settings.showDetailedExplanation, label: 'Structure', toggle: () => settings.setShowDetailedExplanation(!settings.showDetailedExplanation) },
                  { id: 'nuance', icon: MessageSquare, active: settings.showNuanceExplanation, label: 'Nuance', toggle: () => settings.setShowNuanceExplanation(!settings.showNuanceExplanation) },
                ].map((tool) => (
                  <Tooltip key={tool.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-9 px-4 rounded-full transition-all border backdrop-blur-md ${tool.active ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20' : 'bg-background/50 border-border/40 text-muted-foreground hover:bg-background/80 hover:text-foreground hover:border-border/60'}`}
                        onClick={tool.toggle}
                        type="button"
                      >
                        <tool.icon className="w-3.5 h-3.5 mr-2" />
                        <span className="text-[10px] font-black tracking-wider uppercase">{tool.label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px] font-black tracking-widest uppercase bg-foreground text-background mb-2">{tool.label} Mode</TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}
