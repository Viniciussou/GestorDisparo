# Frontend - API Integration Complete ✅

## O que foi feito

### 1. Centralização de URLs da API
- ✅ Criado arquivo [lib/config.ts](lib/config.ts) com todas as URLs da API
- ✅ Variáveis de ambiente usando `NEXT_PUBLIC_BAILEYS_SERVER_URL`
- ✅ Endpoints estruturados para fácil manutenção

### 2. Atualização de Todos os Hooks
Atualizados para usar URLs dinâmicas:
- ✅ [lib/hooks/use-sessions.ts](lib/hooks/use-sessions.ts)
- ✅ [lib/hooks/use-contacts.ts](lib/hooks/use-contacts.ts)
- ✅ [lib/hooks/use-dispatch.ts](lib/hooks/use-dispatch.ts)
- ✅ [lib/hooks/use-messages.ts](lib/hooks/use-messages.ts)
- ✅ [lib/hooks/use-templates.ts](lib/hooks/use-templates.ts)

### 3. Configuração do .env.local
Adicionado:
```env
NEXT_PUBLIC_BAILEYS_SERVER_URL=https://api-1-ft6j.onrender.com
BAILEYS_SERVER_SECRET=gestor-disparo-secret
WEBHOOK_URL=https://api-1-ft6j.onrender.com/api/webhook/baileys
```

---

## Estrutura de Endpoints

Todos os endpoints agora estão centralizados em `lib/config.ts`:

```typescript
API_ENDPOINTS = {
  // Sessions
  SESSIONS: 'api/sessions'
  SESSION: (id) => 'api/sessions/{id}'
  SESSION_CONNECT: (id) => 'api/sessions/{id}/connect'
  
  // Contacts
  CONTACTS: 'api/contacts'
  CONTACT: (id) => 'api/contacts/{id}'
  
  // Dispatch
  DISPATCH: 'api/dispatch'
  DISPATCH_LOGS: 'api/dispatch/logs'
  DISPATCH_STATS: (period) => 'api/dispatch/stats?period={period}'
  
  // Messages
  CONVERSATIONS: 'api/conversations'
  CONVERSATION_MESSAGES: (jid) => 'api/conversations/{jid}/messages'
  MESSAGES: 'api/messages'
  
  // Templates
  TEMPLATES: 'api/templates'
  TEMPLATE: (id) => 'api/templates/{id}'
}
```

---

## Como Testar

### 1. Verifique se a API está rodando
```bash
curl https://api-1-ft6j.onrender.com/health
# Deve retornar: { "status": "ok" }
```

### 2. Abra o frontend
```bash
npm run dev
# Abra http://localhost:3000
```

### 3. Procure pelos logs de rede
Abra DevTools (F12) → Network Abas e:
- Veja requisições para `api-1-ft6j.onrender.com`
- Verifique status codes (200, 201, etc)

### 4. Procure por Console Errors
Se há algum erro na conexão, será mostrado no console do navegador

---

## Benefícios desta Arquitetura

1. **Mudança de URL fácil**: Altere apenas em `lib/config.ts`
2. **Type Safety**: TypeScript valida todos os endpoints
3. **Reutilização**: Imports sem hardcodagem
4. **Ambiente Dinâmico**: Usa `process.env` para configurações
5. **Logging**: Mostra qual URL está sendo usada ao iniciar

---

## Verificação Final

Para ter certeza que tudo está funcionando:

1. ✅ Arquivo `lib/config.ts` existe
2. ✅ Todos os hooks importam `API_ENDPOINTS`
3. ✅ `.env.local` tem `NEXT_PUBLIC_BAILEYS_SERVER_URL`
4. ✅ Frontend consegue chamar endpoints da API em Render
5. ✅ Respostas da API retornam com sucesso (status 200/201)

---

## Se Continuar com Problemas

### 1. Verifique CORS
Se vê erro de CORS, o servidor Baileys pode estar bloqueando requisições do frontend.

### 2. Verifique Headers
As requisições devem ter `Content-Type: application/json`

### 3. Verifique Autenticação
Se a API requer authorization token, adicione:
```typescript
export const getApiHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN || ''}`,
})
```

### 4. Debug profundo
Ative log level:
```env
LOG_LEVEL=debug
```

---

## Próximas Etapas

Quando tiver certeza que frontend-API está conectado:

1. Teste a criação de uma sessão
2. Escaneie o QR code do WhatsApp
3. Verifique se a sessão conecta
4. Teste envio/recebimento de mensagens

Aproveita! 🚀
