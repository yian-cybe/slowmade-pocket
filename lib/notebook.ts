import { z } from 'zod';

const shortId = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const entry = z.object({ id: shortId, date, text: z.string().max(10000), photos: z.array(z.string().uuid()).max(12) }).strict();
const project = z.object({
  id: shortId, title: z.string().trim().min(1).max(80), category: z.string().min(1).max(30),
  status: z.enum(['making', 'done']), created: date, materials: z.string().max(2000),
  summary: z.string().max(10000), entries: z.array(entry).max(200),
}).strict();
const schema = z.object({ projects: z.array(project).max(500), ideas: z.array(z.object({ id: shortId, text: z.string().trim().min(1).max(2000), date }).strict()).max(500) }).strict();
export type Notebook = z.infer<typeof schema>;
export type Project = Notebook['projects'][number];
export type Entry = Project['entries'][number];
export const emptyNotebook: Notebook = { projects: [], ideas: [] };
export function validateNotebook(value: unknown): Notebook { return schema.parse(value); }
export function isImage(bytes: Uint8Array, type: string): boolean {
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/png') return [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n);
  if (type === 'image/webp') return String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  return false;
}
