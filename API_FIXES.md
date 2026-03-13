# ✅ Erros Corrigidos - API WhatsApp

## Problema Encontrado

Error: `"Validation error: user_id and phone_number are required"`

**Localização**: `POST /api/whatsapp` com `action=connect`

---

## Causa Raiz

A rota estava chamando o Baileys Server com **parâmetros e endpoints incorretos**.

### ❌ Antes (Incorreto)

```javascript
// Endpoint errado
await tryBaileysServer(`/api/sessions/connect`, {
  method: "POST",
  body: JSON.stringify({
    sessionId: phoneNumber,        // ❌ Wrong param name
    userId: "550e8400-..."          // ❌ Wrong param name
  })
})
```

### ✅ Depois (Correto)

```javascript
// Endpoint correto
await tryBaileysServer(`/api/sessions`, {
  method: "POST",
  body: JSON.stringify({
    phone_number: phoneNumber,       // ✅ Correct param
    user_id: "550e8400-..."          // ✅ Correct param
  })
})
```

---

## Todas as Correções

### 1️⃣ **CONNECT ACTION**
- **Antes**: `/api/sessions/connect` com `{ sessionId, userId }`
- **Depois**: `/api/sessions` com `{ phone_number, user_id }`
- **Resultado**: Agora cria sessão corretamente

### 2️⃣ **DISCONNECT ACTION**
- **Antes**: `/api/disconnect` com POST
- **Depois**: `/api/sessions/{sessionId}` com DELETE
- **Resultado**: Segue padrão REST correto

### 3️⃣ **SEND MESSAGE ACTION**
- **Antes**: `/api/send` com `{ sessionId, to, message }`
- **Depois**: `/api/messages` com `{ session_id, remote_jid, content }`
- **Resultado**: Nomes de parâmetros corretos

### 4️⃣ **BULK SEND ACTION**
- **Antes**: `/api/send-bulk` com `{ recipients, messages, senderNumbers }`
- **Depois**: `/api/dispatch` com `{ contacts, messages, sessions }`
- **Resultado**: Melhor alinhamento com API real

### 5️⃣ **MELHORIAS NO LOGGING**
Adicionado logging detalhado em `tryBaileysServer`:
```javascript
console.log("[Baileys] Fazendo requisição para:", url)
console.error(`[Baileys] Erro ${response.status}:`, errorText)
console.log("[Baileys] Resposta OK:", data)
```

---

## Como Testar

### 1. Conectar WhatsApp
```bash
curl -X POST http://localhost:3000/api/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "action": "connect",
    "phoneNumber": "5511987654321"
  }'
```

**Resposta esperada agora**:
```json
{
  "success": true,
  "qr": "data:image/png;base64,...",
  "sessionId": "session-uuid"
}
```

### 2. Monitorar Logs
```bash
# Terminal do frontend
npm run dev
# Procure por [WhatsApp API] e [Baileys]
```

### 3. Verificar API Baileys
```bash
curl https://api-1-ft6j.onrender.com/health
# Deve retornar: { "status": "ok" }
```

---

## Status das Correções

- ✅ Conexão WhatsApp
- ✅ Desconexão
- ✅ Envio de mensagens
- ✅ Envio em massa
- ✅ Logging melhorado
- ✅ Tratamento de erros

---

## Próximas Etapas

1. **Reinicie o frontend**
   ```bash
   npm run dev
   ```

2. **Teste conectar WhatsApp novamente**
   - Vá ao dashboard
   - Clique em "Conectar WhatsApp"
   - EsperaQR code aparecer
   - Escaneie com seu telefone

3. **Verifique os logs**
   - Procure por `[Baileys] Fazendo requisição para: ...`
   - Procure por `[Baileys] Resposta OK:`
   - Se houver erro, aparecerá com `[Baileys] Erro NNN:`

4. **Se continuar dando erro**
   - Verifique se `BAILEYS_SERVER_URL` e `BAILEYS_SERVER_SECRET` estão corretos em `.env.local`
   - Verifique se Baileys Server está rodando em Render
   - Veja os logs em tempo real com cURL para debug

---

## Debug Detalhado

Se ainda tiver problemas, afaste mais via cURL:

```bash
# Teste direto o endpoint de criação de sessão no Render
curl -X POST https://api-1-ft6j.onrender.com/api/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer gestor-disparo-secret" \
  -d '{
    "phone_number": "5511987654321",
    "user_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

Se retornar sucesso, o problema era apenas nos nomes dos parâmetros (que já corrigimos).

---

## Arquivos Modificados

- [app/api/whatsapp/route.ts](app/api/whatsapp/route.ts)
  - ✅ action.connect: Corrigido endpoint e parâmetros
  - ✅ action.disconnect: Corrigido método e endpoint
  - ✅ action.send: Corrigido endpoint e parâmetros
  - ✅ action.send-bulk: Corrigido endpoint e parâmetros
  - ✅ tryBaileysServer: Melhorado logging
  - ✅ POST handler: Melhorado tratamento de erro

---

**Erros resolvidos! Agora a API deve funcionar corretamente. 🎉**
