# Log de Alterações no Banco de Dados (DATABASE_SCHEMA_LOG.md)

Este documento registra a evolução do esquema de banco de dados do projeto, garantindo a rastreabilidade e a reprodutibilidade das alterações em produção.

## [2026-08-21] Migração Alembic 002: Índices GIN e Queries SQL Atômicas de Alta Performance

### Motivação
Substituir a reescrita monolítica da tabela de carrosséis por queries atômicas diretas no PostgreSQL (`getCarouselById`, `saveSingleCarousel`, `updateCarouselFields`, `deleteCarouselById`) e criar índices GIN nas colunas JSONB para busca instantânea em estruturas complexas.

### Otimizações de Acesso aos Dados
1. **Eliminação do overhead de I/O:**
   - Rotas de servir imagens (`/image/:filename`), fixação de cards (`/pin`), criação (`POST`), deleção (`DELETE`) e workers em background agora executam **queries atômicas em 1 único comando SQL** em vez de carregar e regravar todos os registros do banco.
2. **Índices GIN Criados (Migração 002):**
   - `idx_carousels_slides_gin` em `carousels (slides)`: Busca rápida dentro de arrays de slides JSONB.
   - `idx_carousels_chat_history_gin` em `carousels (chat_history)`: Acelera consultas no histórico de conversas do Criador.
   - `idx_library_chats_messages_gin` em `library_chats (messages)`: Otimiza histórico de mensagens do assistente da Biblioteca.
   - `idx_dashboard_users_permissions_gin` em `dashboard_users (permissions)`: Acelera verificação e filtros de permissões JSONB.

### Como Executar em Produção
```bash
docker exec -w /app/backend oraculo_backend alembic upgrade head
```

---

## [2026-08-21] Implementação do Alembic para Versionamento e Migrações de Banco de Dados

### Motivação
Substituir a criação e alteração manual de tabelas por um sistema profissional e padronizado de controle de versões de banco de dados (Alembic), permitindo histórico versionado, rollbacks confiáveis (`downgrade`) e execução automatizada em CI/CD e deploys.

### Estrutura Configurada
- **Arquivo de Configuração:** `backend/alembic.ini`
- **Ambiente de Conexão:** `backend/migrations/env.py` (conecta dinamicamente ao PostgreSQL a partir das variáveis do `.env`)
- **Pasta de Versões:** `backend/migrations/versions/`
- **Tabela de Controle no Postgres:** `alembic_version`

### Migrações Criadas
1. **`001_initial_schema` (`backend/migrations/versions/001_initial_schema.py`):**
   - Criação/validação baseline de todas as 11 tabelas: `carousels`, `reels_history`, `dashboard_users`, `invitations`, `backup_config`, `backup_logs`, `agent_prompts`, `branding`, `api_keys`, `library_images`, `library_chats`.
   - Criação de todos os índices de alta performance (`idx_carousels_pinned_created`, `idx_carousels_status`, `idx_carousels_scheduled`, `idx_library_images_category_created`, `idx_backup_logs_created`, `idx_invitations_status_expires`).

### Como Executar em Produção
```bash
# Aplicar todas as migrações mais recentes
docker exec -w /app/backend oraculo_backend alembic upgrade head

# Verificar versão atual
docker exec -w /app/backend oraculo_backend alembic current
```

---

## [2026-08-21] Otimização de Performance: Criação de Índices Estratégicos e Tuning de Conexões

### Motivação
Acelerar a busca e ordenação no Dashboard, melhorar a performance do Worker RabbitMQ/Scheduler de publicações e otimizar o pool de conexões do PostgreSQL evitando gargalos de conexões ociosas ou timeouts.

### Tabelas e Índices Criados
1. **`carousels`**:
   - `idx_carousels_pinned_created`: `(is_pinned DESC, pinned_at DESC, created_at DESC)` — Acelera listagem e paginação principal do Dashboard.
   - `idx_carousels_status`: `(status)` — Acelera filtros por status (ex: 'rascunho', 'generating').
   - `idx_carousels_scheduled`: `(scheduled_timestamp) WHERE scheduled_timestamp IS NOT NULL` — Otimiza o scheduler de agendamento de posts.
2. **`library_images`**:
   - `idx_library_images_category_created`: `(category, created_at DESC)` — Acelera consultas por categoria e data na Biblioteca.
3. **`backup_logs`**:
   - `idx_backup_logs_created`: `(created_at DESC)` — Acelera a aba de Histórico de Backups.
4. **`invitations`**:
   - `idx_invitations_status_expires`: `(status, expires_at)` — Acelera validação de convites ativos.

