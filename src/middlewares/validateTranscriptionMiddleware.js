import { createTranscriptionSchema, getValueSchemaForType } from '../validators/transcriptionSchemas.js';

export function validateCreateTranscription(req, res, next) {
  const parsed = createTranscriptionSchema.safeParse({ tipo: req.body.tipo });
  if (!parsed.success) {
    return res.status(400).json({ error: 'Tipo de documento inválido. Use cartao-ponto, holerite ou outro.' });
  }
  req.body.tipo = parsed.data.tipo;
  next();
}

export function validateUpdateTranscription(req, res, next) {
  const type = req.transcription?.type;
  if (!type) {
    return res.status(404).json({ error: 'Transcrição não encontrada' });
  }
  if (req.transcription.status !== 'concluido') {
    return res.status(400).json({ error: 'Transcrição ainda não concluída' });
  }
  if (!req.body || typeof req.body.value !== 'object') {
    return res.status(400).json({ error: 'Corpo inválido: value é obrigatório' });
  }
  const schema = getValueSchemaForType(type);
  const parsed = schema.safeParse(req.body.value);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Formato inválido para o tipo de documento' });
  }
  req.body.value = parsed.data;
  next();
}

export function loadTranscriptionMiddleware(getById) {
  return async (req, res, next) => {
    const transcription = await getById(req.params.id);
    if (!transcription) {
      return res.status(404).json({ error: 'Transcrição não encontrada' });
    }
    req.transcription = transcription;
    next();
  };
}
