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
  ZIP_SCRIPT 
} from "../state.js";
import { logger } from '../logger.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = express.Router();
const AGENT_SYSTEM_PROMPTS = buildAgentPrompts(CLIENT);

// ── API: List all carousels ──────────────────────────────────────────────────
router.get("/api/carousels", async (req, res) => {
  const all = await readDataAsync();
  const carousels = all.map(c => {
    const slides = getSlidesForCarousel(c);
    return { ...c, slidesFound: slides.length, slides };
  });
  res.json(carousels);
});

// ── API: Get single carousel ─────────────────────────────────────────────────
router.get("/api/carousels/:id", async (req, res) => {
  const all = await readDataAsync();
  const c = all.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "Carrossel não encontrado" });
  const slides = getSlidesForCarousel(c);
  res.json({ ...c, slides });
});

// ── API: Create carousel ─────────────────────────────────────────────────────
router.post("/api/carousels", async (req, res) => {
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
    createdAt: new Date().toISOString().split("T")[0],
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

  res.json(newCarousel);
});

// ── API: Update carousel status/fields ──────────────────────────────────────
router.put("/api/carousels/:id", async (req, res) => {
  const all = await readData();
  const idx = all.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Não encontrado" });
  all[idx] = { ...all[idx], ...req.body, id: all[idx].id };
  await writeData(all);
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
  // Em produção: redireciona direto para URL pública do B2
  if (IS_PROD && b2) {
    const url = b2.b2ImageUrl(req.params.id, req.params.filename);
    return res.redirect(302, url);
  }
  // Local: serve do disco
  const all = await readData();
  const c = all.find(x => x.id === req.params.id);
  if (!c) return res.status(404).send("Carrossel não encontrado");
  const imgPath = path.join(getLocalSlidesDir(c), req.params.filename);
  if (!fs.existsSync(imgPath)) return res.status(404).send("Imagem não encontrada");
  res.sendFile(imgPath);
});

