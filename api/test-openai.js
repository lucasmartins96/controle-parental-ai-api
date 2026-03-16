import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function POST(request) {
  try {
    const { messages } = await request.json();
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

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    for await (const event of response) {
      if (event.type === 'response.output_text.delta') {
        await writer.write(event.delta);
      }
    }

    writer.close();
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
