import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function POST(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido!' }), {
      status: 405,
    });
  }

  try {
    const { messages } = await request.json();

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

    const reader = stream.getReader();
    const encoder = new TextEncoder();

    return new Response(
      new ReadableStream({
        async start(controller) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(encoder.encode(value));
          }
          controller.close();
        },
      }),
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
        },
      },
    );
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500 });
  }
}
