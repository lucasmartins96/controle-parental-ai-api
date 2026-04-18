import {
  coletarDadosIniciais,
  conversaEstaExpirada,
  iniciarNovaConversa,
  obterConfigDoChat,
  obterConversa,
  redirecionarPara,
  ROUTES,
  sincronizarInicioDaConversa,
} from './core.js';

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

async function inicializarIndex() {
  sincronizarInicioDaConversa();
  const configDoChat = await obterConfigDoChat();

  if (obterConversa().length) {
    if (conversaEstaExpirada(configDoChat)) {
      redirecionarPara(ROUTES.preReset);
      return;
    }

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

document.addEventListener('DOMContentLoaded', () => {
  inicializarIndex();
});