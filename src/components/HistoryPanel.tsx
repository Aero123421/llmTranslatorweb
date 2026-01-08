'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useHistoryStore, TranslationHistoryItem } from '@/store/historyStore'
import { useSettingsStore, Language } from '@/store/settingsStore'
import { Trash2, Calendar, Clock, Copy, Check, X, History, ChevronRight, ArrowRight, Sparkles, Volume2, Globe2, Activity, MessageSquare, ListMusic, RotateCcw, ArrowRightLeft, ArrowDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { createLLMProvider, LLMError, LLMProviderBase } from '@/lib/llm/providers'
import { LLMProvider } from '@/store/settingsStore'
import { Loader2 } from 'lucide-react'

const languageLabels: Record<string, string> = {
  japanese: '日本語',
  english: '英語',
  russian: 'ロシア語',
  chinese: '中国語',
  korean: '韓国語',
  spanish: 'スペイン語',
}

const langMap: Record<string, string> = {
  japanese: 'ja-JP',
  english: 'en-US',
  russian: 'ru-RU',
  chinese: 'zh-CN',
  korean: 'ko-KR',
  spanish: 'es-ES',
}

export default function HistoryPanel() {
  const { history, deleteHistoryItem, clearHistory } = useHistoryStore()
  const settings = useSettingsStore()
  const [selectedItem, setSelectedItem] = useState<TranslationHistoryItem | null>(null)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [speakingText, setSpeakingText] = useState<string | null>(null)
  const [analyzingType, setAnalyzingType] = useState<'vocabulary' | 'grammar' | 'nuance' | null>(null)
  const [activeProvider, setActiveProvider] = useState<LLMProvider | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices()
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    }
  }, [])

  const formatTimestamp = (timestamp: number): string => {
    try {
      return formatDistanceToNow(timestamp, { addSuffix: true, locale: ja })
    } catch { return '不明' }
  }

  const handleCopy = (text: string, field: string) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field)
      toast.success('コピーしました')
      setTimeout(() => setCopiedField(null), 2000)
    })
  }

  const handleSpeak = (text: string, lang: string, variant?: 'us' | 'uk') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const key = variant ? `${text}-${variant}` : text
    if (window.speechSynthesis.speaking && speakingText === key) {
      window.speechSynthesis.cancel()
      setSpeakingText(null)
      return
    }
    window.speechSynthesis.cancel()
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text)
      const langCode = langMap[lang] || lang
      utterance.lang = langCode
      const voices = window.speechSynthesis.getVoices()
      let preferredVoiceName = settings.voicePreferences[lang as Language]
      if (lang === 'english' && variant === 'uk') preferredVoiceName = settings.englishUkVoiceName
      const voice = voices.find(v => v.name === preferredVoiceName) ||
        voices.find(v => v.name.includes(variant === 'uk' ? 'Great Britain' : variant === 'us' ? 'United States' : '')) ||
        voices.find(v => v.lang.startsWith(langCode.split('-')[0]))
      if (voice) utterance.voice = voice
      utterance.rate = settings.speechRate; utterance.pitch = settings.speechPitch
      utterance.onstart = () => setSpeakingText(key)
      utterance.onend = () => setSpeakingText(null)
      utterance.onerror = () => setSpeakingText(null)
      window.speechSynthesis.speak(utterance)
    }, 10)
  }

  const handleClearAll = () => {
    try {
      clearHistory()
      setShowClearDialog(false)
      setSelectedItem(null)
      toast.success('履歴をすべて削除しました')
    } catch (error) {
      console.error(error)
      toast.error('削除に失敗しました')
    }
  }

  const performRouting = async <T,>(
    signal: AbortSignal,
    action: (provider: LLMProviderBase) => Promise<T>
  ): Promise<{ result: T, providerUsed: LLMProvider }> => {
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
        return { result, providerUsed: step.provider }
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
    throw lastError
  }

  const handleGranularAnalyze = async (type: 'vocabulary' | 'grammar' | 'nuance') => {
    if (!selectedItem || analyzingType) return
    setAnalyzingType(type)
    const controller = new AbortController()
    const preferredLang = settings.explanationLanguage === 'auto' ? selectedItem.targetLanguage : settings.explanationLanguage

    try {
      const { result: analysis } = await performRouting(controller.signal, (p) =>
        p.analyzeSpecific(selectedItem.sourceText, selectedItem.targetText, selectedItem.sourceLanguage, selectedItem.targetLanguage, preferredLang, type, controller.signal)
      )

      const updatedItem = { ...selectedItem, ...analysis }
      // Update store
      useHistoryStore.getState().updateHistoryItem(selectedItem.id, analysis)
      // Update local state to reflect changes immediately in the dialog
      setSelectedItem(updatedItem)

      toast.success('分析が完了しました')
    } catch (error) {
      console.warn(error)
      toast.error('分析に失敗しました')
    } finally {
      setAnalyzingType(null)
      setActiveProvider(null)
    }
  }

  const SpeakerButtons = ({ text, lang, size = 'md' }: { text: string, lang: string, size?: 'sm' | 'md' }) => {
    const isEnglish = lang === 'english'
    const baseClass = size === 'sm' ? 'h-7 px-2 text-[8px]' : 'h-8 px-3 text-[10px]'
    if (isEnglish) {
      return (
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className={`${baseClass} rounded-full font-black transition-all ${speakingText === `${text}-us` ? 'bg-primary/20 text-primary animate-pulse' : 'bg-muted/20 text-muted-foreground hover:text-primary'}`} onClick={(e) => { e.stopPropagation(); handleSpeak(text, lang, 'us') }}>US</Button>
          <Button variant="ghost" size="sm" className={`${baseClass} rounded-full font-black transition-all ${speakingText === `${text}-uk` ? 'bg-blue-500/20 text-blue-600 animate-pulse' : 'bg-muted/20 text-muted-foreground hover:text-blue-500'}`} onClick={(e) => { e.stopPropagation(); handleSpeak(text, lang, 'uk') }}>UK</Button>
        </div>
      )
    }
    return (
      <Button variant="ghost" size="icon" className={`${size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'} rounded-full transition-all ${speakingText === text ? 'bg-primary/10 text-primary animate-pulse' : 'bg-muted/20 hover:text-primary text-muted-foreground'}`} onClick={(e) => { e.stopPropagation(); handleSpeak(text, lang) }}>
        <Volume2 className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      </Button>
    )
  }

  const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl shadow-inner"><History className="w-6 h-6 text-primary" /></div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground/90">翻訳アーカイブ</h2>
            <p className="text-[10px] text-muted-foreground font-bold tracking-[0.2em] uppercase opacity-60">Your Translation Legacy</p>
          </div>
        </div>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowClearDialog(true)} className="h-10 px-5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 text-[10px] font-black tracking-widest uppercase rounded-xl border border-border/40 transition-all"><Trash2 className="mr-2 h-4 w-4" />履歴をすべて消去</Button>
        )}
      </div>

      {history.length === 0 ? (
        <Card className="p-20 flex flex-col items-center justify-center border-dashed border-2 bg-muted/5 rounded-[3rem] min-h-[450px] gap-6">
          <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center shadow-inner"><Calendar className="h-10 w-10 text-muted-foreground/30" /></div>
          <div className="text-center space-y-2">
            <p className="text-base font-black uppercase tracking-widest text-muted-foreground/60">アーカイブは空です</p>
            <p className="text-xs text-muted-foreground/40 font-medium">翻訳を行うとここに履歴が保存されます</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence>
            {sortedHistory.map((item, index) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: index * 0.03 }}>
                <Card className="group relative p-6 cursor-pointer bg-card transition-all duration-500 border-border/60 hover:border-primary/40 rounded-[2rem] shadow-sm hover:shadow-2xl overflow-hidden flex flex-col gap-6" onClick={() => setSelectedItem(item)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[9px] font-black tracking-widest uppercase h-6 px-3">{item.provider}</Badge>
                      <div className="flex items-center gap-1.5 text-muted-foreground/50 font-mono text-[10px]"><Clock className="w-3 h-3" />{formatTimestamp(item.timestamp)}</div>
                    </div>
                    <div className="p-2 rounded-full bg-muted/20 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0"><ChevronRight className="w-4 h-4 text-primary" /></div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2"><div className="w-1 h-1 bg-muted-foreground/30 rounded-full" /><span className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">{languageLabels[item.sourceLanguage] || item.sourceLanguage}</span></div>
                      <p className="text-sm font-medium line-clamp-2 leading-relaxed opacity-70">{item.sourceText}</p>
                    </div>
                    <div className="hidden lg:block p-2 bg-muted/10 rounded-full"><ArrowRight className="w-4 h-4 text-muted-foreground/20" /></div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-primary/40 rounded-full" /><span className="text-[9px] font-black uppercase text-primary/60 tracking-widest">{languageLabels[item.targetLanguage] || item.targetLanguage}</span></div>
                      <p className="text-base font-black text-foreground line-clamp-2 leading-tight tracking-tight">{item.targetText}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-[1600px] w-[95vw] h-[90vh] overflow-hidden flex flex-col p-0 rounded-[2rem] border-primary/20 bg-card/95 backdrop-blur-3xl shadow-[0_50px_100px_rgba(0,0,0,0.4)]">
          {selectedItem && (
            <>
              <DialogHeader className="p-5 pb-4 sm:p-10 sm:pb-6 border-b border-border/20 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-2.5 bg-primary/10 rounded-xl sm:rounded-2xl"><Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /></div>
                    <DialogTitle className="text-xl sm:text-2xl font-black tracking-tighter">翻訳ログ詳細</DialogTitle>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Badge variant="outline" className="h-6 sm:h-7 px-3 sm:px-4 rounded-full font-black text-[9px] sm:text-[10px] uppercase border-primary/20 text-primary">{selectedItem.provider} : {selectedItem.model || 'Auto'}</Badge>
                    <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-destructive/10 hover:text-destructive transition-all" onClick={() => { deleteHistoryItem(selectedItem.id); setSelectedItem(null); toast.success('削除しました'); }}><Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-mono text-muted-foreground/40 uppercase tracking-[0.2em]">{formatTimestamp(selectedItem.timestamp)} 保存済み</div>
                <DialogDescription className="hidden">Translation history details including source, target, and analysis.</DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="content" className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="px-4 py-3 sm:px-10 sm:py-4 bg-muted/10 overflow-x-auto no-scrollbar flex-shrink-0">
                  <TabsList className="bg-muted/30 p-1 sm:p-1.5 h-10 sm:h-12 rounded-[1.2rem] sm:rounded-[1.5rem] border border-border/40 inline-flex min-w-full sm:min-w-fit justify-start">
                    <TabsTrigger value="content" className="flex-1 sm:flex-none rounded-xl px-4 sm:px-10 font-black text-[10px] sm:text-[11px] tracking-widest uppercase transition-all data-[state=active]:bg-card data-[state=active]:shadow-xl whitespace-nowrap">翻訳内容</TabsTrigger>
                    <TabsTrigger value="words" className="flex-1 sm:flex-none rounded-xl px-4 sm:px-10 font-black text-[10px] sm:text-[11px] tracking-widest uppercase transition-all data-[state=active]:bg-card data-[state=active]:shadow-xl whitespace-nowrap">単語・熟語</TabsTrigger>
                    <TabsTrigger value="grammar" className="flex-1 sm:flex-none rounded-xl px-4 sm:px-10 font-black text-[10px] sm:text-[11px] tracking-widest uppercase transition-all data-[state=active]:bg-card data-[state=active]:shadow-xl whitespace-nowrap">文法構造</TabsTrigger>
                    <TabsTrigger value="nuance" className="flex-1 sm:flex-none rounded-xl px-4 sm:px-10 font-black text-[10px] sm:text-[11px] tracking-widest uppercase transition-all data-[state=active]:bg-card data-[state=active]:shadow-xl whitespace-nowrap">ニュアンス</TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto px-4 sm:px-10 scrollbar-hidden">
                  <div className="py-6 sm:py-10 space-y-8 sm:space-y-12 pb-20">
                    <TabsContent value="content" className="space-y-6 sm:space-y-10 mt-0">
                      <div className="space-y-3 sm:space-y-4">
                        <div className="flex items-center justify-between px-2 sm:px-4">
                          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2"><Globe2 className="w-3 h-3" /> {languageLabels[selectedItem.sourceLanguage] || selectedItem.sourceLanguage}</span>
                          <div className="flex items-center gap-2">
                            <SpeakerButtons text={selectedItem.sourceText} lang={selectedItem.sourceLanguage} />
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-muted/20" onClick={() => handleCopy(selectedItem.sourceText, 'source')}>{copiedField === 'source' ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}</Button>
                          </div>
                        </div>
                        <div className="p-6 sm:p-10 bg-muted/20 rounded-[2rem] sm:rounded-[2.5rem] border border-border/20 text-lg sm:text-xl font-medium leading-relaxed tracking-tight break-words">{selectedItem.sourceText}</div>
                      </div>

                      <div className="space-y-3 sm:space-y-4">
                        <div className="flex items-center justify-between px-2 sm:px-4">
                          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2"><Sparkles className="w-3 h-3" /> {languageLabels[selectedItem.targetLanguage] || selectedItem.targetLanguage}</span>
                          <div className="flex items-center gap-2">
                            <SpeakerButtons text={selectedItem.targetText} lang={selectedItem.targetLanguage} />
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-muted/20" onClick={() => handleCopy(selectedItem.targetText, 'target')}>{copiedField === 'target' ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}</Button>
                          </div>
                        </div>
                        <div className="p-6 sm:p-10 bg-primary/5 rounded-[2rem] sm:rounded-[2.5rem] border border-primary/10 text-xl sm:text-2xl font-black leading-loose tracking-tight break-words text-foreground">{selectedItem.targetText}</div>
                      </div>
                    </TabsContent>

                    <TabsContent value="words" className="mt-0">
                      {analyzingType === 'vocabulary' ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-6"><Loader2 className="w-12 h-12 animate-spin text-primary/30" /><p className="text-xs font-black tracking-[0.4em] uppercase text-muted-foreground/40 animate-pulse">{activeProvider} で抽出中...</p></div>
                      ) : selectedItem.words && selectedItem.words.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                          {selectedItem.words.map((word, i) => (
                            <div key={i} className="p-6 sm:p-8 bg-card border border-border/40 rounded-[2rem] sm:rounded-[2.5rem] space-y-4 shadow-sm group/word relative overflow-hidden transition-all hover:shadow-xl hover:border-primary/20">
                              <div className="absolute top-6 right-6 flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-muted/10 opacity-0 group-hover/word:opacity-100 transition-all" onClick={() => handleCopy(word.translated, `w-${i}`)}>{copiedField === `w-${i}` ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}</Button>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-serif text-2xl font-medium">{word.original}</span>
                                <SpeakerButtons text={word.original} lang={selectedItem.sourceLanguage} size="sm" />
                              </div>
                              <div className="h-px w-8 bg-primary/30 rounded-full" />
                              <div className="flex items-center gap-3">
                                <p className="text-primary font-black text-lg uppercase">{word.translated}</p>
                                <SpeakerButtons text={word.translated} lang={selectedItem.targetLanguage} size="sm" />
                              </div>
                              {word.meaning && <p className="text-sm text-muted-foreground font-medium leading-relaxed">{word.meaning}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-muted/5 rounded-[3rem] border border-dashed border-border/60"><Button onClick={() => handleGranularAnalyze('vocabulary')} className="h-14 px-12 rounded-full font-black tracking-widest uppercase shadow-2xl transition-transform hover:scale-105 active:scale-95">ボキャブラリーを抽出</Button></div>
                      )}
                    </TabsContent>

                    <TabsContent value="grammar" className="mt-0">
                      {analyzingType === 'grammar' ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-6"><Loader2 className="w-12 h-12 animate-spin text-primary/30" /><p className="text-xs font-black tracking-[0.4em] uppercase text-muted-foreground/40 animate-pulse">{activeProvider} で解析中...</p></div>
                      ) : selectedItem.detailedExplanation && typeof selectedItem.detailedExplanation !== 'string' ? (
                        <div className="space-y-6 sm:space-y-8">
                          <div className="flex items-center justify-between px-2 sm:px-4">
                            <div className="flex items-center gap-3"><Activity className="w-4 h-4 text-primary opacity-60" /><h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest">文法・構文解析</h4></div>
                            <Badge variant="outline" className="px-4 py-1 rounded-full font-black text-[10px] uppercase border-primary/20">{selectedItem.detailedExplanation.politeness_level || 'Normal'}</Badge>
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:gap-6">
                            {selectedItem.detailedExplanation.key_points?.map((point, i) => (
                              <div key={i} className="p-6 sm:p-8 bg-card border border-border/40 rounded-[2rem] sm:rounded-[2.5rem] space-y-4 sm:space-y-5 shadow-sm">
                                <h5 className="font-black text-lg sm:text-xl tracking-tight">{point.point}</h5>
                                <div className="flex items-center gap-3">
                                  <div className="pl-6 border-l-2 border-primary/20 italic font-serif text-base sm:text-lg opacity-80">"{point.segment}"</div>
                                  <SpeakerButtons text={point.segment} lang={selectedItem.sourceLanguage} size="sm" />
                                </div>
                                <p className="text-sm sm:text-base leading-relaxed font-medium opacity-70">{point.explanation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-muted/5 rounded-[3rem] border border-dashed border-border/60"><Button onClick={() => handleGranularAnalyze('grammar')} className="h-14 px-12 rounded-full font-black tracking-widest uppercase shadow-2xl transition-transform hover:scale-105 active:scale-95">文法構造を解析</Button></div>
                      )}
                    </TabsContent>

                    <TabsContent value="nuance" className="mt-0">
                      {analyzingType === 'nuance' ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-6"><Loader2 className="w-12 h-12 animate-spin text-primary/30" /><p className="text-xs font-black tracking-[0.4em] uppercase text-muted-foreground/40 animate-pulse">{activeProvider} で分析中...</p></div>
                      ) : selectedItem.nuanceExplanation && typeof selectedItem.nuanceExplanation !== 'string' ? (
                        <div className="space-y-8 sm:space-y-10">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                            <div className="p-8 sm:p-10 rounded-[2.5rem] sm:rounded-[3rem] bg-amber-500/5 border border-amber-500/10 flex flex-col gap-4 shadow-sm">
                              <div className="flex items-center gap-3"><MessageSquare className="w-5 h-5 text-amber-600 opacity-60" /><h4 className="text-[10px] font-black uppercase text-amber-600/60 tracking-widest">トーン・感情</h4></div>
                              <p className="text-xl sm:text-2xl font-black text-amber-950 dark:text-amber-50 italic leading-tight">{selectedItem.nuanceExplanation.tone}</p>
                            </div>
                            <div className="p-8 sm:p-10 rounded-[2.5rem] sm:rounded-[3rem] bg-indigo-500/5 border border-indigo-500/10 flex flex-col gap-4 shadow-sm">
                              <div className="flex items-center gap-3"><Globe2 className="w-5 h-5 text-indigo-600 opacity-60" /><h4 className="text-[10px] font-black uppercase text-indigo-600/60 tracking-widest">文脈・背景</h4></div>
                              <p className="text-base sm:text-lg leading-relaxed opacity-80 font-medium">{selectedItem.nuanceExplanation.cultural_context}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-6">
                            {selectedItem.nuanceExplanation.better_choices?.map((choice, i) => (
                              <div key={i} className="p-8 sm:p-10 bg-card border border-border/40 rounded-[2.5rem] sm:rounded-[3rem] shadow-sm">
                                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-6 sm:gap-10 mb-6 sm:mb-8">
                                  <div className="p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] bg-muted/20 border border-dashed border-border/60 opacity-50 line-through text-base sm:text-lg italic">{choice.original_segment}</div>
                                  <div className="hidden lg:block"><ArrowRightLeft className="w-6 h-6 text-primary opacity-40" /></div>
                                  <div className="lg:hidden flex justify-center"><ArrowDown className="w-6 h-6 text-primary opacity-40 animate-bounce" /></div>
                                  <div className="p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] bg-primary/5 border border-primary/30 text-primary font-black text-xl sm:text-2xl">{choice.phrase}</div>
                                </div>
                                <div className="p-6 sm:p-8 bg-muted/10 rounded-[1.5rem] sm:rounded-[2rem] italic text-sm sm:text-base opacity-70 leading-relaxed">"{choice.reason}"</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-muted/5 rounded-[4rem] border border-dashed border-border/60"><Button onClick={() => handleGranularAnalyze('nuance')} className="h-14 px-12 rounded-full font-black tracking-widest uppercase shadow-2xl transition-transform hover:scale-105 active:scale-95">ニュアンスを深掘り</Button></div>
                      )}
                    </TabsContent>
                  </div>
                </div>

                <div className="p-4 sm:p-8 bg-muted/20 border-t border-border/40 flex items-center justify-end gap-4 flex-shrink-0">
                  <Button variant="outline" className="w-full sm:w-auto h-12 sm:h-14 px-10 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-[11px] tracking-widest uppercase" onClick={() => setSelectedItem(null)}>閉じる</Button>
                </div>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="rounded-[3rem] p-10 space-y-8 border-destructive/20 bg-card/95 backdrop-blur-3xl shadow-2xl">
          <DialogHeader>
            <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4 mx-auto"><Trash2 className="w-8 h-8 text-destructive" /></div>
            <DialogTitle className="font-black tracking-tight text-2xl text-center">履歴をすべて消去しますか？</DialogTitle>
            <DialogDescription className="font-medium text-xs leading-relaxed uppercase tracking-widest text-center opacity-60">この操作は取り消せません。保存されたすべての翻訳データが削除されます。</DialogDescription>
          </DialogHeader>
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1 h-14 rounded-2xl font-black text-[11px] tracking-widest uppercase border-border/60" onClick={() => setShowClearDialog(false)}>キャンセル</Button>
            <Button variant="destructive" className="flex-1 h-14 rounded-2xl font-black text-[11px] tracking-widest uppercase shadow-xl shadow-destructive/20" onClick={handleClearAll}>完全に消去する</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}