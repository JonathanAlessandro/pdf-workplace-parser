import { z } from 'zod';
import { documentTypeSchema } from './transcriptionSchemas.js';

export const createDocumentSchema = z.object({
  tipo: documentTypeSchema,
});

export const spreadsheetFormatSchema = z.enum(['xlsx', 'csv', 'json']);
