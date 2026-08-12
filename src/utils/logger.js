import env from '../config/env.js';

const levels = { debug: 0, info: 1, warn: 2, error: 3 };
const minLevel = env.isProduction ? levels.info : levels.debug;

function formatMessage(level, message, meta = {}) {
  const safeMeta = { ...meta };
  delete safeMeta.stack;
  delete safeMeta.raw;
  delete safeMeta.fileContent;
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...safeMeta,
  });
}

function log(level, message, meta) {
  if (levels[level] < minLevel) return;
  const line = formatMessage(level, message, meta);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message, meta) => log('debug', message, meta),
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
};

export function sanitizeErrorMessage(error) {
  if (!error) return 'Erro desconhecido';
  const known = [
    'Arquivo inválido',
    'PDF corrompido',
    'Tipo de documento inválido',
    'Transcrição não encontrada',
    'Formato inválido',
    'Timeout',
    'Falha ao processar documento',
  ];
  const message = error.message || String(error);
  if (known.some((k) => message.includes(k))) return message;
  if (message.includes('timeout') || message.includes('Timeout')) {
    return 'Timeout ao processar documento';
  }
  return 'Falha ao processar documento';
}
