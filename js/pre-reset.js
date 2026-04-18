import {
  atualizarTextoDoLimiteNaTelaDeReset,
  conversaEstaExpirada,
  encerrarConversaArmazenada,
  iniciarNovaConversa,
  limparEstadoLocalDaConversa,
  obterConfigDoChat,
  obterContextoInicial,
  obterConversa,
  obterConversationId,
  redirecionarPara,
  ROUTES,
  sincronizarInicioDaConversa,
} from './core.js';

async function inicializarPreReset() {
  sincronizarInicioDaConversa();
  const configDoChat = await obterConfigDoChat();
  const contextoInicial = obterContextoInicial();
  const possuiEstadoAnterior =
    Boolean(contextoInicial) ||
    Boolean(obterConversa().length) ||
    Boolean(obterConversationId());

  if (!possuiEstadoAnterior) {
    redirecionarPara(ROUTES.index);
    return;
  }

  if (!conversaEstaExpirada(configDoChat) && obterConversa().length) {
    redirecionarPara(ROUTES.chat);
    return;
  }

  atualizarTextoDoLimiteNaTelaDeReset(configDoChat);

  const botaoReiniciar = document.getElementById('restart-chat');
  const botaoVoltar = document.getElementById('back-to-index');

  if (botaoReiniciar) {
    botaoReiniciar.disabled = true;
  }

  if (botaoVoltar) {
    botaoVoltar.disabled = true;
  }

  await encerrarConversaArmazenada({
    preservarContextoInicial: true,
    motivo: 'expired',
  });

  if (botaoReiniciar) {
    botaoReiniciar.disabled = false;
    botaoReiniciar.addEventListener('click', () => {
      const contexto = obterContextoInicial();

      if (!contexto) {
        redirecionarPara(ROUTES.index);
        return;
      }

      iniciarNovaConversa(contexto);
      redirecionarPara(ROUTES.chat);
    });
  }

  if (botaoVoltar) {
    botaoVoltar.disabled = false;
    botaoVoltar.addEventListener('click', () => {
      limparEstadoLocalDaConversa({ preservarContextoInicial: false });
      redirecionarPara(ROUTES.index);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  inicializarPreReset();
});