import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  try {
    const { messages } = req.body;
    const response = await openai.responses.create({
      model: 'gpt-5-nano',
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
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: error.message,
      }),
    );
  }
}
