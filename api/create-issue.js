import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

const TIPOS_SUPORTADOS = new Set(['ajuda', 'problema', 'sugestao']);
const MAX_REQUISICOES_POR_JANELA = 3;
const JANELA_DE_RATE_LIMIT_MS = 10 * 60 * 1000;
const TEMPO_MINIMO_DE_PREENCHIMENTO_MS = 2500;
const tentativasPorIp = new Map();

const PREFIXOS_DE_TITULO = {
  ajuda: 'Ajuda',
  problema: 'Problema',
  sugestao: 'Sugestão',
};

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function obterConfiguracaoDoGithub() {
  const token = process.env.GITHUB_TOKEN;
  const owner =
    process.env.GITHUB_OWNER ||
    process.env.GITHUB_REPOSITORY_OWNER ||
    process.env.GITHUB_REPO_OWNER;
  const repo =
    process.env.GITHUB_REPO ||
    process.env.GITHUB_REPOSITORY_NAME ||
    process.env.GITHUB_REPO_NAME;

  if (!token || !owner || !repo) {
    throw new Error(
      'Configuração do GitHub ausente. Defina GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO.',
    );
  }

  return {
    token,
    owner,
    repo,
  };
}

function extrairTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function validarEmail(email) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function obterIpDoCliente(req) {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length) {
    return forwardedFor[0].trim();
  }

  return req.socket?.remoteAddress || 'ip-desconhecido';
}

function limparTentativasExpiradas(agora) {
  for (const [ip, tentativas] of tentativasPorIp.entries()) {
    const tentativasRecentes = tentativas.filter(
      (timestamp) => agora - timestamp < JANELA_DE_RATE_LIMIT_MS,
    );

    if (tentativasRecentes.length) {
      tentativasPorIp.set(ip, tentativasRecentes);
      continue;
    }

    tentativasPorIp.delete(ip);
  }
}

function verificarRateLimit(req) {
  const agora = Date.now();
  limparTentativasExpiradas(agora);

  const ip = obterIpDoCliente(req);
  const tentativasRecentes = tentativasPorIp.get(ip) || [];

  if (tentativasRecentes.length >= MAX_REQUISICOES_POR_JANELA) {
    throw new HttpError(
      'Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de enviar novamente.',
      429,
    );
  }

  tentativasRecentes.push(agora);
  tentativasPorIp.set(ip, tentativasRecentes);
}

function validarProtecaoAntiSpam(body = {}) {
  const honeypot = extrairTexto(body.company);
  const pageOpenedAt = Number(body.context?.pageOpenedAt);

  if (honeypot) {
    throw new HttpError('Não foi possível processar a solicitação.', 400);
  }

  if (Number.isFinite(pageOpenedAt)) {
    const tempoDePreenchimento = Date.now() - pageOpenedAt;

    if (
      tempoDePreenchimento >= 0 &&
      tempoDePreenchimento < TEMPO_MINIMO_DE_PREENCHIMENTO_MS
    ) {
      throw new HttpError('Envio muito rápido. Revise os dados e tente novamente.', 400);
    }
  }
}

function normalizarPayload(body = {}) {
  const type = extrairTexto(body.type).toLowerCase();
  const email = extrairTexto(body.email);
  const description = extrairTexto(body.description);
  const context = body.context && typeof body.context === 'object' ? body.context : {};

  if (!TIPOS_SUPORTADOS.has(type)) {
    throw new Error('Tipo inválido. Use ajuda, problema ou sugestão.');
  }

  if (!validarEmail(email)) {
    throw new Error(
      'Email inválido. Corrija o endereço informado ou deixe o campo vazio.',
    );
  }

  if (description.length < 10) {
    throw new Error('Descrição muito curta. Informe pelo menos 10 caracteres.');
  }

  return {
    type,
    email: email || null,
    description,
    context,
  };
}

function resumirDescricao(description) {
  const resumo = description.replace(/\s+/g, ' ').trim();

  if (resumo.length <= 72) {
    return resumo;
  }

  return `${resumo.slice(0, 69)}...`;
}

function formatarValorDeContexto(valor) {
  if (valor == null) {
    return 'Não informado';
  }

  if (typeof valor === 'string') {
    return valor.trim() || 'Não informado';
  }

  if (typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor);
  }

  try {
    return JSON.stringify(valor, null, 2);
  } catch {
    return 'Não foi possível serializar';
  }
}

function montarCorpoDaIssue({ type, email, description, context }) {
  return [
    '## Resumo',
    '',
    `Tipo: ${PREFIXOS_DE_TITULO[type]}`,
    `Email para contato: ${email || 'Não informado'}`,
    '',
    '## Descrição do atendimento',
    '',
    description,
    '',
    '## Contexto técnico (para equipe de desenvolvimento)',
    '',
    `Página: ${formatarValorDeContexto(context.page)}`,
    `Conversation ID: ${formatarValorDeContexto(context.conversationId)}`,
    `Quantidade de mensagens: ${formatarValorDeContexto(context.messageCount)}`,
    `Última role da conversa: ${formatarValorDeContexto(context.lastMessageRole)}`,
    `Data de envio: ${formatarValorDeContexto(context.submittedAt)}`,
    '',
    '### Contexto inicial coletado',
    '',
    '```json',
    formatarValorDeContexto(context.intake),
    '```',
    '',
    '### User agent',
    '',
    '```text',
    formatarValorDeContexto(context.userAgent),
    '```',
  ].join('\n');
}

async function criarIssueNoGithub(payload) {
  const { token, owner, repo } = obterConfiguracaoDoGithub();
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'controle-parental-ai-api',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
    body: JSON.stringify({
      title: `${PREFIXOS_DE_TITULO[payload.type]}: ${resumirDescricao(payload.description)}`,
      body: montarCorpoDaIssue(payload),
      labels: ['suporte', payload.type],
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detalhe =
      typeof data?.message === 'string' && data.message ? data.message : null;
    throw new Error(detalhe || 'Falha ao criar a solicitação.');
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    validarProtecaoAntiSpam(req.body);
    verificarRateLimit(req);
    const payload = normalizarPayload(req.body);
    const issue = await criarIssueNoGithub(payload);

    return res.status(201).json({
      message: 'Solicitação criada com sucesso.',
    });
  } catch (error) {
    console.error(error);

    return res.status(error instanceof HttpError ? error.status : 500).json({
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível criar a solicitação.',
    });
  }
}
