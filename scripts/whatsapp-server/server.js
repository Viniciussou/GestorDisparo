/**
 * Servidor WhatsApp com Baileys
 * 
 * Para executar:
 * 1. cd scripts/whatsapp-server
 * 2. npm install
 * 3. npm start
 * 
 * O servidor vai rodar na porta 3001
 */

import express from 'express'
import cors from 'cors'
import { makeWASocket, useMultiFileAuthState, DisconnectReason, delay } from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcode from 'qrcode'
import { Boom } from '@hapi/boom'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Armazenamento de sessões
const sessions = new Map()
const qrCodes = new Map()
const messageQueue = []
const receivedMessages = new Map() // phone -> array of messages

// Logger silencioso
const logger = pino({ level: 'silent' })

// Diretório para salvar sessões
const SESSIONS_DIR = path.join(__dirname, 'sessions')
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
}

/**
 * Formata número para padrão WhatsApp
 */
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '')
  
  // Adicionar código do país se não tiver
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned
  }
  
  // Adicionar 9 para números de celular se necessário
  if (cleaned.startsWith('55') && cleaned.length === 12) {
    const ddd = cleaned.substring(2, 4)
    const number = cleaned.substring(4)
    cleaned = `55${ddd}9${number}`
  }
  
  return cleaned + '@s.whatsapp.net'
}

/**
 * Cria uma nova sessão WhatsApp
 */
async function createSession(phoneNumber) {
  console.log(`[${phoneNumber}] Iniciando criação de sessão...`)
  const sessionDir = path.join(SESSIONS_DIR, phoneNumber)
  
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  console.log(`[${phoneNumber}] Estado de autenticação carregado`)
  
  const sock = makeWASocket({
    auth: state,
    logger,
    browser: ['GestorDisparo', 'Chrome', '120.0.0'],
    connectTimeoutMs: 60000,
    retryRequestDelayMs: 250,
    maxRetries: 5,
    // Removido printQRInTerminal depreciado
  })
  
  console.log(`[${phoneNumber}] Socket WhatsApp criado`)

  // Evento de conexão
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    console.log(`[${phoneNumber}] Update de conexão:`, { connection, qr: qr ? 'presente' : 'ausente' })
    
    if (qr) {
      console.log(`[${phoneNumber}] QR Code gerado - aguardando escaneamento`)
      console.log(`[${phoneNumber}] QR: ${qr}`)
      qrCodes.set(phoneNumber, qr)
      // Não imprimir QR no terminal, será mostrado no navegador
    }
    
    if (connection === 'close') {
      const errorCode = lastDisconnect?.error?.output?.statusCode
      const errorReason = lastDisconnect?.error?.data?.reason
      
      console.log(`[${phoneNumber}] Conexão fechada. Motivo:`, lastDisconnect?.error?.message || 'Desconhecido')
      console.log(`[${phoneNumber}] Código de erro:`, errorCode)
      console.log(`[${phoneNumber}] Razão:`, errorReason)
      console.log(`[${phoneNumber}] Detalhes completos:`, JSON.stringify(lastDisconnect?.error, null, 2))
      
      // Verificar se é erro de banimento ou restrição
      if (errorCode === 405 || errorReason === '405') {
        console.log(`[${phoneNumber}] ⚠️ ERRO 405 - Possível banimento, restrição ou sessão ativa`)
        console.log(`[${phoneNumber}] 💡 Possíveis causas:`)
        console.log(`   - Número banido ou restrito pelo WhatsApp`)
        console.log(`   - Sessão ativa no WhatsApp Web (desconecte primeiro)`)
        console.log(`   - Detecção de automação pelo WhatsApp`)
        console.log(`   - Problemas de rede ou configuração`)
        console.log(`[${phoneNumber}] 💡 Sugestões:`)
        console.log(`   - Desconecte qualquer sessão ativa no WhatsApp Web`)
        console.log(`   - Aguarde alguns minutos antes de tentar novamente`)
        console.log(`   - Use um número diferente se possível`)
        console.log(`   - Limpe a sessão antiga`)
      }
      
      console.log(`[${phoneNumber}] Sessão finalizada - aguardando nova conexão manual`)
      sessions.delete(phoneNumber)
      qrCodes.delete(phoneNumber)
      
      // Para erro 405, limpar sessão automaticamente
      if (errorCode === 405 || errorReason === '405') {
        console.log(`[${phoneNumber}] 🧹 Limpando sessão devido ao erro 405...`)
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true })
          console.log(`[${phoneNumber}] Sessão limpa. Tente conectar novamente.`)
        }
      }
    } else if (connection === 'open') {
      console.log(`[${phoneNumber}] ✅ Conexão estabelecida com sucesso!`)
      console.log(`[${phoneNumber}] Pronto para enviar mensagens`)
      qrCodes.delete(phoneNumber)
      sessions.set(phoneNumber, {
        socket: sock,
        connected: true,
        lastActivity: new Date(),
        dispatchCount: 0
      })
    }
  })

  // Salvar credenciais
  sock.ev.on('creds.update', saveCreds)

  // Mensagens recebidas
  sock.ev.on('messages.upsert', async (m) => {
    const message = m.messages[0]
    if (!message?.key?.fromMe && message?.message) {
      const from = message.key.remoteJid
      const text = message.message.conversation || 
                   message.message.extendedTextMessage?.text || 
                   ''
      
      console.log(`[${phoneNumber}] Mensagem recebida de ${from}: ${text}`)
      
      // Armazenar mensagem recebida
      if (!receivedMessages.has(phoneNumber)) {
        receivedMessages.set(phoneNumber, [])
      }
      
      const phoneMessages = receivedMessages.get(phoneNumber)
      phoneMessages.push({
        from,
        text,
        timestamp: new Date(),
        id: message.key.id
      })
      
      // Manter apenas últimas 100 mensagens por sessão
      if (phoneMessages.length > 100) {
        phoneMessages.shift()
      }
    }
  })

  sessions.set(phoneNumber, {
    socket: sock,
    connected: false,
    lastActivity: new Date(),
    dispatchCount: 0
  })

  return sock
}

