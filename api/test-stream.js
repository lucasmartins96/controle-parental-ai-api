export default async function handler(req, res) {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const messages = [
      'Olá! ',
      'Sou um assistente ',
      'respondendo em stream ',
      'como a OpenAI faz.',
      '\n\nEste é um exemplo ',
      'de resposta contínua ',
      'enviada em chunks.',
    ];

    for (const message of messages) {
      res.write(`data: ${JSON.stringify({ content: message })}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error(error);

    if (res.headersSent) {
      return res.end();
    }

    return res.status(500).json({ error: 'Erro interno' });
  }
}
