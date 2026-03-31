const STORAGE_KEYS = {
  conversation: 'controleParentalAi.conversation',
  intake: 'controleParentalAi.intake',
};

const ROUTES = {
  index: 'index.html',
  chat: 'chat.html',
};

const VALID_ROLES = new Set(['system', 'user', 'assistant', 'developer']);

let envioEmAndamento = false;

function obterPaginaAtual() {
  const pathname = window.location.pathname;
  const pagina = pathname.split('/').pop();

  return pagina || ROUTES.index;
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

function normalizarConversa(conversa) {
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

function obterConversa() {
  return normalizarConversa(lerStorage(STORAGE_KEYS.conversation, []));
}

function salvarConversa(conversa) {
  salvarStorage(STORAGE_KEYS.conversation, normalizarConversa(conversa));
}

function obterContextoInicial() {
  return lerStorage(STORAGE_KEYS.intake, null);
}

function salvarContextoInicial(contexto) {
  salvarStorage(STORAGE_KEYS.intake, contexto);
}

function obterMensagensVisiveis(conversa) {
  return conversa.filter(
    (mensagem) => mensagem.role === 'user' || mensagem.role === 'assistant',
  );
}

function redirecionarPara(pagina) {
  window.location.replace(pagina);
}

function obterTextoOpcao(input) {
  if (!input) {
    return '';
  }

  return input.parentElement?.textContent.replace(/\s+/g, ' ').trim() || '';
}

function combinarPartes(...partes) {
  return partes.filter(Boolean).join(' ').trim();
}

function obterDadosDoUAParser() {
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

function coletarDadosIniciais() {
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

function iniciarNovaConversa(contextoInicial) {
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
}

function configurarCampoDeDispositivo() {
  const radios = document.getElementsByName('dispositivo');
  const nomeInput = document.getElementById('dispositivo-nome-label');

  if (!radios.length || !nomeInput) {
    return;
  }

  const atualizarVisibilidade = () => {
    nomeInput.style.display = document.getElementById('dispositivo-outro')?.checked
      ? 'block'
      : 'none';
  };

  radios.forEach((radio) => {
    radio.addEventListener('change', atualizarVisibilidade);
  });

  atualizarVisibilidade();
}

function inicializarIndex() {
  if (obterConversa().length) {
    redirecionarPara(ROUTES.chat);
    return;
  }

  configurarCampoDeDispositivo();

  const formulario = document.getElementById('device-form');

  if (!formulario) {
    return;
  }

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();

    const submitterId = evento.submitter?.id;

    if (submitterId && submitterId !== 'gerar') {
      return;
    }

    const contextoInicial = coletarDadosIniciais();

    if (!contextoInicial.preocupacoes.length) {
      alert('Por favor, selecione pelo menos uma preocupação.');
      return;
    }

    iniciarNovaConversa(contextoInicial);
    redirecionarPara(ROUTES.chat);
  });
}

function criarElementoMensagem(role, content) {
  const mensagem = document.createElement('p');
  mensagem.className = `msg ${role === 'user' ? 'msg--me' : 'msg--other'}`;
  mensagem.textContent = content;
  return mensagem;
}

function renderizarHistorico() {
  const container = document.querySelector('.chat-messages');
  const areaDeEntrada = container?.querySelector('.chat-input');

  if (!container || !areaDeEntrada) {
    return;
  }

  container.querySelectorAll('.msg').forEach((elemento) => elemento.remove());

  const fragmento = document.createDocumentFragment();
  const mensagensVisiveis = obterMensagensVisiveis(obterConversa());

  mensagensVisiveis.forEach((mensagem) => {
    fragmento.appendChild(criarElementoMensagem(mensagem.role, mensagem.content));
  });

  container.insertBefore(fragmento, areaDeEntrada);
  container.scrollTop = container.scrollHeight;
}

function adicionarPlaceholderDeResposta() {
  const container = document.querySelector('.chat-messages');
  const areaDeEntrada = container?.querySelector('.chat-input');

  if (!container || !areaDeEntrada) {
    return null;
  }

  const placeholder = criarElementoMensagem('assistant', '');
  placeholder.dataset.streaming = 'true';
  container.insertBefore(placeholder, areaDeEntrada);
  container.scrollTop = container.scrollHeight;
  return placeholder;
}

async function enviarConversa(opcoes = {}) {
  const { permitirInicioOculto = false } = opcoes;

  if (envioEmAndamento) {
    return;
  }

  const conversa = obterConversa();
  const ultimaMensagem = conversa.at(-1);
  const possuiRespostaDoAssistente = conversa.some(
    (mensagem) => mensagem.role === 'assistant',
  );
  const podeIniciarComInstrucaoOculta =
    permitirInicioOculto && !possuiRespostaDoAssistente;

  if (
    !ultimaMensagem ||
    (ultimaMensagem.role !== 'user' && !podeIniciarComInstrucaoOculta)
  ) {
    return;
  }

  envioEmAndamento = true;

  const botaoEnviar = document.getElementById('send');
  const textarea = document.getElementById('txt-area');

  if (botaoEnviar) {
    botaoEnviar.disabled = true;
  }

  if (textarea) {
    textarea.disabled = true;
  }

  const placeholder = adicionarPlaceholderDeResposta();

  try {
    const resposta = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: conversa }),
    });

    if (!resposta.ok || !resposta.body) {
      throw new Error('Não foi possível obter uma resposta do assistente.');
    }

    const leitor = resposta.body.getReader();
    const decoder = new TextDecoder();
    let textoCompleto = '';

    while (true) {
      const { value, done } = await leitor.read();

      if (done) {
        break;
      }

      textoCompleto += decoder.decode(value, { stream: true });

      if (placeholder) {
        placeholder.textContent = textoCompleto;
        placeholder.parentElement.scrollTop = placeholder.parentElement.scrollHeight;
      }
    }

    textoCompleto += decoder.decode();

    if (!textoCompleto.trim()) {
      throw new Error('A resposta chegou vazia.');
    }

    conversa.push({
      role: 'assistant',
      content: textoCompleto.trim(),
    });
    salvarConversa(conversa);
    renderizarHistorico();
  } catch (error) {
    console.error(error);

    if (placeholder) {
      placeholder.remove();
    }

    alert('Não foi possível continuar a conversa agora. Tente novamente!');
  } finally {
    envioEmAndamento = false;

    if (botaoEnviar) {
      botaoEnviar.disabled = false;
    }

    if (textarea) {
      textarea.disabled = false;
      textarea.focus();
    }
  }
}

