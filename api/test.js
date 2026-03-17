export default async function handler(req, res) {
  try {
    return res.status(200).json({ message: 'Teste de API funcionando!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