/**
 * Envia mensagem
 */
async function sendMessage(senderNumber, to, message) {
  const session = sessions.get(senderNumber)
  
  if (!session || !session.connected) {
    console.log(`[${senderNumber}] ❌ Tentativa de envio falhou - não conectado`)
    throw new Error(`Número ${senderNumber} não está conectado`)
  }
  
  const jid = formatPhoneNumber(to)
  
  try {
    // Delay aleatório para evitar detecção de spam (10-20 segundos)
    // IMPORTANTE: Delays maiores reduzem risco de banimento
    const delayTime = 10000 + Math.random() * 10000
    console.log(`[${senderNumber}] ⏳ Aguardando ${Math.round(delayTime/1000)}s antes de enviar para ${to}...`)
    await delay(delayTime)
    
    console.log(`[${senderNumber}] 📤 Enviando mensagem para ${to}...`)
    await session.socket.sendMessage(jid, { text: message })
    
    session.dispatchCount++
    session.lastActivity = new Date()
    
    console.log(`[${senderNumber}] ✅ Mensagem enviada com sucesso para ${to} (total: ${session.dispatchCount})`)
    
    return { success: true, to, message }
  } catch (error) {
    console.error(`[${senderNumber}] ❌ Erro ao enviar para ${to}:`, error.message)
    throw error
  }
}

// ============ ROTAS DA API ============

// Status geral
app.get('/api/status', (req, res) => {
  const allSessions = Array.from(sessions.entries()).map(([phone, data]) => ({
    phone,
    connected: data.connected,
    lastActivity: data.lastActivity,
    dispatchCount: data.dispatchCount
  }))
  
  res.json({
    success: true,
    sessions: allSessions,
    queueSize: messageQueue.length
  })
})

// Obter QR Code
app.get('/api/qr/:phone', (req, res) => {
  const { phone } = req.params
  const qr = qrCodes.get(phone)
  
  if (qr) {
    // Gerar QR code como imagem base64
    qrcode.toDataURL(qr, { width: 300, margin: 2 }, (err, url) => {
      if (err) {
        res.status(500).json({ success: false, error: 'Erro ao gerar QR code' })
      } else {
        res.json({ success: true, qr, qrImage: url })
      }
    })
  } else {
    res.json({ success: false, message: 'QR Code não disponível' })
  }
})

