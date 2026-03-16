export const config = {
  runtime: 'edge',
};

export default async function handler(req, res) {
  return res.status(200).json({ message: 'Teste de API funcionando!' });
}
