"use client"

import { useEffect } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

interface ToastNotificationProps {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}

export function ToastNotification({ message, type, onClose }: ToastNotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={`fixed bottom-6 right-6 flex items-center gap-3 px-6 py-4 bg-card border rounded-md shadow-lg z-[1000] animate-in slide-in-from-right ${
        type === 'success' ? 'border-green-500' : 'border-red-500'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 text-green-500" />
      ) : (
        <XCircle className="w-5 h-5 text-red-500" />
      )}
      <span className="text-sm">{message}</span>
    </div>
  )
}
