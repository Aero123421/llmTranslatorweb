'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useSettingsStore, LLMProvider, Language, OutputFormat, computeOutputFormat } from '@/store/settingsStore'
import { Eye, EyeOff, Save, RotateCcw, Settings2, ShieldCheck, Sparkles, Sliders, ListMusic, BookOpen, MessageSquare, Loader2 } from 'lucide-react'
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
    { label: 'GPT-5.2', value: 'gpt-5.2' },
    { label: 'GPT-5 Mini', value: 'gpt-5-mini' },
  ],
  grok: [
    { label: 'Grok 4.1 Fast', value: 'grok-4-1-fast' },
    { label: 'Grok 4.1 Fast (Non-Reasoning)', value: 'grok-4-1-fast-non-reasoning' },
  ],
}

const providers: { value: LLMProvider; label: string; defaultModel: string }[] = [
  { value: 'groq', label: 'Groq', defaultModel: 'llama-3.3-70b-versatile' },
  { value: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-2.5-flash' },
  { value: 'cerebras', label: 'Cerebras', defaultModel: 'gpt-oss-120b' },
  { value: 'openai', label: 'OpenAI', defaultModel: 'gpt-5.2' },
  { value: 'grok', label: 'Grok (xAI)', defaultModel: 'grok-4-1-fast' },
]

const languages: { value: Language; label: string }[] = [
  { value: 'japanese', label: '日本語' },
  { value: 'english', label: '英語' },
  { value: 'russian', label: 'ロシア語' },
  { value: 'chinese', label: '中国語' },
  { value: 'korean', label: '韓国語' },
  { value: 'spanish', label: 'スペイン語' },
]

export default function SettingsPanel() {
  const settings = useSettingsStore()
  const initialProvider = providers.find(p => p.value === settings.provider)
  const providerModelValues = providerModels[settings.provider].map((model) => model.value)
  const isCustomModel = Boolean(settings.model && !providerModelValues.includes(settings.model))
  const derivedOutputFormat = computeOutputFormat(
    settings.showWordList,
    settings.showDetailedExplanation,
    settings.showNuanceExplanation
  )
  const [showApiKey, setShowApiKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [useCustomModel, setUseCustomModel] = useState(isCustomModel)
  const [customModel, setCustomModel] = useState(isCustomModel ? settings.model ?? '' : '')
  const [localSettings, setLocalSettings] = useState({
    provider: settings.provider,
    apiKeys: { ...settings.apiKeys },  // Store all API keys
    customEndpoint: settings.customEndpoint,
    model: settings.model ?? initialProvider?.defaultModel ?? '',
    temperature: settings.temperature,
    showWordList: settings.showWordList,
    showDetailedExplanation: settings.showDetailedExplanation,
    showNuanceExplanation: settings.showNuanceExplanation,
    outputFormat: derivedOutputFormat,
    sourceLanguage: settings.sourceLanguage,
    targetLanguage: settings.targetLanguage,
  })

  // Get current provider's API key
  const currentApiKey = localSettings.apiKeys[localSettings.provider] || ''

  const selectedProvider = providers.find(p => p.value === localSettings.provider)
  const displayTemperature = (localSettings.temperature ?? 0.7).toFixed(1)

  const updateLocalSettings = (updates: Partial<typeof localSettings>) => {
    setLocalSettings((prev) => {
      const next = { ...prev, ...updates }
      return {
        ...next,
        outputFormat: computeOutputFormat(
          next.showWordList,
          next.showDetailedExplanation,
          next.showNuanceExplanation
        ),
      }
    })
  }

  const applyOutputFormat = (format: OutputFormat) => {
    setLocalSettings((prev) => {
      if (format === 'word') {
        return {
          ...prev,
          outputFormat: format,
          showWordList: true,
          showDetailedExplanation: false,
          showNuanceExplanation: false,
        }
      }
      if (format === 'sentence') {
        return {
          ...prev,
          outputFormat: format,
          showWordList: false,
          showDetailedExplanation: true,
          showNuanceExplanation: false,
        }
      }
      if (format === 'full') {
        return {
          ...prev,
          outputFormat: format,
          showWordList: true,
          showDetailedExplanation: true,
          showNuanceExplanation: true,
        }
      }
      return { ...prev, outputFormat: 'custom' }
    })
  }

  const handleSave = async () => {
    try {
      if (!currentApiKey.trim()) {
        toast.error('APIキーを入力してください')
        return
      }

      if (useCustomModel && !customModel.trim()) {
        toast.error('カスタムモデル名を入力してください')
        return
      }

      setIsSaving(true)

      // Simulate slight delay for feedback
      await new Promise(resolve => setTimeout(resolve, 600))

      settings.setSourceLanguage(localSettings.sourceLanguage)
      settings.setTargetLanguage(localSettings.targetLanguage)
      settings.setProvider(localSettings.provider)
      // Save all API keys - set each provider's key
      Object.entries(localSettings.apiKeys).forEach(([provider, key]) => {
        if (key) {
          // Temporarily switch to provider to set its key
          const currentProvider = settings.provider
          settings.setProvider(provider as LLMProvider)
          settings.setApiKey(key.trim())
          settings.setProvider(currentProvider)
        }
      })
      // Set current provider's key last to ensure it's current
      settings.setProvider(localSettings.provider)
      settings.setApiKey(currentApiKey.trim())
      const trimmedEndpoint = localSettings.customEndpoint?.trim()
      settings.setCustomEndpoint(trimmedEndpoint ? trimmedEndpoint : undefined)
      const resolvedModel = (useCustomModel ? customModel : localSettings.model)?.trim()
      settings.setModel(resolvedModel ? resolvedModel : undefined)
      settings.setTemperature(localSettings.temperature)
      if (localSettings.outputFormat === 'custom') {
        settings.setShowWordList(localSettings.showWordList)
        settings.setShowDetailedExplanation(localSettings.showDetailedExplanation)
        settings.setShowNuanceExplanation(localSettings.showNuanceExplanation)
        settings.setOutputFormat('custom')
      } else {
        settings.setOutputFormat(localSettings.outputFormat)
      }

      toast.success('設定を保存しました')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('保存中にエラーが発生しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    try {
      settings.reset()
      const resetState = useSettingsStore.getState()
      const resetProvider = providers.find(p => p.value === resetState.provider)
      const resetProviderModels = providerModels[resetState.provider].map((model) => model.value)
      const resetIsCustomModel = Boolean(resetState.model && !resetProviderModels.includes(resetState.model))
      setUseCustomModel(resetIsCustomModel)
      setCustomModel(resetIsCustomModel ? resetState.model ?? '' : '')
      setLocalSettings({
        provider: resetState.provider,
        apiKeys: { ...resetState.apiKeys },
        customEndpoint: resetState.customEndpoint,
        model: resetState.model ?? resetProvider?.defaultModel ?? '',
        temperature: resetState.temperature,
        showWordList: resetState.showWordList,
        showDetailedExplanation: resetState.showDetailedExplanation,
        showNuanceExplanation: resetState.showNuanceExplanation,
        outputFormat: computeOutputFormat(
          resetState.showWordList,
          resetState.showDetailedExplanation,
          resetState.showNuanceExplanation
        ),
        sourceLanguage: resetState.sourceLanguage,
        targetLanguage: resetState.targetLanguage,
      })
      toast.success('設定をデフォルトに戻しました')
    } catch (error) {
      console.error('Failed to reset settings:', error)
      toast.error('リセット中にエラーが発生しました')
    }
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header Badge */}
      <div className="flex items-center gap-3 px-1">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Settings2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight text-foreground/90 leading-tight">AI SYSTEM SETTINGS</h2>
          <p className="text-[10px] text-muted-foreground font-bold tracking-[0.2em] uppercase">Control the core translation engine</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Core Settings */}
        <Card className="p-6 md:p-8 rounded-[2rem] bg-card border-border/40 space-y-8 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Sliders className="w-4 h-4 text-primary opacity-50" />
            <h3 className="text-xs font-black tracking-[0.2em] uppercase text-muted-foreground">Startup Defaults</h3>
          </div>
          <p className="text-[10px] text-muted-foreground/60 font-medium -mt-4 mb-4 ml-6">These settings define the initial state when the app is launched.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Native Language</Label>
              <Select
                value={localSettings.sourceLanguage}
                onValueChange={(value: Language) => {
                  if (value === localSettings.targetLanguage) {
                    updateLocalSettings({
                      sourceLanguage: value,
                      targetLanguage: localSettings.sourceLanguage,
                    })
                  } else {
                    updateLocalSettings({ sourceLanguage: value })
                  }
                }}
              >
                <SelectTrigger className="h-12 rounded-xl bg-background/50 border-border/60 hover:bg-background transition-colors font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10 shadow-2xl">
                  {languages.map((lang) => (
                    <SelectItem
                      key={lang.value}
                      value={lang.value}
                      className="rounded-lg h-10 font-medium"
                    >
                      <div className="flex items-center justify-between w-full gap-4">
                        {lang.label}
                        {lang.value === localSettings.targetLanguage && (
                          <Badge variant="outline" className="text-[8px] h-4 py-0 px-1 opacity-50">TARGET</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Target Language</Label>
              <Select
                value={localSettings.targetLanguage}
                onValueChange={(value: Language) => {
                  if (value === localSettings.sourceLanguage) {
                    updateLocalSettings({
                      sourceLanguage: localSettings.targetLanguage,
                      targetLanguage: value,
                    })
                  } else {
                    updateLocalSettings({ targetLanguage: value })
                  }
                }}
              >
                <SelectTrigger className="h-12 rounded-xl bg-background/50 border-border/60 hover:bg-background transition-colors font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10 shadow-2xl">
                  {languages.map((lang) => (
                    <SelectItem
                      key={lang.value}
                      value={lang.value}
                      className="rounded-lg h-10 font-medium"
                    >
                      <div className="flex items-center justify-between w-full gap-4">
                        {lang.label}
                        {lang.value === localSettings.sourceLanguage && (
                          <Badge variant="outline" className="text-[8px] h-4 py-0 px-1 opacity-50">SOURCE</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Analysis Depth</Label>
            <Select
              value={localSettings.outputFormat}
              onValueChange={(value: OutputFormat) => applyOutputFormat(value)}
            >
              <SelectTrigger className="h-12 rounded-xl bg-background/50 border-border/60 hover:bg-background transition-colors font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-primary/10 shadow-2xl">
                <SelectItem value="word" className="rounded-lg h-10 font-medium">Terminology Focus</SelectItem>
                <SelectItem value="sentence" className="rounded-lg h-10 font-medium">Sentence Structure</SelectItem>
                <SelectItem value="full" className="rounded-lg h-10 font-medium">Comprehensive Analysis</SelectItem>
                <SelectItem value="custom" className="rounded-lg h-10 font-medium" disabled>Custom (Manual)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* AI Provider Settings */}
        <Card className="p-6 md:p-8 rounded-[2rem] bg-card/50 backdrop-blur-2xl border-border/40 space-y-8 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary opacity-50" />
            <h3 className="text-xs font-black tracking-[0.2em] uppercase text-muted-foreground">Provider Credentials</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Cloud Provider</Label>
              <Select
                value={localSettings.provider}
                onValueChange={(value: LLMProvider) => {
                  const providerDefault = providers.find((provider) => provider.value === value)?.defaultModel ?? ''
                  setUseCustomModel(false)
                  setCustomModel('')
                  setLocalSettings((prev) => ({
                    ...prev,
                    provider: value,
                    model: providerDefault,
                  }))
                }}
              >
                <SelectTrigger className="h-12 rounded-xl bg-background/50 border-border/60 hover:bg-background transition-colors font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10 shadow-2xl">
                  {providers.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value} className="rounded-lg h-10 font-medium">
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">LLM Model</Label>
              <Select
                value={useCustomModel ? 'custom' : (localSettings.model || selectedProvider?.defaultModel)}
                onValueChange={(value) => {
                  if (value === 'custom') {
                    setUseCustomModel(true)
                    setLocalSettings((prev) => ({
                      ...prev,
                      model: customModel,
                    }))
                  } else {
                    setUseCustomModel(false)
                    setLocalSettings((prev) => ({
                      ...prev,
                      model: value,
                    }))
                  }
                }}
              >
                <SelectTrigger className="h-12 rounded-xl bg-background/50 border-border/60 hover:bg-background transition-colors font-bold">
                  <SelectValue placeholder="Select Engine" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10 shadow-2xl">
                  {providerModels[localSettings.provider].map((model) => (
                    <SelectItem key={model.value} value={model.value} className="rounded-lg h-10 font-medium">
                      {model.label}
                    </SelectItem>
                  ))}
                  <Separator className="my-1 mx-2" />
                  <SelectItem value="custom" className="rounded-lg h-10 font-bold text-primary">Custom Input...</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <AnimatePresence>
            {useCustomModel && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="space-y-3"
              >
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 text-primary">Override Model Name</Label>
                <Input
                  placeholder="e.g. gpt-4o-2024-08-06"
                  value={customModel}
                  onChange={(e) => {
                    const nextValue = e.target.value
                    setCustomModel(nextValue)
                    setLocalSettings((prev) => ({
                      ...prev,
                      model: nextValue,
                    }))
                  }}
                  className="h-12 rounded-xl bg-primary/5 border-primary/20 focus:border-primary font-mono text-xs"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Secret API Key</Label>
            <div className="relative group/key">
              <Input
                type={showApiKey ? 'text' : 'password'}
                placeholder="Paste your secret key here..."
                value={currentApiKey}
                onChange={(e) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    apiKeys: {
                      ...prev.apiKeys,
                      [prev.provider]: e.target.value,
                    },
                  }))
                }
                className="h-12 rounded-xl bg-background/50 border-border/60 pr-12 focus:border-primary transition-all font-mono"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-10 w-10 text-muted-foreground hover:bg-transparent hover:text-foreground"
                onClick={() => setShowApiKey(!showApiKey)}
                aria-label={showApiKey ? 'APIキーを隠す' : 'APIキーを表示'}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#DA7756]/5 border border-[#DA7756]/10">
              <ShieldCheck className="w-3.5 h-3.5 text-[#DA7756]" />
              <p className="text-[10px] text-[#DA7756] font-bold uppercase tracking-tight">Saved locally. Never uploaded.</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Custom Endpoint (Optional)</Label>
            <Input
              placeholder="https://api.example.com/v1/chat/completions"
              value={localSettings.customEndpoint || ''}
              onChange={(e) =>
                updateLocalSettings({ customEndpoint: e.target.value })
              }
              className="h-12 rounded-xl bg-background/50 border-border/60 focus:border-primary transition-all font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground/50 font-medium ml-1">空欄の場合は各プロバイダの公式エンドポイントを使用します。</p>
          </div>

          <div className="space-y-4 pt-4 border-t border-border/20">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Temperature (Creativity Level)</Label>
                <p className="text-[10px] text-muted-foreground/40 font-medium">Higher = more creative/natural, Lower = more literal/precise.</p>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] h-5 tabular-nums border-primary/20 text-primary">{displayTemperature}</Badge>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={localSettings.temperature || 0.7}
              onChange={(e) =>
                updateLocalSettings({ temperature: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>
        </Card>

        {/* Visibility Toggles */}
        <Card className="p-6 md:p-8 rounded-[2rem] bg-card border-border/40 space-y-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-primary opacity-50" />
            <h3 className="text-xs font-black tracking-[0.2em] uppercase text-muted-foreground">Insight Visualization</h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {[
              { id: 'showWordList', label: 'Terminology List', desc: 'Real-time extraction of key vocabulary.', icon: ListMusic },
              { id: 'showDetailedExplanation', label: 'Grammar Probe', desc: 'In-depth linguistic structural analysis.', icon: BookOpen },
              { id: 'showNuanceExplanation', label: 'Contextual Probe', desc: 'Cultural and emotional tone mapping.', icon: MessageSquare },
            ].map((toggle) => (
              <div key={toggle.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-transparent hover:border-border/60 transition-all">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-background/80 shadow-sm border border-border/20">
                    <toggle.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs font-black tracking-tight">{toggle.label}</Label>
                    <p className="text-[9px] text-muted-foreground font-medium">{toggle.desc}</p>
                  </div>
                </div>
                <Switch
                  checked={(localSettings as any)[toggle.id]}
                  onCheckedChange={(checked) =>
                    updateLocalSettings({ [toggle.id]: checked } as Partial<typeof localSettings>)
                  }
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Global Controls */}
        <div className="flex flex-col sm:flex-row gap-4 px-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 h-14 rounded-2xl font-black text-xs tracking-[0.3em] uppercase shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all bg-primary"
            size="lg"
          >
            {isSaving ? (
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-3 h-5 w-5" />
            )}
            {isSaving ? 'SYNCING...' : 'APPLY SYSTEM CONFIG'}
          </Button>
          <Button onClick={handleReset} variant="outline" className="flex-1 h-14 rounded-2xl font-black text-xs tracking-[0.3em] uppercase border-border/60 hover:bg-zinc-100 dark:hover:bg-zinc-900" size="lg">
            <RotateCcw className="mr-3 h-5 w-5" />
            FACTORY RESET
          </Button>
        </div>
      </div>
    </div>
  )
}
