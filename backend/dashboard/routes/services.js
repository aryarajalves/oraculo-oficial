import express from "express";
import fs from "fs";
import path from "path";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { 
  readData, 
  readReelsHistory, 
  writeReelsHistory, 
  getSlidesFromDir, 
  getLocalSlidesDir 
} from "../helpers.js";
import { buildAgentPrompts } from "../agentPrompts.js";
import { CLIENT } from "../state.js";
import { logger } from '../logger.js';
import { query } from '../db.js';
import { encrypt, decrypt, getSecret } from '../crypto.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = express.Router();
const AGENT_SYSTEM_PROMPTS = buildAgentPrompts(CLIENT);

// ── Path Resolutions ─────────────────────────────────────────────────────────
const ORACULO_SCRIPT = path.join(__dirname, "..", "..", "oraculo_metrics.py");
const ORACULO_DATA_FILE = path.join(__dirname, "..", "data", "oraculo_data.json");
const ORACULO_COMPLETO_SCRIPT = path.join(__dirname, "..", "..", "core", "agentes", "oraculo_completo.py");
const HAU_PIPELINE = path.join(__dirname, "..", "..", "core", "agentes", "pipeline_haucacau.py");
const AGENTS_DIR = path.join(__dirname, "..", "..", "agents");
const NAMES_FILE = path.join(AGENTS_DIR, "display_names.json");
const BRANDING_FILE = path.join(__dirname, "..", "data", "branding.json");
const RADAR_DATA_FILE = path.join(__dirname, "..", "data", "radar_data.json");
const RADAR_SCRIPT = path.join(__dirname, "..", "..", "infra", "social", "radar_apify.py");
const REELS_SCRIPT = path.join(__dirname, "..", "..", "core", "agentes", "reels_engineer.py");
const dlScript = path.join(__dirname, "..", "scripts", "download_reel.py");
const PIPELINE_SCRIPT = path.join(__dirname, "..", "..", "processos", "pipeline_reels.py");

const ENV_PATH = fs.existsSync(path.join(__dirname, '..', '..', '.env'))
  ? path.join(__dirname, '..', '..', '.env')
  : path.join(__dirname, '..', '..', '..', '.env');

const MANAGED_KEYS = [
  { key: 'OPENAI_API_KEY',       label: 'OpenAI API Key',          group: 'Geração de Imagem' },
  { key: 'FAL_KEY',              label: 'Fal.ai API Key',           group: 'Geração de Imagem' },
  { key: 'GEMINI_API_KEY',       label: 'Google Gemini API Key',    group: 'Geração de Imagem' },
  { key: 'ELEVENLABS_API_KEY',   label: 'ElevenLabs API Key',       group: 'Áudio' },
  { key: 'META_ACCESS_TOKEN',    label: 'Meta / Instagram Token',   group: 'Publicação' },
  { key: 'INSTAGRAM_ACCOUNT_ID', label: 'Instagram Account ID',     group: 'Publicação' },
  { key: 'FACEBOOK_PAGE_ID',     label: 'Facebook Page ID',         group: 'Publicação' },
  { key: 'NOTION_TOKEN',         label: 'Notion Token',             group: 'Integrações' },
  { key: 'APIFY_API_KEY',        label: 'Apify API Key',            group: 'Integrações' },
  { key: 'ACTIVE_IMAGE_PROVIDER',label: 'Provedor de Imagem Ativo', group: 'Geração de Imagem' },
];

function readEnvFile() {
  try { return fs.readFileSync(ENV_PATH, 'utf-8'); } catch { return ''; }
}

