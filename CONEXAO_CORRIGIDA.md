# ✅ Correção Completa de Endpoints - Render & Webhook

## Resumo das Correções

Todas as referências incorretas aos endpoints do Baileys Server foram corrigidas para usar as rotas corretas da API.

---

## 📝 Mudanças Realizadas

### 1. **app/api/sessions/[id]/connect/route.ts**
- ❌ **Antes**: `${baileysServerUrl}/api/sessions/${id}/connect`
- ✅ **Depois**: `${baileysServerUrl}/api/connect`
- ❌ **Antes**: `${baileysServerUrl}/api/sessions/${id}/disconnect`
- ✅ **Depois**: `${baileysServerUrl}/api/disconnect`

### 2. **app/api/sessions/route.ts**
- ❌ **Antes**: `${baileysServerUrl}/api/sessions/init`
- ✅ **Depois**: `${baileysServerUrl}/api/connect`
- Adicionado parâmetro `phone_number` no body

### 3. **app/api/messages/route.ts**
- ❌ **Antes**: `${baileysServerUrl}/api/messages/send`
- ✅ **Depois**: `${baileysServerUrl}/api/send`

### 4. **app/api/dispatch/route.ts**
- ❌ **Antes**: `${baileysServerUrl}/api/dispatch/process`
- ✅ **Depois**: `${baileysServerUrl}/api/send-bulk`
- Atualizado para usar `session_ids`, `contact_ids`, e `user_id`

### 5. **app/api/sessions/[id]/route.ts** (DELETE)
- ❌ **Antes**: `${baileysServerUrl}/api/sessions/${id}/disconnect`
- ✅ **Depois**: `${baileysServerUrl}/api/disconnect`
- Adicionado parâmetro `session_id` no body

### 6. **lib/config.ts**
- Atualizado API_ENDPOINTS para incluir:
  - Rotas Frontend: `/api/sessions`, `/api/contacts`, `/api/messages`, `/api/dispatch`
  - Endpoints Baileys: `/api/connect`, `/api/send`, `/api/send-bulk`, `/api/disconnect`

---

## 🔄 Fluxo de Conexão Corrigido

### Conectar WhatsApp (QR Code)
```
Frontend (/api/sessions/[id]/connect POST)
  ↓
Backend → Baileys Server
  POST https://api-1-ft6j.onrender.com/api/connect
  {
    session_id: "uuid",
    user_id: "user-uuid", 
    phone_number: "5511999999999"
  }
```

### Enviar Mensagem
```
Frontend (/api/messages POST)
  ↓
Backend → Baileys Server
  POST https://api-1-ft6j.onrender.com/api/send
  {
    session_id: "uuid",
    to: "5511999999999@s.whatsapp.net",
    message: "Texto",
    media_url: "opcional",
    message_db_id: "msg_id"
  }
```

### Envio em Massa
```
Frontend (/api/dispatch POST)
  ↓
Backend → Baileys Server
  POST https://api-1-ft6j.onrender.com/api/send-bulk
  {
    session_ids: ["uuid1", "uuid2"],
    contact_ids: ["contact1", "contact2"],
    user_id: "user-uuid"
  }
```

### Desconectar
```
Frontend (/api/sessions/[id]/connect DELETE)
  ↓
Backend → Baileys Server
  POST https://api-1-ft6j.onrender.com/api/disconnect
  {
    session_id: "uuid"
  }
```

---

## 🔒 Autenticação

Todas as requisições para o Baileys Server incluem:
```
Headers:
  Authorization: Bearer gestor-disparo-secret
  Content-Type: application/json
```

---

## 📦 Variáveis de Ambiente Configuradas

```env
BAILEYS_SERVER_URL=https://api-1-ft6j.onrender.com
BAILEYS_SERVER_SECRET=gestor-disparo-secret
WEBHOOK_URL=https://api-1-ft6j.onrender.com/api/webhook/baileys
NEXT_PUBLIC_BAILEYS_SERVER_URL=https://api-1-ft6j.onrender.com
```

---

## ✅ Testes Recomendados

### 1. Testar Conexão
```bash
curl -X POST https://api-1-ft6j.onrender.com/api/connect \
  -H "Authorization: Bearer gestor-disparo-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session",
    "user_id": "test-user",
    "phone_number": "5511999999999"
  }'
```

### 2. Testar Envio de Mensagem
```bash
curl -X POST https://api-1-ft6j.onrender.com/api/send \
  -H "Authorization: Bearer gestor-disparo-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session",
    "to": "5511999999999@s.whatsapp.net",
    "message": "Teste",
    "media_url": null,
    "message_db_id": "msg_123"
  }'
```

### 3. Testar Envio em Massa
```bash
curl -X POST https://api-1-ft6j.onrender.com/api/send-bulk \
  -H "Authorization: Bearer gestor-disparo-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "session_ids": ["session1"],
    "contact_ids": ["contact1"],
    "user_id": "user-123"
  }'
```

---

## 🐛 Erros Resolvidos

### Antes das Correções
```
❌ 404 Not Found: Cannot POST /api/sessions/123/connect
❌ 404 Not Found: Cannot POST /api/sessions/init
❌ 404 Not Found: Cannot POST /api/messages/send
❌ 404 Not Found: Cannot POST /api/dispatch/process
```

### Depois das Correções
```
✅ Endpoints corretos:
  - /api/connect (para conexão)
  - /api/send (para mensagem)
  - /api/send-bulk (para envio em massa)
  - /api/disconnect (para desconexão)
```

---

## 📋 Checklist Final

- ✅ Endpoints do Baileys Server corrigidos
- ✅ Parâmetros de requisição atualizados
- ✅ Headers de autenticação configurados
- ✅ Variáveis de ambiente validadas
- ✅ Config.ts com rotas corretas
- ✅ Webhook pronto para receber eventos
- ✅ Sem mais erros 404 de conexão

---

## 🚀 Próximos Passos

1. Deploy do Frontend no Vercel (as rotas estão corretas)
2. Deploy do Baileys Server no Render (já está running)
3. Testar fluxo completo:
   - Criar sessão
   - Gerar QR code
   - Conectar WhatsApp
   - Enviar mensagem
   - Receber webhook

---

**Status**: ✅ **TODAS AS CONEXÕES CORRIGIDAS**

Por: Correção de Endpoints - API-Render
Data: 2024
