# Log de Alterações no Banco de Dados (DATABASE_SCHEMA_LOG.md)

Este documento registra a evolução do esquema de banco de dados do projeto, garantindo a rastreabilidade e a reprodutibilidade das alterações em produção.

---

## [2026-06-23] Migração de JSON para PostgreSQL

### Motivação
Substituição da persistência local baseada em arquivos JSON (`carousels.json` e `reels_history.json`) pelo banco de dados PostgreSQL com `pgvector` oficial para melhorar a confiabilidade, integridade relacional e escalabilidade dos dados.

### Tabelas Criadas
1. **`carousels`**
   - Estrutura para armazenar metadados dos carrosséis gerados.
   - Colunas:
     - `id` VARCHAR(100) PRIMARY KEY
     - `title` TEXT NOT NULL
     - `theme` VARCHAR(255)
     - `praca` VARCHAR(100)
     - `format` VARCHAR(50)
     - `preset` VARCHAR(100)
     - `status` VARCHAR(100)
     - `created_at` VARCHAR(50)
     - `slides_dir` TEXT
     - `slide_prefix` VARCHAR(100)
     - `total_slides` INTEGER
     - `caption` TEXT
     - `notes` TEXT
     - `slides` JSONB (para manter a flexibilidade de nomes das imagens)

2. **`reels_history`**
   - Estrutura para histórico de análises de Reels.
   - Colunas:
     - `id` SERIAL PRIMARY KEY
     - `gancho_original` TEXT
     - `padrao_psicologico` TEXT
     - `roteiro_fonte_oculta` TEXT
     - `transcricao_original` TEXT
     - `url` TEXT
     - `timestamp` VARCHAR(100)

### Scripts de Migração
- **Script de Execução e Carga Inicial:** `backend/dashboard/scripts/migrate.js`
  - *Função:* Faz backup dos JSONs legados na pasta `backup/json_db_backup`, valida/cria as tabelas PostgreSQL e realiza o insert dos dados sem duplicidades.

### Instruções para Deploy
1. Atualizar as dependências locais:
   ```bash
   npm install --prefix backend
   ```
2. Executar o script de migração:
   ```bash
   docker exec oraculo_backend node backend/dashboard/scripts/migrate.js
   ```

---

## [2026-06-23] Sistema de Gestão de Usuários (dashboard_users e invitations)

### Motivação
Adicionar persistência para suporte a múltiplos usuários no dashboard, permitindo que o Super Admin envie links de convites temporários com níveis de acesso configuráveis (User ou Admin) e prazos de expiração.

### Tabelas Criadas
1. **`dashboard_users`**
   - Armazena os usuários registrados na plataforma.
   - Colunas:
     - `id` SERIAL PRIMARY KEY
     - `name` VARCHAR(255) NOT NULL
     - `email` VARCHAR(255) UNIQUE NOT NULL
     - `password` VARCHAR(255) NOT NULL (Senha criptografada com SHA-256)
     - `role` VARCHAR(50) NOT NULL
     - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

2. **`invitations`**
   - Armazena os tokens de convite gerados pelo Super Admin.
   - Colunas:
     - `id` VARCHAR(100) PRIMARY KEY (Token UUID único)
     - `role` VARCHAR(50) NOT NULL
     - `expires_at` TIMESTAMP NOT NULL
     - `status` VARCHAR(50) NOT NULL
     - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Scripts de Migração
- **Script de Migração:** `backend/dashboard/scripts/migrate_users.js`
  - *Função:* Executa a criação das tabelas `dashboard_users` e `invitations` no banco de dados.

### Instruções para Deploy
1. Executar o script de migração no container:
   ```bash
   docker exec oraculo_backend node backend/dashboard/scripts/migrate_users.js
   ```

---

## [2026-06-24] Adição do Histórico de Chat aos Carrosséis

### Motivação
Permitir a persistência e visualização da conversa de chat do Criador em que o carrossel foi construído.

### Alterações de Tabela
- **`carousels`**
  - Nova coluna: `chat_history` JSONB (armazena o histórico de mensagens em formato estruturado)

