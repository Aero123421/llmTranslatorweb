'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import TranslationInterface from '@/components/TranslationInterface'
import SettingsPanel from '@/components/SettingsPanel'
import HistoryPanel from '@/components/HistoryPanel'
import { useSettingsStore } from '@/store/settingsStore'
import { Settings as SettingsIcon, History as HistoryIcon, Sun, Moon, Loader2, Globe2, ChevronRight, Zap } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'translate' | 'settings' | 'history'>('translate')
  const [mounted, setMounted] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const apiKey = useSettingsStore((state) => state.getApiKey())

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setDarkMode(savedTheme === 'dark' || (!savedTheme && prefersDark))
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    )
  }

  const navItems = [
    { id: 'translate' as const, icon: Zap, label: 'TRANSLATE', sub: 'AI Engine', alert: !apiKey },
    { id: 'history' as const, icon: HistoryIcon, label: 'ARCHIVE', sub: 'Saved Logs', alert: false },
    { id: 'settings' as const, icon: SettingsIcon, label: 'PREFERENCE', sub: 'LLM Config', alert: false },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:flex-shrink-0 border-r border-border/40 bg-zinc-50/50 dark:bg-zinc-950/50 backdrop-blur-xl">
        <div className="p-8">
          <div className="flex items-center gap-4 group">
            <div className="p-3 bg-primary shadow-2xl shadow-primary/40 rounded-[1.25rem] transition-transform group-hover:rotate-12 duration-500">
              <Globe2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tighter leading-none">ANTIGRAVITY</h1>
              <p className="text-[10px] font-black text-primary tracking-[0.3em] uppercase mt-1">Linguistic AI</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-3">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <Button
                key={item.id}
                variant="ghost"
                className={`w-full h-16 justify-start px-5 rounded-2xl relative transition-all duration-300 ${isActive ? 'bg-primary text-primary-foreground shadow-xl shadow-primary/20 scale-[1.02]' : 'hover:bg-primary/10'
                  }`}
                onClick={() => setActiveTab(item.id)}
                data-nav={item.id}
              >
                <div className={`p-2 rounded-xl mr-4 ${isActive ? 'bg-white/20' : 'bg-primary/10'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-xs font-black tracking-[0.2em] leading-tight truncate">{item.label}</span>
                  <span className={`text-[10px] font-bold ${isActive ? 'text-white/60' : 'text-muted-foreground/60'}`}>{item.sub}</span>
                </div>
                {item.alert && (
                  <span className="absolute top-4 right-4 h-2 w-2 bg-destructive rounded-full animate-pulse shadow-lg shadow-destructive/50" />
                )}
                {isActive && (
                  <motion.div layoutId="nav-indicator" className="ml-auto">
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </motion.div>
                )}
              </Button>
            )
          })}
        </nav>

        <div className="p-6">
          <div className="p-4 rounded-3xl bg-muted/40 border border-border/40 space-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-muted-foreground tracking-widest uppercase">System Theme</span>
              <span className="text-xs font-bold">{darkMode ? 'Deep Obsidian' : 'Pure Alabaster'}</span>
            </div>
            <Button
              variant="outline"
              className="w-full h-12 rounded-2xl bg-background border-border/40 shadow-sm"
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
            >
              {darkMode ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              <span className="text-[10px] font-black tracking-widest uppercase">Switch Appearance</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-50 bg-background/80 backdrop-blur-3xl border-b border-border/40">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-xl shadow-lg shadow-primary/20">
                <Globe2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-black tracking-tighter">ANTIGRAVITY</h1>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDarkMode(!darkMode)}
              className="h-10 w-10 rounded-xl"
              aria-label={darkMode ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex flex-col w-full max-w-[1400px] mx-auto overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'translate' ? (
              <motion.div
                key="translate"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full flex flex-col"
              >
                <TranslationInterface />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="w-full h-full"
              >
                <ScrollArea className="h-full">
                  <div className="p-6 lg:p-12 pb-24 lg:pb-12">
                    {activeTab === 'settings' && <SettingsPanel />}
                    {activeTab === 'history' && <HistoryPanel />}
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Navigation */}
        <nav className="lg:hidden fixed bottom-6 left-6 right-6 bg-card/80 backdrop-blur-3xl border border-border/40 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-50 overflow-hidden">
          <div className="flex h-20 items-stretch px-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  className={`flex-1 flex flex-col items-center justify-center gap-1.5 transition-all relative ${isActive ? 'text-primary' : 'text-muted-foreground/60'
                    }`}
                  onClick={() => setActiveTab(item.id)}
                  data-nav={item.id}
                  aria-label={item.label}
                  type="button"
                >
                  <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-primary/10 shadow-inner' : ''}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-[9px] font-black tracking-widest uppercase ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                    {item.label}
                  </span>
                  {item.alert && (
                    <span className="absolute top-4 right-1/3 h-1.5 w-1.5 bg-destructive rounded-full" />
                  )}
                  {isActive && (
                    <motion.div layoutId="mobile-nav-indicator" className="absolute bottom-1 w-8 h-1 bg-primary rounded-full" />
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      </main>
    </div>
  )
}
