import express from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { 
  slugify, 
  readData, 
  writeData, 
  readDataAsync, 
  writeDataAsync, 
  getLocalSlidesDir, 
  getSlidesForCarousel, 
  getSlidesFromDir 
} from "../helpers.js";
import { buildAgentPrompts } from "../agentPrompts.js";
import { 
  IS_PROD, 
  b2, 
  CLIENT, 
  generationJobs, 
  COMPOSE_SCRIPT, 
  REGEN_SCRIPT, 
  ZIP_SCRIPT,
  isUserSuperAdmin,
  sseClients
} from "../state.js";
import { logger } from '../logger.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON = process.platform === "win32" ? "python" : "python3";

const router = express.Router();
const AGENT_SYSTEM_PROMPTS = buildAgentPrompts(CLIENT);

// ── API: List all carousels ──────────────────────────────────────────────────
router.get("/api/carousels", async (req, res) => {
  const all = await readDataAsync();
  const carousels = all.map(c => {
    const slides = getSlidesForCarousel(c);
    let cost = c.cost;
    if (cost === undefined || cost === 0) {
      const imageProvider = process.env.ACTIVE_IMAGE_PROVIDER || 'gpt-image-2';
      let costPerImage = 0.08;
      if (imageProvider === 'fal') costPerImage = 0.003;
      else if (imageProvider === 'gemini') costPerImage = 0.015;
      else if (imageProvider === 'gpt-image-1-mini' || imageProvider === 'dall-e-2') costPerImage = 0.02;

      cost = (slides.length || c.totalSlides || 10) * costPerImage;
    }
    return { ...c, slidesFound: slides.length, slides, cost };
  });
  res.json(carousels);
});

// ── API: Get single carousel ─────────────────────────────────────────────────
router.get("/api/carousels/:id", async (req, res) => {
  const all = await readDataAsync();
  const c = all.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "Carrossel não encontrado" });
  const slides = getSlidesForCarousel(c);
  
  let cost = c.cost;
  if (cost === undefined || cost === 0) {
    const imageProvider = process.env.ACTIVE_IMAGE_PROVIDER || 'gpt-image-2';
    let costPerImage = 0.08;
    if (imageProvider === 'fal') costPerImage = 0.003;
    else if (imageProvider === 'gemini') costPerImage = 0.015;
    else if (imageProvider === 'gpt-image-1-mini' || imageProvider === 'dall-e-2') costPerImage = 0.02;

    cost = (slides.length || c.totalSlides || 10) * costPerImage;
  }

  res.json({ ...c, slides, cost });
});

// ── API: Create carousel ─────────────────────────────────────────────────────
router.post("/api/carousels", async (req, res) => {
  logger.info('[CarouselsAPI]', `CRIAR NOVO CARROSSEL (POST): ${JSON.stringify(req.body)}`);
  const all = await readData();
  let nextIdNum = all.length + 1;
  let newId = `carrossel-${String(nextIdNum).padStart(2, "0")}`;
  while (all.some(x => x.id === newId)) {
    nextIdNum++;
    newId = `carrossel-${String(nextIdNum).padStart(2, "0")}`;
  }

  const newCarousel = {
    id: newId,
    title: req.body.title || "Sem título",
    theme: req.body.theme || "",
    format: req.body.format || "A",
    status: "rascunho",
    createdAt: new Date().toISOString(),
    slidesDir: req.body.slidesDir || "",
    slidePrefix: "slide-",
    totalSlides: Number(req.body.totalSlides) || 10,
    imageQuality: req.body.imageQuality || "high",
    caption: req.body.caption || "",
    notes: req.body.notes || "",
    chatHistory: req.body.chatHistory || [],
  };
  all.push(newCarousel);
  await writeData(all);

  // Create folder if requested
  if (req.body.createFolder && req.body.slidesDir) {
    fs.mkdirSync(req.body.slidesDir, { recursive: true });
  }

  logger.info('[CarouselsAPI]', `CRIADO COM SUCESSO: ${newId} (${newCarousel.title})`);
  res.json(newCarousel);
});

// ── API: Update carousel status/fields ──────────────────────────────────────
router.put("/api/carousels/:id", async (req, res) => {
  logger.info('[CarouselsAPI]', `ATUALIZAR CARROSSEL (PUT ${req.params.id}): ${JSON.stringify(req.body)}`);
  const all = await readData();
  const idx = all.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Não encontrado" });
  all[idx] = { ...all[idx], ...req.body, id: all[idx].id };
  await writeData(all);
  logger.info('[CarouselsAPI]', `ATUALIZADO COM SUCESSO: ${req.params.id} (${all[idx].title})`);
  res.json(all[idx]);
});

// ── API: Bulk Delete carousels ────────────────────────────────────────────────
router.post("/api/carousels/bulk-delete", async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: "Lista de ids inválida" });
  }

  let all = await readData();
  let deletedCount = 0;

  for (const id of ids) {
    const index = all.findIndex(x => x.id === id);
    if (index !== -1) {
      const c = all[index];
      try {
        const localDir = getLocalSlidesDir(c);
        if (localDir && fs.existsSync(localDir)) {
          fs.rmSync(localDir, { recursive: true, force: true });
        }
      } catch (e) {
        logger.error('[Carousel]', `Erro ao apagar pasta ${c.slidesDir}:`, e.message);
      }
      all.splice(index, 1);
      deletedCount++;
    }
  }

  await writeData(all);
  res.json({ ok: true, deletedCount, message: `${deletedCount} carrosséis apagados com sucesso` });
});

