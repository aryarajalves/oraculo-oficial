// dashboard/b2.js — Backblaze B2 client (S3-compatible)
// Usado em produção para armazenar carousels.json e imagens

import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, CreateBucketCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { logger } from "./logger.js";

// ── Config ──────────────────────────────────────────────────────────────────
const BUCKET      = process.env.MINIO_BUCKET      || "oraculo-bucket";
const ENDPOINT    = process.env.MINIO_ENDPOINT    || "http://localhost:9000";
const REGION      = "us-east-1";
const KEY_ID      = process.env.MINIO_ROOT_USER   || "oraculo_admin";
const APP_KEY     = process.env.MINIO_ROOT_PASSWORD || "oraculo_secret_123";
const PREFIX      = "carousels";  // pasta raiz no bucket

// URL pública base para acesso (com fallback)
const MINIO_PUBLIC_URL = (process.env.MINIO_PUBLIC_URL || ENDPOINT).replace(/\/$/, "");
export const B2_PUBLIC_URL = `${MINIO_PUBLIC_URL}/${BUCKET}`;

// ── Client ──────────────────────────────────────────────────────────────────
let _client = null;
let _bucketInitialized = false;

function getClient() {
  if (!_client) {
    _client = new S3Client({
      region: REGION,
      endpoint: ENDPOINT,
      credentials: { accessKeyId: KEY_ID, secretAccessKey: APP_KEY },
      forcePathStyle: true,
    });
  }
  return _client;
}

async function ensureBucketExists() {
  if (_bucketInitialized) return;
  const client = getClient();
  try {
    const cmd = new CreateBucketCommand({ Bucket: BUCKET });
    await client.send(cmd);
    logger.info('[B2]', `Bucket "${BUCKET}" criado ou verificado com sucesso.`);
  } catch (e) {
    if (e.name !== "BucketAlreadyExists" && e.name !== "BucketAlreadyOwnedByYou" && e.code !== "BucketAlreadyExists") {
      logger.error('[B2]', `Erro ao verificar/criar bucket "${BUCKET}":`, e.message);
    }
  }
  _bucketInitialized = true;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", chunk => chunks.push(chunk));
    stream.on("end",  () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

// ── carousels.json ──────────────────────────────────────────────────────────
const DATA_KEY = `${PREFIX}/carousels.json`;

export async function readDataFromB2() {
  await ensureBucketExists();
  try {
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: DATA_KEY });
    const res = await getClient().send(cmd);
    const buf = await streamToBuffer(res.Body);
    return JSON.parse(buf.toString("utf-8"));
  } catch (e) {
    if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return [];
    throw e;
  }
}

export async function writeDataToB2(data) {
  await ensureBucketExists();
  const body = JSON.stringify(data, null, 2);
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: DATA_KEY,
    Body: body,
    ContentType: "application/json",
  });
  await getClient().send(cmd);
}

// ── Images ───────────────────────────────────────────────────────────────────
export function b2ImageUrl(carouselId, filename) {
  return `${B2_PUBLIC_URL}/${PREFIX}/${carouselId}/${filename}`;
}

export async function uploadImageToB2(carouselId, filename, filePath) {
  await ensureBucketExists();
  const body = fs.readFileSync(filePath);
  const ext  = path.extname(filename).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  const cmd  = new PutObjectCommand({
    Bucket: BUCKET,
    Key: `${PREFIX}/${carouselId}/${filename}`,
    Body: body,
    ContentType: mime,
  });
  await getClient().send(cmd);
  return b2ImageUrl(carouselId, filename);
}

export async function listImagesInB2(carouselId) {
  await ensureBucketExists();
  const cmd = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: `${PREFIX}/${carouselId}/`,
  });
  const res = await getClient().send(cmd);
  return (res.Contents || [])
    .map(obj => path.basename(obj.Key))
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .sort();
}

export function isB2Configured() {
  return !!(KEY_ID && APP_KEY && BUCKET && ENDPOINT);
}