### Otimização do Pool de Conexões (`pg.Pool`)
- `max`: 20 conexões simultâneas (configurável via `DB_POOL_MAX`).
- `idleTimeoutMillis`: 30.000ms (fecha conexões ociosas).
- `connectionTimeoutMillis`: 5.000ms (impede travamento de requisições).

#### Script de Migração
- **Script Standalone:** `backend/scripts/optimize_postgres_indexes.js`
- **Execução Automática:** Integrado ao `initDb()` em `backend/dashboard/db.js`.

---

## [2026-08-21] Adição da coluna prompt na tabela library_images

### Motivação
Armazenar de forma estruturada o prompt utilizado para a criação/geração de imagens salvas a partir do Assistente IA para a Biblioteca Principal.

### Tabela Afetada: `library_images`

#### Novas Colunas
| Coluna | Tipo | Descrição |
|---|---|---|
| `prompt` | `TEXT` | Prompt detalhado utilizado para gerar a imagem via IA |

#### Script de Migração
- Executado automaticamente pelo `initDb()` em `backend/dashboard/db.js`: `ALTER TABLE library_images ADD COLUMN IF NOT EXISTS prompt TEXT;`

---

## [2026-08-20] Criação das tabelas da Biblioteca (library_images e library_chats)

### Motivação
Suporte à funcionalidade de Biblioteca de Referências Visuais e Assistente de Criação IA com referências visuais e histórico persistente de chat e imagens geradas.

### Tabelas Criadas: `library_images` e `library_chats`

#### Estrutura: `library_images`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | Identificador único da imagem |
| `title` | `VARCHAR(255) NOT NULL` | Nome / título da imagem |
| `category` | `VARCHAR(100)` | Categoria / tag da imagem (ex: Geral, Pessoas, Estilo, Cenários) |
| `notes` | `TEXT` | Anotações, descrição ou prompt de estilo associado |
| `filename` | `VARCHAR(255) NOT NULL` | Nome do arquivo armazenado |
| `storage_path` | `TEXT NOT NULL` | Caminho no armazenamento MinIO ou local |
| `mime_type` | `VARCHAR(100)` | Tipo MIME (image/png, image/jpeg, image/webp) |
| `size_bytes` | `BIGINT` | Tamanho do arquivo em bytes |
| `width` | `INTEGER` | Largura da imagem em pixels |
| `height` | `INTEGER` | Altura da imagem em pixels |
| `created_by` | `VARCHAR(255)` | E-mail do usuário que fez o upload |
| `created_at` | `TIMESTAMP` | Data e hora de criação |

#### Estrutura: `library_chats`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | Identificador único |
| `user_email` | `VARCHAR(255) UNIQUE NOT NULL` | E-mail do usuário dono da sessão |
| `messages` | `JSONB` | Array estruturado com histórico de mensagens do chat |
| `generated_images` | `JSONB` | Array de imagens geradas durante a sessão |
| `updated_at` | `TIMESTAMP` | Data e hora da última alteração |

#### Script de Migração
- Standalone: `backend/dashboard/scripts/migrate_library.js`
- Automático: Executado no `initDb()` em `backend/dashboard/db.js`.

---

## [2026-08-05] Adição de colunas de agendamento de publicação na tabela carousels

### Motivação
Suporte a agendamentos de publicação via worker de background. Permite armazenar a data/hora em ISO e em timestamp UNIX para verificação do disparo automático.

### Tabela Afetada: `carousels`

#### Novas Colunas
| Coluna | Tipo | Descrição |
|---|---|---|
| `scheduled_at` | `TIMESTAMP` | Data e hora formatada em ISO do agendamento |
| `scheduled_timestamp` | `BIGINT` | Timestamp UNIX (em segundos) do agendamento |

#### Script de Migração
Executado automaticamente pelo `initDb()` no arquivo `backend/dashboard/db.js`.

**Para aplicar manualmente (se necessário):**
```sql
ALTER TABLE carousels ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP DEFAULT NULL;
ALTER TABLE carousels ADD COLUMN IF NOT EXISTS scheduled_timestamp BIGINT DEFAULT NULL;
```

---

## [2026-08-03] Adição de colunas de tempo de geração na tabela carousels

### Motivação
O campo de duração da geração (`generationDuration`) era calculado corretamente no worker após a conclusão do pipeline, mas não era persistido no banco de dados PostgreSQL. Isso causava o desaparecimento do badge `⏱️ 1m 45s` nos cards do Dashboard após recarregar a página.

### Tabela Afetada: `carousels`

#### Novas Colunas
| Coluna | Tipo | Descrição |
|---|---|---|
| `generation_duration` | `VARCHAR(100)` | Duração formatada da geração (ex: `1m 45s`) |
| `generation_time_seconds` | `INTEGER` | Duração em segundos (para cálculo programático) |