// ── API: Serve slide images ──────────────────────────────────────────────────
router.get("/api/carousels/:id/image/:filename", async (req, res) => {
  const all = await readData();
  const c = all.find(x => x.id === req.params.id);
  if (!c) return res.status(404).send("Carrossel não encontrado");

  // Se o carrossel foi de fato enviado ao MinIO (possui b2BaseUrl ou slides são objetos com url)
  const isUploadedToB2 = c.b2BaseUrl || (c.slides && c.slides.length > 0 && typeof c.slides[0] === 'object' && c.slides[0].url);

  if (isUploadedToB2 && b2) {
    let url = b2.b2ImageUrl(req.params.id, req.params.filename);
    const queryStr = new URLSearchParams(req.query).toString();
    if (queryStr) {
      url += `?${queryStr}`;
    }
    return res.redirect(302, url);
  }

  // Local fallback: serve do disco
  const imgPath = path.join(getLocalSlidesDir(c), req.params.filename);
  if (!fs.existsSync(imgPath)) return res.status(404).send("Imagem não encontrada");
  res.sendFile(imgPath);
});

// ── API: Download single slide ───────────────────────────────────────────────
router.get("/api/carousels/:id/download/:filename", async (req, res) => {
  if (b2) {
    const url = b2.b2ImageUrl(req.params.id, req.params.filename);
    return res.redirect(302, url);
  }
  const all = await readData();
  const c = all.find(x => x.id === req.params.id);
  if (!c) return res.status(404).send("Não encontrado");
  const imgPath = path.join(getLocalSlidesDir(c), req.params.filename);
  if (!fs.existsSync(imgPath)) return res.status(404).send("Imagem não encontrada");
  res.setHeader("Content-Disposition", `attachment; filename="${req.params.filename}"`);
  res.sendFile(imgPath);
});

// ── API: Read slide meta ─────────────────────────────────────────────────────
router.get("/api/carousels/:id/slide/:filename/meta", async (req, res) => {
  const all = await readData();
  const c = all.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "Não encontrado" });
  const metaPath = path.join(getLocalSlidesDir(c), req.params.filename.replace(/\.(jpg|jpeg|png)$/i, ".meta.json"));
  if (!fs.existsSync(metaPath)) return res.json({ title: "", body: "", layout: "fullbleed" });
  try {
    res.json(JSON.parse(fs.readFileSync(metaPath, "utf-8")));
  } catch {
    res.json({ title: "", body: "", layout: "fullbleed" });
  }
});

