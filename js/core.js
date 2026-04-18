const STORAGE_KEYS = {
  conversation: 'controleParentalAi.conversation',
  conversationId: 'controleParentalAi.conversationId',
  conversationStartedAt: 'controleParentalAi.conversationStartedAt',
  intake: 'controleParentalAi.intake',
};

export const ROUTES = {
  index: 'index.html',
  chat: 'chat.html',
  preReset: 'pre-reset.html',
};

const DEFAULT_CHAT_LIMIT_DAYS = 2;
const VALID_ROLES = new Set(['system', 'user', 'assistant', 'developer']);

let configDoChatPromise;

export function redirecionarPara(pagina) {
  window.location.replace(pagina);
}

function lerStorage(chave, valorPadrao) {
  try {
    const valor = localStorage.getItem(chave);
    return valor ? JSON.parse(valor) : valorPadrao;
  } catch (error) {
    console.error('Falha ao ler o storage:', error);
    return valorPadrao;
  }
}

function salvarStorage(chave, valor) {
  localStorage.setItem(chave, JSON.stringify(valor));
}

export function formatarQuantidadeDeDias(dias) {
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

export function normalizarConfigDoChat(config = {}) {
  const limiteEmDias = Number(config.conversationLimitDays);
  const conversationLimitDays =
    Number.isFinite(limiteEmDias) && limiteEmDias > 0
      ? limiteEmDias
      : DEFAULT_CHAT_LIMIT_DAYS;

  return {
    conversationLimitDays,
    conversationLimitMs: conversationLimitDays * 24 * 60 * 60 * 1000,
    alertMessage:
      typeof config.alertMessage === 'string' && config.alertMessage.trim()
        ? config.alertMessage.trim()
        : `Este chat fica disponível por ${formatarQuantidadeDeDias(conversationLimitDays)}. Depois disso, a conversa é encerrada e você poderá reiniciar com as mesmas configurações ou voltar ao início.`,
  };
}

export function obterConfigPadraoDoChat() {
  return normalizarConfigDoChat();
}

export async function obterConfigDoChat() {
  if (!configDoChatPromise) {
    configDoChatPromise = fetch('/api/chat-config', {
      cache: 'no-store',
    })
      .then(async (resposta) => {
        if (!resposta.ok) {
          throw new Error('Falha ao carregar a configuração do chat.');
        }

        return normalizarConfigDoChat(await resposta.json());
      })
      .catch((error) => {
        console.error(error);
        return obterConfigPadraoDoChat();
      });
  }

  return configDoChatPromise;
}

export function normalizarConversa(conversa) {
  if (!Array.isArray(conversa)) {
    return [];
  }

  return conversa
    .map((mensagem) => {
      if (!mensagem || typeof mensagem !== 'object') {
        return null;
      }

      const role = VALID_ROLES.has(mensagem.role) ? mensagem.role : null;
      const content = typeof mensagem.content === 'string' ? mensagem.content.trim() : '';

      if (!role || !content) {
        return null;
      }

      return { role, content };
    })
    .filter(Boolean);
}

export function obterConversa() {
  return normalizarConversa(lerStorage(STORAGE_KEYS.conversation, []));
}

export function salvarConversa(conversa) {
  salvarStorage(STORAGE_KEYS.conversation, normalizarConversa(conversa));
}

export function obterInicioDaConversa() {
  const inicio = lerStorage(STORAGE_KEYS.conversationStartedAt, null);
  return typeof inicio === 'number' && Number.isFinite(inicio) && inicio > 0
    ? inicio
    : null;
}

export function salvarInicioDaConversa(inicio) {
  if (typeof inicio === 'number' && Number.isFinite(inicio) && inicio > 0) {
    salvarStorage(STORAGE_KEYS.conversationStartedAt, inicio);
    return;
  }

  localStorage.removeItem(STORAGE_KEYS.conversationStartedAt);
}

export function obterConversationId() {
  const conversationId = lerStorage(STORAGE_KEYS.conversationId, null);
  return typeof conversationId === 'string' && conversationId.trim()
    ? conversationId.trim()
    : null;
}

export function salvarConversationId(conversationId) {
  if (typeof conversationId === 'string' && conversationId.trim()) {
    salvarStorage(STORAGE_KEYS.conversationId, conversationId.trim());
    return;
  }

  localStorage.removeItem(STORAGE_KEYS.conversationId);
}

export function obterContextoInicial() {
  return lerStorage(STORAGE_KEYS.intake, null);
}

export function salvarContextoInicial(contexto) {
  salvarStorage(STORAGE_KEYS.intake, contexto);
}

export function limparEstadoLocalDaConversa({ preservarContextoInicial = false } = {}) {
  localStorage.removeItem(STORAGE_KEYS.conversation);
  localStorage.removeItem(STORAGE_KEYS.conversationId);
  localStorage.removeItem(STORAGE_KEYS.conversationStartedAt);

  if (!preservarContextoInicial) {
    localStorage.removeItem(STORAGE_KEYS.intake);
  }
}

export function sincronizarInicioDaConversa() {
  const conversa = obterConversa();

  if (!conversa.length) {
    salvarConversationId(null);
    salvarInicioDaConversa(null);
    return;
  }

  if (!obterInicioDaConversa()) {
    salvarInicioDaConversa(Date.now());
  }
}

export function conversaEstaExpirada(configDoChat) {
  const inicioDaConversa = obterInicioDaConversa();

  if (!obterConversa().length || !inicioDaConversa) {
    return false;
  }

  return Date.now() - inicioDaConversa >= configDoChat.conversationLimitMs;
}

export async function sinalizarEncerramentoDaConversa({ motivo = 'manual' } = {}) {
  try {
    await fetch('/api/end-conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId: obterConversationId(),
        reason: motivo,
      }),
    });
  } catch (error) {
    console.error('Falha ao sinalizar o encerramento da conversa:', error);
  }
}

