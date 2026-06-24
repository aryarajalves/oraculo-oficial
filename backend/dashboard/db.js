import pg from 'pg';
const { Pool, Client } = pg;

// Configuração do pool de conexões do PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'oracle_manager',
});

// Helper para executar queries
export const query = (text, params) => pool.query(text, params);

// Inicialização automática das tabelas (Schema definition)
export async function initDb() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || '123456';
  const targetDb = process.env.DB_NAME || 'oracle_manager';

  console.log('🔄 Verificando se o banco de dados existe...');
  const tempClient = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
  });

  try {
    await tempClient.connect();
    const res = await tempClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [targetDb]
    );

    if (res.rows.length === 0) {
      console.log(`➕ Banco de dados "${targetDb}" não encontrado. Criando...`);
      const cleanDbName = targetDb.replace(/[^a-zA-Z0-9_]/g, '');
      await tempClient.query(`CREATE DATABASE ${cleanDbName}`);
      console.log(`✅ Banco de dados "${targetDb}" criado com sucesso!`);
    } else {
      console.log(`✅ Banco de dados "${targetDb}" já existe.`);
    }
  } catch (err) {
    console.error('⚠️ Falha ao verificar/criar banco de dados padrão, prosseguindo com conexão direta:', err.message);
  } finally {
    try {
      await tempClient.end();
    } catch {}
  }

  console.log('🔄 Inicializando tabelas do banco de dados...');

  const createCarouselsTable = `
    CREATE TABLE IF NOT EXISTS carousels (
      id VARCHAR(100) PRIMARY KEY,
      title TEXT NOT NULL,
      theme VARCHAR(255),
      praca VARCHAR(100),
      format VARCHAR(50),
      preset VARCHAR(100),
      status VARCHAR(100),
      created_at VARCHAR(50),
      slides_dir TEXT,
      slide_prefix VARCHAR(100),
      total_slides INTEGER,
      caption TEXT,
      notes TEXT,
      slides JSONB,
      chat_history JSONB
    );
  `;

  const createReelsHistoryTable = `
    CREATE TABLE IF NOT EXISTS reels_history (
      id SERIAL PRIMARY KEY,
      gancho_original TEXT,
      padrao_psicologico TEXT,
      roteiro_fonte_oculta TEXT,
      transcricao_original TEXT,
      url TEXT,
      timestamp VARCHAR(100)
    );
  `;

  const createDashboardUsersTable = `
    CREATE TABLE IF NOT EXISTS dashboard_users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      permissions JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createInvitationsTable = `
    CREATE TABLE IF NOT EXISTS invitations (
      id VARCHAR(100) PRIMARY KEY,
      role VARCHAR(50) NOT NULL,
      permissions JSONB DEFAULT '{}'::jsonb,
      expires_at TIMESTAMP NOT NULL,
      status VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createBackupConfigTable = `
    CREATE TABLE IF NOT EXISTS backup_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      enabled BOOLEAN DEFAULT FALSE,
      frequency VARCHAR(50) DEFAULT 'hours',
      interval_val INTEGER DEFAULT 6,
      s3_folder VARCHAR(255) DEFAULT 'backups/',
      retention INTEGER DEFAULT 30,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT one_row CHECK (id = 1)
    );
  `;

  const createBackupLogsTable = `
    CREATE TABLE IF NOT EXISTS backup_logs (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      size_bytes BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(50) NOT NULL,
      error_message TEXT
    );
  `;

  try {
    await query(createCarouselsTable);
    await query(createReelsHistoryTable);
    await query(createDashboardUsersTable);
    await query(createInvitationsTable);
    await query(createBackupConfigTable);
    await query(createBackupLogsTable);

    // Inicializa a linha de configuração única se não existir
    const checkConfig = await query("SELECT * FROM backup_config WHERE id = 1");
    if (checkConfig.rows.length === 0) {
      await query(`
        INSERT INTO backup_config (id, enabled, frequency, interval_val, s3_folder, retention)
        VALUES (1, FALSE, 'hours', 6, 'backups/', 30);
      `);
    }

    console.log('✅ Tabelas carousels, reels_history, dashboard_users, invitations, backup_config e backup_logs validadas/criadas com sucesso.');
  } catch (err) {
    console.error('❌ Erro ao inicializar tabelas do banco de dados:', err);
    throw err;
  }
}

export default pool;
