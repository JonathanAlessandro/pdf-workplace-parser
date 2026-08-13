import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import env from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const s3Client = env.s3.enabled
  ? new S3Client({ region: env.s3.region })
  : null;

export function isS3Enabled() {
  return env.s3.enabled;
}

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

function getObjectKey(id) {
  return `${env.s3.prefix}/${id}.pdf`;
}

async function bodyToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }

  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function saveUploadedPdf(buffer, id) {
  if (isS3Enabled()) {
    const key = getObjectKey(id);
    await s3Client.send(new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256',
    }));
    return key;
  }

  await ensureStorageDirs();
  const filePath = path.join(getStoragePaths().uploads, `${id}.pdf`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function readStoredPdfBuffer(storageRef) {
  if (isS3Enabled()) {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: env.s3.bucket,
      Key: storageRef,
    }));
    return bodyToBuffer(response.Body);
  }

  return fs.readFile(resolveUploadPath(storageRef));
}

export async function materializePdf(storageRef, id) {
  const buffer = await readStoredPdfBuffer(storageRef);
  await ensureStorageDirs();
  const tempDir = await fs.mkdtemp(path.join(getStoragePaths().tmp, `job-${id}-`));
  const filePath = path.join(tempDir, `${id}.pdf`);
  await fs.writeFile(filePath, buffer);
  return { filePath, tempDir };
}

export async function deleteFileIfExists(storageRef) {
  if (isS3Enabled()) {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: env.s3.bucket,
      Key: storageRef,
    }));
    return;
  }

  try {
    await fs.unlink(resolveUploadPath(storageRef));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export async function removeTempDir(tempDir) {
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
}

export function getRelativeUploadPath(absolutePath) {
  return path.relative(projectRoot, absolutePath);
}

export function resolveUploadPath(relativeOrAbsolute) {
  if (path.isAbsolute(relativeOrAbsolute)) return relativeOrAbsolute;
  return path.resolve(projectRoot, relativeOrAbsolute);
}

