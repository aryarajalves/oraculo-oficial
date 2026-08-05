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

# ── Código do Backend ─────────────────────────────────────────────────────────
COPY backend/ ./backend/

# Inicializa o serviço worker independente
CMD ["node", "backend/dashboard/workerService.js"]