// ── API: Recompose slide ─────────────────────────────────────────────────────
router.post("/api/carousels/:id/slide/:filename/recompose", async (req, res) => {
  const all = await readData();
  const c = all.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "Não encontrado" });
  
  const imgPath = path.join(getLocalSlidesDir(c), req.params.filename);
  const rawFilename = req.params.filename.replace(/^slide-/, 'raw-');
  const rawPath = path.join(getLocalSlidesDir(c), rawFilename);

  // Se o MinIO/B2 estiver ativo e a imagem não estiver localmente, baixa do bucket
  if (!fs.existsSync(imgPath) && b2) {
    try {
      await b2.downloadImageFromB2(c.id, req.params.filename, imgPath);
      try {
        await b2.downloadImageFromB2(c.id, rawFilename, rawPath);
      } catch {}
    } catch (err) {
      logger.warn('[Carousel recompose]', `Falha ao baixar imagem do B2 para recompor localmente: ${err.message}`);
    }
  }

  if (!fs.existsSync(imgPath)) return res.status(404).json({ error: "Imagem não encontrada" });
  
  // Buscar a imagem limpa do Raw Cache se disponível
  const baseImgPath = fs.existsSync(rawPath) ? rawPath : imgPath;

  const { title, body, layout = "fullbleed" } = req.body;
  if (!title || !body) return res.status(400).json({ error: "title e body são obrigatórios" });
  
  const metaPath = imgPath.replace(/\.(jpg|jpeg|png)$/i, ".meta.json");
  let preset = "sagrado";
  if (fs.existsSync(metaPath)) {
    try {
      const slideMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (slideMeta.preset) {
        preset = slideMeta.preset;
      } else if (c.preset) {
        preset = c.preset;
      }
    } catch {}
  } else if (c.preset) {
    preset = c.preset;
  }

  if (preset === "manuscrito_sagrado" || preset === "escala" || !preset) {
    preset = "sagrado";
  }

  try {
    const { stdout } = await execFileAsync(PYTHON, [
      COMPOSE_SCRIPT,
      "--image", baseImgPath, "--title", title, "--body", body,
      "--layout", layout, "--preset", preset, "--output", imgPath
    ], {
      timeout: 60000,
      cwd: path.join(__dirname, '..', '..'),
      env: {
        ...process.env,
        PYTHONPATH: [
          path.join(__dirname, '..', '..'),
          path.join(__dirname, '..', '..', 'python_packages'),
        ].join(process.platform === 'win32' ? ';' : ':'),
      }
    });
    
    logger.info('[Carousel]', "recompose:", stdout.trim());
    fs.writeFileSync(metaPath, JSON.stringify({ title, body, layout, preset }, null, 2));

    // Se o MinIO/B2 estiver ativo e em produção, envia de volta para o bucket e remove do container
    if (IS_PROD && b2) {
      try {
        await b2.uploadImageToB2(c.id, req.params.filename, imgPath);
        try { fs.unlinkSync(imgPath); } catch {}
        try { fs.unlinkSync(rawPath); } catch {}
      } catch (uploadErr) {
        logger.error('[Carousel recompose upload]', `Erro ao reenviar slide atualizado para o B2: ${uploadErr.message}`);
      }
    }

    res.json({ ok: true, message: stdout.trim() });
  } catch (e) {
    logger.error('[Carousel]', "recompose error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── API: Excluir carrossel inteiro ─────────────────────────────────────────────
router.delete("/api/carousels/:id", async (req, res) => {
  let all = await readData();
  const index = all.findIndex(x => x.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Não encontrado" });
  
  const c = all[index];
  
  try {
    const localDir = getLocalSlidesDir(c);
    if (localDir && fs.existsSync(localDir)) {
      fs.rmSync(localDir, { recursive: true, force: true });
    }
  } catch (e) {
    logger.error('[Carousel]', `Erro ao apagar pasta ${c.slidesDir}:`, e.message);
  }

  all.splice(index, 1);
  await writeData(all);
  res.json({ ok: true, message: "Carrossel apagado com sucesso" });
});

// ── API: Excluir slide individual ─────────────────────────────────────────────
router.delete("/api/carousels/:id/slide/:filename", async (req, res) => {
  const all = await readData();
  const c = all.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "Carrossel não encontrado" });
  
  const imgPath = path.join(getLocalSlidesDir(c), req.params.filename);
  try {
    if (fs.existsSync(imgPath)) {
      fs.unlinkSync(imgPath);
      res.json({ ok: true, message: "Slide apagado com sucesso" });
    } else {
      res.status(404).json({ error: "Arquivo do slide não encontrado" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── API: Regenerate image ────────────────────────────────────────────────────
router.post("/api/carousels/:id/slide/:filename/regen", async (req, res) => {
  const all = await readData();
  const c = all.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "Não encontrado" });
  const imgPath = path.join(getLocalSlidesDir(c), req.params.filename);
  const { prompt, title, body, layout = "fullbleed" } = req.body;
  if (!prompt || !title || !body) return res.status(400).json({ error: "prompt, title e body são obrigatórios" });
  try {
    const { stdout } = await execFileAsync(PYTHON, [
      REGEN_SCRIPT,
      "--prompt", prompt, "--title", title, "--body", body,
      "--layout", layout, "--output", imgPath
    ], {
      timeout: 180000,
      cwd: path.join(__dirname, '..', '..'),
      env: {
        ...process.env,
        PYTHONPATH: [
          path.join(__dirname, '..', '..'),
          path.join(__dirname, '..', '..', 'python_packages'),
        ].join(process.platform === 'win32' ? ';' : ':'),
      }
    });
    logger.info('[Carousel]', "regen:", stdout.trim());
    res.json({ ok: true, message: stdout.trim() });
  } catch (e) {
    logger.error('[Carousel]', "regen error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── API: Download ZIP ────────────────────────────────────────────────────────
router.get("/api/carousels/:id/download-zip", async (req, res) => {
  const all = await readData();
  const c   = all.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "Carrossel não encontrado" });

  const slides = getSlidesFromDir(getLocalSlidesDir(c), c.slidePrefix);
  if (slides.length === 0) return res.status(404).json({ error: "Nenhum slide encontrado na pasta" });

  const payload  = [{ ...c, slides: slides.map(s => s.filename) }];
  const safeName = c.id.replace(/[^a-z0-9-]/gi, "-");
  const tmpFile  = path.join(os.tmpdir(), `${safeName}-${Date.now()}.zip`);

  try {
    const { stdout } = await execFileAsync(PYTHON, [
      ZIP_SCRIPT,
      "--data",   JSON.stringify(payload),
      "--output", tmpFile,
    ], { timeout: 60000 });
    logger.info('[Carousel]', "zip-carousel:", stdout.trim());

    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.zip"`);
    res.setHeader("Content-Type", "application/zip");
    const stream = fs.createReadStream(tmpFile);
    stream.pipe(res);
    stream.on("close", () => fs.unlink(tmpFile, () => {}));
  } catch (e) {
    logger.error('[Carousel]', "zip-carousel error:", e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ── API: Download ZIP — TODOS ────────────────────────────────────────────────
router.get("/api/download-all", async (req, res) => {
  const all  = await readData();
  const payload = all.map(c => {
    const slides = getSlidesFromDir(getLocalSlidesDir(c), c.slidePrefix);
    return { ...c, slides: slides.map(s => s.filename) };
  }).filter(c => c.slides.length > 0);

  if (payload.length === 0) {
    return res.status(404).json({ error: "Nenhum slide encontrado em nenhum carrossel" });
  }

  const tmpFile = path.join(os.tmpdir(), `afonteoculta-todos-${Date.now()}.zip`);

  try {
    const { stdout } = await execFileAsync(PYTHON, [
      ZIP_SCRIPT,
      "--data",   JSON.stringify(payload),
      "--output", tmpFile,
    ], { timeout: 180000 });
    logger.info('[Carousel]', "download-all:", stdout.trim());

    const date = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Disposition", `attachment; filename="afonteoculta-carrosseis-${date}.zip"`);
    res.setHeader("Content-Type", "application/zip");
    const stream = fs.createReadStream(tmpFile);
    stream.pipe(res);
    stream.on("close", () => fs.unlink(tmpFile, () => {}));
  } catch (e) {
    logger.error('[Carousel]', "download-all error:", e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ── API: Publicar no Instagram ───────────────────────────────────────────────
router.post("/api/carousels/:id/publish-instagram", async (req, res) => {
  const all = await readData();
  const c   = all.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "Carrossel não encontrado" });

  const PUBLISH_SCRIPT = path.join(__dirname, "..", "infra", "social", "publish_instagram.py");
  const caption = req.body.caption || c.caption || "";

  const args = [
    "-X", "utf8", PUBLISH_SCRIPT,
    "--id",      req.params.id,
  ];
  if (caption) {
    args.push("--caption", caption);
  }
  if (req.body.stories) {
    args.push("--stories");
  }

  try {
    const { stdout, stderr } = await execFileAsync("python", args, { timeout: 300000 });
    logger.info('[Carousel]', "publish-instagram:", stdout.trim());
    if (stderr) logger.error('[Carousel]', "publish-instagram stderr:", stderr.trim());

    const updated = (await readData()).find(x => x.id === req.params.id);
    res.json({ ok: true, log: stdout, carousel: updated });
  } catch (e) {
    logger.error('[Carousel]', "publish-instagram error:", e.message);
    res.status(500).json({ error: e.message, log: e.stdout || "" });
  }
});

// ── API: Criador — Capacidades do ambiente ────────────────────────────────────
router.get('/api/criador/capabilities', (req, res) => {
  res.json({ canGenerateImages: true, isProd: IS_PROD });
});

// ── API: Criador — Gerar carrossel completo ───────────────────────────────────
router.post('/api/criador/generate', async (req, res) => {
  const payload = req.body;

  if (!payload || !Array.isArray(payload.slides) || payload.slides.length === 0) {
    return res.status(400).json({ error: 'slides é obrigatório' });
  }

  let allCarousels = [];
  try {
    allCarousels = await readDataAsync();
  } catch (err) {
    logger.error('[Carousel]', "Erro ao ler carrosséis para determinar ID:", err);
  }

  let newId = payload.id;
  let existingCarousel = null;
  if (newId) {
    existingCarousel = allCarousels.find(c => c.id === newId);
  }

  if (!existingCarousel) {
    const nums = allCarousels.map(c => parseInt(c.id?.split('-').pop()) || 0).filter(Boolean);
    const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
    newId = `carrossel-${String(nextNum).padStart(2, '0')}`;
  }

  const slug = payload.title ? slugify(payload.title) : 'sem-titulo';
  let outDir;
  if (process.platform === 'win32') {
    const userProfile = process.env.USERPROFILE || 'C:/Users/julia';
    const onedrivePath = path.join(userProfile, 'OneDrive', 'Área de Trabalho');
    const hasOneDrive = fs.existsSync(onedrivePath);
    outDir = hasOneDrive
      ? path.join(onedrivePath, `${newId}-${slug}`).replace(/\\/g, '/')
      : path.join(userProfile, 'Desktop', `${newId}-${slug}`).replace(/\\/g, '/');
  } else {
    outDir = `/app/backend/storage/carousels/${newId}-${slug}`;
  }

  const noImageSlidesCount = payload.noImageSlidesCount !== undefined ? Number(payload.noImageSlidesCount) : (existingCarousel?.noImageSlidesCount || 0);

  const newCarousel = {
    id:          newId,
    title:       payload.title || existingCarousel?.title || 'Carrossel',
    theme:       payload.theme || existingCarousel?.theme || slug,
    format:      payload.format || existingCarousel?.format || 'B',
    status:      'generating',
    createdAt:   existingCarousel?.createdAt || new Date().toISOString(),
    slidesDir:   outDir,
    slidePrefix: 'slide-',
    totalSlides: Number(payload.totalSlides) || payload.slides.length || 10,
    imageQuality: payload.imageQuality || existingCarousel?.imageQuality || 'high',
    caption:     payload.caption || existingCarousel?.caption || '',
    notes:       payload.notes || existingCarousel?.notes || '',
    chatHistory: existingCarousel?.chatHistory || [],
    slides:      existingCarousel?.slides || [],
    noImageSlidesCount: noImageSlidesCount,
    imageProvider: process.env.ACTIVE_IMAGE_PROVIDER || existingCarousel?.imageProvider || 'gpt-image-2',
    copyModel:     process.env.COPY_GENERATION_MODEL || existingCarousel?.copyModel || 'gpt-4o',
  };

  if (existingCarousel) {
    const idx = allCarousels.findIndex(c => c.id === newId);
    allCarousels[idx] = newCarousel;
  } else {
    allCarousels.push(newCarousel);
  }
  await writeDataAsync(allCarousels);

  generationJobs.set(newId, {
    id: newId,
    title: newCarousel.title,
    status: 'generating',
    logs: ['Iniciando pipeline de geração de imagens...'],
    slides: [],
    totalSlides: payload.slides.length
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const broadcast = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {}
    sseClients.forEach(send => {
      try {
        send(data);
      } catch (e) {}
    });
  };

  logger.info('[Generator]', `PASSO 1: Iniciando pipeline para o carrossel ${newId}. Total de slides: ${payload.slides?.length}`);
  broadcast({ type: 'log', msg: `⚙️ [Servidor] PASSO 1: Iniciando geração do carrossel ${newId}` });

  const PYTHON   = process.platform === 'win32' ? 'python' : 'python3';
  const scriptName = process.env.USE_MOCK_GENERATOR === 'true' ? 'generate_mock_slides.py' : 'criador_pipeline.py';
  const PIPELINE = path.join(__dirname, '..', '..', 'core', scriptName);
  
  logger.info('[Generator]', `PASSO 2: Caminho do script: ${PIPELINE}. Python Exec: ${PYTHON} | Usando Mock: ${process.env.USE_MOCK_GENERATOR === 'true'}`);
  broadcast({ type: 'log', msg: `⚙️ [Servidor] PASSO 2: Caminho do pipeline: ${PIPELINE} (Mock: ${process.env.USE_MOCK_GENERATOR === 'true'})` });

  const spawnPayload = { ...payload, slidesDir: newCarousel.slidesDir };
  if (noImageSlidesCount > 0 && spawnPayload.slides && spawnPayload.slides.length > 0) {
    const totalS = spawnPayload.slides.length;
    for (let i = Math.max(0, totalS - noImageSlidesCount); i < totalS; i++) {
      spawnPayload.slides[i].layout = "text_only";
    }
  }
  const child = spawn(PYTHON, ['-X', 'utf8', PIPELINE, '--data', JSON.stringify(spawnPayload)], {
    shell: false,
    cwd: path.join(__dirname, '..', '..'),
    env: {
      ...process.env,
      PYTHONPATH: [
        path.join(__dirname, '..', '..'),
        path.join(__dirname, '..', '..', 'python_packages'),
      ].join(process.platform === 'win32' ? ';' : ':'),
    },
  });

  logger.info('[Generator]', `PASSO 3: Processo spawnado com PID ${child.pid}`);
  broadcast({ type: 'log', msg: `⚙️ [Servidor] PASSO 3: Processo de geração de imagens iniciado` });

  child.on('error', (err) => {
    logger.error('[Generator]', `PASSO 3 — FALHA NO SPAWN: ${err.message}. Stack: ${err.stack}`);
    const job = generationJobs.get(newId);
    if (job) {
      job.status = 'failed';
      job.logs.push(`Erro de spawn: ${err.message}`);
    }
    broadcast({ type: 'error', msg: `Falha ao iniciar Python: ${err.message}` });
    res.end();
  });

  const generatedFiles = [];
  let donePayload = null;
  let buf = '';

  child.stdout.on('data', (data) => {
    logger.info('[Generator]', `DADOS RECEBIDOS DA SAÍDA DO PIPELINE: ${data.toString().trim()}`);
    buf += data.toString();
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try {
        const obj = JSON.parse(t);
        const job = generationJobs.get(newId);
        if (job) {
          if (obj.type === 'slide') {
            const sIdx = job.slides.findIndex(s => s.num === obj.num);
            const slideData = {
              num: obj.num,
              estado: obj.estado,
              status: obj.status,
              filename: obj.file ? path.basename(obj.file) : `slide-${String(obj.num).padStart(2, '0')}.jpg`,
              msg: obj.msg || ''
            };
            if (sIdx >= 0) job.slides[sIdx] = slideData;
            else job.slides.push(slideData);
            job.logs.push(`[Slide ${obj.num}/${obj.total}] Estado: ${obj.estado} -> ${obj.status === 'ok' ? 'Concluído' : obj.status === 'erro' ? 'Erro' : 'Gerando'}`);
          } else if (obj.type === 'done') {
            job.status = 'done';
            job.logs.push(`Pipeline concluído. Sucesso em ${obj.total_ok}/${obj.total} slides.`);
          } else if (obj.type === 'error') {
            job.status = 'failed';
            job.logs.push(`Erro no pipeline: ${obj.msg}`);
          }
        }

        if (IS_PROD && obj.type === 'slide' && obj.status === 'ok' && obj.file) {
          generatedFiles.push({ num: obj.num, estado: obj.estado, file: obj.file });
        }
        if (IS_PROD && obj.type === 'done') donePayload = obj;
        broadcast(obj);
      } catch {
        const job = generationJobs.get(newId);
        if (job) job.logs.push(t);
        broadcast({ type: 'log', msg: t });
      }
    }
  });

  child.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      logger.error('[Generator]', `ERRO NO PIPELINE (STDERR): ${msg}`);
      const job = generationJobs.get(newId);
      if (job) job.logs.push(msg);
      broadcast({ type: 'log', msg: `⚠️ [Pipeline] ${msg}` });
    }
  });

  child.on('close', async (code) => {
    logger.info('[Generator]', `PASSO 4: Script finalizado com código de saída ${code}`);
    broadcast({ type: 'log', msg: `⚙️ [Servidor] PASSO 4: Processo encerrado com código ${code}` });
    if (buf.trim()) {
      try {
        const obj = JSON.parse(buf.trim());
        const job = generationJobs.get(newId);
        if (job) {
          if (obj.type === 'slide') {
            const sIdx = job.slides.findIndex(s => s.num === obj.num);
            const slideData = {
              num: obj.num,
              estado: obj.estado,
              status: obj.status,
              filename: obj.file ? path.basename(obj.file) : `slide-${String(obj.num).padStart(2, '0')}.jpg`,
              msg: obj.msg || ''
            };
            if (sIdx >= 0) job.slides[sIdx] = slideData;
            else job.slides.push(slideData);
          } else if (obj.type === 'done') {
            job.status = 'done';
          }
        }
        if (obj.type === 'slide' && obj.status === 'ok' && obj.file) {
          generatedFiles.push({ num: obj.num, estado: obj.estado, file: obj.file });
        }
        if (obj.type === 'done') donePayload = obj;
        broadcast(obj);
      } catch {}
    }

    const job = generationJobs.get(newId);
    if (job) {
      if (code !== 0 && job.status === 'generating') {
        job.status = 'failed';
      }
      job.logs.push(`Processo finalizado com código ${code}`);
      logger.info('[Carousel]', `Job ${newId} finalizado. Logs do pipeline:\n${job.logs.join('\n')}`);
    }

    if (b2 && generatedFiles.length > 0 && donePayload) {
      try {
        broadcast({ type: 'log', msg: '☁ Enviando imagens para o MinIO...' });

        const slideUrls = [];
        for (const { num, estado, file } of generatedFiles) {
          const filename = path.basename(file);
          try {
            const url = await b2.uploadImageToB2(newId, filename, file);
            slideUrls.push({ num, estado, filename, url });
            broadcast({ type: 'log', msg: `☁ ${filename} → MinIO ✓` });
          } catch (err) {
            broadcast({ type: 'log', msg: `☁ ${filename} falhou: ${err.message}` });
          }
          // Em dev local, não apagamos a pasta do Desktop para o usuário poder acessar as artes locais se quiser.
          // Se for produção, limpamos para poupar espaço.
          if (IS_PROD) {
            try { fs.unlinkSync(file); } catch {}
          }
        }
        if (IS_PROD) {
          try { fs.rmdirSync(donePayload.slides_dir); } catch {}
        }

        const allCarousels = await readDataAsync();
        const currentIdx = allCarousels.findIndex(c => c.id === newId);
        if (currentIdx >= 0) {
          const imageProvider = process.env.ACTIVE_IMAGE_PROVIDER || 'gpt-image-2';
          let costPerImage = 0.08;
          if (imageProvider === 'fal') costPerImage = 0.003;
          else if (imageProvider === 'gemini') costPerImage = 0.015;
          else if (imageProvider === 'gpt-image-1-mini' || imageProvider === 'dall-e-2') costPerImage = 0.02;

          const totalCost = slideUrls.length * costPerImage;

          allCarousels[currentIdx] = {
            ...allCarousels[currentIdx],
            title:       donePayload.title   || payload.title   || 'Carrossel',
            status:      (donePayload.total_ok === donePayload.total) ? 'pronto' : 'rascunho',
            totalSlides: slideUrls.length,
            caption:     donePayload.caption || payload.caption || '',
            notes:       donePayload.notes   || payload.notes   || '',
            b2BaseUrl:   b2.b2ImageUrl(newId, ''),
            slides:      slideUrls,
            cost:        totalCost,
            imageProvider: process.env.ACTIVE_IMAGE_PROVIDER || allCarousels[currentIdx].imageProvider || 'gpt-image-2',
            copyModel:     process.env.COPY_GENERATION_MODEL || allCarousels[currentIdx].copyModel || 'gpt-4o',
          };
          if (donePayload.revisor_score) allCarousels[currentIdx].revisorScore = donePayload.revisor_score;
          await writeDataAsync(allCarousels);
        }

        broadcast({ type: 'registered', id: newId, entry: allCarousels[currentIdx] });
        broadcast({ type: 'log', msg: `✓ ${newId} salvo no MinIO` });
      } catch (err) {
        broadcast({ type: 'error', msg: `Upload MinIO falhou: ${err.message}` });
      }
    } else {
      // Fallback local se o módulo MinIO/B2 não estiver configurado
      try {
        const localCarousels = await readDataAsync();
        const currentIdx = localCarousels.findIndex(c => c.id === newId);
        if (currentIdx >= 0) {
          const cRecord = localCarousels[currentIdx];
          const slides = getSlidesForCarousel(cRecord);
          localCarousels[currentIdx] = {
            ...cRecord,
            totalSlides: slides.length,
            slides: slides,
            status: code === 0 ? 'pronto' : 'rascunho'
          };
          await writeDataAsync(localCarousels);
        }
      } catch (err) {
        logger.error('[Carousel]', "Erro ao atualizar dados pós-geração local:", err);
      }
    }

    broadcast({ type: 'done', carouselId: newId });
    broadcast({ type: 'close', code });
    res.end();
  });
});

// ── API: Obter histórico de criação em tempo real ────────────────────────────
router.get('/api/carousels/:id/history', (req, res) => {
  const { id } = req.params;
  const job = generationJobs.get(id);
  if (!job) {
    return res.json({
      id,
      status: 'done',
      logs: ['Histórico de log em tempo real indisponível para este carrossel.'],
      slides: []
    });
  }
  res.json(job);
});

router.get('/api/debug-jobs', (req, res) => {
  res.json(Array.from(generationJobs.entries()));
});

// ── API: Criador — Chat unificado com streaming SSE ──────────────────────────
router.post('/api/criador/stream', async (req, res) => {
  const { messages, totalSlides } = req.body;
  let system = AGENT_SYSTEM_PROMPTS['criador'];
  if (!system) return res.status(500).json({ error: 'Agente criador não configurado' });

  // Injeta dinamicamente a quantidade de slides configurada no formulário dentro do System Prompt
  const numSlides = Number(totalSlides) || 10;
  if (numSlides !== 10) {
    system = system
      .replace(/completo de 10 slides/g, `completo de ${numSlides} slides`)
      .replace(/ESTRUTURA DOS 10 SLIDES/g, `ESTRUTURA DOS ${numSlides} SLIDES`)
      .replace(/10 ESTADOS:/g, `${numSlides} ESTADOS:`)
      .replace(/S10/g, `S${numSlides}`)
      .replace(/S9/g, `S${numSlides - 1}`)
      .replace(/S8/g, `S${numSlides - 2}`)
      .replace(/S10 \[CTA FIXO\]/g, `S${numSlides} [CTA FIXO]`)
      .replace(/S9 \[SETUP CTA\]/g, `S${numSlides - 1} [SETUP CTA]`)
      .replace(/S8 \[CRISTALIZAÇÃO\]/g, `S${numSlides - 2} [CRISTALIZAÇÃO]`);
    
    // Adiciona uma instrução clara no topo do system prompt instruindo a IA sobre a restrição de tamanho
    system = `IMPORTANTE: Para esta geração, o usuário configurou e deseja estritamente um carrossel de exatamente ${numSlides} slides. Adapte o Método Jordânico de Curva Dramática e sintetize as etapas para caberem exatamente em ${numSlides} slides (S1 até S${numSlides}), garantindo que o slide final S${numSlides} seja o CTA FIXO.\n\n` + system;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages é obrigatório' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.write(`data: ${JSON.stringify({ error: 'OPENAI_API_KEY não configurada' })}\n\n`);
    return res.end();
  }

  const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
  const OPENAI_MODEL = process.env.COPY_GENERATION_MODEL || 'gpt-4o';

  try {
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'ai' ? 'assistant' : msg.role,
      content: msg.content || ''
    }));

    let response;
    try {
      const payload = {
        model: OPENAI_MODEL,
        messages: [{ role: 'system', content: system }, ...formattedMessages],
        max_completion_tokens: 4000,
        stream: true,
      };

      // Modelos o1, o3 ou gpt-5 não suportam alteração de temperatura na API da OpenAI
      const isReasoningModel = OPENAI_MODEL.startsWith('o1-') || OPENAI_MODEL.startsWith('o3-') || OPENAI_MODEL.startsWith('gpt-5');
      if (!isReasoningModel) {
        payload.temperature = 0.88;
      }

      response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (fetchErr) {
      // Erro de rede (DNS, conexão recusada, timeout, etc.)
      const cause = fetchErr.cause?.message || fetchErr.cause?.code || '';
      const detail = cause ? ` (causa: ${cause})` : '';
      logger.error('[Carousel]', `criador/stream — falha de rede ao conectar com a OpenAI${detail}. URL: ${OPENAI_URL}. Erro: ${fetchErr.message}. Stack: ${fetchErr.stack}`);
      const userMsg = `Erro de conexão com a OpenAI: não foi possível alcançar ${OPENAI_URL}.${detail} Verifique a conexão de rede do servidor ou se a API da OpenAI está fora do ar.`;
      res.write(`data: ${JSON.stringify({ error: userMsg })}\n\n`);
      return res.end();
    }

    if (!response.ok) {
      let errText = `HTTP ${response.status}`;
      let rawBody = '';
      try {
        const j = await response.json();
        rawBody = JSON.stringify(j);
        errText = j.error?.message || errText;
      } catch {}

      logger.error('[Carousel]', `criador/stream — OpenAI retornou erro HTTP ${response.status}. Modelo: ${OPENAI_MODEL}. Corpo: ${rawBody}`);

      if (response.status === 401) {
        errText = 'A OPENAI_API_KEY configurada é inválida ou expirou. Verifique a chave no arquivo .env do servidor.';
      } else if (response.status === 403) {
        errText = 'Acesso negado pela OpenAI (403). A chave pode não ter permissão para usar o modelo ' + OPENAI_MODEL + '.';
      } else if (response.status === 404) {
        errText = `Modelo "${OPENAI_MODEL}" não encontrado na OpenAI (404). Verifique se o nome do modelo está correto ou se sua conta tem acesso a ele.`;
      } else if (errText.includes('quota') || errText.includes('billing') || response.status === 429) {
        errText = 'Você excedeu sua cota atual na OpenAI ou atingiu o limite de requisições. Adicione créditos em: https://platform.openai.com/settings/organization/billing/overview';
      } else if (response.status >= 500) {
        errText = `A OpenAI retornou um erro interno (${response.status}). Tente novamente em alguns instantes.`;
      }

      res.write(`data: ${JSON.stringify({ error: errText })}\n\n`);
      return res.end();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t || t === 'data: [DONE]') continue;
        if (t.startsWith('data: ')) {
          try {
            const json = JSON.parse(t.slice(6));
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
          } catch {}
        }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, model: OPENAI_MODEL })}\n\n`);
    res.end();
  } catch (e) {
    const cause = e.cause?.message || e.cause?.code || '';
    logger.error('[Carousel]', `criador/stream — erro inesperado: ${e.message}${cause ? ' | causa: ' + cause : ''}. Stack: ${e.stack}`);
    const userMsg = `Erro inesperado ao processar resposta da IA: ${e.message}${cause ? ' (' + cause + ')' : ''}`;
    if (!res.headersSent) res.status(500).json({ error: userMsg });
    else { res.write(`data: ${JSON.stringify({ error: userMsg })}\n\n`); res.end(); }
  }
});

router.post("/api/escala/criar-mock", async (req, res) => {
  if (!req.user || !isUserSuperAdmin(req.user.email)) {
    return res.status(403).json({ error: "Acesso negado. Apenas super admins podem usar o teste de escala." });
  }

  const payload = req.body;
  if (!payload || !Array.isArray(payload.slides) || payload.slides.length === 0) {
    return res.status(400).json({ error: "slides é obrigatório" });
  }

  let allCarousels = [];
  try {
    allCarousels = await readDataAsync();
  } catch (err) {
    logger.error('[Carousel]', "Erro ao ler carrosséis para determinar ID:", err);
  }

  // Se o carrossel do rascunho com o ID anterior já existe, atualizamos ele em vez de duplicar
  const targetId = payload.id;
  let existingIndex = -1;
  if (targetId) {
    existingIndex = allCarousels.findIndex(c => c.id === targetId);
  }

  const finalId = existingIndex >= 0 ? targetId : (() => {
    const nums = allCarousels.map(c => parseInt(c.id?.split('-').pop()) || 0).filter(Boolean);
    const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
    return `carrossel-${String(nextNum).padStart(2, '0')}`;
  })();

  const slug = payload.title ? slugify(payload.title) : 'sem-titulo';
  const outDir = path.join(__dirname, '..', '..', 'storage', `carrossel-${slug}`);

  const slidesData = payload.slides.map((s, idx) => ({
    num: idx + 1,
    title_text: s.title || s.title_text || `Slide ${idx + 1}`,
    text: s.body || s.text || ""
  }));

  const estimatedCost = slidesData.length * 0.08;
  const baseCarousel = existingIndex >= 0 ? allCarousels[existingIndex] : {};

  // Formata os slides em markdown legível para o campo notes
  const notesContent = slidesData.map(s => `[Slide ${s.num}]\nTítulo: ${s.title_text}\nCorpo: ${s.text}`).join('\n\n');

  const updatedCarousel = {
    ...baseCarousel,
    id:          finalId,
    title:       payload.title || baseCarousel.title || 'Carrossel em Escala',
    theme:       payload.title || baseCarousel.theme || 'Geração Automática',
    format:      payload.format || baseCarousel.format || 'B',
    status:      'generating',
    preset:      'escala',
    cost:        estimatedCost,
    createdAt:   baseCarousel.createdAt || new Date().toISOString(),
    slidesDir:   outDir.replace(/\\/g, '/'),
    slidePrefix: 'slide-',
    totalSlides: payload.totalSlides || slidesData.length || baseCarousel.totalSlides || 10,
    imageQuality: payload.imageQuality || baseCarousel.imageQuality || 'high',
    caption:     payload.caption || baseCarousel.caption || '',
    notes:       notesContent,
    chatHistory: baseCarousel.chatHistory || [],
    slides:      [], // Inicia vazio para preencher progressivamente com os delays!
  };

  if (existingIndex >= 0) {
    allCarousels[existingIndex] = updatedCarousel;
  } else {
    allCarousels.push(updatedCarousel);
  }
  
  await writeDataAsync(allCarousels);

  res.json({ ok: true, carousel: updatedCarousel });

  (async () => {
    try {
      // Carrega as configurações de branding salvas no banco/JSON
      let branding = {
        logoText: "FONTE OCULTA",
        logoColor: "#ffffff",
        carouselTextColor: "#e4e4e7"
      };
      try {
        const brandingPath = path.join(__dirname, '..', 'data', 'branding.json');
        if (fs.existsSync(brandingPath)) {
          branding = JSON.parse(fs.readFileSync(brandingPath, 'utf-8'));
        }
      } catch (err) {
        logger.error('[Carousel mock branding]', "Erro ao ler branding.json:", err.message);
      }

      const PYTHON = process.platform === 'win32' ? 'python' : 'python3';
      const PIPELINE = path.join(__dirname, '..', '..', 'core', 'generate_mock_slides.py');
      
      const child = spawn(PYTHON, ['-X', 'utf8', PIPELINE, '--data', JSON.stringify({
        id: finalId,
        title: updatedCarousel.title,
        slidesDir: updatedCarousel.slidesDir,
        format: updatedCarousel.format,
        slides: slidesData,
        logoText: branding.logoText || "FONTE OCULTA",
        logoColor: branding.logoColor || "#ffffff",
        logoSize: branding.logoSize || "22px",
        carouselTextColor: branding.carouselTextColor || "#e4e4e7",
        titleTextSize: branding.titleTextSize || "40px",
        bodyTextSize: branding.bodyTextSize || "24px",
        titleTextColor: branding.titleTextColor || "#ffffff",
        bodyTextColor: branding.bodyTextColor || branding.carouselTextColor || "#e4e4e7",
        logoPosition: branding.logoPosition || "left"
      })], {
        shell: false,
        cwd: path.join(__dirname, '..', '..'),
        env: { ...process.env }
      });

      const generatedFiles = [];
      let donePayload = null;

      child.stdout.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.type === 'slide' && obj.status === 'ok') {
              // No script python, o campo filename retornado não tem o path completo
              const fileAbsPath = path.join(outDir, obj.filename);
              generatedFiles.push({
                num: obj.num,
                estado: obj.estado || 'PRODUÇÃO',
                file: fileAbsPath,
                filename: obj.filename
              });
              
              // Notificar progresso de geração do slide via SSE
              sseClients.forEach(send => send({
                type: 'slide',
                carouselId: finalId,
                num: obj.num,
                total: slidesData.length,
                estado: obj.estado || 'PRODUÇÃO',
                status: 'generating_image',
                filename: obj.filename,
                title_text: slidesData[obj.num - 1]?.title_text || ''
              }));
            } else if (obj.type === 'done') {
              donePayload = obj;
            }
          } catch (e) {}
        }
      });

      child.stderr.on('data', (chunk) => {
        logger.error('[Carousel mock stderr]', chunk.toString().trim());
      });

      // Aguarda o encerramento do processo python
      const code = await new Promise((resolve) => {
        child.on('close', resolve);
      });

      logger.info('[Carousel mock]', `Script Python finalizou com código ${code}. Arquivos gerados: ${generatedFiles.length}`);

      if (generatedFiles.length > 0) {
        const currentSlidesList = [];

        if (b2) {
          sseClients.forEach(send => send({
            type: 'log',
            carouselId: finalId,
            msg: '☁ Enviando slides gerados para o MinIO...'
          }));

          const slideUrls = [];
          for (const { num, estado, file, filename } of generatedFiles) {
            try {
              // Upload direto para o bucket do MinIO
              const url = await b2.uploadImageToB2(finalId, filename, file);
              slideUrls.push({ num, estado, filename, url });
              currentSlidesList.push(filename);
              
              sseClients.forEach(send => send({
                type: 'log',
                carouselId: finalId,
                msg: `☁ ${filename} → MinIO ✓`
              }));

              // Adiciona o slide criado no banco progressivamente para atualizar a interface
              const localCarousels = await readDataAsync();
              const idx = localCarousels.findIndex(c => c.id === finalId);
              if (idx >= 0) {
                localCarousels[idx].slides = [...currentSlidesList];
                await writeDataAsync(localCarousels);
              }

              // Avisa o frontend que este slide está com imagem pronta (Mock)
              sseClients.forEach(send => send({
                type: 'slide',
                carouselId: finalId,
                num: num,
                total: slidesData.length,
                estado: estado,
                status: 'ok',
                filename: filename
              }));

            } catch (err) {
              logger.error('[Carousel mock upload]', `Falha no upload de ${filename} para o MinIO: ${err.message}`);
            }

            // Limpa arquivo temporário local no container para não acumular lixo
            try { fs.unlinkSync(file); } catch {}
          }

          // Limpa pasta temporária local do container
          try { fs.rmdirSync(outDir); } catch {}
        } else {
          // Local fallback: files are stored on disk in outDir
          for (const { num, estado, filename } of generatedFiles) {
            currentSlidesList.push(filename);
            
            // Avisa o frontend que este slide está pronto localmente
            sseClients.forEach(send => send({
              type: 'slide',
              carouselId: finalId,
              num: num,
              total: slidesData.length,
              estado: estado,
              status: 'ok',
              filename: filename
            }));
          }
        }

        // Atualiza status final do carrossel no banco local de dados
        const localCarousels = await readDataAsync();
        const idx = localCarousels.findIndex(c => c.id === finalId);
        if (idx >= 0) {
          localCarousels[idx].status = 'pronto';
          localCarousels[idx].totalSlides = currentSlidesList.length;
          localCarousels[idx].slides = currentSlidesList;
          if (b2) {
            localCarousels[idx].b2BaseUrl = b2.b2ImageUrl(finalId, '');
          }
          if (!localCarousels[idx].cost || localCarousels[idx].cost === 0) {
            localCarousels[idx].cost = slidesData.length * 0.08;
          }
          await writeDataAsync(localCarousels);
        }
      }

      await new Promise(r => setTimeout(r, 1000));

      sseClients.forEach(send => send({
        type: 'done',
        carouselId: finalId
      }));

    } catch (err) {
      logger.error('[Carousel mock simulation]', `Erro na simulação e upload do mock: ${err.message}`);
    }
  })();
});

export default router;

