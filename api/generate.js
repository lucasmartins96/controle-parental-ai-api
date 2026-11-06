import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config({ path: ['.env.local', '.env'] });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Você é um assistente de controle parental AI. 
Suas respostas devem ser:
- Claras e diretas
- Apropriadas para diferentes faixas etárias
- Focadas em segurança digital e bem-estar
- Sem conteúdo prejudicial ou inadequado`;

const SUPPORTED_ROLES = new Set(['user', 'assistant', 'system', 'developer']);

function criarItemMensagem(message) {
  return {
    type: 'message',
    role: message.role,
    content: [
      {
        type: 'input_text',
        text: message.content,
      },
    ],
  };
}

function extrairTexto(content) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }

      if (item && typeof item.text === 'string') {
        return item.text.trim();
      }

      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizarMensagens(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => {
      if (!message || typeof message !== 'object') {
        return null;
      }

      const role = SUPPORTED_ROLES.has(message.role) ? message.role : null;
      const content = extrairTexto(message.content);

      if (!role || !content) {
        return null;
      }

      return {
        role,
        content,
      };
    })
    .filter(Boolean);
}

async function obterConversation({
  conversationId,
  conversationHistory,
  reutilizarExistente,
}) {
  if (
    reutilizarExistente &&
    typeof conversationId === 'string' &&
    conversationId.trim()
  ) {
    return openai.conversations.retrieve(conversationId.trim());
  }

  return openai.conversations.create({
    items: conversationHistory.map(criarItemMensagem),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido!' });
  }

  try {
    const { messages, history, message, conversationId } = req.body ?? {};
    const conversationHistory = normalizarMensagens(messages ?? history);
    const latestMessage = typeof message === 'string' ? message.trim() : '';
    const reutilizarConversation =
      Boolean(latestMessage) &&
      typeof conversationId === 'string' &&
      Boolean(conversationId.trim());

    if (
      latestMessage &&
      (conversationHistory.at(-1)?.role !== 'user' ||
        conversationHistory.at(-1)?.content !== latestMessage)
    ) {
      conversationHistory.push({
        role: 'user',
        content: latestMessage,
      });
    }

    if (!conversationHistory.length) {
      return res.status(400).json({
        error:
          'Nenhuma mensagem válida fornecida. Certifique-se de enviar um array de mensagens ou uma mensagem única.',
      });
    }

    const conversation = await obterConversation({
      conversationId,
      conversationHistory,
      reutilizarExistente: reutilizarConversation,
    });

    const input = reutilizarConversation
      ? [
          criarItemMensagem({
            role: 'user',
            content: latestMessage,
          }),
        ]
      : [];

    const stream = await openai.responses.create({
      model: 'gpt-5-nano',
      stream: true,
      instructions: SYSTEM_PROMPT,
      conversation: { id: conversation.id },
      input,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Conversation-Id', conversation.id);

    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        res.write(event.delta);
      }
    }

    res.end();
  } catch (error) {
    console.error(error);

    if (res.headersSent) {
      return res.end();
    }

    return res.status(500).json({ error: 'Erro interno' });
  }
}
