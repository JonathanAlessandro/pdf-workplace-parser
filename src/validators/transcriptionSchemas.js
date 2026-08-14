import { z } from 'zod';

export const documentTypeSchema = z.enum(['cartao-ponto', 'holerite', 'outro']);

export const createTranscriptionSchema = z.object({
  tipo: documentTypeSchema,
});

export const punchSchema = z.object({
  kind: z.enum(['IN', 'OUT']),
  time_raw: z.string(),
  time_hhmm: z.string(),
});

export const timeCardDaySchema = z.object({
  date_raw: z.string(),
  punches: z.array(punchSchema),
});

export const timeCardPageSchema = z.object({
  page: z.number().int().positive(),
  days: z.array(timeCardDaySchema),
});

export const timeCardValueSchema = z.object({
  pages: z.array(timeCardPageSchema),
});

export const payrollFieldSchema = z.object({
  code: z.string(),
  label: z.string(),
  reference: z.string(),
  value: z.string(),
});

export const payrollBaseSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const payrollPageSchema = z.object({
  page: z.number().int().positive(),
  year: z.string(),
  month: z.string(),
  fields: z.array(payrollFieldSchema),
  bases: z.array(payrollBaseSchema),
});

export const payrollValueSchema = z.object({
  pages: z.array(payrollPageSchema),
});

export function getValueSchemaForType(type) {
  if (type === 'cartao-ponto') return timeCardValueSchema;
  if (type === 'holerite') return payrollValueSchema;
  return z.record(z.unknown());
}

export const updateTranscriptionSchema = z.object({
  value: z.record(z.unknown()).optional(),
}).passthrough();
