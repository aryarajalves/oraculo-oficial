FROM node:20-bookworm-slim

# Instala Python e dependências do sistema
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Cria diretório da aplicação
WORKDIR /app

# ── Dependências do Backend ───────────────────────────────────────────────────
COPY backend/package*.json ./backend/
RUN npm --prefix backend install

# ── Dependências do Python ────────────────────────────────────────────────────
COPY backend/requirements.txt ./backend/
RUN pip3 install --break-system-packages -r backend/requirements.txt

# ── Build do Frontend (Vite) ──────────────────────────────────────────────────
# Instala dependências e compila o frontend para /app/frontend/dist
# O Express serve este diretório estático em produção
COPY frontend/package*.json ./frontend/
RUN npm --prefix frontend install
COPY frontend/ ./frontend/
RUN npm --prefix frontend run build

# ── Código do Backend ─────────────────────────────────────────────────────────
COPY backend/ ./backend/

# Expõe a porta do dashboard backend
EXPOSE 3131

# Inicializa o servidor backend
CMD ["npm", "--prefix", "backend", "run", "dashboard"]
