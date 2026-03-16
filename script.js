// 1. CARREGAR HISTÓRICO ASSIM QUE O SITE ABRE
let historico = JSON.parse(localStorage.getItem('historicoTutoriais')) || [];
mostrarHistoricoNaTela(historico);

async function gerarNovoTutorial() {
  // 2. DETECTAR CELULAR
  const parser = new UAParser();
  const celular = parser.getDevice().model || 'Celular';
  const sistema = parser.getOS().name || 'Android/iOS';

  let usosHoje = localStorage.getItem('usosHoje') || 0;
  let dataUltimoUso = localStorage.getItem('dataUso');
  const dataAtual = new Date().toLocaleDateString();

  if (dataUltimoUso !== dataAtual) {
    usosHoje = 0; // Zera o contador no dia seguinte
    localStorage.setItem('dataUso', dataAtual);
  }

  if (usosHoje >= 3) {
    alert('Você já gerou 3 tutoriais hoje. Volte amanhã!');
    return; // Impede o fetch de rodar
  }

  // Se passou, adiciona +1 no uso de hoje e continua
  localStorage.setItem('usosHoje', usosHoje + 1);

  // 3. CHAMAR O BACK-END (Usando SSE para Streaming)
  const resposta = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ celular, sistema }),
  });

  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let textoCompleto = '';

  // Lendo a resposta palavra por palavra (Efeito ChatGPT)
  while (true) {
    const { value, done } = await leitor.read();

    if (done) break;

    const pedaco = decodificador.decode(value);
    textoCompleto += pedaco;
    atualizarTextoNaTela(textoCompleto); // Mostra na tela pro usuário
  }

  // 4. SALVAR NO HISTÓRICO LOCAL SEM LOGIN
  historico.push({ aparelho: celular, tutorial: textoCompleto, data: new Date() });
  localStorage.setItem('historicoTutoriais', JSON.stringify(historico));
}

async function gerarTutorialTeste() {
  const resposta = await fetch('/api/test-stream');
  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let textoCompleto = '';

  while (true) {
    const { value, done } = await leitor.read();

    if (done) break;

    const pedaco = decodificador.decode(value);
    textoCompleto += pedaco;
    atualizarTextoNaTela(textoCompleto);
  }
}

function atualizarTextoNaTela(texto) {
  document.getElementById('resposta').textContent = texto;
}

function mostrarHistoricoNaTela(historico) {
  const container = document.getElementById('historico');
  container.innerHTML = '';

  historico.forEach((item) => {
    const div = document.createElement('div');
    div.classList.add('item-historico');
    div.innerHTML = `
      <strong>${item.aparelho}</strong> (${new Date(item.data).toLocaleDateString()}):
      <p>${item.tutorial}</p>
    `;
    container.appendChild(div);
  });
}

document.getElementById('gerar').addEventListener('click', gerarNovoTutorial);
document.getElementById('gerar-teste').addEventListener('click', gerarTutorialTeste);
