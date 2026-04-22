import {
  conversaEstaExpirada,
  obterConfigDoChat,
  obterContextoInicial,
  obterConversa,
  obterConversationId,
  obterInicioDaConversa,
  redirecionarPara,
  ROUTES,
  salvarConversa,
  salvarConversationId,
  sincronizarInicioDaConversa,
} from './core.js';

let envioEmAndamento = false;
let timerDeExpiracao;
let timerDoContador;

const formatadorDeDataHora = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function obterContainerDeMensagens() {
  return document.querySelector('.chat-messages');
}

function estaPertoDoFim() {
  const container = obterContainerDeMensagens();

  if (!container) {
    return false;
  }

  const distanciaDoFim = container.scrollHeight - container.clientHeight - container.scrollTop;
  return distanciaDoFim <= 48;
}

function rolarParaUltimaMensagem(comportamento = 'auto') {
  const container = obterContainerDeMensagens();

  if (!container) {
    return;
  }

  container.scrollTo({
    top: container.scrollHeight,
    behavior: comportamento,
  });
}

function atualizarViewportDoChat() {
  const viewport = window.visualViewport;
  const altura = viewport?.height ?? window.innerHeight;

  document.documentElement.style.setProperty(
    '--chat-viewport-height',
    `${Math.round(altura)}px`,
  );
}

function sincronizarAlturaDoComposer() {
  const composer = document.querySelector('.chat-input');

  if (!composer) {
    return;
  }

  document.documentElement.style.setProperty(
    '--chat-input-height',
    `${Math.round(composer.offsetHeight)}px`,
  );
}

function ajustarViewportERolagem(comportamento = 'auto') {
  atualizarViewportDoChat();
  sincronizarAlturaDoComposer();
  requestAnimationFrame(() => {
    rolarParaUltimaMensagem(comportamento);
  });
}

function ajustarViewportDoChatSemForcarScroll() {
  atualizarViewportDoChat();
  sincronizarAlturaDoComposer();
}

function renderizarAlertaDoLimite(configDoChat) {
  const alerta = document.getElementById('chat-limit-alert');
  const texto = document.getElementById('chat-limit-alert-text');
  const botaoFechar = document.getElementById('chat-limit-alert-close');

  if (!alerta || !texto) {
    return;
  }

  texto.textContent = configDoChat.alertMessage;
  alerta.hidden = false;

  if (botaoFechar && !botaoFechar.dataset.bound) {
    botaoFechar.dataset.bound = 'true';
    botaoFechar.addEventListener('click', () => {
      alerta.hidden = true;
    });
  }
}

function obterMensagensVisiveis(conversa) {
  return conversa.filter(
    (mensagem) => mensagem.role === 'user' || mensagem.role === 'assistant',
  );
}

function criarElementoMensagem(role, content) {
  const mensagem = document.createElement('p');
  mensagem.className = `msg ${role === 'user' ? 'msg--me' : 'msg--other'}`;
  mensagem.textContent = content;
  return mensagem;
}

function renderizarHistorico() {
  const container = obterContainerDeMensagens();
  const deveManterNoFim = estaPertoDoFim();

  if (!container) {
    return;
  }

  container.querySelectorAll('.msg').forEach((elemento) => elemento.remove());

  const fragmento = document.createDocumentFragment();
  const mensagensVisiveis = obterMensagensVisiveis(obterConversa());

  mensagensVisiveis.forEach((mensagem) => {
    fragmento.appendChild(criarElementoMensagem(mensagem.role, mensagem.content));
  });

  container.appendChild(fragmento);

  if (deveManterNoFim) {
    rolarParaUltimaMensagem();
  }
}

function adicionarPlaceholderDeResposta() {
  const container = obterContainerDeMensagens();

  if (!container) {
    return null;
  }

  const placeholder = criarElementoMensagem('assistant', '');
  placeholder.dataset.streaming = 'true';
  container.appendChild(placeholder);
  rolarParaUltimaMensagem();
  return placeholder;
}

function montarPayloadDeEnvio(conversa, permitirInicioOculto) {
  const conversationId = obterConversationId();
  const ultimaMensagem = conversa.at(-1);
  const payload = {};

  if (conversationId && ultimaMensagem?.role === 'user') {
    payload.conversationId = conversationId;
    payload.message = ultimaMensagem.content;
    return payload;
  }

  payload.messages = conversa;

  if (permitirInicioOculto || ultimaMensagem?.role === 'user') {
    payload.message =
      ultimaMensagem?.role === 'user' ? ultimaMensagem.content : undefined;
  }

  return payload;
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
  const payload = montarPayloadDeEnvio(conversa, permitirInicioOculto);

  try {
    const resposta = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resposta.ok || !resposta.body) {
      throw new Error('Não foi possível obter uma resposta do assistente.');
    }

    salvarConversationId(resposta.headers.get('x-conversation-id'));

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

        if (estaPertoDoFim()) {
          rolarParaUltimaMensagem();
        }
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

async function inicializarChat() {
  sincronizarInicioDaConversa();
  const configDoChat = await obterConfigDoChat();
  const conversa = obterConversa();
  const contextoInicial = obterContextoInicial();

  if (!conversa.length && !contextoInicial) {
    redirecionarPara(ROUTES.index);
    return;
  }

  if (conversaEstaExpirada(configDoChat)) {
    redirecionarPara(ROUTES.preReset);
    return;
  }

  renderizarHistorico();
  renderizarAlertaDoLimite(configDoChat);
  ajustarViewportERolagem();

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

  const reagirAoFocoNoCampo = () => {
    ajustarViewportERolagem('smooth');
  };

  textarea.addEventListener('focus', reagirAoFocoNoCampo);
  textarea.addEventListener('click', reagirAoFocoNoCampo);

  window.addEventListener('resize', () => {
    ajustarViewportDoChatSemForcarScroll();
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      ajustarViewportDoChatSemForcarScroll();
    });

    window.visualViewport.addEventListener('scroll', () => {
      ajustarViewportDoChatSemForcarScroll();
    });
  }

  if (!conversa.some((mensagem) => mensagem.role === 'assistant')) {
    enviarConversa({ permitirInicioOculto: true });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  inicializarChat();
});