### Scripts de Migração
- **Script de Migração:** `backend/dashboard/scripts/migrate_chat_history.js`
  - *Função:* Adiciona a coluna `chat_history` à tabela `carousels` caso ainda não exista.

### Instruções para Deploy
1. Executar o script de migração no container:
   ```bash
   docker exec oraculo_backend node backend/dashboard/scripts/migrate_chat_history.js
   ```

---

## [2026-06-24] Adição de Permissões por Página para Usuários e Convites

### Motivação
Permitir o controle detalhado de acesso por página (Liberado, Em Progresso, Sem Acesso) para os usuários e os convites temporários.

### Alterações de Tabela
- **`dashboard_users`**
  - Nova coluna: `permissions` JSONB DEFAULT '{}'::jsonb (Armazena dicionário de acesso a páginas)
- **`invitations`**
  - Nova coluna: `permissions` JSONB DEFAULT '{}'::jsonb (Armazena dicionário de acesso a páginas no convite)

### Scripts de Migração
- **Script de Migração:** `backend/dashboard/scripts/migrate_permissions.js`
  - *Função:* Adiciona a coluna `permissions` às tabelas `dashboard_users` e `invitations` caso ainda não existam.

### Instruções para Deploy
1. Executar o script de migração no container:
   ```bash
   docker exec oraculo_backend node backend/dashboard/scripts/migrate_permissions.js
   ```




---

## [2026-06-24] Migração de Configurações do Filesystem para o PostgreSQL

### Motivação
Centralizar todas as configurações editáveis do dashboard no PostgreSQL para garantir portabilidade total: um único `pg_dump` + a variável `JWT_SECRET` são suficientes para migrar o sistema completo para qualquer servidor.

### Tabelas Criadas

1. **`agent_prompts`**
   - Substitui os arquivos `.md` de `backend/agents/` e `display_names.json`.
   - Colunas:
     - `id` VARCHAR(100) PRIMARY KEY (ex: "canalizador-visual")
     - `display_name` VARCHAR(255) — nome exibido no dashboard
     - `category` VARCHAR(100) — categoria do agente (copy, design, geral)
     - `content` TEXT NOT NULL — markdown completo do prompt
     - `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

2. **`branding`**
   - Substitui `backend/dashboard/data/branding.json`.
   - Singleton (sempre id = 1).
   - Colunas:
     - `id` INTEGER PRIMARY KEY DEFAULT 1
     - `data` JSONB NOT NULL — objeto completo de identidade visual
     - `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

3. **`api_keys`**
   - Substitui a edição de chaves no arquivo `.env` via dashboard.
   - Valores encriptados com AES-256-CBC usando `JWT_SECRET` como chave.
   - Colunas:
     - `key` VARCHAR(100) PRIMARY KEY — nome da variável (ex: "OPENAI_API_KEY")
     - `value` TEXT — valor encriptado (formato: "iv_hex:encrypted_hex")
     - `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Arquivos Criados/Modificados
- **[NEW]** `backend/dashboard/crypto.js` — módulo AES-256-CBC (encrypt/decrypt)
- **[NEW]** `backend/dashboard/scripts/migrate_settings_to_db.js` — script de migração único e idempotente
- **[MODIFY]** `backend/dashboard/db.js` — CREATE TABLE das 3 novas tabelas no initDb()
- **[MODIFY]** `backend/dashboard/routes/services.js` — rotas de settings migradas para queries SQL

### Script de Migração
- **Script:** `backend/dashboard/scripts/migrate_settings_to_db.js`
  - *Função:* Lê arquivos existentes e popula as tabelas. Idempotente (ON CONFLICT DO NOTHING).

### Instruções para Deploy
1. Rebuildar e reiniciar os containers:
   ```bash
   docker compose -f docker/docker-compose-local.yml up -d --build --force-recreate
   ```
2. Executar o script de migração **uma única vez**:
   ```bash
   docker exec oraculo_backend node backend/dashboard/scripts/migrate_settings_to_db.js
   ```

### Importante
- A `JWT_SECRET` é obrigatória no `.env` do servidor. É a única variável necessária além do banco.
- Não trocar a `JWT_SECRET` após a migração sem re-encriptar as keys.
