import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  runtime: 'edge',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido!' });
  }

  try {
    const { messages } = req.body;

    const stream = await openai.responses.create({
      model: 'gpt-4.1-mini',
      stream: true,
      input: [
        {
          role: 'system',
          content: 'Você é um assistente de controle parental AI.',
        },
        ...messages,
      ],
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        res.write(event.delta);
      }
    }

    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno' });
  }
}