function parseEnvFile(content) {
  const result = {};
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    result[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return result;
}

function maskValue(v) {
  if (!v || v.length < 6) return v ? '••••' : '';
  return '••••' + v.slice(-4);
}

// ── API: Oráculo — Buscar métricas reais do Instagram ────────────────────────
router.post("/api/oraculo/update", async (req, res) => {
  const carouselId = req.body.id || null;
  const args = ["-X", "utf8", ORACULO_SCRIPT];
  if (carouselId) args.push("--id", carouselId);

  try {
    const { stdout, stderr } = await execFileAsync("python", args, { timeout: 60000 });
    logger.info('[Services]', "oraculo:", stdout.trim());
    const all = await readData();
    res.json({ ok: true, log: stdout, carousels: all });
  } catch (e) {
    logger.error('[Services]', "oraculo error:", e.message);
    res.status(500).json({ error: e.message, log: e.stdout || "" });
  }
});

router.get("/api/oraculo", async (req, res) => {
  const all = await readData();
  const withMetrics = all
    .filter(c => c.metrics)
    .map(c => ({
      id:          c.id,
      title:       c.title,
      status:      c.status,
      publishedAt: c.publishedAt || "",
      permalink:   c.metrics?.permalink || "",
      likes:       c.metrics?.likes || 0,
      comments:    c.metrics?.comments || 0,
      impressions: c.metrics?.impressions || 0,
      reach:       c.metrics?.reach || 0,
      saved:       c.metrics?.saved || 0,
      shares:      c.metrics?.shares || 0,
      engagement:  c.metrics?.engagement || 0,
      updated_at:  c.metrics?.updated_at || "",
    }))
    .sort((a, b) => b.engagement - a.engagement);
  res.json(withMetrics);
});

// Sincroniza todos os posts do Instagram
router.post("/api/oraculo/sync", async (req, res) => {
  try {
    const { stdout, stderr } = await execFileAsync("python", [
      "-X", "utf8", ORACULO_COMPLETO_SCRIPT
    ], { timeout: 300000 });
    logger.info('[Services]', "oraculo-sync:", stdout.trim());
    if (stderr) logger.error('[Services]', "oraculo-sync stderr:", stderr.trim());
    const data = readOraculoData();
    res.json({ ok: true, log: stdout, ...data });
  } catch (e) {
    logger.error('[Services]', "oraculo-sync error:", e.message);
    res.status(500).json({ error: e.message, log: e.stdout || "" });
  }
});

function readOraculoData() {
  try {
    return JSON.parse(fs.readFileSync(ORACULO_DATA_FILE, "utf-8"));
  } catch {
    return { posts: [], last_sync: null, total_posts: 0, totals: {} };
  }
}

// Retorna dados do Oráculo
router.get("/api/oraculo/completo", (req, res) => {
  res.json(readOraculoData());
});

// ── API: HauCacau — Gerar Carrossel ──────────────────────────────────────────
router.post("/api/haucacau/gerar", (req, res) => {
  const { tema, universo = 2, avatar = "A", ancora = "" } = req.body;
  if (!tema) return res.status(400).json({ error: "tema é obrigatório" });

  const params = JSON.stringify({ tema, universo, avatar, ancora });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  const proc = spawn("python", ["-X", "utf8", HAU_PIPELINE, "--data", params]);

  proc.stdout.on("data", chunk => {
    chunk.toString().split("\n").filter(Boolean).forEach(line => {
      try {
        const obj = JSON.parse(line);
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
      } catch {}
    });
  });

  proc.stderr.on("data", chunk => {
    res.write(`data: ${JSON.stringify({ type: "log", msg: chunk.toString().trim() })}\n\n`);
  });

  proc.on("close", code => {
    res.write(`data: ${JSON.stringify({ type: "closed", code })}\n\n`);
    res.end();
  });
});

// ── API: HauCacau — Listar carrosséis ────────────────────────────────────────
router.get("/api/haucacau/carousels", async (req, res) => {
  const all = await readData();
  res.json(all.filter(c => c.projeto === "haucacau"));
});

// ── API: Stats ───────────────────────────────────────────────────────────────
router.get("/api/stats", async (req, res) => {
  const all = await readData();
  const statusCount = {};
  let totalSlides = 0;
  let totalCost = 0;
  all.forEach(c => {
    statusCount[c.status] = (statusCount[c.status] || 0) + 1;
    const slides = getSlidesFromDir(getLocalSlidesDir(c), c.slidePrefix);
    totalSlides += slides.length;
    if (c.costUSD) totalCost += Number(c.costUSD) || 0;
  });
  res.json({
    totalCarousels: all.length,
    totalSlides,
    byStatus: statusCount,
    totalCost: Math.round(totalCost * 10000) / 10000,
    lastUpdated: new Date().toISOString(),
    total: all.length,
    slides: totalSlides,
    aprovados: (statusCount['aprovado'] || 0) + (statusCount['pronto'] || 0),
    publicados: statusCount['publicado'] || 0,
    cost: Math.round(totalCost * 10000) / 10000,
  });
});

// ── API: Settings Keys ────────────────────────────────────────────────────────
router.get('/api/settings/keys', (req, res) => {
  const env = parseEnvFile(readEnvFile());
  const result = MANAGED_KEYS.map(({ key, label, group }) => ({
    key, label, group,
    value: env[key] || '',
    masked: maskValue(env[key] || ''),
    set: !!(env[key] && env[key] !== `sua_${key.toLowerCase()}_aqui`),
  }));
  res.json({
    keys: result,
    activeProvider: env['ACTIVE_IMAGE_PROVIDER'] || 'gpt-image-2',
  });
});

router.post('/api/settings/keys', (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'body inválido' });

  let content = readEnvFile();
  const lines = content.split('\n');

  for (const [key, value] of Object.entries(updates)) {
    if (!value && value !== '') continue;
    const idx = lines.findIndex(l => {
      const t = l.trim();
      return !t.startsWith('#') && t.startsWith(key + '=');
    });
    const newLine = `${key}=${value}`;
    if (idx >= 0) {
      lines[idx] = newLine;
    } else {
      lines.push(newLine);
    }
  }

  try {
    fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf-8');
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) process.env[k] = v;
    }
    res.json({ ok: true, updated: Object.keys(updates) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── API: Prompts dos Agentes ──────────────────────────────────────────────────
function readDisplayNames() {
  try {
    if (fs.existsSync(NAMES_FILE)) {
      return JSON.parse(fs.readFileSync(NAMES_FILE, 'utf-8'));
    }
  } catch (e) {}
  return {};
}

function writeDisplayNames(data) {
  try {
    fs.writeFileSync(NAMES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}
}

router.get('/api/settings/prompts', (req, res) => {
  try {
    if (!fs.existsSync(AGENTS_DIR)) {
      return res.json({ prompts: [] });
    }
    const files = fs.readdirSync(AGENTS_DIR);
    const displayNames = readDisplayNames();
    const prompts = files
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const id = f.replace('.md', '');
        const content = fs.readFileSync(path.join(AGENTS_DIR, f), 'utf-8');
        let name = displayNames[id];
        if (!name) {
          name = id
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
            .replace('Haucacau', 'HauCacau')
            .replace('V2', 'V2')
            .replace('Dna', 'DNA')
            .replace('Cta', 'CTA');
        }
        return { id, name, content };
      });
    res.json({ prompts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/settings/prompts', (req, res) => {
  const { id, content } = req.body;
  if (!id || content === undefined) {
    return res.status(400).json({ error: 'Parâmetros inválidos. É necessário fornecer id e content.' });
  }
  const safeId = path.basename(id);
  const filePath = path.join(AGENTS_DIR, `${safeId}.md`);
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/settings/prompts/rename', (req, res) => {
  const { id, name } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: 'Parâmetros inválidos. Forneça id e name.' });
  }
  try {
    const displayNames = readDisplayNames();
    displayNames[id] = name;
    writeDisplayNames(displayNames);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── API: Branding e Estilo Visual ─────────────────────────────────────────────
function readBranding() {
  try {
    if (fs.existsSync(BRANDING_FILE)) {
      return JSON.parse(fs.readFileSync(BRANDING_FILE, 'utf-8'));
    }
  } catch (e) {}
  return {
    logoText: "FONTE OCULTA",
    logoSub: "PRODUÇÃO",
    logoSize: "13px",
    logoColor: "#ffffff",
    carouselTextSize: "15px",
    carouselTextColor: "#e4e4e7"
  };
}

function writeBranding(data) {
  try {
    fs.writeFileSync(BRANDING_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}
}

router.get('/api/settings/branding', (req, res) => {
  res.json(readBranding());
});

router.post('/api/settings/branding', (req, res) => {
  const data = req.body;
  if (!data) return res.status(400).json({ error: 'corpo inválido' });
  writeBranding(data);
  res.json({ ok: true });
});

// ── API: Radar de Descobertas ─────────────────────────────────────────────────
function readRadarData() {
  try {
    return JSON.parse(fs.readFileSync(RADAR_DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

router.post("/api/radar/sync", async (req, res) => {
  try {
    const { stdout, stderr } = await execFileAsync("python", ["-X", "utf8", RADAR_SCRIPT], { timeout: 300000 });
    logger.info('[Services]', "radar-sync:", stdout.trim());
    if (stderr) logger.error('[Services]', "radar-sync stderr:", stderr.trim());
    const data = readRadarData();
    res.json({ ok: true, log: stdout, data });
  } catch (e) {
    logger.error('[Services]', "radar-sync error:", e.message);
    res.status(500).json({ error: e.message, log: e.stdout || "" });
  }
});

router.get("/api/radar", (req, res) => {
  res.json(readRadarData());
});

// ── API: Máquina de Reels ────────────────────────────────────────────────────
router.get("/api/reels/analyze", (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "URL is required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const child = spawn("python", ["-X", "utf8", REELS_SCRIPT, url], { shell: true });
  let finalResult = null;

  child.on("error", (err) => {
    res.write(`data: ${JSON.stringify({ type: "error", message: "Erro ao iniciar o script: " + err.message })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done", result: { error: err.message } })}\n\n`);
    res.end();
  });

  child.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      if (line.startsWith("FINAL_RESULT:")) {
        try {
          finalResult = JSON.parse(line.substring(13));
        } catch(e) {}
      } else {
        res.write(`data: ${JSON.stringify({ type: "log", message: line })}\n\n`);
      }
    }
  });

  child.stderr.on("data", (data) => {
    res.write(`data: ${JSON.stringify({ type: "log", message: data.toString() })}\n\n`);
  });

  child.on("close", async (code) => {
    if (finalResult && !finalResult.error) {
      const history = await readReelsHistory();
      history.unshift({
        ...finalResult,
        url: url,
        timestamp: new Date().toISOString()
      });
      await writeReelsHistory(history.slice(0, 50));
    }
    res.write(`data: ${JSON.stringify({ type: "done", result: finalResult })}\n\n`);
    res.end();
  });
});

router.get("/api/reels/history", async (req, res) => {
  res.json(await readReelsHistory());
});

// ── API: Download de Reel (yt-dlp) ───────────────────────────────────────────
router.get("/api/reels/download", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "URL is required" });

  const tmpDir = path.join(__dirname, "..", "data", "reel-downloads");
  fs.mkdirSync(tmpDir, { recursive: true });

  const outTemplate = path.join(tmpDir, "%(id)s.%(ext)s");

  try {
    const { stdout } = await execFileAsync(
      "python",
      ["-X", "utf8", dlScript, url, outTemplate],
      { shell: false, maxBuffer: 10 * 1024 * 1024 }
    );

    const result = JSON.parse(stdout.trim().split("\n").pop());
    if (result.error) return res.status(500).json({ error: result.error });

    const filePath = result.file;
    const title = (result.title || "reel").replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 60);

    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ error: "Arquivo não encontrado após download." });
    }

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${title}.mp4"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on("close", () => { try { fs.unlinkSync(filePath); } catch {} });
  } catch (e) {
    res.status(500).json({ error: e.stderr || e.message });
  }
});