// Conectar sessão
app.post('/api/connect', async (req, res) => {
  const { phoneNumber } = req.body
  
  if (!phoneNumber) {
    return res.status(400).json({ success: false, error: 'Número de telefone é obrigatório' })
  }
  
  const cleaned = phoneNumber.replace(/\D/g, '')
  
  try {
    console.log(`[API] Iniciando conexão para ${cleaned}`)
    
    // Verificar se já existe sessão
    const existing = sessions.get(cleaned)
    if (existing?.connected) {
      console.log(`[API] Sessão já conectada para ${cleaned}`)
      return res.json({
        success: true,
        message: 'Sessão já conectada',
        session: {
          phone: cleaned,
          connected: true,
          dispatchCount: existing.dispatchCount
        }
      })
    }
    
    console.log(`[API] Criando nova sessão para ${cleaned}`)
    // Criar nova sessão
    await createSession(cleaned)
    
    console.log(`[API] Aguardando QR ou conexão para ${cleaned}`)
    // Aguardar QR Code ou conexão - tentar por até 15 segundos
    let attempts = 0
    while (attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      const session = sessions.get(cleaned)
      const qr = qrCodes.get(cleaned)
      
      if (qr || session?.connected) {
        console.log(`[API] QR/conexão encontrada para ${cleaned}:`, { hasQr: !!qr, connected: session?.connected })
        break
      }
      attempts++
      console.log(`[API] Tentativa ${attempts}/15 para ${cleaned}`)
    }
    
    const session = sessions.get(cleaned)
    const qr = qrCodes.get(cleaned)
    
    console.log(`[API] Resultado final para ${cleaned}:`, { connected: session?.connected, hasQr: !!qr })
    
    // Se não conseguiu QR nem conexão, verificar se foi erro de banimento
    if (!qr && !session?.connected) {
      console.log(`[API] ⚠️ Número ${cleaned} parece estar banido ou restrito pelo WhatsApp`)
      console.log(`[API] 💡 Sugestões:`)
      console.log(`   - Use um número diferente que nunca foi usado para automação`)
      console.log(`   - Aguarde alguns dias se o número foi recentemente banido`)
      console.log(`   - Verifique se o número está correto`)
      
      return res.status(403).json({
        success: false,
        error: 'Erro 405: Número banido, restrito ou com sessão ativa no WhatsApp Web',
        banned: true,
        suggestions: [
          'Desconecte qualquer sessão ativa no WhatsApp Web primeiro',
          'Aguarde alguns minutos e tente novamente',
          'Use um número diferente que nunca foi usado para automação',
          'Verifique se o número está correto (com DDD e 9 dígitos)'
        ]
      })
    }
    
    res.json({
      success: true,
      message: qr ? 'Escaneie o QR Code no WhatsApp' : 'Conectando...',
      qr: qr || null,
      connected: session?.connected || false
    })
  } catch (error) {
    console.error(`[API] Erro ao conectar ${cleaned}:`, error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Desconectar sessão
app.post('/api/disconnect', async (req, res) => {
  const { phoneNumber } = req.body
  
  if (!phoneNumber) {
    return res.status(400).json({ success: false, error: 'Número de telefone é obrigatório' })
  }
  
  const cleaned = phoneNumber.replace(/\D/g, '')
  const session = sessions.get(cleaned)
  
  if (session?.socket) {
    await session.socket.logout()
    sessions.delete(cleaned)
    qrCodes.delete(cleaned)
  }
  
  res.json({ success: true, message: 'Sessão desconectada' })
})

// Limpar sessão (forçar limpeza de dados)
app.post('/api/clear-session', async (req, res) => {
  const { phoneNumber } = req.body
  
  if (!phoneNumber) {
    return res.status(400).json({ success: false, error: 'Número de telefone é obrigatório' })
  }
  
  const cleaned = phoneNumber.replace(/\D/g, '')
  const sessionDir = path.join(SESSIONS_DIR, cleaned)
  
  try {
    // Desconectar se estiver conectado
    const session = sessions.get(cleaned)
    if (session?.socket) {
      await session.socket.logout()
    }
    
    // Remover da memória
    sessions.delete(cleaned)
    qrCodes.delete(cleaned)
    
    // Remover arquivos da sessão
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true })
      console.log(`[${cleaned}] Sessão limpa manualmente`)
    }
    
    res.json({ success: true, message: 'Sessão limpa com sucesso' })
  } catch (error) {
    console.error(`Erro ao limpar sessão ${cleaned}:`, error)
    res.status(500).json({ success: false, error: 'Erro ao limpar sessão' })
  }
})

// Enviar mensagem única
app.post('/api/send', async (req, res) => {
  const { senderNumber, to, message } = req.body
  
  if (!senderNumber || !to || !message) {
    return res.status(400).json({ 
      success: false, 
      error: 'Campos obrigatórios: senderNumber, to, message' 
    })
  }
  
  try {
    const result = await sendMessage(senderNumber, to, message)
    res.json({ success: true, ...result })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Enviar mensagens em massa
app.post('/api/send-bulk', async (req, res) => {
  const { recipients, messages, senderNumbers, dispatchesPerNumber = 30 } = req.body
  
  if (!recipients || !messages || !senderNumbers) {
    return res.status(400).json({
      success: false,
      error: 'Campos obrigatórios: recipients, messages, senderNumbers'
    })
  }
  
  console.log(`[${senderNumbers.join(', ')}] 🚀 Iniciando envio em massa: ${recipients.length} destinatários, ${messages.length} mensagens`)
  
  const results = []
  let currentSenderIndex = 0
  let dispatchCount = 0
  let totalSent = 0
  
  for (const recipient of recipients) {
    const currentSender = senderNumbers[currentSenderIndex]
    
    // Escolher mensagem aleatória
    const randomMessage = messages[Math.floor(Math.random() * messages.length)]
    const personalizedMessage = randomMessage.replace(/{nome}/gi, recipient.name || '')
    
    try {
      console.log(`[${currentSender}] 📝 Preparando envio para ${recipient.phone} (${recipient.name || 'sem nome'})`)
      await sendMessage(currentSender, recipient.phone, personalizedMessage)
      
      results.push({
        to: recipient.phone,
        success: true,
        sender: currentSender
      })
      
      dispatchCount++
      totalSent++
      
      console.log(`[${currentSender}] ✅ Progresso: ${totalSent}/${recipients.length} enviadas`)
      
      // Rotacionar número se atingir o limite
      if (dispatchCount >= dispatchesPerNumber) {
        console.log(`[${currentSender}] 🔄 Rotacionando para próximo número (limite ${dispatchesPerNumber} atingido)`)
        currentSenderIndex = (currentSenderIndex + 1) % senderNumbers.length
        dispatchCount = 0
      }
      
      // Delay entre mensagens (15-30 segundos)
      const delayTime = 15000 + Math.random() * 15000
      console.log(`[${currentSender}] ⏳ Delay entre mensagens: ${Math.round(delayTime/1000)}s`)
      await delay(delayTime)
      
      // Pausa maior a cada 5 mensagens (2-5 minutos) - PREVINE BAN
      if (totalSent % 5 === 0) {
        const pauseMinutes = Math.round((120000 + Math.random() * 180000) / 60000)
        console.log(`[${currentSender}] ⏸️ Pausa preventiva de ${pauseMinutes} minutos após ${totalSent} mensagens`)
        await delay(120000 + Math.random() * 180000) // 2-5 minutos
      }
      
    } catch (error) {
      console.log(`[${currentSender}] ❌ Falha no envio para ${recipient.phone}: ${error.message}`)
      results.push({
        to: recipient.phone,
        success: false,
        error: error.message
      })
    }
  }
  
  console.log(`[${senderNumbers.join(', ')}] 🎉 Envio em massa concluído: ${results.filter(r => r.success).length} sucesso, ${results.filter(r => !r.success).length} falhas`)
  
  res.json({
    success: true,
    results,
    totalSent: results.filter(r => r.success).length,
    totalFailed: results.filter(r => !r.success).length
  })
})

// Obter conversas
app.get('/api/chats/:phone', async (req, res) => {
  const { phone } = req.params
  const session = sessions.get(phone)
  
  if (!session?.connected) {
    return res.status(400).json({ success: false, error: 'Sessão não conectada' })
  }
  
  try {
    const chats = await session.socket.groupFetchAllParticipating()
    res.json({ success: true, chats: Object.values(chats) })
  } catch (error) {
    res.json({ success: true, chats: [] })
  }
})

// Obter mensagens recebidas
app.get('/api/messages/:phone', (req, res) => {
  const { phone } = req.params
  const messages = receivedMessages.get(phone) || []
  
  res.json({ success: true, messages })
})

// Iniciar servidor
app.listen(PORT, () => {
  console.log('========================================')
  console.log('  WhatsApp Server - GestorDisparo')
  console.log('========================================')
  console.log(`Servidor rodando em http://localhost:${PORT}`)
  console.log('')
  console.log('Endpoints disponíveis:')
  console.log('  GET  /api/status         - Status das sessões')
  console.log('  GET  /api/qr/:phone      - Obter QR Code')
  console.log('  POST /api/connect        - Conectar sessão')
  console.log('  POST /api/disconnect     - Desconectar sessão')
  console.log('  POST /api/clear-session  - Limpar sessão (forçar limpeza)')
  console.log('  POST /api/send           - Enviar mensagem única')
  console.log('  POST /api/send-bulk      - Enviar em massa')
  console.log('  GET  /api/chats/:phone   - Obter conversas')
  console.log('  GET  /api/messages/:phone - Obter mensagens recebidas')
  console.log('========================================')
})
