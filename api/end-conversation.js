import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido!' });
  }

  const conversationId =
    typeof req.body?.conversationId === 'string' ? req.body.conversationId.trim() : '';
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'manual';

  if (!conversationId) {
    return res.status(200).json({
      ended: true,
      providerSignaled: false,
      reason,
    });
  }

  try {
    await openai.conversations.delete(conversationId);

    return res.status(200).json({
      ended: true,
      providerSignaled: true,
      conversationId,
      reason,
    });
  } catch (error) {
    console.error(error);

    return res.status(200).json({
      ended: true,
      providerSignaled: false,
      conversationId,
      reason,
    });
  }
}
