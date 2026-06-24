import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fonte-oculta-secret-key-change-in-prod";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

// Gera um token JWT contendo payload do usuário
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verifica e decodifica o token JWT
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const IS_PROD = process.env.NODE_ENV === "production";

let b2Instance = null;
if (IS_PROD) {
  try {
    b2Instance = await import("./b2.js");
    console.log("[B2] Modo produção ativado — usando Backblaze B2");
  } catch (err) {
    console.error("Erro ao carregar módulo B2:", err);
  }
}
export { b2Instance as b2 };

function loadClientConfig() {
  try {
    const p = path.join(__dirname, '..', 'client.json');
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch (e) {
    console.error("Erro ao carregar client.json:", e);
  }
  return null;
}
export const CLIENT = loadClientConfig();

export const DATA_FILE = path.join(__dirname, "data", "carousels.json");
export const PUBLIC_DIR = path.join(__dirname, "..", "..", "frontend");
export const COMPOSE_SCRIPT = path.join(__dirname, "..", "core", "util", "compose-slide.py");
export const REGEN_SCRIPT = path.join(__dirname, "..", "regen-slide.py");
export const REELS_HISTORY_FILE = path.join(__dirname, "data", "reels_history.json");
export const ZIP_SCRIPT = path.join(__dirname, "..", "zip-carousels.py");

export const generationJobs = new Map();
export const sseClients = new Set();

// Hash helper para senhas
export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Helper para obter e-mail do Super Admin
export function getSuperAdminEmail() {
  return process.env.DASHBOARD_USER || 'jordao';
}

// Helper para verificar se um e-mail pertence ao Super Admin
export function isUserSuperAdmin(email) {
  const superAdminUser = getSuperAdminEmail();
  return email === superAdminUser || email === 'afonteoculta@gmail.com' || email === 'afonteoculta';
}

// Auth middleware
export function requireAuth(req, res, next) {
  const publicPaths = ['/login.html', '/auth/login', '/auth/logout', '/api/settings/branding', '/register.html', '/api/users/register'];
  if (publicPaths.includes(req.path)) return next();

  if (req.path.startsWith('/api/users/invitations/') && req.path.endsWith('/verify')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Não autenticado' });
    return res.redirect('/login.html');
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Token inválido ou expirado' });
    return res.redirect('/login.html');
  }

  req.user = decoded;
  return next();
}

// Middleware para restringir rotas apenas ao Super Admin
export function requireSuperAdmin(req, res, next) {
  if (req.user && isUserSuperAdmin(req.user.email)) {
    return next();
  }
  return res.status(403).json({ error: 'Acesso negado. Apenas o Super Admin tem acesso.' });
}

// Memória para armazenar tentativas e limites de Rate Limit
const rateLimitsMap = new Map();

// Coletor de lixo (Garbage Collector) rodando a cada 10 minutos em background
// para apagar IPs expirados e evitar memory leaks em servidores de produção
setInterval(() => {
  const now = Date.now();
  for (const [key, limit] of rateLimitsMap.entries()) {
    if (now > limit.resetTime) {
      rateLimitsMap.delete(key);
    }
  }
}, 600000); // 10 minutos (600.000 ms)

// Middleware de Rate Limit paramétrico
export function rateLimiter(maxRequests, windowMs) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    const key = `${ip}:${req.baseUrl || req.path}`;

    if (!rateLimitsMap.has(key)) {
      rateLimitsMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const limit = rateLimitsMap.get(key);

    if (now > limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + windowMs;
      return next();
    }

    limit.count++;
    if (limit.count > maxRequests) {
      return res.status(429).json({ error: 'Muitas requisições. Tente novamente mais tarde.' });
    }

    return next();
  };
}
