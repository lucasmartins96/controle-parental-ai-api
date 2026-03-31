import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config({ path: ['.env.local', '.env'] });
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  try {
    const { messages } = req.body;
    const response = await openai.responses.create({
      model: 'gpt-4.1-nano',
      input: [
        {
          role: 'system',
          content:
            'Teste de integração da API OpenAI. Por favor, responda com uma piada se estiver funcionando corretamente.',
        },
        ...messages,
      ],
      stream: true,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const event of response) {
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

    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: error.message }));
  }
}
