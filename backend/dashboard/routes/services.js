import express from "express";
import fs from "fs";
import path from "path";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { 
  readData, 
  readDataAsync,
  readReelsHistory, 
  writeReelsHistory, 
  getSlidesFromDir, 
  getLocalSlidesDir,
  getSlidesForCarousel,
  getCarouselCostDetails
} from "../helpers.js";
import { buildAgentPrompts } from "../agentPrompts.js";
import { CLIENT, requireSuperAdmin } from "../state.js";
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
  { key: 'COPY_GENERATION_MODEL',label: 'Modelo de Copy Ativo',      group: 'Texto & Copy' },
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
    const all = await readDataAsync();
    res.json({ ok: true, log: stdout, carousels: all });
  } catch (e) {
    logger.error('[Services]', "oraculo error:", e.message);
    res.status(500).json({ error: e.message, log: e.stdout || "" });
  }
});

router.get("/api/oraculo", async (req, res) => {
  const all = await readDataAsync();
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
  const all = await readDataAsync();
  res.json(all.filter(c => c.projeto === "haucacau"));
});

// ── API: Stats ───────────────────────────────────────────────────────────────
router.get("/api/stats", async (req, res) => {
  const all = await readDataAsync();
  const statusCount = {};
  let totalSlides = 0;
  let totalCostBrl = 0;

  all.forEach(c => {
    statusCount[c.status] = (statusCount[c.status] || 0) + 1;
    const slides = getSlidesForCarousel(c);
    totalSlides += slides.length;
    
    const costDetails = getCarouselCostDetails(c);
    const costUsd = Number(costDetails.cost) || 0;
    const costBrl = costUsd * 5.6; // Converter USD -> BRL (taxa 5.6)
    totalCostBrl += costBrl;
  });

  const roundedCostBrl = Math.round(totalCostBrl * 100) / 100;

  res.json({
    totalCarousels: all.length,
    totalSlides,
    byStatus: statusCount,
    totalCostBrl: roundedCostBrl,
    lastUpdated: new Date().toISOString(),
    total: all.length,
    slides: totalSlides,
    aprovados: (statusCount['aprovado'] || 0) + (statusCount['pronto'] || 0),
    publicados: statusCount['publicado'] || 0,
    cost: roundedCostBrl,
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
  let activeProvider = env['ACTIVE_IMAGE_PROVIDER'] || 'gpt-image-2';
  if (activeProvider === 'dall-e-2') activeProvider = 'gpt-image-1-mini';

  res.json({
    keys: result,
    activeProvider,
    activeCopyModel: env['COPY_GENERATION_MODEL'] || 'gpt-4o',
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

// ── API: Saldo OpenAI (apenas Super Admin) ────────────────────────────────────
router.get('/api/settings/openai-balance', requireSuperAdmin, async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'sua_openai_api_key_aqui') {
    return res.json({
      ok: false,
      error: 'OPENAI_API_KEY não configurada.',
      billingUrl: 'https://platform.openai.com/settings/organization/billing/overview'
    });
  }

  const BILLING_URL = 'https://platform.openai.com/settings/organization/billing/overview';

  try {
    // Tenta o endpoint de credit_grants (não oficial, mas amplamente usado)
    const response = await fetch('https://api.openai.com/v1/dashboard/billing/credit_grants', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const totalGranted = data.total_granted ?? null;
      const totalUsed = data.total_used ?? null;
      const totalAvailable = data.total_available ?? null;
      const grants = data.grants?.data ?? [];

      logger.info('[OpenAI-Balance]', `Saldo disponível: $${totalAvailable ?? 'N/A'}`);

      return res.json({
        ok: true,
        totalGranted,
        totalUsed,
        totalAvailable,
        grants,
        billingUrl: BILLING_URL
      });
    }

    // Se 401 ou 403, a chave não tem permissão para esse endpoint
    const status = response.status;
    logger.warn('[OpenAI-Balance]', `Endpoint retornou ${status}. Chave pode ser de projeto sem acesso a billing.`);

    return res.json({
      ok: false,
      error: `Endpoint de billing retornou ${status}. Sua chave de API pode ser de um projeto e não ter acesso ao faturamento.`,
      billingUrl: BILLING_URL
    });

  } catch (err) {
    logger.error('[OpenAI-Balance]', 'Erro ao consultar saldo:', err.message);
    return res.json({
      ok: false,
      error: 'Erro de rede ao consultar a OpenAI.',
      billingUrl: BILLING_URL
    });
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

async function getAllAgentPrompts(client) {
  let displayNames = readDisplayNames();

  let dbPromptsMap = {};
  try {
    const dbRes = await query('SELECT id, display_name, content FROM agent_prompts');
    if (dbRes && dbRes.rows) {
      for (const row of dbRes.rows) {
        dbPromptsMap[row.id] = {
          name: row.display_name,
          content: row.content
        };
      }
    }
  } catch {}

  const dynamicPrompts = buildAgentPrompts(client) || {};
  let list = [];

  try {
    if (fs.existsSync(AGENTS_DIR)) {
      const files = fs.readdirSync(AGENTS_DIR);
      list = files
        .filter(f => f.endsWith('.md'))
        .map(f => {
          const id = f.replace('.md', '');
          const fileContent = fs.readFileSync(path.join(AGENTS_DIR, f), 'utf-8');
          const dbEntry = dbPromptsMap[id];
          let name = (dbEntry && dbEntry.name) || displayNames[id];
          if (!name) {
            name = id
              .split('-')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
              .replace('Haucacau', 'HauCacau')
              .replace('V2', 'V2')
              .replace('Dna', 'DNA')
              .replace('Cta', 'CTA');
          }
          const content = (dbEntry && dbEntry.content) ? dbEntry.content : fileContent;
          return { id, name, content };
        });
    }
  } catch (e) {
    logger.error('[AgentPrompts]', 'Erro ao ler pasta agents:', e.message);
  }

  for (const [key, text] of Object.entries(dynamicPrompts)) {
    if (!list.some(a => a.id === key)) {
      const formattedName = key
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const dbEntry = dbPromptsMap[key];
      const content = (dbEntry && dbEntry.content) ? dbEntry.content : text;
      list.push({ id: key, name: formattedName, content });
    }
  }

  const map = Object.fromEntries(list.map(a => [a.id, a.content]));
  return { map, list };
}

router.get('/api/settings/prompts', async (req, res) => {
  try {
    const { list } = await getAllAgentPrompts(CLIENT);
    res.json({ prompts: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/settings/prompts', async (req, res) => {
  const { id, content } = req.body;
  if (!id || content === undefined) {
    return res.status(400).json({ error: 'Parâmetros inválidos. É necessário fornecer id e content.' });
  }
  const safeId = path.basename(id);
  const filePath = path.join(AGENTS_DIR, `${safeId}.md`);
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    try {
      await query(`
        INSERT INTO agent_prompts (id, content, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (id) DO UPDATE SET content = $2, updated_at = NOW()
      `, [safeId, content]);
    } catch (dbErr) {
      logger.warn('[AgentPrompts]', `Aviso ao salvar prompt no DB: ${dbErr.message}`);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/settings/prompts/rename', async (req, res) => {
  const { id, name } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: 'Parâmetros inválidos. Forneça id e name.' });
  }
  try {
    const displayNames = readDisplayNames();
    displayNames[id] = name;
    writeDisplayNames(displayNames);
    try {
      await query(`
        INSERT INTO agent_prompts (id, display_name, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (id) DO UPDATE SET display_name = $2, updated_at = NOW()
      `, [id, name]);
    } catch {}
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
        max_tokens: 4000,
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

// ── API: Visualizador de Logs ──────────────────────────────────────────────────
router.get("/api/logs", async (req, res) => {
  const LOGS_FILE = path.join(__dirname, "..", "..", "logs", "app.log");
  try {
    if (!fs.existsSync(LOGS_FILE)) {
      return res.json({ logs: [], totalLines: 0, availableDates: [], status: { whatsapp: true, rabbitmq: true } });
    }

    const { date, level, search, limit = 2000 } = req.query;
    const content = fs.readFileSync(LOGS_FILE, "utf-8");
    const rawLines = content.split("\n").filter(Boolean);

    // Obter datas únicas com logs
    const datesSet = new Set();
    rawLines.forEach(line => {
      const parts = line.split(" - ");
      if (parts.length >= 4) {
        const datetime = parts[0];
        const datePart = datetime.split(" ")[0]; // DD/MM/YYYY
        if (datePart && /^\d{2}\/\d{2}\/\d{4}$/.test(datePart)) {
          datesSet.add(datePart);
        }
      }
    });
    const availableDates = Array.from(datesSet).reverse(); // Mais recente primeiro

    let filterDate = date;
    if (!filterDate && availableDates.length > 0) {
      filterDate = availableDates[0]; // Padrão: mais recente
    }

    // Converter YYYY-MM-DD para DD/MM/YYYY
    if (filterDate && filterDate.includes("-")) {
      const dateParts = filterDate.split("-");
      if (dateParts.length === 3) {
        filterDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      }
    }

    let parsed = rawLines.map((line, idx) => {
      const parts = line.split(" - ");
      if (parts.length >= 4) {
        const datetime = parts[0];
        const tag = parts[1];
        const lvl = parts[2];
        const msg = parts.slice(3).join(" - ");
        return { id: idx + 1, datetime, tag, level: lvl, message: msg };
      }
      return { id: idx + 1, datetime: "", tag: "SYSTEM", level: "INFO", message: line };
    });

    if (filterDate) {
      parsed = parsed.filter(l => l.datetime.startsWith(filterDate));
    }
    
    if (level) {
      parsed = parsed.filter(l => l.level === level.toUpperCase());
    }

    if (search) {
      const q = search.toLowerCase();
      parsed = parsed.filter(l => 
        l.message.toLowerCase().includes(q) || 
        l.tag.toLowerCase().includes(q)
      );
    }

    const totalLines = parsed.length;
    const limited = parsed.slice(-Number(limit));

    res.json({
      logs: limited,
      totalLines,
      availableDates,
      selectedDate: filterDate,
      status: {
        whatsapp: true,
        rabbitmq: true
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/logs", async (req, res) => {
  const LOGS_FILE = path.join(__dirname, "..", "..", "logs", "app.log");
  try {
    if (fs.existsSync(LOGS_FILE)) {
      fs.writeFileSync(LOGS_FILE, "", "utf-8");
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/logs/delete-items", async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: "O parâmetro 'ids' deve ser um array." });
  }
  const LOGS_FILE = path.join(__dirname, "..", "..", "logs", "app.log");
  try {
    if (!fs.existsSync(LOGS_FILE)) {
      return res.json({ ok: true });
    }
    const content = fs.readFileSync(LOGS_FILE, "utf-8");
    const rawLines = content.split("\n").filter(Boolean);
    // Filtrar as linhas baseando-se no ID (index + 1)
    const newLines = rawLines.filter((_, idx) => !ids.includes(idx + 1));
    fs.writeFileSync(LOGS_FILE, newLines.join("\n") + (newLines.length > 0 ? "\n" : ""), "utf-8");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
