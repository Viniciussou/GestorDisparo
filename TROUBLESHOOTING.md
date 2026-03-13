# Troubleshooting - Erros de Conexão WhatsApp

## Erros Encontrados e Soluções

### 1. ❌ "Cannot coerce the result to a single JSON object"
**Problema**: Erro ao atualizar dados na base de dados quando a sessão não existe.

**Solução Aplicada**: ✅ Alterado de `.single()` para `.maybeSingle()` em:
- `updateSession()`
- `createSession()`
- `findOrCreateContact()`

**Status**: CORRIGIDO

---

### 2. ❌ "Webhook request failed (status: 401)"
**Problema**: O webhook está retornando 401 (Unauthorized), significa que o secret não está batendo.

**Verificação Necessária**:

1. **Acesse `.env.local` e verifique**:
```bash
BAILEYS_SERVER_SECRET=seu-secret-aqui
```

2. **No baileys-server/.env**, verifique:
```bash
SERVER_SECRET=seu-secret-aqui
WEBHOOK_SECRET=seu-secret-aqui
```

3. **Eles DEVEM SER IDÊNTICOS** ⚠️

**Como Corrigir**:
- Se está rodando **localmente**: use um secret simples como `test-secret`
- Se está em **produção (Render)**: certifique-se que ambos os `.env` têm o mesmo valor

**Status**: ⚠️ Requer configuração

---

### 3. ❌ "Stream Errored (code: 515)"
**Problema**: Erro de conexão com WhatsApp, sessão desconectou.

**Causas Possíveis**:
- Session state corrompido
- Sincronização de chats falhando
- Problema com sincronização de app state

**Solução**:
- Limpar diretório `baileys-server/sessions/[session-id]/`
- Refazer a conexão do WhatsApp (rescanear QR code)

**Status**: ⚠️ Pode ocorrer, é tratável

---

### 4. ❌ "failed to sync state from version, removing and trying from scratch"
**Problema**: Erro ao sincronizar histórico de chats com WhatsApp.

**Por Que Acontece**:
- Estado local desincronizado com servidor WhatsApp
- Primeiro sync geralmente é lento

**Solução**: 
- É normal na primeira conexão, aguarde terminar
- Se persistir, limpe a sessão e reconecte

**Status**: ⚠️ Geralmente se resolve sozinho

---

## Checklist de Configuração

- [ ] `.env.local` tem `BAILEYS_SERVER_SECRET` definido
- [ ] `baileys-server/.env` tem `SERVER_SECRET` com o MESMO valor
- [ ] `WEBHOOK_URL` apontando para a URL correta (localhost ou produção)
- [ ] Supabase URLs e keys estão corretas
- [ ] Se está em produção, usar URLs HTTPS

---

## Como Testar a Conexão

### 1. Teste Local
```bash
# Terminal 1 - Baileys Server
cd baileys-server
npm start

# Terminal 2 - Next.js App
npm run dev

# Abra: http://localhost:3000
```

### 2. Monitore os Logs
- **Baileys**: Procure por "QR code received" e "Connection opened"
- **Next.js**: Procure por erros no console no navegador

### 3. Verifique o Webhook
Se você vê "Webhook request failed", o problema é autenticação:
```bash
# No log do Next.js, você deve ver:
# [Webhook] Secret verification failed ou
# [Webhook] BAILEYS_SERVER_SECRET not configured
```

---

## Passada Recente de Correções

✅ Melhorados erros de banco de dados:
- Usando `maybeSingle()` em vez de `single()`
- Verificando se sessão existe antes de atualizar

✅ Melhorada autenticação de webhook:
- Aceita múltiplas formas de header (x-server-secret, x-webhook-secret)
- Melhor logging de erros

✅ Melvorado tratamento de conexão:
- Evita tentar atualizar sessões inexistentes
- Erros de DB não quebram a sessão

---

## O Que Fazer Agora

1. **Verifique os secrets** (veja acima)
2. **Reinicie ambos os servidores** (Baileys + Next.js)
3. **Tente conectar WhatsApp novamente**
4. **Verifique os logs** para novos erros

Se ainda tiver problemas, analise os logs procurando por:
- `Error:` ou `error:`
- `failed` ou `Failed`
- Status codes (401, 500, etc)

---

## Debug Detalhado

Para ver mais detalhes, configure LOG_LEVEL:
```bash
# .env.local / baileys-server/.env
LOG_LEVEL=debug
```

Isso vai mostrar mais informações sobre cada operação.