#### Script de Migração
`backend/scripts/add_generation_duration_columns.py`

**Para aplicar manualmente (se necessário):**
```sql
ALTER TABLE carousels ADD COLUMN IF NOT EXISTS generation_duration VARCHAR(100);
ALTER TABLE carousels ADD COLUMN IF NOT EXISTS generation_time_seconds INTEGER;
```

> **Nota:** A migração já é executada automaticamente no `initDb()` ao iniciar o servidor.

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

---

## [2026-07-07] Adição da Coluna de Qualidade de Imagem nos Carrosséis

### Motivação
Adicionar persistência para o campo `image_quality` no banco de dados PostgreSQL para suportar a recuperação e validação de configurações personalizadas de qualidade de imagem geradas a partir do briefing.

### Alterações de Tabela
- **`carousels`**
  - Nova coluna: `image_quality` VARCHAR(100) DEFAULT 'high' (armazena o preset de qualidade do carrossel: auto, low, medium, high, standard, hd)

### Scripts de Migração
- **Script de Migração:** Integrado automaticamente na inicialização do banco no `backend/dashboard/db.js` via `ALTER TABLE carousels ADD COLUMN IF NOT EXISTS image_quality VARCHAR(100) DEFAULT 'high';`

### Instruções para Deploy
1. Rebuildar e reiniciar os containers:
   ```bash
   docker compose -f docker/docker-compose-local.yml up -d --build --force-recreate
   ```

---

## [2026-07-16] Adição de Colunas de Provedor de Imagem e Modelo de IA nos Carrosséis

### Motivação
Adicionar persistência para as colunas `image_provider` e `copy_model` na tabela `carousels` do PostgreSQL. Isso permite registrar e exibir de forma permanente qual IA/provedor de imagem gerou os slides e qual LLM gerou o prompt/copy de cada carrossel.

### Alterações de Tabela
- **`carousels`**
  - Nova coluna: `image_provider` VARCHAR(100) DEFAULT 'gpt-image-2'
  - Nova coluna: `copy_model` VARCHAR(100) DEFAULT 'gpt-4o'

### Scripts de Migração
- **Script de Migração:** Integrado automaticamente no script de inicialização do banco de dados em `backend/dashboard/db.js` via:
  - `ALTER TABLE carousels ADD COLUMN IF NOT EXISTS image_provider VARCHAR(100) DEFAULT 'gpt-image-2';`
  - `ALTER TABLE carousels ADD COLUMN IF NOT EXISTS copy_model VARCHAR(100) DEFAULT 'gpt-4o';`

### Instruções para Deploy
1. Rebuildar e reiniciar os containers:
   ```bash
   docker compose -f docker/docker-compose-local.yml up -d --build --force-recreate
   ```

---

## [2026-07-16] Adição da Coluna no_image_slides_count nos Carrosséis

### Motivação
Adicionar persistência para a coluna `no_image_slides_count` na tabela `carousels` do PostgreSQL. Isso permite registrar e configurar a quantidade de slides finais com fundo preto e sem geração de imagens.

### Alterações de Tabela
- **`carousels`**
  - Nova coluna: `no_image_slides_count` INTEGER DEFAULT 0

### Scripts de Migração
- **Script de Migração:** Integrado automaticamente no script de inicialização do banco de dados em `backend/dashboard/db.js` via:
  - `ALTER TABLE carousels ADD COLUMN IF NOT EXISTS no_image_slides_count INTEGER DEFAULT 0;`

### Instruções para Deploy
1. Rebuildar e reiniciar os containers:
   ```bash
   docker compose -f docker/docker-compose-local.yml up -d --build --force-recreate
   ```

---

## [2026-07-22] Adição de Colunas de Fixar Carrosséis (is_pinned e pinned_at)

### Motivação
Permitir que o usuário posicione carrosséis prioritários no topo do Dashboard, com limite de até 10 carrosséis fixados simultaneamente.

### Alterações de Tabela
- **`carousels`**
  - Nova coluna: `is_pinned` BOOLEAN DEFAULT FALSE
  - Nova coluna: `pinned_at` TIMESTAMP DEFAULT NULL

### Scripts de Migração
- **Script de Migração:** Integrado automaticamente no script de inicialização do banco de dados em `backend/dashboard/db.js` via:
  - `ALTER TABLE carousels ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;`
  - `ALTER TABLE carousels ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP DEFAULT NULL;`

### Instruções para Deploy
1. Rebuildar e reiniciar os containers:
   ```bash
   docker compose -f docker/docker-compose-local.yml up -d --build --force-recreate
   ```


