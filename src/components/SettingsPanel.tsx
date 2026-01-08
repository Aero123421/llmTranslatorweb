'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useSettingsStore, LLMProvider, Language, OutputFormat, computeOutputFormat } from '@/store/settingsStore'
import { Eye, EyeOff, Save, RotateCcw, Settings2, ShieldCheck, Sparkles, Sliders, ListMusic, BookOpen, MessageSquare, Loader2, Volume2, Globe2, ChevronDown, ChevronUp, Send, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

const providerModels: Record<LLMProvider, { label: string; value: string }[]> = {
  groq: [
    { label: 'Llama 3.3 70B (Versatile)', value: 'llama-3.3-70b-versatile' },
    { label: 'GPT-OSS 20B', value: 'openai/gpt-oss-20b' },
    { label: 'GPT-OSS 120B', value: 'openai/gpt-oss-120b' },
  ],
  gemini: [
    { label: 'Gemini 3 Flash Preview', value: 'gemini-3-flash-preview' },
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    { label: 'Gemini 2.5 Flash-Lite', value: 'gemini-2.5-flash-lite' },
  ],
  cerebras: [
    { label: 'GPT-OSS 120B', value: 'gpt-oss-120b' },
    { label: 'Z.ai GLM 4.7', value: 'zai-glm-4.7' },
  ],
  openai: [
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4o-mini', value: 'gpt-4o-mini' },
  ],
  grok: [
    { label: 'Grok Beta', value: 'grok-beta' },
  ],
}

const providers: { value: LLMProvider; label: string; defaultModel: string }[] = [
  { value: 'groq', label: 'Groq', defaultModel: 'llama-3.3-70b-versatile' },
  { value: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-2.5-flash' },
  { value: 'cerebras', label: 'Cerebras', defaultModel: 'gpt-oss-120b' },
  { value: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o' },
  { value: 'grok', label: 'Grok (xAI)', defaultModel: 'grok-beta' },
]

const languages: { value: Language; label: string; code: string }[] = [
  { value: 'japanese', label: '日本語', code: 'ja' },
  { value: 'english', label: '英語', code: 'en' },
  { value: 'russian', label: 'ロシア語', code: 'ru' },
  { value: 'chinese', label: '中国語', code: 'zh' },
  { value: 'korean', label: '韓国語', code: 'ko' },
  { value: 'spanish', label: 'スペイン語', code: 'es' },
]

export default function SettingsPanel() {
  const settings = useSettingsStore()
  const [activeSlotIndex, setActiveSlotIndex] = useState(0)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [showApiKey, setShowApiKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isVoiceLibExpanded, setIsVoiceLibExpanded] = useState(false)

  const [localSettings, setLocalSettings] = useState({
    provider: settings.provider,
    model: settings.model,
    routingSteps: [...settings.routingSteps],
    routingCount: settings.routingCount,
    apiKeys: { ...settings.apiKeys },
    customEndpoint: settings.customEndpoint,
    temperature: settings.temperature,
    speechRate: settings.speechRate,
    speechPitch: settings.speechPitch,
    voicePreferences: { ...settings.voicePreferences },
    englishUkVoiceName: settings.englishUkVoiceName,
    showWordList: settings.showWordList,
    showDetailedExplanation: settings.showDetailedExplanation,
    showNuanceExplanation: settings.showNuanceExplanation,
    outputFormat: settings.outputFormat,
    sourceLanguage: settings.sourceLanguage,
    targetLanguage: settings.targetLanguage,
    explanationLanguage: settings.explanationLanguage,
  })

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      setAvailableVoices(voices)
    }
    loadVoices()
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
  }, [])

  const currentSlot = localSettings.routingSteps[activeSlotIndex]
  const currentProvider = providers.find(p => p.value === currentSlot.provider)
  const currentProviderModels = providerModels[currentSlot.provider] || []
  const isCustomModel = !currentProviderModels.some(m => m.value === currentSlot.model)

  const [useCustomModel, setUseCustomModel] = useState(isCustomModel)
  const [customModel, setCustomModel] = useState(isCustomModel ? (currentSlot.model || '') : '')

  useEffect(() => {
    const isCustom = !currentProviderModels.some(m => m.value === currentSlot.model)
    setUseCustomModel(isCustom)
    setCustomModel(isCustom ? (currentSlot.model || '') : '')
  }, [activeSlotIndex, currentSlot.provider])

  const updateLocalSettings = (updates: Partial<typeof localSettings>) => {
    setLocalSettings((prev) => {
      const next = { ...prev, ...updates }

      // If outputFormat changed, force update flags
      if ('outputFormat' in updates) {
        if (updates.outputFormat === 'word') {
          next.showWordList = true; next.showDetailedExplanation = false; next.showNuanceExplanation = false
        } else if (updates.outputFormat === 'sentence') {
          next.showWordList = false; next.showDetailedExplanation = true; next.showNuanceExplanation = false
        } else if (updates.outputFormat === 'full') {
          next.showWordList = true; next.showDetailedExplanation = true; next.showNuanceExplanation = true
        }
      }
      // If flags changed, recompute outputFormat
      else if ('showWordList' in updates || 'showDetailedExplanation' in updates || 'showNuanceExplanation' in updates) {
        next.outputFormat = computeOutputFormat(next.showWordList, next.showDetailedExplanation, next.showNuanceExplanation)
      }

      return next
    })
  }

  const updateActiveSlot = (updates: Partial<{ provider: LLMProvider, model: string }>) => {
    setLocalSettings(prev => {
      const nextSteps = [...prev.routingSteps]
      nextSteps[activeSlotIndex] = { ...nextSteps[activeSlotIndex], ...updates }
      if (activeSlotIndex === 0) {
        return { ...prev, routingSteps: nextSteps, provider: nextSteps[0].provider, model: nextSteps[0].model }
      }
      return { ...prev, routingSteps: nextSteps }
    })
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await new Promise(resolve => setTimeout(resolve, 600))

      settings.setSourceLanguage(localSettings.sourceLanguage)
      settings.setTargetLanguage(localSettings.targetLanguage)
      settings.setExplanationLanguage(localSettings.explanationLanguage)
      settings.setApiKeys(localSettings.apiKeys)
      settings.setCustomEndpoint(localSettings.customEndpoint?.trim() || undefined)
      settings.setTemperature(localSettings.temperature)
      settings.setSpeechRate(localSettings.speechRate)
      settings.setSpeechPitch(localSettings.speechPitch)

      Object.entries(localSettings.voicePreferences).forEach(([lang, name]) => {
        settings.setVoicePreference(lang as Language, name)
      })
      settings.setEnglishUkVoice(localSettings.englishUkVoiceName)

      settings.setRoutingCount(localSettings.routingCount)
      localSettings.routingSteps.forEach((step, i) => settings.setRoutingStep(i, step))

      settings.setShowWordList(localSettings.showWordList)
      settings.setShowDetailedExplanation(localSettings.showDetailedExplanation)
      settings.setShowNuanceExplanation(localSettings.showNuanceExplanation)
      settings.setOutputFormat(localSettings.outputFormat)

      toast.success('設定を保存しました')
    } catch (error) {
      console.error(error)
      toast.error('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    try {
      settings.reset()
      const resetState = useSettingsStore.getState()
      setLocalSettings({
        provider: resetState.provider,
        model: resetState.model,
        routingSteps: [...resetState.routingSteps],
        routingCount: resetState.routingCount,
        apiKeys: { ...resetState.apiKeys },
        customEndpoint: resetState.customEndpoint,
        temperature: resetState.temperature,
        speechRate: resetState.speechRate,
        speechPitch: resetState.speechPitch,
        voicePreferences: { ...resetState.voicePreferences },
        englishUkVoiceName: resetState.englishUkVoiceName,
        showWordList: resetState.showWordList,
        showDetailedExplanation: resetState.showDetailedExplanation,
        showNuanceExplanation: resetState.showNuanceExplanation,
        outputFormat: resetState.outputFormat,
        sourceLanguage: resetState.sourceLanguage,
        targetLanguage: resetState.targetLanguage,
        explanationLanguage: resetState.explanationLanguage,
      })
      setActiveSlotIndex(0)
      toast.success('設定をリセットしました')
    } catch (error) {
      console.error(error)
      toast.error('リセットに失敗しました')
    }
  }

  const filterVoicesByLang = (code: string) => availableVoices.filter(v => v.lang.startsWith(code))

  return (
    <div className="space-y-10 pb-20">
      {/* Page Header */}
      <div className="flex items-center gap-4 px-2">
        <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-xl shadow-primary/20">
          <Settings2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight">システム設定</h2>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-70">System Configuration</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Basic Configuration */}
        <Card className="overflow-hidden border-border/60 shadow-lg bg-card">
          <div className="p-6 bg-muted/30 border-b border-border/40 flex items-center gap-3">
            <Sliders className="w-5 h-5 text-primary" />
            <h3 className="font-black text-sm uppercase tracking-widest">基本・分析設定</h3>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
              <div className="space-y-3">
                <Label className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                  <Globe2 className="w-3 h-3" /> 翻訳元 (初期設定)
                </Label>
                <Select value={localSettings.sourceLanguage} onValueChange={(v: Language) => updateLocalSettings({ sourceLanguage: v })}>
                  <SelectTrigger className="h-12 rounded-xl font-bold bg-muted/20 border-border/80 focus:ring-primary"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl shadow-2xl">{languages.map((l) => (<SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                  <Send className="w-3 h-3" /> 翻訳先 (初期設定)
                </Label>
                <Select value={localSettings.targetLanguage} onValueChange={(v: Language) => updateLocalSettings({ targetLanguage: v })}>
                  <SelectTrigger className="h-12 rounded-xl font-bold bg-muted/20 border-border/80 focus:ring-primary"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl shadow-2xl">{languages.map((l) => (<SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" /> 解説に使用する言語
                </Label>
                <Select value={localSettings.explanationLanguage} onValueChange={(v: Language | 'auto') => updateLocalSettings({ explanationLanguage: v })}>
                  <SelectTrigger className="h-12 rounded-xl font-bold bg-muted/20 border-border/80 focus:ring-primary"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl shadow-2xl">
                    <SelectItem value="auto" className="font-bold text-primary">自動 (翻訳先の言語)</SelectItem>
                    <Separator className="my-1" />
                    {languages.map((l) => (<SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                  <Activity className="w-3 h-3" /> 分析の深度
                </Label>
                <Select value={localSettings.outputFormat} onValueChange={(v: OutputFormat) => updateLocalSettings({ outputFormat: v })}>
                  <SelectTrigger className="h-12 rounded-xl font-bold bg-muted/20 border-border/80 focus:ring-primary"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl shadow-2xl">
                    <SelectItem value="word">語彙重視</SelectItem>
                    <SelectItem value="sentence">文法重視</SelectItem>
                    <SelectItem value="full">包括的分析</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        {/* AI Engine Configuration */}
        <Card className="overflow-hidden border-border/60 shadow-lg bg-card/50 backdrop-blur-xl">
          <div className="p-6 bg-primary/5 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-black text-sm uppercase tracking-widest text-primary">AI 翻訳エンジン構成</h3>
            </div>
            <div className="flex gap-1.5 bg-muted/50 p-1.5 rounded-[1rem]">
              {[0, 1, 2, 3, 4].map((idx) => (
                <Button key={idx} variant="ghost" size="sm" onClick={() => setActiveSlotIndex(idx)} className={`h-9 w-12 rounded-lg text-[11px] font-black transition-all ${activeSlotIndex === idx ? 'bg-primary text-primary-foreground shadow-lg scale-105' : 'text-muted-foreground hover:bg-primary/10'}`}>#{idx + 1}</Button>
              ))}
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className={`p-5 rounded-2xl border flex items-center justify-between transition-colors ${activeSlotIndex === 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border/60'}`}>
              <div className="space-y-1">
                <span className="text-xs font-black text-primary uppercase tracking-widest">設定中のスロット: {activeSlotIndex + 1}</span>
                <p className="text-[11px] text-muted-foreground font-medium">{activeSlotIndex === 0 ? 'メインで使用される翻訳エンジンです。' : `フェイルオーバー候補 #${activeSlotIndex}。前段が失敗した場合に呼び出されます。`}</p>
              </div>
              {activeSlotIndex >= localSettings.routingCount && <Badge variant="secondary" className="font-black text-[10px]">未使用</Badge>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">プロバイダ</Label>
                <Select value={currentSlot.provider} onValueChange={(v: LLMProvider) => updateActiveSlot({ provider: v, model: providers.find(p => p.value === v)?.defaultModel })}>
                  <SelectTrigger className="h-12 rounded-xl font-bold border-border/80"><SelectValue /></SelectTrigger>
                  <SelectContent>{providers.map(p => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">AIモデル</Label>
                <Select value={useCustomModel ? 'custom' : currentSlot.model} onValueChange={(v) => { if (v === 'custom') setUseCustomModel(true); else { setUseCustomModel(false); updateActiveSlot({ model: v }); } }}>
                  <SelectTrigger className="h-12 rounded-xl font-bold border-border/80"><SelectValue /></SelectTrigger>
                  <SelectContent>{(providerModels[currentSlot.provider] || []).map(m => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}<Separator className="my-1" /><SelectItem value="custom" className="text-primary font-bold">カスタム入力...</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            {useCustomModel && (
              <div className="space-y-3">
                <Label className="text-[11px] font-black text-primary uppercase tracking-widest">カスタムモデル名</Label>
                <Input placeholder="モデルIDを入力 (例: gpt-4o)" value={customModel} onChange={(e) => { setCustomModel(e.target.value); updateActiveSlot({ model: e.target.value }) }} className="h-12 rounded-xl bg-primary/5 font-mono text-sm border-primary/20" />
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">{currentProvider?.label} APIキー</Label>
              <div className="relative group">
                <Input type={showApiKey ? 'text' : 'password'} value={localSettings.apiKeys[currentSlot.provider] || ''} onChange={(e) => setLocalSettings(p => ({ ...p, apiKeys: { ...p.apiKeys, [currentSlot.provider]: e.target.value } }))} className="h-12 rounded-xl pr-12 font-mono bg-muted/20 border-border/80 focus:border-primary transition-all" placeholder="sk-..." />
                <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-10 w-10 opacity-50 group-hover:opacity-100" onClick={() => setShowApiKey(!showApiKey)}>{showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
              </div>
              <div className="flex items-center gap-2 px-2 py-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <p className="text-[10px] text-muted-foreground font-medium italic">キーはローカルにのみ保存され、安全に保護されます。</p>
              </div>
            </div>

            <div className="pt-6 border-t border-border/40 grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-5">
                <div className="flex justify-between items-center"><Label className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">ルーティング深度</Label><Badge className="font-mono text-xs">{localSettings.routingCount} 段</Badge></div>
                <input type="range" min="1" max="5" value={localSettings.routingCount} onChange={(e) => updateLocalSettings({ routingCount: parseInt(e.target.value) })} className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
                <p className="text-[10px] text-muted-foreground/60 leading-relaxed">429 (Rate Limit) エラー発生時に自動で試行するバックアップの総数です。</p>
              </div>
              <div className="space-y-5">
                <div className="flex justify-between items-center"><Label className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">創造性 (Temperature)</Label><Badge className="font-mono text-xs">{localSettings.temperature?.toFixed(1)}</Badge></div>
                <input type="range" min="0" max="2" step="0.1" value={localSettings.temperature} onChange={(e) => updateLocalSettings({ temperature: parseFloat(e.target.value) })} className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
                <p className="text-[10px] text-muted-foreground/60 leading-relaxed">値が高いほど自由で自然な訳に、低いほど正確で一貫した訳になります。</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Section 3: Voice & Speech */}
        <Card className="overflow-hidden border-border/60 shadow-lg bg-card">
          <div className="p-6 bg-muted/30 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-primary" />
              <h3 className="font-black text-sm uppercase tracking-widest">音声読み上げ (TTS) 設定</h3>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsVoiceLibExpanded(!isVoiceLibExpanded)} className={`h-10 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all px-6 ${isVoiceLibExpanded ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-primary/10 text-primary border-primary/30'}`}>
              {isVoiceLibExpanded ? <><ChevronUp className="w-4 h-4 mr-2" /> ボイス詳細を隠す</> : <><ChevronDown className="w-4 h-4 mr-2" /> 言語ごとのボイス選択</>}
            </Button>
          </div>

          <div className="p-8 space-y-10">
            {/* Global TTS Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-5">
                <div className="flex justify-between items-center"><Label className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">読み上げ速度</Label><Badge className="bg-primary/10 text-primary font-mono">{localSettings.speechRate.toFixed(1)}x</Badge></div>
                <input type="range" min="0.5" max="2" step="0.1" value={localSettings.speechRate} onChange={(e) => updateLocalSettings({ speechRate: parseFloat(e.target.value) })} className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
              </div>
              <div className="space-y-5">
                <div className="flex justify-between items-center"><Label className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">声のピッチ (高さ)</Label><Badge className="bg-primary/10 text-primary font-mono">{localSettings.speechPitch.toFixed(1)}</Badge></div>
                <input type="range" min="0.5" max="2" step="0.1" value={localSettings.speechPitch} onChange={(e) => updateLocalSettings({ speechPitch: parseFloat(e.target.value) })} className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
              </div>
            </div>

            {/* Expandable Voice Library */}
            <AnimatePresence>
              {isVoiceLibExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pt-6 space-y-8">
                    <div className="flex items-center gap-4">
                      <Separator className="flex-1" />
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-50">Detailed Voice Library</span>
                      <Separator className="flex-1" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                      {languages.map((lang) => (
                        <div key={lang.value} className="space-y-4 p-5 rounded-2xl bg-muted/20 border border-border/40">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-primary/10 rounded-lg"><Globe2 className="w-4 h-4 text-primary" /></div>
                            <Label className="text-xs font-black uppercase tracking-widest">{lang.label} 音声</Label>
                          </div>

                          {lang.value === 'english' ? (
                            <div className="grid grid-cols-1 gap-5">
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold text-primary opacity-70 ml-1">US (アメリカ英語)</span>
                                <Select value={localSettings.voicePreferences.english || 'default'} onValueChange={(v) => updateLocalSettings({ voicePreferences: { ...localSettings.voicePreferences, english: v === 'default' ? undefined : v } })}>
                                  <SelectTrigger className="h-11 rounded-xl text-xs bg-background shadow-sm border-border/60"><SelectValue placeholder="システム標準" /></SelectTrigger>
                                  <SelectContent className="max-h-[300px]"><SelectItem value="default" className="font-bold">システム標準 (US)</SelectItem><Separator className="my-1" />{filterVoicesByLang('en-US').map((voice, i) => (<SelectItem key={`${voice.name}-${i}`} value={voice.name} className="text-xs">{voice.name}</SelectItem>))}</SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold text-blue-500 opacity-70 ml-1">UK (イギリス英語)</span>
                                <Select value={localSettings.englishUkVoiceName || 'default'} onValueChange={(v) => updateLocalSettings({ englishUkVoiceName: v === 'default' ? undefined : v })}>
                                  <SelectTrigger className="h-11 rounded-xl text-xs bg-background shadow-sm border-border/60"><SelectValue placeholder="システム標準" /></SelectTrigger>
                                  <SelectContent className="max-h-[300px]"><SelectItem value="default" className="font-bold">システム標準 (UK)</SelectItem><Separator className="my-1" />{filterVoicesByLang('en-GB').map((voice, i) => (<SelectItem key={`${voice.name}-${i}`} value={voice.name} className="text-xs">{voice.name}</SelectItem>))}</SelectContent>
                                </Select>
                              </div>
                            </div>
                          ) : (
                            <Select value={localSettings.voicePreferences[lang.value] || 'default'} onValueChange={(v) => updateLocalSettings({ voicePreferences: { ...localSettings.voicePreferences, [lang.value]: v === 'default' ? undefined : v } })}>
                              <SelectTrigger className="h-11 rounded-xl text-xs bg-background shadow-sm border-border/60"><SelectValue placeholder="システム標準" /></SelectTrigger>
                              <SelectContent className="max-h-[300px]"><SelectItem value="default" className="font-bold">システム標準</SelectItem><Separator className="my-1" />{filterVoicesByLang(lang.code).map((voice, i) => (<SelectItem key={`${voice.name}-${i}`} value={voice.name} className="text-xs">{voice.name}</SelectItem>))}</SelectContent>
                            </Select>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>

        {/* Visibility Toggles */}
        <Card className="p-8 rounded-[2rem] bg-card border-border/40 shadow-lg">
          <div className="flex items-center gap-3 mb-8">
            <Eye className="w-5 h-5 text-primary" />
            <h3 className="font-black text-sm uppercase tracking-widest">機能の有効化</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { id: 'showWordList', label: '語彙・熟語抽出', desc: 'Terminology extraction', icon: ListMusic },
              { id: 'showDetailedExplanation', label: '構文・文法解析', desc: 'Grammar analysis', icon: BookOpen },
              { id: 'showNuanceExplanation', label: 'ニュアンス解説', desc: 'Nuance & Context', icon: MessageSquare },
            ].map((t) => (
              <div key={t.id} className="flex flex-col gap-4 p-6 rounded-2xl bg-muted/20 border border-transparent hover:border-primary/20 transition-all group">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-background group-hover:bg-primary/10 transition-colors"><t.icon className="w-4 h-4 text-primary" /></div>
                  <Switch checked={(localSettings as any)[t.id]} onCheckedChange={(c) => updateLocalSettings({ [t.id]: c } as any)} className="data-[state=checked]:bg-primary" />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-black tracking-tight">{t.label}</Label>
                  <p className="text-[10px] text-muted-foreground font-medium">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button onClick={handleSave} disabled={isSaving} className="flex-[2] h-16 rounded-2xl font-black text-sm bg-primary shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all">
            {isSaving ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Save className="mr-3 h-5 w-5" />}
            {isSaving ? '保存中...' : '設定を適用して同期する'}
          </Button>
          <Button onClick={handleReset} variant="outline" className="flex-1 h-16 rounded-2xl font-black border-border/80 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all text-muted-foreground">
            <RotateCcw className="mr-3 h-5 w-5" />
            リセット
          </Button>
        </div>
      </div>
    </div>
  )
}