// ── API: Fábrica de Vídeos (Seedance) SSE ───────────────────────────────────
router.get("/api/video/generate", (req, res) => {
  const tema = req.query.tema;
  if (!tema) return res.status(400).json({ error: "Tema is required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const child = spawn("python", ["-X", "utf8", PIPELINE_SCRIPT, tema], { shell: true });

  child.on("error", (err) => {
    res.write(`data: ${JSON.stringify({ type: "error", message: "Erro ao iniciar o script: " + err.message })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  });

  child.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      res.write(`data: ${JSON.stringify({ type: "log", message: line })}\n\n`);
    }
  });

  child.stderr.on("data", (data) => {
    res.write(`data: ${JSON.stringify({ type: "log", message: data.toString() })}\n\n`);
  });

  child.on("close", (code) => {
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  });
});

router.delete("/api/reels/history/:index", async (req, res) => {
  const history = await readReelsHistory();
  const idx = parseInt(req.params.index);
  if (isNaN(idx) || idx < 0 || idx >= history.length) return res.status(400).json({ error: "Invalid index" });
  history.splice(idx, 1);
  await writeReelsHistory(history);
  res.json({ ok: true });
});

// ── API: Client config ────────────────────────────────────────────────────────
router.get('/api/client', (req, res) => {
  if (!CLIENT) return res.status(404).json({ error: 'client.json não encontrado' });
  res.json(CLIENT);
});

// ── POST /api/agent/chat ──────────────────────────────────────────────────────
router.post('/api/agent/chat', async (req, res) => {
  const { agentId, messages } = req.body;
  const system = AGENT_SYSTEM_PROMPTS[agentId];
  if (!system) return res.status(400).json({ error: `Agente não encontrado: ${agentId}` });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY não configurada no .env' });

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages é obrigatório' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: 700,
        temperature: 0.85,
      }),
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    res.json({ reply: data.choices[0].message.content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
