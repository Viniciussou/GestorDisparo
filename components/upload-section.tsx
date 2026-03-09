"use client"

import { useCallback, useState } from 'react'
import { Upload, FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { generateId } from '@/lib/helpers'
import * as XLSX from 'xlsx'

interface UploadSectionProps {
  onUploadComplete: () => void
  showToast: (message: string, type: 'success' | 'error') => void
}

export function UploadSection({ onUploadComplete, showToast }: UploadSectionProps) {
  const { setClients } = useAppStore()
  const [isDragging, setIsDragging] = useState(false)

  const processFile = useCallback((file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv']
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()

    if (!validExtensions.includes(fileExtension)) {
      showToast('Por favor, selecione um arquivo Excel ou CSV válido.', 'error')
      return
    }

    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 })

        if (jsonData.length < 2) {
          showToast('A planilha está vazia ou não possui dados suficientes.', 'error')
          return
        }

        const headers = (jsonData[0] as string[]).map((h) => String(h).toLowerCase().trim())
        
        const clients = []
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as string[]
          if (!row || row.length === 0 || row.every((cell) => !cell)) continue

          const clientData: Record<string, string> = {}
          headers.forEach((header, index) => {
            if (header && row[index] !== undefined && row[index] !== null && row[index] !== '') {
              clientData[header] = String(row[index])
            }
          })

          if (Object.keys(clientData).length > 0) {
            clients.push({
              id: generateId(),
              data: clientData,
              status: null,
              statuses: [],
              starred: false,
              bank: null,
              dispatched: false,
              messages: [],
            })
          }
        }

        if (clients.length === 0) {
          showToast('Nenhum dado válido encontrado na planilha.', 'error')
          return
        }

        setClients(clients)
        showToast(`${clients.length} clientes importados com sucesso!`, 'success')
        onUploadComplete()
      } catch (error) {
        console.error('Erro ao processar arquivo:', error)
        showToast('Erro ao processar o arquivo. Verifique se é um Excel válido.', 'error')
      }
    }

    reader.readAsArrayBuffer(file)
  }, [setClients, showToast, onUploadComplete])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  return (
    <section className="flex justify-center py-10">
      <div className="bg-card border border-border rounded-xl p-10 max-w-2xl w-full">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors mb-8 ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary hover:bg-primary/5'
          }`}
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-5">
            <Upload className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Importe sua Planilha</h2>
          <p className="text-muted-foreground mb-2">
            Arraste e solte seu arquivo Excel aqui ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Formatos aceitos: .xlsx, .xls, .csv
          </p>
          <input
            type="file"
            id="fileInput"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button onClick={() => document.getElementById('fileInput')?.click()}>
            <FileUp className="w-4 h-4 mr-2" />
            Selecionar Arquivo
          </Button>
        </div>
        <div className="pt-6 border-t border-border">
          <h3 className="text-base font-semibold mb-4">Como funciona?</h3>
          <ul className="space-y-2">
            {[
              'Sua planilha deve ter cabeçalhos na primeira linha',
              'Colunas comuns: Nome, Número, CPF, Valor, Saldo',
              'Os dados serão organizados em cards individuais',
              'Você pode marcar status e destacar clientes',
            ].map((item, index) => (
              <li
                key={index}
                className="text-sm text-muted-foreground pl-6 relative before:content-['✓'] before:absolute before:left-0 before:text-green-500"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
