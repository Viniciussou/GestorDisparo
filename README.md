# GestorDisparo - Sistema de Disparo WhatsApp

Sistema completo para gerenciamento de clientes e disparos automáticos de mensagens via WhatsApp.

## Funcionalidades

- ✅ Importação de planilhas Excel/CSV
- ✅ Gerenciamento de clientes com filtros e status
- ✅ Disparos automáticos em massa
- ✅ Chat integrado sem precisar abrir WhatsApp
- ✅ Múltiplos números remetentes
- ✅ Relatórios e logs de disparos
- ✅ Interface moderna e responsiva

## Como executar

### Desenvolvimento

1. Instalar dependências:
```bash
npm install
cd scripts/whatsapp-server && npm install
```

2. Executar ambos os servidores:
```bash
npm run dev:all
```

Ou no Windows, usar o script:
```bash
start.bat
```

Ou executar separadamente:
```bash
# Terminal 1 - Servidor WhatsApp
npm run whatsapp-server

# Terminal 2 - Aplicação Next.js
npm run dev
```

### Produção

1. Build da aplicação:
```bash
npm run build
```

2. Iniciar em produção:
```bash
# Iniciar servidor WhatsApp
npm run whatsapp-server

# Em outro terminal, iniciar Next.js
npm start
```

## Configuração do WhatsApp

1. Na interface, vá para "Disparos"
2. Adicione um número remetente
3. Clique em "Conectar" - será gerado um QR Code
4. Escaneie o QR Code com o WhatsApp no celular
5. O número ficará conectado para disparos

## Limites e Boas Práticas

- **Máximo recomendado:** 10 mensagens por hora por número (configurável)
- **Delays automáticos:**
  - 10-20 segundos entre mensagens individuais
  - 15-30 segundos entre mensagens em massa
  - 2-5 minutos de pausa a cada 5 mensagens
- **Intervalo mínimo:** 30 minutos entre ciclos de disparo
- Use múltiplos números para volumes maiores
- Monitore os logs para acompanhar o progresso
- **IMPORTANTE:** Respeite os limites do WhatsApp para evitar banimento

## ⚠️ Avisos de Segurança

- Não use para spam ou mensagens não solicitadas
- Mantenha backups das sessões WhatsApp
- Use números dedicados para disparos
- Monitore o status das conexões
- Em caso de desconexão, reconecte escaneando QR Code novamente

## API Endpoints

### Servidor WhatsApp (porta 3001)

- `GET /api/status` - Status das sessões
- `POST /api/connect` - Conectar número
- `POST /api/send` - Enviar mensagem única
- `POST /api/send-bulk` - Enviar em massa
- `GET /api/messages/:phone` - Mensagens recebidas

### API Next.js (/api/whatsapp)

- `POST` com `action` para diferentes operações

## Estrutura do Projeto

```
├── app/                    # Next.js App Router
├── components/             # Componentes React
├── lib/                    # Utilitários e store
├── scripts/whatsapp-server/# Servidor Baileys
└── public/                 # Assets estáticos
```

## Tecnologias

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **WhatsApp:** Baileys (Web WhatsApp API)
- **UI:** Radix UI, Lucide Icons
- **Planilhas:** XLSX

## Suporte

Para dúvidas ou problemas, verifique os logs do console e certifique-se de que ambos os servidores estão rodando.