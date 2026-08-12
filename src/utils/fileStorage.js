import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import env from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

export function getStoragePaths() {
  const base = path.resolve(projectRoot, env.storageDir);
  return {
    base,
    uploads: path.join(base, 'uploads'),
    tmp: path.join(base, 'tmp'),
  };
}

export async function ensureStorageDirs() {
  const paths = getStoragePaths();
  await fs.mkdir(paths.uploads, { recursive: true });
  await fs.mkdir(paths.tmp, { recursive: true });
}

export async function saveUploadedPdf(buffer, id) {
  await ensureStorageDirs();
  const filePath = path.join(getStoragePaths().uploads, `${id}.pdf`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function deleteFileIfExists(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export async function readFileBuffer(filePath) {
  return fs.readFile(filePath);
}

export function getRelativeUploadPath(absolutePath) {
  return path.relative(projectRoot, absolutePath);
}

export function resolveUploadPath(relativeOrAbsolute) {
  if (path.isAbsolute(relativeOrAbsolute)) return relativeOrAbsolute;
  return path.resolve(projectRoot, relativeOrAbsolute);
}
