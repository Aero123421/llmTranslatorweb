'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import TranslationInterface from '@/components/TranslationInterface'
import SettingsPanel from '@/components/SettingsPanel'
import HistoryPanel from '@/components/HistoryPanel'
import { useSettingsStore } from '@/store/settingsStore'
import { History as HistoryIcon, Settings as SettingsIcon, Sun, Moon, Loader2, Globe2, Zap } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'translate' | 'settings' | 'history'>('translate')
  const [mounted, setMounted] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const isCollapsed = true // Sidebar always closed as requested
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

  const handleLogoClick = () => {
    setActiveTab('translate')
    setRefreshKey(prev => prev + 1) // Force reset TranslationInterface
  }

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    )
  }

  const navItems = [
    { id: 'translate' as const, icon: Zap, label: '翻訳実行', sub: '翻訳エンジン', alert: !apiKey },
    { id: 'history' as const, icon: HistoryIcon, label: '翻訳履歴', sub: 'アーカイブ', alert: false },
    { id: 'settings' as const, icon: SettingsIcon, label: 'システム設定', sub: 'LLM構成', alert: false },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row overflow-x-hidden overflow-hidden relative">
      {/* Fixed Collapsed Sidebar */}
      <TooltipProvider delayDuration={0}>
        <aside className="hidden lg:flex flex-col w-20 flex-shrink-0 border-r border-border/40 bg-zinc-50/50 dark:bg-zinc-950/50 backdrop-blur-xl transition-all duration-300 overflow-hidden h-screen fixed left-0 top-0 z-[110]">
          <div className="p-6 flex items-center justify-center">
            <button onClick={handleLogoClick} className="p-3 bg-primary shadow-2xl shadow-primary/40 rounded-[1.25rem] transition-transform hover:rotate-12 active:scale-90 duration-500">
              <Globe2 className="h-6 w-6 text-primary-foreground" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-8 space-y-3 overflow-hidden">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`relative w-full h-16 rounded-2xl transition-all duration-300 justify-center px-0 ${
                        isActive ? 'bg-primary text-primary-foreground shadow-xl shadow-primary/20 scale-[1.02]' : 'hover:bg-primary/10'
                      }`}
                      onClick={() => setActiveTab(item.id)}
                    >
                      <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-white/20' : 'bg-primary/10'}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      {item.alert && (
                        <span className="absolute top-3 right-3 h-2 w-2 bg-destructive rounded-full animate-pulse shadow-lg shadow-destructive/50" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-black text-xs tracking-widest ml-2">{item.label}</TooltipContent>
                </Tooltip>
              )
            })}
          </nav>

          <div className="p-4 flex flex-col gap-4 items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="rounded-xl border-border/40 hover:bg-primary/10 hover:text-primary transition-all" 
                  onClick={() => setDarkMode(!darkMode)}
                  aria-label={darkMode ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
                >
                  {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-black text-[10px] uppercase ml-2">
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </TooltipContent>
            </Tooltip>
          </div>
        </aside>
      </TooltipProvider>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 lg:ml-20 h-screen overflow-y-auto relative">
        <header className="lg:hidden sticky top-0 z-50 bg-background/80 backdrop-blur-3xl border-b border-border/40">
          <div className="flex items-center justify-between px-6 py-4">
            <button onClick={handleLogoClick} className="flex items-center gap-3 active:scale-95 transition-transform">
              <div className="p-2 bg-primary rounded-xl shadow-lg shadow-primary/20">
                <Globe2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-black tracking-tighter">AI BRIDGE</h1>
            </button>
            <Button variant="outline" size="icon" onClick={() => setDarkMode(!darkMode)} className="h-10 w-10 rounded-xl">
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <div className="flex-1 flex flex-col w-full max-w-[1600px] mx-auto overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'translate' ? (
              <motion.div key={`translate-${refreshKey}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex flex-col">
                <TranslationInterface />
              </motion.div>
            ) : (
              <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full h-full">
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

        {/* Mobile Nav */}
        <nav className="lg:hidden fixed bottom-6 left-6 right-6 bg-card/80 backdrop-blur-3xl border border-border/40 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-50 overflow-hidden">
          <div className="flex h-20 items-stretch px-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button key={item.id} className={`flex-1 flex flex-col items-center justify-center gap-1.5 transition-all relative ${isActive ? 'text-primary' : 'text-muted-foreground/60'}`} onClick={() => setActiveTab(item.id)}>
                  <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-primary/10 shadow-inner' : ''}`}><Icon className="h-5 w-5" /></div>
                  <span className={`text-[9px] font-black tracking-widest uppercase ${isActive ? 'opacity-100' : 'opacity-40'}`}>{item.label}</span>
                  {isActive && <motion.div layoutId="mobile-nav-indicator" className="absolute bottom-1 w-8 h-1 bg-primary rounded-full" />}
                </button>
              )
            })}
          </div>
        </nav>
      </main>
    </div>
  )
}
