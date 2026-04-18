const DEFAULT_CHAT_LIMIT_DAYS = 2;

function normalizarNumeroPositivo(...valores) {
  for (const valor of valores) {
    const numero = Number(valor);

    if (Number.isFinite(numero) && numero > 0) {
      return numero;
    }
  }

  return DEFAULT_CHAT_LIMIT_DAYS;
}

function obterMensagemDeAlerta(limitDays, remoteConfig) {
  const candidates = [
    remoteConfig?.alertMessage,
    remoteConfig?.alert_message,
    process.env.CHAT_LIMIT_ALERT_MESSAGE,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return `Este chat fica disponível por ${limitDays === 1 ? '1 dia' : `${limitDays} dias`}. Depois disso, a conversa é encerrada e você poderá reiniciar com as mesmas configurações ou voltar ao início.`;
}

async function carregarConfigRemota() {
  const configUrl = process.env.CHAT_RUNTIME_CONFIG_URL;

  if (!configUrl) {
    return null;
  }

  const headers = {};

  if (process.env.CHAT_RUNTIME_CONFIG_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${process.env.CHAT_RUNTIME_CONFIG_AUTH_TOKEN}`;
  }

  const response = await fetch(configUrl, {
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar configuração remota do chat: ${response.status}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido!' });
  }

  let remoteConfig = null;

  try {
    remoteConfig = await carregarConfigRemota();
  } catch (error) {
    console.error(error);
  }

  const conversationLimitDays = normalizarNumeroPositivo(
    remoteConfig?.conversationLimitDays,
    process.env.CHAT_CONVERSATION_LIMIT_DAYS,
  );

  return res.status(200).json({
    conversationLimitDays,
    alertMessage: obterMensagemDeAlerta(conversationLimitDays, remoteConfig),
    source: remoteConfig ? 'remote' : 'env',
  });
}
