#!/usr/bin/env node
// sync-b2.js — Sincroniza carrosséis locais para o Backblaze B2
// USO: node sync-b2.js
// Roda localmente após gerar novos carrosséis para atualizar a plataforma online.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carrega .env manualmente
(function loadEnv() {
  try {
    const lines = fs.readFileSync(path.join(__dirname, ".env"), "utf-8").split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (k && !process.env[k]) process.env[k] = v;
    }
  } catch {}
})();

import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const BUCKET   = process.env.MINIO_BUCKET      || "oraculo-bucket";
const ENDPOINT = process.env.MINIO_ENDPOINT    || "http://localhost:9000";
const KEY_ID   = process.env.MINIO_ROOT_USER   || "oraculo_admin";
const APP_KEY  = process.env.MINIO_ROOT_PASSWORD || "oraculo_secret_123";
const PREFIX   = "carousels";

const DATA_FILE = path.join(__dirname, "dashboard", "data", "carousels.json");

// ANSI colors
const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", D = "\x1b[2m", RST = "\x1b[0m", B = "\x1b[34m";

if (!KEY_ID || !APP_KEY) {
  console.error(`${R}ERRO: MINIO_ROOT_USER e MINIO_ROOT_PASSWORD não encontrados no .env${RST}`);
  process.exit(1);
}

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: ENDPOINT,
  credentials: { accessKeyId: KEY_ID, secretAccessKey: APP_KEY },
  forcePathStyle: true,
});

async function upload(key, body, contentType = "application/octet-stream") {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
}

function getSlidesFromDir(dir, prefix = "slide-") {
  try {
    return fs.readdirSync(dir)
      .filter(f => f.startsWith(prefix) && /\.(jpg|jpeg|png)$/i.test(f))
      .sort();
  } catch { return []; }
}

async function main() {
  console.log(`\n${B}╔═══════════════════════════════════════╗`);
  console.log(`║   Fonte Oculta — Sync para B2         ║`);
  console.log(`╚═══════════════════════════════════════╝${RST}\n`);

  // 1. Lê carousels.json local
  let carousels;
  try {
    carousels = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    console.error(`${R}Erro ao ler carousels.json${RST}`);
    process.exit(1);
  }

  console.log(`${D}Total de carrosséis no banco: ${carousels.length}${RST}\n`);

  let totalImagens = 0;
  let totalEnviadas = 0;
  const updatedCarousels = [];

  // 2. Para cada carrossel, faz upload das imagens
  for (const c of carousels) {
    const slides = getSlidesFromDir(c.slidesDir, c.slidePrefix || "slide-");

    if (slides.length === 0) {
      // Sem imagens locais — mantém como está
      updatedCarousels.push(c);
      continue;
    }

    totalImagens += slides.length;
    process.stdout.write(`  ${Y}↑${RST} ${c.id} (${slides.length} slides)... `);

    let enviadas = 0;
    for (const filename of slides) {
      const localPath = path.join(c.slidesDir, filename);
      if (!fs.existsSync(localPath)) continue;

      const ext  = path.extname(filename).toLowerCase();
      const mime = ext === ".png" ? "image/png" : "image/jpeg";
      const key  = `${PREFIX}/${c.id}/${filename}`;

      try {
        const body = fs.readFileSync(localPath);
        await upload(key, body, mime);
        enviadas++;
      } catch (e) {
        console.error(`\n  ${R}Erro ao enviar ${filename}: ${e.message}${RST}`);
      }
    }

    totalEnviadas += enviadas;

    // Atualiza o carrossel com o array de slides e remove o slidesDir local
    updatedCarousels.push({
      ...c,
      slides: slides,
      slidesDir: `b2://${BUCKET}/${PREFIX}/${c.id}`,  // marca como B2
    });

    console.log(`${G}✓ ${enviadas}/${slides.length}${RST}`);
  }

  // 3. Faz upload do carousels.json atualizado para B2
  process.stdout.write(`\n  ${Y}↑${RST} carousels.json... `);
  try {
    await upload(
      `${PREFIX}/carousels.json`,
      JSON.stringify(updatedCarousels, null, 2),
      "application/json"
    );
    console.log(`${G}✓${RST}`);
  } catch (e) {
    console.error(`${R}Erro ao enviar carousels.json: ${e.message}${RST}`);
  }

  // 4. Atualiza também o carousels.json local com os slides preenchidos
  fs.writeFileSync(DATA_FILE, JSON.stringify(updatedCarousels, null, 2));

  const B2_PUBLIC = `https://${BUCKET}.${ENDPOINT}`;
  console.log(`\n${G}═══════════════════════════════════════`);
  console.log(`  Sync concluído!`);
  console.log(`  ${totalEnviadas} imagens enviadas de ${totalImagens} encontradas`);
  console.log(`  Carrosséis: ${updatedCarousels.length}`);
  console.log(`═══════════════════════════════════════${RST}`);
  console.log(`\n${D}URL base das imagens:`);
  console.log(`  ${B2_PUBLIC}/${PREFIX}/{id}/{arquivo}.jpg${RST}\n`);
}

main().catch(e => {
  console.error(`${R}Erro fatal: ${e.message}${RST}`);
  process.exit(1);
});
