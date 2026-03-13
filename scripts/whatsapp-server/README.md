# WhatsApp Server - GestorDisparo

Servidor Node.js com Baileys para integração real com WhatsApp.

## Instalação

```bash
cd scripts/whatsapp-server
npm install
```

## Executando

```bash
npm start
```

O servidor vai rodar em `http://localhost:3001`

## Configuração no Frontend

Para conectar o frontend com o servidor Baileys, você precisa atualizar a URL da API no arquivo `components/dispatch-panel.tsx`:

```typescript
// Altere de:
const response = await fetch('/api/whatsapp', ...)

// Para:
const response = await fetch('http://localhost:3001/api/connect', ...)
```

## Endpoints da API

### Status
```
GET /api/status
```
Retorna o status de todas as sessões conectadas.

### Conectar Sessão
```
POST /api/connect
Body: { "phoneNumber": "5511999999999" }
```
Inicia uma nova sessão. Retorna um QR Code para escanear.

### Obter QR Code
```
GET /api/qr/:phone
```
Retorna o QR Code atual para uma sessão específica.

### Desconectar
```
POST /api/disconnect
Body: { "phoneNumber": "5511999999999" }
```
Desconecta e remove a sessão.

### Enviar Mensagem
```
POST /api/send
Body: {
  "senderNumber": "5511999999999",
  "to": "5511888888888",
  "message": "Olá, {nome}!"
}
```
Envia uma mensagem única.

### Enviar em Massa
```
POST /api/send-bulk
Body: {
  "recipients": [
    { "phone": "5511888888888", "name": "João" },
    { "phone": "5511777777777", "name": "Maria" }
  ],
  "messages": [
    "Olá {nome}, tudo bem?",
    "Oi {nome}! Como vai?"
  ],
  "senderNumbers": ["5511999999999", "5511666666666"],
  "dispatchesPerNumber": 30
}
```
Envia mensagens em massa com rotação de números e mensagens aleatórias.

## Recursos

- **Multi-sessão**: Suporte para múltiplos números de WhatsApp
- **QR Code**: Geração automática de QR Code para conexão
- **Rotação de números**: Alterna entre números remetentes automaticamente
- **Mensagens aleatórias**: Seleciona mensagens aleatórias para evitar banimento
- **Delays inteligentes**: Intervalos aleatórios entre mensagens
- **Persistência**: Sessões são salvas e reconectam automaticamente

## Estrutura

```
whatsapp-server/
├── server.js       # Servidor principal
├── package.json    # Dependências
├── sessions/       # Dados das sessões (criado automaticamente)
└── README.md       # Este arquivo
```

## Importante

1. Este servidor deve ser executado localmente ou em um VPS
2. Cada número precisa escanear o QR Code na primeira vez
3. As sessões são persistidas e reconectam automaticamente
4. Use delays adequados para evitar banimentos

## Licença

MIT
