'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useHistoryStore } from '@/store/historyStore'
import { Trash2, Calendar, Clock, Copy, Check, X, History, ChevronRight, ArrowRight, Sparkles } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { toast } from 'sonner'

const languageLabels: Record<string, string> = {
  japanese: '日本語',
  english: '英語',
  russian: 'ロシア語',
  chinese: '中国語',
  korean: '韓国語',
  spanish: 'スペイン語',
}

const providerLabels: Record<string, string> = {
  groq: 'Groq',
  gemini: 'Gemini',
  cerebras: 'Cerebras',
  openai: 'OpenAI',
  grok: 'Grok',
}

function formatTimestamp(timestamp: number): string {
  try {
    return formatDistanceToNow(timestamp, {
      addSuffix: true,
      locale: ja
    })
  } catch {
    return '不明'
  }
}

export default function HistoryPanel() {
  const { history, deleteHistoryItem, clearHistory } = useHistoryStore()
  const [selectedItem, setSelectedItem] = useState<ReturnType<typeof useHistoryStore.getState>['history'][number] | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const handleDelete = (id: string) => {
    try {
      deleteHistoryItem(id)
      setShowDeleteDialog(false)
      setSelectedItem(null)
      toast.success('履歴を削除しました')
    } catch (error) {
      console.error('Failed to delete history item:', error)
      toast.error('削除に失敗しました')
    }
  }

  const handleClearAll = () => {
    try {
      clearHistory()
      setShowClearDialog(false)
      setSelectedItem(null)
      toast.success('全ての履歴を削除しました')
    } catch (error) {
      console.error('Failed to clear history:', error)
      toast.error('全削除に失敗しました')
    }
  }

  const handleCopy = (text: string, field: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedField(field)
        toast.success('コピーしました', { duration: 1500 })
        setTimeout(() => setCopiedField(null), 2000)
      })
      .catch((error) => {
        console.error('Failed to copy text:', error)
        toast.error('コピーに失敗しました')
      })
  }

  const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header Badge */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-foreground/90 leading-tight">ARCHIVE</h2>
            <p className="text-[10px] text-muted-foreground font-bold tracking-[0.2em] uppercase">Your translation history</p>
          </div>
        </div>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowClearDialog(true)}
            className="h-9 px-4 text-muted-foreground hover:text-destructive hover:bg-destructive/5 text-[10px] font-black tracking-widest uppercase transition-all rounded-xl"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Clear All
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <Card className="p-16 flex items-center justify-center h-full border-dashed border-2 bg-muted/5 rounded-[2.5rem] min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto">
              <Calendar className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">No Archive Data</p>
              <p className="text-[11px] text-muted-foreground/40 font-medium">
                Your translation history will appear here.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="space-y-4 pb-4">
            <AnimatePresence>
              {sortedHistory.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Card
                    className="group relative p-6 cursor-pointer bg-card transition-all duration-300 border-border/60 hover:border-primary/40 rounded-[1.5rem] shadow-sm hover:shadow-xl hover:shadow-primary/5 overflow-hidden"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="flex flex-col gap-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[9px] font-black tracking-widest uppercase h-5 px-2">
                            {providerLabels[item.provider] || item.provider}
                          </Badge>
                          <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">
                            <Clock className="h-3 w-3 inline mr-1 opacity-40" />
                            {formatTimestamp(item.timestamp)}
                          </span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-4 h-4 text-primary" />
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                        <div className="text-center p-3 rounded-2xl bg-muted/20 border border-border/20">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{languageLabels[item.sourceLanguage] || item.sourceLanguage}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground/30" />
                        <div className="text-center p-3 rounded-2xl bg-primary/5 border border-primary/10">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{languageLabels[item.targetLanguage] || item.targetLanguage}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-semibold line-clamp-1 opacity-60">
                          {item.sourceText}
                        </p>
                        <p className="text-base font-black text-foreground line-clamp-2 leading-tight">
                          {item.targetText}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-[2.5rem] border-primary/20 bg-card/95 backdrop-blur-3xl shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
          {selectedItem && (
            <>
              <DialogHeader className="p-8 pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <DialogTitle className="text-xl font-black tracking-tight">TRANSLATION LOG</DialogTitle>
                </div>
                <DialogDescription className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-primary/20 text-primary">
                    {(providerLabels[selectedItem.provider] || selectedItem.provider)} : {selectedItem.model || 'AUTO'}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground/40 tabular-nums">
                    ARCHIVED {formatTimestamp(selectedItem.timestamp).toUpperCase()}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="translation" className="flex-1 flex flex-col min-h-0">
                <div className="px-8 overflow-x-auto">
                  <TabsList className="bg-muted/30 p-1.5 h-12 rounded-2xl border border-border/40 inline-flex w-full md:w-auto">
                    <TabsTrigger value="translation" className="rounded-xl px-8 font-black text-[10px] tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-lg">CONTENT</TabsTrigger>
                    <TabsTrigger value="words" disabled={!selectedItem.words} className="rounded-xl px-8 font-black text-[10px] tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-lg">
                      WORDS ({selectedItem.words?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="details" disabled={!selectedItem.detailedExplanation} className="rounded-xl px-8 font-black text-[10px] tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-lg">STRUCTURE</TabsTrigger>
                    <TabsTrigger value="nuance" disabled={!selectedItem.nuanceExplanation} className="rounded-xl px-8 font-black text-[10px] tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-lg">NUANCE</TabsTrigger>
                  </TabsList>
                </div>

                <ScrollArea className="flex-1 mt-6 px-8">
                  <div className="space-y-8 pb-8">
                    <TabsContent value="translation" className="space-y-8 mt-0">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{languageLabels[selectedItem.sourceLanguage] || selectedItem.sourceLanguage}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl"
                            onClick={() => handleCopy(selectedItem.sourceText, 'source')}
                            aria-label="原文をコピー"
                          >
                            {copiedField === 'source' ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                        <div className="p-6 md:p-8 bg-muted/20 rounded-[2rem] border border-border/20 text-lg md:text-2xl font-bold leading-relaxed tracking-tight">
                          <span className="whitespace-pre-wrap">{selectedItem.sourceText}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{languageLabels[selectedItem.targetLanguage] || selectedItem.targetLanguage}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl"
                            onClick={() => handleCopy(selectedItem.targetText, 'target')}
                            aria-label="翻訳文をコピー"
                          >
                            {copiedField === 'target' ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                        <div className="p-6 md:p-8 bg-primary/5 rounded-[2rem] border border-primary/10 text-lg md:text-2xl font-black leading-relaxed tracking-tight text-foreground">
                          <span className="whitespace-pre-wrap">{selectedItem.targetText}</span>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="words" className="mt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedItem.words?.map((word, index) => (
                          <div key={index} className="p-6 bg-muted/20 border border-border/20 rounded-[2rem] space-y-2 group/word relative">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-4 right-4 h-8 w-8 rounded-xl opacity-0 group-hover/word:opacity-100 transition-opacity"
                              onClick={() => handleCopy(word.translated, `word-${index}`)}
                              aria-label={`「${word.original}」をコピー`}
                            >
                              {copiedField === `word-${index}` ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            <p className="font-black text-lg tracking-tight">{word.original}</p>
                            <p className="text-primary font-bold text-base">{word.translated}</p>
                            {word.meaning && (
                              <p className="text-[11px] text-muted-foreground font-semibold leading-relaxed">{word.meaning}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="details" className="mt-0">
                      <div className="p-8 md:p-10 bg-muted/20 rounded-[2rem] border border-border/20 text-lg md:text-2xl font-bold leading-[1.8] text-foreground/70 tracking-tight">
                        <span className="whitespace-pre-wrap">{selectedItem.detailedExplanation || ''}</span>
                      </div>
                    </TabsContent>

                    <TabsContent value="nuance" className="mt-0">
                      <div className="p-8 md:p-10 bg-amber-500/5 rounded-[2rem] border border-amber-500/10 text-lg md:text-2xl font-bold leading-[1.8] text-foreground/70 tracking-tight">
                        <span className="whitespace-pre-wrap">{selectedItem.nuanceExplanation || ''}</span>
                      </div>
                    </TabsContent>
                  </div>
                </ScrollArea>

                <div className="p-8 bg-muted/20 border-t border-border/40 flex items-center justify-end gap-3">
                  <Button variant="ghost" className="rounded-2xl font-black text-[10px] tracking-widest uppercase h-12 px-8 text-destructive hover:bg-destructive/5" onClick={() => setShowDeleteDialog(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Discard Item
                  </Button>
                  <Button variant="outline" className="rounded-2xl font-black text-[10px] tracking-widest uppercase h-12 px-8" onClick={() => setSelectedItem(null)}>
                    <X className="mr-2 h-4 w-4" />
                    Close Archive
                  </Button>
                </div>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete/Clear Dialogs */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="rounded-[2.5rem] p-8 space-y-6">
          <DialogHeader>
            <DialogTitle className="font-black tracking-tight text-xl">DELETE ARCHIVE?</DialogTitle>
            <DialogDescription className="font-medium text-xs leading-relaxed uppercase tracking-widest">
              This will permanently remove this translation from your records.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-black text-[10px] tracking-widest uppercase" onClick={() => setShowDeleteDialog(false)}>
              Keep Archive
            </Button>
            <Button
              variant="destructive"
              className="flex-1 h-12 rounded-xl font-black text-[10px] tracking-widest uppercase shadow-lg shadow-destructive/20"
              onClick={() => selectedItem && handleDelete(selectedItem.id)}
            >
              Destroy
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="rounded-[2.5rem] p-8 space-y-6">
          <DialogHeader>
            <DialogTitle className="font-black tracking-tight text-xl">WIPE ALL DATA?</DialogTitle>
            <DialogDescription className="font-medium text-xs leading-relaxed uppercase tracking-widest">
              CAUTION: This will purge your entire translation history.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-black text-[10px] tracking-widest uppercase" onClick={() => setShowClearDialog(false)}>
              Retain History
            </Button>
            <Button variant="destructive" className="flex-1 h-12 rounded-xl font-black text-[10px] tracking-widest uppercase shadow-lg shadow-destructive/20" onClick={handleClearAll}>
              Purge All
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
