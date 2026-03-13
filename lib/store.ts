"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Client, LegacyDispatchConfig, DispatchLog, Message, FilterType, SenderNumber } from './types'

interface AppState {
  // Clients
  clients: Client[]
  setClients: (clients: Client[]) => void
  updateClient: (id: string, updates: Partial<Client>) => void
  toggleStar: (id: string) => void
  setStatus: (id: string, status: string) => void
  setBank: (id: string, bank: string | null) => void
  addMessage: (clientId: string, message: Message) => void
  
  // Filters
  currentFilter: FilterType
  setFilter: (filter: FilterType) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  
  // Dispatch Config
  dispatchConfig: LegacyDispatchConfig
  setDispatchConfig: (config: Partial<LegacyDispatchConfig>) => void
  
  // Dispatch Logs
  dispatchLogs: DispatchLog[]
  addDispatchLog: (log: DispatchLog) => void
  clearDispatchLogs: () => void
  
  // Active Chat
  activeChatClientId: string | null
  setActiveChatClientId: (id: string | null) => void
  
  // UI State
  currentTab: 'dashboard' | 'favoritos' | 'estatisticas' | 'disparos' | 'chat'
  setCurrentTab: (tab: 'dashboard' | 'favoritos' | 'estatisticas' | 'disparos' | 'chat') => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Clients
      clients: [],
      setClients: (clients) => set({ clients }),
      updateClient: (id, updates) => set((state) => ({
        clients: state.clients.map((c) => 
          c.id === id ? { ...c, ...updates } : c
        )
      })),
      toggleStar: (id) => set((state) => ({
        clients: state.clients.map((c) => 
          c.id === id ? { ...c, starred: !c.starred } : c
        )
      })),
      setStatus: (id, status) => set((state) => ({
        clients: state.clients.map((c) => {
          if (c.id !== id) return c
          const statuses = [...(c.statuses || [])]
          const index = statuses.indexOf(status)
          if (index > -1) {
            statuses.splice(index, 1)
          } else {
            statuses.push(status)
          }
          return { ...c, statuses, status: statuses[0] || null }
        })
      })),
      setBank: (id, bank) => set((state) => ({
        clients: state.clients.map((c) => 
          c.id === id ? { ...c, bank } : c
        )
      })),
      addMessage: (clientId, message) => set((state) => ({
        clients: state.clients.map((c) =>
          c.id === clientId
            ? { ...c, messages: [...(c.messages || []), message] }
            : c
        )
      })),
      
      // Filters
      currentFilter: 'all',
      setFilter: (filter) => set({ currentFilter: filter }),
      searchTerm: '',
      setSearchTerm: (searchTerm) => set({ searchTerm }),
      
      // Dispatch Config
      dispatchConfig: {
        senderNumbers: [],
        selectedSenderIndex: 0,
        dispatchesPerNumber: 10,
        interval: 30,
        messages: [],
        numbersPerDispatch: 5,
        isActive: false,
      },
      setDispatchConfig: (config) => set((state) => ({
        dispatchConfig: { ...state.dispatchConfig, ...config }
      })),
      
      // Dispatch Logs
      dispatchLogs: [],
      addDispatchLog: (log) => set((state) => ({
        dispatchLogs: [log, ...state.dispatchLogs].slice(0, 1000)
      })),
      clearDispatchLogs: () => set({ dispatchLogs: [] }),
      
      // Active Chat
      activeChatClientId: null,
      setActiveChatClientId: (id) => set({ activeChatClientId: id }),
      
      // UI State
      currentTab: 'dashboard',
      setCurrentTab: (tab) => set({ currentTab: tab }),
    }),
    {
      name: 'gestor-disparo-storage',
    }
  )
)
