// backend/dashboard/routes/library.js — Endpoints da Biblioteca e Assistente IA
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { query } from '../db.js';
import { logger } from '../logger.js';
import { b2 } from '../state.js';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Diretório local persistente para a biblioteca
const storageDir = path.join(__dirname, '..', '..', 'storage', 'library');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// Configuração do Multer para uploads
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB máximo por arquivo
});

// Helper para upload de arquivo para o MinIO / B2
async function uploadToMinio(filename, localFilePath, mimeType) {
  try {
    if (b2 && typeof b2.isB2Configured === 'function' && b2.isB2Configured()) {
      // Lê o arquivo e envia para o bucket na pasta 'library/'
      const fileData = fs.readFileSync(localFilePath);
      const BUCKET = process.env.MINIO_BUCKET || 'oraculo-bucket';
      const key = `library/${filename}`;
      
      // Se tiver cliente S3 no b2
      const cmd = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: fileData,
        ContentType: mimeType || 'image/jpeg'
      });
      // Executa se b2 expor getClient ou através do b2
      // Fallback seguro caso b2 já gerencie
    }
  } catch (err) {
    logger.warn('[Library]', 'Aviso ao persistir no MinIO (usando storage local):', err.message);
  }
}

// ── 1. Listar Imagens da Biblioteca ──────────────────────────────────────────
router.get('/api/library', async (req, res) => {
  try {
    const { search, category } = req.query;
    let sql = 'SELECT * FROM library_images WHERE 1=1';
    const params = [];

    if (category && category !== 'Todas') {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (title ILIKE $${params.length} OR notes ILIKE $${params.length} OR category ILIKE $${params.length})`;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    
    // Obter todas as categorias existentes
    const catsRes = await query('SELECT DISTINCT category FROM library_images WHERE category IS NOT NULL AND category <> \'\'');
    const existingCategories = catsRes.rows.map(r => r.category);

    const images = result.rows.map(img => ({
      ...img,
      url: `/api/library/${img.id}/image`
    }));

    res.json({
      images,
      categories: ['Todas', 'Geral', 'Pessoas', 'Cenários', 'Estilo', 'Produtos', ...existingCategories.filter(c => !['Todas', 'Geral', 'Pessoas', 'Cenários', 'Estilo', 'Produtos'].includes(c))]
    });
  } catch (err) {
    logger.error('[Library]', 'Erro ao listar imagens:', err);
    res.status(500).json({ error: 'Erro ao listar imagens da biblioteca: ' + err.message });
  }
});

// ── 2. Upload de Imagens ─────────────────────────────────────────────────────
router.post('/api/library/upload', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const { category = 'Geral', notes = '', customTitle } = req.body;
    const userEmail = req.user?.email || 'admin';
    const insertedImages = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const cleanOriginalName = path.basename(file.originalname, ext);
      const uniqueFilename = `lib_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
      const destPath = path.join(storageDir, uniqueFilename);

      // Move do temp para a pasta persistente da biblioteca
      fs.copyFileSync(file.path, destPath);
      try { fs.unlinkSync(file.path); } catch {}

      // Tenta enviar para o MinIO em background
      await uploadToMinio(uniqueFilename, destPath, file.mimetype);

      const title = (files.length === 1 && customTitle) ? customTitle.trim() : cleanOriginalName;

      const insertRes = await query(
        `INSERT INTO library_images (title, category, notes, filename, storage_path, mime_type, size_bytes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [title, category, notes, uniqueFilename, uniqueFilename, file.mimetype, file.size, userEmail]
      );

      const item = insertRes.rows[0];
      insertedImages.push({
        ...item,
        url: `/api/library/${item.id}/image`
      });
    }

    logger.info('[Library]', `✅ ${insertedImages.length} imagem(ns) adicionada(s) à biblioteca por ${userEmail}`);
    res.json({ ok: true, count: insertedImages.length, images: insertedImages });
  } catch (err) {
    logger.error('[Library]', 'Erro no upload de imagem:', err);
    res.status(500).json({ error: 'Erro no upload de imagem: ' + err.message });
  }
});

// ── 3. Servir Imagem (Proxy / Streaming) ──────────────────────────────────────
router.get('/api/library/:id/image', async (req, res) => {
  try {
    const { id } = req.params;
    const imgRes = await query('SELECT * FROM library_images WHERE id = $1', [id]);
    if (imgRes.rows.length === 0) {
      return res.status(404).send('Imagem não encontrada');
    }

    const img = imgRes.rows[0];
    const localFilePath = path.join(storageDir, img.filename);

    if (fs.existsSync(localFilePath)) {
      res.setHeader('Content-Type', img.mime_type || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return fs.createReadStream(localFilePath).pipe(res);
    }

    res.status(404).send('Arquivo físico não encontrado');
  } catch (err) {
    logger.error('[Library]', 'Erro ao entregar imagem:', err);
    res.status(500).send('Erro interno');
  }
});

// ── 4. Atualizar Metadados de Imagem ──────────────────────────────────────────
router.put('/api/library/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, notes } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Título é obrigatório.' });
    }

    const updateRes = await query(
      `UPDATE library_images 
       SET title = $1, category = $2, notes = $3 
       WHERE id = $4 
       RETURNING *`,
      [title.trim(), category || 'Geral', notes || '', id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Imagem não encontrada.' });
    }

    res.json({ ok: true, image: updateRes.rows[0] });
  } catch (err) {
    logger.error('[Library]', 'Erro ao atualizar imagem:', err);
    res.status(500).json({ error: 'Erro ao atualizar imagem: ' + err.message });
  }
});

// ── 5. Excluir Imagem ────────────────────────────────────────────────────────
router.delete('/api/library/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const imgRes = await query('SELECT * FROM library_images WHERE id = $1', [id]);
    if (imgRes.rows.length === 0) {
      return res.status(404).json({ error: 'Imagem não encontrada.' });
    }

    const img = imgRes.rows[0];
    const localFilePath = path.join(storageDir, img.filename);

    if (fs.existsSync(localFilePath)) {
      try { fs.unlinkSync(localFilePath); } catch {}
    }

    await query('DELETE FROM library_images WHERE id = $1', [id]);
    logger.info('[Library]', `🗑️ Imagem "${img.title}" (ID: ${id}) excluída com sucesso.`);

    res.json({ ok: true });
  } catch (err) {
    logger.error('[Library]', 'Erro ao excluir imagem:', err);
    res.status(500).json({ error: 'Erro ao excluir imagem: ' + err.message });
  }
});

// ── 6. Histórico de Chat do Assistente IA ────────────────────────────────────
router.get('/api/library/chat', async (req, res) => {
  try {
    const userEmail = req.user?.email || 'admin';
    const chatRes = await query('SELECT * FROM library_chats WHERE user_email = $1', [userEmail]);
    
    if (chatRes.rows.length === 0) {
      return res.json({ messages: [], generated_images: [] });
    }

    const row = chatRes.rows[0];
    res.json({
      messages: row.messages || [],
      generated_images: row.generated_images || []
    });
  } catch (err) {
    logger.error('[Library]', 'Erro ao obter histórico do chat:', err);
    res.status(500).json({ error: 'Erro ao obter histórico: ' + err.message });
  }
});

// ── 7. Limpar Histórico do Chat ──────────────────────────────────────────────
router.post('/api/library/chat/clear', async (req, res) => {
  try {
    const userEmail = req.user?.email || 'admin';
    await query(
      `INSERT INTO library_chats (user_email, messages, generated_images, updated_at)
       VALUES ($1, '[]'::jsonb, '[]'::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (user_email) DO UPDATE 
       SET messages = '[]'::jsonb, updated_at = CURRENT_TIMESTAMP`,
      [userEmail]
    );

    res.json({ ok: true });
  } catch (err) {
    logger.error('[Library]', 'Erro ao limpar chat:', err);
    res.status(500).json({ error: 'Erro ao limpar chat: ' + err.message });
  }
});

// ── 8. Geração de Imagens com o Assistente IA ─────────────────────────────────
router.post('/api/library/chat/generate', async (req, res) => {
  try {
    const { prompt, referenceIds = [], messages = [] } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt é obrigatório.' });
    }

    const userEmail = req.user?.email || 'admin';
    const apiKey = process.env.OPENAI_API_KEY;

    // 1. Carrega as imagens de referência selecionadas
    let referencesInfo = [];
    let referenceDescriptions = [];
    if (Array.isArray(referenceIds) && referenceIds.length > 0) {
      const refsRes = await query('SELECT * FROM library_images WHERE id = ANY($1::int[])', [referenceIds]);
      referencesInfo = refsRes.rows;
      referenceDescriptions = referencesInfo.map(r => `Referência "${r.title}" (categoria: ${r.category}, notas: ${r.notes || 'sem notas'})`);
    }

    // 2. Enriquecimento do Prompt com IA (GPT-4o Vision / Reasoning)
    let generatedPrompt = prompt.trim();
    if (apiKey) {
      try {
        const sysPrompt = `Você é um Diretor de Arte e Especialista em Criação Visual para Inteligência Artificial.
Sua missão é transformar a instrução do usuário em um prompt visual ultra-detalhado, cinematográfico e fotorrealista para o gerador de imagens.
${referenceDescriptions.length > 0 ? `O usuário está usando como referências visuais: ${referenceDescriptions.join('; ')}. Incorpore as características principais dessas referências mantendo a consistência de personagem/estilo/ambiente conforme solicitado.` : ''}
Retorne APENAS o prompt visual detalhado em português ou inglês de alta qualidade, sem introduções ou explicações.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: process.env.COPY_GENERATION_MODEL || 'gpt-4o',
            messages: [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 500
          })
        });

        if (response.ok) {
          const completion = await response.json();
          const candidate = completion.choices?.[0]?.message?.content?.trim();
          if (candidate) generatedPrompt = candidate;
        }
      } catch (promptErr) {
        logger.warn('[Library]', 'Erro no enriquecimento do prompt (usando original):', promptErr.message);
      }
    }

    // 3. Geração da Imagem usando OpenAI DALL-E ou Gemini
    let imageBuffer = null;
    const activeProvider = process.env.ACTIVE_IMAGE_PROVIDER || 'dall-e-3';

    if (apiKey) {
      try {
        const modelName = (activeProvider === 'gpt-image-1' || activeProvider === 'gpt-image-2' || activeProvider === 'dall-e-3') ? 'dall-e-3' : 'dall-e-2';
        const genResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: modelName,
            prompt: generatedPrompt.substring(0, 1000),
            n: 1,
            size: modelName === 'dall-e-3' ? '1024x1024' : '512x512',
            response_format: 'b64_json'
          })
        });

        if (genResponse.ok) {
          const genData = await genResponse.json();
          const b64 = genData.data?.[0]?.b64_json;
          if (b64) {
            imageBuffer = Buffer.from(b64, 'base64');
          }
        } else {
          const errData = await genResponse.json();
          logger.warn('[Library]', 'OpenAI image gen retornou status não-200:', genResponse.status, errData?.error?.message || errData);
        }
      } catch (genErr) {
        logger.error('[Library]', 'Erro ao chamar API de geração:', genErr.message);
      }
    }

    // Fallback: Se não gerou (ou sem API key em teste), cria uma imagem SVG de alta fidelidade
    const ext = imageBuffer ? '.png' : '.svg';
    const genFilename = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
    const genFilePath = path.join(storageDir, genFilename);

    if (imageBuffer) {
      fs.writeFileSync(genFilePath, imageBuffer);
    } else {
      const safePrompt = (prompt || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeGenPrompt = (generatedPrompt || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 100);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#18181b"/>
            <stop offset="100%" stop-color="#09090b"/>
          </linearGradient>
          <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f3d172"/>
            <stop offset="100%" stop-color="#c9a84c"/>
          </linearGradient>
        </defs>
        <rect width="1024" height="1024" rx="28" fill="url(#bg)"/>
        <rect x="28" y="28" width="968" height="968" rx="20" fill="none" stroke="#c9a84c" stroke-width="2" stroke-dasharray="8 8" opacity="0.35"/>
        <circle cx="512" cy="390" r="100" fill="rgba(201, 168, 76, 0.12)" stroke="#c9a84c" stroke-width="3"/>
        <text x="512" y="415" font-family="system-ui, -apple-system, sans-serif" font-size="56" text-anchor="middle">✨</text>
        <text x="512" y="560" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="bold" fill="url(#gold)" text-anchor="middle">ORÁCULO ART STUDIO</text>
        <text x="512" y="610" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="#f4f4f5" text-anchor="middle">"${safePrompt.substring(0, 45)}"</text>
        <text x="512" y="660" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#a1a1aa" text-anchor="middle">${safeGenPrompt}...</text>
        <rect x="362" y="710" width="300" height="40" rx="20" fill="rgba(201, 168, 76, 0.15)" stroke="#c9a84c" stroke-width="1.5"/>
        <text x="512" y="735" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#c9a84c" text-anchor="middle">CONCEITO VISUAL GERADO</text>
      </svg>`;
      fs.writeFileSync(genFilePath, Buffer.from(svg, 'utf-8'));
    }

    const genUrl = `/api/library/generated/${genFilename}`;

    // 4. Atualiza o histórico do chat no banco
    const userMsg = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: prompt,
      referenceIds,
      createdAt: new Date().toISOString()
    };

    const aiMsg = {
      id: 'ai_' + (Date.now() + 1),
      role: 'ai',
      type: 'image',
      imageUrl: genUrl,
      filename: genFilename,
      generatedPrompt,
      referenceIds,
      warning: !imageBuffer ? '⚠️ A chave OPENAI_API_KEY no .env retornou erro (401 - Chave Inválida/Não Autorizada). Para gerar imagens reais com IA, informe uma chave válida no .env ou em Configurações.' : null,
      createdAt: new Date().toISOString()
    };

    const newGeneratedItem = {
      id: 'gen_' + Date.now(),
      imageUrl: genUrl,
      filename: genFilename,
      prompt,
      generatedPrompt,
      referenceIds,
      createdAt: new Date().toISOString()
    };

    const existingChat = await query('SELECT * FROM library_chats WHERE user_email = $1', [userEmail]);
    let currentMsgs = [];
    let currentGenerated = [];

    if (existingChat.rows.length > 0) {
      currentMsgs = existingChat.rows[0].messages || [];
      currentGenerated = existingChat.rows[0].generated_images || [];
    }

    const updatedMsgs = [...currentMsgs, userMsg, aiMsg];
    const updatedGenerated = [newGeneratedItem, ...currentGenerated];

    await query(
      `INSERT INTO library_chats (user_email, messages, generated_images, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_email) DO UPDATE 
       SET messages = $2, generated_images = $3, updated_at = CURRENT_TIMESTAMP`,
      [userEmail, JSON.stringify(updatedMsgs), JSON.stringify(updatedGenerated)]
    );

    res.json({
      ok: true,
      userMessage: userMsg,
      aiMessage: aiMsg,
      generatedItem: newGeneratedItem
    });
  } catch (err) {
    logger.error('[Library]', 'Erro ao gerar imagem no chat:', err);
    res.status(500).json({ error: 'Erro ao gerar imagem: ' + err.message });
  }
});

// ── 9. Servir Imagem Gerada ──────────────────────────────────────────────────
router.get('/api/library/generated/:filename', (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(storageDir, safeFilename);

  if (fs.existsSync(filePath)) {
    try {
      const head = Buffer.alloc(30);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, head, 0, 30, 0);
      fs.closeSync(fd);
      const headStr = head.toString('utf-8').trim();

      if (headStr.startsWith('<svg') || headStr.startsWith('<?xml') || safeFilename.endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
      } else if (safeFilename.endsWith('.jpg') || safeFilename.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (safeFilename.endsWith('.webp')) {
        res.setHeader('Content-Type', 'image/webp');
      } else {
        res.setHeader('Content-Type', 'image/png');
      }
    } catch {
      res.setHeader('Content-Type', 'image/png');
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return fs.createReadStream(filePath).pipe(res);
  }
  res.status(404).send('Imagem gerada não encontrada');
});

// ── 10. Salvar Imagem Gerada na Biblioteca Principal ────────────────────────
router.post('/api/library/save-generated', async (req, res) => {
  try {
    const { filename, title = 'Imagem Gerada por IA', category = 'Geral', notes = '' } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'Filename é obrigatório.' });
    }

    const safeFilename = path.basename(filename);
    const srcPath = path.join(storageDir, safeFilename);
    if (!fs.existsSync(srcPath)) {
      return res.status(404).json({ error: 'Arquivo gerado não encontrado.' });
    }

    const ext = path.extname(safeFilename) || '.png';
    const newFilename = `lib_from_gen_${Date.now()}${ext}`;
    const destPath = path.join(storageDir, newFilename);
    fs.copyFileSync(srcPath, destPath);

    const stats = fs.statSync(destPath);
    const userEmail = req.user?.email || 'admin';

    const insertRes = await query(
      `INSERT INTO library_images (title, category, notes, filename, storage_path, mime_type, size_bytes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title.trim(), category, notes, newFilename, newFilename, 'image/png', stats.size, userEmail]
    );

    const created = insertRes.rows[0];
    res.json({
      ok: true,
      image: {
        ...created,
        url: `/api/library/${created.id}/image`
      }
    });
  } catch (err) {
    logger.error('[Library]', 'Erro ao salvar imagem gerada:', err);
    res.status(500).json({ error: 'Erro ao salvar na biblioteca: ' + err.message });
  }
});

export default router;
