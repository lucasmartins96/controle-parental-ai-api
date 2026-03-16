export default async function GET(request) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

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
    await writer.write(`data: ${JSON.stringify({ content: message })}\n\n`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await writer.write('data: [DONE]\n\n');
  writer.close();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