function anexarMensagemDoUsuario(texto) {
  const mensagem = texto.trim();

  if (!mensagem) {
    return;
  }

  const conversa = obterConversa();
  conversa.push({ role: 'user', content: mensagem });
  salvarConversa(conversa);
  renderizarHistorico();
}

function inicializarChat() {
  const conversa = obterConversa();
  const contextoInicial = obterContextoInicial();

  if (!conversa.length && !contextoInicial) {
    redirecionarPara(ROUTES.index);
    return;
  }

  renderizarHistorico();

  const botaoEnviar = document.getElementById('send');
  const textarea = document.getElementById('txt-area');

  if (!botaoEnviar || !textarea) {
    return;
  }

  botaoEnviar.addEventListener('click', async () => {
    if (!textarea.value.trim()) {
      return;
    }

    anexarMensagemDoUsuario(textarea.value);
    textarea.value = '';
    await enviarConversa();
  });

  textarea.addEventListener('keydown', async (evento) => {
    if (evento.key !== 'Enter' || evento.shiftKey) {
      return;
    }

    evento.preventDefault();

    if (!textarea.value.trim()) {
      return;
    }

    anexarMensagemDoUsuario(textarea.value);
    textarea.value = '';
    await enviarConversa();
  });

  if (!conversa.some((mensagem) => mensagem.role === 'assistant')) {
    enviarConversa({ permitirInicioOculto: true });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const paginaAtual = obterPaginaAtual();

  if (paginaAtual === ROUTES.chat) {
    inicializarChat();
    return;
  }

  inicializarIndex();
});