// ── API: Download single slide ───────────────────────────────────────────────
router.get("/api/carousels/:id/download/:filename", async (req, res) => {
  if (IS_PROD && b2) {
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
  if (!fs.existsSync(imgPath)) return res.status(404).json({ error: "Imagem não encontrada" });
  const { title, body, layout = "fullbleed" } = req.body;
  if (!title || !body) return res.status(400).json({ error: "title e body são obrigatórios" });
  try {
    const { stdout } = await execFileAsync("python", [
      COMPOSE_SCRIPT,
      "--image", imgPath, "--title", title, "--body", body,
      "--layout", layout, "--output", imgPath
    ], { timeout: 60000 });
    logger.info('[Carousel]', "recompose:", stdout.trim());
    const metaPath = imgPath.replace(/\.(jpg|jpeg|png)$/i, ".meta.json");
    fs.writeFileSync(metaPath, JSON.stringify({ title, body, layout }, null, 2));
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
    const { stdout } = await execFileAsync("python", [
      REGEN_SCRIPT,
      "--prompt", prompt, "--title", title, "--body", body,
      "--layout", layout, "--output", imgPath
    ], { timeout: 180000 });
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
    const { stdout } = await execFileAsync("python", [
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
    const { stdout } = await execFileAsync("python", [
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
  const nums = allCarousels.map(c => parseInt(c.id?.split('-').pop()) || 0).filter(Boolean);
  const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
  const newId = `carrossel-${String(nextNum).padStart(2, '0')}`;

  const slug = payload.title ? slugify(payload.title) : 'sem-titulo';
  const outDir = process.platform === 'win32'
    ? `C:/Users/julia/Desktop/carrossel-${slug}`
    : `/tmp/carrossel-${slug}`;

  const newCarousel = {
    id:          newId,
    title:       payload.title || 'Carrossel',
    theme:       slug,
    format:      payload.format || 'B',
    status:      'rascunho',
    createdAt:   new Date().toISOString().slice(0, 10),
    slidesDir:   outDir,
    slidePrefix: 'slide-',
    totalSlides: Number(payload.totalSlides) || payload.slides.length || 10,
    imageQuality: payload.imageQuality || 'high',
    caption:     payload.caption || '',
    notes:       payload.notes || '',
    slides:      [],
  };

  allCarousels.push(newCarousel);
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

  res.write(`data: ${JSON.stringify({ type: 'start', carouselId: newId, total: payload.slides.length })}\n\n`);

  const PYTHON   = process.platform === 'win32' ? 'python' : 'python3';
  const PIPELINE = path.join(__dirname, '..', 'core', 'criador_pipeline.py');
  const child = spawn(PYTHON, ['-X', 'utf8', PIPELINE, '--data', JSON.stringify(payload)], {
    shell: false,
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PYTHONPATH: [
        path.join(__dirname, '..'),
        path.join(__dirname, '..', 'python_packages'),
      ].join(process.platform === 'win32' ? ';' : ':'),
    },
  });

  child.on('error', (err) => {
    const job = generationJobs.get(newId);
    if (job) {
      job.status = 'failed';
      job.logs.push(`Erro de spawn: ${err.message}`);
    }
    res.write(`data: ${JSON.stringify({ type: 'error', msg: err.message })}\n\n`);
    res.end();
  });

  const generatedFiles = [];
  let donePayload = null;
  let buf = '';

  child.stdout.on('data', (data) => {
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
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
      } catch {
        const job = generationJobs.get(newId);
        if (job) job.logs.push(t);
        res.write(`data: ${JSON.stringify({ type: 'log', msg: t })}\n\n`);
      }
    }
  });

  child.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      const job = generationJobs.get(newId);
      if (job) job.logs.push(msg);
      res.write(`data: ${JSON.stringify({ type: 'log', msg })}\n\n`);
    }
  });

  child.on('close', async (code) => {
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
        if (IS_PROD && obj.type === 'slide' && obj.status === 'ok' && obj.file) {
          generatedFiles.push({ num: obj.num, estado: obj.estado, file: obj.file });
        }
        if (IS_PROD && obj.type === 'done') donePayload = obj;
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
      } catch {}
    }

    const job = generationJobs.get(newId);
    if (job) {
      if (code !== 0 && job.status === 'generating') {
        job.status = 'failed';
      }
      job.logs.push(`Processo finalizado com código ${code}`);
    }

    if (!IS_PROD) {
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

    if (IS_PROD && b2 && generatedFiles.length > 0 && donePayload) {
      try {
        res.write(`data: ${JSON.stringify({ type: 'log', msg: '☁ Enviando imagens para B2...' })}\n\n`);

        const slideUrls = [];
        for (const { num, estado, file } of generatedFiles) {
          const filename = path.basename(file);
          try {
            const url = await b2.uploadImageToB2(newId, filename, file);
            slideUrls.push({ num, estado, filename, url });
            res.write(`data: ${JSON.stringify({ type: 'log', msg: `☁ ${filename} → B2 ✓` })}\n\n`);
          } catch (err) {
            res.write(`data: ${JSON.stringify({ type: 'log', msg: `☁ ${filename} falhou: ${err.message}` })}\n\n`);
          }
          try { fs.unlinkSync(file); } catch {}
        }
        try { fs.rmdirSync(donePayload.slides_dir); } catch {}

        const prodCarousels = await readDataAsync();
        const currentIdx = prodCarousels.findIndex(c => c.id === newId);
        if (currentIdx >= 0) {
          prodCarousels[currentIdx] = {
            ...prodCarousels[currentIdx],
            title:       donePayload.title   || payload.title   || 'Carrossel',
            status:      (donePayload.total_ok === donePayload.total) ? 'pronto' : 'rascunho',
            totalSlides: slideUrls.length,
            caption:     donePayload.caption || payload.caption || '',
            notes:       donePayload.notes   || payload.notes   || '',
            b2BaseUrl:   b2.b2ImageUrl(newId, ''),
            slides:      slideUrls,
          };
          if (donePayload.revisor_score) prodCarousels[currentIdx].revisorScore = donePayload.revisor_score;
          await writeDataAsync(prodCarousels);
        }

        res.write(`data: ${JSON.stringify({ type: 'registered', id: newId, entry: prodCarousels[currentIdx] })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'log', msg: `✓ ${newId} salvo no B2` })}\n\n`);
      } catch (err) {
        res.write(`data: ${JSON.stringify({ type: 'error', msg: `Upload B2 falhou: ${err.message}` })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'close', code })}\n\n`);
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

// ── API: Criador — Chat unificado com streaming SSE ──────────────────────────
router.post('/api/criador/stream', async (req, res) => {
  const { messages } = req.body;
  const system = AGENT_SYSTEM_PROMPTS['criador'];
  if (!system) return res.status(500).json({ error: 'Agente criador não configurado' });

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

  try {
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'ai' ? 'assistant' : msg.role,
      content: msg.content || ''
    }));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.4',
        messages: [{ role: 'system', content: system }, ...formattedMessages],
        max_completion_tokens: 4000,
        temperature: 0.88,
        stream: true,
      }),
    });

    if (!response.ok) {
      let errText = `HTTP ${response.status}`;
      try { const j = await response.json(); errText = j.error?.message || errText; } catch {}
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

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (e) {
    logger.error('[Carousel]', 'criador/stream error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
    else { res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`); res.end(); }
  }
});

export default router;
