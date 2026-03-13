"use client"

import { FileSpreadsheet, Search, MessageCircle, Send, BarChart3, Star, LayoutDashboard } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'

export function Header() {
  const { currentTab, setCurrentTab, searchTerm, setSearchTerm } = useAppStore()

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'favoritos' as const, label: 'Favoritos', icon: Star },
    { id: 'disparos' as const, label: 'Disparos', icon: Send },
    { id: 'chat' as const, label: 'Chat', icon: MessageCircle },
    { id: 'estatisticas' as const, label: 'Estatísticas', icon: BarChart3 },
  ]

  return (
    <header className="flex justify-between items-center px-6 h-16 bg-card border-b border-border sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2.5 text-foreground font-semibold text-lg">
          <FileSpreadsheet className="w-8 h-8 text-primary" />
          <span>GestorDisparo</span>
        </div>
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
                currentTab === tab.id
                  ? 'text-foreground bg-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar por nome, CPF ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
    </header>
  )
}
