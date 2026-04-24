# Controle Parental AI

**🔗 https://controle-parental-ai-api.vercel.app/**

Assistente de controle parental com IA que fornece instruções personalizadas para proteger crianças e adolescentes na internet, baseadas no dispositivo utilizado, faixa etária e preocupações específicas dos pais.

## Sumário

- [Funcionalidades](#funcionalidades)
- [Fluxo da Aplicação](#fluxo-da-aplicação)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Configuração](#configuração)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [API](#api)
- [Desenvolvimento Local](#desenvolvimento-local)
- [Deploy](#deploy)

---

## Funcionalidades

- **Formulário de contexto inicial** — coleta dispositivo, faixa etária e principais preocupações dos pais
- **Chat com IA** — conversa em tempo real com GPT-4.1-nano via streaming
- **Gerenciamento de sessão** — histórico persistido no `localStorage` com expiração configurável (padrão: 2 dias)
- **Reinício de conversa** — ao expirar, permite reiniciar com os mesmos dados ou retornar ao início
- **Sistema de suporte** — formulário para reportar problemas, pedir ajuda ou enviar sugestões (cria issues no GitHub)
- **Proteção anti-spam** — rate limiting, honeypot e validação de tempo de preenchimento no endpoint de suporte

---

## Fluxo da Aplicação

```
index.html  ──(formulário preenchido)──►  chat.html
                                              │
                                    (conversa expira após N dias)
                                              │
                                              ▼
                                        pre-reset.html
                                       ┌─────┴──────┐
                                 (reiniciar)    (voltar ao início)
                                       │              │
                                   chat.html      index.html
```

Qualquer página pode acessar **help.html** para enviar feedback.

---

## Estrutura do Projeto

```
controle-parental-ai/
├── index.html          # Página inicial — formulário de contexto
├── chat.html           # Interface de chat com IA
├── help.html           # Formulário de suporte/feedback
├── pre-reset.html      # Página de conversa expirada
├── vercel.json         # Configuração do Vercel
├── package.json
│
├── api/                # Serverless functions (Vercel)
│   ├── generate.js         # Geração de resposta via OpenAI
│   ├── chat-config.js      # Configurações do chat (tempo limite, alertas)
│   ├── create-issue.js     # Criação de issue no GitHub
│   ├── end-conversation.js # Encerramento de conversa na OpenAI
│   ├── test.js             # Health check
│   ├── test-openai.js      # Teste de integração com OpenAI
│   └── test-stream.js      # Teste de streaming
│
├── js/                 # Scripts do frontend
│   ├── core.js             # Estado central, utilitários e navegação
│   ├── index.js            # Lógica da página inicial
│   ├── chat.js             # Lógica da interface de chat
│   ├── help.js             # Lógica do formulário de suporte
│   └── pre-reset.js        # Lógica da página de expiração
│
└── css/                # Estilos
    ├── base.css            # Reset global, variáveis CSS, tipografia
    ├── index.css           # Estilos da página inicial
    ├── chat.css            # Estilos da interface de chat
    ├── help.css            # Estilos da página de suporte
    └── pre-reset.css       # Estilos da página de expiração
```

---

## Configuração

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- [Vercel CLI](https://vercel.com/docs/cli)
- Conta na [OpenAI](https://platform.openai.com/) com acesso ao GPT-4.1-nano
- (Opcional) Token do GitHub para o sistema de suporte

### Instalação

```bash
npm install
```

### Arquivo `.env.local`

Crie um arquivo `.env.local` na raiz do projeto com as variáveis necessárias (veja a seção [Variáveis de Ambiente](#variáveis-de-ambiente)).

---

## Variáveis de Ambiente

### Obrigatórias

| Variável | Descrição |
|---|---|
| `OPENAI_API_KEY` | Chave de autenticação da API da OpenAI |

### Sistema de Suporte (GitHub Issues)

| Variável | Descrição |
|---|---|
| `GITHUB_TOKEN` | Personal Access Token do GitHub com permissão `issues:write` |
| `GITHUB_OWNER` | Nome do usuário ou organização dona do repositório |
| `GITHUB_REPO` | Nome do repositório onde as issues serão criadas |

### Configuração do Chat (opcionais)

| Variável | Padrão | Descrição |
|---|---|---|
| `CHAT_CONVERSATION_LIMIT_DAYS` | `2` | Número de dias até a conversa expirar |
| `CHAT_LIMIT_ALERT_MESSAGE` | *(mensagem padrão)* | Texto do alerta de limite exibido no chat |
| `CHAT_RUNTIME_CONFIG_URL` | — | URL de configuração remota (sobrescreve as variáveis acima) |
| `CHAT_RUNTIME_CONFIG_AUTH_TOKEN` | — | Token de autenticação para a URL de configuração remota |

> A configuração remota (`CHAT_RUNTIME_CONFIG_URL`) tem prioridade sobre as variáveis de ambiente individuais.

---

## API

### `POST /api/generate`

Gera uma resposta da IA em modo streaming.

**Body:**

```json
{
  "message": "Como ativar o controle parental no iPhone?",
  "messages": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }],
  "conversationId": "conv_abc123"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `message` | `string` | Sim | Mensagem atual do usuário |
| `messages` | `array` | Sim | Histórico de mensagens anteriores |
| `conversationId` | `string` | Não | ID de conversa existente na OpenAI (para reuso) |

**Resposta:** `text/plain` via streaming. O header `X-Conversation-Id` contém o ID da conversa para reuso.

---

### `GET /api/chat-config`

Retorna as configurações do chat.

**Resposta:**

```json
{
  "conversationLimitDays": 2,
  "alertMessage": "Esta conversa expira em 2 dias.",
  "source": "env"
}
```

| Campo | Descrição |
|---|---|
| `conversationLimitDays` | Dias até a conversa expirar |
| `alertMessage` | Mensagem de alerta exibida no chat |
| `source` | `"remote"` (configuração remota) ou `"env"` (variáveis de ambiente) |

---

### `POST /api/create-issue`

Cria uma issue no GitHub com o feedback do usuário.

**Body:**

```json
{
  "type": "problema",
  "email": "usuario@exemplo.com",
  "description": "Descrição detalhada do problema...",
  "company": "",
  "context": {
    "page": "chat.html",
    "conversationId": "conv_abc123",
    "messageCount": 5,
    "userAgent": "Mozilla/5.0...",
    "submittedAt": "2025-01-01T12:00:00.000Z"
  }
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `type` | `"ajuda"` \| `"problema"` \| `"sugestao"` | Sim | Tipo de feedback |
| `email` | `string` | Não | E-mail de contato do usuário |
| `description` | `string` | Sim | Descrição (10–5000 caracteres) |
| `company` | `string` | Não | Campo honeypot — deve estar vazio |
| `context` | `object` | Não | Dados técnicos de contexto |

**Rate limiting:** máximo de 3 requisições por IP a cada 10 minutos.

---

### `POST /api/end-conversation`

Encerra e remove uma conversa da OpenAI.

**Body:**

```json
{
  "conversationId": "conv_abc123",
  "reason": "expired"
}
```

**Resposta:**

```json
{
  "ended": true,
  "providerSignaled": true,
  "conversationId": "conv_abc123",
  "reason": "expired"
}
```

---

### `GET /api/test`

Health check da API.

**Resposta:** `{ "message": "Teste de API funcionando!" }`

---

## Desenvolvimento Local

```bash
npm run vercel:dev
```

A aplicação ficará disponível em `http://localhost:3000`.

> O comando `vercel dev` simula o ambiente de produção do Vercel localmente, incluindo as serverless functions em `/api`.

---

## Deploy

O projeto é configurado para deploy na [Vercel](https://vercel.com/).

```bash
vercel deploy
```

Certifique-se de configurar todas as [variáveis de ambiente obrigatórias](#variáveis-de-ambiente) no painel do projeto na Vercel antes de fazer o deploy em produção.

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML, CSS, JavaScript (ES Modules) |
| Backend | Node.js Serverless Functions (Vercel) |
| IA | OpenAI API — GPT-4.1-nano |
| Deploy | Vercel |
| Detecção de dispositivo | [ua-parser.js](https://github.com/faisalman/ua-parser-js) (CDN) |
| Analytics | Vercel Analytics |

---

## Licença

ISC — © Lucas Martins da Silva
