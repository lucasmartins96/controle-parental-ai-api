import {
  ROUTES,
  obterContextoInicial,
  obterConversa,
  obterConversationId,
  redirecionarPara,
} from './core.js';

const instanteDeAberturaDaPagina = Date.now();

function obterElementos() {
  return {
    form: document.getElementById('help-form'),
    type: document.getElementById('issue-type'),
    email: document.getElementById('contact-email'),
    company: document.getElementById('contact-company'),
    description: document.getElementById('issue-description'),
    submit: document.getElementById('help-submit'),
    cancel: document.getElementById('help-cancel'),
    feedback: document.getElementById('help-feedback'),
    modal: document.getElementById('help-modal'),
    modalTitle: document.getElementById('help-modal-title'),
    modalMessage: document.getElementById('help-modal-message'),
    modalStatus: document.getElementById('help-modal-status'),
    modalClose: document.getElementById('help-modal-close'),
    modalLink: document.getElementById('help-modal-link'),
  };
}

function exibirErro(feedback, mensagem) {
  if (!feedback) {
    return;
  }

  feedback.textContent = mensagem;
  feedback.hidden = false;
}

function limparErro(feedback) {
  if (!feedback) {
    return;
  }

  feedback.textContent = '';
  feedback.hidden = true;
}

function validarFormulario({ type, email, description }) {
  if (!type) {
    return 'Selecione se o contato é ajuda, problema ou sugestão.';
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Informe um email válido ou deixe o campo em branco.';
  }

  if (!description || description.length < 10) {
    return 'Descreva o atendimento com pelo menos 10 caracteres.';
  }

  return null;
}

function alternarEstadoDeEnvio(elementos, enviando) {
  elementos.submit.disabled = enviando;
  elementos.cancel.disabled = enviando;
  elementos.submit.textContent = enviando ? 'Enviando...' : 'Enviar';
}

function abrirModal(elementos, { status, titulo, mensagem, erro = false }) {
  elementos.modalStatus.textContent = status;
  elementos.modalTitle.textContent = titulo;
  elementos.modalMessage.textContent = mensagem;
  elementos.modal.classList.toggle('help-modal--error', erro);
  elementos.modal.hidden = false;
}

function fecharModal(elementos) {
  elementos.modal.hidden = true;
  elementos.modal.classList.remove('help-modal--error');
}

function montarPayload({ type, email, description, company }) {
  const contextoInicial = obterContextoInicial();
  const conversa = obterConversa();

  return {
    type,
    email: email || null,
    description,
    company: company || '',
    context: {
      page: 'help',
      conversationId: obterConversationId(),
      messageCount: conversa.length,
      lastMessageRole: conversa.at(-1)?.role || null,
      intake: contextoInicial,
      userAgent: navigator.userAgent,
      submittedAt: new Date().toISOString(),
      pageOpenedAt: instanteDeAberturaDaPagina,
    },
  };
}

async function enviarFormulario(elementos) {
  const type = elementos.type.value.trim();
  const email = elementos.email.value.trim();
  const company = elementos.company.value.trim();
  const description = elementos.description.value.trim();
  const erroDeValidacao = validarFormulario({ type, email, description });

  if (erroDeValidacao) {
    exibirErro(elementos.feedback, erroDeValidacao);
    return;
  }

  limparErro(elementos.feedback);
  alternarEstadoDeEnvio(elementos, true);

  try {
    const resposta = await fetch('/api/create-issue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(montarPayload({ type, email, description, company })),
    });

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(
        typeof dados?.error === 'string' && dados.error
          ? dados.error
          : 'Não foi possível registrar sua solicitação agora.',
      );
    }

    elementos.form.reset();
    abrirModal(elementos, {
      status: 'Envio concluído',
      titulo: 'Solicitação registrada com sucesso',
      mensagem:
        typeof dados?.message === 'string' && dados.message
          ? dados.message
          : 'Sua solicitação foi criada e iremos acompanhar a solicitação.',
    });
  } catch (error) {
    abrirModal(elementos, {
      status: 'Falha no envio',
      titulo: 'Não foi possível registrar a solicitação',
      mensagem:
        error instanceof Error && error.message
          ? error.message
          : 'Tente novamente em instantes.',
      erro: true,
    });
  } finally {
    alternarEstadoDeEnvio(elementos, false);
  }
}

function inicializarHelp() {
  const elementos = obterElementos();

  if (!elementos.form) {
    return;
  }

  elementos.cancel.addEventListener('click', () => {
    redirecionarPara(ROUTES.chat);
  });

  elementos.form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    await enviarFormulario(elementos);
  });

  elementos.modalClose.addEventListener('click', () => {
    fecharModal(elementos);
  });

  elementos.modal.addEventListener('click', (evento) => {
    if (
      evento.target instanceof HTMLElement &&
      evento.target.dataset.closeModal === 'true'
    ) {
      fecharModal(elementos);
    }
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !elementos.modal.hidden) {
      fecharModal(elementos);
    }
  });

  elementos.modalLink.href = ROUTES.chat;
}

document.addEventListener('DOMContentLoaded', () => {
  inicializarHelp();
});
