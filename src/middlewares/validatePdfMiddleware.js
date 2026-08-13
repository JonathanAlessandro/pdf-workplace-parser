import fs from 'fs/promises';

const PDF_MAGIC = Buffer.from('%PDF-');

export async function validatePdfMiddleware(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'Arquivo PDF é obrigatório' });
  }

  try {
    const buffer = req.file.buffer || await fs.readFile(req.file.path);
    if (buffer.length < 5 || !buffer.subarray(0, 5).equals(PDF_MAGIC)) {
      if (req.file.path) await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Arquivo inválido: não é um PDF válido' });
    }

    if (!buffer.includes(Buffer.from('%%EOF'))) {
      if (req.file.path) await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'PDF corrompido ou incompleto' });
    }

    req.file.buffer = buffer;
    next();
  } catch {
    if (req.file.path) await fs.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: 'PDF corrompido ou incompleto' });
  }
}
