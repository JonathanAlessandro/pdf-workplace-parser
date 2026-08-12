export function notFoundMiddleware(_req, res) {
  res.status(404).json({ error: 'Rota não encontrada' });
}
