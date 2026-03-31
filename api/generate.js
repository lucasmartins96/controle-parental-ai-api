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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido!' });
  }

  try {
    const { messages, history, message } = req.body ?? {};
    const conversationHistory = normalizarMensagens(messages ?? history);
    const latestMessage = typeof message === 'string' ? message.trim() : '';

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

    const stream = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      stream: true,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        ...conversationHistory,
      ],
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache, no-transform');

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;

      if (delta) {
        res.write(delta);
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
