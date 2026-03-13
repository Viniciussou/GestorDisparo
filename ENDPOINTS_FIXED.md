# ✅ Endpoints Baileys Corrigidos

## Problema

Status 404: "Cannot POST /api/sessions"

A API do Baileys Server no Render usa **endpoints diferentes** do que estava no código.

---

## Endpoints Corretos (Conforme README)

### ✅ CONNECT
```
POST /api/connect
Body: { phone_number, user_id }
```

**Antes (❌ errado)**:
```javascript
POST /api/sessions
Body: { phone_number, user_id }
```

**Depois (✅ correto)**:
```javascript
POST /api/connect
Body: { phone_number, user_id }
```

---

### ✅ GET QR CODE
```
GET /api/status?phone={phone_number}
Response: { session: { qrCode, connected } }
```

**Antes (❌ errado)**:
```javascript
GET /api/sessions/{sessionId}
```

**Depois (✅ correto)**:
```javascript
GET /api/status?phone={phone}
```

---

### ✅ SEND MESSAGE
```
POST /api/send
Body: { phone, to, message }
```

**Antes (❌ errado)**:
```javascript
POST /api/messages
Body: { session_id, remote_jid, content }
```

**Depois (✅ correto)**:
```javascript
POST /api/send
Body: { phone, to, message }
```

---

### ✅ SEND BULK
```
POST /api/send-bulk
Body: { recipients, messages, senders }
```

**Antes (❌ errado)**:
```javascript
POST /api/dispatch
Body: { contacts, messages, sessions }
```

**Depois (✅ correto)**:
```javascript
POST /api/send-bulk
Body: { recipients, messages, senders }
```

---

## Como Testar

### Teste 1: Verificar Health
```bash
curl https://api-1-ft6j.onrender.com/health
# Resposta: { "status": "ok" }
```

### Teste 2: Conectar Nova Sessão
```bash
curl -X POST https://api-1-ft6j.onrender.com/api/connect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer gestor-disparo-secret" \
  -d '{
    "phone_number": "5511987654321",
    "user_id": "550e8400-e29b-41d4-a716-446655440000"
  }'

# Resposta esperada:
# { "success": true, "qr": "data:image/png;base64..." }
```

### Teste 3: Obtém Status
```bash
curl "https://api-1-ft6j.onrender.com/api/status?phone=5511987654321" \
  -H "Authorization: Bearer gestor-disparo-secret"

# Resposta esperada:
# { "success": true, "session": { "connected": true, "qrCode": "..." } }
```

### Teste 4: Enviar Mensagem
```bash
curl -X POST https://api-1-ft6j.onrender.com/api/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer gestor-disparo-secret" \
  -d '{
    "phone": "5511987654321",
    "to": "5511912345678",
    "message": "Olá!"
  }'

# Resposta esperada:
# { "success": true }
```

---

## Arquivo Modificado

- ✅ [app/api/whatsapp/route.ts](app/api/whatsapp/route.ts)
  - Endpoints atualizados para forma correta
  - Parâmetros ajustados
  - Melhor tratamento de respostas

---

## Próximas Etapas

1. **Reinicie o frontend**
   ```bash
   npm run dev
   ```

2. **Teste conectar WhatsApp novamente**
   - Abra o dashboard
   - Clique em "Conectar WhatsApp"
   - Agora deve gerar QR code sem erro 404

3. **Verifique os logs**
   - Procure por `[Baileys] Fazendo requisição`
   - Status deve ser 200, não 404

---

## Debug

Se ainda tiver problemas:

1. Verifique se `BAILEYS_SERVER_URL` e `BAILEYS_SERVER_SECRET` estão corretos em `.env.local`
2. Teste diretamente com cURL conforme os exemplos acima
3. Veja os logs no Render: https://dashboard.render.com
4. Verifique se o servidor Baileys está rodando

---

**Erros de endpoint resolvidos! 🎉**
