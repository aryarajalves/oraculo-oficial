// dashboard/server.js — Oráculo Manager Content Dashboard
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import { initDb } from "./db.js";
import { logger } from "./logger.js";

// Import modules
import { 
  IS_PROD, 
  PUBLIC_DIR, 
  sseClients, 
  requireAuth,
  rateLimiter
} from "./state.js";

import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import carouselsRouter from "./routes/carousels.js";
import servicesRouter from "./routes/services.js";
import backupsRouter from "./routes/backups.js";
import { resetBackupScheduler } from "./backupManager.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env from project root ──────────────────────────────────────────────
(function loadEnv() {
  try {
    let envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) {
      envPath = path.join(__dirname, '..', '..', '.env');
    }
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !process.env[k]) process.env[k] = v;
    }
  } catch {}
})();

const app = express();
const PORT = process.env.PORT || 3131;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Necessário para obter IPs reais atrás de um proxy reverso
app.set('trust proxy', 1);

// Configura CORS baseado na variável de ambiente
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Se não houver origin (como apps mobile ou curl) ou se as allowedOrigins estiverem vazias, permite
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado pelo CORS'));
    }
  },
  credentials: true
}));

// Apply global authentication check
app.use(requireAuth);

// ── Rate Limiting por segmento de rota ──────────────────────────────────────────
// 1. Auth/Login: 10 requisições por minuto
app.use('/auth', rateLimiter(10, 60000));

// 2. Geração e Backups (carousels, services, backups): 30 requisições por minuto
app.use('/api/carousels', rateLimiter(30, 60000));
app.use('/api/services', rateLimiter(30, 60000));
app.use('/api/backups', rateLimiter(30, 60000));

// 3. Outras rotas gerais do dashboard (ex: users, etc): 60 requisições por minuto
app.use('/api/users', rateLimiter(60, 60000));

// ── Register Routers ─────────────────────────────────────────────────────────
app.use(authRouter);
app.use(usersRouter);
app.use(carouselsRouter);
app.use(servicesRouter);
app.use(backupsRouter);

app.use(express.static(PUBLIC_DIR, { extensions: ['html', 'htm'] }));

// ── Catch-all SPA — serve index.html para qualquer rota não encontrada ──────
// Necessário para que rotas do frontend (/login, /dashboard, etc) funcionem
// sem o sufixo .html em produção (o React Router cuida do roteamento interno)
app.get('*', (req, res, next) => {
  // Não intercepta rotas de API
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) return next();
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    next();
  }
});

// ── Global SSE ─────────────────────────────────────────────────────────────────
app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  sseClients.add(sendEvent);
  req.on("close", () => sseClients.delete(sendEvent));
});

app.post("/api/events/broadcast", (req, res) => {
  sseClients.forEach(send => send(req.body));
  res.json({ ok: true });
});

// ── Cron Job: Publicador Automático ──────────────────────────────────────────
setInterval(async () => {
  try {
    const PUB_SCRIPT = path.join(__dirname, "..", "publisher.py");
    const { stdout } = await execFileAsync("python", ["-X", "utf8", PUB_SCRIPT]);
    if (stdout && stdout.includes("Post:")) {
      logger.info('[CRON]', 'Publicador executou:\n' + stdout);
    }
  } catch (e) {
    if (e.stdout && e.stdout.includes("Post:")) {
       logger.warn('[CRON]', 'Publicador executou (mas retornou código de saída não-zero):\n' + e.stdout);
    }
  }
}, 60000); // Roda a cada 60 segundos

// ── Start ────────────────────────────────────────────────────────────────────
initDb().then(() => {
  resetBackupScheduler();
  app.listen(PORT, () => {
    const env = process.env.NODE_ENV || 'development';
    logger.info('[SERVER]', `✅ Oráculo Dashboard iniciado — porta: ${PORT} | ambiente: ${env}`);
  });
}).catch(err => {
  logger.error('[SERVER]', '❌ Falha crítica ao inicializar banco de dados:', err);
  process.exit(1);
});