export async function encerrarConversaArmazenada({
  preservarContextoInicial = false,
  motivo = 'manual',
} = {}) {
  await sinalizarEncerramentoDaConversa({ motivo });
  limparEstadoLocalDaConversa({ preservarContextoInicial });
}

export function obterTextoOpcao(input) {
  if (!input) {
    return '';
  }

  return input.parentElement?.textContent.replace(/\s+/g, ' ').trim() || '';
}

function combinarPartes(...partes) {
  return partes.filter(Boolean).join(' ').trim();
}

export function obterDadosDoUAParser() {
  if (typeof window.UAParser !== 'function') {
    return {
      dispositivoDetectado: 'Dispositivo nao identificado',
      sistemaDetectado: 'Sistema nao identificado',
    };
  }

  const parser = new window.UAParser();
  const device = parser.getDevice();
  const os = parser.getOS();
  const dispositivoDetectado = combinarPartes(device.vendor, device.model);
  const sistemaDetectado = combinarPartes(os.name, os.version);

  return {
    dispositivoDetectado: dispositivoDetectado || 'Dispositivo nao identificado',
    sistemaDetectado: sistemaDetectado || 'Sistema nao identificado',
  };
}

function montarMensagemDeContexto(contexto) {
  return [
    'Contexto inicial do atendimento:',
    `Canal das instruções: ${contexto.destinoInstrucao}.`,
    `Dispositivo informado: ${contexto.nomeDispositivo}.`,
    `Dispositivo detectado no navegador: ${contexto.dispositivoDetectado}.`,
    `Sistema detectado no navegador: ${contexto.sistemaDetectado}.`,
    `Faixa etária: ${contexto.faixaEtaria}.`,
    `Preocupações principais: ${contexto.preocupacoes.join(', ')}.`,
    'Use esse contexto para personalizar as orientações e manter continuidade na conversa.',
  ].join('\n');
}

function montarInstrucaoInicialOculta() {
  return [
    'Inicie o atendimento sem cumprimentos longos.',
    'Explique os primeiros passos da configuração do controle parental de forma objetiva e adequada para a faixa etária informada.',
    'Se faltar alguma informação, faça uma pergunta por vez.',
  ].join(' ');
}

export function coletarDadosIniciais() {
  const dadosDoUAParser = obterDadosDoUAParser();
  const dispositivoSelecionado = document.querySelector(
    'input[name="dispositivo"]:checked',
  );
  const faixaEtariaSelecionada = document.querySelector(
    'input[name="faixa-etaria"]:checked',
  );
  const preocupacoesSelecionadas = Array.from(
    document.querySelectorAll('input[name="preocupacao"]:checked'),
  );
  const inputNomeDispositivo = document.getElementById('dispositivo-nome');
  const usandoOutroDispositivo = dispositivoSelecionado?.value === 'dispositivo-outro';
  const nomeDispositivo = usandoOutroDispositivo
    ? inputNomeDispositivo?.value.trim() || 'Não sei'
    : 'Dispositivo atual da criança ou adolescente';

  return {
    destinoInstrucao:
      obterTextoOpcao(dispositivoSelecionado) || 'Neste dispositivo atual',
    nomeDispositivo,
    dispositivoDetectado: dadosDoUAParser.dispositivoDetectado,
    sistemaDetectado: dadosDoUAParser.sistemaDetectado,
    faixaEtaria: obterTextoOpcao(faixaEtariaSelecionada) || 'Faixa etária não informada',
    preocupacoes: preocupacoesSelecionadas.map(
      (item) => obterTextoOpcao(item) || item.value,
    ),
  };
}

export function iniciarNovaConversa(contextoInicial) {
  const conversa = [
    {
      role: 'system',
      content: montarMensagemDeContexto(contextoInicial),
    },
    {
      role: 'developer',
      content: montarInstrucaoInicialOculta(),
    },
  ];

  salvarContextoInicial(contextoInicial);
  salvarConversa(conversa);
  salvarConversationId(null);
  salvarInicioDaConversa(Date.now());
}

export function atualizarTextoDoLimiteNaTelaDeReset(configDoChat) {
  const titulo = document.getElementById('pre-reset-title');
  const descricao = document.getElementById('pre-reset-description');

  if (titulo) {
    titulo.textContent = 'Esta conversa atingiu o limite de duração';
  }

  if (descricao) {
    descricao.textContent = `O chat foi encerrado após ${formatarQuantidadeDeDias(configDoChat.conversationLimitDays)}. Você pode iniciar uma nova conversa com as mesmas configurações ou voltar para o início.`;
  }
}