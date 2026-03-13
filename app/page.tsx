"use client"

import { useState, useCallback, useEffect } from 'react'
import { Header } from '@/components/header'
import { UploadSection } from '@/components/upload-section'
import { StatsBar } from '@/components/stats-bar'
import { FiltersSection } from '@/components/filters-section'
import { ClientsGrid } from '@/components/clients-grid'
import { EditModal } from '@/components/edit-modal'
import { ToastNotification } from '@/components/toast-notification'
import { DispatchPanel } from '@/components/dispatch-panel'
import { ChatPanel } from '@/components/chat-panel'
import { StatisticsPanel } from '@/components/statistics-panel'
import { useAppStore } from '@/lib/store'
import type { Client } from '@/lib/types'

export default function HomePage() {
  const { clients, currentTab, setCurrentTab, setFilter, setActiveChatClientId } = useAppStore()
  const [showUpload, setShowUpload] = useState(true)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Verificar se já tem clientes carregados
  useEffect(() => {
    if (clients.length > 0) {
      setShowUpload(false)
    }
  }, [clients])

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }, [])

  const handleUploadComplete = useCallback(() => {
    setShowUpload(false)
  }, [])

  const handleNewUpload = useCallback(() => {
    setShowUpload(true)
  }, [])

  const handleEdit = useCallback((client: Client) => {
    setEditingClient(client)
  }, [])

  const handleOpenChat = useCallback((clientId: string) => {
    setActiveChatClientId(clientId)
    setCurrentTab('chat')
  }, [setActiveChatClientId, setCurrentTab])

  // Handler para tab favoritos
  useEffect(() => {
    if (currentTab === 'favoritos') {
      setFilter('starred')
    } else if (currentTab === 'dashboard') {
      setFilter('all')
    }
  }, [currentTab, setFilter])

  const renderContent = () => {
    if (showUpload && currentTab === 'dashboard') {
      return <UploadSection onUploadComplete={handleUploadComplete} showToast={showToast} />
    }

    switch (currentTab) {
      case 'dashboard':
      case 'favoritos':
        return (
          <>
            <StatsBar />
            <FiltersSection onNewUpload={handleNewUpload} showToast={showToast} />
            <ClientsGrid onEdit={handleEdit} onOpenChat={handleOpenChat} />
          </>
        )
      case 'disparos':
        return <DispatchPanel showToast={showToast} />
      case 'chat':
        return <ChatPanel showToast={showToast} />
      case 'estatisticas':
        return <StatisticsPanel />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
        {renderContent()}
      </main>

      {editingClient && (
        <EditModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          showToast={showToast}
        />
      )}

      {toast && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
